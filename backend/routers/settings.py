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
from models.users import User
from routers.auth import require_admin, require_auth
from services.encryption import encrypt_value, decrypt_value, should_encrypt, ENCRYPTED_SETTINGS


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
    "theme": {
        "value": "dark",
        "description": "App theme (dark or light)"
    },
    "motto": {
        "value": "",
        "description": "Mission statement or motto displayed on each page"
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

    # Cloudflare Access settings
    "cloudflare_api_token": {
        "value": "",
        "description": "Cloudflare API token with Access:Edit permission"
    },
    "cloudflare_account_id": {
        "value": "",
        "description": "Cloudflare account ID"
    },
    "cloudflare_app_id": {
        "value": "",
        "description": "Cloudflare Access application ID"
    },

    # === Notification Category Settings (Simplified) ===
    # These control notifications for each category of tasks
    "notify_animal_care": {
        "value": "dashboard,email,calendar",
        "description": "Notifications for animal care tasks (vet, vaccinations, worming, etc.)"
    },
    "notify_plant_care": {
        "value": "dashboard,email,calendar",
        "description": "Notifications for plant care tasks (watering, fertilizing, harvesting, etc.)"
    },
    "notify_maintenance": {
        "value": "dashboard,email,calendar",
        "description": "Notifications for preventive maintenance reminders"
    },

    # Reminder Alert Settings (per-category)
    # Each category can have its own alert intervals, or use "" to inherit from default
    "default_reminder_alerts": {
        "value": "0,60,1440",
        "description": "Default reminder alert intervals in minutes before due (0=at time, 60=1hr, 1440=1day). Comma-separated. Used when category-specific alerts are not set."
    },
    # Animal care alerts
    "alerts_animal_hoof_trim": {
        "value": "",
        "description": "Alert intervals for hoof trimming reminders (empty = use default)"
    },
    "alerts_animal_worming": {
        "value": "",
        "description": "Alert intervals for worming reminders (empty = use default)"
    },
    "alerts_animal_vaccination": {
        "value": "",
        "description": "Alert intervals for vaccination reminders (empty = use default)"
    },
    "alerts_animal_dental": {
        "value": "",
        "description": "Alert intervals for dental reminders (empty = use default)"
    },
    "alerts_animal_vet": {
        "value": "",
        "description": "Alert intervals for vet appointment reminders (empty = use default)"
    },
    "alerts_animal_slaughter": {
        "value": "",
        "description": "Alert intervals for slaughter date reminders (empty = use default)"
    },
    "alerts_animal_labor": {
        "value": "",
        "description": "Alert intervals for labor/birth reminders (empty = use default)"
    },
    # Plant care alerts
    "alerts_plant_watering": {
        "value": "",
        "description": "Alert intervals for plant watering reminders (empty = use default)"
    },
    "alerts_plant_fertilizing": {
        "value": "",
        "description": "Alert intervals for plant fertilizing reminders (empty = use default)"
    },
    "alerts_plant_harvest": {
        "value": "",
        "description": "Alert intervals for harvest reminders (empty = use default)"
    },
    "alerts_plant_pruning": {
        "value": "",
        "description": "Alert intervals for pruning reminders (empty = use default)"
    },
    "alerts_plant_sow": {
        "value": "",
        "description": "Alert intervals for seed sowing reminders (empty = use default)"
    },
    # Maintenance alerts
    "alerts_maintenance": {
        "value": "",
        "description": "Alert intervals for maintenance reminders (empty = use default)"
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

    # === Translation Settings ===
    "deepl_api_key": {
        "value": "",
        "description": "DeepL API Key for task translation (get free key at deepl.com/pro-api)"
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
    "awn_soil_moisture_enabled": {
        "value": "false",
        "description": "Use AWN soil moisture sensor to determine watering needs for rain-dependent plants"
    },
    "awn_soil_moisture_threshold": {
        "value": "50",
        "description": "Soil moisture percentage above which to skip watering (0-100)"
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

    # === Worker Tasks Settings ===
    "worker_tasks_enabled": {
        "value": "false",
        "description": "Enable the Worker Tasks page in navigation"
    },

    # === Kiosk/Touch Display Settings ===
    "show_keyboard_button": {
        "value": "false",
        "description": "Show on-screen keyboard toggle button in navigation (for touch displays)"
    },
    "show_hard_refresh_button": {
        "value": "true",
        "description": "Show hard refresh button in floating action menu"
    },

    # === Customer Feedback Settings ===
    "customer_feedback_enabled": {
        "value": "false",
        "description": "Enable feedback submission button for users (typically enabled during user testing)"
    },

    # === Team Management Settings ===
    "team_enabled": {
        "value": "false",
        "description": "Enable the Team Management page in navigation"
    },
    "team_name": {
        "value": "My Team",
        "description": "Name of your team/unit/family"
    },
    "team_mission": {
        "value": "",
        "description": "Team mission statement"
    },
    "team_units": {
        "value": "imperial",
        "description": "Unit system for measurements (imperial or metric)"
    },
    "mentoring_day": {
        "value": "Sunday",
        "description": "Day of the week for mentoring sessions"
    },
    "aar_day": {
        "value": "Saturday",
        "description": "Day of the week for After Action Review"
    },
    "team_values": {
        "value": "",
        "description": "JSON array of team values with names, descriptions, and questions"
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
    """Get a setting value, returns default if not in DB. Decrypts sensitive values."""
    result = await db.execute(
        select(AppSetting).where(AppSetting.key == key)
    )
    setting = result.scalar_one_or_none()

    if setting:
        # Decrypt sensitive settings
        if should_encrypt(key):
            return decrypt_value(setting.value)
        return setting.value
    elif key in DEFAULT_SETTINGS:
        return DEFAULT_SETTINGS[key]["value"]
    return None


async def set_setting(db: AsyncSession, key: str, value: str) -> AppSetting:
    """Set a setting value. Encrypts sensitive values before storing."""
    # Encrypt sensitive settings
    stored_value = encrypt_value(value) if should_encrypt(key) else value

    result = await db.execute(
        select(AppSetting).where(AppSetting.key == key)
    )
    setting = result.scalar_one_or_none()

    if setting:
        setting.value = stored_value
    else:
        description = DEFAULT_SETTINGS.get(key, {}).get("description")
        setting = AppSetting(key=key, value=stored_value, description=description)
        db.add(setting)

    await db.commit()
    await db.refresh(setting)
    return setting


# Sensitive settings that should be masked in responses (includes cloudflare_api_token)
SENSITIVE_SETTINGS = ['calendar_password', 'smtp_password', 'awn_api_key', 'awn_app_key', 'cloudflare_api_token', 'deepl_api_key']

def mask_sensitive_value(key: str, value: str) -> str:
    """Mask sensitive settings for display"""
    if key in SENSITIVE_SETTINGS and value:
        return "••••••••"  # Mask with bullets
    return value


@router.get("/")
async def get_all_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get all settings with their current values (requires authentication)"""
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
# Kiosk/Display Control Endpoints
# ============================================

@router.post("/keyboard/toggle/")
async def toggle_keyboard():
    """Toggle the on-screen keyboard (onboard) via D-Bus"""
    import subprocess
    import os

    try:
        # Set DISPLAY for the X11 session
        env = os.environ.copy()
        env['DISPLAY'] = ':0'
        # Also need DBUS_SESSION_BUS_ADDRESS for user session
        env['DBUS_SESSION_BUS_ADDRESS'] = 'unix:path=/run/user/1000/bus'

        # Use full path to dbus-send
        dbus_send = '/usr/bin/dbus-send'

        # Send D-Bus message to toggle onboard visibility
        result = subprocess.run(
            [dbus_send, '--type=method_call', '--dest=org.onboard.Onboard',
             '/org/onboard/Onboard/Keyboard', 'org.onboard.Onboard.Keyboard.ToggleVisible'],
            env=env,
            capture_output=True,
            text=True,
            timeout=5
        )

        if result.returncode == 0:
            return {"status": "success", "message": "Keyboard toggled"}
        else:
            # Try Show command as fallback
            subprocess.run(
                [dbus_send, '--type=method_call', '--dest=org.onboard.Onboard',
                 '/org/onboard/Onboard/Keyboard', 'org.onboard.Onboard.Keyboard.Show'],
                env=env,
                capture_output=True,
                text=True,
                timeout=5
            )
            return {"status": "success", "message": "Keyboard shown"}
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Keyboard toggle timed out")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to toggle keyboard: {str(e)}")


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
    recent_changes = []
    try:
        with open(changelog_file, "r") as f:
            changelog = f.read()

        # Extract recent changes (just the current version's section)
        import re
        # Find the first version section and extract its bullet points
        version_pattern = rf"## \[{re.escape(current_version)}\].*?\n(.*?)(?=\n## \[|$)"
        match = re.search(version_pattern, changelog, re.DOTALL)
        if match:
            section = match.group(1)
            # Extract all bullet points (lines starting with -)
            for line in section.split('\n'):
                line = line.strip()
                if line.startswith('- '):
                    recent_changes.append(line[2:])  # Remove "- " prefix
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

    from config import settings as app_settings

    return {
        "version": current_version,
        "recent_changes": recent_changes,
        "changelog": changelog,
        "git": git_info,
        "is_dev_instance": app_settings.is_dev_instance,
    }


@router.post("/update/")
async def update_application(admin: User = Depends(require_admin)):
    """Pull latest changes and trigger rebuild (admin only)"""
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


@router.post("/push-to-prod/")
async def push_to_production(admin: User = Depends(require_admin)):
    """Push changes from dev to production using deploy script (dev instance only)"""
    import subprocess
    from config import settings as app_settings

    # Only allow on dev instance
    if not app_settings.is_dev_instance:
        raise HTTPException(status_code=403, detail="This action is only available on the dev instance")

    results = {
        "success": False,
        "steps": [],
        "message": "",
    }

    # Deploy script that mirrors deploy.sh logic but for local Pi paths
    deploy_script = '''#!/bin/bash
set -e
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

echo "STEP:backup"
# Backup production database
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p /opt/levi/data/backups
if [ -f /opt/levi/data/levi.db ]; then
    cp /opt/levi/data/levi.db /opt/levi/data/backups/levi_backup_$TIMESTAMP.db
    echo "Backed up to levi_backup_$TIMESTAMP.db"
fi

echo "STEP:sync_backend"
# Sync backend (exclude venv, data, logs, __pycache__, and dev-only files)
cd /opt/isaac/backend
for item in *; do
    if [[ "$item" != "venv" && "$item" != "data" && "$item" != "logs" && "$item" != "__pycache__" && "$item" != ".env" ]]; then
        rm -rf /opt/levi/backend/$item
        cp -r $item /opt/levi/backend/
    fi
done
echo "Backend synced"

echo "STEP:cleanup_dev_only"
# Remove dev-only files from production
rm -f /opt/levi/backend/routers/dev_tracker.py
rm -f /opt/levi/backend/models/dev_tracker.py
# Remove dev_tracker imports
sed -i '/dev_tracker/d' /opt/levi/backend/routers/__init__.py 2>/dev/null || true
sed -i '/dev_tracker/d' /opt/levi/backend/models/__init__.py 2>/dev/null || true
sed -i '/dev_tracker/d' /opt/levi/backend/main.py 2>/dev/null || true
# Note: pull-from-prod endpoint stays but returns 403 on prod (checks is_dev_instance)
echo "Dev-only code cleaned"

echo "STEP:sync_frontend"
# Sync frontend source
rm -rf /opt/levi/frontend/src
cp -r /opt/isaac/frontend/src /opt/levi/frontend/src
echo "Frontend source synced"

echo "STEP:sync_version"
# Sync version files
cp /opt/isaac/VERSION /opt/levi/VERSION
cp /opt/isaac/CHANGELOG.md /opt/levi/CHANGELOG.md
echo "Version files synced"

echo "STEP:build_frontend"
# Build frontend
cd /opt/levi/frontend
npm run build
echo "Frontend built"

echo "STEP:restart_backend"
# Restart backend
sudo systemctl restart levi-backend
echo "Backend restarted"

echo "STEP:done"
'''

    try:
        result = subprocess.run(
            ["/bin/bash", "-c", deploy_script],
            capture_output=True, text=True, timeout=300
        )

        # Parse output to build steps
        output = result.stdout + result.stderr
        current_step = None
        for line in output.split('\n'):
            if line.startswith('STEP:'):
                current_step = line.replace('STEP:', '')
                if current_step != 'done':
                    results["steps"].append({"step": current_step, "status": "ok", "message": ""})
            elif current_step and results["steps"]:
                # Append message to current step
                if line.strip():
                    results["steps"][-1]["message"] = line.strip()

        if result.returncode != 0:
            results["message"] = f"Deploy failed: {result.stderr or result.stdout}"
            if results["steps"]:
                results["steps"][-1]["status"] = "error"
        else:
            results["success"] = True
            results["message"] = "Successfully pushed to production!"

    except subprocess.TimeoutExpired:
        results["message"] = "Operation timed out (5 min limit)"
    except Exception as e:
        results["message"] = f"Push to production failed: {str(e)}"

    return results


@router.post("/pull-from-prod/")
async def pull_from_production(admin: User = Depends(require_admin)):
    """Pull database from production to dev for testing (dev instance only)"""
    import subprocess
    import shutil
    import sqlite3
    import os
    from datetime import datetime as dt
    from config import settings as app_settings

    # Only allow on dev instance
    if not app_settings.is_dev_instance:
        raise HTTPException(status_code=403, detail="This action is only available on the dev instance")

    results = {
        "success": False,
        "steps": [],
        "message": "",
    }

    dev_db = "/opt/isaac/backend/data/levi.db"
    prod_db = "/opt/levi/backend/data/levi.db"
    backup_dir = "/opt/isaac/backend/data/backups"

    # Initialize variables for dev-only data preservation
    dev_tracker_data = []
    dev_tracker_cols = []

    try:
        # Step 1: Backup dev database
        results["steps"].append({"step": "backup", "status": "running", "message": ""})
        os.makedirs(backup_dir, exist_ok=True)
        timestamp = dt.now().strftime("%Y%m%d_%H%M%S")

        if os.path.exists(dev_db):
            backup_path = f"{backup_dir}/levi_backup_{timestamp}.db"
            shutil.copy2(dev_db, backup_path)
            results["steps"][-1]["status"] = "ok"
            results["steps"][-1]["message"] = f"Backed up to {backup_path}"
        else:
            results["steps"][-1]["status"] = "skipped"
            results["steps"][-1]["message"] = "No existing dev database"

        # Step 2: Extract dev-only tables before copying
        results["steps"].append({"step": "preserve_dev_tables", "status": "running", "message": ""})
        if os.path.exists(dev_db):
            try:
                conn = sqlite3.connect(dev_db)
                cursor = conn.cursor()
                # Check if dev_tracker_items exists
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='dev_tracker_items'")
                if cursor.fetchone():
                    # Get column names first
                    cursor.execute("PRAGMA table_info(dev_tracker_items)")
                    raw_cols = [col[1] for col in cursor.fetchall()]
                    # Validate column names to prevent SQL injection (only alphanumeric and underscore)
                    valid_col_pattern = re.compile(r'^[a-zA-Z_][a-zA-Z0-9_]*$')
                    dev_tracker_cols = []
                    for col in raw_cols:
                        if valid_col_pattern.match(col):
                            dev_tracker_cols.append(col)
                        else:
                            # Skip invalid column names (should never happen in normal operation)
                            pass
                    # Then get all data
                    cursor.execute("SELECT * FROM dev_tracker_items")
                    dev_tracker_data = cursor.fetchall()
                    results["steps"][-1]["status"] = "ok"
                    results["steps"][-1]["message"] = f"Preserved {len(dev_tracker_data)} dev tracker items with {len(dev_tracker_cols)} columns"
                else:
                    results["steps"][-1]["status"] = "skipped"
                    results["steps"][-1]["message"] = "No dev_tracker_items table found"
                conn.close()
            except Exception as e:
                results["steps"][-1]["status"] = "warning"
                results["steps"][-1]["message"] = f"Could not preserve dev tables: {str(e)}"
        else:
            results["steps"][-1]["status"] = "skipped"
            results["steps"][-1]["message"] = "No dev database to preserve"

        # Step 3: Copy prod database to dev
        results["steps"].append({"step": "copy_database", "status": "running", "message": ""})
        if os.path.exists(prod_db):
            shutil.copy2(prod_db, dev_db)
            # Ensure file is fully written
            os.sync()
            results["steps"][-1]["status"] = "ok"
            results["steps"][-1]["message"] = "Copied prod database to dev"
        else:
            results["steps"][-1]["status"] = "error"
            results["steps"][-1]["message"] = "Production database not found"
            results["message"] = "Production database not found at /opt/levi/backend/data/levi.db"
            return results

        # Step 4: Restore dev-only tables and add missing columns
        results["steps"].append({"step": "restore_dev_tables", "status": "running", "message": ""})
        restore_messages = []

        conn = sqlite3.connect(dev_db)
        cursor = conn.cursor()

        # Always create dev_tracker_items table (prod doesn't have it)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS dev_tracker_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_type VARCHAR(20) DEFAULT 'TEST',
                priority VARCHAR(20) DEFAULT 'MEDIUM',
                status VARCHAR(20) DEFAULT 'PENDING',
                title TEXT NOT NULL,
                description TEXT,
                version VARCHAR(20),
                test_notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME
            )
        ''')

        # Restore preserved data if we have any
        if dev_tracker_data and dev_tracker_cols:
            inserted = 0
            failed = 0
            placeholders = ','.join(['?' for _ in dev_tracker_cols])
            col_names = ','.join(dev_tracker_cols)
            for row in dev_tracker_data:
                try:
                    cursor.execute(f"INSERT OR REPLACE INTO dev_tracker_items ({col_names}) VALUES ({placeholders})", row)
                    inserted += 1
                except Exception as e:
                    failed += 1
            restore_messages.append(f"Restored {inserted} dev tracker items" + (f" ({failed} failed)" if failed else ""))
        else:
            restore_messages.append("Created empty dev_tracker_items table")

        # Add missing columns to tasks table
        cursor.execute("PRAGMA table_info(tasks)")
        existing_cols = [col[1] for col in cursor.fetchall()]

        if 'calendar_synced_at' not in existing_cols:
            cursor.execute("ALTER TABLE tasks ADD COLUMN calendar_synced_at DATETIME")
            restore_messages.append("Added calendar_synced_at column")

        if 'is_backlog' not in existing_cols:
            cursor.execute("ALTER TABLE tasks ADD COLUMN is_backlog BOOLEAN DEFAULT 0")
            restore_messages.append("Added is_backlog column")

        # Add missing columns to home_maintenance table
        cursor.execute("PRAGMA table_info(home_maintenance)")
        hm_cols = [col[1] for col in cursor.fetchall()]

        if 'area_or_appliance' not in hm_cols:
            cursor.execute("ALTER TABLE home_maintenance ADD COLUMN area_or_appliance VARCHAR(100)")
            restore_messages.append("Added area_or_appliance column")

        if 'area_icon' not in hm_cols:
            cursor.execute("ALTER TABLE home_maintenance ADD COLUMN area_icon VARCHAR(50)")
            restore_messages.append("Added area_icon column")

        conn.commit()
        conn.close()

        results["steps"][-1]["status"] = "ok"
        results["steps"][-1]["message"] = "; ".join(restore_messages)

        # Step 5: Clear alerts_sent and sync_uid to prevent duplicates
        results["steps"].append({"step": "clear_sync_data", "status": "running", "message": ""})
        conn = sqlite3.connect(dev_db)
        cursor = conn.cursor()

        clear_messages = []

        # Clear alerts_sent on all tasks
        try:
            cursor.execute("UPDATE tasks SET alerts_sent = NULL")
            alerts_cleared = cursor.rowcount
            clear_messages.append(f"alerts_sent on {alerts_cleared} tasks")
        except sqlite3.OperationalError:
            pass  # Column doesn't exist

        # Clear calendar_uid on all tasks (prevents calendar duplication)
        try:
            cursor.execute("UPDATE tasks SET calendar_uid = NULL")
            sync_cleared = cursor.rowcount
            clear_messages.append(f"calendar_uid on {sync_cleared} tasks")
        except sqlite3.OperationalError:
            pass  # Column doesn't exist

        conn.commit()
        conn.close()

        results["steps"][-1]["status"] = "ok"
        results["steps"][-1]["message"] = f"Cleared {', '.join(clear_messages)}" if clear_messages else "No sync columns found"

        # Step 6: Restart backend
        results["steps"].append({"step": "restart_backend", "status": "running", "message": ""})
        result = subprocess.run(
            ["/usr/bin/sudo", "/usr/bin/systemctl", "restart", "isaac-backend"],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            results["steps"][-1]["status"] = "ok"
            results["steps"][-1]["message"] = "Backend restarted"
        else:
            results["steps"][-1]["status"] = "warning"
            results["steps"][-1]["message"] = f"Restart may have failed: {result.stderr}"

        results["success"] = True
        results["message"] = "Successfully pulled data from production! Page will refresh."

    except Exception as e:
        import traceback
        if results["steps"]:
            results["steps"][-1]["status"] = "error"
        results["message"] = f"Pull from production failed: {str(e)}\n{traceback.format_exc()}"

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


# Admin Logs Endpoints (must be before /{key}/ route)
# ANSI escape code pattern for stripping colors from logs
ANSI_ESCAPE_PATTERN = re.compile(r'\x1b\[[0-9;]*[mK]|\x1b\].*?\x07')

def strip_ansi_codes(text: str) -> str:
    """Remove ANSI escape codes (colors, formatting) from text."""
    return ANSI_ESCAPE_PATTERN.sub('', text)


@router.get("/admin-logs/files/")
async def get_log_files():
    """Get list of available log files"""
    from pathlib import Path
    import os

    log_files = []

    # Check main app log
    app_log = Path("logs/isaac.log")
    if app_log.exists():
        size = app_log.stat().st_size
        log_files.append({
            "id": "app",
            "name": "Application Log",
            "path": str(app_log),
            "size": size,
            "size_human": f"{size / 1024 / 1024:.1f} MB" if size > 1024*1024 else f"{size / 1024:.1f} KB"
        })

    # Check systemd logs (from /opt/isaac/logs/ or /opt/levi/logs/)
    for base in ["/opt/isaac/logs", "/opt/levi/logs"]:
        logs_dir = Path(base)
        if logs_dir.exists():
            for log_file in ["backend.log", "backend-error.log"]:
                log_path = logs_dir / log_file
                if log_path.exists():
                    size = log_path.stat().st_size
                    file_id = log_file.replace(".log", "").replace("-", "_")
                    log_files.append({
                        "id": file_id,
                        "name": log_file.replace("-", " ").replace(".log", "").title(),
                        "path": str(log_path),
                        "size": size,
                        "size_human": f"{size / 1024 / 1024:.1f} MB" if size > 1024*1024 else f"{size / 1024:.1f} KB"
                    })
            break  # Only check one base directory

    return {"files": log_files}


@router.get("/admin-logs/")
async def get_admin_logs(
    lines: int = 100,
    level: Optional[str] = None,
    search: Optional[str] = None,
    log_file: Optional[str] = "app"
):
    """
    Get recent application logs for admin review.

    - lines: Number of recent lines to return (default 100, max 1000)
    - level: Filter by log level (ERROR, WARNING, INFO, DEBUG)
    - search: Search for text in log messages
    - log_file: Which log file to read (app, backend, backend_error)
    """
    import os
    from pathlib import Path

    # Map log_file ID to path
    log_paths = {
        "app": Path("logs/isaac.log"),
        "backend": Path("/opt/isaac/logs/backend.log"),
        "backend_error": Path("/opt/isaac/logs/backend-error.log"),
    }
    # Also check levi paths
    if not log_paths.get(log_file, Path("")).exists():
        log_paths["backend"] = Path("/opt/levi/logs/backend.log")
        log_paths["backend_error"] = Path("/opt/levi/logs/backend-error.log")

    log_path = log_paths.get(log_file, log_paths["app"])

    if not log_path.exists():
        return {"logs": [], "total_lines": 0, "message": f"Log file not found: {log_path}"}

    # Cap lines at 1000 for performance
    lines = min(lines, 1000)

    try:
        # Read file and get last N lines (keep ANSI codes for frontend rendering)
        with open(log_path, 'r', encoding='utf-8', errors='replace') as f:
            all_lines = f.readlines()

        # Filter by level if specified
        if level:
            level = level.upper()
            all_lines = [line for line in all_lines if f"| {level}" in line]

        # Filter by search term if specified
        if search:
            search_lower = search.lower()
            all_lines = [line for line in all_lines if search_lower in line.lower()]

        # Get last N lines
        recent_lines = all_lines[-lines:]

        # Parse lines into structured format
        parsed_logs = []
        for line in recent_lines:
            line = line.strip()
            if not line:
                continue

            # Try to parse structured log format: "2026-01-27 12:00:00 | INFO     | module:func:123 - message"
            try:
                parts = line.split(" | ", 2)
                if len(parts) >= 3:
                    timestamp = parts[0]
                    log_level = parts[1].strip()
                    # Location and message are separated by " - "
                    loc_msg = parts[2]
                    if " - " in loc_msg:
                        location, message = loc_msg.split(" - ", 1)
                    else:
                        location = ""
                        message = loc_msg
                    parsed_logs.append({
                        "timestamp": timestamp,
                        "level": log_level,
                        "location": location,
                        "message": message
                    })
                else:
                    # Unparsed line
                    parsed_logs.append({
                        "timestamp": "",
                        "level": "RAW",
                        "location": "",
                        "message": line
                    })
            except Exception:
                parsed_logs.append({
                    "timestamp": "",
                    "level": "RAW",
                    "location": "",
                    "message": line
                })

        return {
            "logs": parsed_logs,
            "total_lines": len(all_lines),
            "returned_lines": len(parsed_logs)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read logs: {str(e)}")


@router.post("/admin-logs/clear/")
async def clear_admin_logs():
    """Clear the application log file"""
    import os
    from pathlib import Path

    log_path = Path("logs/isaac.log")

    if log_path.exists():
        try:
            # Truncate the file instead of deleting (keeps file handle valid)
            with open(log_path, 'w') as f:
                f.write("")
            return {"message": "Logs cleared successfully"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to clear logs: {str(e)}")

    return {"message": "No log file to clear"}


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

    # Reschedule daily digest if time was changed
    if key == "email_digest_time":
        try:
            from main import scheduler
            if scheduler:
                import asyncio
                asyncio.create_task(scheduler.schedule_daily_digest())
        except Exception as e:
            logger.warning(f"Could not reschedule daily digest: {e}")

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

    # Sync tasks to calendar (incremental - only changed items)
    push_result = await service.sync_all_tasks_to_calendar(db)

    # Sync calendar to tasks
    sync_result = await service.sync_calendar_to_tasks(db)

    return {
        "message": "Calendar sync successful",
        "calendar_name": service.calendar_name,
        "tasks_pushed": push_result.get("synced", 0),
        "tasks_deleted": push_result.get("deleted", 0),
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

    # PULL from calendar first to get phone edits before we push
    sync_result = await service.sync_calendar_to_tasks(db)

    # Then PUSH local tasks to calendar (won't overwrite since we just synced)
    push_result = await service.sync_all_tasks_to_calendar(db, calendar_uids)

    return {
        "tasks_pushed": push_result.get("synced", 0),
        "tasks_deleted": push_result.get("deleted", 0),
        "events_created": sync_result.get("created", 0),
        "events_updated": sync_result.get("updated", 0),
        "events_deleted": sync_result.get("deleted", 0),
    }
