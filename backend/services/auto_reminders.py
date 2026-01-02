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
        category=TaskCategory.ANIMAL_CARE,
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
        category=TaskCategory.ANIMAL_CARE,
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
# Grouped Reminder Functions
# ============================================

async def create_or_update_grouped_reminder(
    db: AsyncSession,
    source_type: str,  # e.g., "slaughter_group", "care_group"
    group_key: str,  # e.g., "2026-01-15" for date-based grouping
    title: str,
    due_date: date,
    description: str = None,
    location: str = None,
    category: TaskCategory = TaskCategory.OTHER,
    notification_setting_key: str = None,
) -> Optional[Task]:
    """Create or update a grouped calendar reminder.

    Uses a composite key (source_type + group_key) to create one reminder
    for multiple items on the same date.
    """
    if not notification_setting_key:
        return None

    # Check if calendar notifications are enabled for this type
    channels = await get_notification_channels(db, notification_setting_key)
    if not channels.get("calendar"):
        logger.debug(f"Calendar notifications disabled for {notification_setting_key}")
        return None

    # Look for existing grouped task
    source_key = f"auto:{source_type}:{group_key}"
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

        logger.debug(f"Updated grouped reminder: {title}")
        return existing_task
    else:
        # Create new task
        new_task = Task(
            title=title,
            description=description,
            due_date=due_date,
            location=location,
            category=category,
            task_type=TaskType.TODO,
            priority=2,
            notes=f"{source_key}",
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

        logger.info(f"Created grouped reminder: {title}")
        return new_task


# ============================================
# Bulk Sync Functions
# ============================================

async def sync_all_animal_reminders(db: AsyncSession) -> Dict[str, int]:
    """Sync all animal care schedules and slaughter dates to calendar.

    Groups reminders by date to avoid duplicate entries for the same date.
    Also cleans up old individual reminders that are no longer needed.
    """
    from models.livestock import Animal, AnimalCareSchedule, AnimalCategory
    from collections import defaultdict

    stats = {"created": 0, "updated": 0, "skipped": 0, "cleaned": 0}

    # First, clean up old individual reminders (non-grouped)
    # Delete any tasks with notes containing "auto:animal_slaughter:" or "auto:animal_care_schedule:"
    old_individual_result = await db.execute(
        select(Task).where(
            Task.is_active == True,
            Task.notes.isnot(None)
        )
    )
    old_tasks = old_individual_result.scalars().all()

    calendar_service = await get_calendar_service(db)

    for task in old_tasks:
        if task.notes and (
            "auto:animal_slaughter:" in task.notes or
            "auto:animal_care_schedule:" in task.notes
        ):
            # This is an old individual reminder - delete it
            if calendar_service and calendar_service.connect():
                await calendar_service.delete_task_from_calendar(
                    task.id,
                    calendar_uid=task.calendar_uid
                )
            task.is_active = False
            stats["cleaned"] += 1
            logger.debug(f"Cleaned up old individual reminder: {task.title}")

    await db.commit()

    # Get all active animals
    result = await db.execute(
        select(Animal)
        .where(Animal.is_active == True)
    )
    animals = result.scalars().all()

    # Group slaughter dates by date and processor
    slaughter_groups = defaultdict(list)
    for animal in animals:
        if animal.category == AnimalCategory.LIVESTOCK and animal.slaughter_date:
            key = (animal.slaughter_date, animal.processor or "")
            slaughter_groups[key].append(animal)

    # Create one reminder per slaughter date/processor combo
    for (slaughter_date, processor), group_animals in slaughter_groups.items():
        if len(group_animals) == 1:
            # Single animal - use specific name
            animal = group_animals[0]
            title = f"Slaughter: {animal.name}"
            description = f"Slaughter scheduled for {animal.name}"
        else:
            # Multiple animals - group them
            names = ", ".join(a.name for a in group_animals)
            title = f"Slaughter: {len(group_animals)} animals"
            description = f"Slaughter scheduled for: {names}"

        if processor:
            description += f"\nProcessor: {processor}"

        # Use date + processor as group key
        group_key = f"{slaughter_date.isoformat()}_{processor}"
        task = await create_or_update_grouped_reminder(
            db=db,
            source_type="slaughter_group",
            group_key=group_key,
            title=title,
            due_date=slaughter_date,
            description=description,
            location=processor,
            category=TaskCategory.ANIMAL_CARE,
            notification_setting_key="notify_animal_slaughter",
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

    # Group care schedules by date and care type
    care_groups = defaultdict(list)
    for schedule in schedules:
        if schedule.due_date:
            # Get animal for this schedule
            animal_result = await db.execute(
                select(Animal).where(Animal.id == schedule.animal_id)
            )
            animal = animal_result.scalar_one_or_none()
            if animal:
                # Normalize care name for grouping
                care_name = schedule.name.lower().strip()
                key = (schedule.due_date, care_name)
                care_groups[key].append((animal, schedule))

    # Create one reminder per care type + date
    for (due_date, care_name), group_items in care_groups.items():
        if len(group_items) == 1:
            animal, schedule = group_items[0]
            title = f"{animal.name}: {schedule.name}"
            description = schedule.notes or f"{schedule.name} for {animal.name}"
        else:
            # Multiple animals with same care on same date
            names = ", ".join(a.name for a, s in group_items)
            care_display = group_items[0][1].name  # Use first schedule's name for display
            title = f"{care_display}: {len(group_items)} animals"
            description = f"{care_display} for: {names}"

        # Determine notification setting key
        name_lower = care_name
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
            setting_key = "notify_animal_vet"

        # Use date + care type as group key
        group_key = f"{due_date.isoformat()}_{care_name}"
        task = await create_or_update_grouped_reminder(
            db=db,
            source_type="care_group",
            group_key=group_key,
            title=title,
            due_date=due_date,
            description=description,
            category=TaskCategory.ANIMAL_CARE,
            notification_setting_key=setting_key,
        )
        if task:
            stats["created" if task.created_at == task.updated_at else "updated"] += 1
        else:
            stats["skipped"] += 1

    # Clean up stale grouped reminders (dates that no longer have any animals)
    # Get all active grouped reminder tasks
    grouped_result = await db.execute(
        select(Task).where(
            Task.is_active == True,
            Task.notes.isnot(None)
        )
    )
    grouped_tasks = grouped_result.scalars().all()

    # Build set of valid group keys
    valid_slaughter_keys = set()
    for (slaughter_date, processor), _ in slaughter_groups.items():
        valid_slaughter_keys.add(f"auto:slaughter_group:{slaughter_date.isoformat()}_{processor}")

    valid_care_keys = set()
    for (due_date, care_name), _ in care_groups.items():
        valid_care_keys.add(f"auto:care_group:{due_date.isoformat()}_{care_name}")

    for task in grouped_tasks:
        if not task.notes:
            continue

        # Check if this is a grouped reminder that's no longer valid
        if "auto:slaughter_group:" in task.notes:
            if task.notes not in valid_slaughter_keys:
                if calendar_service and calendar_service.connect():
                    await calendar_service.delete_task_from_calendar(
                        task.id,
                        calendar_uid=task.calendar_uid
                    )
                task.is_active = False
                stats["cleaned"] += 1
                logger.debug(f"Cleaned up stale slaughter group reminder: {task.title}")

        elif "auto:care_group:" in task.notes:
            if task.notes not in valid_care_keys:
                if calendar_service and calendar_service.connect():
                    await calendar_service.delete_task_from_calendar(
                        task.id,
                        calendar_uid=task.calendar_uid
                    )
                task.is_active = False
                stats["cleaned"] += 1
                logger.debug(f"Cleaned up stale care group reminder: {task.title}")

    await db.commit()

    logger.info(f"Animal reminder sync (grouped): {stats}")
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
