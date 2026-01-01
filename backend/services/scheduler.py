"""
Task Scheduler Service
Handles recurring tasks, reminders, and weather monitoring
"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime, date, timedelta
from typing import List, Optional
from loguru import logger
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from models.database import async_session
from models.tasks import Task, TaskRecurrence
from models.plants import Plant
from models.livestock import Animal, AnimalType
from models.weather import WeatherAlert
from services.weather import WeatherService
from services.email import EmailService


class SchedulerService:
    """Background task scheduler for Levi"""

    def __init__(self):
        self.scheduler = AsyncIOScheduler(timezone=settings.timezone)
        self.weather_service = WeatherService()
        self.email_service = EmailService()

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

        # Daily digest email - 6:00 AM
        self.scheduler.add_job(
            self.send_daily_digest,
            CronTrigger(hour=6, minute=0),
            id="daily_digest",
            name="Send Daily Digest",
            replace_existing=True,
        )

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

        self.scheduler.start()
        logger.info("Scheduler started with all jobs")

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
                    alerts = await self.weather_service.check_alerts(db, reading)

                    # Send email for critical alerts
                    for alert in alerts:
                        if alert.severity.value in ["critical", "warning"]:
                            await self.email_service.send_weather_alert({
                                "title": alert.title,
                                "message": alert.message,
                                "severity": alert.severity.value,
                                "recommended_actions": alert.recommended_actions,
                            })
                            alert.email_sent = True
                            alert.email_sent_at = datetime.utcnow()
                            await db.commit()
        except Exception as e:
            logger.error(f"Error polling weather: {e}")

    async def send_daily_digest(self):
        """Send daily digest email with tasks and weather"""
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
