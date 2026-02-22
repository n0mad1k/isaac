"""
Setup Wizard Router
One-time setup wizard for new installations
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import os
import logging
import subprocess
import bcrypt

from models.database import get_db
from models.settings import AppSetting
from models.users import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/setup", tags=["setup"])


async def require_setup_not_complete(db: AsyncSession = Depends(get_db)):
    """Dependency that returns 404 if setup is already complete"""
    result = await db.execute(
        select(AppSetting).where(AppSetting.key == "initial_setup_complete")
    )
    setting = result.scalar_one_or_none()
    if setting is not None and setting.value == "true":
        raise HTTPException(status_code=404, detail="Not found")
    return True


class SetupWizardRequest(BaseModel):
    """Setup wizard configuration"""
    farm_name: str = Field(..., min_length=1, max_length=100)
    timezone: str = Field(default="America/New_York")
    latitude: float = Field(default=40.7128, ge=-90, le=90)
    longitude: float = Field(default=-74.0060, ge=-180, le=180)
    usda_zone: Optional[str] = Field(default=None, description="USDA Hardiness Zone (e.g., 9b)")

    # Admin account
    admin_username: str = Field(..., min_length=3, max_length=50)
    admin_password: str = Field(..., min_length=8, max_length=100)

    # Enabled modules/pages
    enabled_modules: list[str] = Field(default_factory=lambda: [
        "dashboard", "tasks", "calendar", "animals", "garden",
        "equipment", "vehicles", "home", "farm_areas", "team",
        "workers", "budget", "weather", "chat", "settings"
    ])

    # Optional settings - Email
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = 587
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    notification_email: Optional[str] = Field(default=None, description="Email to receive alerts")

    awn_api_key: Optional[str] = None
    awn_app_key: Optional[str] = None

    # CalDAV settings (for calendar sync)
    caldav_enabled: bool = False
    caldav_username: Optional[str] = None
    caldav_password: Optional[str] = None


AVAILABLE_MODULES = {
    "dashboard": {"name": "Dashboard", "description": "Home page with weather, tasks, and quick overview", "required": True},
    "tasks": {"name": "Tasks & To-Do", "description": "Task management and to-do lists", "required": True},
    "calendar": {"name": "Calendar", "description": "Calendar view with events and scheduling", "required": False},
    "animals": {"name": "Animals", "description": "Livestock tracking, feeding schedules, and health records", "required": False},
    "garden": {"name": "Garden", "description": "Plant tracking, garden beds, and harvest logs", "required": False},
    "equipment": {"name": "Equipment", "description": "Farm equipment inventory and maintenance tracking", "required": False},
    "vehicles": {"name": "Vehicles", "description": "Vehicle maintenance and service records", "required": False},
    "home": {"name": "Home Maintenance", "description": "Home maintenance tasks and schedules", "required": False},
    "farm_areas": {"name": "Farm Areas", "description": "Property zones and area-specific tasks", "required": False},
    "team": {"name": "Team & Family", "description": "Family member profiles, health tracking, and assignments", "required": False},
    "workers": {"name": "Workers", "description": "Farm worker management and task assignments", "required": False},
    "budget": {"name": "Budget & Finance", "description": "Financial tracking, transactions, and budgeting", "required": False},
    "weather": {"name": "Weather", "description": "Weather data and forecasts", "required": False},
    "chat": {"name": "AI Assistant", "description": "Chat with AI assistant for farm advice", "required": False},
    "onscreen_keyboard": {"name": "On-Screen Keyboard", "description": "Touch-friendly keyboard for kiosk mode", "required": False},
    "settings": {"name": "Settings", "description": "System configuration and preferences", "required": True},
}


async def is_setup_complete(db: AsyncSession) -> bool:
    """Check if initial setup has been completed"""
    result = await db.execute(
        select(AppSetting).where(AppSetting.key == "initial_setup_complete")
    )
    setting = result.scalar_one_or_none()
    return setting is not None and setting.value == "true"


@router.get("/modules/")
async def get_available_modules(_: bool = Depends(require_setup_not_complete)):
    """Get list of available modules for setup - 404 if setup complete"""
    return {"modules": AVAILABLE_MODULES}


@router.get("/status/")
async def get_setup_status(db: AsyncSession = Depends(get_db)):
    """Check if initial setup is needed"""
    complete = await is_setup_complete(db)
    return {
        "setup_complete": complete,
        "needs_setup": not complete
    }


@router.post("/wizard/")
async def complete_setup_wizard(
    config: SetupWizardRequest,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(require_setup_not_complete)
):
    """Complete the initial setup wizard - 404 if setup already complete"""

    try:
        # 1. Update app settings
        import json
        settings_to_save = [
            ("farm_name", config.farm_name),
            ("timezone", config.timezone),
            ("latitude", str(config.latitude)),
            ("longitude", str(config.longitude)),
            ("enabled_modules", json.dumps(config.enabled_modules)),
            ("theme", "light"),  # Default to light mode
        ]

        for key, value in settings_to_save:
            result = await db.execute(
                select(AppSetting).where(AppSetting.key == key)
            )
            existing = result.scalar_one_or_none()
            if existing:
                existing.value = value
            else:
                db.add(AppSetting(key=key, value=value))

        # 2. Update .env file
        env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
        env_updates = {
            "TIMEZONE": config.timezone,
            "LATITUDE": str(config.latitude),
            "LONGITUDE": str(config.longitude),
        }

        # Add USDA zone if provided
        if config.usda_zone:
            env_updates["USDA_ZONE"] = config.usda_zone

        # Add optional email settings
        if config.smtp_host and config.smtp_user:
            env_updates["SMTP_HOST"] = config.smtp_host
            env_updates["SMTP_PORT"] = str(config.smtp_port or 587)
            env_updates["SMTP_USER"] = config.smtp_user
            if config.smtp_password:
                env_updates["SMTP_PASSWORD"] = config.smtp_password
            # Set notification email (defaults to SMTP user if not provided)
            notification = config.notification_email or config.smtp_user
            env_updates["NOTIFICATION_EMAIL"] = notification
            env_updates["SMTP_FROM"] = f"Isaac Farm Assistant <{config.smtp_user}>"
            env_updates["EMAIL_ALERTS_ENABLED"] = "true"

        # Add optional weather settings
        if config.awn_api_key and config.awn_app_key:
            env_updates["AWN_API_KEY"] = config.awn_api_key
            env_updates["AWN_APP_KEY"] = config.awn_app_key

        # Add CalDAV settings
        if config.caldav_enabled and config.caldav_username and config.caldav_password:
            env_updates["CALDAV_URL"] = "http://127.0.0.1:5232"
            env_updates["CALDAV_USERNAME"] = config.caldav_username
            env_updates["CALDAV_PASSWORD"] = config.caldav_password

            # Create Radicale htpasswd entry
            try:
                subprocess.run(
                    ["sudo", "htpasswd", "-bB", "/etc/radicale/users",
                     config.caldav_username, config.caldav_password],
                    capture_output=True,
                    timeout=10
                )
                logger.info(f"Created Radicale user: {config.caldav_username}")
            except Exception as e:
                logger.warning(f"Could not create Radicale user: {e}")

        # Read existing .env
        existing_env = {}
        if os.path.exists(env_path):
            with open(env_path, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        existing_env[key] = value

        # Merge and write
        existing_env.update(env_updates)
        with open(env_path, 'w') as f:
            f.write("# Isaac Configuration\n")
            f.write(f"# Configured via Setup Wizard\n\n")
            for key, value in existing_env.items():
                f.write(f"{key}={value}\n")

        # 3. Create admin user
        result = await db.execute(
            select(User).where(User.username == config.admin_username)
        )
        existing_user = result.scalar_one_or_none()

        # Hash password with bcrypt (must match auth.py verify_password)
        hashed_password = bcrypt.hashpw(
            config.admin_password.encode(),
            bcrypt.gensalt()
        ).decode()

        if existing_user:
            existing_user.hashed_password = hashed_password
            existing_user.role = "admin"
            existing_user.is_active = True
        else:
            # Delete any existing admin user first
            result = await db.execute(
                select(User).where(User.username == "admin")
            )
            old_admin = result.scalar_one_or_none()
            if old_admin:
                await db.delete(old_admin)

            new_user = User(
                username=config.admin_username,
                hashed_password=hashed_password,
                role="admin",
                is_active=True
            )
            db.add(new_user)

        # 4. Set system timezone (best effort)
        try:
            subprocess.run(
                ["sudo", "timedatectl", "set-timezone", config.timezone],
                capture_output=True,
                timeout=10
            )
        except Exception as e:
            logger.warning(f"Could not set system timezone: {e}")

        # 5. Mark setup as complete
        result = await db.execute(
            select(AppSetting).where(AppSetting.key == "initial_setup_complete")
        )
        setup_flag = result.scalar_one_or_none()
        if setup_flag:
            setup_flag.value = "true"
        else:
            db.add(AppSetting(key="initial_setup_complete", value="true"))

        await db.commit()

        logger.info(f"Setup wizard completed for farm: {config.farm_name}")

        # Note: Setup endpoints are protected by require_setup_not_complete dependency
        # which returns 404 after setup is complete, so no need to delete files

        return {
            "success": True,
            "message": "Setup complete! Please log in with your new credentials.",
            "farm_name": config.farm_name
        }

    except Exception as e:
        logger.error(f"Setup wizard error: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="An error occurred during setup")
