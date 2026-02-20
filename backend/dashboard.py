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

from models.database import get_db
from models.plants import Plant
from models.livestock import Animal, AnimalType
from models.tasks import Task, TaskCategory, TaskType
from models.weather import WeatherReading, WeatherAlert
from services.weather import WeatherService, NWSForecastService


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
    is_completed: bool


class DashboardAlert(BaseModel):
    id: int
    title: str
    message: Optional[str]
    severity: str
    alert_type: str


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


class DashboardResponse(BaseModel):
    weather: Optional[DashboardWeather]
    tasks_today: List[DashboardTask]
    undated_todos: List[DashboardTask]  # Todos without a specific date
    alerts: List[DashboardAlert]
    stats: DashboardStats
    upcoming_events: List[CalendarEvent]


@router.get("/", response_model=DashboardResponse)
async def get_dashboard(db: AsyncSession = Depends(get_db)):
    """Get all dashboard data in a single request"""

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

    # Get today's tasks (items due today OR overdue)
    today = date.today()
    result = await db.execute(
        select(Task)
        .where(Task.due_date <= today)  # Today and overdue
        .where(Task.due_date.isnot(None))  # Must have a due date
        .where(Task.is_active == True)
        .order_by(Task.is_completed, Task.due_date, Task.priority, Task.due_time)
    )
    tasks = result.scalars().all()
    tasks_today = [
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
            is_completed=t.is_completed,
        )
        for t in tasks
    ]

    # Get undated todos (todos without a due date)
    result = await db.execute(
        select(Task)
        .where(Task.due_date.is_(None))
        .where(Task.is_active == True)
        .where(Task.is_completed == False)
        .order_by(Task.priority, Task.created_at)
        .limit(10)
    )
    undated = result.scalars().all()
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
            is_completed=t.is_completed,
        )
        for t in undated
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
        .where(Task.due_date == today)
        .where(Task.is_active == True)
        .where(Task.is_completed == False)
    )
    overdue_count = await db.execute(
        select(func.count())
        .select_from(Task)
        .where(Task.due_date < today)
        .where(Task.is_active == True)
        .where(Task.is_completed == False)
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

    # Get upcoming events (next 7 days)
    week_ahead = today + timedelta(days=7)
    result = await db.execute(
        select(Task)
        .where(Task.due_date >= today)
        .where(Task.due_date <= week_ahead)
        .where(Task.is_active == True)
        .order_by(Task.due_date, Task.priority)
        .limit(20)
    )
    upcoming = result.scalars().all()
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

    return DashboardResponse(
        weather=weather_data,
        tasks_today=tasks_today,
        undated_todos=undated_todos,
        alerts=alert_list,
        stats=stats,
        upcoming_events=upcoming_events,
    )


@router.get("/quick-stats")
async def get_quick_stats(db: AsyncSession = Depends(get_db)):
    """Get quick statistics for status bar"""
    today = date.today()

    # Count pending items
    tasks_pending = await db.execute(
        select(func.count())
        .select_from(Task)
        .where(Task.due_date <= today)
        .where(Task.is_active == True)
        .where(Task.is_completed == False)
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
    """Get calendar events for a specific month (only events, not todos)"""
    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end_date = date(year, month + 1, 1) - timedelta(days=1)

    result = await db.execute(
        select(Task)
        .where(Task.due_date >= start_date)
        .where(Task.due_date <= end_date)
        .where(Task.is_active == True)
        .where(Task.task_type == TaskType.EVENT)  # Only show events on calendar
        .order_by(Task.due_date, Task.priority)
    )
    tasks = result.scalars().all()

    # Group by date
    calendar = {}
    for task in tasks:
        date_str = task.due_date.isoformat()
        if date_str not in calendar:
            calendar[date_str] = []
        calendar[date_str].append({
            "id": task.id,
            "title": task.title,
            "category": task.category.value if task.category else "custom",
            "priority": task.priority,
            "is_completed": task.is_completed,
        })

    return {
        "year": year,
        "month": month,
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

    # Get today's forecast low
    forecast = await forecast_service.get_forecast_simple()
    forecast_low = None
    if forecast and len(forecast) > 0:
        # First entry is usually today/tonight
        forecast_low = forecast[0].get("low")

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
# Uses /opt/isaac for backwards compatibility with existing deployments
ISAAC_DATA_DIR = Path("/opt/isaac/data")
ISAAC_LOGS_DIR = Path("/opt/isaac/logs")


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
    db_size = _safe_get_size(ISAAC_DATA_DIR / "isaac.db")
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
