"""
Task and Reminder API Routes
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from typing import List, Optional
from datetime import datetime, date, timedelta
from pydantic import BaseModel, Field, field_validator

from models.database import get_db
from models.tasks import Task, TaskCategory, TaskRecurrence, TaskType, FLORIDA_MAINTENANCE_TASKS, task_member_assignments
from models.users import User
from models.team import TeamMember
from services.permissions import require_permission, require_view, require_create, require_interact, require_edit, require_delete
from models.farm_areas import FarmArea
from models.vehicles import Vehicle
from models.equipment import Equipment
from models.home_maintenance import HomeMaintenance
from models.livestock import Animal, AnimalCareSchedule
from models.plants import Plant
from services.calendar_sync import get_calendar_service
from loguru import logger
import re


router = APIRouter(prefix="/tasks", tags=["Tasks"])


async def enrich_tasks_with_linked_fields(tasks: list, db: AsyncSession) -> list:
    """Add linked_location and linked_entity computed fields to tasks."""
    if not tasks:
        return tasks

    # Pre-fetch lookup tables
    result = await db.execute(select(FarmArea))
    farm_areas = {fa.id: fa.name for fa in result.scalars().all()}
    result = await db.execute(select(Vehicle))
    vehicles = {v.id: v.model for v in result.scalars().all()}
    result = await db.execute(select(Equipment))
    equipment = {e.id: e.name for e in result.scalars().all()}
    result = await db.execute(select(HomeMaintenance))
    home_maint = {hm.id: hm for hm in result.scalars().all()}
    result = await db.execute(select(Animal))
    animals_list = result.scalars().all()
    result = await db.execute(select(Plant))
    plants_list = result.scalars().all()
    result = await db.execute(select(AnimalCareSchedule).where(AnimalCareSchedule.is_active == True))
    care_schedules = result.scalars().all()
    # Pre-fetch team members for assignment display
    from models.team import TeamMember
    result = await db.execute(select(TeamMember))
    team_members = {tm.id: (tm.nickname or tm.name) for tm in result.scalars().all()}

    def get_linked_location(task):
        if task.farm_area_id and task.farm_area_id in farm_areas:
            return farm_areas[task.farm_area_id]
        if task.notes:
            if "auto:home_maint:" in task.notes:
                match = re.search(r'auto:home_maint:(\d+)', task.notes)
                if match:
                    hm_id = int(match.group(1))
                    if hm_id in home_maint:
                        hm = home_maint[hm_id]
                        return hm.area_or_appliance or (hm.category.title() if hm.category else None)
            if "auto:care_group:" in task.notes:
                match = re.search(r'auto:care_group:(\d{4}-\d{2}-\d{2})_(.+)', task.notes)
                if match:
                    care_name = match.group(2).lower().strip()
                    matching = [s for s in care_schedules if s.name.lower().strip() == care_name]
                    if matching:
                        names = []
                        seen = set()
                        for s in matching:
                            a = next((x for x in animals_list if x.id == s.animal_id), None)
                            if a and a.farm_area_id and a.farm_area_id not in seen:
                                seen.add(a.farm_area_id)
                                if a.farm_area_id in farm_areas:
                                    names.append(farm_areas[a.farm_area_id])
                        if names:
                            return ", ".join(names)
        if task.animal_id:
            a = next((x for x in animals_list if x.id == task.animal_id), None)
            if a and a.farm_area_id and a.farm_area_id in farm_areas:
                return farm_areas[a.farm_area_id]
        if task.plant_id:
            p = next((x for x in plants_list if x.id == task.plant_id), None)
            if p and p.farm_area_id and p.farm_area_id in farm_areas:
                return farm_areas[p.farm_area_id]
        return None

    def get_linked_entity(task):
        if task.vehicle_id and task.vehicle_id in vehicles:
            return f"Vehicle: {vehicles[task.vehicle_id]}"
        if task.equipment_id and task.equipment_id in equipment:
            return f"Equipment: {equipment[task.equipment_id]}"
        return None

    # Enrich each task
    enriched = []
    for task in tasks:
        task_dict = {
            "id": task.id,
            "title": task.title,
            "description": task.description,
            "task_type": task.task_type,
            "category": task.category,
            "due_date": task.due_date,
            "end_date": task.end_date,
            "due_time": task.due_time,
            "end_time": task.end_time,
            "location": task.location,
            "recurrence": task.recurrence,
            "priority": task.priority,
            "is_completed": task.is_completed,
            "completed_at": task.completed_at,
            "plant_id": task.plant_id,
            "animal_id": task.animal_id,
            "vehicle_id": task.vehicle_id,
            "equipment_id": task.equipment_id,
            "farm_area_id": task.farm_area_id,
            "weather_dependent": task.weather_dependent,
            "is_active": task.is_active,
            "is_backlog": task.is_backlog,
            "notes": task.notes,
            "created_at": task.created_at,
            "linked_location": get_linked_location(task),
            "linked_entity": get_linked_entity(task),
            "assigned_to_worker_id": task.assigned_to_worker_id,
            "assigned_to_user_id": task.assigned_to_user_id,
            "assigned_to_member_id": task.assigned_to_member_id,
            "assigned_to_member_name": team_members.get(task.assigned_to_member_id) if task.assigned_to_member_id else None,
            "assigned_member_ids": [m.id for m in task.assigned_members] if hasattr(task, 'assigned_members') and task.assigned_members else [],
            "assigned_member_names": [m.nickname or m.name for m in task.assigned_members] if hasattr(task, 'assigned_members') and task.assigned_members else [],
            "is_blocked": task.is_blocked,
            "blocked_reason": task.blocked_reason,
            "completion_note": task.completion_note,
        }
        enriched.append(task_dict)
    return enriched


async def update_source_entity_on_complete(db: AsyncSession, notes: str):
    """Update the source entity's last_performed/last_completed date when an auto-reminder is completed.

    Notes format: "auto:source_type:source_id" or "auto:source_type:group_key"
    """
    try:
        parts = notes.split(":", 2)
        if len(parts) < 3:
            return

        _, source_type, source_id_or_key = parts
        today = date.today()
        now = datetime.utcnow()

        # Plant watering
        if source_type == "plant_watering":
            from models.plants import Plant
            plant_id = int(source_id_or_key)
            result = await db.execute(select(Plant).where(Plant.id == plant_id))
            plant = result.scalar_one_or_none()
            if plant:
                plant.last_watered = now
                # Recalculate next_watering based on watering_frequency
                if plant.watering_frequency:
                    plant.next_watering = now + timedelta(days=plant.watering_frequency)
                logger.info(f"Updated Plant {plant.name} last_watered to {today}")

        # Plant fertilizing
        elif source_type == "plant_fertilizing":
            from models.plants import Plant
            plant_id = int(source_id_or_key)
            result = await db.execute(select(Plant).where(Plant.id == plant_id))
            plant = result.scalar_one_or_none()
            if plant:
                plant.last_fertilized = now
                # Recalculate next_fertilizing based on fertilizing_frequency
                if plant.fertilizing_frequency:
                    plant.next_fertilizing = now + timedelta(days=plant.fertilizing_frequency)
                logger.info(f"Updated Plant {plant.name} last_fertilized to {today}")

        # Vehicle maintenance
        elif source_type == "vehicle_maint":
            from models.vehicles import VehicleMaintenance, Vehicle
            maint_id = int(source_id_or_key)
            result = await db.execute(select(VehicleMaintenance).where(VehicleMaintenance.id == maint_id))
            maint = result.scalar_one_or_none()
            if maint:
                # Get current mileage from vehicle if available
                vehicle_result = await db.execute(select(Vehicle).where(Vehicle.id == maint.vehicle_id))
                vehicle = vehicle_result.scalar_one_or_none()

                maint.last_completed = now
                if vehicle:
                    maint.last_mileage = vehicle.current_mileage
                    maint.last_hours = vehicle.current_hours

                # Recalculate next due
                if maint.frequency_days:
                    maint.next_due_date = now + timedelta(days=maint.frequency_days)
                if maint.frequency_miles and vehicle and vehicle.current_mileage:
                    maint.next_due_mileage = vehicle.current_mileage + maint.frequency_miles
                if maint.frequency_hours and vehicle and vehicle.current_hours:
                    maint.next_due_hours = vehicle.current_hours + maint.frequency_hours
                maint.manual_due_date = None  # Clear manual override
                logger.info(f"Updated VehicleMaintenance {maint.name} last_completed to {today}")

        # Equipment maintenance
        elif source_type == "equipment_maint":
            from models.equipment import EquipmentMaintenance, Equipment
            maint_id = int(source_id_or_key)
            result = await db.execute(select(EquipmentMaintenance).where(EquipmentMaintenance.id == maint_id))
            maint = result.scalar_one_or_none()
            if maint:
                # Get current hours from equipment if available
                equip_result = await db.execute(select(Equipment).where(Equipment.id == maint.equipment_id))
                equipment = equip_result.scalar_one_or_none()

                maint.last_completed = now
                if equipment:
                    maint.last_hours = equipment.current_hours

                # Recalculate next due
                if maint.frequency_days:
                    maint.next_due_date = now + timedelta(days=maint.frequency_days)
                if maint.frequency_hours and equipment and equipment.current_hours:
                    maint.next_due_hours = equipment.current_hours + maint.frequency_hours
                maint.manual_due_date = None  # Clear manual override
                logger.info(f"Updated EquipmentMaintenance {maint.name} last_completed to {today}")

        # Home maintenance
        elif source_type == "home_maint":
            from models.home_maintenance import HomeMaintenance
            maint_id = int(source_id_or_key)
            result = await db.execute(select(HomeMaintenance).where(HomeMaintenance.id == maint_id))
            maint = result.scalar_one_or_none()
            if maint:
                maint.last_completed = now
                maint.calculate_next_due()
                logger.info(f"Updated HomeMaintenance {maint.name} last_completed to {today}")

        # Farm area maintenance
        elif source_type == "farm_maint":
            from models.farm_areas import FarmAreaMaintenance
            maint_id = int(source_id_or_key)
            result = await db.execute(select(FarmAreaMaintenance).where(FarmAreaMaintenance.id == maint_id))
            maint = result.scalar_one_or_none()
            if maint:
                maint.last_completed = now
                maint.calculate_next_due()
                logger.info(f"Updated FarmAreaMaintenance {maint.name} last_completed to {today}")

        # Animal care schedule (individual)
        elif source_type == "animal_care_schedule":
            from models.livestock import AnimalCareSchedule
            schedule_id = int(source_id_or_key)
            result = await db.execute(select(AnimalCareSchedule).where(AnimalCareSchedule.id == schedule_id))
            schedule = result.scalar_one_or_none()
            if schedule:
                schedule.last_performed = today
                # Clear manual_due_date so next due is calculated from last_performed
                schedule.manual_due_date = None
                logger.info(f"Updated AnimalCareSchedule {schedule.name} last_performed to {today}")

        # Grouped care (care_group:date_carename)
        elif source_type == "care_group":
            from models.livestock import AnimalCareSchedule
            # group_key format: "2026-01-15_worming"
            parts = source_id_or_key.split("_", 1)
            if len(parts) == 2:
                due_date_str, care_name = parts
                try:
                    group_due_date = date.fromisoformat(due_date_str)
                    # Find all care schedules with this name and due date
                    result = await db.execute(
                        select(AnimalCareSchedule).where(
                            AnimalCareSchedule.is_active == True,
                        )
                    )
                    schedules = result.scalars().all()
                    updated_count = 0
                    for schedule in schedules:
                        if schedule.name.lower().strip() == care_name and schedule.due_date == group_due_date:
                            schedule.last_performed = today
                            # BUGFIX: Clear manual_due_date so next due is calculated from last_performed
                            schedule.manual_due_date = None
                            updated_count += 1
                    logger.info(f"Updated {updated_count} AnimalCareSchedules for care_group {care_name} on {due_date_str}")
                except ValueError:
                    pass

        # Grouped slaughter (slaughter_group:date_processor)
        elif source_type == "slaughter_group":
            # For slaughter, we don't update anything - animals are processed and typically removed
            logger.debug(f"Slaughter group completed: {source_id_or_key}")

        # Grouped plant watering (plant_water_group:date_water_location)
        elif source_type == "plant_water_group":
            from models.plants import Plant
            # group_key format: "2026-01-05_water_front_yard"
            parts = source_id_or_key.split("_water_", 1)
            if len(parts) == 2:
                due_date_str, location_key = parts
                try:
                    group_due_date = date.fromisoformat(due_date_str)
                    # Find all active plants in this location with this watering date
                    result = await db.execute(
                        select(Plant).where(Plant.is_active == True)
                    )
                    plants = result.scalars().all()
                    updated_count = 0
                    for plant in plants:
                        plant_location = plant.location or "Unknown Location"
                        plant_location_key = plant_location.lower().replace(" ", "_").replace("/", "_")
                        if plant_location_key == location_key and plant.next_watering:
                            next_water_date = plant.next_watering.date() if isinstance(plant.next_watering, datetime) else plant.next_watering
                            if next_water_date == group_due_date:
                                plant.last_watered = now
                                if plant.watering_frequency:
                                    plant.next_watering = now + timedelta(days=plant.watering_frequency)
                                updated_count += 1
                    logger.info(f"Updated {updated_count} plants for plant_water_group at {location_key} on {due_date_str}")
                except ValueError:
                    pass

        # Grouped plant fertilizing (plant_fertilize_group:date_fertilize_location)
        elif source_type == "plant_fertilize_group":
            from models.plants import Plant
            # group_key format: "2026-01-05_fertilize_front_yard"
            parts = source_id_or_key.split("_fertilize_", 1)
            if len(parts) == 2:
                due_date_str, location_key = parts
                try:
                    group_due_date = date.fromisoformat(due_date_str)
                    # Find all active plants in this location with this fertilizing date
                    result = await db.execute(
                        select(Plant).where(Plant.is_active == True)
                    )
                    plants = result.scalars().all()
                    updated_count = 0
                    for plant in plants:
                        plant_location = plant.location or "Unknown Location"
                        plant_location_key = plant_location.lower().replace(" ", "_").replace("/", "_")
                        if plant_location_key == location_key and plant.next_fertilizing:
                            next_fert_date = plant.next_fertilizing.date() if isinstance(plant.next_fertilizing, datetime) else plant.next_fertilizing
                            if next_fert_date == group_due_date:
                                plant.last_fertilized = now
                                if plant.fertilizing_frequency:
                                    plant.next_fertilizing = now + timedelta(days=plant.fertilizing_frequency)
                                updated_count += 1
                    logger.info(f"Updated {updated_count} plants for plant_fertilize_group at {location_key} on {due_date_str}")
                except ValueError:
                    pass

        # Gear maintenance
        elif source_type == "gear_maint":
            from models.team import MemberGearMaintenance
            maint_id = int(source_id_or_key)
            result = await db.execute(select(MemberGearMaintenance).where(MemberGearMaintenance.id == maint_id))
            maint = result.scalar_one_or_none()
            if maint:
                maint.last_performed = now
                maint.manual_due_date = None  # Clear manual override
                if maint.frequency_days:
                    maint.next_due_date = now + timedelta(days=maint.frequency_days)
                logger.info(f"Updated MemberGearMaintenance {maint.name} last_performed to {today}")

        # Gear expiration (just mark the reminder as complete, user should update content)
        elif source_type == "gear_exp":
            from models.team import MemberGearContents
            content_id = int(source_id_or_key)
            result = await db.execute(select(MemberGearContents).where(MemberGearContents.id == content_id))
            content = result.scalar_one_or_none()
            if content:
                content.last_checked = now
                logger.info(f"Updated MemberGearContents {content.item_name} last_checked to {today}")

        # Member training
        elif source_type == "member_training":
            from models.team import MemberTraining, MemberTrainingLog
            training_id = int(source_id_or_key)
            result = await db.execute(select(MemberTraining).where(MemberTraining.id == training_id))
            training = result.scalar_one_or_none()
            if training:
                training.last_trained = now
                training.total_sessions = (training.total_sessions or 0) + 1
                if training.frequency_days:
                    training.next_due = now + timedelta(days=training.frequency_days)
                # Create log entry
                log = MemberTrainingLog(
                    training_id=training_id,
                    trained_at=now,
                    notes="Completed via task reminder"
                )
                db.add(log)
                logger.info(f"Updated MemberTraining {training.name} last_trained to {today}")

        # Medical appointment
        elif source_type == "member_medical":
            from models.team import MemberMedicalAppointment
            appt_id = int(source_id_or_key)
            result = await db.execute(select(MemberMedicalAppointment).where(MemberMedicalAppointment.id == appt_id))
            appt = result.scalar_one_or_none()
            if appt:
                appt.last_appointment = now
                if appt.frequency_months:
                    # Add months to calculate next due
                    next_due = now
                    next_due = next_due.replace(
                        year=next_due.year + (next_due.month + appt.frequency_months - 1) // 12,
                        month=(next_due.month + appt.frequency_months - 1) % 12 + 1
                    )
                    appt.next_due = next_due
                logger.info(f"Updated MemberMedicalAppointment {appt.display_type} last_appointment to {today}")

    except Exception as e:
        logger.error(f"Error updating source entity for {notes}: {e}")


# Pydantic Schemas with validation
class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=5000)
    task_type: TaskType = TaskType.TODO
    category: TaskCategory = TaskCategory.CUSTOM
    due_date: Optional[date] = None
    end_date: Optional[date] = None  # End date for multi-day events
    due_time: Optional[str] = Field(None, pattern=r'^([01]?[0-9]|2[0-3]):[0-5][0-9]$')  # HH:MM format
    end_time: Optional[str] = Field(None, pattern=r'^([01]?[0-9]|2[0-3]):[0-5][0-9]$')
    location: Optional[str] = Field(None, max_length=200)
    recurrence: TaskRecurrence = TaskRecurrence.ONCE
    recurrence_interval: Optional[int] = Field(None, ge=1, le=365)
    recurrence_month: Optional[int] = Field(None, ge=1, le=12)
    recurrence_day: Optional[int] = Field(None, ge=1, le=31)
    priority: int = Field(2, ge=1, le=3)
    plant_id: Optional[int] = Field(None, ge=1)
    animal_id: Optional[int] = Field(None, ge=1)
    vehicle_id: Optional[int] = Field(None, ge=1)
    equipment_id: Optional[int] = Field(None, ge=1)
    farm_area_id: Optional[int] = Field(None, ge=1)
    weather_dependent: bool = False
    skip_if_rain: bool = False
    notify_email: bool = True
    notify_days_before: int = Field(1, ge=0, le=30)
    notes: Optional[str] = Field(None, max_length=5000)
    is_backlog: bool = False  # True = in backlog, not due today
    assigned_to_worker_id: Optional[int] = Field(None, ge=1)
    assigned_to_user_id: Optional[int] = Field(None, ge=1)  # Assign to system user (not worker)
    assigned_to_member_id: Optional[int] = Field(None, ge=1)  # Assign to single team member (legacy)
    assigned_member_ids: Optional[List[int]] = None  # Assign to multiple team members
    visible_to_farmhands: bool = False


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=5000)
    task_type: Optional[TaskType] = None
    category: Optional[TaskCategory] = None
    due_date: Optional[date] = None
    end_date: Optional[date] = None  # End date for multi-day events
    due_time: Optional[str] = Field(None, pattern=r'^([01]?[0-9]|2[0-3]):[0-5][0-9]$')
    end_time: Optional[str] = Field(None, pattern=r'^([01]?[0-9]|2[0-3]):[0-5][0-9]$')
    location: Optional[str] = Field(None, max_length=200)
    priority: Optional[int] = Field(None, ge=1, le=3)
    is_completed: Optional[bool] = None
    notify_email: Optional[bool] = None
    notes: Optional[str] = Field(None, max_length=5000)
    is_backlog: Optional[bool] = None
    assigned_to_worker_id: Optional[int] = Field(None, ge=1)
    assigned_to_user_id: Optional[int] = Field(None, ge=1)
    assigned_to_member_id: Optional[int] = Field(None, ge=1)  # Legacy single assignment
    assigned_member_ids: Optional[List[int]] = None  # Multiple team member assignment
    visible_to_farmhands: Optional[bool] = None


class TaskResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    task_type: TaskType
    category: TaskCategory
    due_date: Optional[date]
    end_date: Optional[date]
    due_time: Optional[str]
    end_time: Optional[str]
    location: Optional[str]
    recurrence: TaskRecurrence
    priority: int
    is_completed: bool
    completed_at: Optional[datetime]
    plant_id: Optional[int]
    animal_id: Optional[int]
    vehicle_id: Optional[int]
    equipment_id: Optional[int]
    farm_area_id: Optional[int]
    weather_dependent: bool
    is_active: bool
    is_backlog: bool
    notes: Optional[str]
    created_at: datetime
    linked_location: Optional[str] = None
    linked_entity: Optional[str] = None
    assigned_to_worker_id: Optional[int] = None
    assigned_to_user_id: Optional[int] = None
    assigned_to_member_id: Optional[int] = None
    is_blocked: bool = False
    blocked_reason: Optional[str] = None
    completion_note: Optional[str] = None

    class Config:
        from_attributes = True


# Routes
@router.get("/", response_model=List[TaskResponse])
async def list_tasks(
    category: Optional[TaskCategory] = None,
    completed: Optional[bool] = None,
    priority: Optional[int] = None,
    include_completed_today: bool = Query(default=True),
    include_worker_tasks: bool = Query(default=False),
    limit: int = Query(default=500, le=1000),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """List all tasks with optional filtering.

    By default includes today's completed tasks even if they were deactivated
    (e.g., auto-reminders that get regenerated after completion).
    Worker-assigned tasks are excluded by default (they only appear in Worker Tasks page).
    """
    from sqlalchemy import or_
    import pytz

    # Get today's bounds in UTC (completed_at is stored in UTC)
    eastern = pytz.timezone('America/New_York')
    now_eastern = datetime.now(eastern)
    today_eastern = now_eastern.date()

    # Today's start/end in Eastern, converted to UTC for comparison
    today_start_eastern = eastern.localize(datetime.combine(today_eastern, datetime.min.time()))
    today_end_eastern = eastern.localize(datetime.combine(today_eastern, datetime.max.time()))
    today_start_utc = today_start_eastern.astimezone(pytz.UTC).replace(tzinfo=None)
    today_end_utc = today_end_eastern.astimezone(pytz.UTC).replace(tzinfo=None)

    # Include active tasks OR today's completed tasks (even if deactivated)
    if include_completed_today:
        query = select(Task).where(
            or_(
                Task.is_active == True,
                and_(
                    Task.is_completed == True,
                    Task.completed_at >= today_start_utc,
                    Task.completed_at <= today_end_utc
                )
            )
        )
    else:
        query = select(Task).where(Task.is_active == True)

    # Exclude worker-assigned tasks by default (they only show in Worker Tasks page)
    if not include_worker_tasks:
        query = query.where(Task.assigned_to_worker_id == None)

    if category:
        query = query.where(Task.category == category)
    if completed is not None:
        query = query.where(Task.is_completed == completed)
    if priority:
        query = query.where(Task.priority == priority)

    query = query.order_by(Task.due_date, Task.priority).offset(offset).limit(limit)
    result = await db.execute(query)
    tasks = result.scalars().all()
    return await enrich_tasks_with_linked_fields(tasks, db)


@router.post("/", response_model=TaskResponse)
async def create_task(
    task: TaskCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_create("tasks"))
):
    """Create a new task"""
    task_data = task.model_dump(exclude={'assigned_member_ids'})
    db_task = Task(**task_data)
    db.add(db_task)
    await db.commit()
    await db.refresh(db_task)

    # Handle multiple member assignment
    if task.assigned_member_ids:
        result = await db.execute(
            select(TeamMember).where(TeamMember.id.in_(task.assigned_member_ids))
        )
        members = result.scalars().all()
        db_task.assigned_members = members
        await db.commit()
        await db.refresh(db_task)

    # Sync to calendar if enabled
    calendar_service = await get_calendar_service(db)
    if calendar_service:
        await calendar_service.sync_task_to_calendar(db_task, db)

    return db_task


@router.get("/today/", response_model=List[TaskResponse])
async def get_todays_tasks(db: AsyncSession = Depends(get_db)):
    """Get all tasks due today (excludes worker-assigned tasks)"""
    today = date.today()
    result = await db.execute(
        select(Task)
        .where(Task.due_date == today)
        .where(Task.is_active == True)
        .where(Task.assigned_to_worker_id.is_(None))
        .order_by(Task.priority, Task.due_time)
    )
    return result.scalars().all()


@router.get("/upcoming/", response_model=List[TaskResponse])
async def get_upcoming_tasks(
    days: int = Query(default=7, le=90),
    db: AsyncSession = Depends(get_db),
):
    """Get tasks due in the next X days (excludes worker-assigned tasks)"""
    today = date.today()
    end_date = today + timedelta(days=days)
    result = await db.execute(
        select(Task)
        .where(Task.due_date >= today)
        .where(Task.due_date <= end_date)
        .where(Task.is_active == True)
        .where(Task.is_completed == False)
        .where(Task.assigned_to_worker_id.is_(None))
        .order_by(Task.due_date, Task.priority)
    )
    return result.scalars().all()


@router.get("/overdue/", response_model=List[TaskResponse])
async def get_overdue_tasks(db: AsyncSession = Depends(get_db)):
    """Get all overdue tasks (includes tasks with past due_time today, excludes worker-assigned tasks)"""
    today = date.today()
    now_time = datetime.now().strftime("%H:%M")

    # Overdue if: due_date < today OR (due_date == today AND due_time is set AND due_time < now)
    result = await db.execute(
        select(Task)
        .where(
            or_(
                Task.due_date < today,
                and_(
                    Task.due_date == today,
                    Task.due_time.isnot(None),
                    Task.due_time < now_time
                )
            )
        )
        .where(Task.is_completed == False)
        .where(Task.is_active == True)
        .where(Task.assigned_to_worker_id.is_(None))
        .order_by(Task.due_date, Task.priority)
    )
    return result.scalars().all()


@router.get("/metrics/")
async def get_task_metrics(db: AsyncSession = Depends(get_db)):
    """Get productivity metrics for tasks"""
    from sqlalchemy import func
    from pytz import timezone
    from config import settings

    # Get configured timezone
    tz = timezone(settings.timezone if hasattr(settings, 'timezone') else 'America/New_York')
    now = datetime.now(tz)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=now.weekday())  # Monday
    month_start = today_start.replace(day=1)

    # Convert to UTC for database queries (stored as naive UTC)
    today_start_utc = today_start.astimezone(timezone('UTC')).replace(tzinfo=None)
    week_start_utc = week_start.astimezone(timezone('UTC')).replace(tzinfo=None)
    month_start_utc = month_start.astimezone(timezone('UTC')).replace(tzinfo=None)

    # Completed today
    result = await db.execute(
        select(func.count(Task.id)).where(
            and_(
                Task.is_completed == True,
                Task.completed_at >= today_start_utc,
                Task.task_type != TaskType.EVENT
            )
        )
    )
    completed_today = result.scalar() or 0

    # Completed this week
    result = await db.execute(
        select(func.count(Task.id)).where(
            and_(
                Task.is_completed == True,
                Task.completed_at >= week_start_utc,
                Task.task_type != TaskType.EVENT
            )
        )
    )
    completed_this_week = result.scalar() or 0

    # Completed this month
    result = await db.execute(
        select(func.count(Task.id)).where(
            and_(
                Task.is_completed == True,
                Task.completed_at >= month_start_utc,
                Task.task_type != TaskType.EVENT
            )
        )
    )
    completed_this_month = result.scalar() or 0

    # Total pending (non-completed, non-backlog)
    result = await db.execute(
        select(func.count(Task.id)).where(
            and_(
                Task.is_completed == False,
                Task.is_active == True,
                Task.is_backlog == False,
                Task.task_type != TaskType.EVENT
            )
        )
    )
    total_pending = result.scalar() or 0

    # Overdue count
    today_date = now.date()
    result = await db.execute(
        select(func.count(Task.id)).where(
            and_(
                Task.is_completed == False,
                Task.is_active == True,
                Task.due_date < today_date,
                Task.task_type != TaskType.EVENT
            )
        )
    )
    overdue_count = result.scalar() or 0

    # Backlog count
    result = await db.execute(
        select(func.count(Task.id)).where(
            and_(
                Task.is_backlog == True,
                Task.is_active == True,
                Task.is_completed == False
            )
        )
    )
    backlog_count = result.scalar() or 0

    # Average tasks completed per day this week (only count days that have passed)
    days_in_week_so_far = now.weekday() + 1  # 1 for Monday, 7 for Sunday
    avg_per_day = round(completed_this_week / days_in_week_so_far, 1) if days_in_week_so_far > 0 else 0

    # Completion streak - consecutive days with at least 1 task completed
    streak = 0
    check_date = today_start
    while True:
        check_date_utc = check_date.astimezone(timezone('UTC')).replace(tzinfo=None)
        next_day_utc = (check_date + timedelta(days=1)).astimezone(timezone('UTC')).replace(tzinfo=None)
        result = await db.execute(
            select(func.count(Task.id)).where(
                and_(
                    Task.is_completed == True,
                    Task.completed_at >= check_date_utc,
                    Task.completed_at < next_day_utc,
                    Task.task_type != TaskType.EVENT
                )
            )
        )
        count = result.scalar() or 0
        if count > 0:
            streak += 1
            check_date -= timedelta(days=1)
        else:
            break
        # Safety limit
        if streak > 365:
            break

    return {
        "completed_today": completed_today,
        "completed_this_week": completed_this_week,
        "completed_this_month": completed_this_month,
        "total_pending": total_pending,
        "overdue_count": overdue_count,
        "backlog_count": backlog_count,
        "avg_per_day": avg_per_day,
        "completion_streak": streak
    }


@router.get("/by-entity/{entity_type}/{entity_id}", response_model=List[TaskResponse])
async def get_tasks_by_entity(
    entity_type: str,
    entity_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get all tasks linked to a specific entity"""
    entity_field_map = {
        'animal': Task.animal_id,
        'plant': Task.plant_id,
        'vehicle': Task.vehicle_id,
        'equipment': Task.equipment_id,
        'farm_area': Task.farm_area_id,
    }

    if entity_type not in entity_field_map:
        raise HTTPException(status_code=400, detail=f"Invalid entity type: {entity_type}")

    field = entity_field_map[entity_type]
    result = await db.execute(
        select(Task)
        .where(field == entity_id)
        .where(Task.is_active == True)
        .order_by(Task.is_completed, Task.due_date.nulls_last(), Task.priority)
    )
    return result.scalars().all()


