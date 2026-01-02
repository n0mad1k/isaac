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
from models.database import async_session
from models.tasks import Task, TaskRecurrence
from models.plants import Plant
from models.livestock import Animal, AnimalType
from models.weather import WeatherAlert
from models.settings import AppSetting
from services.weather import WeatherService, NWSForecastService
from services.email import EmailService


# Default settings (mirrors routers/settings.py)
DEFAULT_SETTINGS = {
    "email_alerts_enabled": "true",
    "email_daily_digest": "true",
    "email_digest_time": "06:00",
    "frost_warning_temp": "35.0",
    "freeze_warning_temp": "32.0",
    "heat_warning_temp": "95.0",
    "wind_warning_speed": "25.0",
    "rain_warning_inches": "2.0",
    "cold_protection_buffer": "7",
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


def calculate_sunset(lat: float, lon: float, date_obj: date = None) -> datetime:
    """Calculate sunset time for given coordinates using astronomical formulas"""
    if date_obj is None:
        date_obj = date.today()

    # Day of year
    day_of_year = date_obj.timetuple().tm_yday

    # Convert latitude to radians
    lat_rad = math.radians(lat)

    # Calculate declination angle
    declination = 23.45 * math.sin(math.radians((360/365) * (day_of_year - 81)))
    decl_rad = math.radians(declination)

    # Calculate hour angle for sunset
    cos_hour_angle = -math.tan(lat_rad) * math.tan(decl_rad)

    # Clamp to valid range (handles midnight sun / polar night)
    cos_hour_angle = max(-1, min(1, cos_hour_angle))

    hour_angle = math.degrees(math.acos(cos_hour_angle))

    # Solar noon in hours (approximate, adjusted for longitude)
    # Standard time meridian for Eastern Time is -75 degrees
    lstm = -75  # Local Standard Time Meridian for ET
    time_correction = 4 * (lon - lstm)  # minutes
    solar_noon = 12 - (time_correction / 60)

    # Sunset time in hours from midnight
    sunset_hours = solar_noon + (hour_angle / 15)

    # Create datetime
    sunset_hour = int(sunset_hours)
    sunset_minute = int((sunset_hours - sunset_hour) * 60)

    import pytz
    tz = pytz.timezone(settings.timezone)
    sunset_dt = tz.localize(datetime(date_obj.year, date_obj.month, date_obj.day, sunset_hour, sunset_minute))

    return sunset_dt


class SchedulerService:
    """Background task scheduler for Levi"""

    def __init__(self):
        self.scheduler = AsyncIOScheduler(timezone=settings.timezone)
        self.weather_service = WeatherService()
        self.forecast_service = NWSForecastService()
        self.email_service = EmailService()
        self._sunset_job_scheduled = False

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

        # Daily digest email - time from settings
        await self.schedule_daily_digest()

        # Check for upcoming tasks - every hour
        self.scheduler.add_job(
            self.check_upcoming_tasks,
            CronTrigger(minute=0),
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

        # Generate recurring tasks - daily at midnight
        self.scheduler.add_job(
            self.generate_recurring_tasks,
            CronTrigger(hour=0, minute=5),
            id="generate_recurring",
            name="Generate Recurring Tasks",
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

        self.scheduler.start()
        logger.info("Scheduler started with all jobs")

        # Schedule today's sunset reminder if needed (on startup)
        await self.schedule_sunset_reminder()

    async def schedule_calendar_sync(self):
        """Schedule calendar sync if enabled"""
        calendar_enabled = await get_setting_value("calendar_enabled")
        if calendar_enabled != "true":
            logger.debug("Calendar sync is disabled")
            return

        sync_interval = await get_setting_value("calendar_sync_interval")
        try:
            interval_minutes = int(sync_interval)
        except (ValueError, TypeError):
            interval_minutes = 30  # Default

        self.scheduler.add_job(
            self.sync_calendar,
            IntervalTrigger(minutes=interval_minutes),
            id="calendar_sync",
            name=f"Calendar Sync (every {interval_minutes}min)",
            replace_existing=True,
        )
        logger.info(f"Calendar sync scheduled every {interval_minutes} minutes")

    async def sync_calendar(self):
        """Perform bi-directional calendar sync"""
        from services.calendar_sync import get_calendar_service

        try:
            async with async_session() as db:
                service = await get_calendar_service(db)
                if not service:
                    return

                if not service.connect():
                    logger.error("Failed to connect to calendar for sync")
                    return

                # Get current calendar events to detect phone-side deletions
                events = await service.get_calendar_events()
                calendar_uids = set()
                for event_dict in events:
                    uid = event_dict.get('calendar_uid')
                    if uid:
                        calendar_uids.add(uid)

                # Sync both directions (with deletion detection for items deleted on phone)
                tasks_synced = await service.sync_all_tasks_to_calendar(db, calendar_uids)
                events_synced = await service.sync_calendar_to_tasks(db)

                logger.info(f"Calendar sync complete: {tasks_synced} tasks synced, {events_synced} events imported")

        except Exception as e:
            logger.error(f"Calendar sync failed: {e}")

    async def schedule_daily_digest(self):
        """Schedule the daily digest email based on settings"""
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

    async def send_daily_digest(self):
        """Send daily digest email with tasks and weather"""
        # Check if daily digest is enabled
        digest_enabled = await get_setting_value("email_daily_digest")
        if digest_enabled != "true":
            logger.debug("Daily digest is disabled, skipping")
            return

        logger.info("Sending daily digest...")
        try:
            async with async_session() as db:
                # Get today's tasks
                today = date.today()
                result = await db.execute(
                    select(Task)
                    .where(Task.due_date == today)
                    .where(Task.is_completed == False)
                    .where(Task.is_active == True)
                    .order_by(Task.priority)
                )
                tasks = result.scalars().all()

                # Get current weather
                reading = await self.weather_service.get_latest_reading(db)
                weather = (
                    self.weather_service.get_weather_summary(reading)
                    if reading
                    else {}
                )

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

                await self.email_service.send_daily_digest(
                    tasks=task_dicts,
                    weather=weather,
                    alerts=alert_dicts,
                )
        except Exception as e:
            logger.error(f"Error sending daily digest: {e}")

    async def check_upcoming_tasks(self):
        """Check for tasks due soon and send reminders"""
        logger.debug("Checking upcoming tasks...")
        try:
            async with async_session() as db:
                # Find tasks due in the next 24-48 hours that haven't been notified
                tomorrow = date.today() + timedelta(days=1)
                result = await db.execute(
                    select(Task)
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

                for task in tasks:
                    await self.email_service.send_task_reminder({
                        "title": task.title,
                        "description": task.description,
                        "due_date": task.due_date,
                        "category": task.category.value if task.category else "General",
                        "notes": task.notes,
                    })
                    task.last_notified = datetime.utcnow()

                await db.commit()
                if tasks:
                    logger.info(f"Sent {len(tasks)} task reminders")
        except Exception as e:
            logger.error(f"Error checking upcoming tasks: {e}")

    async def check_animal_schedules(self):
        """Check for animals needing care (farrier, worming, etc.)"""
        logger.debug("Checking animal care schedules...")
        try:
            async with async_session() as db:
                today = date.today()
                week_ahead = today + timedelta(days=7)

                # Check horses for farrier
                result = await db.execute(
                    select(Animal)
                    .where(Animal.animal_type == AnimalType.HORSE)
                    .where(Animal.is_active == True)
                    .where(Animal.next_farrier_date <= week_ahead)
                )
                horses_need_farrier = result.scalars().all()

                for horse in horses_need_farrier:
                    days_until = (horse.next_farrier_date - today).days
                    await self.email_service.send_task_reminder({
                        "title": f"Farrier needed for {horse.name}",
                        "description": f"{horse.name} is due for hoof trimming",
                        "due_date": horse.next_farrier_date,
                        "category": "Animal Care",
                        "notes": f"Due in {days_until} days" if days_until > 0 else "Overdue!",
                    })

                # Check all animals for worming
                result = await db.execute(
                    select(Animal)
                    .where(Animal.is_active == True)
                    .where(Animal.next_worming_date <= week_ahead)
                )
                animals_need_worming = result.scalars().all()

                for animal in animals_need_worming:
                    days_until = (animal.next_worming_date - today).days
                    await self.email_service.send_task_reminder({
                        "title": f"Worming due for {animal.name}",
                        "description": f"{animal.name} ({animal.animal_type.value}) needs worming",
                        "due_date": animal.next_worming_date,
                        "category": "Animal Care",
                        "notes": f"Rotation: {animal.wormer_rotation}" if animal.wormer_rotation else "",
                    })

                # Check cattle for slaughter scheduling
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
                    await self.email_service.send_task_reminder({
                        "title": f"Schedule slaughter for {steer.name}",
                        "description": f"Steer {steer.name} approaching target date",
                        "due_date": steer.estimated_slaughter_date,
                        "category": "Animal Care",
                        "notes": f"Processor: {steer.processor}" if steer.processor else "Contact processor to schedule",
                    })

        except Exception as e:
            logger.error(f"Error checking animal schedules: {e}")

    async def generate_recurring_tasks(self):
        """Generate task instances for recurring tasks"""
        logger.debug("Generating recurring tasks...")
        try:
            async with async_session() as db:
                today = date.today()

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
                    elif task.recurrence == TaskRecurrence.MONTHLY:
                        # Schedule on same day of month
                        if task.recurrence_day == today.day:
                            should_schedule = True
                    elif task.recurrence == TaskRecurrence.ANNUALLY:
                        # Schedule on same month and day
                        if (task.recurrence_month == today.month and
                            task.recurrence_day == today.day):
                            should_schedule = True

                    if should_schedule:
                        # Update the task's due date to today
                        task.due_date = today
                        task.is_completed = False
                        logger.info(f"Scheduled recurring task: {task.title}")

                await db.commit()
        except Exception as e:
            logger.error(f"Error generating recurring tasks: {e}")

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

            # Check temp with buffer
            check_temp = forecast_low + buffer_degrees

            # Query plants that need protection
            async with get_session() as db:
                result = await db.execute(
                    select(Plant)
                    .where(Plant.is_active == True)
                    .where(Plant.min_temp.isnot(None))
                    .where(Plant.min_temp >= check_temp)
                )
                plants = result.scalars().all()

            if not plants:
                logger.info(f"No plants need cold protection tonight (low: {forecast_low}°F)")
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

            await self.email_service.send_cold_protection_reminder(
                plants=plant_dicts,
                forecast_low=forecast_low,
                sunset_time=sunset_time,
                recipients=recipients,
            )

            logger.info(f"Sent cold protection reminder for {len(plants)} plants to {recipients}")

        except Exception as e:
            logger.error(f"Error sending cold protection email: {e}")
