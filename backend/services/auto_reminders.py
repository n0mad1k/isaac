"""
Auto-Reminder Service
Automatically creates calendar events/reminders for animal care and plant tasks
"""

from datetime import date, datetime, timedelta
from typing import Optional, List, Dict, Any
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.tasks import Task, TaskType, TaskCategory
from models.settings import AppSetting
from services.calendar_sync import get_calendar_service


# Notification setting keys and their defaults
NOTIFICATION_SETTINGS = {
    # Animal care
    "notify_animal_hoof_trim": "dashboard,email,calendar",
    "notify_animal_worming": "dashboard,email,calendar",
    "notify_animal_vaccination": "dashboard,email,calendar",
    "notify_animal_dental": "dashboard,email,calendar",
    "notify_animal_vet": "dashboard,email,calendar",
    "notify_animal_slaughter": "dashboard,email,calendar",
    "notify_animal_labor": "dashboard,email,calendar",
    # Plant care
    "notify_plant_watering": "dashboard,calendar",
    "notify_plant_fertilizing": "dashboard,email,calendar",
    "notify_plant_harvest": "dashboard,email,calendar",
    "notify_plant_pruning": "dashboard,email,calendar",
    "notify_plant_sow": "dashboard,email,calendar",
    # Maintenance
    "notify_maintenance": "dashboard,email,calendar",
}


async def get_notification_channels(db: AsyncSession, setting_key: str) -> Dict[str, bool]:
    """Get enabled notification channels for a setting.

    Returns dict with keys: dashboard, email, calendar
    """
    result = await db.execute(
        select(AppSetting).where(AppSetting.key == setting_key)
    )
    setting = result.scalar_one_or_none()

    value = setting.value if setting else NOTIFICATION_SETTINGS.get(setting_key, "")
    channels = [c.strip().lower() for c in value.split(",") if c.strip()]

    return {
        "dashboard": "dashboard" in channels,
        "email": "email" in channels,
        "calendar": "calendar" in channels,
    }


async def create_or_update_reminder(
    db: AsyncSession,
    source_type: str,  # e.g., "animal_care", "plant_task", "maintenance"
    source_id: int,  # ID of the source record
    title: str,
    due_date: date,
    description: str = None,
    location: str = None,
    category: TaskCategory = TaskCategory.OTHER,
    notification_setting_key: str = None,
) -> Optional[Task]:
    """Create or update a calendar reminder for an auto-generated task.

    Uses a composite key (source_type + source_id) stored in task notes
    to track which source record created this task.
    """
    if not notification_setting_key:
        return None

    # Check if calendar notifications are enabled for this type
    channels = await get_notification_channels(db, notification_setting_key)
    if not channels.get("calendar"):
        logger.debug(f"Calendar notifications disabled for {notification_setting_key}")
        return None

    # Look for existing auto-generated task for this source
    source_key = f"auto:{source_type}:{source_id}"
    result = await db.execute(
        select(Task).where(
            Task.notes.contains(source_key),
            Task.is_active == True
        )
    )
    existing_task = result.scalar_one_or_none()

    if existing_task:
        # Update existing task
        existing_task.title = title
        existing_task.due_date = due_date
        existing_task.description = description
        existing_task.location = location
        existing_task.category = category
        existing_task.updated_at = datetime.utcnow()
        await db.commit()

        # Sync to calendar
        calendar_service = await get_calendar_service(db)
        if calendar_service and calendar_service.connect():
            await calendar_service.sync_task_to_calendar(existing_task, db)

        logger.debug(f"Updated auto-reminder: {title}")
        return existing_task
    else:
        # Create new task
        new_task = Task(
            title=title,
            description=description,
            due_date=due_date,
            location=location,
            category=category,
            task_type=TaskType.TODO,  # Use TODO for reminders
            priority=2,  # Medium-high priority
            notes=f"{source_key}",  # Store source reference
            is_active=True,
            is_completed=False,
        )
        db.add(new_task)
        await db.commit()
        await db.refresh(new_task)

        # Sync to calendar
        calendar_service = await get_calendar_service(db)
        if calendar_service and calendar_service.connect():
            await calendar_service.sync_task_to_calendar(new_task, db)

        logger.info(f"Created auto-reminder: {title}")
        return new_task


