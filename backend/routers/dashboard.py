"""
Dashboard API Routes
Consolidated data for the dashboard view
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_, and_
from typing import List, Optional
from datetime import datetime, date, timedelta
from pydantic import BaseModel
import httpx
import re

from models.database import get_db
from models.plants import Plant
from models.livestock import Animal, AnimalType, AnimalCareSchedule
from models.tasks import Task, TaskCategory, TaskType, TaskRecurrence
from models.weather import WeatherReading, WeatherAlert
from models.farm_areas import FarmArea
from models.vehicles import Vehicle
from models.equipment import Equipment
from models.home_maintenance import HomeMaintenance
from models.users import User
from models.settings import AppSetting
from models.team import TeamMember
from services.weather import WeatherService, NWSForecastService
from services.scheduler import get_sun_moon_data
from routers.auth import get_current_user


router = APIRouter(prefix="/dashboard", tags=["Dashboard"])
weather_service = WeatherService()
forecast_service = NWSForecastService()


# Response Schemas
class DashboardWeather(BaseModel):
    temperature: Optional[float]
    feels_like: Optional[float]
    humidity: Optional[int]
    wind_speed: Optional[float]
    wind_direction: Optional[str]
    rain_today: Optional[float]
    uv_index: Optional[int]
    reading_time: Optional[str]
    temp_high_today: Optional[float]
    temp_low_today: Optional[float]


class DashboardTask(BaseModel):
    id: int
    title: str
    description: Optional[str]
    task_type: str
    category: str
    priority: int
    due_date: Optional[date]
    due_time: Optional[str]
    end_time: Optional[str]
    location: Optional[str]
    linked_location: Optional[str] = None  # Farm area name(s) if linked
    linked_entity: Optional[str] = None  # Vehicle/equipment name (shown differently than location)
    is_completed: bool
    is_backlog: bool = False
    assigned_to_member_id: Optional[int] = None
    assigned_to_member_name: Optional[str] = None
    assigned_member_ids: List[int] = []
    assigned_member_names: List[str] = []


class DashboardAlert(BaseModel):
    id: int
    title: str
    message: Optional[str]
    severity: str
    alert_type: str
    is_acknowledged: bool = False


class DashboardStats(BaseModel):
    total_plants: int
    total_animals: int
    tasks_today: int
    tasks_overdue: int
    active_alerts: int


class CalendarEvent(BaseModel):
    id: int
    title: str
    date: date
    category: str
    priority: int
    is_completed: bool


class SunMoonData(BaseModel):
    sunrise: str
    sunset: str
    first_light: Optional[str] = None  # Civil dawn - when sky starts to lighten
    last_light: Optional[str] = None   # Civil dusk - when sky goes dark
    day_length: str
    moon_phase: str
    moon_emoji: str
    moon_illumination: int
    is_daytime: bool


class DashboardResponse(BaseModel):
    weather: Optional[DashboardWeather]
    sun_moon: Optional[SunMoonData]
    tasks_today: List[DashboardTask]
    undated_todos: List[DashboardTask]  # Todos without a specific date
    backlog_tasks: List[DashboardTask]  # Tasks marked as backlog
    alerts: List[DashboardAlert]
    stats: DashboardStats
    upcoming_events: List[CalendarEvent]


@router.get("/", response_model=DashboardResponse)
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """Get all dashboard data in a single request.
    For farm hand users: filters tasks to only show those marked visible_to_farmhands,
    and excludes the backlog section.
    """
    # Check if current user is a farm hand
    is_farmhand = current_user and current_user.is_farmhand

    # Get current weather
    weather_data = None
    reading = await weather_service.get_latest_reading(db)
    if reading:
        summary = weather_service.get_weather_summary(reading)

        # Get today's high/low
        today_start = datetime.combine(date.today(), datetime.min.time())
        today_end = datetime.combine(date.today(), datetime.max.time())
        result = await db.execute(
            select(WeatherReading)
            .where(WeatherReading.reading_time >= today_start)
            .where(WeatherReading.reading_time <= today_end)
        )
        today_readings = result.scalars().all()

        temps = [r.temp_outdoor for r in today_readings if r.temp_outdoor]
        temp_high = max(temps) if temps else reading.temp_outdoor
        temp_low = min(temps) if temps else reading.temp_outdoor

        weather_data = DashboardWeather(
            temperature=summary["temperature"],
            feels_like=summary["feels_like"],
            humidity=summary["humidity"],
            wind_speed=summary["wind_speed"],
            wind_direction=summary["wind_direction"],
            rain_today=summary["rain_today"],
            uv_index=summary["uv_index"],
            reading_time=summary["reading_time"],
            temp_high_today=temp_high,
            temp_low_today=temp_low,
        )

    # Pre-fetch all entities for linked location lookup
    result = await db.execute(select(FarmArea))
    farm_areas = {fa.id: fa.name for fa in result.scalars().all()}

    result = await db.execute(select(Vehicle))
    vehicles_list = result.scalars().all()
    vehicles = {v.id: v.model for v in vehicles_list}  # Use just model name for display (e.g., "Gator")

    result = await db.execute(select(Equipment))
    equipment_list = result.scalars().all()
    equipment = {e.id: e.name for e in equipment_list}
    equipment_with_location = equipment_list  # Keep full objects for farm_area lookup

    result = await db.execute(select(Animal))
    animals_list = result.scalars().all()
    animals = {a.id: a.name for a in animals_list}
    animals_with_location = animals_list  # Keep full objects for farm_area lookup

    result = await db.execute(select(Plant))
    plants_list = result.scalars().all()
    plants = {p.id: p.name for p in plants_list}
    plants_with_location = plants_list  # Keep full objects for farm_area lookup

    # Pre-fetch home maintenance for area lookup
    result = await db.execute(select(HomeMaintenance))
    home_maint_list = result.scalars().all()
    home_maint = {hm.id: hm for hm in home_maint_list}

    # Pre-fetch animal care schedules for care_group lookups
    result = await db.execute(select(AnimalCareSchedule).where(AnimalCareSchedule.is_active == True))
    care_schedules = result.scalars().all()

    def get_linked_location(task):
        """Get location(s) for task - farm areas and home maintenance areas."""
        try:
            # Direct farm area link - this IS a location
            if task.farm_area_id and task.farm_area_id in farm_areas:
                return farm_areas[task.farm_area_id]

            # Check notes for special linkages
            if task.notes:
                # Home maintenance - parse "auto:home_maint:ID" and get area_or_appliance
                if "auto:home_maint:" in task.notes:
                    match = re.search(r'auto:home_maint:(\d+)', task.notes)
                    if match:
                        hm_id = int(match.group(1))
                        if hm_id in home_maint:
                            hm = home_maint[hm_id]
                            # Return area_or_appliance if set, otherwise category
                            if hm.area_or_appliance:
                                return hm.area_or_appliance
                            elif hm.category:
                                return hm.category.title()

                # Care group - parse "auto:care_group:DATE_CARENAME" and get ALL farm_areas
                if "auto:care_group:" in task.notes:
                    match = re.search(r'auto:care_group:(\d{4}-\d{2}-\d{2})_(.+)', task.notes)
                    if match:
                        care_name = match.group(2).lower().strip()
                        # Find all animal care schedules with matching name
                        matching_schedules = [s for s in care_schedules if s.name.lower().strip() == care_name]
                        if matching_schedules:
                            # Get unique farm_areas from animals in this care group
                            farm_area_names = []
                            seen_ids = set()
                            for schedule in matching_schedules:
                                animal = next((a for a in animals_with_location if a.id == schedule.animal_id), None)
                                if animal and animal.farm_area_id and animal.farm_area_id not in seen_ids:
                                    seen_ids.add(animal.farm_area_id)
                                    if animal.farm_area_id in farm_areas:
                                        farm_area_names.append(farm_areas[animal.farm_area_id])
                            # Return all unique locations (comma-separated if multiple)
                            if farm_area_names:
                                return ", ".join(farm_area_names)

            # Animal's location (if animal has a farm_area)
            if task.animal_id and task.animal_id in animals:
                animal = next((a for a in animals_with_location if a.id == task.animal_id), None)
                if animal and animal.farm_area_id and animal.farm_area_id in farm_areas:
                    return farm_areas[animal.farm_area_id]

            # Plant's location (if plant has a farm_area)
            if task.plant_id and task.plant_id in plants:
                plant = next((p for p in plants_with_location if p.id == task.plant_id), None)
                if plant and plant.farm_area_id and plant.farm_area_id in farm_areas:
                    return farm_areas[plant.farm_area_id]

            return None
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Error getting linked_location for task {task.id}: {e}")
            return None

    def get_linked_entity(task):
        """Get linked vehicle/equipment name (shown differently from location badge)."""
        try:
            # Vehicle link
            if task.vehicle_id and task.vehicle_id in vehicles:
                return f"Vehicle: {vehicles[task.vehicle_id]}"

            # Equipment link
            if task.equipment_id and task.equipment_id in equipment:
                return f"Equipment: {equipment[task.equipment_id]}"

            return None
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Error getting linked_entity for task {task.id}: {e}")
            return None

    # Get today's tasks (items due today OR overdue todos - not overdue events)
    # Also include today's completed tasks even if deactivated (auto-reminders)
    import pytz
    eastern = pytz.timezone('America/New_York')
    now_eastern = datetime.now(eastern)
    today = now_eastern.date()
    current_time_str = now_eastern.strftime('%H:%M')

    # Today's bounds in UTC for completed_at comparison
    today_start_eastern = eastern.localize(datetime.combine(today, datetime.min.time()))
    today_end_eastern = eastern.localize(datetime.combine(today, datetime.max.time()))
    today_start_utc = today_start_eastern.astimezone(pytz.UTC).replace(tzinfo=None)
    today_end_utc = today_end_eastern.astimezone(pytz.UTC).replace(tzinfo=None)

    result = await db.execute(
        select(Task)
        .where(
            or_(
                # Today's active incomplete tasks (both events and todos) - exclude backlog
                and_(
                    Task.due_date == today,
                    Task.is_active == True,
                    Task.is_completed == False,
                    or_(Task.is_backlog == False, Task.is_backlog.is_(None))
                ),
                # Dateless incomplete todos treated as due today - exclude backlog
                and_(
                    Task.due_date.is_(None),
                    or_(Task.task_type == TaskType.TODO, Task.task_type.is_(None)),
                    Task.is_active == True,
                    Task.is_completed == False,
                    or_(Task.is_backlog == False, Task.is_backlog.is_(None))
                ),
                # Overdue active todos only (events don't carry over) - exclude backlog
                and_(
                    Task.due_date < today,
                    or_(Task.task_type == TaskType.TODO, Task.task_type.is_(None)),
                    Task.is_completed == False,
                    Task.is_active == True,
                    or_(Task.is_backlog == False, Task.is_backlog.is_(None))
                ),
                # All tasks completed today (regardless of due date)
                and_(
                    Task.is_completed == True,
                    Task.completed_at >= today_start_utc,
                    Task.completed_at <= today_end_utc
                )
            )
        )
        # Exclude worker-assigned tasks - they only show on Worker Tasks page
        .where(Task.assigned_to_worker_id.is_(None))
        .order_by(Task.is_completed, Task.due_date.nulls_first(), Task.priority, Task.due_time)
    )
    tasks = result.scalars().all()

    # Filter for farm hand users - only show tasks marked visible_to_farmhands
    if is_farmhand:
        tasks = [t for t in tasks if t.visible_to_farmhands]

    tasks_today = []
    for t in tasks:
        # For events, check if they're past their end time - auto-mark as completed
        is_completed = t.is_completed
        if t.task_type == TaskType.EVENT and t.due_date == today and not t.is_completed:
            end_time = t.end_time or t.due_time
            if end_time and end_time < current_time_str:
                is_completed = True

        tasks_today.append(DashboardTask(
            id=t.id,
            title=t.title,
            description=t.description,
            task_type=t.task_type.value if t.task_type else "todo",
            category=t.category.value if t.category else "custom",
            priority=t.priority,
            due_date=t.due_date,
            due_time=t.due_time,
            end_time=t.end_time,
            location=t.location,
            linked_location=get_linked_location(t),
            linked_entity=get_linked_entity(t),
            is_completed=is_completed,
            is_backlog=t.is_backlog or False,
        ))

    # Get undated todos (todos without a due date) - exclude backlog and worker tasks
    result = await db.execute(
        select(Task)
        .where(Task.due_date.is_(None))
        .where(Task.is_active == True)
        .where(Task.is_completed == False)
        .where(or_(Task.is_backlog == False, Task.is_backlog.is_(None)))
        .where(Task.assigned_to_worker_id.is_(None))
        .order_by(Task.priority, Task.created_at)
        .limit(10)
    )
    undated = result.scalars().all()

    # Filter for farm hand users
    if is_farmhand:
        undated = [t for t in undated if t.visible_to_farmhands]

    undated_todos = [
        DashboardTask(
            id=t.id,
            title=t.title,
            description=t.description,
            task_type=t.task_type.value if t.task_type else "todo",
            category=t.category.value if t.category else "custom",
            priority=t.priority,
            due_date=None,
            due_time=t.due_time,
            end_time=t.end_time,
            location=t.location,
            linked_location=get_linked_location(t),
            linked_entity=get_linked_entity(t),
            is_completed=t.is_completed,
            is_backlog=False,
        )
        for t in undated
    ]

    # Get backlog tasks - farm hands don't see backlog at all, exclude worker tasks
    backlog_tasks = []
    if not is_farmhand:
        result = await db.execute(
            select(Task)
            .where(Task.is_backlog == True)
            .where(Task.is_active == True)
            .where(Task.is_completed == False)
            .where(Task.assigned_to_worker_id.is_(None))
            .order_by(Task.priority, Task.created_at)
            .limit(15)
        )
        backlog = result.scalars().all()
        # Get member names for assigned backlog tasks (both single and multi-assignment)
        member_names = {}
        # Collect all member IDs from both single assignment and multi-assignment
        all_member_ids = set()
        for t in backlog:
            if t.assigned_to_member_id:
                all_member_ids.add(t.assigned_to_member_id)
            if hasattr(t, 'assigned_members') and t.assigned_members:
                for m in t.assigned_members:
                    all_member_ids.add(m.id)
        if all_member_ids:
            member_result = await db.execute(
                select(TeamMember).where(TeamMember.id.in_(all_member_ids))
            )
            for m in member_result.scalars().all():
                member_names[m.id] = m.nickname or m.name

        backlog_tasks = [
            DashboardTask(
                id=t.id,
                title=t.title,
                description=t.description,
                task_type=t.task_type.value if t.task_type else "todo",
                category=t.category.value if t.category else "custom",
                priority=t.priority,
                due_date=t.due_date,
                due_time=t.due_time,
                end_time=t.end_time,
                location=t.location,
                linked_location=get_linked_location(t),
                linked_entity=get_linked_entity(t),
                is_completed=t.is_completed,
                is_backlog=True,
                assigned_to_member_id=t.assigned_to_member_id,
                assigned_to_member_name=member_names.get(t.assigned_to_member_id) if t.assigned_to_member_id else None,
                assigned_member_ids=[m.id for m in t.assigned_members] if hasattr(t, 'assigned_members') and t.assigned_members else [],
                assigned_member_names=[member_names.get(m.id, m.nickname or m.name) for m in t.assigned_members] if hasattr(t, 'assigned_members') and t.assigned_members else [],
            )
            for t in backlog
        ]

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
        .order_by(desc(WeatherAlert.created_at))
        .limit(5)
    )
    alerts = result.scalars().all()
    alert_list = [
        DashboardAlert(
            id=a.id,
            title=a.title,
            message=a.message,
            severity=a.severity.value,
            alert_type=a.alert_type,
            is_acknowledged=a.is_acknowledged or False,
        )
        for a in alerts
    ]

    # Get stats
    plant_count = await db.execute(
        select(func.count()).select_from(Plant).where(Plant.is_active == True)
    )
    animal_count = await db.execute(
        select(func.count()).select_from(Animal).where(Animal.is_active == True)
    )
    tasks_today_count = await db.execute(
        select(func.count())
        .select_from(Task)
        .where(or_(Task.due_date == today, Task.due_date.is_(None)))
        .where(Task.is_active == True)
        .where(Task.is_completed == False)
        .where(or_(Task.is_backlog == False, Task.is_backlog.is_(None)))
        .where(Task.assigned_to_worker_id.is_(None))
    )
    # Only count TODOs as overdue, not EVENTs (events are time-based, not action-based)
    # Overdue if: due_date < today OR (due_date == today AND due_time is set AND due_time < now)
    now_time = datetime.now().strftime("%H:%M")
    overdue_count = await db.execute(
        select(func.count())
        .select_from(Task)
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
        .where(Task.is_active == True)
        .where(Task.is_completed == False)
        .where(or_(Task.task_type == TaskType.TODO, Task.task_type.is_(None)))
        .where(or_(Task.is_backlog == False, Task.is_backlog.is_(None)))
        .where(Task.assigned_to_worker_id.is_(None))
    )
    alert_count = await db.execute(
        select(func.count())
        .select_from(WeatherAlert)
        .where(WeatherAlert.is_active == True)
    )

    stats = DashboardStats(
        total_plants=plant_count.scalar() or 0,
        total_animals=animal_count.scalar() or 0,
        tasks_today=tasks_today_count.scalar() or 0,
        tasks_overdue=overdue_count.scalar() or 0,
        active_alerts=alert_count.scalar() or 0,
    )

    # Get upcoming events (next 7 days) - exclude worker tasks
    week_ahead = today + timedelta(days=7)
    result = await db.execute(
        select(Task)
        .where(Task.due_date >= today)
        .where(Task.due_date <= week_ahead)
        .where(Task.is_active == True)
        .where(Task.assigned_to_worker_id.is_(None))
        .order_by(Task.due_date, Task.priority)
        .limit(20)
    )
    upcoming = result.scalars().all()

    # Filter for farm hand users
    if is_farmhand:
        upcoming = [t for t in upcoming if t.visible_to_farmhands]

    upcoming_events = [
        CalendarEvent(
            id=t.id,
            title=t.title,
            date=t.due_date,
            category=t.category.value if t.category else "custom",
            priority=t.priority,
            is_completed=t.is_completed,
        )
        for t in upcoming
    ]

    # Get sun/moon data
    sun_moon_data = None
    try:
        sun_moon_raw = get_sun_moon_data()
        sun_moon_data = SunMoonData(**sun_moon_raw)
    except Exception as e:
        import logging
        logging.warning(f"Failed to get sun/moon data: {e}")

    return DashboardResponse(
        weather=weather_data,
        sun_moon=sun_moon_data,
        tasks_today=tasks_today,
        undated_todos=undated_todos,
        backlog_tasks=backlog_tasks,
        alerts=alert_list,
        stats=stats,
        upcoming_events=upcoming_events,
    )


@router.get("/quick-stats")
async def get_quick_stats(db: AsyncSession = Depends(get_db)):
    """Get quick statistics for status bar"""
    today = date.today()

    # Count pending items (including dateless tasks as due today) - exclude backlog and worker tasks
    tasks_pending = await db.execute(
        select(func.count())
        .select_from(Task)
        .where(or_(Task.due_date <= today, Task.due_date.is_(None)))
        .where(Task.is_active == True)
        .where(Task.is_completed == False)
        .where(or_(Task.is_backlog == False, Task.is_backlog.is_(None)))
        .where(Task.assigned_to_worker_id.is_(None))
    )

    # Animals needing care soon
    week_ahead = today + timedelta(days=7)
    horses_need_farrier = await db.execute(
        select(func.count())
        .select_from(Animal)
        .where(Animal.animal_type == AnimalType.HORSE)
        .where(Animal.is_active == True)
        .where(Animal.next_farrier_date <= week_ahead)
    )
    animals_need_worming = await db.execute(
        select(func.count())
        .select_from(Animal)
        .where(Animal.is_active == True)
        .where(Animal.next_worming_date <= week_ahead)
    )

    # Latest weather
    reading = await weather_service.get_latest_reading(db)

    return {
        "tasks_pending": tasks_pending.scalar() or 0,
        "farrier_due": horses_need_farrier.scalar() or 0,
        "worming_due": animals_need_worming.scalar() or 0,
        "current_temp": reading.temp_outdoor if reading else None,
        "last_updated": reading.reading_time.isoformat() if reading else None,
    }


@router.get("/calendar/{year}/{month}")
async def get_calendar_month(
    year: int,
    month: int,
    db: AsyncSession = Depends(get_db),
):
    """Get calendar events and todos for a specific month"""
    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end_date = date(year, month + 1, 1) - timedelta(days=1)

    # Pre-fetch lookup tables for linked_location/entity
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

    def get_task_linked_location(task):
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

    def get_task_linked_entity(task):
        if task.vehicle_id and task.vehicle_id in vehicles:
            return f"Vehicle: {vehicles[task.vehicle_id]}"
        if task.equipment_id and task.equipment_id in equipment:
            return f"Equipment: {equipment[task.equipment_id]}"
        return None

    # Exclude worker-assigned tasks from calendar
    # Include tasks that START in range OR SPAN into range (multi-day events)
    result = await db.execute(
        select(Task)
        .where(
            or_(
                # Single-day or start of multi-day in range
                and_(Task.due_date >= start_date, Task.due_date <= end_date),
                # Multi-day events that started before but span into range
                and_(Task.due_date < start_date, Task.end_date >= start_date)
            )
        )
        .where(Task.is_active == True)
        .where(Task.assigned_to_worker_id.is_(None))
        .order_by(Task.due_date, Task.priority)
    )
    tasks = result.scalars().all()

    # Also fetch recurring tasks that might project into this date range
    result = await db.execute(
        select(Task)
        .where(Task.recurrence != TaskRecurrence.ONCE)
        .where(Task.is_active == True)
        .where(Task.assigned_to_worker_id.is_(None))
        .where(Task.due_date < start_date)  # Only past recurring events
    )
    recurring_tasks = result.scalars().all()

    # Helper to check if a recurring task should appear on a given date
    import calendar as cal
    def get_recurring_date_in_range(task, target_date):
        if not task.due_date or not task.recurrence:
            return None
        original_weekday = task.due_date.weekday()
        original_day = task.due_date.day
        if task.recurrence == TaskRecurrence.WEEKLY:
            if target_date.weekday() == original_weekday:
                return target_date
        elif task.recurrence == TaskRecurrence.BIWEEKLY:
            if target_date.weekday() == original_weekday:
                days_diff = (target_date - task.due_date).days
                if days_diff >= 0 and days_diff % 14 == 0:
                    return target_date
        elif task.recurrence == TaskRecurrence.MONTHLY:
            last_day_of_month = cal.monthrange(target_date.year, target_date.month)[1]
            target_day = min(original_day, last_day_of_month)
            if target_date.day == target_day:
                return target_date
        elif task.recurrence == TaskRecurrence.DAILY:
            return target_date
        return None

    # Project recurring tasks into the date range
    projected_tasks = []
    current_date = start_date
    while current_date <= end_date:
        for task in recurring_tasks:
            if get_recurring_date_in_range(task, current_date):
                projected_tasks.append((task, current_date))
        current_date += timedelta(days=1)

    # Group by date - add multi-day events to each day they span
    calendar = {}
    for task in tasks:
        task_start = task.due_date
        task_end = task.end_date or task.due_date  # Default to single day
        is_multi_day = task.end_date is not None and task.end_date > task.due_date

        # Add to each day the task spans within the view range
        current = max(task_start, start_date)
        last_day = min(task_end, end_date)

        while current <= last_day:
            date_str = current.isoformat()
            if date_str not in calendar:
                calendar[date_str] = []
            calendar[date_str].append({
                "id": task.id,
                "title": task.title,
                "task_type": task.task_type.value if task.task_type else "event",
                "category": task.category.value if task.category else "custom",
                "priority": task.priority,
                "is_completed": task.is_completed,
                "due_date": task.due_date.isoformat(),
                "end_date": task.end_date.isoformat() if task.end_date else None,
                "due_time": task.due_time,
                "end_time": task.end_time,
                "location": task.location,
                "description": task.description,
                "linked_location": get_task_linked_location(task),
                "linked_entity": get_task_linked_entity(task),
                "is_multi_day": is_multi_day,
                "is_span_start": current == task_start,
                "is_span_end": current == task_end,
            })
            current += timedelta(days=1)

    # Add projected recurring tasks to the calendar
    for task, projected_date in projected_tasks:
        date_str = projected_date.isoformat()
        if date_str not in calendar:
            calendar[date_str] = []
        existing_ids = [t["id"] for t in calendar[date_str]]
        if task.id not in existing_ids:
            calendar[date_str].append({
                "id": task.id,
                "title": task.title,
                "task_type": task.task_type.value if task.task_type else "event",
                "category": task.category.value if task.category else "custom",
                "priority": task.priority,
                "is_completed": False,
                "due_date": projected_date.isoformat(),
                "end_date": None,
                "due_time": task.due_time,
                "end_time": task.end_time,
                "location": task.location,
                "description": task.description,
                "linked_location": get_task_linked_location(task),
                "linked_entity": get_task_linked_entity(task),
                "is_multi_day": False,
                "is_span_start": True,
                "is_span_end": True,
                "is_recurring": True,
                "recurrence": task.recurrence.value if task.recurrence else None,
            })

    # Sort each day's events by time
    for date_str in calendar:
        calendar[date_str].sort(key=lambda x: (x.get("due_time") or "99:99", x.get("priority", 2)))

    return {
        "year": year,
        "month": month,
        "tasks": calendar,
    }


@router.get("/calendar/week/{year}/{month}/{day}")
async def get_calendar_week(
    year: int,
    month: int,
    day: int,
    db: AsyncSession = Depends(get_db),
):
    """Get calendar events and todos for a 7-day period starting from given date"""
    start_date = date(year, month, day)
    end_date = start_date + timedelta(days=6)

    # Pre-fetch lookup tables for linked_location/entity
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

    def get_task_linked_location(task):
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

    def get_task_linked_entity(task):
        if task.vehicle_id and task.vehicle_id in vehicles:
            return f"Vehicle: {vehicles[task.vehicle_id]}"
        if task.equipment_id and task.equipment_id in equipment:
            return f"Equipment: {equipment[task.equipment_id]}"
        return None

    # Exclude worker-assigned tasks from calendar
    # Include tasks that START in range OR SPAN into range (multi-day events)
    result = await db.execute(
        select(Task)
        .where(
            or_(
                # Single-day or start of multi-day in range
                and_(Task.due_date >= start_date, Task.due_date <= end_date),
                # Multi-day events that started before but span into range
                and_(Task.due_date < start_date, Task.end_date >= start_date)
            )
        )
        .where(Task.is_active == True)
        .where(Task.assigned_to_worker_id.is_(None))
        .order_by(Task.due_date, Task.due_time, Task.priority)
    )
    tasks = result.scalars().all()

    # Also fetch recurring tasks that might project into this date range
    result = await db.execute(
        select(Task)
        .where(Task.recurrence != TaskRecurrence.ONCE)
        .where(Task.is_active == True)
        .where(Task.assigned_to_worker_id.is_(None))
        .where(Task.due_date < start_date)  # Only past recurring events
    )
    recurring_tasks = result.scalars().all()

    # Helper to check if a recurring task should appear on a given date
    def get_recurring_date_in_range(task, target_date):
        """Check if this recurring task should appear on target_date"""
        if not task.due_date or not task.recurrence:
            return None

        original_weekday = task.due_date.weekday()
        original_day = task.due_date.day
        original_month = task.due_date.month

        if task.recurrence == TaskRecurrence.WEEKLY:
            # Weekly: same day of week
            if target_date.weekday() == original_weekday:
                return target_date
        elif task.recurrence == TaskRecurrence.BIWEEKLY:
            # Biweekly: same day of week, every 2 weeks from original
            if target_date.weekday() == original_weekday:
                days_diff = (target_date - task.due_date).days
                if days_diff >= 0 and days_diff % 14 == 0:
                    return target_date
        elif task.recurrence == TaskRecurrence.MONTHLY:
            # Monthly: same day of month
            # Handle months with fewer days (e.g., Feb doesn't have 31st)
            import calendar
            last_day_of_month = calendar.monthrange(target_date.year, target_date.month)[1]
            target_day = min(original_day, last_day_of_month)
            if target_date.day == target_day:
                return target_date
        elif task.recurrence == TaskRecurrence.DAILY:
            return target_date

        return None

    # Project recurring tasks into the date range
    projected_tasks = []
    current_date = start_date
    while current_date <= end_date:
        for task in recurring_tasks:
            if get_recurring_date_in_range(task, current_date):
                # Create a "virtual" instance for this date
                projected_tasks.append((task, current_date))
        current_date += timedelta(days=1)

    # Group by date - add multi-day events to each day they span
    calendar = {}
    for task in tasks:
        task_start = task.due_date
        task_end = task.end_date or task.due_date  # Default to single day
        is_multi_day = task.end_date is not None and task.end_date > task.due_date

        # Add to each day the task spans within the view range
        current = max(task_start, start_date)
        last_day = min(task_end, end_date)

        while current <= last_day:
            date_str = current.isoformat()
            if date_str not in calendar:
                calendar[date_str] = []
            calendar[date_str].append({
                "id": task.id,
                "title": task.title,
                "task_type": task.task_type.value if task.task_type else "event",
                "category": task.category.value if task.category else "custom",
                "priority": task.priority,
                "is_completed": task.is_completed,
                "due_date": task.due_date.isoformat(),
                "end_date": task.end_date.isoformat() if task.end_date else None,
                "due_time": task.due_time,
                "end_time": task.end_time,
                "location": task.location,
                "description": task.description,
                "linked_location": get_task_linked_location(task),
                "linked_entity": get_task_linked_entity(task),
                "is_multi_day": is_multi_day,
                "is_span_start": current == task_start,
                "is_span_end": current == task_end,
            })
            current += timedelta(days=1)

    # Add projected recurring tasks to the calendar
    for task, projected_date in projected_tasks:
        date_str = projected_date.isoformat()
        if date_str not in calendar:
            calendar[date_str] = []
        # Avoid duplicates (in case the task was also fetched in the main query)
        existing_ids = [t["id"] for t in calendar[date_str]]
        if task.id not in existing_ids:
            calendar[date_str].append({
                "id": task.id,
                "title": task.title,
                "task_type": task.task_type.value if task.task_type else "event",
                "category": task.category.value if task.category else "custom",
                "priority": task.priority,
                "is_completed": False,  # Projected instances are not completed
                "due_date": projected_date.isoformat(),  # Use projected date
                "end_date": None,
                "due_time": task.due_time,
                "end_time": task.end_time,
                "location": task.location,
                "description": task.description,
                "linked_location": get_task_linked_location(task),
                "linked_entity": get_task_linked_entity(task),
                "is_multi_day": False,
                "is_span_start": True,
                "is_span_end": True,
                "is_recurring": True,  # Mark as recurring projection
                "recurrence": task.recurrence.value if task.recurrence else None,
            })

    # Sort each day's events by time
    for date_str in calendar:
        calendar[date_str].sort(key=lambda x: (x.get("due_time") or "99:99", x.get("priority", 2)))

    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "tasks": calendar,
    }


@router.get("/cold-protection/")
async def get_cold_protection_needed(db: AsyncSession = Depends(get_db)):
    """
    Get plants that need cold protection based on today's forecast low temperature.
    Only returns data if there are plants that need protection.
    """
    # Get current weather and forecast
    reading = await weather_service.get_latest_reading(db)
    current_temp = reading.temp_outdoor if reading else None

    # Get the upcoming night's forecast low
    # We need to find the next nighttime low that's actually upcoming (not one that's ending)
    forecast = await forecast_service.get_forecast(lat=None, lon=None)
    forecast_low = None
    if forecast:
        from datetime import datetime, timezone
        import pytz

        # Get app timezone
        tz_name = "America/New_York"  # Default
        tz_result = await db.execute(
            select(AppSetting).where(AppSetting.key == "timezone")
        )
        tz_setting = tz_result.scalar_one_or_none()
        if tz_setting and tz_setting.value:
            tz_name = tz_setting.value

        try:
            app_tz = pytz.timezone(tz_name)
        except:
            app_tz = pytz.timezone("America/New_York")

        now = datetime.now(app_tz)

        # Find the next nighttime period that hasn't ended yet
        for period in forecast:
            if not period.get("is_daytime", True):
                # This is a night period - check if it's still upcoming or current
                end_time_str = period.get("end_time")
                if end_time_str:
                    try:
                        # Parse ISO format with timezone
                        end_time = datetime.fromisoformat(end_time_str.replace('Z', '+00:00'))
                        # Only use this period if it ends more than 2 hours from now
                        # (so we don't show an overnight that's about to end)
                        if end_time > now + timedelta(hours=2):
                            forecast_low = period.get("temperature")
                            break
                    except:
                        pass

        # Fallback: if no suitable night period found, use first available low
        if forecast_low is None:
            simple_forecast = await forecast_service.get_forecast_simple()
            if simple_forecast and len(simple_forecast) > 0:
                # Skip first entry if it has no high (meaning it's an ending overnight)
                for entry in simple_forecast:
                    if entry.get("low") is not None:
                        forecast_low = entry.get("low")
                        break

    # Use the forecast low for checking
    check_temp = forecast_low
    if check_temp is None:
        check_temp = current_temp

    if check_temp is None:
        return {"needs_protection": False, "plants": [], "current_temp": None, "forecast_low": None}

    # Add 7 degree buffer - NOAA forecasts can be optimistic by 6-7 degrees
    # e.g., NOAA forecast 32°F but actual low was 25.7°F
    # So if plant's min_temp is 32°F and forecast is 39°F, warn because actual could be ~32°F
    buffer_degrees = 7

    # Get frost-sensitive plants that need cover
    # Warn if forecast_low <= (plant_threshold + buffer)
    result = await db.execute(
        select(Plant)
        .where(Plant.frost_sensitive == True)
        .where(Plant.is_active == True)
        .where(
            or_(
                # Plants with specific cover temp threshold + buffer
                Plant.needs_cover_below_temp + buffer_degrees >= check_temp,
                # Plants with min_temp threshold + buffer (use if no specific cover temp)
                and_(
                    Plant.needs_cover_below_temp.is_(None),
                    Plant.min_temp + buffer_degrees >= check_temp
                )
            )
        )
        .order_by(Plant.name)
    )
    plants = result.scalars().all()

    if not plants:
        return {"needs_protection": False, "plants": [], "current_temp": current_temp, "forecast_low": forecast_low}

    plant_list = [
        {
            "id": p.id,
            "name": p.name,
            "variety": p.variety,
            "location": p.location,
            "min_temp": p.min_temp,
            "needs_cover_below_temp": p.needs_cover_below_temp,
        }
        for p in plants
    ]

    return {
        "needs_protection": True,
        "current_temp": current_temp,
        "forecast_low": forecast_low,
        "plants": plant_list,
    }


@router.get("/freeze-warning/")
async def get_freeze_warning(db: AsyncSession = Depends(get_db)):
    """
    Check if freeze is forecasted and return irrigation/pipe protection reminder.
    Returns warning if forecast low is at or below 32°F (with buffer).
    """
    from services.weather import get_threshold

    # Get current weather and forecast
    reading = await weather_service.get_latest_reading(db)
    current_temp = reading.temp_outdoor if reading else None

    # Get forecast - check tonight and next few nights
    forecast = await forecast_service.get_forecast_simple()

    freeze_threshold = await get_threshold(db, "freeze_warning_temp")  # Default 32°F
    buffer_degrees = 5  # Be conservative for pipes

    freeze_nights = []
    if forecast:
        for day in forecast[:4]:  # Check next 4 periods
            low_temp = day.get("low")
            if low_temp is not None and low_temp <= (freeze_threshold + buffer_degrees):
                freeze_nights.append({
                    "name": day.get("name"),
                    "low": low_temp,
                    "forecast": day.get("forecast")
                })

    if not freeze_nights:
        return {
            "freeze_warning": False,
            "current_temp": current_temp,
            "nights": []
        }

    return {
        "freeze_warning": True,
        "current_temp": current_temp,
        "nights": freeze_nights,
        "message": "Freeze forecasted! Protect exposed irrigation and pipes.",
        "recommendations": [
            "Disconnect and drain garden hoses",
            "Cover exposed outdoor faucets/spigots",
            "Drain or blow out irrigation lines if extended freeze expected",
            "Open cabinet doors under sinks on exterior walls",
            "Let faucets drip slightly to prevent pipe freeze"
        ]
    }


# === Storage Monitoring ===
# SECURITY: All paths are hardcoded constants - no user input accepted
from pathlib import Path
import shutil

# Hardcoded paths for security - prevents path traversal attacks
# Uses /opt/levi for backwards compatibility with existing deployments
ISAAC_DATA_DIR = Path("/opt/levi/data")
ISAAC_LOGS_DIR = Path("/opt/levi/logs")


class StorageStats(BaseModel):
    """Storage statistics response model"""
    # Whole disk stats
    disk_total_bytes: int
    disk_used_bytes: int
    disk_available_bytes: int
    disk_usage_percent: float

    # Isaac app breakdown
    database_bytes: int
    logs_bytes: int
    app_total_bytes: int

    # Human-readable formats
    disk_total_human: str
    disk_used_human: str
    disk_available_human: str
    database_human: str
    logs_human: str

    # Alert state for conditional dashboard display
    alert_level: str  # "ok", "warning", "critical"


def _format_bytes(size_bytes: int) -> str:
    """Format bytes to human readable string"""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} PB"


def _safe_get_size(path: Path) -> int:
    """
    Get file size safely.
    SECURITY: Rejects symlinks to prevent traversal attacks.
    """
    try:
        if path.exists() and path.is_file() and not path.is_symlink():
            return path.stat().st_size
    except (OSError, PermissionError):
        pass
    return 0


def _safe_dir_size(dir_path: Path) -> int:
    """
    Get total size of regular files in directory.
    SECURITY: Only counts regular files, rejects symlinks.
    """
    total = 0
    try:
        if dir_path.exists() and dir_path.is_dir():
            for f in dir_path.iterdir():
                if f.is_file() and not f.is_symlink():
                    try:
                        total += f.stat().st_size
                    except (OSError, PermissionError):
                        pass
    except (OSError, PermissionError):
        pass
    return total


@router.get("/storage/", response_model=StorageStats)
async def get_storage_stats(db: AsyncSession = Depends(get_db)):
    """
    Get storage statistics for disk and Isaac app components.
    SECURITY: All paths are hardcoded - no user input accepted.
    """
    from routers.settings import get_setting

    # Get whole disk usage (root partition)
    try:
        total, used, free = shutil.disk_usage("/")
        usage_percent = (used / total) * 100 if total > 0 else 0
    except OSError:
        total, used, free = 0, 0, 0
        usage_percent = 0

    # Get Isaac component sizes from hardcoded paths only
    db_size = _safe_get_size(ISAAC_DATA_DIR / "levi.db")
    log_size = _safe_dir_size(ISAAC_LOGS_DIR)
    app_total = db_size + log_size

    # Determine alert level based on settings
    warning_threshold = float(await get_setting(db, "storage_warning_percent") or "80")
    critical_threshold = float(await get_setting(db, "storage_critical_percent") or "95")

    if usage_percent >= critical_threshold:
        alert_level = "critical"
    elif usage_percent >= warning_threshold:
        alert_level = "warning"
    else:
        alert_level = "ok"

    return StorageStats(
        disk_total_bytes=total,
        disk_used_bytes=used,
        disk_available_bytes=free,
        disk_usage_percent=round(usage_percent, 1),
        database_bytes=db_size,
        logs_bytes=log_size,
        app_total_bytes=app_total,
        disk_total_human=_format_bytes(total),
        disk_used_human=_format_bytes(used),
        disk_available_human=_format_bytes(free),
        database_human=_format_bytes(db_size),
        logs_human=_format_bytes(log_size),
        alert_level=alert_level,
    )


@router.post("/storage/clear-logs/")
async def clear_logs():
    """
    Clear log files to free up space.
    SECURITY: Only deletes regular files from hardcoded ISAAC_LOGS_DIR.
    Symlinks and subdirectories are ignored.
    """
    cleared_count = 0
    cleared_bytes = 0

    try:
        if ISAAC_LOGS_DIR.exists() and ISAAC_LOGS_DIR.is_dir():
            for f in ISAAC_LOGS_DIR.iterdir():
                # SECURITY: Only delete regular files, not symlinks or directories
                if f.is_file() and not f.is_symlink():
                    try:
                        size = f.stat().st_size
                        f.unlink()
                        cleared_count += 1
                        cleared_bytes += size
                    except (OSError, PermissionError) as e:
                        # Log but don't fail on individual file errors
                        pass
    except (OSError, PermissionError) as e:
        return {
            "success": False,
            "error": "Permission denied accessing logs directory",
            "cleared_count": 0,
            "cleared_bytes": 0,
        }

    return {
        "success": True,
        "cleared_count": cleared_count,
        "cleared_bytes": cleared_bytes,
        "cleared_human": _format_bytes(cleared_bytes),
    }


@router.get("/verse-of-the-day")
async def get_verse_of_the_day():
    """
    Fetch verse of the day from bible.com
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://www.bible.com/verse-of-the-day",
                timeout=10.0,
                follow_redirects=True
            )
            response.raise_for_status()
            html = response.text

            # Extract verse from og:description meta tag
            match = re.search(r'og:description" content="([^"]+)"', html)
            if match:
                content = match.group(1)
                # Format: "Isaiah 60:1 "Arise, shine..." or "Romans 12:2 Do not conform..."
                # Content may have newlines so use re.DOTALL
                # Handle optional quotes around the verse text
                ref_match = re.match(r'^([\d\s]*[A-Za-z]+\s+\d+:\d+(?:-\d+)?)\s+["\u201c]?(.+)', content, re.DOTALL)
                if ref_match:
                    text = ref_match.group(2)
                    # Clean up: remove trailing quotes, replace newlines with spaces
                    text = text.replace('\n', ' ').strip()
                    text = text.rstrip('"\u201d.')
                    if text.endswith(','):
                        text = text.rstrip(',') + '...'
                    return {
                        "reference": ref_match.group(1),
                        "text": text,
                        "version": "NIV"
                    }

        # Fallback
        return {
            "reference": "Psalm 104:14",
            "text": "He causes the grass to grow for the cattle, and vegetation for the service of man, that he may bring forth food from the earth.",
            "version": "NIV"
        }
    except Exception as e:
        return {
            "reference": "Psalm 104:14",
            "text": "He causes the grass to grow for the cattle, and vegetation for the service of man, that he may bring forth food from the earth.",
            "version": "NIV"
        }
