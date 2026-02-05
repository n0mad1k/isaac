"""
Task Scheduler Service
Handles recurring tasks, reminders, and weather monitoring
"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.date import DateTrigger
from datetime import datetime, date, timedelta
from typing import List, Optional
from loguru import logger
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
import math

from config import settings
from astral import LocationInfo
from astral.sun import sun
from models.database import async_session
from models.tasks import Task, TaskRecurrence, TaskType
from models.plants import Plant
from models.livestock import Animal, AnimalType
from models.weather import WeatherAlert
from models.settings import AppSetting
from models.team import TeamMember, MemberGear, MemberGearContents, MemberTraining, MemberMedicalAppointment
from services.weather import WeatherService, NWSForecastService
from services.email import EmailService


# Module-level reference to the scheduler instance (set when instantiated)
scheduler_service: 'SchedulerService' = None


# Default settings (mirrors routers/settings.py)
DEFAULT_SETTINGS = {
    "email_alerts_enabled": "true",
    "email_daily_digest": "true",
    "email_digest_time": "06:00",
    "email_team_alerts_digest": "false",
    "email_team_alerts_time": "06:30",
    "frost_warning_temp": "35.0",
    "freeze_warning_temp": "32.0",
    "heat_warning_temp": "95.0",
    "wind_warning_speed": "25.0",
    "rain_warning_inches": "2.0",
    "cold_protection_buffer": "7",
    "default_reminder_alerts": "",  # No default alerts - users must explicitly set them
    "storage_warning_percent": "80",
    "storage_critical_percent": "95",
    "timezone": "America/New_York",
    "ai_enabled": "true",
    "ai_proactive_insights": "true",
}


async def get_setting_value(key: str) -> str:
    """Get a setting value from the database, or return default"""
    async with async_session() as db:
        result = await db.execute(
            select(AppSetting).where(AppSetting.key == key)
        )
        setting = result.scalar_one_or_none()
        if setting and setting.value is not None:
            return setting.value
        return DEFAULT_SETTINGS.get(key, "")


async def set_setting_value(key: str, value: str) -> None:
    """Set a setting value in the database"""
    async with async_session() as db:
        result = await db.execute(
            select(AppSetting).where(AppSetting.key == key)
        )
        setting = result.scalar_one_or_none()
        if setting:
            setting.value = value
        else:
            setting = AppSetting(key=key, value=value)
            db.add(setting)
        await db.commit()


async def get_timezone() -> str:
    """Get the configured timezone from database settings.
    Falls back to config.py setting if not set in database.
    """
    tz = await get_setting_value("timezone")
    if tz:
        return tz
    # Fallback to config.py setting
    return settings.timezone


def get_timezone_sync() -> str:
    """Synchronous version for contexts where async isn't available.
    Uses config.py setting as the source (which should match database).
    """
    return settings.timezone


def _get_location(lat: float, lon: float) -> LocationInfo:
    """Create an astral LocationInfo object for sun calculations"""
    import pytz
    return LocationInfo(
        name="Farm",
        region="USA",
        timezone=settings.timezone,
        latitude=lat,
        longitude=lon
    )


def calculate_sunset(lat: float, lon: float, date_obj: date = None) -> datetime:
    """Calculate sunset time for given coordinates using astral library (accurate)"""
    if date_obj is None:
        date_obj = date.today()

    import pytz
    tz = pytz.timezone(settings.timezone)
    location = _get_location(lat, lon)
    s = sun(location.observer, date=date_obj, tzinfo=tz)
    return s['sunset']


def calculate_sunrise(lat: float, lon: float, date_obj: date = None) -> datetime:
    """Calculate sunrise time for given coordinates using astral library (accurate)"""
    if date_obj is None:
        date_obj = date.today()

    import pytz
    tz = pytz.timezone(settings.timezone)
    location = _get_location(lat, lon)
    s = sun(location.observer, date=date_obj, tzinfo=tz)
    return s['sunrise']


def calculate_civil_twilight(lat: float, lon: float, date_obj: date = None, morning: bool = True) -> datetime:
    """
    Calculate civil twilight time (when sky starts to lighten / darken) using astral library.
    Civil twilight: sun is 6° below horizon - enough light to see outside without artificial light.
    """
    if date_obj is None:
        date_obj = date.today()

    import pytz
    tz = pytz.timezone(settings.timezone)
    location = _get_location(lat, lon)
    s = sun(location.observer, date=date_obj, tzinfo=tz)

    # dawn = civil twilight start (morning), dusk = civil twilight end (evening)
    if morning:
        return s['dawn']
    else:
        return s['dusk']


def calculate_moon_phase(date_obj: date = None) -> dict:
    """Calculate moon phase for a given date using simple algorithm"""
    if date_obj is None:
        date_obj = date.today()

    # Known new moon: January 6, 2000
    known_new_moon = date(2000, 1, 6)
    lunar_cycle = 29.53  # days

    # Days since known new moon
    days_since = (date_obj - known_new_moon).days
    days_into_cycle = days_since % lunar_cycle

    # Calculate illumination percentage (approximate)
    # 0 = new moon, 14.76 = full moon
    if days_into_cycle <= lunar_cycle / 2:
        illumination = (days_into_cycle / (lunar_cycle / 2)) * 100
    else:
        illumination = ((lunar_cycle - days_into_cycle) / (lunar_cycle / 2)) * 100

    # Determine phase name
    if days_into_cycle < 1.85:
        phase = "New Moon"
        emoji = "🌑"
    elif days_into_cycle < 7.38:
        phase = "Waxing Crescent"
        emoji = "🌒"
    elif days_into_cycle < 9.23:
        phase = "First Quarter"
        emoji = "🌓"
    elif days_into_cycle < 14.76:
        phase = "Waxing Gibbous"
        emoji = "🌔"
    elif days_into_cycle < 16.61:
        phase = "Full Moon"
        emoji = "🌕"
    elif days_into_cycle < 22.14:
        phase = "Waning Gibbous"
        emoji = "🌖"
    elif days_into_cycle < 23.99:
        phase = "Last Quarter"
        emoji = "🌗"
    else:
        phase = "Waning Crescent"
        emoji = "🌘"

    return {
        "phase": phase,
        "emoji": emoji,
        "illumination": round(illumination),
        "days_into_cycle": round(days_into_cycle, 1),
    }


def get_sun_moon_data(lat: float = None, lon: float = None) -> dict:
    """Get all sun/moon data for dashboard display"""
    lat = lat or settings.latitude
    lon = lon or settings.longitude

    today = date.today()

    sunrise = calculate_sunrise(lat, lon, today)
    sunset = calculate_sunset(lat, lon, today)
    moon = calculate_moon_phase(today)

    # Civil twilight - when it's light enough to see outside without artificial light
    dawn = calculate_civil_twilight(lat, lon, today, morning=True)
    dusk = calculate_civil_twilight(lat, lon, today, morning=False)

    # Calculate day length
    day_length_minutes = (sunset - sunrise).seconds // 60
    hours = day_length_minutes // 60
    minutes = day_length_minutes % 60

    import pytz
    tz = pytz.timezone(settings.timezone)
    now = datetime.now(tz)

    return {
        "sunrise": dawn.strftime("%I:%M %p").lstrip("0"),   # Civil dawn - when you can see outside
        "sunset": dusk.strftime("%I:%M %p").lstrip("0"),    # Civil dusk - when it goes dark
        "first_light": dawn.strftime("%I:%M %p").lstrip("0"),  # Same as sunrise now
        "last_light": dusk.strftime("%I:%M %p").lstrip("0"),   # Same as sunset now
        "day_length": f"{hours}h {minutes}m",
        "moon_phase": moon["phase"],
        "moon_emoji": moon["emoji"],
        "moon_illumination": moon["illumination"],
        "is_daytime": dawn <= now <= dusk,  # Daytime = when you can see
    }


class SchedulerService:
    """Background task scheduler for Isaac"""

    def __init__(self):
        global scheduler_service
        self.scheduler = AsyncIOScheduler(timezone=settings.timezone)
        self.weather_service = WeatherService()
        self.forecast_service = NWSForecastService()
        self._sunset_job_scheduled = False
        # Calendar sync health tracking
        self.last_calendar_sync_duration: float = 0
        self.last_calendar_sync_time: datetime = None
        self.last_calendar_sync_attempt: datetime = None
        self.last_calendar_sync_error: str = None
        # Set module-level reference
        scheduler_service = self

    async def get_email_service(self, db) -> EmailService:
        """Get email service configured from database settings"""
        try:
            return await EmailService.get_configured_service(db)
        except Exception as e:
            logger.warning(f"Email not configured: {e}")
            return EmailService()  # Return unconfigured service (will skip sending)

    async def start(self):
        """Start the scheduler with all jobs"""
        # Weather monitoring - every 5 minutes
        self.scheduler.add_job(
            self.poll_weather,
            IntervalTrigger(seconds=settings.weather_poll_interval),
            id="weather_poll",
            name="Poll Weather Station",
            replace_existing=True,
        )

        # Auto-watering check - every 30 minutes (decoupled from weather polling)
        self.scheduler.add_job(
            self.check_auto_watering,
            IntervalTrigger(minutes=30),
            id="auto_watering",
            name="Auto Watering Check",
            replace_existing=True,
        )

        # Daily digest email - time from settings
        await self.schedule_daily_digest()

        # Check for upcoming tasks - every hour during waking hours (6 AM - 10 PM)
        # Avoids sending email reminders at midnight/early morning
        self.scheduler.add_job(
            self.check_upcoming_tasks,
            CronTrigger(minute=0, hour='6-22'),
            id="check_tasks",
            name="Check Upcoming Tasks",
            replace_existing=True,
        )

        # Check animal care schedules - daily at 7 AM
        self.scheduler.add_job(
            self.check_animal_schedules,
            CronTrigger(hour=7, minute=0),
            id="check_animals",
            name="Check Animal Care Schedules",
            replace_existing=True,
        )

        # Sync maintenance reminders - daily at 7:30 AM and when maintenance is modified
        self.scheduler.add_job(
            self.sync_maintenance_reminders,
            CronTrigger(hour=7, minute=30),
            id="sync_maintenance",
            name="Sync Maintenance Reminders",
            replace_existing=True,
        )

        # Generate recurring tasks - daily at midnight
        self.scheduler.add_job(
            self.generate_recurring_tasks,
            CronTrigger(hour=0, minute=5),
            id="generate_recurring",
            name="Generate Recurring Tasks",
            replace_existing=True,
        )

        # Auto-complete past events - daily at 00:10
        self.scheduler.add_job(
            self.auto_complete_past_events,
            CronTrigger(hour=0, minute=10),
            id="auto_complete_events",
            name="Auto-Complete Past Events",
            replace_existing=True,
        )

        # Schedule sunset cold protection check - runs at noon to schedule for today
        self.scheduler.add_job(
            self.schedule_sunset_reminder,
            CronTrigger(hour=12, minute=0),
            id="schedule_sunset_reminder",
            name="Schedule Sunset Cold Protection Reminder",
            replace_existing=True,
        )

        # Schedule calendar sync - check if enabled and set interval
        await self.schedule_calendar_sync()

        # Check reminder alerts - every 5 minutes
        self.scheduler.add_job(
            self.check_reminder_alerts,
            IntervalTrigger(minutes=5),
            id="check_reminder_alerts",
            name="Check Reminder Alerts",
            replace_existing=True,
        )

        # Check storage usage - every hour
        self.scheduler.add_job(
            self.check_storage_usage,
            CronTrigger(minute=15),  # Every hour at :15
            id="check_storage",
            name="Check Storage Usage",
            replace_existing=True,
        )

        # Cleanup old weather data - daily at 3 AM
        self.scheduler.add_job(
            self.cleanup_weather_data,
            CronTrigger(hour=3, minute=0),
            id="cleanup_weather",
            name="Cleanup Old Weather Data",
            replace_existing=True,
        )

        # Cleanup old completed tasks - daily at 3:30 AM (1 year retention)
        self.scheduler.add_job(
            self.cleanup_old_tasks,
            CronTrigger(hour=3, minute=30),
            id="cleanup_tasks",
            name="Cleanup Old Completed Tasks",
            replace_existing=True,
        )

        # Cleanup old health data - daily at 4 AM (2 year retention)
        self.scheduler.add_job(
            self.cleanup_old_health_data,
            CronTrigger(hour=4, minute=0),
            id="cleanup_health_data",
            name="Cleanup Old Health Data",
            replace_existing=True,
        )

        # Health monitoring - every 5 minutes
        self.scheduler.add_job(
            self.run_health_check,
            IntervalTrigger(minutes=5),
            id="health_check",
            name="Health Monitor",
            replace_existing=True,
        )

        # Budget transaction archival - runs on 1st and 15th at 1 AM
        self.scheduler.add_job(
            self.archive_budget_transactions,
            CronTrigger(day="1,15", hour=1, minute=0),
            id="budget_archive",
            name="Archive Budget Transactions",
            replace_existing=True,
        )

        # Update gear content statuses - daily at 5 AM
        self.scheduler.add_job(
            self.update_gear_statuses,
            CronTrigger(hour=5, minute=0),
            id="update_gear_statuses",
            name="Update Gear Content Statuses",
            replace_existing=True,
        )

        # AI Insight jobs (gated by ai_proactive_insights setting)
        await self.schedule_ai_insights()

        self.scheduler.start()
        logger.info("Scheduler started with all jobs")

        # Run startup tasks
        await self.schedule_sunset_reminder()  # Schedule today's sunset reminder if needed
        await self.auto_complete_past_events()  # Clean up any past events on startup

    async def schedule_ai_insights(self):
        """Schedule AI insight generation jobs if enabled"""
        ai_enabled = await get_setting_value("ai_enabled")
        insights_enabled = await get_setting_value("ai_proactive_insights")

        if ai_enabled != "true" or insights_enabled != "true":
            logger.debug("AI insights disabled, skipping scheduler registration")
            return

        from services.ai_insights import (
            generate_morning_digest,
            generate_weekly_fitness_review,
            generate_monthly_garden_review,
            generate_weekly_budget_review,
            cleanup_expired_insights,
        )

        # Morning digest - daily at 6 AM
        self.scheduler.add_job(
            generate_morning_digest,
            CronTrigger(hour=6, minute=0),
            id="ai_morning_digest",
            name="AI Morning Digest",
            replace_existing=True,
        )

        # Weekly fitness review - Monday at 7 AM
        self.scheduler.add_job(
            generate_weekly_fitness_review,
            CronTrigger(day_of_week="mon", hour=7, minute=0),
            id="ai_weekly_fitness",
            name="AI Weekly Fitness Review",
            replace_existing=True,
        )

        # Monthly garden review - 1st of month at 8 AM
        self.scheduler.add_job(
            generate_monthly_garden_review,
            CronTrigger(day=1, hour=8, minute=0),
            id="ai_monthly_garden",
            name="AI Monthly Garden Review",
            replace_existing=True,
        )

        # Weekly budget review - Sunday at 9 AM
        self.scheduler.add_job(
            generate_weekly_budget_review,
            CronTrigger(day_of_week="sun", hour=9, minute=0),
            id="ai_weekly_budget",
            name="AI Weekly Budget Review",
            replace_existing=True,
        )

        # Cleanup expired insights - daily at 3:15 AM
        self.scheduler.add_job(
            cleanup_expired_insights,
            CronTrigger(hour=3, minute=15),
            id="ai_cleanup_insights",
            name="AI Cleanup Expired Insights",
            replace_existing=True,
        )

        logger.info("AI insight jobs scheduled")

    async def schedule_calendar_sync(self):
        """Schedule calendar sync if enabled - runs every 10 minutes"""
        calendar_enabled = await get_setting_value("calendar_enabled")
        if calendar_enabled != "true":
            logger.debug("Calendar sync is disabled")
            return

        # Frequent sync every 10 minutes for near real-time phone sync
        # Run first sync immediately (30s delay), then every 10 minutes
        self.scheduler.add_job(
            self.sync_calendar,
            IntervalTrigger(minutes=10),
            id="calendar_sync_interval",
            name="Calendar Sync (every 10 min)",
            replace_existing=True,
            next_run_time=datetime.now() + timedelta(seconds=30),
        )
        logger.info("Calendar sync scheduled: first run in 30s, then every 10 minutes")

    async def sync_calendar(self):
        """Perform bi-directional calendar sync"""
        from services.calendar_sync import get_calendar_service
        import time

        start_time = time.time()
        self.last_calendar_sync_attempt = datetime.utcnow()
        self.last_calendar_sync_error = None

        try:
            async with async_session() as db:
                service = await get_calendar_service(db)
                if not service:
                    self.last_calendar_sync_error = "Calendar service not configured"
                    return

                if not service.connect():
                    self.last_calendar_sync_error = "Failed to connect to calendar"
                    logger.error("Failed to connect to calendar for sync")
                    return

                # Get current calendar events to detect phone-side deletions
                events = await service.get_calendar_events()
                calendar_uids = set()
                for event_dict in events:
                    uid = event_dict.get('calendar_uid')
                    if uid:
                        calendar_uids.add(uid)

                # Sync both directions - PULL from calendar first to get phone edits,
                # then PUSH to calendar (which won't overwrite since data is now in sync)
                events_synced = await service.sync_calendar_to_tasks(db)
                tasks_synced = await service.sync_all_tasks_to_calendar(db, calendar_uids)

                duration = time.time() - start_time
                # Store sync stats for health monitoring (use UTC for consistency with health check)
                self.last_calendar_sync_duration = duration
                self.last_calendar_sync_time = datetime.utcnow()

                if duration > 60:
                    logger.warning(f"Calendar sync slow: {duration:.1f}s - {tasks_synced} tasks, {events_synced} events")
                else:
                    logger.info(f"Calendar sync complete in {duration:.1f}s: {tasks_synced} tasks synced, {events_synced} events imported")

        except Exception as e:
            self.last_calendar_sync_error = str(e)[:100]
            logger.error(f"Calendar sync failed: {e}")

    async def schedule_daily_digest(self):
        """Schedule the daily digest email based on settings"""
        import pytz

        digest_time = await get_setting_value("email_digest_time")
        try:
            hour, minute = map(int, digest_time.split(":"))
        except (ValueError, AttributeError):
            hour, minute = 6, 0  # Default fallback

        self.scheduler.add_job(
            self.send_daily_digest,
            CronTrigger(hour=hour, minute=minute),
            id="daily_digest",
            name=f"Send Daily Digest ({hour:02d}:{minute:02d})",
            replace_existing=True,
        )
        logger.info(f"Daily digest scheduled for {hour:02d}:{minute:02d}")

        # Check if we missed today's digest (service started after scheduled time)
        tz = pytz.timezone(settings.timezone)
        now = datetime.now(tz)
        scheduled_time = now.replace(hour=hour, minute=minute, second=0, microsecond=0)

        # Calculate cutoff: 6 hours after scheduled time (e.g., if digest at 6am, cutoff at noon)
        # This gives a reasonable window to catch up without sending digest in the evening
        catchup_cutoff = scheduled_time + timedelta(hours=6)

        # Skip catchup if within 2 minutes of scheduled time (cron job will handle it)
        # This prevents race condition where both cron and catchup fire simultaneously
        grace_period = scheduled_time + timedelta(minutes=2)

        # If current time is past grace period but before cutoff, try to send
        # (send_daily_digest will handle deduplication internally)
        if grace_period < now < catchup_cutoff:
            logger.info(f"Missed daily digest time ({hour:02d}:{minute:02d}), attempting catchup...")
            await self.send_daily_digest()

        # Schedule team alerts digest - runs 30 minutes after daily digest
        # This separate email only sends if there are team alerts to report
        team_alerts_enabled = await get_setting_value("email_team_alerts_digest")
        if team_alerts_enabled == "true":
            team_alerts_time = await get_setting_value("email_team_alerts_time")
            try:
                ta_hour, ta_minute = map(int, team_alerts_time.split(":"))
            except (ValueError, AttributeError):
                # Default to 30 minutes after daily digest
                ta_hour = hour
                ta_minute = minute + 30
                if ta_minute >= 60:
                    ta_minute -= 60
                    ta_hour = (ta_hour + 1) % 24

            self.scheduler.add_job(
                self.send_team_alerts_digest,
                CronTrigger(hour=ta_hour, minute=ta_minute),
                id="team_alerts_digest",
                name=f"Send Team Alerts Digest ({ta_hour:02d}:{ta_minute:02d})",
                replace_existing=True,
            )
            logger.info(f"Team alerts digest scheduled for {ta_hour:02d}:{ta_minute:02d}")

            # Check if we missed today's team alerts (similar catchup logic)
            ta_scheduled_time = now.replace(hour=ta_hour, minute=ta_minute, second=0, microsecond=0)
            ta_catchup_cutoff = ta_scheduled_time + timedelta(hours=6)
            ta_grace_period = ta_scheduled_time + timedelta(minutes=2)

            if ta_grace_period < now < ta_catchup_cutoff:
                logger.info(f"Missed team alerts digest time ({ta_hour:02d}:{ta_minute:02d}), attempting catchup...")
                await self.send_team_alerts_digest()

    async def stop(self):
        """Stop the scheduler"""
        self.scheduler.shutdown()
        await self.weather_service.close()
        logger.info("Scheduler stopped")

    async def poll_weather(self):
        """Fetch and store current weather, check for alerts"""
        logger.debug("Polling weather station...")
        try:
            data = await self.weather_service.fetch_current_weather()
            if data:
                async with async_session() as db:
                    reading = await self.weather_service.save_reading(db, data)
                    # Check for alerts (creates dashboard alerts, email handled by sunset scheduler)
                    await self.weather_service.check_alerts(db, reading)
        except Exception as e:
            logger.error(f"Error polling weather: {e}")

    async def check_auto_watering(self):
        """Check plants for rain/sprinkler watering decisions (runs every 30 min)"""
        try:
            from services.auto_watering import run_auto_watering_check
            async with async_session() as db:
                watering_stats = await run_auto_watering_check(db)
                if watering_stats.get("rain_skipped") or watering_stats.get("sprinkler_watered"):
                    logger.info(f"Auto watering: {watering_stats}")
        except Exception as e:
            logger.error(f"Error in auto-watering check: {e}")

    async def send_daily_digest(self):
        """Send daily digest email with verse of the day, tasks and weather"""
        import pytz
        from sqlalchemy import update

        # Skip digest on dev instances to avoid duplicate emails
        # Double-check by also verifying the config value directly
        if settings.is_dev_instance:
            logger.info("Skipping daily digest on dev instance (is_dev_instance=True)")
            return

        # Check if daily digest is enabled
        digest_enabled = await get_setting_value("email_daily_digest")
        if digest_enabled != "true":
            logger.info("Daily digest is disabled in settings, skipping")
            return

        # Get recipient email (fall back to general alert recipients)
        recipient = await get_setting_value("email_digest_recipient")
        if not recipient:
            recipient = await get_setting_value("email_recipients")
            if recipient:
                # Use first email from comma-separated list
                recipient = recipient.split(",")[0].strip()
        if not recipient:
            logger.warning("Daily digest recipient not configured, skipping")
            return

        # Atomic check-and-set to prevent duplicate sends
        tz = pytz.timezone(settings.timezone)
        today_str = datetime.now(tz).strftime("%Y-%m-%d")

        async with async_session() as db:
            # Use atomic UPDATE with WHERE clause - only succeeds if value != today
            # This prevents race conditions between multiple processes
            from sqlalchemy import update, insert
            from sqlalchemy.dialects.sqlite import insert as sqlite_insert

            # First try to update existing row (only if not already today)
            result = await db.execute(
                update(AppSetting)
                .where(AppSetting.key == "_last_digest_date")
                .where(AppSetting.value != today_str)
                .values(value=today_str)
            )

            if result.rowcount == 0:
                # Either already sent today, or row doesn't exist
                # Check which case
                check = await db.execute(
                    select(AppSetting).where(AppSetting.key == "_last_digest_date")
                )
                existing = check.scalar_one_or_none()

                if existing:
                    # Row exists with today's date - already sent
                    logger.info(f"Daily digest already sent today ({today_str}), skipping duplicate")
                    return
                else:
                    # Row doesn't exist - try to insert (with conflict handling)
                    try:
                        db.add(AppSetting(key="_last_digest_date", value=today_str))
                        await db.commit()
                    except Exception:
                        # Another process inserted first - check if it's today
                        await db.rollback()
                        recheck = await db.execute(
                            select(AppSetting).where(AppSetting.key == "_last_digest_date")
                        )
                        if recheck.scalar_one_or_none():
                            logger.info(f"Daily digest already sent today ({today_str}), skipping duplicate")
                            return
            else:
                await db.commit()

            logger.info(f"Claimed daily digest send for {today_str}")

        logger.info(f"Sending daily digest to {recipient}...")
        try:
            async with async_session() as db:
                # Get verse of the day
                import httpx
                import re
                verse = None
                try:
                    async with httpx.AsyncClient() as client:
                        response = await client.get(
                            "https://www.bible.com/verse-of-the-day",
                            timeout=10.0,
                            follow_redirects=True
                        )
                        response.raise_for_status()
                        html_content = response.text
                        match = re.search(r'og:description" content="([^"]+)"', html_content, re.DOTALL)
                        if match:
                            content = match.group(1).replace('\n', ' ').strip()
                            # Match reference followed by optional quote and text
                            ref_match = re.match(r'^([\d\s]*[A-Za-z]+\s+\d+:\d+(?:-\d+)?)\s*["\u201c]?(.+?)["\u201d]?$', content)
                            if ref_match:
                                verse = {
                                    "reference": ref_match.group(1).strip(),
                                    "text": ref_match.group(2).strip().strip('"'),
                                    "version": "NIV"
                                }
                            else:
                                # Fallback: split on first space after reference pattern
                                parts = content.split(' ', 2)
                                if len(parts) >= 2:
                                    verse = {
                                        "reference": parts[0] + ' ' + parts[1] if ':' in parts[1] else parts[0],
                                        "text": ' '.join(parts[1:]) if ':' not in parts[1] else parts[2] if len(parts) > 2 else '',
                                        "version": "NIV"
                                    }
                except Exception as e:
                    logger.warning(f"Failed to fetch verse of the day: {e}")

                if not verse:
                    verse = {
                        "reference": "Psalm 104:14",
                        "text": "He causes the grass to grow for the cattle, and vegetation for the service of man, that he may bring forth food from the earth.",
                        "version": "NIV"
                    }

                # Get today's tasks: due today, overdue, or dateless (all "due today")
                # Exclude backlog items and worker-assigned tasks - they shouldn't appear in digest
                today = date.today()
                result = await db.execute(
                    select(Task)
                    .where(
                        or_(
                            Task.due_date == today,  # Due today only
                            Task.due_date.is_(None)  # Dateless reminders
                        )
                    )
                    .where(Task.is_completed == False)
                    .where(Task.is_active == True)
                    .where(or_(Task.is_backlog == False, Task.is_backlog.is_(None)))
                    .where(Task.assigned_to_worker_id.is_(None))  # Exclude worker tasks
                    .order_by(Task.priority)
                )
                tasks = result.scalars().all()

                # Also get overdue TODOs (due before today, not backlog, not worker-assigned)
                # EVENTs cannot be overdue - once the date passes, they're just past events
                overdue_result = await db.execute(
                    select(Task)
                    .where(Task.due_date < today)
                    .where(Task.task_type != TaskType.EVENT)  # Only TODOs can be overdue
                    .where(Task.is_completed == False)
                    .where(Task.is_active == True)
                    .where(or_(Task.is_backlog == False, Task.is_backlog.is_(None)))
                    .where(Task.assigned_to_worker_id.is_(None))  # Exclude worker tasks
                    .order_by(Task.due_date, Task.priority)
                )
                overdue_tasks = overdue_result.scalars().all()

                # Combine: overdue TODOs first, then today's tasks/events
                tasks = list(overdue_tasks) + list(tasks)

                # Get today's forecast from NWS
                weather = {}
                try:
                    forecasts = await self.forecast_service.get_forecast_simple()
                    if forecasts and len(forecasts) > 0:
                        # When digest runs early morning, the first period may be
                        # nighttime (Tonight/Overnight) with high=None. Check the
                        # first two entries to find both high and low for today.
                        high = None
                        low = None
                        conditions = ""
                        rain_chance = 0
                        for f in forecasts[:2]:
                            if f.get("high") is not None and high is None:
                                high = f["high"]
                                conditions = f.get("forecast", conditions)
                            if f.get("low") is not None and low is None:
                                low = f["low"]
                            rain_chance = max(rain_chance, f.get("rain_chance", 0))
                        weather = {
                            "high": high,
                            "low": low,
                            "conditions": conditions or forecasts[0].get("forecast", ""),
                            "rain_chance": rain_chance,
                        }
                except Exception as e:
                    logger.warning(f"Failed to fetch forecast: {e}")

                # Get active alerts
                result = await db.execute(
                    select(WeatherAlert)
                    .where(WeatherAlert.is_active == True)
                    .where(
                        or_(
                            WeatherAlert.expires_at > datetime.utcnow(),
                            WeatherAlert.expires_at.is_(None),
                        )
                    )
                )
                alerts = result.scalars().all()

                # Format for email
                task_dicts = [
                    {
                        "title": t.title,
                        "description": t.description,
                        "priority": t.priority,
                        "category": t.category.value if t.category else None,
                        "due_time": t.due_time,
                    }
                    for t in tasks
                ]

                alert_dicts = [
                    {
                        "title": a.title,
                        "message": a.message,
                        "severity": a.severity.value,
                    }
                    for a in alerts
                ]

                # Get team alerts: gear below min, expiring items, overdue training/medical
                team_alerts = []
                try:
                    # Get all active gear contents with their gear and member info
                    from sqlalchemy.orm import joinedload
                    gear_contents_result = await db.execute(
                        select(MemberGearContents)
                        .join(MemberGear)
                        .join(TeamMember)
                        .options(joinedload(MemberGearContents.gear).joinedload(MemberGear.member))
                        .where(MemberGearContents.is_active == True)
                        .where(MemberGear.is_active == True)
                        .where(TeamMember.is_active == True)
                    )
                    all_gear_contents = gear_contents_result.scalars().unique().all()

                    for content in all_gear_contents:
                        member_name = content.gear.member.name if content.gear.member else "Unknown"

                        # Check for low stock
                        if content.min_quantity and content.quantity < content.min_quantity:
                            team_alerts.append({
                                "type": "low_stock",
                                "member": member_name,
                                "item": content.item_name,
                                "message": f"Below minimum: {content.quantity} / {content.min_quantity} ({content.gear.gear_name})"
                            })

                        # Check for expiring items
                        if content.expiration_date:
                            alert_days = content.expiration_alert_days or 30
                            alert_threshold = datetime.now() + timedelta(days=alert_days)
                            if content.expiration_date <= datetime.now():
                                team_alerts.append({
                                    "type": "expired",
                                    "member": member_name,
                                    "item": content.item_name,
                                    "message": f"EXPIRED on {content.expiration_date.strftime('%m/%d/%Y')} ({content.gear.gear_name})"
                                })
                            elif content.expiration_date <= alert_threshold:
                                days_left = (content.expiration_date - datetime.now()).days
                                team_alerts.append({
                                    "type": "expiring",
                                    "member": member_name,
                                    "item": content.item_name,
                                    "message": f"Expires in {days_left} days on {content.expiration_date.strftime('%m/%d/%Y')} ({content.gear.gear_name})"
                                })

                    # Check for overdue training
                    training_result = await db.execute(
                        select(MemberTraining)
                        .join(TeamMember)
                        .options(joinedload(MemberTraining.member))
                        .where(MemberTraining.is_active == True)
                        .where(TeamMember.is_active == True)
                        .where(MemberTraining.next_due.isnot(None))
                        .where(MemberTraining.next_due < datetime.now())
                    )
                    overdue_training = training_result.scalars().unique().all()

                    for training in overdue_training:
                        member_name = training.member.name if training.member else "Unknown"
                        days_overdue = (datetime.now() - training.next_due).days
                        team_alerts.append({
                            "type": "expired",
                            "member": member_name,
                            "item": f"Training: {training.name}",
                            "message": f"Overdue by {days_overdue} days (due {training.next_due.strftime('%m/%d/%Y')})"
                        })

                    # Check for overdue medical appointments
                    medical_result = await db.execute(
                        select(MemberMedicalAppointment)
                        .join(TeamMember)
                        .options(joinedload(MemberMedicalAppointment.member))
                        .where(MemberMedicalAppointment.is_active == True)
                        .where(TeamMember.is_active == True)
                        .where(MemberMedicalAppointment.next_due.isnot(None))
                        .where(MemberMedicalAppointment.next_due < datetime.now())
                    )
                    overdue_medical = medical_result.scalars().unique().all()

                    for appt in overdue_medical:
                        member_name = appt.member.name if appt.member else "Unknown"
                        type_name = appt.custom_type_name if appt.appointment_type.value == "custom" else appt.appointment_type.value.replace("_", " ").title()
                        days_overdue = (datetime.now() - appt.next_due).days
                        team_alerts.append({
                            "type": "expired",
                            "member": member_name,
                            "item": f"Appointment: {type_name}",
                            "message": f"Overdue by {days_overdue} days (due {appt.next_due.strftime('%m/%d/%Y')})"
                        })

                except Exception as e:
                    logger.warning(f"Failed to gather team alerts for daily digest: {e}")

                # Get configured email service from database
                email_service = await self.get_email_service(db)
                await email_service.send_daily_digest(
                    tasks=task_dicts,
                    weather=weather,
                    alerts=alert_dicts,
                    recipient=recipient,
                    verse=verse,
                    team_alerts=team_alerts if team_alerts else None,
                )
        except Exception as e:
            logger.error(f"Error sending daily digest: {e}")

    async def send_team_alerts_digest(self):
        """Send a separate daily email with team alerts (gear, training, medical).

        This runs separately from the main daily digest and ONLY sends if there
        are alerts to report. This allows users to get focused attention on
        team readiness issues.
        """
        import pytz

        # Skip on dev instances to avoid duplicate emails
        if settings.is_dev_instance:
            logger.info("Skipping team alerts digest on dev instance (is_dev_instance=True)")
            return

        # Check if team alerts digest is enabled
        team_alerts_enabled = await get_setting_value("email_team_alerts_digest")
        if team_alerts_enabled != "true":
            logger.info("Team alerts digest is disabled in settings, skipping")
            return

        # Get recipient email (fall back to general alert recipients)
        recipient = await get_setting_value("email_team_alerts_recipient")
        if not recipient:
            recipient = await get_setting_value("email_recipients")
            if recipient:
                # Use first email from comma-separated list
                recipient = recipient.split(",")[0].strip()
        if not recipient:
            logger.warning("Team alerts digest recipient not configured, skipping")
            return

        # Atomic check-and-set to prevent duplicate sends
        tz = pytz.timezone(settings.timezone)
        today_str = datetime.now(tz).strftime("%Y-%m-%d")

        async with async_session() as db:
            # Use atomic UPDATE with WHERE clause
            from sqlalchemy import update

            result = await db.execute(
                update(AppSetting)
                .where(AppSetting.key == "_last_team_alerts_date")
                .where(AppSetting.value != today_str)
                .values(value=today_str)
            )

            if result.rowcount == 0:
                # Either already sent today, or row doesn't exist
                check = await db.execute(
                    select(AppSetting).where(AppSetting.key == "_last_team_alerts_date")
                )
                existing = check.scalar_one_or_none()

                if existing:
                    logger.info(f"Team alerts digest already sent today ({today_str}), skipping duplicate")
                    return
                else:
                    # Row doesn't exist - try to insert
                    try:
                        db.add(AppSetting(key="_last_team_alerts_date", value=today_str))
                        await db.commit()
                    except Exception:
                        await db.rollback()
                        recheck = await db.execute(
                            select(AppSetting).where(AppSetting.key == "_last_team_alerts_date")
                        )
                        if recheck.scalar_one_or_none():
                            logger.info(f"Team alerts digest already sent today ({today_str}), skipping duplicate")
                            return
            else:
                await db.commit()

            logger.info(f"Claimed team alerts digest send for {today_str}")

        logger.info(f"Checking for team alerts to send to {recipient}...")
        try:
            async with async_session() as db:
                from sqlalchemy.orm import joinedload

                gear_alerts = []
                training_alerts = []
                medical_alerts = []

                # Get all active gear contents with their gear and member info
                gear_contents_result = await db.execute(
                    select(MemberGearContents)
                    .join(MemberGear)
                    .join(TeamMember)
                    .options(joinedload(MemberGearContents.gear).joinedload(MemberGear.member))
                    .where(MemberGearContents.is_active == True)
                    .where(MemberGear.is_active == True)
                    .where(TeamMember.is_active == True)
                )
                all_gear_contents = gear_contents_result.scalars().unique().all()

                for content in all_gear_contents:
                    member_name = content.gear.member.name if content.gear.member else "Unknown"

                    # Check for low stock
                    if content.min_quantity and content.quantity < content.min_quantity:
                        gear_alerts.append({
                            "type": "low_stock",
                            "member": member_name,
                            "item": content.item_name,
                            "message": f"Below minimum: {content.quantity} / {content.min_quantity} ({content.gear.gear_name})"
                        })

                    # Check for expiring items
                    if content.expiration_date:
                        alert_days = content.expiration_alert_days or 30
                        alert_threshold = datetime.now() + timedelta(days=alert_days)
                        if content.expiration_date <= datetime.now():
                            gear_alerts.append({
                                "type": "expired",
                                "member": member_name,
                                "item": content.item_name,
                                "message": f"EXPIRED on {content.expiration_date.strftime('%m/%d/%Y')} ({content.gear.gear_name})"
                            })
                        elif content.expiration_date <= alert_threshold:
                            days_left = (content.expiration_date - datetime.now()).days
                            gear_alerts.append({
                                "type": "expiring",
                                "member": member_name,
                                "item": content.item_name,
                                "message": f"Expires in {days_left} days on {content.expiration_date.strftime('%m/%d/%Y')} ({content.gear.gear_name})"
                            })

                # Check for overdue training
                training_result = await db.execute(
                    select(MemberTraining)
                    .join(TeamMember)
                    .options(joinedload(MemberTraining.member))
                    .where(MemberTraining.is_active == True)
                    .where(TeamMember.is_active == True)
                    .where(MemberTraining.next_due.isnot(None))
                    .where(MemberTraining.next_due < datetime.now())
                )
                overdue_training = training_result.scalars().unique().all()

                for training in overdue_training:
                    member_name = training.member.name if training.member else "Unknown"
                    days_overdue = (datetime.now() - training.next_due).days
                    training_alerts.append({
                        "type": "expired",
                        "member": member_name,
                        "item": f"Training: {training.name}",
                        "message": f"Overdue by {days_overdue} days (due {training.next_due.strftime('%m/%d/%Y')})"
                    })

                # Check for overdue medical appointments
                medical_result = await db.execute(
                    select(MemberMedicalAppointment)
                    .join(TeamMember)
                    .options(joinedload(MemberMedicalAppointment.member))
                    .where(MemberMedicalAppointment.is_active == True)
                    .where(TeamMember.is_active == True)
                    .where(MemberMedicalAppointment.next_due.isnot(None))
                    .where(MemberMedicalAppointment.next_due < datetime.now())
                )
                overdue_medical = medical_result.scalars().unique().all()

                for appt in overdue_medical:
                    member_name = appt.member.name if appt.member else "Unknown"
                    type_name = appt.custom_type_name if appt.appointment_type.value == "custom" else appt.appointment_type.value.replace("_", " ").title()
                    days_overdue = (datetime.now() - appt.next_due).days
                    medical_alerts.append({
                        "type": "expired",
                        "member": member_name,
                        "item": f"Appointment: {type_name}",
                        "message": f"Overdue by {days_overdue} days (due {appt.next_due.strftime('%m/%d/%Y')})"
                    })

                # Only send if there are alerts
                total_alerts = len(gear_alerts) + len(training_alerts) + len(medical_alerts)
                if total_alerts == 0:
                    logger.info("No team alerts to send today")
                    return

                logger.info(f"Sending team alerts digest: {len(gear_alerts)} gear, {len(training_alerts)} training, {len(medical_alerts)} medical")

                # Get configured email service from database
                email_service = await self.get_email_service(db)
                await email_service.send_team_alerts_digest(
                    recipient=recipient,
                    gear_alerts=gear_alerts if gear_alerts else None,
                    training_alerts=training_alerts if training_alerts else None,
                    medical_alerts=medical_alerts if medical_alerts else None,
                )
        except Exception as e:
            logger.error(f"Error sending team alerts digest: {e}")

    async def check_upcoming_tasks(self):
        """Check for tasks due soon and send reminders"""
        # Skip on dev instances to avoid duplicate emails
        if settings.is_dev_instance:
            logger.debug("Skipping upcoming task reminders on dev instance")
            return

        logger.debug("Checking upcoming tasks...")
        try:
            async with async_session() as db:
                # Find tasks due today or tomorrow that haven't been notified
                # Only today and tomorrow - NOT overdue/past tasks
                today = date.today()
                tomorrow = today + timedelta(days=1)
                result = await db.execute(
                    select(Task)
                    .where(Task.due_date >= today)
                    .where(Task.due_date <= tomorrow)
                    .where(Task.is_completed == False)
                    .where(Task.is_active == True)
                    .where(Task.notify_email == True)
                    .where(
                        or_(
                            Task.last_notified.is_(None),
                            Task.last_notified < datetime.utcnow() - timedelta(hours=23),
                        )
                    )
                )
                tasks = result.scalars().all()

                email_service = await self.get_email_service(db)
                recipients = await get_setting_value("email_recipients")
                if not recipients:
                    logger.debug("No email recipients configured, skipping task reminders")
                    return

                sent_count = 0
                for task in tasks:
                    # Skip tasks with a specific due_time - they should use the
                    # check_reminder_alerts system instead (which respects reminder_alerts settings).
                    # This prevents generic "upcoming task" emails for timed events hours before they're due.
                    if task.due_time and task.due_time != "00:00":
                        continue

                    # Determine the correct recipient for this task
                    task_recipients = recipients
                    if task.assigned_to_worker_id:
                        # Worker tasks only go to worker's email, NOT global recipients
                        from models.workers import Worker
                        worker_result = await db.execute(
                            select(Worker).where(Worker.id == task.assigned_to_worker_id)
                        )
                        worker = worker_result.scalar_one_or_none()
                        if worker and worker.email:
                            task_recipients = worker.email
                        else:
                            # No worker email on file - skip this task entirely
                            continue

                    # Atomic update: only proceed if last_notified hasn't changed
                    from sqlalchemy import update
                    result = await db.execute(
                        update(Task)
                        .where(Task.id == task.id)
                        .where(
                            or_(
                                Task.last_notified.is_(None),
                                Task.last_notified < datetime.utcnow() - timedelta(hours=23),
                            )
                        )
                        .values(last_notified=datetime.utcnow())
                    )
                    if result.rowcount == 0:
                        # Another process already claimed this task
                        continue

                    await db.commit()

                    # Now safe to send - we've claimed this task
                    await email_service.send_task_reminder({
                        "title": task.title,
                        "description": task.description,
                        "due_date": task.due_date,
                        "category": task.category.value if task.category else "General",
                        "notes": task.notes,
                    }, to=task_recipients)
                    sent_count += 1

                if sent_count:
                    logger.info(f"Sent {sent_count} task reminders")
        except Exception as e:
            logger.error(f"Error checking upcoming tasks: {e}")

    async def check_animal_schedules(self):
        """Check for animals needing care and sync care schedules to tasks"""
        # Skip email reminders on dev instances to avoid duplicates
        if settings.is_dev_instance:
            logger.debug("Skipping animal care email reminders on dev instance")
            return

        logger.debug("Checking animal care schedules...")
        try:
            from services.auto_reminders import sync_all_animal_reminders

            async with async_session() as db:
                today = date.today()
                week_ahead = today + timedelta(days=7)

                # Sync all animal care schedules to calendar/tasks
                stats = await sync_all_animal_reminders(db)
                logger.info(f"Animal care schedule sync: {stats}")

                email_service = await self.get_email_service(db)
                recipients = await get_setting_value("email_recipients")
                if not recipients:
                    logger.debug("No email recipients configured, skipping animal schedule emails")
                    return

                # Check horses for farrier (legacy - for email alerts)
                # Note: next_farrier_date may not exist on all Animal records
                try:
                    result = await db.execute(
                        select(Animal)
                        .where(Animal.animal_type == AnimalType.HORSE)
                        .where(Animal.is_active == True)
                        .where(Animal.next_farrier_date.isnot(None))
                        .where(Animal.next_farrier_date <= week_ahead)
                    )
                    horses_need_farrier = result.scalars().all()

                    for horse in horses_need_farrier:
                        days_until = (horse.next_farrier_date - today).days
                        await email_service.send_task_reminder({
                            "title": f"Farrier needed for {horse.name}",
                            "description": f"{horse.name} is due for hoof trimming",
                            "due_date": horse.next_farrier_date,
                            "category": "Animal Care",
                            "notes": f"Due in {days_until} days" if days_until > 0 else "Overdue!",
                        }, to=recipients)
                except Exception as e:
                    logger.warning(f"Skipping farrier check (column may not exist): {e}")

                # Check all animals for worming
                try:
                    result = await db.execute(
                        select(Animal)
                        .where(Animal.is_active == True)
                        .where(Animal.next_worming_date.isnot(None))
                        .where(Animal.next_worming_date <= week_ahead)
                    )
                    animals_need_worming = result.scalars().all()

                    for animal in animals_need_worming:
                        days_until = (animal.next_worming_date - today).days
                        await email_service.send_task_reminder({
                            "title": f"Worming due for {animal.name}",
                            "description": f"{animal.name} ({animal.animal_type.value}) needs worming",
                            "due_date": animal.next_worming_date,
                            "category": "Animal Care",
                            "notes": f"Rotation: {animal.wormer_rotation}" if animal.wormer_rotation else "",
                        }, to=recipients)
                except Exception as e:
                    logger.warning(f"Skipping worming check (column may not exist): {e}")

                # Check cattle for slaughter scheduling
                try:
                    result = await db.execute(
                        select(Animal)
                        .where(Animal.animal_type == AnimalType.CATTLE)
                        .where(Animal.is_active == True)
                        .where(Animal.estimated_slaughter_date.isnot(None))
                        .where(Animal.estimated_slaughter_date <= today + timedelta(days=30))
                    )
                    cattle_ready = result.scalars().all()

                    for steer in cattle_ready:
                        days_until = (steer.estimated_slaughter_date - today).days
                        await email_service.send_task_reminder({
                            "title": f"Schedule slaughter for {steer.name}",
                            "description": f"Steer {steer.name} approaching target date",
                            "due_date": steer.estimated_slaughter_date,
                            "category": "Animal Care",
                            "notes": f"Processor: {steer.processor}" if steer.processor else "Contact processor to schedule",
                        }, to=recipients)
                except Exception as e:
                    logger.warning(f"Skipping slaughter check (column may not exist): {e}")

        except Exception as e:
            logger.error(f"Error checking animal schedules: {e}")

    async def generate_recurring_tasks(self):
        """Generate task instances for recurring tasks"""
        logger.debug("Generating recurring tasks...")
        try:
            async with async_session() as db:
                today = date.today()

                # Safety net: Reactivate recurring tasks deactivated in the last 48 hours
                # The CalDAV sync could incorrectly mark recycled tasks as "deleted on phone".
                # Only reactivate if no active duplicate exists (same title + same recurrence).
                cutoff = today - timedelta(days=2)
                fix_result = await db.execute(
                    select(Task)
                    .where(Task.is_active == False)
                    .where(Task.recurrence != TaskRecurrence.ONCE)
                    .where(Task.recurrence.isnot(None))
                    .where(Task.updated_at >= datetime.combine(cutoff, datetime.min.time()))
                )
                deactivated_recurring = fix_result.scalars().all()
                if deactivated_recurring:
                    # Get active recurring task titles to avoid creating duplicates
                    active_result = await db.execute(
                        select(Task.title, Task.recurrence)
                        .where(Task.is_active == True)
                        .where(Task.recurrence != TaskRecurrence.ONCE)
                        .where(Task.recurrence.isnot(None))
                    )
                    active_titles = {(r[0], r[1]) for r in active_result.all()}

                    for t in deactivated_recurring:
                        if (t.title, t.recurrence) not in active_titles:
                            t.is_active = True
                            t.calendar_synced_at = None
                            t.calendar_content_hash = None
                            active_titles.add((t.title, t.recurrence))
                            logger.info(f"Reactivated recurring task: {t.title} (id={t.id})")
                    await db.commit()

                # Get all active recurring tasks
                result = await db.execute(
                    select(Task)
                    .where(Task.is_active == True)
                    .where(Task.recurrence != TaskRecurrence.ONCE)
                )
                recurring_tasks = result.scalars().all()

                for task in recurring_tasks:
                    # Check if task needs to be scheduled for today
                    should_schedule = False

                    if task.recurrence == TaskRecurrence.DAILY:
                        should_schedule = True
                    elif task.recurrence == TaskRecurrence.WEEKLY:
                        # Schedule on same day of week as original
                        if task.due_date and task.due_date.weekday() == today.weekday():
                            should_schedule = True
                    elif task.recurrence == TaskRecurrence.BIWEEKLY:
                        # Schedule every 2 weeks on the same day of week
                        if task.due_date and task.due_date.weekday() == today.weekday():
                            days_diff = (today - task.due_date).days
                            if days_diff >= 0 and days_diff % 14 == 0:
                                should_schedule = True
                    elif task.recurrence == TaskRecurrence.CUSTOM_WEEKLY:
                        # Schedule on specific days of week (e.g., Mon/Wed/Fri)
                        if task.recurrence_days_of_week:
                            # recurrence_days_of_week is a list like [0,2,4] (0=Mon, 6=Sun)
                            if today.weekday() in task.recurrence_days_of_week:
                                should_schedule = True
                    elif task.recurrence == TaskRecurrence.MONTHLY:
                        # Schedule on same day of month
                        if task.recurrence_day == today.day:
                            should_schedule = True
                    elif task.recurrence == TaskRecurrence.QUARTERLY:
                        # Schedule every 3 months on same day
                        if task.due_date and today.day == task.due_date.day:
                            month_diff = (today.year - task.due_date.year) * 12 + (today.month - task.due_date.month)
                            if month_diff >= 0 and month_diff % 3 == 0:
                                should_schedule = True
                    elif task.recurrence == TaskRecurrence.BIANNUALLY:
                        # Schedule every 6 months on same day
                        if task.due_date and today.day == task.due_date.day:
                            month_diff = (today.year - task.due_date.year) * 12 + (today.month - task.due_date.month)
                            if month_diff >= 0 and month_diff % 6 == 0:
                                should_schedule = True
                    elif task.recurrence == TaskRecurrence.ANNUALLY:
                        # Schedule on same month and day
                        if (task.recurrence_month == today.month and
                            task.recurrence_day == today.day):
                            should_schedule = True
                    elif task.recurrence == TaskRecurrence.CUSTOM:
                        # Custom interval in days
                        if task.due_date and task.recurrence_interval:
                            days_diff = (today - task.due_date).days
                            if days_diff >= 0 and days_diff % task.recurrence_interval == 0:
                                should_schedule = True

                    if should_schedule:
                        # Update the task's due date to today
                        task.due_date = today
                        task.is_completed = False
                        task.completed_at = None
                        # Clear calendar sync metadata so the task is pushed fresh
                        # to the calendar. Without this, the CalDAV sync detects the
                        # UID is missing from the calendar (deleted when completed)
                        # and incorrectly marks the task as "deleted on phone".
                        task.calendar_synced_at = None
                        task.calendar_content_hash = None
                        # Clear alerts_sent so reminders fire for the new occurrence
                        task.alerts_sent = None
                        logger.info(f"Scheduled recurring task: {task.title}")

                await db.commit()
        except Exception as e:
            logger.error(f"Error generating recurring tasks: {e}")

    async def auto_complete_past_events(self):
        """Auto-complete events whose date has passed (events don't need manual completion)"""
        logger.debug("Auto-completing past events...")
        try:
            async with async_session() as db:
                today = date.today()
                today_start = datetime.combine(today, datetime.min.time())
                today_end = datetime.combine(today, datetime.max.time())

                # Fix: Correct any completed events where completed_at is today but due_date is in the past
                # This fixes events that were incorrectly auto-completed with current timestamp
                fix_result = await db.execute(
                    select(Task)
                    .where(Task.is_completed == True)
                    .where(Task.task_type == TaskType.EVENT)
                    .where(Task.due_date < today)
                    .where(Task.completed_at >= today_start)
                    .where(Task.completed_at <= today_end)
                )
                events_to_fix = fix_result.scalars().all()
                if events_to_fix:
                    for event in events_to_fix:
                        if event.due_time:
                            hours, minutes = map(int, event.due_time.split(':')[:2])
                            event.completed_at = datetime.combine(event.due_date, datetime.min.time().replace(hour=hours, minute=minutes))
                        else:
                            event.completed_at = datetime.combine(event.due_date, datetime.max.time().replace(microsecond=0))
                    await db.commit()
                    logger.info(f"Fixed completed_at for {len(events_to_fix)} events that were incorrectly timestamped")

                # Find all active, incomplete events from before today
                result = await db.execute(
                    select(Task)
                    .where(Task.is_active == True)
                    .where(Task.is_completed == False)
                    .where(Task.task_type == TaskType.EVENT)
                    .where(Task.due_date < today)
                    .where(Task.due_date.isnot(None))
                )
                past_events = result.scalars().all()

                if past_events:
                    for event in past_events:
                        event.is_completed = True
                        # Set completed_at to the event's due date/time, NOT current time
                        # This prevents old events from showing up as "completed today"
                        if event.due_time:
                            hours, minutes = map(int, event.due_time.split(':')[:2])
                            event.completed_at = datetime.combine(event.due_date, datetime.min.time().replace(hour=hours, minute=minutes))
                        else:
                            # End of day if no specific time
                            event.completed_at = datetime.combine(event.due_date, datetime.max.time().replace(microsecond=0))
                        logger.info(f"Auto-completed past event: {event.title} (was due {event.due_date})")

                    await db.commit()
                    logger.info(f"Auto-completed {len(past_events)} past events")
        except Exception as e:
            logger.error(f"Error auto-completing past events: {e}")

    async def get_todays_tasks(self, db: AsyncSession) -> List[Task]:
        """Get all tasks due today"""
        today = date.today()
        result = await db.execute(
            select(Task)
            .where(Task.due_date == today)
            .where(Task.is_active == True)
            .order_by(Task.priority, Task.due_time)
        )
        return result.scalars().all()

    async def get_upcoming_tasks(self, db: AsyncSession, days: int = 7) -> List[Task]:
        """Get tasks due in the next X days"""
        today = date.today()
        end_date = today + timedelta(days=days)
        result = await db.execute(
            select(Task)
            .where(Task.due_date >= today)
            .where(Task.due_date <= end_date)
            .where(Task.is_active == True)
            .where(Task.is_completed == False)
            .order_by(Task.due_date, Task.priority)
        )
        return result.scalars().all()

    async def schedule_sunset_reminder(self):
        """Schedule cold protection reminder for 1 hour before sunset"""
        if not settings.latitude or not settings.longitude:
            logger.warning("Cannot schedule sunset reminder - location not configured")
            return

        try:
            # Calculate today's sunset
            sunset = calculate_sunset(settings.latitude, settings.longitude)
            reminder_time = sunset - timedelta(hours=1)

            import pytz
            tz = pytz.timezone(settings.timezone)
            now = datetime.now(tz)

            # Only schedule if reminder time is in the future
            if reminder_time <= now:
                logger.debug("Sunset reminder time has passed for today")
                return

            # Check if there are plants needing protection tonight
            forecast = await self.forecast_service.get_forecast_simple()
            if not forecast:
                logger.warning("Could not get forecast for sunset reminder")
                return

            # Get tonight's low (first night period or first low)
            forecast_low = None
            for period in forecast[:2]:  # Check first two periods
                if period.get("low") is not None:
                    forecast_low = period["low"]
                    break

            if forecast_low is None:
                logger.debug("No forecast low temperature available")
                return

            # Get cold protection buffer from settings
            from models.database import async_session as get_session
            from models.settings import AppSetting

            buffer_degrees = 7  # Default buffer
            async with get_session() as db:
                result = await db.execute(
                    select(AppSetting).where(AppSetting.key == "cold_protection_buffer")
                )
                buffer_setting = result.scalar_one_or_none()
                if buffer_setting and buffer_setting.value:
                    try:
                        buffer_degrees = int(buffer_setting.value)
                    except ValueError:
                        pass

            # Check temp with buffer - alert if forecast low is within buffer of plant's min temp
            # We want to alert when: forecast_low <= min_temp + buffer
            # Rearranged: min_temp >= forecast_low - buffer
            # Example: forecast_low=38, buffer=7, plant min_temp=35
            # Check: 35 >= 38 - 7 = 31? Yes, protect Turmeric.
            # Example: forecast_low=46, buffer=7, plant min_temp=35
            # Check: 35 >= 46 - 7 = 39? No, don't alert (46°F is too warm).
            check_threshold = forecast_low - buffer_degrees

            # Query plants that need protection (their min_temp is at or above the threshold)
            async with get_session() as db:
                result = await db.execute(
                    select(Plant)
                    .where(Plant.is_active == True)
                    .where(Plant.min_temp.isnot(None))
                    .where(Plant.min_temp >= check_threshold)
                )
                plants = result.scalars().all()

            if not plants:
                logger.info(f"No plants need cold protection tonight (low: {forecast_low}°F, threshold: {check_threshold}°F)")
                return

            # Schedule the reminder
            sunset_str = sunset.strftime("%I:%M %p")

            self.scheduler.add_job(
                self.send_cold_protection_email,
                DateTrigger(run_date=reminder_time),
                id="sunset_cold_reminder",
                name=f"Cold Protection Reminder (Sunset {sunset_str})",
                replace_existing=True,
                kwargs={
                    "plants": plants,
                    "forecast_low": forecast_low,
                    "sunset_time": sunset_str,
                }
            )

            logger.info(
                f"Scheduled cold protection reminder for {reminder_time.strftime('%I:%M %p')} "
                f"({len(plants)} plants, low: {forecast_low}°F, sunset: {sunset_str})"
            )

        except Exception as e:
            logger.error(f"Error scheduling sunset reminder: {e}")

    async def send_cold_protection_email(
        self,
        plants: List[Plant],
        forecast_low: float,
        sunset_time: str,
    ):
        """Send cold protection email reminder"""
        # Skip on dev instances to avoid duplicate emails
        if settings.is_dev_instance:
            logger.info("Skipping cold protection email on dev instance")
            return

        try:
            # Get recipients from settings
            recipients = await get_setting_value("email_recipients")
            if not recipients:
                logger.warning("No email recipients configured, skipping cold protection email")
                return

            plant_dicts = [
                {
                    "name": p.name,
                    "min_temp": p.min_temp,
                    "location": p.location or "Not specified",
                }
                for p in plants
            ]

            # Get animals needing blankets
            from models.database import async_session as get_session
            animal_dicts = []
            async with get_session() as db:
                result = await db.execute(
                    select(Animal)
                    .where(Animal.is_active == True)
                    .where(Animal.needs_blanket_below.isnot(None))
                    .where(Animal.needs_blanket_below >= forecast_low)
                    .order_by(Animal.name)
                )
                animals = result.scalars().all()
                animal_dicts = [
                    {
                        "name": a.name,
                        "animal_type": a.animal_type.value if a.animal_type else "Unknown",
                        "color": a.color,
                        "needs_blanket_below": a.needs_blanket_below,
                    }
                    for a in animals
                ]

                # Check for freeze warning (pipes/irrigation protection)
                freeze_warning = None
                freeze_threshold = float(await get_setting_value("freeze_warning_temp") or "32")
                buffer_degrees = 5  # Conservative for pipes

                if forecast_low <= (freeze_threshold + buffer_degrees):
                    freeze_warning = {
                        "forecast_low": forecast_low,
                        "message": "Freeze forecasted! Protect exposed irrigation and pipes.",
                        "recommendations": [
                            "Disconnect and drain garden hoses",
                            "Cover exposed outdoor faucets/spigots",
                            "Drain or blow out irrigation lines if extended freeze expected",
                            "Open cabinet doors under sinks on exterior walls",
                            "Let faucets drip slightly to prevent pipe freeze"
                        ]
                    }

                email_service = await self.get_email_service(db)
                await email_service.send_cold_protection_reminder(
                    plants=plant_dicts,
                    animals=animal_dicts,
                    forecast_low=forecast_low,
                    sunset_time=sunset_time,
                    recipients=recipients,
                    freeze_warning=freeze_warning,
                )

            logger.info(f"Sent cold protection reminder for {len(plants)} plants, {len(animal_dicts)} animals to {recipients}")

        except Exception as e:
            logger.error(f"Error sending cold protection email: {e}")

    async def sync_maintenance_reminders(self):
        """Sync all maintenance tasks to the task/calendar system"""
        logger.debug("Syncing maintenance reminders...")
        try:
            from services.auto_reminders import sync_all_maintenance_reminders

            async with async_session() as db:
                stats = await sync_all_maintenance_reminders(db)
                logger.info(f"Maintenance reminder sync: {stats}")

        except Exception as e:
            logger.error(f"Error syncing maintenance reminders: {e}")

    async def check_reminder_alerts(self):
        """Check for tasks that need alert emails sent based on their reminder_alerts intervals"""
        # Skip on dev instances to avoid duplicate emails
        if settings.is_dev_instance:
            return

        try:
            import pytz
            import json
            from datetime import datetime, timedelta
            from sqlalchemy.orm.attributes import flag_modified

            tz = pytz.timezone(settings.timezone)
            now = datetime.now(tz)

            # Get default alert intervals from settings
            default_alerts_str = await get_setting_value("default_reminder_alerts")
            default_alerts = [int(x.strip()) for x in default_alerts_str.split(",") if x.strip()]

            async with async_session() as db:
                # Get all active, incomplete tasks with due dates
                result = await db.execute(
                    select(Task)
                    .where(Task.is_active == True)
                    .where(Task.is_completed == False)
                    .where(Task.due_date.isnot(None))
                    .where(Task.notify_email == True)
                )
                tasks = result.scalars().all()

                alerts_sent = 0
                for task in tasks:
                    # Skip tasks without a specific due_time - they shouldn't get alerts
                    # (They appear in daily digest and dashboard instead)
                    # Also skip "00:00" as that typically means "no specific time" rather than "midnight"
                    if not task.due_time or task.due_time == "00:00":
                        continue

                    # Calculate task due datetime
                    due_date = task.due_date
                    try:
                        hour, minute = map(int, task.due_time.split(":"))
                    except:
                        continue  # Invalid time format, skip

                    due_datetime = tz.localize(datetime.combine(due_date, datetime.min.time().replace(hour=hour, minute=minute)))

                    # Skip tasks whose due_datetime has already passed by more than 1 hour
                    # This prevents sending reminders for old/past tasks
                    if due_datetime < now - timedelta(hours=1):
                        continue

                    # Get task-specific alerts or use defaults
                    task_alerts = task.reminder_alerts if task.reminder_alerts else default_alerts
                    task_alerts_sent = task.alerts_sent or {}

                    # Check each alert interval
                    for minutes_before in task_alerts:
                        alert_key = str(minutes_before)
                        alert_time = due_datetime - timedelta(minutes=minutes_before)

                        # Re-fetch alerts_sent from DB to get latest state (prevents race conditions)
                        await db.refresh(task)
                        task_alerts_sent = task.alerts_sent or {}

                        # Skip if already sent for this interval
                        if alert_key in task_alerts_sent:
                            continue

                        # Check if it's time to send this alert
                        # Window: from exactly at time to 5 minutes before (scheduler runs every 5 min)
                        # Only allow 0 or positive values to prevent sending AFTER the alert time
                        # This prevents overlap between scheduler runs at the boundaries
                        time_until_alert = (alert_time - now).total_seconds() / 60  # minutes
                        if 0 <= time_until_alert <= 5:  # 5 minute window, strictly before or at alert time
                            # Mark as sent FIRST to prevent duplicates on rapid restarts
                            # IMPORTANT: Create a NEW dict so SQLAlchemy detects the change.
                            # In-place mutation of JSON columns is not detected by the ORM.
                            new_alerts_sent = dict(task_alerts_sent)
                            new_alerts_sent[alert_key] = now.isoformat()
                            task.alerts_sent = new_alerts_sent
                            # Also update last_notified to prevent check_upcoming_tasks from sending duplicate
                            task.last_notified = datetime.utcnow()
                            flag_modified(task, "alerts_sent")
                            await db.commit()

                            # Now send the alert email
                            await self.send_task_reminder_email(task, minutes_before)
                            alerts_sent += 1
                            logger.info(f"Sent reminder for task '{task.title}' ({minutes_before} min before)")

                if alerts_sent > 0:
                    logger.info(f"Sent {alerts_sent} reminder alert(s) total")

        except Exception as e:
            logger.error(f"Error checking reminder alerts: {e}")

    async def send_task_reminder_email(self, task: Task, minutes_before: int):
        """Send a reminder email for a task at a specific interval"""
        # Skip on dev instances to avoid duplicate emails
        if settings.is_dev_instance:
            logger.debug(f"Skipping task reminder email on dev instance: {task.title}")
            return

        try:
            from models.database import async_session
            from models.workers import Worker
            from models.users import User

            async with async_session() as db:
                recipient_list = []

                if task.assigned_to_worker_id:
                    # Worker tasks ONLY go to the worker's email, not global recipients
                    result = await db.execute(
                        select(Worker).where(Worker.id == task.assigned_to_worker_id)
                    )
                    worker = result.scalar_one_or_none()
                    if worker and worker.email:
                        recipient_list.append(worker.email)
                        logger.debug(f"Worker task reminder -> worker email {worker.email}")
                    else:
                        logger.debug(f"Skipping reminder for worker task '{task.title}' - no worker email on file")
                        return
                else:
                    # Non-worker tasks: use global recipients + assigned user email
                    recipients = await get_setting_value("email_recipients")
                    recipient_list = [r.strip() for r in (recipients or "").split(",") if r.strip()]

                    # Add assigned user's email if available
                    if task.assigned_to_user_id:
                        result = await db.execute(
                            select(User).where(User.id == task.assigned_to_user_id)
                        )
                        user = result.scalar_one_or_none()
                        if user and user.email and user.email not in recipient_list:
                            recipient_list.append(user.email)
                            logger.debug(f"Added user email {user.email} to reminder recipients")

            if not recipient_list:
                logger.warning("No email recipients configured for task reminder")
                return

            recipients = ",".join(recipient_list)

            # Format the timing description
            if minutes_before == 0:
                timing = "now due"
            elif minutes_before < 60:
                timing = f"due in {minutes_before} minutes"
            elif minutes_before < 1440:
                hours = minutes_before // 60
                timing = f"due in {hours} hour{'s' if hours > 1 else ''}"
            else:
                days = minutes_before // 1440
                timing = f"due in {days} day{'s' if days > 1 else ''}"

            # Build email subject and body
            subject = f"🔔 Reminder: {task.title} ({timing})"

            due_str = task.due_date.strftime("%m/%d/%Y")
            if task.due_time:
                due_str += f" at {task.due_time}"

            body = f"""
<h2>Task Reminder: {task.title}</h2>
<p>This task is <strong>{timing}</strong>.</p>
<p><strong>Due:</strong> {due_str}</p>
"""
            if task.description:
                body += f"<p><strong>Description:</strong> {task.description}</p>"
            if task.location:
                body += f"<p><strong>Location:</strong> {task.location}</p>"
            if task.notes:
                body += f"<p><strong>Notes:</strong> {task.notes}</p>"

            async with async_session() as db:
                email_service = await self.get_email_service(db)
                await email_service.send_email(
                    to=recipients,
                    subject=subject,
                    body=body,
                    html=True,
                )

            logger.info(f"Sent reminder email for task '{task.title}' ({timing})")

        except Exception as e:
            logger.error(f"Error sending task reminder email: {e}")

    async def check_storage_usage(self):
        """Check disk storage usage and create alerts if thresholds exceeded"""
        import shutil
        from pathlib import Path

        logger.debug("Checking storage usage...")

        try:
            # SECURITY: Hardcoded paths only - no user input
            isaac_data_dir = Path("/opt/isaac/data")
            isaac_logs_dir = Path("/opt/isaac/logs")

            # Get disk usage
            total, used, free = shutil.disk_usage("/")
            usage_percent = (used / total) * 100 if total > 0 else 0

            # Get thresholds from settings
            warning_threshold = float(await get_setting_value("storage_warning_percent") or "80")
            critical_threshold = float(await get_setting_value("storage_critical_percent") or "95")

            async with async_session() as db:
                # Check if we need to create an alert
                if usage_percent >= critical_threshold:
                    # Check if there's already an active storage critical alert
                    result = await db.execute(
                        select(WeatherAlert)
                        .where(WeatherAlert.alert_type == "storage_critical")
                        .where(WeatherAlert.is_active == True)
                    )
                    existing = result.scalar_one_or_none()

                    if not existing:
                        # Create critical storage alert
                        from models.weather import AlertSeverity
                        alert = WeatherAlert(
                            alert_type="storage_critical",
                            title="Storage Critical",
                            message=f"Disk usage at {usage_percent:.1f}% - only {free / (1024**3):.1f} GB remaining. Free up space immediately.",
                            severity=AlertSeverity.CRITICAL,
                            is_active=True,
                        )
                        db.add(alert)
                        await db.commit()
                        logger.warning(f"Created storage critical alert: {usage_percent:.1f}% used")

                        # Send email alert (skip on dev to avoid duplicates)
                        if not settings.is_dev_instance:
                            recipients = await get_setting_value("email_recipients")
                            if recipients:
                                email_service = await self.get_email_service(db)
                                await email_service.send_email(
                                    to=recipients,
                                    subject="CRITICAL: Isaac Storage Full",
                                    body=f"""
                                    <h2>Storage Critical Alert</h2>
                                    <p>Disk usage has reached <strong>{usage_percent:.1f}%</strong>.</p>
                                    <p>Only {free / (1024**3):.1f} GB remaining on the disk.</p>
                                    <p>Please free up space immediately to prevent service disruption.</p>
                                    <p>Go to Settings > Storage Monitoring to clear logs or manage storage.</p>
                                    """,
                                    html=True,
                                )

                elif usage_percent >= warning_threshold:
                    # Check for existing warning alert
                    result = await db.execute(
                        select(WeatherAlert)
                        .where(WeatherAlert.alert_type == "storage_warning")
                        .where(WeatherAlert.is_active == True)
                    )
                    existing = result.scalar_one_or_none()

                    if not existing:
                        # Create warning storage alert
                        from models.weather import AlertSeverity
                        alert = WeatherAlert(
                            alert_type="storage_warning",
                            title="Storage Low",
                            message=f"Disk usage at {usage_percent:.1f}% - {free / (1024**3):.1f} GB remaining. Consider clearing logs.",
                            severity=AlertSeverity.WARNING,
                            is_active=True,
                        )
                        db.add(alert)
                        await db.commit()
                        logger.warning(f"Created storage warning alert: {usage_percent:.1f}% used")

                else:
                    # Clear any existing storage alerts if usage is back to normal
                    result = await db.execute(
                        select(WeatherAlert)
                        .where(WeatherAlert.alert_type.in_(["storage_warning", "storage_critical"]))
                        .where(WeatherAlert.is_active == True)
                    )
                    old_alerts = result.scalars().all()

                    for alert in old_alerts:
                        alert.is_active = False
                        logger.info(f"Cleared storage alert: {alert.title}")

                    if old_alerts:
                        await db.commit()

        except Exception as e:
            logger.error(f"Error checking storage usage: {e}")

    async def cleanup_weather_data(self):
        """Clean up old weather readings to prevent database bloat"""
        logger.debug("Running weather data cleanup...")
        try:
            from services.auto_watering import cleanup_old_weather_readings

            async with async_session() as db:
                deleted = await cleanup_old_weather_readings(db)
                if deleted > 0:
                    logger.info(f"Weather cleanup: removed {deleted} old readings")

        except Exception as e:
            logger.error(f"Error cleaning up weather data: {e}")

    async def cleanup_old_tasks(self):
        """Clean up old completed/inactive tasks to prevent database bloat.

        Retention policy: 1 year for completed tasks
        """
        logger.debug("Running old tasks cleanup...")
        try:
            from models.tasks import Task
            from sqlalchemy import delete, and_
            from datetime import datetime, timedelta

            # Delete tasks completed more than 1 year ago
            cutoff_date = datetime.utcnow() - timedelta(days=365)

            async with async_session() as db:
                # Delete old completed tasks
                result = await db.execute(
                    delete(Task).where(
                        and_(
                            Task.is_completed == True,
                            Task.completed_at < cutoff_date
                        )
                    )
                )
                deleted_completed = result.rowcount

                # Delete old inactive tasks (deleted/archived)
                result = await db.execute(
                    delete(Task).where(
                        and_(
                            Task.is_active == False,
                            Task.updated_at < cutoff_date
                        )
                    )
                )
                deleted_inactive = result.rowcount

                await db.commit()

                total_deleted = deleted_completed + deleted_inactive
                if total_deleted > 0:
                    logger.info(f"Task cleanup: removed {deleted_completed} completed, {deleted_inactive} inactive tasks (>1 year old)")

        except Exception as e:
            logger.error(f"Error cleaning up old tasks: {e}")

    async def cleanup_old_health_data(self):
        """Clean up old health data to prevent database bloat.

        Retention policy: 2 years for vitals, workouts, weight logs, and subjective inputs.
        Health data is kept longer than tasks since it may be needed for long-term trend analysis.
        """
        logger.debug("Running health data cleanup...")
        try:
            from models.team import MemberVitalsLog, MemberWorkoutLog, MemberWeightLog, MemberSubjectiveInput
            from sqlalchemy import delete

            # 2 year retention for health data
            cutoff_date = datetime.now() - timedelta(days=730)

            async with async_session() as db:
                # Delete old vitals
                result = await db.execute(
                    delete(MemberVitalsLog).where(
                        MemberVitalsLog.recorded_at < cutoff_date
                    )
                )
                deleted_vitals = result.rowcount

                # Delete old workouts
                result = await db.execute(
                    delete(MemberWorkoutLog).where(
                        MemberWorkoutLog.workout_date < cutoff_date
                    )
                )
                deleted_workouts = result.rowcount

                # Delete old weight logs
                result = await db.execute(
                    delete(MemberWeightLog).where(
                        MemberWeightLog.recorded_at < cutoff_date
                    )
                )
                deleted_weights = result.rowcount

                # Delete old subjective inputs
                result = await db.execute(
                    delete(MemberSubjectiveInput).where(
                        MemberSubjectiveInput.input_date < cutoff_date.date()
                    )
                )
                deleted_subjective = result.rowcount

                await db.commit()

                total_deleted = deleted_vitals + deleted_workouts + deleted_weights + deleted_subjective
                if total_deleted > 0:
                    logger.info(f"Health data cleanup: removed {deleted_vitals} vitals, {deleted_workouts} workouts, {deleted_weights} weights, {deleted_subjective} subjective inputs (>2 years old)")

        except Exception as e:
            logger.error(f"Error cleaning up old health data: {e}")

    async def update_gear_statuses(self):
        """Update gear content statuses based on quantity vs minimum and expiration dates.
        Sets status to EXPIRED if past expiration, LOW if below minimum, GOOD otherwise."""
        from models.team import ContentStatus
        logger.info("Updating gear content statuses...")
        try:
            async with async_session() as db:
                result = await db.execute(
                    select(MemberGearContents).where(MemberGearContents.is_active == True)
                )
                all_contents = result.scalars().all()

                updated_count = 0
                for content in all_contents:
                    new_status = ContentStatus.GOOD

                    # Check expiration first (takes priority)
                    if content.expiration_date and content.expiration_date <= datetime.now():
                        new_status = ContentStatus.EXPIRED
                    # Then check low stock
                    elif content.min_quantity and content.quantity < content.min_quantity:
                        new_status = ContentStatus.LOW

                    if content.status != new_status:
                        content.status = new_status
                        updated_count += 1

                await db.commit()
                if updated_count > 0:
                    logger.info(f"Updated {updated_count} gear content statuses")

        except Exception as e:
            logger.error(f"Error updating gear statuses: {e}")

    async def archive_budget_transactions(self):
        """Archive old budget transactions and snapshot period summaries.
        Runs on 1st and 15th — snapshots the just-ended half-period and
        deletes transactions older than 3 months.
        SAFETY: Never touches current half-period transactions."""
        from datetime import date, timedelta
        from dateutil.relativedelta import relativedelta
        import json

        logger.info("Running budget transaction archival...")
        try:
            async with async_session() as db:
                from models.budget import BudgetTransaction, BudgetCategory, BudgetPeriodSnapshot
                from sqlalchemy import select, delete, func, and_

                today = date.today()

                # Determine current half-period (PROTECTED — never touched)
                if today.day <= 14:
                    current_start = today.replace(day=1)
                    # Previous half = 2nd half of last month
                    prev_end = current_start - timedelta(days=1)  # last day of prev month
                    prev_start = prev_end.replace(day=15)
                    period_key = f"{prev_start.year}-{prev_start.month:02d}-2"
                else:
                    current_start = today.replace(day=15)
                    # Previous half = 1st half of this month
                    prev_start = today.replace(day=1)
                    prev_end = today.replace(day=14)
                    period_key = f"{today.year}-{today.month:02d}-1"

                logger.info(f"Archiving period {period_key} ({prev_start} to {prev_end}). Current period starts {current_start} — protected.")

                # Check if snapshot already exists
                existing = await db.execute(
                    select(BudgetPeriodSnapshot).where(BudgetPeriodSnapshot.period_key == period_key)
                )
                if existing.scalar():
                    logger.debug(f"Snapshot for {period_key} already exists, skipping")
                else:
                    # Create snapshot for the just-ended period ONLY
                    cat_spending_q = await db.execute(
                        select(
                            BudgetCategory.name,
                            func.sum(BudgetTransaction.amount)
                        )
                        .join(BudgetCategory, BudgetTransaction.category_id == BudgetCategory.id)
                        .where(
                            BudgetTransaction.transaction_date >= prev_start,
                            BudgetTransaction.transaction_date <= prev_end,
                            BudgetTransaction.amount < 0,
                        )
                        .group_by(BudgetCategory.name)
                    )
                    cat_spending = {name: round(abs(amt), 2) for name, amt in cat_spending_q.fetchall()}

                    income_q = await db.execute(
                        select(func.sum(BudgetTransaction.amount))
                        .where(
                            BudgetTransaction.transaction_date >= prev_start,
                            BudgetTransaction.transaction_date <= prev_end,
                            BudgetTransaction.amount > 0,
                        )
                    )
                    total_income = income_q.scalar() or 0.0

                    expense_q = await db.execute(
                        select(func.sum(BudgetTransaction.amount))
                        .where(
                            BudgetTransaction.transaction_date >= prev_start,
                            BudgetTransaction.transaction_date <= prev_end,
                            BudgetTransaction.amount < 0,
                        )
                    )
                    total_expenses = abs(expense_q.scalar() or 0.0)

                    snapshot = BudgetPeriodSnapshot(
                        period_key=period_key,
                        start_date=prev_start,
                        end_date=prev_end,
                        total_income=round(total_income, 2),
                        total_expenses=round(total_expenses, 2),
                        category_spending=json.dumps(cat_spending) if cat_spending else None,
                    )
                    db.add(snapshot)
                    await db.commit()
                    logger.info(f"Created budget snapshot for {period_key}: income={total_income:.2f}, expenses={total_expenses:.2f}")

                # Backfill period_key on transactions that don't have one
                txns_no_key = await db.execute(
                    select(BudgetTransaction).where(BudgetTransaction.period_key.is_(None))
                )
                for txn in txns_no_key.scalars().all():
                    td = txn.transaction_date
                    h = 1 if td.day <= 14 else 2
                    txn.period_key = f"{td.year}-{td.month:02d}-{h}"
                await db.commit()

                # Delete transactions older than 3 months — but NEVER from current period
                cutoff = today - relativedelta(months=3)
                delete_result = await db.execute(
                    delete(BudgetTransaction).where(
                        and_(
                            BudgetTransaction.transaction_date < cutoff,
                            BudgetTransaction.transaction_date < current_start,
                        )
                    )
                )
                deleted_count = delete_result.rowcount
                await db.commit()

                if deleted_count > 0:
                    logger.info(f"Deleted {deleted_count} budget transactions older than {cutoff}")
                else:
                    logger.debug("No old budget transactions to clean up")

        except Exception as e:
            logger.error(f"Error archiving budget transactions: {e}")

    async def run_health_check(self):
        """Run periodic health checks and send alerts if needed"""
        # Only run health monitoring on production
        if settings.is_dev_instance:
            return

        logger.debug("Running health check...")
        try:
            from services.health_monitor import (
                health_monitor, log_health_check, send_health_alert,
                HealthStatus
            )

            async with async_session() as db:
                # Run all health checks
                checks = await health_monitor.run_all_checks(db)
                overall_status = health_monitor.get_overall_status(checks)

                # Log to database
                await log_health_check(db, checks, overall_status)

                # Check if we should send alerts
                for check in checks:
                    if health_monitor.should_send_alert(check.name, check.status):
                        # Send alert email
                        await send_health_alert(db, checks, overall_status)
                        # Record that we sent an alert for each check
                        for c in checks:
                            if c.status in [HealthStatus.WARNING, HealthStatus.CRITICAL]:
                                health_monitor.record_alert_sent(c.name)
                        break  # Only send one alert per check cycle

                if overall_status != HealthStatus.HEALTHY:
                    issues = [f"{c.name}={c.status}({c.message})" for c in checks if c.status != HealthStatus.HEALTHY]
                    logger.warning(f"Health check: {overall_status} - {', '.join(issues)}")

        except Exception as e:
            logger.error(f"Error running health check: {e}")