@router.get("/calendar/", response_model=List[TaskResponse])
async def get_calendar_tasks(
    start_date: date,
    end_date: date,
    db: AsyncSession = Depends(get_db),
):
    """Get tasks for a date range (for calendar view, excludes worker-assigned tasks)"""
    result = await db.execute(
        select(Task)
        .where(Task.due_date >= start_date)
        .where(Task.due_date <= end_date)
        .where(Task.is_active == True)
        .where(Task.assigned_to_worker_id.is_(None))
        .order_by(Task.due_date, Task.priority)
    )
    return result.scalars().all()


@router.get("/{task_id}/", response_model=TaskResponse)
async def get_task(task_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific task by ID"""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.patch("/{task_id}/", response_model=TaskResponse)
async def update_task(
    task_id: int,
    updates: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_edit("tasks"))
):
    """Update a task"""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Get update data, excluding assigned_member_ids which needs special handling
    update_data = updates.model_dump(exclude_unset=True, exclude={'assigned_member_ids'})
    for field, value in update_data.items():
        setattr(task, field, value)

    # Handle multiple member assignment if provided
    if updates.assigned_member_ids is not None:
        if updates.assigned_member_ids:
            result = await db.execute(
                select(TeamMember).where(TeamMember.id.in_(updates.assigned_member_ids))
            )
            members = result.scalars().all()
            task.assigned_members = members
        else:
            task.assigned_members = []  # Clear assignments

    # If marking as completed, set completed_at
    if updates.is_completed:
        task.completed_at = datetime.utcnow()
        task.completion_count = (task.completion_count or 0) + 1
        task.last_completed = datetime.utcnow()

    task.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(task)

    # Sync to calendar if enabled
    calendar_service = await get_calendar_service(db)
    if calendar_service:
        await calendar_service.sync_task_to_calendar(task, db)

    return task


@router.post("/{task_id}/complete/", response_model=TaskResponse)
async def complete_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_interact("tasks"))
):
    """Mark a task as completed and update source entity if auto-generated"""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.is_completed = True
    task.completed_at = datetime.utcnow()
    task.completion_count = (task.completion_count or 0) + 1
    task.last_completed = datetime.utcnow()
    task.updated_at = datetime.utcnow()

    # For auto-generated recurring reminders, mark as inactive so a new one can be created
    is_auto_reminder = task.notes and task.notes.startswith("auto:")
    if is_auto_reminder:
        await update_source_entity_on_complete(db, task.notes)
        # Mark this completed task as inactive so next sync creates a new one
        task.is_active = False
        logger.info(f"Marked auto-reminder task {task_id} as inactive after completion")

        # BUGFIX: Also mark any DUPLICATE tasks with the same notes as inactive
        # This handles cases where race conditions created multiple tasks for same group
        duplicate_result = await db.execute(
            select(Task).where(
                Task.notes == task.notes,
                Task.id != task_id,
                Task.is_active == True
            )
        )
        duplicates = duplicate_result.scalars().all()
        for dup in duplicates:
            dup.is_active = False
            dup.is_completed = True
            dup.completed_at = task.completed_at
            logger.warning(f"Cleaned up duplicate auto-reminder task {dup.id} with same notes as {task_id}")

    await db.commit()
    await db.refresh(task)

    # Sync to calendar if enabled (this will remove the completed task from calendar)
    calendar_service = await get_calendar_service(db)
    if calendar_service:
        await calendar_service.sync_task_to_calendar(task, db)

    # For auto-reminders, trigger immediate re-sync to create the next occurrence
    if is_auto_reminder:
        if "care_group" in task.notes or "animal_care" in task.notes:
            from services.auto_reminders import sync_all_animal_reminders
            try:
                stats = await sync_all_animal_reminders(db)
                logger.info(f"Re-synced animal reminders after completion: {stats}")
            except Exception as e:
                logger.error(f"Failed to re-sync animal reminders: {e}")

        if "plant_water_group" in task.notes or "plant_fertilize_group" in task.notes:
            from services.auto_reminders import sync_all_plant_reminders
            try:
                stats = await sync_all_plant_reminders(db)
                logger.info(f"Re-synced plant reminders after completion: {stats}")
            except Exception as e:
                logger.error(f"Failed to re-sync plant reminders: {e}")

        # Re-sync maintenance reminders (home, vehicle, equipment, farm)
        if any(x in task.notes for x in ["home_maint:", "vehicle_maint:", "equipment_maint:", "farm_maint:"]):
            from services.auto_reminders import sync_all_maintenance_reminders
            try:
                stats = await sync_all_maintenance_reminders(db)
                logger.info(f"Re-synced maintenance reminders after completion: {stats}")
            except Exception as e:
                logger.error(f"Failed to re-sync maintenance reminders: {e}")

        # Re-sync member reminders (gear, training, medical)
        if any(x in task.notes for x in ["gear_maint:", "gear_exp:", "member_training:", "member_medical:"]):
            from services.auto_reminders import sync_all_member_reminders
            try:
                stats = await sync_all_member_reminders(db)
                logger.info(f"Re-synced member reminders after completion: {stats}")
            except Exception as e:
                logger.error(f"Failed to re-sync member reminders: {e}")

    return task


@router.post("/{task_id}/uncomplete/", response_model=TaskResponse)
async def uncomplete_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_interact("tasks"))
):
    """Mark a task as not completed"""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.is_completed = False
    task.completed_at = None
    task.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(task)

    # Sync to calendar if enabled
    calendar_service = await get_calendar_service(db)
    if calendar_service:
        await calendar_service.sync_task_to_calendar(task, db)

    return task


@router.post("/{task_id}/backlog/", response_model=TaskResponse)
async def toggle_backlog(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_interact("tasks"))
):
    """Toggle a task's backlog status. Backlog tasks don't appear as due today."""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.is_backlog = not task.is_backlog
    task.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(task)

    return task


@router.delete("/{task_id}/")
async def delete_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_delete("tasks"))
):
    """Delete a task. Soft-deletes active tasks, hard-deletes already-deactivated tasks."""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Delete from calendar if enabled (pass calendar_uid for iPhone-originated items)
    calendar_service = await get_calendar_service(db)
    if calendar_service:
        await calendar_service.delete_task_from_calendar(task.id, calendar_uid=task.calendar_uid)

    # Hard delete if: already deactivated OR completed
    # Soft delete only for active incomplete tasks (preserves history if needed)
    if not task.is_active or task.is_completed:
        await db.delete(task)
        await db.commit()
        return {"message": "Task permanently deleted"}
    else:
        task.is_active = False
        task.updated_at = datetime.utcnow()
        await db.commit()
        return {"message": "Task deactivated"}


@router.post("/setup-maintenance/")
async def setup_florida_maintenance_tasks(db: AsyncSession = Depends(get_db)):
    """Initialize Florida home maintenance tasks"""
    created = 0
    today = date.today()

    for task_template in FLORIDA_MAINTENANCE_TASKS:
        # Check if task already exists
        result = await db.execute(
            select(Task).where(Task.title == task_template["title"])
        )
        if result.scalar_one_or_none():
            continue

        # Calculate initial due date
        due_date = today
        if task_template.get("recurrence_month"):
            # Set to next occurrence of that month
            month = task_template["recurrence_month"]
            day = task_template.get("recurrence_day", 1)
            due_date = date(today.year, month, min(day, 28))
            if due_date < today:
                due_date = date(today.year + 1, month, min(day, 28))

        task = Task(
            title=task_template["title"],
            description=task_template["description"],
            category=task_template["category"],
            recurrence=task_template["recurrence"],
            recurrence_month=task_template.get("recurrence_month"),
            priority=task_template["priority"],
            due_date=due_date,
            notify_email=True,
            notify_days_before=3,
        )
        db.add(task)
        created += 1

    await db.commit()
    return {"message": f"Created {created} maintenance tasks"}


@router.get("/by-category/{category}/", response_model=List[TaskResponse])
async def get_tasks_by_category(
    category: TaskCategory,
    include_completed: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """Get all tasks in a category"""
    query = select(Task).where(Task.category == category).where(Task.is_active == True)

    if not include_completed:
        query = query.where(Task.is_completed == False)

    query = query.order_by(Task.due_date, Task.priority)
    result = await db.execute(query)
    return result.scalars().all()


# CalDAV Sync
@router.get("/caldav/status/")
async def get_caldav_status():
    """Get CalDAV sync status"""
    caldav_service = get_calendar_service()
    return {
        "configured": caldav_service.is_configured(),
        "connected": caldav_service._initialized,
    }


@router.post("/caldav/sync/")
async def sync_tasks_to_caldav(db: AsyncSession = Depends(get_db)):
    """Sync all active tasks to CalDAV calendar"""
    caldav_service = get_calendar_service()
    if not caldav_service.is_configured():
        raise HTTPException(
            status_code=400,
            detail="CalDAV not configured. Set CALDAV_URL, CALDAV_USERNAME, and CALDAV_PASSWORD in .env"
        )

    # Get all active, incomplete tasks
    result = await db.execute(
        select(Task)
        .where(Task.is_active == True)
        .where(Task.is_completed == False)
    )
    tasks = result.scalars().all()

    sync_result = await caldav_service.sync_all_tasks(tasks)
    return sync_result


@router.post("/caldav/sync/{task_id}/")
async def sync_single_task(task_id: int, db: AsyncSession = Depends(get_db)):
    """Sync a single task to CalDAV"""
    caldav_service = get_calendar_service()
    if not caldav_service.is_configured():
        raise HTTPException(status_code=400, detail="CalDAV not configured")

    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    success = await caldav_service.sync_task(task)
    if success:
        return {"message": "Task synced to CalDAV"}
    raise HTTPException(status_code=500, detail="Failed to sync task")
