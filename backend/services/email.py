"""
Email Notification Service
"""

import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import Optional, List
from loguru import logger

from config import settings


class EmailService:
    """Service for sending email notifications"""

    def __init__(self):
        self.host = settings.smtp_host
        self.port = settings.smtp_port
        self.user = settings.smtp_user
        self.password = settings.smtp_password
        self.from_addr = settings.smtp_from or settings.smtp_user
        self.default_recipient = settings.notification_email

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

        recipient = to or self.default_recipient
        if not recipient:
            logger.error("No recipient specified and no default configured")
            return False

        try:
            message = MIMEMultipart("alternative")
            message["Subject"] = f"[Levi] {subject}"
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
            )

            logger.info(f"Email sent: {subject} to {recipient}")
            return True

        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            return False

    async def send_daily_digest(
        self,
        tasks: List[dict],
        weather: dict,
        alerts: List[dict],
    ) -> bool:
        """Send daily digest email with tasks and weather"""
        subject = f"Daily Farm Digest - {datetime.now().strftime('%A, %B %d')}"

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
                <h1>🌾 Levi Daily Digest</h1>
                <p>{datetime.now().strftime('%A, %B %d, %Y')}</p>
            </div>
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
                <p>Generated by Levi - Your Farm Assistant</p>
            </div>
        </body>
        </html>
        """

        return await self.send_email(subject, html, html=True)

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
    ) -> bool:
        """Send cold protection reminder email before sunset"""
        subject = f"Cold Protection Needed Tonight - Low of {forecast_low}°F"

        plant_list_html = ""
        for plant in plants:
            plant_list_html += f"""
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">{plant.get('name', 'Unknown')}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">{plant.get('min_temp', '--')}°F</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">{plant.get('location', '--')}</td>
            </tr>
            """

        html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #1e40af; color: white; padding: 20px; text-align: center;">
                <h1>❄️ Cold Protection Reminder</h1>
                <p>Sunset at {sunset_time} - Cover plants before dark!</p>
            </div>
            <div style="padding: 20px;">
                <p style="font-size: 18px; color: #1e40af;">
                    <strong>Tonight's forecast low: {forecast_low}°F</strong>
                </p>
                <p>The following {len(plants)} plant(s) need protection:</p>

                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <thead>
                        <tr style="background: #f0f9ff;">
                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #1e40af;">Plant</th>
                            <th style="padding: 10px; text-align: center; border-bottom: 2px solid #1e40af;">Min Temp</th>
                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #1e40af;">Location</th>
                        </tr>
                    </thead>
                    <tbody>
                        {plant_list_html}
                    </tbody>
                </table>

                <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
                    <strong>Recommended Actions:</strong>
                    <ul style="margin: 10px 0; padding-left: 20px;">
                        <li>Cover frost-sensitive plants with frost cloth or blankets</li>
                        <li>Move potted plants indoors or to a sheltered area</li>
                        <li>Water plants well - moist soil retains heat better</li>
                        <li>Add mulch around plant bases for extra insulation</li>
                    </ul>
                </div>

                <p style="color: #666; font-size: 12px; margin-top: 30px;">
                    Reminder sent at {datetime.now().strftime('%I:%M %p')} (1 hour before sunset)
                </p>
            </div>
        </body>
        </html>
        """

        return await self.send_email(subject, html, to=recipients, html=True)
