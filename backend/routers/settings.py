"""
Settings API Routes
Runtime-configurable application settings
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
import re

from models.database import get_db
from models.settings import AppSetting


router = APIRouter(prefix="/settings", tags=["Settings"])


# Default settings with descriptions
DEFAULT_SETTINGS = {
    # Email settings
    "email_alerts_enabled": {
        "value": "true",
        "description": "Enable email notifications for weather alerts"
    },
    "email_recipients": {
        "value": "",
        "description": "Comma-separated list of email addresses for alerts"
    },
    "email_daily_digest": {
        "value": "true",
        "description": "Send daily digest email each morning"
    },
    "email_digest_time": {
        "value": "06:00",
        "description": "Time to send daily digest (24h format)"
    },
    "email_digest_recipient": {
        "value": "",
        "description": "Email address for daily digest (leave empty to use alert recipients)"
    },

    # Alert thresholds
    "frost_warning_temp": {
        "value": "35.0",
        "description": "Temperature (°F) to trigger frost warning"
    },
    "freeze_warning_temp": {
        "value": "32.0",
        "description": "Temperature (°F) to trigger freeze warning"
    },
    "heat_warning_temp": {
        "value": "95.0",
        "description": "Temperature (°F) to trigger heat warning"
    },
    "wind_warning_speed": {
        "value": "25.0",
        "description": "Wind speed (mph) to trigger wind warning"
    },
    "rain_warning_inches": {
        "value": "2.0",
        "description": "Daily rainfall (inches) to trigger rain warning"
    },

    # Cold protection buffer
    "cold_protection_buffer": {
        "value": "7",
        "description": "Degrees buffer for cold protection warnings (accounts for forecast error)"
    },

    # Display settings
    "dashboard_refresh_interval": {
        "value": "5",
        "description": "Dashboard auto-refresh interval in minutes (0 to disable)"
    },
    "hide_completed_today": {
        "value": "false",
        "description": "Hide completed tasks from Today's Schedule on dashboard"
    },
    "time_format": {
        "value": "12h",
        "description": "Time display format (12h or 24h)"
    },

    # Calendar sync settings
    "calendar_enabled": {
        "value": "false",
        "description": "Enable calendar sync with Radicale/CalDAV"
    },
    "calendar_url": {
        "value": "http://127.0.0.1:5232",
        "description": "CalDAV server URL"
    },
    "calendar_username": {
        "value": "",
        "description": "Calendar account username/email"
    },
    "calendar_password": {
        "value": "",
        "description": "Calendar app-specific password"
    },
    "calendar_name": {
        "value": "My Farm",
        "description": "Name of the calendar to sync with"
    },
    "calendar_sync_interval": {
        "value": "30",
        "description": "How often to sync calendar (minutes)"
    },

    # === Notification Category Settings ===
    # Animal Care Notifications
    "notify_animal_hoof_trim": {
        "value": "dashboard,email,calendar",
        "description": "Notifications for animal hoof trimming due dates (comma-separated: dashboard,email,calendar)"
    },
    "notify_animal_worming": {
        "value": "dashboard,email,calendar",
        "description": "Notifications for animal worming due dates"
    },
    "notify_animal_vaccination": {
        "value": "dashboard,email,calendar",
        "description": "Notifications for animal vaccination due dates"
    },
    "notify_animal_dental": {
        "value": "dashboard,email,calendar",
        "description": "Notifications for animal dental due dates"
    },
    "notify_animal_vet": {
        "value": "dashboard,email,calendar",
        "description": "Notifications for vet appointments"
    },
    "notify_animal_slaughter": {
        "value": "dashboard,email,calendar",
        "description": "Notifications for livestock slaughter dates"
    },
    "notify_animal_labor": {
        "value": "dashboard,email,calendar",
        "description": "Notifications for expected birth/labor dates"
    },

    # Plant Care Notifications
    "notify_plant_watering": {
        "value": "dashboard,calendar",
        "description": "Notifications for plant watering schedules"
    },
    "notify_plant_fertilizing": {
        "value": "dashboard,email,calendar",
        "description": "Notifications for plant fertilizing schedules"
    },
    "notify_plant_harvest": {
        "value": "dashboard,email,calendar",
        "description": "Notifications for plant harvest dates"
    },
    "notify_plant_pruning": {
        "value": "dashboard,email,calendar",
        "description": "Notifications for plant pruning schedules"
    },
    "notify_plant_sow": {
        "value": "dashboard,email,calendar",
        "description": "Notifications for seed sowing dates"
    },

    # Maintenance Notifications
    "notify_maintenance": {
        "value": "dashboard,email,calendar",
        "description": "Notifications for preventive maintenance reminders"
    },

    # Reminder Alert Settings
    "default_reminder_alerts": {
        "value": "0,60,1440",
        "description": "Default reminder alert intervals in minutes before due (0=at time, 60=1hr, 1440=1day). Comma-separated."
    },

    # Bible Verse Settings
    "bible_translation": {
        "value": "ESV",
        "description": "Bible translation for verse of the day (ESV, NKJV, KJV, NIV, NLT, NASB)"
    },

    # === Location Settings ===
    "timezone": {
        "value": "America/New_York",
        "description": "Your timezone (e.g., America/New_York, America/Los_Angeles)"
    },
    "latitude": {
        "value": "",
        "description": "Farm latitude for weather and sunrise/sunset calculations"
    },
    "longitude": {
        "value": "",
        "description": "Farm longitude for weather and sunrise/sunset calculations"
    },
    "usda_zone": {
        "value": "",
        "description": "USDA Hardiness Zone (e.g., 9b, 7a)"
    },

    # === Weather API Settings ===
    "awn_api_key": {
        "value": "",
        "description": "Ambient Weather Network API Key (from ambientweather.net/account)"
    },
    "awn_app_key": {
        "value": "",
        "description": "Ambient Weather Network Application Key"
    },

    # === Email Server Settings ===
    "smtp_host": {
        "value": "smtp.gmail.com",
        "description": "SMTP server hostname"
    },
    "smtp_port": {
        "value": "587",
        "description": "SMTP server port (usually 587 for TLS)"
    },
    "smtp_user": {
        "value": "",
        "description": "SMTP username/email address"
    },
    "smtp_password": {
        "value": "",
        "description": "SMTP password or app-specific password"
    },
    "smtp_from": {
        "value": "",
        "description": "From address for outgoing emails"
    },

    # === Storage Monitoring Settings ===
    "storage_warning_percent": {
        "value": "80",
        "description": "Disk usage percentage to trigger warning alert"
    },
    "storage_critical_percent": {
        "value": "95",
        "description": "Disk usage percentage to trigger critical alert"
    },
}


class SettingUpdate(BaseModel):
    value: str = Field(..., max_length=1000)  # Limit max value length


class SettingResponse(BaseModel):
    key: str
    value: Optional[str]
    description: Optional[str]
    updated_at: Optional[datetime]


class AllSettingsResponse(BaseModel):
    settings: dict


async def get_setting(db: AsyncSession, key: str) -> Optional[str]:
    """Get a setting value, returns default if not in DB"""
    result = await db.execute(
        select(AppSetting).where(AppSetting.key == key)
    )
    setting = result.scalar_one_or_none()

    if setting:
        return setting.value
    elif key in DEFAULT_SETTINGS:
        return DEFAULT_SETTINGS[key]["value"]
    return None


async def set_setting(db: AsyncSession, key: str, value: str) -> AppSetting:
    """Set a setting value"""
    result = await db.execute(
        select(AppSetting).where(AppSetting.key == key)
    )
    setting = result.scalar_one_or_none()

    if setting:
        setting.value = value
    else:
        description = DEFAULT_SETTINGS.get(key, {}).get("description")
        setting = AppSetting(key=key, value=value, description=description)
        db.add(setting)

    await db.commit()
    await db.refresh(setting)
    return setting


# Sensitive settings that should be masked in responses
SENSITIVE_SETTINGS = ['calendar_password', 'smtp_password', 'awn_api_key', 'awn_app_key']

def mask_sensitive_value(key: str, value: str) -> str:
    """Mask sensitive settings for display"""
    if key in SENSITIVE_SETTINGS and value:
        return "••••••••"  # Mask with bullets
    return value


@router.get("/")
async def get_all_settings(db: AsyncSession = Depends(get_db)):
    """Get all settings with their current values"""
    # Start with defaults
    settings = {}
    for key, info in DEFAULT_SETTINGS.items():
        settings[key] = {
            "value": mask_sensitive_value(key, info["value"]),
            "description": info["description"],
            "is_default": True
        }

    # Override with DB values
    result = await db.execute(select(AppSetting))
    db_settings = result.scalars().all()

    for setting in db_settings:
        if setting.key in settings:
            settings[setting.key]["value"] = mask_sensitive_value(setting.key, setting.value)
            settings[setting.key]["is_default"] = False
            settings[setting.key]["updated_at"] = setting.updated_at.isoformat() if setting.updated_at else None
        else:
            settings[setting.key] = {
                "value": mask_sensitive_value(setting.key, setting.value),
                "description": setting.description,
                "is_default": False,
                "updated_at": setting.updated_at.isoformat() if setting.updated_at else None
            }

    return {"settings": settings}


# ============================================
# Version and Update Endpoints (must be before /{key}/ route)
# ============================================

@router.get("/version/")
async def get_version_info():
    """Get current version, changelog, and update status"""
    import subprocess
    import os

    # Read version from VERSION file
    version_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "VERSION")
    current_version = "unknown"
    try:
        with open(version_file, "r") as f:
            current_version = f.read().strip()
    except:
        pass

    # Read changelog
    changelog_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "CHANGELOG.md")
    changelog = ""
    try:
        with open(changelog_file, "r") as f:
            changelog = f.read()
    except:
        pass

    # Get current git info
    git_info = {
        "branch": "",
        "commit": "",
        "commit_date": "",
        "has_updates": False,
        "commits_behind": 0,
    }

    try:
        # Get current branch
        result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True, text=True, cwd=os.path.dirname(version_file)
        )
        if result.returncode == 0:
            git_info["branch"] = result.stdout.strip()

        # Get current commit
        result = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True, text=True, cwd=os.path.dirname(version_file)
        )
        if result.returncode == 0:
            git_info["commit"] = result.stdout.strip()

        # Get commit date
        result = subprocess.run(
            ["git", "log", "-1", "--format=%ci"],
            capture_output=True, text=True, cwd=os.path.dirname(version_file)
        )
        if result.returncode == 0:
            git_info["commit_date"] = result.stdout.strip()

        # Fetch to check for updates (don't pull yet)
        subprocess.run(
            ["git", "fetch", "--quiet"],
            capture_output=True, cwd=os.path.dirname(version_file)
        )

        # Check how many commits behind
        result = subprocess.run(
            ["git", "rev-list", "--count", "HEAD..origin/" + git_info["branch"]],
            capture_output=True, text=True, cwd=os.path.dirname(version_file)
        )
        if result.returncode == 0:
            commits_behind = int(result.stdout.strip())
            git_info["commits_behind"] = commits_behind
            git_info["has_updates"] = commits_behind > 0
    except Exception as e:
        pass

    # Get recent commits
    recent_commits = []
    try:
        result = subprocess.run(
            ["git", "log", "--oneline", "-10", "--format=%h|%s|%cr"],
            capture_output=True, text=True, cwd=os.path.dirname(version_file)
        )
        if result.returncode == 0:
            for line in result.stdout.strip().split("\n"):
                if line:
                    parts = line.split("|", 2)
                    if len(parts) == 3:
                        recent_commits.append({
                            "hash": parts[0],
                            "message": parts[1],
                            "time": parts[2],
                        })
    except:
        pass

    git_info["recent_commits"] = recent_commits

    return {
        "version": current_version,
        "changelog": changelog,
        "git": git_info,
    }


@router.post("/update/")
async def update_application():
    """Pull latest changes and trigger rebuild"""
    import subprocess
    import os

    version_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "VERSION")
    project_dir = os.path.dirname(version_file)

    results = {
        "success": False,
        "git_pull": "",
        "message": "",
    }

    try:
        # Pull latest changes
        result = subprocess.run(
            ["git", "pull", "origin", "main"],
            capture_output=True, text=True, cwd=project_dir
        )
        results["git_pull"] = result.stdout + result.stderr

        if result.returncode == 0:
            results["success"] = True
            results["message"] = "Update successful. Restart the service to apply changes."
        else:
            results["message"] = f"Git pull failed: {result.stderr}"
    except Exception as e:
        results["message"] = f"Update failed: {str(e)}"

    return results


@router.get("/recent-commits/")
async def get_recent_commits():
    """Get recent git commits"""
    import subprocess
    import os

    version_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "VERSION")
    project_dir = os.path.dirname(version_file)

    commits = []
    try:
        result = subprocess.run(
            ["git", "log", "--oneline", "-20", "--format=%h|%s|%cr"],
            capture_output=True, text=True, cwd=project_dir
        )
        if result.returncode == 0:
            for line in result.stdout.strip().split("\n"):
                if line:
                    parts = line.split("|", 2)
                    if len(parts) == 3:
                        commits.append({
                            "hash": parts[0],
                            "message": parts[1],
                            "time": parts[2],
                        })
    except:
        pass

    return {"commits": commits}


@router.get("/{key}/")
async def get_setting_by_key(key: str, db: AsyncSession = Depends(get_db)):
    """Get a specific setting"""
    value = await get_setting(db, key)
    if value is None:
        raise HTTPException(status_code=404, detail=f"Setting '{key}' not found")

    description = DEFAULT_SETTINGS.get(key, {}).get("description")
    return {"key": key, "value": mask_sensitive_value(key, value), "description": description}


# Settings that require email format validation
EMAIL_SETTINGS = ['email_recipients']
# Settings that require numeric validation
NUMERIC_SETTINGS = {
    'frost_warning_temp': (-50, 150),
    'freeze_warning_temp': (-50, 150),
    'heat_warning_temp': (-50, 150),
    'wind_warning_speed': (0, 200),
    'rain_warning_inches': (0, 50),
    'cold_protection_buffer': (0, 30),
    'dashboard_refresh_interval': (0, 60),
    'calendar_sync_interval': (1, 1440),
    'smtp_port': (1, 65535),
    'latitude': (-90, 90),
    'longitude': (-180, 180),
    'storage_warning_percent': (1, 99),
    'storage_critical_percent': (1, 99),
}
# Settings that require time format validation (HH:MM)
TIME_SETTINGS = ['email_digest_time']


def validate_email_list(value: str) -> bool:
    """Validate comma-separated email list"""
    if not value:
        return True  # Empty is valid
    email_pattern = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
    emails = [e.strip() for e in value.split(',') if e.strip()]
    return all(email_pattern.match(email) for email in emails)


@router.put("/{key}/")
async def update_setting(key: str, data: SettingUpdate, db: AsyncSession = Depends(get_db)):
    """Update a setting value"""
    # Validate email format for email settings
    if key in EMAIL_SETTINGS and data.value:
        if not validate_email_list(data.value):
            raise HTTPException(
                status_code=400,
                detail="Invalid email format. Use comma-separated valid email addresses."
            )

    # Validate numeric settings
    if key in NUMERIC_SETTINGS:
        # Allow empty values for optional numeric settings (lat/long can be empty)
        if data.value.strip():
            try:
                num_value = float(data.value)
                min_val, max_val = NUMERIC_SETTINGS[key]
                if not (min_val <= num_value <= max_val):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Value must be between {min_val} and {max_val}"
                    )
            except ValueError:
                raise HTTPException(status_code=400, detail="Value must be a number")

    # Validate time format settings
    if key in TIME_SETTINGS and data.value:
        time_pattern = re.compile(r'^([01]?[0-9]|2[0-3]):[0-5][0-9]$')
        if not time_pattern.match(data.value):
            raise HTTPException(status_code=400, detail="Time must be in HH:MM format")

    setting = await set_setting(db, key, data.value)
    return {
        "key": setting.key,
        "value": mask_sensitive_value(setting.key, setting.value),  # Mask sensitive values
        "description": setting.description,
        "updated_at": setting.updated_at.isoformat() if setting.updated_at else None
    }


@router.post("/reset/{key}/")
async def reset_setting(key: str, db: AsyncSession = Depends(get_db)):
    """Reset a setting to its default value"""
    if key not in DEFAULT_SETTINGS:
        raise HTTPException(status_code=404, detail=f"No default for setting '{key}'")

    result = await db.execute(
        select(AppSetting).where(AppSetting.key == key)
    )
    setting = result.scalar_one_or_none()

    if setting:
        await db.delete(setting)
        await db.commit()

    return {
        "key": key,
        "value": DEFAULT_SETTINGS[key]["value"],
        "description": DEFAULT_SETTINGS[key]["description"],
        "is_default": True
    }


@router.post("/reset-all/")
async def reset_all_settings(db: AsyncSession = Depends(get_db)):
    """Reset all settings to defaults"""
    result = await db.execute(select(AppSetting))
    settings = result.scalars().all()

    for setting in settings:
        await db.delete(setting)

    await db.commit()
    return {"message": "All settings reset to defaults", "count": len(settings)}


@router.post("/test-cold-protection-email/")
async def test_cold_protection_email(db: AsyncSession = Depends(get_db)):
    """Send a test cold protection email with plants needing protection"""
    from models.plants import Plant
    from services.email import EmailService
    from services.weather import NWSForecastService

    # Get buffer setting
    buffer_value = await get_setting(db, "cold_protection_buffer")
    buffer_degrees = int(buffer_value) if buffer_value else 7

    # Get forecast
    forecast_service = NWSForecastService()
    forecast = await forecast_service.get_forecast_simple()
    forecast_low = None
    if forecast:
        for period in forecast[:2]:
            if period.get("low") is not None:
                forecast_low = period["low"]
                break

    if forecast_low is None:
        forecast_low = 35  # Use default for test

    # Get plants needing protection
    check_temp = forecast_low + buffer_degrees
    result = await db.execute(
        select(Plant)
        .where(Plant.is_active == True)
        .where(Plant.min_temp.isnot(None))
        .where(Plant.min_temp >= check_temp)
    )
    plants = result.scalars().all()

    if not plants:
        # If no plants need protection, get any frost-sensitive plants for the test
        result = await db.execute(
            select(Plant)
            .where(Plant.is_active == True)
            .where(Plant.min_temp.isnot(None))
            .limit(5)
        )
        plants = result.scalars().all()

    if not plants:
        raise HTTPException(status_code=404, detail="No plants with min_temp set found")

    # Get email recipients from settings
    recipients = await get_setting(db, "email_recipients")
    if not recipients:
        raise HTTPException(status_code=400, detail="No email recipients configured. Add recipients in Settings.")

    # Send the email - get configured service from DB settings
    from services.email import ConfigurationError
    try:
        email_service = await EmailService.get_configured_service(db)
    except ConfigurationError as e:
        raise HTTPException(status_code=400, detail=str(e))

    plant_dicts = [
        {
            "name": p.name,
            "min_temp": p.min_temp,
            "location": p.location or "Not specified",
        }
        for p in plants
    ]

    # Calculate approximate sunset for the email
    from datetime import datetime
    sunset_time = "5:30 PM"  # Approximate for test

    try:
        success = await email_service.send_cold_protection_reminder(
            plants=plant_dicts,
            forecast_low=forecast_low,
            sunset_time=sunset_time,
            recipients=recipients,
        )
    except ConfigurationError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if success:
        return {
            "message": f"Test cold protection email sent to {recipients} with {len(plants)} plants",
            "forecast_low": forecast_low,
            "recipients": recipients,
            "plants": [p["name"] for p in plant_dicts]
        }
    else:
        raise HTTPException(status_code=500, detail="Failed to send email")


@router.post("/test-calendar-sync/")
async def test_calendar_sync(db: AsyncSession = Depends(get_db)):
    """Test calendar connection and sync"""
    from services.calendar_sync import get_calendar_service

    service = await get_calendar_service(db)
    if not service:
        raise HTTPException(
            status_code=400,
            detail="Calendar sync not configured. Enable it and add credentials in Settings."
        )

    # Test connection
    if not service.connect():
        raise HTTPException(
            status_code=500,
            detail="Failed to connect to CalDAV server. Check URL and credentials."
        )

    # Get or create calendar
    calendar = service.get_or_create_calendar()
    if not calendar:
        raise HTTPException(
            status_code=500,
            detail="Failed to access or create calendar."
        )

    # Sync tasks to calendar
    tasks_synced = await service.sync_all_tasks_to_calendar(db)

    # Sync calendar to tasks
    sync_result = await service.sync_calendar_to_tasks(db)

    return {
        "message": "Calendar sync successful",
        "calendar_name": service.calendar_name,
        "tasks_pushed_to_calendar": tasks_synced,
        "events_created": sync_result.get("created", 0),
        "events_updated": sync_result.get("updated", 0),
        "events_deleted": sync_result.get("deleted", 0),
    }


@router.post("/sync-calendar/")
async def sync_calendar(db: AsyncSession = Depends(get_db)):
    """Perform a full bi-directional calendar sync"""
    from services.calendar_sync import get_calendar_service

    service = await get_calendar_service(db)
    if not service:
        raise HTTPException(status_code=400, detail="Calendar sync not enabled")

    if not service.connect():
        raise HTTPException(status_code=500, detail="Failed to connect to calendar")

    # First, get current calendar events to know what exists
    events = await service.get_calendar_events()
    calendar_uids = set()
    for event_dict in events:
        uid = event_dict.get('calendar_uid')
        if uid:
            calendar_uids.add(uid)

    # Push local tasks to calendar (with deletion detection for items deleted on phone)
    tasks_synced = await service.sync_all_tasks_to_calendar(db, calendar_uids)

    # Pull calendar events to local (including deletion detection)
    sync_result = await service.sync_calendar_to_tasks(db)

    return {
        "tasks_pushed_to_calendar": tasks_synced,
        "events_created": sync_result.get("created", 0),
        "events_updated": sync_result.get("updated", 0),
        "events_deleted": sync_result.get("deleted", 0),
    }