async def delete_reminder(
    db: AsyncSession,
    source_type: str,
    source_id: int,
) -> bool:
    """Delete an auto-generated reminder by its source reference."""
    source_key = f"auto:{source_type}:{source_id}"
    result = await db.execute(
        select(Task).where(
            Task.notes.contains(source_key),
            Task.is_active == True
        )
    )
    task = result.scalar_one_or_none()

    if task:
        # Delete from calendar first
        calendar_service = await get_calendar_service(db)
        if calendar_service and calendar_service.connect():
            await calendar_service.delete_task_from_calendar(
                task.id,
                calendar_uid=task.calendar_uid
            )

        # Soft delete the task
        task.is_active = False
        await db.commit()
        logger.debug(f"Deleted auto-reminder for {source_key}")
        return True

    return False


# ============================================
# Animal Care Auto-Reminders
# ============================================

async def sync_animal_care_schedule_reminder(
    db: AsyncSession,
    animal_id: int,
    animal_name: str,
    schedule_id: int,
    schedule_name: str,
    due_date: date,
    notes: str = None,
) -> Optional[Task]:
    """Create/update reminder for an animal care schedule item."""
    # Map schedule names to notification settings
    name_lower = schedule_name.lower()
    if "hoof" in name_lower or "trim" in name_lower or "farrier" in name_lower:
        setting_key = "notify_animal_hoof_trim"
    elif "worm" in name_lower or "deworm" in name_lower:
        setting_key = "notify_animal_worming"
    elif "vaccin" in name_lower or "shot" in name_lower:
        setting_key = "notify_animal_vaccination"
    elif "dental" in name_lower or "teeth" in name_lower or "float" in name_lower:
        setting_key = "notify_animal_dental"
    elif "vet" in name_lower:
        setting_key = "notify_animal_vet"
    else:
        # Default to vet for unknown care types
        setting_key = "notify_animal_vet"

    title = f"{animal_name}: {schedule_name}"
    description = notes or f"Care schedule reminder for {animal_name}"

    return await create_or_update_reminder(
        db=db,
        source_type="animal_care_schedule",
        source_id=schedule_id,
        title=title,
        due_date=due_date,
        description=description,
        category=TaskCategory.ANIMALS,
        notification_setting_key=setting_key,
    )


async def sync_animal_slaughter_reminder(
    db: AsyncSession,
    animal_id: int,
    animal_name: str,
    slaughter_date: date,
    processor: str = None,
) -> Optional[Task]:
    """Create/update reminder for livestock slaughter date."""
    title = f"Slaughter: {animal_name}"
    description = f"Scheduled slaughter for {animal_name}"
    if processor:
        description += f"\nProcessor: {processor}"

    return await create_or_update_reminder(
        db=db,
        source_type="animal_slaughter",
        source_id=animal_id,
        title=title,
        due_date=slaughter_date,
        description=description,
        location=processor,
        category=TaskCategory.ANIMALS,
        notification_setting_key="notify_animal_slaughter",
    )


# ============================================
# Plant Care Auto-Reminders
# ============================================

async def sync_plant_watering_reminder(
    db: AsyncSession,
    plant_id: int,
    plant_name: str,
    next_watering: date,
    location: str = None,
) -> Optional[Task]:
    """Create/update reminder for plant watering."""
    title = f"Water: {plant_name}"

    return await create_or_update_reminder(
        db=db,
        source_type="plant_watering",
        source_id=plant_id,
        title=title,
        due_date=next_watering,
        location=location,
        category=TaskCategory.GARDEN,
        notification_setting_key="notify_plant_watering",
    )


async def sync_plant_fertilizing_reminder(
    db: AsyncSession,
    plant_id: int,
    plant_name: str,
    next_fertilizing: date,
    location: str = None,
) -> Optional[Task]:
    """Create/update reminder for plant fertilizing."""
    title = f"Fertilize: {plant_name}"

    return await create_or_update_reminder(
        db=db,
        source_type="plant_fertilizing",
        source_id=plant_id,
        title=title,
        due_date=next_fertilizing,
        location=location,
        category=TaskCategory.GARDEN,
        notification_setting_key="notify_plant_fertilizing",
    )


