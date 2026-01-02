"""
Settings API Routes
Runtime-configurable application settings
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime

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
        "value": "Mealey Family Farm",
        "description": "Name of the calendar to sync with"
    },
    "calendar_sync_interval": {
        "value": "30",
        "description": "How often to sync calendar (minutes)"
    },
}


class SettingUpdate(BaseModel):
    value: str


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


@router.get("/")
async def get_all_settings(db: AsyncSession = Depends(get_db)):
    """Get all settings with their current values"""
    # Start with defaults
    settings = {}
    for key, info in DEFAULT_SETTINGS.items():
        settings[key] = {
            "value": info["value"],
            "description": info["description"],
            "is_default": True
        }

    # Override with DB values
    result = await db.execute(select(AppSetting))
    db_settings = result.scalars().all()

    for setting in db_settings:
        if setting.key in settings:
            settings[setting.key]["value"] = setting.value
            settings[setting.key]["is_default"] = False
            settings[setting.key]["updated_at"] = setting.updated_at.isoformat() if setting.updated_at else None
        else:
            settings[setting.key] = {
                "value": setting.value,
                "description": setting.description,
                "is_default": False,
                "updated_at": setting.updated_at.isoformat() if setting.updated_at else None
            }

    return {"settings": settings}


@router.get("/{key}/")
async def get_setting_by_key(key: str, db: AsyncSession = Depends(get_db)):
    """Get a specific setting"""
    value = await get_setting(db, key)
    if value is None:
        raise HTTPException(status_code=404, detail=f"Setting '{key}' not found")

    description = DEFAULT_SETTINGS.get(key, {}).get("description")
    return {"key": key, "value": value, "description": description}


@router.put("/{key}/")
async def update_setting(key: str, data: SettingUpdate, db: AsyncSession = Depends(get_db)):
    """Update a setting value"""
    setting = await set_setting(db, key, data.value)
    return {
        "key": setting.key,
        "value": setting.value,
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

    # Send the email
    email_service = EmailService()
    if not email_service.is_configured():
        raise HTTPException(status_code=400, detail="Email not configured. Check SMTP settings in .env")

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

    success = await email_service.send_cold_protection_reminder(
        plants=plant_dicts,
        forecast_low=forecast_low,
        sunset_time=sunset_time,
        recipients=recipients,
    )

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
