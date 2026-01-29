"""
Garden Planning API Routes
Frost dates, planting schedule, planting events, overview dashboard
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc
from typing import Optional
from datetime import datetime, date, timedelta
from pydantic import BaseModel, Field
import re

from models.database import get_db
from models.garden import PlantingEvent
from models.plants import Plant, PlantCareLog
from models.seeds import Seed
from models.settings import AppSetting
from models.users import User
from routers.auth import require_auth
from services.planting_calculator import calculate_planting_schedule, MONTH_NAMES
from loguru import logger
from config import settings as app_config


router = APIRouter(prefix="/garden", tags=["Garden"])


# ============================================
# Pydantic Schemas
# ============================================

class FrostDatesResponse(BaseModel):
    last_frost_date: str  # MM/DD
    first_frost_date: str  # MM/DD
    usda_zone: str

class FrostDatesUpdate(BaseModel):
    last_frost_date: str = Field(..., pattern=r"^\d{2}/\d{2}$")
    first_frost_date: str = Field(..., pattern=r"^\d{2}/\d{2}$")

class PlantingEventCreate(BaseModel):
    seed_id: int
    activity_type: str = Field(..., pattern=r"^(start_indoors|direct_sow|transplant|harvest|other)$")
    start_date: str  # YYYY-MM-DD
    end_date: Optional[str] = None
    notes: Optional[str] = None

class PlantingEventUpdate(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    activity_type: Optional[str] = None
    notes: Optional[str] = None


# ============================================
# Frost Date Endpoints
# ============================================

async def _get_frost_dates(db: AsyncSession) -> dict:
    """Get frost dates from app_settings with defaults."""
    last_frost = "02/15"
    first_frost = "12/15"

    result = await db.execute(
        select(AppSetting).where(AppSetting.key == "garden_last_frost_date")
    )
    setting = result.scalar_one_or_none()
    if setting and setting.value:
        last_frost = setting.value

    result = await db.execute(
        select(AppSetting).where(AppSetting.key == "garden_first_frost_date")
    )
    setting = result.scalar_one_or_none()
    if setting and setting.value:
        first_frost = setting.value

    return {"last_frost_date": last_frost, "first_frost_date": first_frost}


@router.get("/frost-dates/")
async def get_frost_dates(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Get frost date configuration."""
    dates = await _get_frost_dates(db)
    return FrostDatesResponse(
        last_frost_date=dates["last_frost_date"],
        first_frost_date=dates["first_frost_date"],
        usda_zone=app_config.usda_zone,
    )


