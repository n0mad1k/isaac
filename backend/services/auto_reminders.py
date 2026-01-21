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


# Mapping from notification setting keys to alert setting keys
NOTIFICATION_TO_ALERT_KEY = {
    "notify_animal_hoof_trim": "alerts_animal_hoof_trim",
    "notify_animal_worming": "alerts_animal_worming",
    "notify_animal_vaccination": "alerts_animal_vaccination",
    "notify_animal_dental": "alerts_animal_dental",
    "notify_animal_vet": "alerts_animal_vet",
    "notify_animal_slaughter": "alerts_animal_slaughter",
    "notify_animal_labor": "alerts_animal_labor",
    "notify_plant_watering": "alerts_plant_watering",
    "notify_plant_fertilizing": "alerts_plant_fertilizing",
    "notify_plant_harvest": "alerts_plant_harvest",
    "notify_plant_pruning": "alerts_plant_pruning",
    "notify_plant_sow": "alerts_plant_sow",
    "notify_maintenance": "alerts_maintenance",
}


async def get_reminder_alerts_for_category(db: AsyncSession, notification_setting_key: str) -> Optional[list]:
    """Get the reminder alert intervals for a notification category.

    Returns a list of minutes (e.g., [0, 60, 1440]) or None if using default.
    If the category-specific setting is empty, returns None to use the global default.
    """
    alert_key = NOTIFICATION_TO_ALERT_KEY.get(notification_setting_key)
    if not alert_key:
        return None

    # Check for category-specific alert setting
    result = await db.execute(
        select(AppSetting).where(AppSetting.key == alert_key)
    )
    setting = result.scalar_one_or_none()

    if setting and setting.value and setting.value.strip():
        # Parse comma-separated minutes into list
        try:
            alerts = [int(x.strip()) for x in setting.value.split(",") if x.strip()]
            if alerts:
                return alerts
        except ValueError:
            pass

    # No category-specific setting, return None to use default
    return None


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
    due_time: str = None,  # "HH:MM" format
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

    # Get category-specific alert intervals (None = use global default)
    category_alerts = await get_reminder_alerts_for_category(db, notification_setting_key)

    # Look for existing auto-generated task for this source
    # Check for ANY task with this source key (active AND completed) to avoid duplicates
    source_key = f"auto:{source_type}:{source_id}"
    result = await db.execute(
        select(Task).where(
            Task.notes == source_key,  # Use exact match, not contains
        )
    )
    all_matching_tasks = result.scalars().all()

    # Separate into active incomplete, completed, and inactive
    active_incomplete = [t for t in all_matching_tasks if t.is_active and not t.is_completed]
    completed_tasks = [t for t in all_matching_tasks if t.is_completed]

    # Check if there's a completed task for THIS due date
    # For recurring tasks, we should create a new task when the next_due changes
    if completed_tasks:
        # Only skip if a completed task exists with the same due_date as requested
        completed_for_this_date = [
            t for t in completed_tasks
            if t.due_date and t.due_date == due_date
        ]
        if completed_for_this_date:
            logger.debug(f"Skipping reminder for {source_key} - already completed for {due_date}")
            return None
        # If completed task exists but for a different due date, we should create a new one
        logger.debug(f"Completed task exists but for different date, creating new task for {due_date}")

    # Handle duplicates: if multiple active exist, keep the first and deactivate others
    existing_task = None
    if active_incomplete:
        existing_task = active_incomplete[0]
        for dup in active_incomplete[1:]:
            dup.is_active = False
            logger.warning(f"Deactivated duplicate reminder: {dup.id} ({dup.title})")

    if existing_task:
        # Update existing task including due_date when source date changes
        existing_task.title = title
        existing_task.due_date = due_date
        existing_task.description = description
        existing_task.location = location
        existing_task.category = category
        if due_time:
            existing_task.due_time = due_time
        # Update reminder_alerts if category has specific settings
        existing_task.reminder_alerts = category_alerts
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
            due_time=due_time,
            location=location,
            category=category,
            task_type=TaskType.TODO,  # Use TODO for reminders
            priority=2,  # Medium-high priority
            notes=f"{source_key}",  # Store source reference
            reminder_alerts=category_alerts,  # Per-category alert intervals
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
            Task.notes == source_key,  # Use exact match
            Task.is_active == True
        )
    )
    tasks = result.scalars().all()

    # Handle any task (including duplicates) - delete ALL matching tasks
    if tasks:
        calendar_service = await get_calendar_service(db)
        for task in tasks:
            # Delete from calendar first
            if calendar_service and calendar_service.connect():
                await calendar_service.delete_task_from_calendar(
                    task.id,
                    calendar_uid=task.calendar_uid
                )
            # Soft delete the task
            task.is_active = False

        await db.commit()
        logger.debug(f"Deleted {len(tasks)} auto-reminder(s) for {source_key}")
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
    due_time: str = None,  # "HH:MM" format
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
        due_time=due_time,
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
    due_time: str = None,  # "HH:MM" format
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

    # Get category-specific alert intervals (None = use global default)
    category_alerts = await get_reminder_alerts_for_category(db, notification_setting_key)

    # Look for existing grouped task
    # Check for ANY task with this source key (active AND completed) to avoid duplicates
    source_key = f"auto:{source_type}:{group_key}"
    result = await db.execute(
        select(Task).where(
            Task.notes == source_key,  # Use exact match, not contains
        )
    )
    all_matching_tasks = result.scalars().all()

    # Separate into active incomplete, completed, and inactive
    active_incomplete = [t for t in all_matching_tasks if t.is_active and not t.is_completed]
    completed_tasks = [t for t in all_matching_tasks if t.is_completed]

    # If there's a completed task, don't create a new one - the task was done
    if completed_tasks:
        logger.debug(f"Skipping grouped reminder for {source_key} - already completed (task {completed_tasks[0].id})")
        return None

    # Handle duplicates: if multiple active exist, keep the first and deactivate others
    existing_task = None
    if active_incomplete:
        existing_task = active_incomplete[0]
        for dup in active_incomplete[1:]:
            dup.is_active = False
            logger.warning(f"Deactivated duplicate grouped reminder: {dup.id} ({dup.title})")

    if existing_task:
        # Update existing task including due_date when source date changes
        existing_task.title = title
        existing_task.due_date = due_date
        existing_task.description = description
        existing_task.location = location
        existing_task.category = category
        if due_time:
            existing_task.due_time = due_time
        # Update reminder_alerts if category has specific settings
        existing_task.reminder_alerts = category_alerts
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
            due_time=due_time,
            location=location,
            category=category,
            task_type=TaskType.TODO,
            priority=2,
            notes=f"{source_key}",
            reminder_alerts=category_alerts,  # Per-category alert intervals
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
        # Set original_due_date if not set and we have a frequency but no last_performed
        # This prevents the due date from resetting to "today" every sync
        if schedule.frequency_days and not schedule.last_performed and not schedule.original_due_date:
            schedule.original_due_date = date.today()
            logger.debug(f"Set original_due_date for schedule {schedule.id} ({schedule.name}) to {schedule.original_due_date}")

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
        # Use the first schedule's due_time (if any)
        first_due_time = group_items[0][1].due_time if group_items else None
        task = await create_or_update_grouped_reminder(
            db=db,
            source_type="care_group",
            group_key=group_key,
            title=title,
            due_date=due_date,
            description=description,
            category=TaskCategory.ANIMAL_CARE,
            notification_setting_key=setting_key,
            due_time=first_due_time,
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
    """Sync all plant care dates to calendar.

    Groups reminders by date and location to avoid duplicate entries.
    Creates one reminder per care type (water/fertilize) per date per location.
    """
    from models.plants import Plant
    from collections import defaultdict

    stats = {"created": 0, "updated": 0, "skipped": 0, "cleaned": 0}

    # First, clean up old individual plant reminders (non-grouped)
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
            "auto:plant_watering:" in task.notes or
            "auto:plant_fertilizing:" in task.notes or
            "auto:plant_harvest:" in task.notes
        ):
            # This is an old individual plant reminder - delete it
            if calendar_service and calendar_service.connect():
                await calendar_service.delete_task_from_calendar(
                    task.id,
                    calendar_uid=task.calendar_uid
                )
            task.is_active = False
            stats["cleaned"] += 1
            logger.debug(f"Cleaned up old individual plant reminder: {task.title}")

    await db.commit()

    # Get all active plants
    result = await db.execute(
        select(Plant)
        .where(Plant.is_active == True)
    )
    plants = result.scalars().all()

    # Group plants by (care_type, due_date, location)
    watering_groups = defaultdict(list)  # (date, location) -> [plants]
    fertilizing_groups = defaultdict(list)  # (date, location) -> [plants]

    for plant in plants:
        location = plant.location or "Unknown Location"

        # Group watering
        if plant.next_watering:
            next_water_date = plant.next_watering.date() if isinstance(plant.next_watering, datetime) else plant.next_watering
            key = (next_water_date, location)
            watering_groups[key].append(plant)

        # Group fertilizing
        if plant.next_fertilizing:
            next_fert_date = plant.next_fertilizing.date() if isinstance(plant.next_fertilizing, datetime) else plant.next_fertilizing
            key = (next_fert_date, location)
            fertilizing_groups[key].append(plant)

    # Create one reminder per watering group
    for (due_date, location), group_plants in watering_groups.items():
        if len(group_plants) == 1:
            # Single plant - use specific name
            plant = group_plants[0]
            title = f"Water: {plant.name}"
            description = f"Water {plant.name}"
            if plant.location:
                description += f" ({plant.location})"
        else:
            # Multiple plants - group them by location
            title = f"Water: {location}"
            plant_names = [p.name for p in group_plants]
            description = f"Water the following plants:\n• " + "\n• ".join(plant_names)

        # Use date + location as group key (sanitize location for key)
        location_key = location.lower().replace(" ", "_").replace("/", "_")
        group_key = f"{due_date.isoformat()}_water_{location_key}"
        task = await create_or_update_grouped_reminder(
            db=db,
            source_type="plant_water_group",
            group_key=group_key,
            title=title,
            due_date=due_date,
            description=description,
            location=location,
            category=TaskCategory.GARDEN,
            notification_setting_key="notify_plant_watering",
        )
        if task:
            stats["created" if task.created_at == task.updated_at else "updated"] += 1
        else:
            stats["skipped"] += 1

    # Create one reminder per fertilizing group
    for (due_date, location), group_plants in fertilizing_groups.items():
        if len(group_plants) == 1:
            # Single plant - use specific name
            plant = group_plants[0]
            title = f"Fertilize: {plant.name}"
            description = f"Fertilize {plant.name}"
            if plant.location:
                description += f" ({plant.location})"
        else:
            # Multiple plants - group them by location
            title = f"Fertilize: {location}"
            plant_names = [p.name for p in group_plants]
            description = f"Fertilize the following plants:\n• " + "\n• ".join(plant_names)

        # Use date + location as group key
        location_key = location.lower().replace(" ", "_").replace("/", "_")
        group_key = f"{due_date.isoformat()}_fertilize_{location_key}"
        task = await create_or_update_grouped_reminder(
            db=db,
            source_type="plant_fertilize_group",
            group_key=group_key,
            title=title,
            due_date=due_date,
            description=description,
            location=location,
            category=TaskCategory.GARDEN,
            notification_setting_key="notify_plant_fertilizing",
        )
        if task:
            stats["created" if task.created_at == task.updated_at else "updated"] += 1
        else:
            stats["skipped"] += 1

    # Clean up stale grouped plant reminders (dates/locations that no longer have plants)
    grouped_result = await db.execute(
        select(Task).where(
            Task.is_active == True,
            Task.notes.isnot(None)
        )
    )
    grouped_tasks = grouped_result.scalars().all()

    # Build set of valid group keys
    valid_water_keys = set()
    for (due_date, location), _ in watering_groups.items():
        location_key = location.lower().replace(" ", "_").replace("/", "_")
        valid_water_keys.add(f"auto:plant_water_group:{due_date.isoformat()}_water_{location_key}")

    valid_fertilize_keys = set()
    for (due_date, location), _ in fertilizing_groups.items():
        location_key = location.lower().replace(" ", "_").replace("/", "_")
        valid_fertilize_keys.add(f"auto:plant_fertilize_group:{due_date.isoformat()}_fertilize_{location_key}")

    for task in grouped_tasks:
        if not task.notes:
            continue

        # Check if this is a grouped plant reminder that's no longer valid
        if "auto:plant_water_group:" in task.notes:
            if task.notes not in valid_water_keys:
                if calendar_service and calendar_service.connect():
                    await calendar_service.delete_task_from_calendar(
                        task.id,
                        calendar_uid=task.calendar_uid
                    )
                task.is_active = False
                stats["cleaned"] += 1
                logger.debug(f"Cleaned up stale plant water group reminder: {task.title}")

        elif "auto:plant_fertilize_group:" in task.notes:
            if task.notes not in valid_fertilize_keys:
                if calendar_service and calendar_service.connect():
                    await calendar_service.delete_task_from_calendar(
                        task.id,
                        calendar_uid=task.calendar_uid
                    )
                task.is_active = False
                stats["cleaned"] += 1
                logger.debug(f"Cleaned up stale plant fertilize group reminder: {task.title}")

    await db.commit()

    logger.info(f"Plant reminder sync (grouped): {stats}")
    return stats