async def sync_plant_harvest_reminder(
    db: AsyncSession,
    plant_id: int,
    plant_name: str,
    harvest_date: date,
    location: str = None,
    how_to_harvest: str = None,
) -> Optional[Task]:
    """Create/update reminder for plant harvest."""
    title = f"Harvest: {plant_name}"

    return await create_or_update_reminder(
        db=db,
        source_type="plant_harvest",
        source_id=plant_id,
        title=title,
        due_date=harvest_date,
        description=how_to_harvest,
        location=location,
        category=TaskCategory.GARDEN,
        notification_setting_key="notify_plant_harvest",
    )


# ============================================
# Bulk Sync Functions
# ============================================

async def sync_all_animal_reminders(db: AsyncSession) -> Dict[str, int]:
    """Sync all animal care schedules and slaughter dates to calendar."""
    from models.livestock import Animal, AnimalCareSchedule, AnimalCategory

    stats = {"created": 0, "updated": 0, "skipped": 0}

    # Get all active animals with care schedules
    result = await db.execute(
        select(Animal)
        .where(Animal.is_active == True)
    )
    animals = result.scalars().all()

    for animal in animals:
        # Sync slaughter date for livestock
        if animal.category == AnimalCategory.LIVESTOCK and animal.slaughter_date:
            task = await sync_animal_slaughter_reminder(
                db=db,
                animal_id=animal.id,
                animal_name=animal.name,
                slaughter_date=animal.slaughter_date,
                processor=animal.processor,
            )
            if task:
                stats["created" if task.created_at == task.updated_at else "updated"] += 1
            else:
                stats["skipped"] += 1

    # Get all active care schedules with due dates
    result = await db.execute(
        select(AnimalCareSchedule)
        .where(AnimalCareSchedule.is_active == True)
    )
    schedules = result.scalars().all()

    for schedule in schedules:
        if schedule.due_date:
            # Get animal name
            animal_result = await db.execute(
                select(Animal).where(Animal.id == schedule.animal_id)
            )
            animal = animal_result.scalar_one_or_none()
            if animal:
                task = await sync_animal_care_schedule_reminder(
                    db=db,
                    animal_id=animal.id,
                    animal_name=animal.name,
                    schedule_id=schedule.id,
                    schedule_name=schedule.name,
                    due_date=schedule.due_date,
                    notes=schedule.notes,
                )
                if task:
                    stats["created" if task.created_at == task.updated_at else "updated"] += 1
                else:
                    stats["skipped"] += 1

    logger.info(f"Animal reminder sync: {stats}")
    return stats


async def sync_all_plant_reminders(db: AsyncSession) -> Dict[str, int]:
    """Sync all plant care dates to calendar."""
    from models.plants import Plant

    stats = {"created": 0, "updated": 0, "skipped": 0}

    result = await db.execute(
        select(Plant)
        .where(Plant.is_active == True)
    )
    plants = result.scalars().all()

    for plant in plants:
        # Sync watering
        if plant.next_watering:
            next_water_date = plant.next_watering.date() if isinstance(plant.next_watering, datetime) else plant.next_watering
            task = await sync_plant_watering_reminder(
                db=db,
                plant_id=plant.id,
                plant_name=plant.name,
                next_watering=next_water_date,
                location=plant.location,
            )
            if task:
                stats["created" if task.created_at == task.updated_at else "updated"] += 1
            else:
                stats["skipped"] += 1

        # Sync fertilizing
        if plant.next_fertilizing:
            next_fert_date = plant.next_fertilizing.date() if isinstance(plant.next_fertilizing, datetime) else plant.next_fertilizing
            task = await sync_plant_fertilizing_reminder(
                db=db,
                plant_id=plant.id,
                plant_name=plant.name,
                next_fertilizing=next_fert_date,
                location=plant.location,
            )
            if task:
                stats["created" if task.created_at == task.updated_at else "updated"] += 1
            else:
                stats["skipped"] += 1

    logger.info(f"Plant reminder sync: {stats}")
    return stats