@router.put("/frost-dates/")
async def update_frost_dates(
    data: FrostDatesUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Update frost dates."""
    # Validate MM/DD format
    for date_str in [data.last_frost_date, data.first_frost_date]:
        parts = date_str.split("/")
        month, day = int(parts[0]), int(parts[1])
        if not (1 <= month <= 12 and 1 <= day <= 31):
            raise HTTPException(status_code=400, detail="Invalid date format. Use MM/DD.")

    # Upsert last frost
    result = await db.execute(
        select(AppSetting).where(AppSetting.key == "garden_last_frost_date")
    )
    setting = result.scalar_one_or_none()
    if setting:
        setting.value = data.last_frost_date
    else:
        db.add(AppSetting(key="garden_last_frost_date", value=data.last_frost_date))

    # Upsert first frost
    result = await db.execute(
        select(AppSetting).where(AppSetting.key == "garden_first_frost_date")
    )
    setting = result.scalar_one_or_none()
    if setting:
        setting.value = data.first_frost_date
    else:
        db.add(AppSetting(key="garden_first_frost_date", value=data.first_frost_date))

    await db.commit()
    logger.info(f"Updated frost dates: last={data.last_frost_date}, first={data.first_frost_date}")

    return {"status": "ok", "last_frost_date": data.last_frost_date, "first_frost_date": data.first_frost_date}


# ============================================
# Planting Schedule (Auto-generated from seeds)
# ============================================

@router.get("/planting-schedule/")
async def get_planting_schedule(
    year: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Get auto-generated planting schedule based on seed data and frost dates."""
    frost_dates = await _get_frost_dates(db)

    # Get all active seeds
    result = await db.execute(
        select(Seed).where(Seed.is_active == True)
    )
    seeds = result.scalars().all()

    schedule = calculate_planting_schedule(
        seeds=seeds,
        last_frost_mm_dd=frost_dates["last_frost_date"],
        first_frost_mm_dd=frost_dates["first_frost_date"],
        year=year,
    )

    return schedule


# ============================================
# Planting Events CRUD (User-created)
# ============================================

@router.get("/events/")
async def list_planting_events(
    year: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """List user-created planting events."""
    if year is None:
        year = date.today().year

    query = select(PlantingEvent).where(
        PlantingEvent.is_active == True,
        func.extract("year", PlantingEvent.start_date) == year,
    ).order_by(PlantingEvent.start_date)

    result = await db.execute(query)
    events = result.scalars().all()

    return [
        {
            "id": e.id,
            "seed_id": e.seed_id,
            "seed_name": e.seed.name if e.seed else None,
            "plant_id": e.plant_id,
            "activity_type": e.activity_type,
            "start_date": e.start_date.isoformat() if e.start_date else None,
            "end_date": e.end_date.isoformat() if e.end_date else None,
            "succession_group_id": e.succession_group_id,
            "succession_number": e.succession_number,
            "is_completed": e.is_completed,
            "completed_at": e.completed_at.isoformat() if e.completed_at else None,
            "notes": e.notes,
        }
        for e in events
    ]


@router.post("/events/")
async def create_planting_event(
    data: PlantingEventCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Create a planting event."""
    # Validate seed exists
    result = await db.execute(select(Seed).where(Seed.id == data.seed_id))
    seed = result.scalar_one_or_none()
    if not seed:
        raise HTTPException(status_code=404, detail="Seed not found")

    try:
        start = date.fromisoformat(data.start_date)
        end = date.fromisoformat(data.end_date) if data.end_date else None
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    event = PlantingEvent(
        seed_id=data.seed_id,
        activity_type=data.activity_type,
        start_date=start,
        end_date=end,
        notes=data.notes,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    return {
        "id": event.id,
        "seed_id": event.seed_id,
        "seed_name": seed.name,
        "activity_type": event.activity_type,
        "start_date": event.start_date.isoformat(),
        "end_date": event.end_date.isoformat() if event.end_date else None,
        "notes": event.notes,
    }


@router.patch("/events/{event_id}/")
async def update_planting_event(
    event_id: int,
    data: PlantingEventUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Update a planting event (e.g., drag-and-drop date change)."""
    result = await db.execute(
        select(PlantingEvent).where(PlantingEvent.id == event_id, PlantingEvent.is_active == True)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if data.start_date:
        try:
            event.start_date = date.fromisoformat(data.start_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format")
    if data.end_date is not None:
        event.end_date = date.fromisoformat(data.end_date) if data.end_date else None
    if data.activity_type:
        event.activity_type = data.activity_type
    if data.notes is not None:
        event.notes = data.notes

    event.updated_at = datetime.utcnow()
    await db.commit()

    return {"status": "ok", "id": event.id}


@router.delete("/events/{event_id}/")
async def delete_planting_event(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Delete a planting event."""
    result = await db.execute(
        select(PlantingEvent).where(PlantingEvent.id == event_id, PlantingEvent.is_active == True)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    event.is_active = False
    await db.commit()

    return {"status": "ok"}


@router.post("/events/{event_id}/complete/")
async def complete_planting_event(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Mark a planting event as completed."""
    result = await db.execute(
        select(PlantingEvent).where(PlantingEvent.id == event_id, PlantingEvent.is_active == True)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    event.is_completed = True
    event.completed_at = datetime.utcnow()
    await db.commit()

    return {"status": "ok", "id": event.id}


# ============================================
# Garden Overview (Dashboard)
# ============================================

@router.get("/overview/")
async def get_garden_overview(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Get aggregated garden dashboard data."""
    import pytz
    from config import settings as cfg

    try:
        tz = pytz.timezone(cfg.timezone)
    except Exception:
        tz = pytz.timezone("America/New_York")

    now = datetime.now(tz)
    today = now.date()
    current_month = today.month

    # --- This Month's Activities ---
    frost_dates = await _get_frost_dates(db)
    result = await db.execute(select(Seed).where(Seed.is_active == True))
    seeds = result.scalars().all()

    schedule = calculate_planting_schedule(
        seeds=seeds,
        last_frost_mm_dd=frost_dates["last_frost_date"],
        first_frost_mm_dd=frost_dates["first_frost_date"],
        year=today.year,
    )

    this_month_data = schedule["months"][current_month - 1] if schedule["months"] else None

    # --- Needs Attention ---
    # Plants needing water
    result = await db.execute(
        select(Plant).where(Plant.is_active == True)
    )
    all_plants = result.scalars().all()

    needs_water = []
    needs_fertilizer = []
    frost_sensitive_plants = []

    for plant in all_plants:
        # Check watering
        if plant.next_watering and not plant.sprinkler_enabled:
            next_water = plant.next_watering
            if hasattr(next_water, 'date'):
                next_water = next_water.date()
            if next_water <= today:
                needs_water.append({
                    "id": plant.id,
                    "name": plant.name,
                    "location": plant.location,
                    "days_overdue": (today - next_water).days,
                })

        # Check fertilizing
        if plant.next_fertilizing:
            next_fert = plant.next_fertilizing
            if hasattr(next_fert, 'date'):
                next_fert = next_fert.date()
            if next_fert <= today:
                needs_fertilizer.append({
                    "id": plant.id,
                    "name": plant.name,
                    "location": plant.location,
                })

        # Frost sensitive
        if plant.frost_sensitive:
            frost_sensitive_plants.append({
                "id": plant.id,
                "name": plant.name,
                "location": plant.location,
                "min_temp": plant.min_temp,
            })

    # Overdue events
    result = await db.execute(
        select(PlantingEvent).where(
            PlantingEvent.is_active == True,
            PlantingEvent.is_completed == False,
            PlantingEvent.start_date < today,
        )
    )
    overdue_events = result.scalars().all()
    overdue_list = [
        {
            "id": e.id,
            "seed_name": e.seed.name if e.seed else "Unknown",
            "activity_type": e.activity_type,
            "start_date": e.start_date.isoformat(),
            "days_overdue": (today - e.start_date).days,
        }
        for e in overdue_events
    ]

    # --- Stats ---
    total_plants = len([p for p in all_plants if p.is_active])
    total_seeds = len(seeds)

    # Growth stage counts
    stages = {}
    for plant in all_plants:
        if plant.growth_stage:
            stages[plant.growth_stage] = stages.get(plant.growth_stage, 0) + 1

    # Growing season progress
    try:
        last_frost = date(today.year, int(frost_dates["last_frost_date"].split("/")[0]), int(frost_dates["last_frost_date"].split("/")[1]))
        first_frost = date(today.year, int(frost_dates["first_frost_date"].split("/")[0]), int(frost_dates["first_frost_date"].split("/")[1]))
        total_season_days = (first_frost - last_frost).days
        days_since_last_frost = max(0, (today - last_frost).days)
        days_until_first_frost = max(0, (first_frost - today).days)
        progress_pct = min(100, max(0, int((days_since_last_frost / total_season_days) * 100))) if total_season_days > 0 else 0
    except Exception:
        days_since_last_frost = 0
        days_until_first_frost = 0
        progress_pct = 0

    # --- Active Lifecycle ---
    active_stages = ["seed", "seedling", "transplanted", "vegetative", "flowering", "fruiting"]
    active_lifecycle = []
    for plant in all_plants:
        if plant.growth_stage and plant.growth_stage in active_stages:
            # Calculate days in stage
            stage_date = None
            if plant.growth_stage == "seed":
                stage_date = plant.date_sown
            elif plant.growth_stage == "seedling":
                stage_date = plant.date_germinated
            elif plant.growth_stage == "transplanted":
                stage_date = plant.date_transplanted
            elif plant.growth_stage in ["vegetative", "flowering", "fruiting", "harvesting"]:
                stage_date = plant.updated_at

            days_in_stage = 0
            if stage_date:
                stage_d = stage_date.date() if hasattr(stage_date, 'date') else stage_date
                days_in_stage = (today - stage_d).days

            active_lifecycle.append({
                "id": plant.id,
                "name": plant.name,
                "growth_stage": plant.growth_stage,
                "days_in_stage": days_in_stage,
                "seed_name": plant.seed.name if plant.seed else None,
                "location": plant.location,
            })

    # --- Recent Care ---
    result = await db.execute(
        select(PlantCareLog)
        .order_by(desc(PlantCareLog.performed_at))
        .limit(5)
    )
    recent_logs = result.scalars().all()

    recent_care = []
    for log in recent_logs:
        # Get plant name
        plant_result = await db.execute(
            select(Plant.name).where(Plant.id == log.plant_id)
        )
        plant_name = plant_result.scalar_one_or_none() or "Unknown"
        recent_care.append({
            "plant_name": plant_name,
            "care_type": log.care_type,
            "performed_at": log.performed_at.isoformat() if log.performed_at else None,
            "notes": log.notes,
            "quantity": log.quantity,
        })

    return {
        "this_month": this_month_data,
        "needs_attention": {
            "needs_water": needs_water[:10],  # Cap at 10
            "needs_fertilizer": needs_fertilizer[:10],
            "frost_sensitive": frost_sensitive_plants[:10],
            "overdue_events": overdue_list,
        },
        "stats": {
            "total_plants": total_plants,
            "total_seeds": total_seeds,
            "stages": stages,
            "growing_season": {
                "days_since_last_frost": days_since_last_frost,
                "days_until_first_frost": days_until_first_frost,
                "progress_pct": progress_pct,
            },
        },
        "active_lifecycle": active_lifecycle[:15],  # Cap at 15
        "recent_care": recent_care,
        "frost_dates": frost_dates,
    }
