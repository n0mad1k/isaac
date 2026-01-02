"""
Levi Configuration
Environment-based settings for the farm assistant
"""

from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional
from pathlib import Path


class Settings(BaseSettings):
    # Application
    app_name: str = "Levi"
    app_version: str = "1.0.0"
    debug: bool = False

    # Database
    database_url: str = "sqlite+aiosqlite:///./data/levi.db"

    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # Timezone & Location
    timezone: str = "America/New_York"
    usda_zone: str = "9b"
    latitude: float = 28.913413  # Oxford, FL
    longitude: float = -82.093794

    # Ambient Weather API
    awn_api_key: Optional[str] = Field(default=None, description="Ambient Weather API Key")
    awn_app_key: Optional[str] = Field(default=None, description="Ambient Weather Application Key")
    weather_poll_interval: int = 300  # seconds (5 minutes)

    # Email Settings (Protonmail)
    smtp_host: str = "smtp.protonmail.ch"
    smtp_port: int = 587
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from: Optional[str] = None
    notification_email: Optional[str] = None
    email_alerts_enabled: bool = True

    # CalDAV Settings
    caldav_url: Optional[str] = Field(default=None, description="CalDAV server URL")
    caldav_username: Optional[str] = Field(default=None, description="CalDAV username")
    caldav_password: Optional[str] = Field(default=None, description="CalDAV password")
    caldav_calendar_name: str = Field(default="Levi Tasks", description="Calendar name for tasks")

    # Alert Thresholds
    frost_warning_temp: float = 35.0  # Fahrenheit
    freeze_warning_temp: float = 32.0
    heat_warning_temp: float = 95.0
    wind_warning_speed: float = 25.0  # mph
    rain_warning_inches: float = 2.0  # daily accumulation

    # Paths
    data_dir: Path = Path("./data")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
