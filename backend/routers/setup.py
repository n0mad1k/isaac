"""
Setup Wizard Router
One-time setup wizard for new installations
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
from sqlalchemy.orm import Session
import os
import logging
import subprocess
import hashlib

from models.database import get_db, AppSetting, User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/setup", tags=["setup"])


class SetupWizardRequest(BaseModel):
    """Setup wizard configuration"""
    farm_name: str = Field(..., min_length=1, max_length=100)
    timezone: str = Field(default="America/New_York")
    latitude: float = Field(default=40.7128, ge=-90, le=90)
    longitude: float = Field(default=-74.0060, ge=-180, le=180)

    # Admin account
    admin_username: str = Field(..., min_length=3, max_length=50)
    admin_password: str = Field(..., min_length=8, max_length=100)

    # Enabled modules/pages
    enabled_modules: list[str] = Field(default_factory=lambda: [
        "dashboard", "tasks", "calendar", "animals", "garden",
        "equipment", "vehicles", "home", "farm_areas", "team",
        "workers", "budget", "weather", "chat", "settings"
    ])

    # Optional settings
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = 587
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None

    awn_api_key: Optional[str] = None
    awn_app_key: Optional[str] = None


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
    "settings": {"name": "Settings", "description": "System configuration and preferences", "required": True},
}


def is_setup_complete(db: Session) -> bool:
    """Check if initial setup has been completed"""
    setting = db.query(AppSetting).filter(AppSetting.key == "initial_setup_complete").first()
    return setting is not None and setting.value == "true"


@router.get("/modules")
async def get_available_modules():
    """Get list of available modules for setup"""
    return {"modules": AVAILABLE_MODULES}


@router.get("/status")
async def get_setup_status(db: Session = Depends(get_db)):
    """Check if initial setup is needed"""
    return {
        "setup_complete": is_setup_complete(db),
        "needs_setup": not is_setup_complete(db)
    }


@router.post("/wizard")
async def complete_setup_wizard(config: SetupWizardRequest, db: Session = Depends(get_db)):
    """Complete the initial setup wizard"""

    # Check if already set up
    if is_setup_complete(db):
        raise HTTPException(status_code=400, detail="Setup has already been completed")

    try:
        # 1. Update app settings
        import json
        settings_to_save = [
            ("farm_name", config.farm_name),
            ("timezone", config.timezone),
            ("latitude", str(config.latitude)),
            ("longitude", str(config.longitude)),
            ("enabled_modules", json.dumps(config.enabled_modules)),
        ]

        for key, value in settings_to_save:
            existing = db.query(AppSetting).filter(AppSetting.key == key).first()
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

        # Add optional email settings
        if config.smtp_host and config.smtp_user:
            env_updates["SMTP_HOST"] = config.smtp_host
            env_updates["SMTP_PORT"] = str(config.smtp_port or 587)
            env_updates["SMTP_USER"] = config.smtp_user
            if config.smtp_password:
                env_updates["SMTP_PASSWORD"] = config.smtp_password

        # Add optional weather settings
        if config.awn_api_key and config.awn_app_key:
            env_updates["AWN_API_KEY"] = config.awn_api_key
            env_updates["AWN_APP_KEY"] = config.awn_app_key

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

        # 3. Create or update admin user
        existing_user = db.query(User).filter(User.username == config.admin_username).first()

        # Hash password
        salt = os.urandom(32)
        pwd_hash = hashlib.pbkdf2_hmac('sha256', config.admin_password.encode(), salt, 100000)
        password_hash = salt.hex() + ':' + pwd_hash.hex()

        if existing_user:
            existing_user.password_hash = password_hash
            existing_user.role = "admin"
            existing_user.is_active = True
        else:
            # Delete any existing admin user first
            db.query(User).filter(User.username == "admin").delete()

            new_user = User(
                username=config.admin_username,
                password_hash=password_hash,
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
        setup_flag = db.query(AppSetting).filter(AppSetting.key == "initial_setup_complete").first()
        if setup_flag:
            setup_flag.value = "true"
        else:
            db.add(AppSetting(key="initial_setup_complete", value="true"))

        db.commit()

        logger.info(f"Setup wizard completed for farm: {config.farm_name}")

        return {
            "success": True,
            "message": "Setup complete! Please log in with your new credentials.",
            "farm_name": config.farm_name
        }

    except Exception as e:
        logger.error(f"Setup wizard error: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="An error occurred during setup")
