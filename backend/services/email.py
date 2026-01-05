"""
Email Notification Service
Sends email notifications using SMTP settings from database or config
"""

import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import Optional, List
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession


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

        return cls(
            host=host,
            port=port,
            user=user,
            password=password,
            from_addr=from_addr or user,
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
    ) -> bool:
        """Send an email notification"""
        if not self.is_configured():
            logger.warning("Email not configured, skipping notification")
            return False

        if not to:
            logger.error("No recipient specified")
            return False

        recipient = to

        try:
            message = MIMEMultipart("alternative")
            message["Subject"] = f"[Isaac] {subject}"
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
    ) -> bool:
        """Send daily digest email with verse of the day, tasks and weather"""
        subject = f"Daily Farm Digest - {datetime.now().strftime('%A, %B %d')}"

        # Verse of the day section
        verse_section = ""
        if verse and verse.get("text"):
            verse_section = f"""
            <div class="section" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 25px;">
                <p style="font-size: 18px; font-style: italic; margin: 0 0 15px 0;">"{verse.get('text', '')}"</p>
                <p style="font-size: 14px; margin: 0; opacity: 0.9;">— {verse.get('reference', '')} ({verse.get('version', 'NIV')})</p>
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
                <p>{datetime.now().strftime('%A, %B %d, %Y')}</p>
            </div>
            {verse_section}
        """

        # Weather section
        if weather:
            html += f"""
            <div class="section">
                <h2>☀️ Current Weather</h2>
                <div class="weather">
                    <div class="weather-item">
                        <div class="weather-value">{weather.get('temperature', '--')}°F</div>
                        <div class="weather-label">Temperature</div>
                    </div>
                    <div class="weather-item">
                        <div class="weather-value">{weather.get('humidity', '--')}%</div>
                        <div class="weather-label">Humidity</div>
                    </div>
                    <div class="weather-item">
                        <div class="weather-value">{weather.get('wind_speed', '--')} mph</div>
                        <div class="weather-label">Wind</div>
                    </div>
                    <div class="weather-item">
                        <div class="weather-value">{weather.get('rain_today', '0')}"</div>
                        <div class="weather-label">Rain Today</div>
                    </div>
                </div>
            </div>
            """

        # Alerts section
        if alerts:
            html += """
            <div class="section">
                <h2>⚠️ Active Alerts</h2>
            """
            for alert in alerts:
                severity = alert.get("severity", "info")
                html += f"""
                <div class="alert {severity}">
                    <strong>{alert.get('title', 'Alert')}</strong><br>
                    {alert.get('message', '')}
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
                    <strong>{task.get('title', 'Task')}</strong>
                    {f"<br><small>{task.get('description', '')}</small>" if task.get('description') else ""}
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

    async def send_weather_alert(self, alert: dict) -> bool:
        """Send an immediate weather alert"""
        severity = alert.get("severity", "warning").upper()
        subject = f"{severity}: {alert.get('title', 'Weather Alert')}"

        html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: {'#e74c3c' if severity == 'CRITICAL' else '#f39c12'};
                        color: white; padding: 20px; text-align: center;">
                <h1>⚠️ Weather Alert</h1>
            </div>
            <div style="padding: 20px;">
                <h2>{alert.get('title', 'Alert')}</h2>
                <p>{alert.get('message', '')}</p>

                <h3>Recommended Actions:</h3>
                <p>{alert.get('recommended_actions', 'Monitor conditions.')}</p>

                <p style="color: #666; font-size: 12px; margin-top: 30px;">
                    Alert generated at {datetime.now().strftime('%I:%M %p on %B %d, %Y')}
                </p>
            </div>
        </body>
        </html>
        """

        return await self.send_email(subject, html, html=True)

    async def send_task_reminder(self, task: dict) -> bool:
        """Send a task reminder email"""
        subject = f"Reminder: {task.get('title', 'Task Due')}"

        due_date = task.get("due_date", "Soon")
        if hasattr(due_date, "strftime"):
            due_date = due_date.strftime("%B %d, %Y")

        html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #2d5a27; color: white; padding: 20px; text-align: center;">
                <h1>📋 Task Reminder</h1>
            </div>
            <div style="padding: 20px;">
                <h2>{task.get('title', 'Task')}</h2>
                <p><strong>Due:</strong> {due_date}</p>
                <p><strong>Category:</strong> {task.get('category', 'General')}</p>

                {f"<p>{task.get('description', '')}</p>" if task.get('description') else ""}

                {f"<p><strong>Notes:</strong> {task.get('notes', '')}</p>" if task.get('notes') else ""}
            </div>
        </body>
        </html>
        """

        return await self.send_email(subject, html, html=True)

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
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">{plant.get('name', 'Unknown')}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">{plant.get('min_temp', '--')}°F</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">{plant.get('location', '--')}</td>
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
                color_info = f" ({animal.get('color')})" if animal.get('color') else ""
                animal_list_html += f"""
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">{animal.get('name', 'Unknown')}{color_info}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">{animal.get('animal_type', '--')}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">Below {animal.get('needs_blanket_below', '--')}°F</td>
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
                recommendations_html += f"<li>{rec}</li>"

            freeze_section_html = f"""
                <h2 style="color: #dc2626; margin-top: 25px;">🚰 Freeze Warning - Protect Pipes & Irrigation</h2>
                <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 15px 0;">
                    <p style="margin: 0 0 10px 0; font-weight: bold; color: #dc2626;">
                        {freeze_warning.get('message', 'Freeze forecasted!')}
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
