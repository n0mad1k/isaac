"""
Email Notification Service
Sends email notifications using SMTP settings from database or config
"""

import aiosmtplib
import html
import re
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import Optional, List
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession


def _escape_html(text: str) -> str:
    """Escape HTML special characters to prevent XSS/injection in email bodies"""
    if text is None:
        return ""
    return html.escape(str(text))


def _sanitize_header(value: str) -> str:
    """
    Sanitize email header values to prevent header injection attacks.
    Removes newlines and carriage returns which could inject additional headers.
    """
    if value is None:
        return ""
    # Remove newlines, carriage returns, and tabs that could inject headers
    return re.sub(r'[\r\n\t]', '', str(value))


class ConfigurationError(Exception):
    """Raised when required configuration is missing"""
    pass


class EmailService:
    """Service for sending email notifications"""

    def __init__(
        self,
        host: str = None,
        port: int = None,
        user: str = None,
        password: str = None,
        from_addr: str = None,
        farm_name: str = None,
    ):
        """
        Initialize email service.
        Settings can be passed directly or loaded from DB using get_configured_service()
        """
        self.host = host
        self.port = port
        self.user = user
        self.password = password
        self.from_addr = from_addr or user
        self.farm_name = farm_name or "Isaac Farm"

    @classmethod
    async def get_configured_service(cls, db: AsyncSession) -> "EmailService":
        """
        Create an EmailService configured from database settings.
        Raises ConfigurationError if SMTP is not configured.
        """
        from routers.settings import get_setting

        host = await get_setting(db, "smtp_host")
        port_str = await get_setting(db, "smtp_port")
        user = await get_setting(db, "smtp_user")
        password = await get_setting(db, "smtp_password")
        from_addr = await get_setting(db, "smtp_from")
        farm_name = await get_setting(db, "farm_name")

        # Validate required settings
        if not host or not user:
            raise ConfigurationError(
                "Email not configured. Go to Settings > Email Server (SMTP) to configure."
            )
        if not password:
            # Password is missing or decryption failed (encryption key changed)
            raise ConfigurationError(
                "SMTP password missing or invalid. Go to Settings > Email Server (SMTP) and re-enter your SMTP password."
            )

        port = int(port_str) if port_str else 587

        # Build from_addr: use display name if provided, always use user as the email
        if from_addr and "@" not in from_addr:
            # from_addr is a display name, not an email
            from_address = f"{from_addr} <{user}>"
        else:
            from_address = from_addr or user

        return cls(
            host=host,
            port=port,
            user=user,
            password=password,
            from_addr=from_address,
            farm_name=farm_name,
        )

    def is_configured(self) -> bool:
        """Check if email is properly configured"""
        return all([self.host, self.port, self.user, self.password])

    async def send_email(
        self,
        subject: str,
        body: str,
        to: Optional[str] = None,
        html: bool = False,
        subject_prefix: Optional[str] = None,
        from_name: Optional[str] = None,
        no_prefix: bool = False,
    ) -> bool:
        """Send an email notification.

        Args:
            subject: Email subject line
            body: Email body (plain text or HTML)
            to: Recipient email address
            html: Whether body is HTML
            subject_prefix: Override the default [Isaac] prefix (e.g., farm name for customer receipts)
            from_name: Override the From header display name (e.g., farm name for customer receipts)
            no_prefix: If True, don't add any prefix to the subject (for customer emails)
        """
        if not self.is_configured():
            logger.warning("Email not configured, skipping notification")
            return False

        if not to:
            logger.error("No recipient specified")
            return False

        # Sanitize recipient to prevent header injection
        recipient = _sanitize_header(to)

        try:
            message = MIMEMultipart("alternative")
            # Sanitize subject to prevent header injection
            # no_prefix=True for customer emails where subject should be used as-is
            if no_prefix:
                message["Subject"] = _sanitize_header(subject)
            else:
                prefix = f"[{_sanitize_header(subject_prefix)}]" if subject_prefix else "[Isaac]"
                message["Subject"] = f"{prefix} {_sanitize_header(subject)}"

            # Use from_name if provided to override the From header display name (e.g., for customer emails)
            if from_name:
                # Extract just the email from self.from_addr (handles "Name <email>" format)
                email_match = re.search(r'<(.+)>', self.from_addr)
                actual_email = email_match.group(1) if email_match else self.from_addr
                message["From"] = f"{_sanitize_header(from_name)} <{actual_email}>"
            else:
                message["From"] = self.from_addr
            message["To"] = recipient

            if html:
                message.attach(MIMEText(body, "html"))
            else:
                message.attach(MIMEText(body, "plain"))

            # Resolve hostname to multiple IPs and try each one
            # This handles DNS round-robin where some servers may be down
            import socket
            import ssl
            try:
                addr_info = socket.getaddrinfo(self.host, self.port, socket.AF_INET, socket.SOCK_STREAM)
                ips = list(set(info[4][0] for info in addr_info))
                logger.debug(f"SMTP host {self.host} resolved to {len(ips)} IPs: {ips}")
            except socket.gaierror as e:
                logger.warning(f"DNS resolution failed for {self.host}: {e}, using hostname directly")
                ips = [self.host]  # Fallback to hostname if resolution fails

            last_error = None
            for ip in ips:
                try:
                    # Create SSL context with proper hostname verification (SNI)
                    tls_context = ssl.create_default_context()

                    # Use SMTP client directly for more control
                    # Disable auto STARTTLS so we can manually specify server_hostname for SNI
                    # Use shorter timeout (10s) so we fail fast and try next IP
                    smtp = aiosmtplib.SMTP(
                        hostname=ip,
                        port=self.port,
                        timeout=10,
                        start_tls=False,  # We'll do STARTTLS manually with proper SNI
                    )
                    await smtp.connect()
                    # STARTTLS with the original hostname for certificate validation (SNI)
                    await smtp.starttls(tls_context=tls_context, server_hostname=self.host)
                    await smtp.login(self.user, self.password)
                    await smtp.send_message(message)
                    await smtp.quit()

                    logger.info(f"Email sent: {subject} to {recipient} (via {ip})")
                    return True
                except (aiosmtplib.SMTPConnectError, aiosmtplib.SMTPConnectTimeoutError, TimeoutError, OSError) as e:
                    logger.warning(f"Failed to connect to {ip}:{self.port}, trying next IP: {e}")
                    last_error = e
                    continue

            # All IPs failed
            if last_error:
                raise aiosmtplib.SMTPConnectError(str(last_error))

        except aiosmtplib.SMTPAuthenticationError as e:
            logger.error(f"SMTP authentication failed: {e}. Check username/password. For Protonmail, you need to use Protonmail Bridge credentials.")
            raise ConfigurationError("SMTP authentication failed. Check username/password in Settings. For Protonmail, you need Protonmail Bridge credentials.")
        except (aiosmtplib.SMTPConnectError, aiosmtplib.SMTPConnectTimeoutError) as e:
            logger.error(f"Failed to connect to SMTP server: {e}")
            raise ConfigurationError(f"Cannot connect to SMTP server {self.host}:{self.port}. Check server settings.")
        except Exception as e:
            logger.error(f"Failed to send email: {type(e).__name__}: {e}")
            raise ConfigurationError(f"Failed to send email: {type(e).__name__}. Check SMTP settings.")

    async def send_daily_digest(
        self,
        tasks: List[dict],
        weather: dict,
        alerts: List[dict],
        recipient: str = None,
        verse: dict = None,
        team_alerts: List[dict] = None,
    ) -> bool:
        """Send daily digest email with verse of the day, tasks, weather, and team alerts"""
        subject = f"Daily Farm Digest - {datetime.now().strftime('%m/%d/%Y')}"

        # Verse of the day section
        verse_section = ""
        if verse and verse.get("text"):
            verse_section = f"""
            <div class="section" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 25px;">
                <p style="font-size: 18px; font-style: italic; margin: 0 0 15px 0;">"{_escape_html(verse.get('text', ''))}"</p>
                <p style="font-size: 14px; margin: 0; opacity: 0.9;">— {_escape_html(verse.get('reference', ''))} ({_escape_html(verse.get('version', 'NIV'))})</p>
            </div>
            """

        html = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; }}
                .header {{ background: #2d5a27; color: white; padding: 20px; text-align: center; }}
                .section {{ padding: 15px; border-bottom: 1px solid #eee; }}
                .section h2 {{ color: #2d5a27; margin-top: 0; }}
                .task {{ padding: 8px; margin: 5px 0; background: #f9f9f9; border-radius: 4px; }}
                .task.high {{ border-left: 4px solid #e74c3c; }}
                .task.medium {{ border-left: 4px solid #f39c12; }}
                .task.low {{ border-left: 4px solid #3498db; }}
                .alert {{ padding: 10px; margin: 5px 0; border-radius: 4px; }}
                .alert.critical {{ background: #fadbd8; border-left: 4px solid #e74c3c; }}
                .alert.warning {{ background: #fef9e7; border-left: 4px solid #f39c12; }}
                .alert.info {{ background: #ebf5fb; border-left: 4px solid #3498db; }}
                .weather {{ display: flex; flex-wrap: wrap; gap: 15px; }}
                .weather-item {{ flex: 1; min-width: 100px; text-align: center; }}
                .weather-value {{ font-size: 24px; font-weight: bold; color: #2d5a27; }}
                .weather-label {{ font-size: 12px; color: #666; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🌾 Isaac Daily Digest</h1>
                <p>{datetime.now().strftime('%m/%d/%Y')}</p>
            </div>
            {verse_section}
        """

        # Weather forecast section
        if weather:
            conditions = weather.get('conditions', 'No forecast available')
            html += f"""
            <div class="section">
                <h2>🌤️ Today's Forecast</h2>
                <div class="weather">
                    <div class="weather-item">
                        <div class="weather-value">{weather.get('high', '--')}°</div>
                        <div class="weather-label">High</div>
                    </div>
                    <div class="weather-item">
                        <div class="weather-value">{weather.get('low', '--')}°</div>
                        <div class="weather-label">Low</div>
                    </div>
                    <div class="weather-item">
                        <div class="weather-value">{weather.get('rain_chance', 0)}%</div>
                        <div class="weather-label">Rain Chance</div>
                    </div>
                </div>
                <p style="text-align: center; color: #666; margin-top: 10px;">{conditions}</p>
            </div>
            """

        # Alerts section
        if alerts:
            html += """
            <div class="section">
                <h2>⚠️ Active Alerts</h2>
            """
            for alert in alerts:
                severity = _escape_html(alert.get("severity", "info"))
                html += f"""
                <div class="alert {severity}">
                    <strong>{_escape_html(alert.get('title', 'Alert'))}</strong><br>
                    {_escape_html(alert.get('message', ''))}
                </div>
                """
            html += "</div>"

        # Team alerts section (gear, training, medical)
        if team_alerts:
            html += """
            <div class="section">
                <h2>🎒 Team Readiness Alerts</h2>
            """
            for alert in team_alerts:
                alert_type = alert.get("type", "info")
                icon = "⚠️" if alert_type == "expired" else "📉" if alert_type == "low_stock" else "📅"
                severity_class = "critical" if alert_type == "expired" else "warning"
                html += f"""
                <div class="alert {severity_class}">
                    {icon} <strong>{_escape_html(alert.get('member', 'Team'))}</strong> - {_escape_html(alert.get('item', 'Item'))}<br>
                    <small>{_escape_html(alert.get('message', ''))}</small>
                </div>
                """
            html += "</div>"

        # Tasks section
        if tasks:
            html += """
            <div class="section">
                <h2>📋 Today's Tasks</h2>
            """
            priority_map = {1: "high", 2: "medium", 3: "low"}
            for task in tasks:
                priority_class = priority_map.get(task.get("priority", 2), "medium")
                # Format time if present (convert 24h to 12h format)
                time_str = ""
                if task.get("due_time"):
                    try:
                        hour, minute = map(int, task["due_time"].split(":"))
                        period = "AM" if hour < 12 else "PM"
                        display_hour = hour if hour <= 12 else hour - 12
                        if display_hour == 0:
                            display_hour = 12
                        time_str = f'<span style="color:#666;margin-right:8px">{display_hour}:{minute:02d} {period}</span>'
                    except (ValueError, AttributeError):
                        pass
                html += f"""
                <div class="task {priority_class}">
                    {time_str}<strong>{_escape_html(task.get('title', 'Task'))}</strong>
                    {f"<br><small>{_escape_html(task.get('description', ''))}</small>" if task.get('description') else ""}
                </div>
                """
            html += "</div>"
        else:
            html += """
            <div class="section">
                <h2>📋 Today's Tasks</h2>
                <p>No tasks scheduled for today! 🎉</p>
            </div>
            """

        html += """
            <div class="section" style="text-align: center; color: #666; font-size: 12px;">
                <p>Generated by Isaac - Your Farm Assistant</p>
            </div>
        </body>
        </html>
        """

        return await self.send_email(subject, html, to=recipient, html=True)

    async def send_weather_alert(self, alert: dict, to: str = None) -> bool:
        """Send an immediate weather alert

        Args:
            alert: Dict with alert details (title, severity, message, recommended_actions)
            to: Recipient email address (required)
        """
        if not to:
            logger.error("No recipient specified for weather alert")
            return False

        severity = _escape_html(alert.get("severity", "warning")).upper()
        subject = f"{severity}: {_escape_html(alert.get('title', 'Weather Alert'))}"

        html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: {'#e74c3c' if severity == 'CRITICAL' else '#f39c12'};
                        color: white; padding: 20px; text-align: center;">
                <h1>⚠️ Weather Alert</h1>
            </div>
            <div style="padding: 20px;">
                <h2>{_escape_html(alert.get('title', 'Alert'))}</h2>
                <p>{_escape_html(alert.get('message', ''))}</p>

                <h3>Recommended Actions:</h3>
                <p>{_escape_html(alert.get('recommended_actions', 'Monitor conditions.'))}</p>

                <p style="color: #666; font-size: 12px; margin-top: 30px;">
                    Alert generated at {datetime.now().strftime('%I:%M %p on %m/%d/%Y')}
                </p>
            </div>
        </body>
        </html>
        """

        return await self.send_email(subject, html, to=to, html=True)

    async def send_team_alert_email(
        self,
        recipient: str,
        alert_type: str,
        alerts: List[dict],
    ) -> bool:
        """Send a team readiness alert email for a specific category.

        Args:
            recipient: Email recipient
            alert_type: Type of alert ("Gear", "Training", "Medical")
            alerts: List of alert dicts with type, member, item, message
        """
        if not recipient:
            logger.error("No recipient specified for team alert email")
            return False

        subject = f"Team {alert_type} Alerts - {datetime.now().strftime('%m/%d/%Y')}"

        # Choose icon and color based on alert type
        type_config = {
            "Gear": {"icon": "🎒", "color": "#3498db"},
            "Training": {"icon": "📚", "color": "#9b59b6"},
            "Medical": {"icon": "🏥", "color": "#e74c3c"},
        }
        config = type_config.get(alert_type, {"icon": "⚠️", "color": "#f39c12"})

        html = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; }}
                .header {{ background: {config['color']}; color: white; padding: 20px; text-align: center; }}
                .section {{ padding: 15px; }}
                .alert {{ padding: 10px; margin: 5px 0; border-radius: 4px; background: #f9f9f9; }}
                .alert.expired {{ border-left: 4px solid #e74c3c; background: #fadbd8; }}
                .alert.low_stock {{ border-left: 4px solid #f39c12; background: #fef9e7; }}
                .alert.expiring {{ border-left: 4px solid #f39c12; background: #fef9e7; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>{config['icon']} Team {_escape_html(alert_type)} Alerts</h1>
                <p>{datetime.now().strftime('%m/%d/%Y')}</p>
            </div>
            <div class="section">
                <p>The following {_escape_html(alert_type.lower())} items require attention:</p>
        """

        for alert in alerts:
            alert_class = alert.get("type", "info")
            icon = "⚠️" if alert_class == "expired" else "📉" if alert_class == "low_stock" else "📅"
            html += f"""
                <div class="alert {alert_class}">
                    {icon} <strong>{_escape_html(alert.get('member', 'Team'))}</strong> - {_escape_html(alert.get('item', 'Item'))}<br>
                    <small>{_escape_html(alert.get('message', ''))}</small>
                </div>
            """

        html += """
            </div>
            <div class="section" style="text-align: center; color: #666; font-size: 12px;">
                <p>Generated by Isaac - Your Farm Assistant</p>
            </div>
        </body>
        </html>
        """

        return await self.send_email(subject, html, to=recipient, html=True)

    async def send_team_alerts_digest(
        self,
        recipient: str,
        gear_alerts: List[dict] = None,
        training_alerts: List[dict] = None,
        medical_alerts: List[dict] = None,
    ) -> bool:
        """Send a combined team alerts digest email with all alert categories.

        This is a separate daily email that ONLY sends if there are alerts to report.
        Unlike the main daily digest, this focuses purely on team readiness issues.

        Args:
            recipient: Email recipient
            gear_alerts: List of gear alerts (low stock, expired, expiring)
            training_alerts: List of overdue training alerts
            medical_alerts: List of overdue medical appointment alerts

        Returns:
            True if sent successfully, False otherwise
        """
        if not recipient:
            logger.error("No recipient specified for team alerts digest")
            return False

        # Count total alerts
        all_alerts = (gear_alerts or []) + (training_alerts or []) + (medical_alerts or [])
        if not all_alerts:
            logger.info("No team alerts to send")
            return False

        subject = f"⚠️ Team Alerts Digest - {len(all_alerts)} Items Need Attention - {datetime.now().strftime('%m/%d/%Y')}"

        html = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; }}
                .header {{ background: #dc2626; color: white; padding: 20px; text-align: center; }}
                .section {{ padding: 15px; border-bottom: 1px solid #eee; }}
                .section h2 {{ margin-top: 0; }}
                .alert {{ padding: 10px; margin: 5px 0; border-radius: 4px; background: #f9f9f9; }}
                .alert.expired {{ border-left: 4px solid #e74c3c; background: #fadbd8; }}
                .alert.low_stock {{ border-left: 4px solid #f39c12; background: #fef9e7; }}
                .alert.expiring {{ border-left: 4px solid #f39c12; background: #fef9e7; }}
                .summary {{ background: #fef2f2; padding: 15px; border-radius: 8px; margin: 15px 0; }}
                .summary-item {{ display: inline-block; padding: 5px 15px; margin: 5px; border-radius: 20px; color: white; font-weight: bold; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>⚠️ Team Alerts Digest</h1>
                <p>{datetime.now().strftime('%m/%d/%Y')}</p>
            </div>

            <div class="section">
                <div class="summary">
                    <strong>Summary:</strong>
        """

        # Summary badges
        if gear_alerts:
            html += f'<span class="summary-item" style="background: #3498db;">🎒 {len(gear_alerts)} Gear</span>'
        if training_alerts:
            html += f'<span class="summary-item" style="background: #9b59b6;">📚 {len(training_alerts)} Training</span>'
        if medical_alerts:
            html += f'<span class="summary-item" style="background: #e74c3c;">🏥 {len(medical_alerts)} Medical</span>'

        html += """
                </div>
            </div>
        """

        # Gear alerts section
        if gear_alerts:
            html += """
            <div class="section">
                <h2>🎒 Gear Alerts</h2>
            """
            for alert in gear_alerts:
                alert_class = alert.get("type", "info")
                icon = "⚠️" if alert_class == "expired" else "📉" if alert_class == "low_stock" else "📅"
                html += f"""
                <div class="alert {alert_class}">
                    {icon} <strong>{_escape_html(alert.get('member', 'Team'))}</strong> - {_escape_html(alert.get('item', 'Item'))}<br>
                    <small>{_escape_html(alert.get('message', ''))}</small>
                </div>
                """
            html += "</div>"

        # Training alerts section
        if training_alerts:
            html += """
            <div class="section">
                <h2>📚 Training Alerts</h2>
            """
            for alert in training_alerts:
                html += f"""
                <div class="alert expired">
                    ⚠️ <strong>{_escape_html(alert.get('member', 'Team'))}</strong> - {_escape_html(alert.get('item', 'Item'))}<br>
                    <small>{_escape_html(alert.get('message', ''))}</small>
                </div>
                """
            html += "</div>"

        # Medical alerts section
        if medical_alerts:
            html += """
            <div class="section">
                <h2>🏥 Medical Alerts</h2>
            """
            for alert in medical_alerts:
                html += f"""
                <div class="alert expired">
                    ⚠️ <strong>{_escape_html(alert.get('member', 'Team'))}</strong> - {_escape_html(alert.get('item', 'Item'))}<br>
                    <small>{_escape_html(alert.get('message', ''))}</small>
                </div>
                """
            html += "</div>"

        html += """
            <div class="section" style="text-align: center; color: #666; font-size: 12px;">
                <p>Generated by Isaac - Your Farm Assistant</p>
                <p><small>This alert is sent separately from the daily digest when team items need attention.</small></p>
            </div>
        </body>
        </html>
        """

        return await self.send_email(subject, html, to=recipient, html=True)

    async def send_task_reminder(self, task: dict, to: str = None) -> bool:
        """Send a task reminder email

        Args:
            task: Dict with task details (title, description, due_date, category, notes)
            to: Recipient email address (required)
        """
        if not to:
            logger.error("No recipient specified for task reminder")
            return False

        subject = f"Reminder: {_escape_html(task.get('title', 'Task Due'))}"

        due_date = task.get("due_date", "Soon")
        if hasattr(due_date, "strftime"):
            due_date = due_date.strftime("%m/%d/%Y")

        html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #2d5a27; color: white; padding: 20px; text-align: center;">
                <h1>📋 Task Reminder</h1>
            </div>
            <div style="padding: 20px;">
                <h2>{_escape_html(task.get('title', 'Task'))}</h2>
                <p><strong>Due:</strong> {_escape_html(str(due_date))}</p>
                <p><strong>Category:</strong> {_escape_html(task.get('category', 'General'))}</p>

                {f"<p>{_escape_html(task.get('description', ''))}</p>" if task.get('description') else ""}

                {f"<p><strong>Notes:</strong> {_escape_html(task.get('notes', ''))}</p>" if task.get('notes') else ""}
            </div>
        </body>
        </html>
        """

        return await self.send_email(subject, html, to=to, html=True)

    async def send_cold_protection_reminder(
        self,
        plants: List[dict],
        forecast_low: float,
        sunset_time: str,
        recipients: str = None,
        animals: List[dict] = None,
        freeze_warning: dict = None,
    ) -> bool:
        """Send cold protection reminder email before sunset"""
        subject = f"Cold Protection Needed Tonight - Low of {forecast_low}°F"

        # Plant section
        plant_section_html = ""
        if plants:
            plant_list_html = ""
            for plant in plants:
                plant_list_html += f"""
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">{_escape_html(plant.get('name', 'Unknown'))}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">{_escape_html(str(plant.get('min_temp', '--')))}°F</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">{_escape_html(plant.get('location', '--'))}</td>
                </tr>
                """

            plant_section_html = f"""
                <h2 style="color: #0891b2; margin-top: 25px;">🌿 Plants Needing Protection ({len(plants)})</h2>
                <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                    <thead>
                        <tr style="background: #f0f9ff;">
                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #0891b2;">Plant</th>
                            <th style="padding: 10px; text-align: center; border-bottom: 2px solid #0891b2;">Min Temp</th>
                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #0891b2;">Location</th>
                        </tr>
                    </thead>
                    <tbody>
                        {plant_list_html}
                    </tbody>
                </table>
                <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 12px; margin: 15px 0;">
                    <strong>Plant Protection Tips:</strong>
                    <ul style="margin: 8px 0; padding-left: 20px;">
                        <li>Cover frost-sensitive plants with frost cloth or blankets</li>
                        <li>Move potted plants indoors or to a sheltered area</li>
                        <li>Water plants well - moist soil retains heat better</li>
                    </ul>
                </div>
            """

        # Animal section
        animal_section_html = ""
        if animals:
            animal_list_html = ""
            for animal in animals:
                color_info = f" ({_escape_html(animal.get('color'))})" if animal.get('color') else ""
                animal_list_html += f"""
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">{_escape_html(animal.get('name', 'Unknown'))}{color_info}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">{_escape_html(animal.get('animal_type', '--'))}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">Below {_escape_html(str(animal.get('needs_blanket_below', '--')))}°F</td>
                </tr>
                """

            animal_section_html = f"""
                <h2 style="color: #7c3aed; margin-top: 25px;">🐴 Animals Needing Blankets ({len(animals)})</h2>
                <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                    <thead>
                        <tr style="background: #f5f3ff;">
                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #7c3aed;">Animal</th>
                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #7c3aed;">Type</th>
                            <th style="padding: 10px; text-align: center; border-bottom: 2px solid #7c3aed;">Blanket Needed</th>
                        </tr>
                    </thead>
                    <tbody>
                        {animal_list_html}
                    </tbody>
                </table>
            """

        # Freeze/irrigation warning section
        freeze_section_html = ""
        if freeze_warning:
            recommendations_html = ""
            for rec in freeze_warning.get("recommendations", []):
                recommendations_html += f"<li>{_escape_html(rec)}</li>"

            freeze_section_html = f"""
                <h2 style="color: #dc2626; margin-top: 25px;">🚰 Freeze Warning - Protect Pipes & Irrigation</h2>
                <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 15px 0;">
                    <p style="margin: 0 0 10px 0; font-weight: bold; color: #dc2626;">
                        {_escape_html(freeze_warning.get('message', 'Freeze forecasted!'))}
                    </p>
                    <strong>Recommended Actions:</strong>
                    <ul style="margin: 10px 0; padding-left: 20px;">
                        {recommendations_html}
                    </ul>
                </div>
            """

        html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #1e40af; color: white; padding: 20px; text-align: center;">
                <h1>❄️ Cold Protection Reminder</h1>
                <p>Sunset at {sunset_time} - Prepare before dark!</p>
            </div>
            <div style="padding: 20px;">
                <p style="font-size: 18px; color: #1e40af; text-align: center; background: #eff6ff; padding: 15px; border-radius: 8px;">
                    <strong>Tonight's forecast low: {forecast_low}°F</strong>
                </p>

                {plant_section_html}
                {animal_section_html}
                {freeze_section_html}

                <p style="color: #666; font-size: 12px; margin-top: 30px; text-align: center; border-top: 1px solid #eee; padding-top: 15px;">
                    Reminder sent at {datetime.now().strftime('%I:%M %p')} (1 hour before sunset)
                </p>
            </div>
        </body>
        </html>
        """

        return await self.send_email(subject, html, to=recipients, html=True)

    async def send_order_receipt(
        self,
        to: str,
        order: dict,
        farm_name: str = "Isaac Farm",
        subject: str = None,
        from_name: str = None,
    ) -> bool:
        """Send a receipt email for an order.

        Args:
            to: Customer email address
            order: Dict with order details including payments
            farm_name: Farm/business name for the receipt header
            subject: Custom email subject (optional)
            from_name: Override From header display name (defaults to farm_name)
        """
        subject = subject or f"Receipt - Order #{order['id']}"
        from_name = from_name or farm_name

        # Build payment rows
        payment_rows = ""
        for p in order.get("payments", []):
            ptype = _escape_html(p.get("payment_type", ""))
            method = _escape_html(p.get("payment_method", ""))
            pdate = _escape_html(p.get("payment_date", ""))
            ref = _escape_html(p.get("reference", "")) or "-"
            amount = p.get("amount", 0)
            sign = "-" if ptype.lower() == "refund" else ""
            payment_rows += f"""
            <tr>
                <td style="padding: 6px 12px; border-bottom: 1px solid #eee;">{pdate}</td>
                <td style="padding: 6px 12px; border-bottom: 1px solid #eee;">{ptype.title()}</td>
                <td style="padding: 6px 12px; border-bottom: 1px solid #eee;">{method.replace('_', ' ').title()}</td>
                <td style="padding: 6px 12px; border-bottom: 1px solid #eee;">{ref}</td>
                <td style="padding: 6px 12px; border-bottom: 1px solid #eee; text-align: right;">{sign}${amount:,.2f}</td>
            </tr>"""

        if not payment_rows:
            payment_rows = '<tr><td colspan="5" style="padding: 6px 12px; color: #999;">No payments recorded</td></tr>'

        # Build totals
        total = order.get("final_total") or order.get("estimated_total") or 0
        total_paid = order.get("total_paid", 0)
        balance = order.get("balance_due", 0)

        # Order details
        desc = _escape_html(order.get("description", ""))
        customer_name = _escape_html(order.get("customer_name", ""))
        order_date = _escape_html(order.get("order_date", ""))
        completed_date = _escape_html(order.get("completed_date", ""))
        status = _escape_html(order.get("status", "")).replace("_", " ").title()
        portion = _escape_html(order.get("portion_type", "")).title()
        notes = _escape_html(order.get("notes", ""))

        # Optional weight/price details
        weight_section = ""
        actual_weight = order.get("actual_weight")
        estimated_weight = order.get("estimated_weight")
        price_per_pound = order.get("price_per_pound")
        if actual_weight or estimated_weight or price_per_pound:
            weight_rows = ""
            if estimated_weight:
                weight_rows += f'<div><span style="color: #666;">Est. Weight:</span> {estimated_weight} lbs</div>'
            if actual_weight:
                weight_rows += f'<div><span style="color: #666;">Actual Weight:</span> {actual_weight} lbs</div>'
            if price_per_pound:
                weight_rows += f'<div><span style="color: #666;">Price/lb:</span> ${price_per_pound:,.2f}</div>'
            weight_section = f'<div style="margin-top: 8px; font-size: 13px;">{weight_rows}</div>'

        date_line = f"Order Date: {order_date}"
        if completed_date:
            date_line += f" &nbsp;|&nbsp; Completed: {completed_date}"

        balance_color = "#c0392b" if balance > 0 else "#27ae60"
        balance_label = f"Balance Due: ${balance:,.2f}" if balance > 0 else "PAID IN FULL"

        body = f"""
        <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <!-- Header -->
                <div style="background: #2c3e50; color: white; padding: 20px 24px;">
                    <h1 style="margin: 0; font-size: 20px;">{_escape_html(farm_name)}</h1>
                    <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.8;">Receipt - Order #{order['id']}</p>
                </div>

                <!-- Customer & Order Info -->
                <div style="padding: 20px 24px; border-bottom: 1px solid #eee;">
                    <div style="display: flex; justify-content: space-between;">
                        <div>
                            <div style="font-weight: 600; font-size: 15px;">{customer_name}</div>
                            <div style="color: #666; font-size: 13px; margin-top: 4px;">{date_line}</div>
                            <div style="color: #666; font-size: 13px;">Status: {status}</div>
                        </div>
                    </div>
                </div>

                <!-- Order Details -->
                <div style="padding: 16px 24px; border-bottom: 1px solid #eee;">
                    <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #333;">Order Details</h3>
                    <div style="font-size: 14px;">
                        <div><strong>{desc}</strong></div>
                        {f'<div style="color: #666; font-size: 13px;">Portion: {portion}</div>' if portion and portion != 'None' else ''}
                        {weight_section}
                        {f'<div style="color: #666; font-size: 13px; margin-top: 4px;">Notes: {notes}</div>' if notes else ''}
                    </div>
                </div>

                <!-- Payment History -->
                <div style="padding: 16px 24px; border-bottom: 1px solid #eee;">
                    <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #333;">Payment History</h3>
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                        <thead>
                            <tr style="background: #f8f9fa;">
                                <th style="padding: 6px 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Date</th>
                                <th style="padding: 6px 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Type</th>
                                <th style="padding: 6px 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Method</th>
                                <th style="padding: 6px 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Ref</th>
                                <th style="padding: 6px 12px; text-align: right; border-bottom: 2px solid #dee2e6;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payment_rows}
                        </tbody>
                    </table>
                </div>

                <!-- Totals -->
                <div style="padding: 16px 24px;">
                    <div style="display: flex; justify-content: flex-end;">
                        <div style="text-align: right; font-size: 14px;">
                            <div style="margin-bottom: 4px;"><span style="color: #666;">Order Total:</span> <strong>${total:,.2f}</strong></div>
                            <div style="margin-bottom: 4px;"><span style="color: #666;">Total Paid:</span> <strong>${total_paid:,.2f}</strong></div>
                            <div style="font-size: 16px; font-weight: 700; color: {balance_color}; border-top: 2px solid #333; padding-top: 6px; margin-top: 4px;">
                                {balance_label}
                            </div>
                        </div>
                    </div>
                </div>

                {f'<div style="padding: 16px 24px; border-top: 1px solid #eee;"><div style="font-size: 14px; color: #333; white-space: pre-wrap;">{_escape_html(order.get("custom_message", ""))}</div></div>' if order.get("custom_message") else ''}

                <!-- Footer -->
                <div style="background: #f8f9fa; padding: 12px 24px; text-align: center; font-size: 11px; color: #999;">
                    Receipt generated on {datetime.now().strftime('%m/%d/%Y at %I:%M %p')}
                </div>
            </div>
        </body>
        </html>
        """

        return await self.send_email(subject, body, to=to, html=True, no_prefix=True, from_name=from_name)

    async def send_payment_receipt(
        self,
        to: str,
        payment: dict,
        order: dict,
        farm_name: str = "Isaac Farm",
        subject: str = None,
        from_name: str = None,
    ) -> bool:
        """Send a receipt email for a single payment.

        Args:
            to: Customer email address
            payment: Dict with payment details (amount, payment_type, payment_method, payment_date, reference)
            order: Dict with order details (id, customer_name, description)
            farm_name: Farm/business name for the receipt header
            subject: Custom email subject (optional)
            from_name: Override From header display name (defaults to farm_name)
        """
        subject = subject or f"Payment Receipt - Order #{order['id']}"
        from_name = from_name or farm_name

        # Payment details
        ptype = _escape_html(payment.get("payment_type", "")).replace("_", " ").title()
        method = _escape_html(payment.get("payment_method", "")).replace("_", " ").title()
        pdate = _escape_html(payment.get("payment_date", ""))
        ref = _escape_html(payment.get("reference", "")) or "-"
        amount = payment.get("amount", 0)
        sign = "-" if ptype.lower() == "refund" else ""

        # Order info
        customer_name = _escape_html(order.get("customer_name", ""))
        description = _escape_html(order.get("description", ""))
        order_total = order.get("final_total") or order.get("estimated_total") or 0
        total_paid = order.get("total_paid", 0)
        balance = order.get("balance_due", 0)

        balance_color = "#c0392b" if balance > 0 else "#27ae60"
        balance_label = f"Balance Due: ${balance:,.2f}" if balance > 0 else "PAID IN FULL"

        body = f"""
        <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <!-- Header -->
                <div style="background: #2c3e50; color: white; padding: 20px 24px;">
                    <h1 style="margin: 0; font-size: 20px;">{_escape_html(farm_name)}</h1>
                    <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.8;">Payment Receipt - Order #{order['id']}</p>
                </div>

                <!-- Customer Info -->
                <div style="padding: 20px 24px; border-bottom: 1px solid #eee;">
                    <div style="font-weight: 600; font-size: 15px;">{customer_name}</div>
                    <div style="color: #666; font-size: 13px; margin-top: 4px;">{description}</div>
                </div>

                <!-- Payment Details -->
                <div style="padding: 16px 24px; border-bottom: 1px solid #eee;">
                    <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #333;">Payment Details</h3>
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <tr>
                            <td style="padding: 8px 0; color: #666;">Payment Date:</td>
                            <td style="padding: 8px 0; font-weight: 500;">{pdate}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #666;">Payment Type:</td>
                            <td style="padding: 8px 0; font-weight: 500;">{ptype}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #666;">Method:</td>
                            <td style="padding: 8px 0; font-weight: 500;">{method}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #666;">Reference:</td>
                            <td style="padding: 8px 0; font-weight: 500;">{ref}</td>
                        </tr>
                        <tr style="background: #f8f9fa;">
                            <td style="padding: 12px 8px; color: #333; font-weight: 600;">Amount Received:</td>
                            <td style="padding: 12px 8px; font-weight: 700; font-size: 18px; color: #27ae60;">{sign}${amount:,.2f}</td>
                        </tr>
                    </table>
                </div>

                <!-- Order Summary -->
                <div style="padding: 16px 24px;">
                    <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #333;">Order Summary</h3>
                    <div style="text-align: right; font-size: 14px;">
                        <div style="margin-bottom: 4px;"><span style="color: #666;">Order Total:</span> <strong>${order_total:,.2f}</strong></div>
                        <div style="margin-bottom: 4px;"><span style="color: #666;">Total Paid:</span> <strong>${total_paid:,.2f}</strong></div>
                        <div style="font-size: 16px; font-weight: 700; color: {balance_color}; border-top: 2px solid #333; padding-top: 6px; margin-top: 4px;">
                            {balance_label}
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div style="background: #f8f9fa; padding: 12px 24px; text-align: center; font-size: 11px; color: #999;">
                    Receipt generated on {datetime.now().strftime('%m/%d/%Y at %I:%M %p')}
                </div>
            </div>
        </body>
        </html>
        """

        return await self.send_email(subject, body, to=to, html=True, no_prefix=True, from_name=from_name)

    async def send_sale_receipt(
        self,
        to: str,
        sale: dict,
        farm_name: str = "Isaac Farm",
        subject: str = None,
        from_name: str = None,
    ) -> bool:
        """Send a receipt email for a direct sale.

        Args:
            to: Customer email address
            sale: Dict with sale details
            farm_name: Farm/business name for the receipt header
            subject: Custom email subject (optional)
            from_name: Override From header display name (defaults to farm_name)
        """
        from_name = from_name or farm_name
        subject = subject or f"Receipt - Sale #{sale['id']}"

        customer_name = _escape_html(sale.get("customer_name", ""))
        item_name = _escape_html(sale.get("item_name", ""))
        description = _escape_html(sale.get("description", ""))
        category = _escape_html(sale.get("category", "")).title()
        sale_date = _escape_html(sale.get("sale_date", ""))
        quantity = sale.get("quantity", 0)
        unit = _escape_html(sale.get("unit", "each"))
        unit_price = sale.get("unit_price", 0)
        total_price = sale.get("total_price", 0)

        body = f"""
        <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <!-- Header -->
                <div style="background: #2c3e50; color: white; padding: 20px 24px;">
                    <h1 style="margin: 0; font-size: 20px;">{_escape_html(farm_name)}</h1>
                    <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.8;">Sale Receipt</p>
                </div>

                <!-- Customer & Date -->
                <div style="padding: 20px 24px; border-bottom: 1px solid #eee;">
                    {f'<div style="font-weight: 600; font-size: 15px;">{customer_name}</div>' if customer_name else ''}
                    <div style="color: #666; font-size: 13px; margin-top: 4px;">Date: {sale_date}</div>
                </div>

                <!-- Sale Details -->
                <div style="padding: 16px 24px; border-bottom: 1px solid #eee;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <thead>
                            <tr style="background: #f8f9fa;">
                                <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Item</th>
                                <th style="padding: 8px 12px; text-align: center; border-bottom: 2px solid #dee2e6;">Qty</th>
                                <th style="padding: 8px 12px; text-align: right; border-bottom: 2px solid #dee2e6;">Price</th>
                                <th style="padding: 8px 12px; text-align: right; border-bottom: 2px solid #dee2e6;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">
                                    <div style="font-weight: 500;">{item_name}</div>
                                    {f'<div style="color: #666; font-size: 12px;">{description}</div>' if description else ''}
                                </td>
                                <td style="padding: 8px 12px; text-align: center; border-bottom: 1px solid #eee;">{quantity:g} {unit}</td>
                                <td style="padding: 8px 12px; text-align: right; border-bottom: 1px solid #eee;">${unit_price:,.2f}/{unit}</td>
                                <td style="padding: 8px 12px; text-align: right; border-bottom: 1px solid #eee; font-weight: 600;">${total_price:,.2f}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Total -->
                <div style="padding: 16px 24px;">
                    <div style="display: flex; justify-content: flex-end;">
                        <div style="text-align: right; font-size: 18px; font-weight: 700; color: #27ae60;">
                            Total: ${total_price:,.2f}
                        </div>
                    </div>
                </div>

                {f'<div style="padding: 16px 24px; border-top: 1px solid #eee;"><div style="font-size: 14px; color: #333; white-space: pre-wrap;">{_escape_html(sale.get("custom_message", ""))}</div></div>' if sale.get("custom_message") else ''}

                <!-- Footer -->
                <div style="background: #f8f9fa; padding: 12px 24px; text-align: center; font-size: 11px; color: #999;">
                    Receipt generated on {datetime.now().strftime('%m/%d/%Y at %I:%M %p')}
                </div>
            </div>
        </body>
        </html>
        """

        return await self.send_email(subject, body, to=to, html=True, no_prefix=True, from_name=from_name)

    async def send_invoice(
        self,
        to: str,
        order: dict,
        farm_name: str = "Isaac Farm",
        payment_instructions: str = "",
        subject: str = None,
        from_name: str = None,
    ) -> bool:
        """Send an invoice email for an order requesting payment.

        Args:
            to: Customer email address
            order: Dict with order details including balance due
            farm_name: Farm/business name for the invoice header
            payment_instructions: Optional payment instructions (Venmo, Zelle, etc.)
            subject: Custom email subject (optional)
            from_name: Override From header display name (defaults to farm_name)
        """
        subject = subject or f"Invoice - Order #{order['id']}"
        from_name = from_name or farm_name

        desc = _escape_html(order.get("description", ""))
        customer_name = _escape_html(order.get("customer_name", ""))
        order_date = _escape_html(order.get("order_date", ""))
        status = _escape_html(order.get("status", "")).replace("_", " ").title()
        portion = _escape_html(order.get("portion_type", "")).title()
        notes = _escape_html(order.get("notes", ""))

        total = order.get("final_total") or order.get("estimated_total") or 0
        total_paid = order.get("total_paid", 0)
        balance = order.get("balance_due", 0)

        weight_section = ""
        actual_weight = order.get("actual_weight")
        estimated_weight = order.get("estimated_weight")
        price_per_pound = order.get("price_per_pound")
        if actual_weight or estimated_weight or price_per_pound:
            weight_rows = ""
            if estimated_weight:
                weight_rows += f'<div><span style="color: #666;">Est. Weight:</span> {estimated_weight} lbs</div>'
            if actual_weight:
                weight_rows += f'<div><span style="color: #666;">Actual Weight:</span> {actual_weight} lbs</div>'
            if price_per_pound:
                weight_rows += f'<div><span style="color: #666;">Price/lb:</span> ${price_per_pound:,.2f}</div>'
            weight_section = f'<div style="margin-top: 8px; font-size: 13px;">{weight_rows}</div>'

        payment_section = ""
        if payment_instructions:
            payment_section = f"""
                <div style="padding: 16px 24px; background: #fef9e7; border-bottom: 1px solid #eee;">
                    <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #333;">Payment Instructions</h3>
                    <div style="font-size: 13px; color: #666; white-space: pre-wrap;">{_escape_html(payment_instructions)}</div>
                </div>
            """

        body = f"""
        <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <div style="background: #c0392b; color: white; padding: 20px 24px;">
                    <h1 style="margin: 0; font-size: 20px;">{_escape_html(farm_name)}</h1>
                    <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.8;">INVOICE - Order #{order['id']}</p>
                </div>
                <div style="padding: 20px 24px; border-bottom: 1px solid #eee;">
                    <div style="font-weight: 600; font-size: 15px;">{customer_name}</div>
                    <div style="color: #666; font-size: 13px; margin-top: 4px;">Order Date: {order_date}</div>
                    <div style="color: #666; font-size: 13px;">Status: {status}</div>
                </div>
                <div style="padding: 16px 24px; border-bottom: 1px solid #eee;">
                    <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #333;">Order Details</h3>
                    <div style="font-size: 14px;">
                        <div><strong>{desc}</strong></div>
                        {f'<div style="color: #666; font-size: 13px;">Portion: {portion}</div>' if portion and portion != 'None' else ''}
                        {weight_section}
                        {f'<div style="color: #666; font-size: 13px; margin-top: 4px;">Notes: {notes}</div>' if notes else ''}
                    </div>
                </div>
                {payment_section}
                {f'<div style="padding: 16px 24px; border-bottom: 1px solid #eee;"><div style="font-size: 14px; color: #333; white-space: pre-wrap;">{_escape_html(order.get("custom_message", ""))}</div></div>' if order.get("custom_message") else ''}
                <div style="padding: 20px 24px; background: #f8f9fa;">
                    <div style="text-align: right; font-size: 14px;">
                        <div style="margin-bottom: 6px;"><span style="color: #666;">Order Total:</span> <strong style="margin-left: 20px;">${total:,.2f}</strong></div>
                        <div style="margin-bottom: 6px;"><span style="color: #666;">Total Paid:</span> <strong style="margin-left: 20px;">${total_paid:,.2f}</strong></div>
                        <div style="font-size: 18px; font-weight: 700; color: #c0392b; border-top: 2px solid #333; padding-top: 8px; margin-top: 8px;">
                            AMOUNT DUE: <span style="margin-left: 20px;">${balance:,.2f}</span>
                        </div>
                    </div>
                </div>
                <div style="background: #2c3e50; padding: 12px 24px; text-align: center; font-size: 11px; color: #ccc;">
                    Invoice generated on {datetime.now().strftime('%m/%d/%Y')} | Thank you for your business!
                </div>
            </div>
        </body>
        </html>
        """

        return await self.send_email(subject, body, to=to, html=True, no_prefix=True, from_name=from_name)

    async def send_task_assignment_notification(
        self,
        task_title: str,
        task_description: Optional[str],
        due_date: Optional[str],
        due_time: Optional[str],
        assignee_name: str,
        assignee_email: str,
        assigner_name: Optional[str] = None,
    ) -> bool:
        """Send notification email when a task is assigned to someone.

        Args:
            task_title: The task title
            task_description: Optional task description
            due_date: Optional due date (MM/DD/YYYY format)
            due_time: Optional due time
            assignee_name: Name of the person assigned
            assignee_email: Email of the person assigned
            assigner_name: Optional name of who assigned the task

        Returns:
            True if sent successfully, False otherwise
        """
        if not assignee_email:
            logger.warning(f"Cannot send task assignment notification - no email for {assignee_name}")
            return False

        subject = f"📋 New Task Assigned: {_sanitize_header(task_title)}"

        due_info = ""
        if due_date:
            due_info = f"<p><strong>Due:</strong> {_escape_html(due_date)}"
            if due_time:
                due_info += f" at {_escape_html(due_time)}"
            due_info += "</p>"

        assigned_by = ""
        if assigner_name:
            assigned_by = f"<p style='color: #666;'>Assigned by: {_escape_html(assigner_name)}</p>"

        body = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px 8px 0 0;">
                <h2 style="color: white; margin: 0; font-size: 20px;">📋 New Task Assigned</h2>
            </div>
            <div style="background: #fff; padding: 20px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
                <p style="color: #333; font-size: 16px;">Hi {_escape_html(assignee_name)},</p>
                <p style="color: #333;">You have been assigned a new task:</p>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 15px 0;">
                    <h3 style="margin: 0 0 10px 0; color: #333;">{_escape_html(task_title)}</h3>
                    {f'<p style="color: #666; margin: 0;">{_escape_html(task_description)}</p>' if task_description else ''}
                </div>
                {due_info}
                {assigned_by}
                <p style="color: #666; font-size: 14px; margin-top: 20px;">
                    Please check your dashboard for more details and to mark the task as complete when finished.
                </p>
            </div>
        </div>
        """

        try:
            success = await self.send_email(subject, body, to=assignee_email, html=True)
            if success:
                logger.info(f"Task assignment notification sent to {assignee_email} for task '{task_title}'")
            return success
        except Exception as e:
            logger.error(f"Failed to send task assignment notification: {e}")
            return False

    async def send_monthly_planting_digest(
        self,
        month_name: str,
        year: int,
        activities: dict,
        plant_dicts: List[dict],
        plant_care: dict = None,
        next_month_name: str = "",
        next_activities: dict = None,
        ai_narrative: str = None,
        farm_name: str = "Isaac",
        recipient: str = None,
    ) -> bool:
        """Send monthly planting guide email — rich format with seed specs, plant care, and next month preview.

        Args:
            month_name: Full month name (e.g., "March")
            year: Calendar year
            activities: Enriched activities dict {cold_stratify, start_indoors, direct_sow, transplant, harvest}
                        Each item includes seed details (planting_depth, spacing, germ info, etc.)
            plant_dicts: List of active plant dicts
            plant_care: Dict with keys needs_watering, needs_fertilizing, prune_this_month, harvest_this_month
            next_month_name: Name of next month for preview
            next_activities: Next month's activities dict
            ai_narrative: AI-generated seasonal narrative (optional)
            farm_name: Name of the farm for email footer
            recipient: Email recipient
        """
        if not recipient:
            logger.error("No recipient specified for monthly planting digest")
            return False

        plant_care = plant_care or {}
        next_activities = next_activities or {}

        subject = f"Garden Guide \u2014 {_escape_html(month_name)} {year}"

        # ── CSS ──────────────────────────────────────────────────────────────
        css = """
            body{font-family:Arial,sans-serif;margin:0;padding:10px;background:#f3f4f6;}
            .wrap{max-width:620px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;}
            .hdr{background:linear-gradient(135deg,#14532d 0%,#16a34a 100%);color:#fff;padding:28px 25px;}
            .hdr h1{margin:0 0 4px;font-size:22px;}
            .hdr .sub{margin:0;font-size:13px;opacity:.85;}
            .ai{background:#fffbeb;border-left:4px solid #f59e0b;padding:13px 16px;margin:16px 20px 0;border-radius:4px;font-size:13px;color:#78350f;line-height:1.65;}
            .ai-lbl{font-size:10px;font-weight:bold;color:#b45309;margin-bottom:5px;text-transform:uppercase;letter-spacing:.8px;}
            .body{padding:0 20px 8px;}
            .sh{font-size:15px;font-weight:bold;margin:22px 0 4px;padding-bottom:5px;border-bottom:2px solid;}
            .sdesc{color:#6b7280;font-size:13px;margin:0 0 8px;}
            .card{border-radius:5px;padding:10px 14px;margin:6px 0;}
            .cn{font-weight:bold;font-size:14px;margin-bottom:2px;}
            .ct{font-size:13px;margin-bottom:4px;}
            .cs{font-size:12px;color:#6b7280;line-height:1.7;}
            .ctip{font-size:12px;font-style:italic;margin-top:3px;color:#6b7280;}
            .badge{font-size:10px;padding:1px 7px;border-radius:10px;margin-left:6px;font-weight:normal;vertical-align:middle;}
            .care{padding:0 20px;}
            .cah{font-size:14px;font-weight:bold;margin:18px 0 6px;}
            .cac{background:#f9fafb;border-radius:4px;padding:7px 12px;margin:4px 0;font-size:13px;}
            .cas{font-size:11px;color:#9ca3af;margin-top:2px;}
            .nb{background:#f8fafc;margin:20px;border-radius:6px;padding:15px 18px;border:1px solid #e5e7eb;}
            .nt{font-size:14px;font-weight:bold;color:#374151;margin:0 0 10px;}
            .pv{font-size:13px;color:#4b5563;margin:5px 0;padding-left:10px;border-left:3px solid #d1d5db;}
            .ps{padding:0 20px 20px;}
            .ph{font-size:15px;font-weight:bold;margin:20px 0 8px;color:#14532d;}
            .pt{width:100%;border-collapse:collapse;font-size:12px;}
            .pt th{background:#f0fdf4;padding:8px 9px;text-align:left;border-bottom:2px solid #16a34a;white-space:nowrap;font-size:11px;}
            .pt td{padding:6px 9px;border-bottom:1px solid #f3f4f6;vertical-align:top;}
            .ft{text-align:center;padding:16px;color:#9ca3af;font-size:11px;border-top:1px solid #e5e7eb;}
        """

        # ── AI NARRATIVE ─────────────────────────────────────────────────────
        ai_html = ""
        if ai_narrative:
            ai_html = f"""
            <div class="ai">
                <div class="ai-lbl">&#10024; AI Garden Insight</div>
                {_escape_html(ai_narrative)}
            </div>"""

        # ── HELPER: build spec line ────────────────────────────────────────
        def specs(*pairs):
            bits = [f"<b>{lbl}:</b>&nbsp;{_escape_html(str(val))}" for lbl, val in pairs if val]
            return "&nbsp;&nbsp;&#183;&nbsp;&nbsp;".join(bits)

        def badge(category, bg, color):
            cat = (category or "").replace("_", " ").title()
            return f'<span class="badge" style="background:{bg};color:{color};">{_escape_html(cat)}</span>' if cat else ""

        def target_str(iso_date):
            if not iso_date:
                return ""
            try:
                from datetime import date as _d
                t = _d.fromisoformat(iso_date)
                return f"Target: {t.strftime('%m/%d/%Y')}"
            except Exception:
                return ""

        # ── PLANTING SECTIONS ─────────────────────────────────────────────
        planting_html = ""

        # COLD STRATIFY
        cold_stratify = activities.get("cold_stratify", [])
        if cold_stratify:
            cards = ""
            for item in cold_stratify:
                n = _escape_html(item.get("name", ""))
                notes = _escape_html(item.get("notes", "") or "")
                b = badge(item.get("category"), "#ede9fe", "#6d28d9")
                cards += f"""
                <div class="card" style="background:#f5f3ff;border-left:4px solid #7c3aed;">
                    <div class="cn" style="color:#4c1d95;">{n}{b}</div>
                    {f'<div class="ct" style="color:#5b21b6;">{notes}</div>' if notes else ""}
                    <div class="ctip">Refrigerate seeds in damp sand or a sealed damp paper towel at 33&#8211;40&#176;F. Check weekly for mold.</div>
                </div>"""
            planting_html += f"""
            <div class="sh" style="color:#7c3aed;border-color:#7c3aed;">&#10052;&#65039; Cold Stratify ({len(cold_stratify)})</div>
            <p class="sdesc">Start refrigerating these seeds now to break dormancy before planting.</p>
            {cards}"""

        # START INDOORS
        start_indoors = activities.get("start_indoors", [])
        if start_indoors:
            cards = ""
            for item in start_indoors:
                n = _escape_html(item.get("name", ""))
                notes = _escape_html(item.get("notes", "") or "")
                b = badge(item.get("category"), "#cffafe", "#0e7490")
                ts = target_str(item.get("target_date", ""))
                timing = f"{notes}{(' &mdash; ' + ts) if ts else ''}" if (notes or ts) else ""
                sp = specs(
                    ("Sow Depth", item.get("planting_depth")),
                    ("Spacing", item.get("spacing")),
                    ("Germination", item.get("days_to_germination")),
                    ("Soil Temp", item.get("optimal_germ_temp")),
                )
                light = _escape_html(item.get("light_to_germinate", "") or "")
                cards += f"""
                <div class="card" style="background:#ecfeff;border-left:4px solid #0891b2;">
                    <div class="cn" style="color:#0c4a6e;">{n}{b}</div>
                    {f'<div class="ct" style="color:#0e7490;">&#9201; {timing}</div>' if timing else ""}
                    {f'<div class="cs">{sp}</div>' if sp else ""}
                    {f'<div class="ctip">Light: {light}</div>' if light else ""}
                </div>"""
            planting_html += f"""
            <div class="sh" style="color:#0891b2;border-color:#0891b2;">&#127807; Start Indoors ({len(start_indoors)})</div>
            <p class="sdesc">Sow in seed trays or small pots. Keep warm and evenly moist until germination.</p>
            {cards}"""

        # DIRECT SOW
        direct_sow = activities.get("direct_sow", [])
        if direct_sow:
            cards = ""
            for item in direct_sow:
                n = _escape_html(item.get("name", ""))
                notes = _escape_html(item.get("notes", "") or "")
                b = badge(item.get("category"), "#dcfce7", "#15803d")
                sp = specs(
                    ("Sow Depth", item.get("planting_depth")),
                    ("Plant Spacing", item.get("spacing")),
                    ("Row Spacing", item.get("row_spacing")),
                    ("Germination", item.get("days_to_germination")),
                    ("Soil Temp", item.get("optimal_germ_temp")),
                )
                special = item.get("special_requirements", "") or ""
                extra = ""
                if special and "stratif" not in special.lower():
                    extra = f'<div class="ctip">&#9888; {_escape_html(special)}</div>'
                cards += f"""
                <div class="card" style="background:#f0fdf4;border-left:4px solid #16a34a;">
                    <div class="cn" style="color:#14532d;">{n}{b}</div>
                    {f'<div class="ct" style="color:#166534;">&#128197; Window: {notes}</div>' if notes else ""}
                    {f'<div class="cs">{sp}</div>' if sp else ""}
                    {extra}
                </div>"""
            planting_html += f"""
            <div class="sh" style="color:#16a34a;border-color:#16a34a;">&#127808; Direct Sow ({len(direct_sow)})</div>
            <p class="sdesc">Plant directly into garden beds or prepared soil outdoors.</p>
            {cards}"""

        # TRANSPLANT
        transplant = activities.get("transplant", [])
        if transplant:
            cards = ""
            for item in transplant:
                n = _escape_html(item.get("name", ""))
                notes = _escape_html(item.get("notes", "") or "")
                b = badge(item.get("category"), "#fef9c3", "#854d0e")
                ts = target_str(item.get("target_date", ""))
                timing = f"{notes}{(' &mdash; ' + ts) if ts else ''}" if (notes or ts) else ""
                sp = specs(("Final Spacing", item.get("spacing")))
                cards += f"""
                <div class="card" style="background:#fefce8;border-left:4px solid #ca8a04;">
                    <div class="cn" style="color:#713f12;">{n}{b}</div>
                    {f'<div class="ct" style="color:#92400e;">&#9201; {timing}</div>' if timing else ""}
                    {f'<div class="cs">{sp}</div>' if sp else ""}
                    <div class="ctip">Harden off seedlings outdoors 1&#8211;2 hours/day for 5&#8211;7 days before full transplant.</div>
                </div>"""
            planting_html += f"""
            <div class="sh" style="color:#ca8a04;border-color:#ca8a04;">&#127807; Transplant Outdoors ({len(transplant)})</div>
            <p class="sdesc">Move indoor-started seedlings to their permanent outdoor growing location.</p>
            {cards}"""

        # HARVEST WINDOW
        harvest = activities.get("harvest", [])
        if harvest:
            cards = ""
            for item in harvest:
                n = _escape_html(item.get("name", ""))
                notes = _escape_html(item.get("notes", "") or "")
                b = badge(item.get("category"), "#fee2e2", "#991b1b")
                maturity = _escape_html(item.get("days_to_maturity", "") or "")
                harvest_notes = _escape_html(item.get("harvest_notes", "") or "")
                cards += f"""
                <div class="card" style="background:#fef2f2;border-left:4px solid #dc2626;">
                    <div class="cn" style="color:#7f1d1d;">{n}{b}</div>
                    {f'<div class="ct" style="color:#991b1b;">&#128197; {notes}</div>' if notes else ""}
                    {f'<div class="cs"><b>Days to Maturity:</b>&nbsp;{maturity}</div>' if maturity else ""}
                    {f'<div class="ctip">{harvest_notes}</div>' if harvest_notes else ""}
                </div>"""
            planting_html += f"""
            <div class="sh" style="color:#dc2626;border-color:#dc2626;">&#127813; Harvest Window ({len(harvest)})</div>
            <p class="sdesc">These should be producing this month. Check frequently and harvest at peak.</p>
            {cards}"""

        if not planting_html:
            planting_html = '<p style="color:#6b7280;text-align:center;padding:20px 0;">No specific planting activities scheduled for this month.</p>'

        # ── PLANT CARE ──────────────────────────────────────────────────────
        care_html = ""
        needs_watering = plant_care.get("needs_watering", [])
        needs_fertilizing = plant_care.get("needs_fertilizing", [])
        prune_this_month = plant_care.get("prune_this_month", [])
        harvest_this_month = plant_care.get("harvest_this_month", [])

        if any([needs_watering, needs_fertilizing, prune_this_month, harvest_this_month]):
            care_blocks = ""

            if needs_watering:
                items = ""
                for p in needs_watering:
                    pn = _escape_html(p.get("name", ""))
                    qty = p.get("quantity", 1) or 1
                    od = p.get("days_overdue")
                    qstr = f" (&times;{qty})" if qty > 1 else ""
                    odstr = f"{od} day{'s' if od != 1 else ''} overdue" if od else "not yet recorded"
                    items += f'<div class="cac"><b>{pn}</b>{qstr}<div class="cas">{odstr}</div></div>'
                care_blocks += f'<div class="cah" style="color:#1d4ed8;">&#128167; Needs Watering ({len(needs_watering)})</div>{items}'

            if needs_fertilizing:
                items = ""
                for p in needs_fertilizing:
                    pn = _escape_html(p.get("name", ""))
                    qty = p.get("quantity", 1) or 1
                    od = p.get("days_overdue")
                    qstr = f" (&times;{qty})" if qty > 1 else ""
                    odstr = f"{od} day{'s' if od != 1 else ''} overdue" if od else ""
                    items += f'<div class="cac"><b>{pn}</b>{qstr}<div class="cas">{odstr}</div></div>'
                care_blocks += f'<div class="cah" style="color:#059669;">&#127807; Needs Fertilizing ({len(needs_fertilizing)})</div>{items}'

            if prune_this_month:
                items = ""
                for p in prune_this_month:
                    pn = _escape_html(p.get("name", ""))
                    win = _escape_html(p.get("window", "") or "")
                    pnotes = _escape_html(p.get("notes", "") or "")
                    items += f'<div class="cac"><b>{pn}</b>{f" &mdash; {win}" if win else ""}<div class="cas">{pnotes}</div></div>'
                care_blocks += f'<div class="cah" style="color:#7c3aed;">&#9986;&#65039; Prune This Month ({len(prune_this_month)})</div>{items}'

            if harvest_this_month:
                items = ""
                for p in harvest_this_month:
                    pn = _escape_html(p.get("name", ""))
                    qty = p.get("quantity", 1) or 1
                    freq = _escape_html(p.get("frequency", "") or "")
                    hnotes = _escape_html((p.get("notes", "") or "")[:200])
                    qstr = f" (&times;{qty})" if qty > 1 else ""
                    items += f'<div class="cac"><b>{pn}</b>{qstr}{f" &mdash; {freq}" if freq else ""}<div class="cas">{hnotes}</div></div>'
                care_blocks += f'<div class="cah" style="color:#ea580c;">&#127827; Ready to Harvest ({len(harvest_this_month)})</div>{items}'

            care_html = f"""
            <div style="border-top:1px solid #e5e7eb;margin-top:10px;"></div>
            <div class="care">
                <div style="font-size:17px;font-weight:bold;color:#1f2937;margin:20px 0 4px;">Plant Care Needed</div>
                <p class="sdesc" style="margin:0 0 12px;">Active plants that need attention this month.</p>
                {care_blocks}
            </div>"""

        # ── NEXT MONTH PREVIEW ───────────────────────────────────────────────
        next_html = ""
        if next_month_name and next_activities:
            rows = ""
            for key, label, emoji in [
                ("cold_stratify", "Cold Stratify", "&#10052;&#65039;"),
                ("start_indoors", "Start Indoors", "&#127807;"),
                ("direct_sow", "Direct Sow", "&#127808;"),
                ("transplant", "Transplant", "&#127807;"),
                ("harvest", "Harvest", "&#127813;"),
            ]:
                items_next = next_activities.get(key, [])
                if items_next:
                    names = ", ".join(_escape_html(i.get("name", "")) for i in items_next[:6])
                    more = f" + {len(items_next) - 6} more" if len(items_next) > 6 else ""
                    rows += f'<div class="pv"><b>{emoji} {label}:</b> {names}{more}</div>'
            if rows:
                next_html = f"""
                <div class="nb">
                    <div class="nt">&#128197; Coming in {_escape_html(next_month_name)}</div>
                    {rows}
                </div>"""

        # ── ACTIVE PLANTS TABLE ──────────────────────────────────────────────
        plants_html = ""
        if plant_dicts:
            rows = ""
            for p in plant_dicts[:60]:
                pn = _escape_html(p.get("name", ""))
                stage = _escape_html(p.get("growth_stage", "-"))
                qty = p.get("quantity", 1) or 1
                method = _escape_html(p.get("planting_method", "-"))
                loc = _escape_html(p.get("location", "") or "")
                hdate = _escape_html(p.get("expected_harvest_date", "") or "")
                rows += f"""
                <tr>
                    <td><b>{pn}</b></td>
                    <td>{stage}</td>
                    <td style="text-align:center;">{qty}</td>
                    <td>{method}</td>
                    <td style="color:#6b7280;">{loc}</td>
                    <td style="color:#6b7280;">{hdate}</td>
                </tr>"""
            note = f'<p style="color:#9ca3af;font-size:11px;margin-top:5px;">Showing first 60 of {len(plant_dicts)} plants.</p>' if len(plant_dicts) > 60 else ""
            plants_html = f"""
            <div style="border-top:1px solid #e5e7eb;margin-top:10px;"></div>
            <div class="ps">
                <div class="ph">Active Plants ({len(plant_dicts)})</div>
                <table class="pt">
                    <thead>
                        <tr>
                            <th>Name</th><th>Stage</th><th style="text-align:center;">Qty</th>
                            <th>Method</th><th>Location</th><th>Est. Harvest</th>
                        </tr>
                    </thead>
                    <tbody>{rows}</tbody>
                </table>
                {note}
            </div>"""

        # ── ASSEMBLE ─────────────────────────────────────────────────────────
        total_seed_activities = sum(len(activities.get(k, [])) for k in activities)
        total_care = sum(len(plant_care.get(k, [])) for k in plant_care) if plant_care else 0

        html_body = f"""
        <html>
        <head><style>{css}</style></head>
        <body>
        <div class="wrap">
            <div class="hdr">
                <h1>&#127807; Garden Guide</h1>
                <p class="sub">{_escape_html(month_name)} {year} &nbsp;&middot;&nbsp; {_escape_html(farm_name)} &nbsp;&middot;&nbsp; {total_seed_activities} planting task{'s' if total_seed_activities != 1 else ''} &nbsp;&middot;&nbsp; {total_care} care alert{'s' if total_care != 1 else ''}</p>
            </div>
            {ai_html}
            <div class="body">
                {planting_html}
            </div>
            {care_html}
            {next_html}
            {plants_html}
            <div class="ft">Generated by Isaac &#8212; Your Farm Assistant</div>
        </div>
        </body>
        </html>
        """

        return await self.send_email(subject, html_body, to=recipient, html=True)