# ============================================
# Maintenance Auto-Reminders (Vehicles, Equipment, Home, Farm Areas)
# ============================================

async def sync_all_maintenance_reminders(db: AsyncSession) -> Dict[str, int]:
    """Sync all maintenance tasks (vehicles, equipment, home, farm areas) to calendar."""
    from models.vehicles import Vehicle, VehicleMaintenance
    from models.equipment import Equipment, EquipmentMaintenance
    from models.home_maintenance import HomeMaintenance
    from models.farm_areas import FarmArea, FarmAreaMaintenance
    from collections import defaultdict

    stats = {"created": 0, "updated": 0, "skipped": 0, "cleaned": 0}
    calendar_service = await get_calendar_service(db)
    today = date.today()

    # Get all valid maintenance keys for cleanup later
    valid_maint_keys = set()

    # --- Vehicle Maintenance ---
    result = await db.execute(
        select(VehicleMaintenance)
        .where(VehicleMaintenance.is_active == True)
    )
    vehicle_maint_tasks = result.scalars().all()

    for maint in vehicle_maint_tasks:
        due_date = maint.manual_due_date or maint.next_due_date
        if not due_date:
            continue

        # Get vehicle name
        vehicle_result = await db.execute(
            select(Vehicle).where(Vehicle.id == maint.vehicle_id)
        )
        vehicle = vehicle_result.scalar_one_or_none()
        if not vehicle:
            continue

        due_date_obj = due_date.date() if isinstance(due_date, datetime) else due_date
        source_key = f"vehicle_maint:{maint.id}"
        valid_maint_keys.add(f"auto:{source_key}")

        title = f"{vehicle.name}: {maint.name}"
        description = maint.notes or f"Vehicle maintenance: {maint.name}"
        if maint.frequency_miles:
            description += f"\nEvery {maint.frequency_miles} miles"
        if maint.frequency_days:
            description += f"\nEvery {maint.frequency_days} days"

        task = await create_or_update_reminder(
            db=db,
            source_type="vehicle_maint",
            source_id=maint.id,
            title=title,
            due_date=due_date_obj,
            description=description,
            category=TaskCategory.EQUIPMENT,
            notification_setting_key="notify_maintenance",
        )
        if task:
            stats["created" if task.created_at == task.updated_at else "updated"] += 1
        else:
            stats["skipped"] += 1

    # --- Equipment Maintenance ---
    result = await db.execute(
        select(EquipmentMaintenance)
        .where(EquipmentMaintenance.is_active == True)
    )
    equipment_maint_tasks = result.scalars().all()

    for maint in equipment_maint_tasks:
        due_date = maint.manual_due_date or maint.next_due_date
        if not due_date:
            continue

        # Get equipment name
        equip_result = await db.execute(
            select(Equipment).where(Equipment.id == maint.equipment_id)
        )
        equipment = equip_result.scalar_one_or_none()
        if not equipment:
            continue

        due_date_obj = due_date.date() if isinstance(due_date, datetime) else due_date
        source_key = f"equipment_maint:{maint.id}"
        valid_maint_keys.add(f"auto:{source_key}")

        title = f"{equipment.name}: {maint.name}"
        description = maint.notes or f"Equipment maintenance: {maint.name}"
        if maint.frequency_hours:
            description += f"\nEvery {maint.frequency_hours} hours"
        if maint.frequency_days:
            description += f"\nEvery {maint.frequency_days} days"

        task = await create_or_update_reminder(
            db=db,
            source_type="equipment_maint",
            source_id=maint.id,
            title=title,
            due_date=due_date_obj,
            description=description,
            category=TaskCategory.EQUIPMENT,
            notification_setting_key="notify_maintenance",
        )
        if task:
            stats["created" if task.created_at == task.updated_at else "updated"] += 1
        else:
            stats["skipped"] += 1

    # --- Home Maintenance ---
    result = await db.execute(
        select(HomeMaintenance)
        .where(HomeMaintenance.is_active == True)
    )
    home_maint_tasks = result.scalars().all()

    for maint in home_maint_tasks:
        due_date = maint.manual_due_date or maint.next_due
        if not due_date:
            continue

        due_date_obj = due_date.date() if isinstance(due_date, datetime) else due_date

        # If next_due is more than frequency_days in the past, recalculate to avoid
        # creating very old overdue tasks that were likely missed
        if maint.frequency_days and not maint.manual_due_date:
            days_overdue = (today - due_date_obj).days
            if days_overdue > maint.frequency_days:
                # Calculate next due date from today
                # This prevents creating tasks for e.g., 2 weeks ago
                maint.next_due = datetime.combine(today, datetime.min.time())
                due_date_obj = today
                logger.info(f"Reset stale next_due for {maint.name} from {days_overdue} days ago to today")

        source_key = f"home_maint:{maint.id}"
        valid_maint_keys.add(f"auto:{source_key}")

        title = f"Home: {maint.name}"
        description = maint.description or maint.notes or f"Home maintenance: {maint.name}"
        if maint.frequency_label:
            description += f"\n{maint.frequency_label}"

        task = await create_or_update_reminder(
            db=db,
            source_type="home_maint",
            source_id=maint.id,
            title=title,
            due_date=due_date_obj,
            description=description,
            category=TaskCategory.HOME_MAINTENANCE,
            notification_setting_key="notify_maintenance",
        )
        if task:
            stats["created" if task.created_at == task.updated_at else "updated"] += 1
        else:
            stats["skipped"] += 1

    # --- Farm Area Maintenance ---
    result = await db.execute(
        select(FarmAreaMaintenance)
        .where(FarmAreaMaintenance.is_active == True)
    )
    farm_maint_tasks = result.scalars().all()

    for maint in farm_maint_tasks:
        due_date = maint.manual_due_date or maint.next_due
        if not due_date:
            continue

        # Get farm area name
        area_result = await db.execute(
            select(FarmArea).where(FarmArea.id == maint.area_id)
        )
        area = area_result.scalar_one_or_none()
        if not area:
            continue

        due_date_obj = due_date.date() if isinstance(due_date, datetime) else due_date
        source_key = f"farm_maint:{maint.id}"
        valid_maint_keys.add(f"auto:{source_key}")

        title = f"{area.name}: {maint.name}"
        description = maint.notes or f"Farm area maintenance: {maint.name}"
        if maint.frequency_label:
            description += f"\n{maint.frequency_label}"

        task = await create_or_update_reminder(
            db=db,
            source_type="farm_maint",
            source_id=maint.id,
            title=title,
            due_date=due_date_obj,
            description=description,
            category=TaskCategory.GARDEN,
            notification_setting_key="notify_maintenance",
        )
        if task:
            stats["created" if task.created_at == task.updated_at else "updated"] += 1
        else:
            stats["skipped"] += 1

    # --- Cleanup stale maintenance reminders ---
    result = await db.execute(
        select(Task).where(
            Task.is_active == True,
            Task.notes.isnot(None)
        )
    )
    all_tasks = result.scalars().all()

    for task in all_tasks:
        if not task.notes:
            continue

        # Check for maintenance auto-reminders that are no longer valid
        for prefix in ["auto:vehicle_maint:", "auto:equipment_maint:", "auto:home_maint:", "auto:farm_maint:"]:
            if prefix in task.notes:
                if task.notes not in valid_maint_keys:
                    if calendar_service and calendar_service.connect():
                        await calendar_service.delete_task_from_calendar(
                            task.id,
                            calendar_uid=task.calendar_uid
                        )
                    task.is_active = False
                    stats["cleaned"] += 1
                    logger.debug(f"Cleaned up stale maintenance reminder: {task.title}")
                break

    await db.commit()

    logger.info(f"Maintenance reminder sync: {stats}")
    return stats
