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

        # Validate required settings
        if not all([host, user, password]):
            raise ConfigurationError(
                "Email not configured. Go to Settings > Email Server (SMTP) to configure."
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
    ) -> bool:
        """Send an email notification.

        Args:
            subject: Email subject line
            body: Email body (plain text or HTML)
            to: Recipient email address
            html: Whether body is HTML
            subject_prefix: Override the default [Isaac] prefix (e.g. farm name for receipts)
            from_name: Override the From header display name (e.g. farm name for receipts)
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
            prefix = f"[{_sanitize_header(subject_prefix)}]" if subject_prefix else "[Isaac]"
            message["Subject"] = f"{prefix} {_sanitize_header(subject)}"

            # Use from_name if provided to override the From header display name
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

            await aiosmtplib.send(
                message,
                hostname=self.host,
                port=self.port,
                username=self.user,
                password=self.password,
                start_tls=True,
                timeout=30,
            )

            logger.info(f"Email sent: {subject} to {recipient}")
            return True

        except aiosmtplib.SMTPAuthenticationError as e:
            logger.error(f"SMTP authentication failed: {e}. Check username/password. For Protonmail, you need to use Protonmail Bridge credentials.")
            raise ConfigurationError("SMTP authentication failed. Check username/password in Settings. For Protonmail, you need Protonmail Bridge credentials.")
        except aiosmtplib.SMTPConnectError as e:
            logger.error(f"Failed to connect to SMTP server: {e}")
            raise ConfigurationError(f"Cannot connect to SMTP server {self.host}:{self.port}. Check server settings.")
        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            return False

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
                html += f"""
                <div class="task {priority_class}">
                    <strong>{_escape_html(task.get('title', 'Task'))}</strong>
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

        return await self.send_email(subject, body, to=to, html=True, subject_prefix=farm_name, from_name=from_name)

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

        return await self.send_email(subject, body, to=to, html=True, subject_prefix=farm_name, from_name=from_name)

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

        return await self.send_email(subject, body, to=to, html=True, subject_prefix=farm_name, from_name=from_name)
