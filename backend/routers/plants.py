"""
Plant and Tree API Routes
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, date, timedelta
from pydantic import BaseModel, Field

from models.database import get_db
from models.plants import Plant, PlantCareLog, Tag, GrowthRate, SunRequirement, MoisturePreference
from models.weather import WeatherReading
from models.users import User
from services.permissions import require_create, require_edit, require_delete, require_interact
from services.auto_reminders import delete_reminder
from services.plant_import import plant_import_service
from loguru import logger


router = APIRouter(prefix="/plants", tags=["Plants"])


# Pydantic Schemas
class TagResponse(BaseModel):
    id: int
    name: str
    color: str

    class Config:
        from_attributes = True


class PlantCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    latin_name: Optional[str] = Field(None, max_length=150)
    variety: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=5000)
    location: Optional[str] = Field(None, max_length=200)
    sub_location: Optional[str] = Field(None, max_length=200)
    date_planted: Optional[datetime] = None
    source: Optional[str] = Field(None, max_length=200)

    # Growing requirements
    grow_zones: Optional[str] = Field(None, max_length=50)
    sun_requirement: SunRequirement = SunRequirement.FULL_SUN
    soil_requirements: Optional[str] = Field(None, max_length=500)
    plant_spacing: Optional[str] = Field(None, max_length=100)

    # Size & Growth
    size_full_grown: Optional[str] = Field(None, max_length=100)
    growth_rate: GrowthRate = GrowthRate.MODERATE

    # Cold tolerance
    min_temp: Optional[float] = Field(None, ge=-50, le=120)
    frost_sensitive: bool = False
    needs_cover_below_temp: Optional[float] = Field(None, ge=-50, le=120)

    # Heat/drought tolerance
    heat_tolerant: bool = True
    drought_tolerant: bool = False
    salt_tolerant: bool = False
    needs_shade_above_temp: Optional[float] = Field(None, ge=0, le=150)

    # Watering & Fertilizing
    water_schedule: Optional[str] = Field(None, max_length=200)  # "summer:3,winter:10,spring:5,fall:7"
    moisture_preference: Optional[MoisturePreference] = None  # Used to auto-calculate water_schedule
    fertilize_schedule: Optional[str] = Field(None, max_length=200)

    # Automatic watering
    receives_rain: bool = False  # Plant gets natural rainfall
    rain_threshold_inches: Optional[float] = Field(0.25, ge=0.1, le=2.0)  # Min rain to count as watering
    sprinkler_enabled: bool = False  # Plant has sprinkler coverage
    sprinkler_schedule: Optional[str] = Field(None, max_length=100)  # "days:0,1,3,5;time:06:00"

    # Pruning
    prune_frequency: Optional[str] = Field(None, max_length=100)
    prune_months: Optional[str] = Field(None, max_length=50)

    # Production
    produces_months: Optional[str] = Field(None, max_length=100)
    harvest_frequency: Optional[str] = Field(None, max_length=100)
    how_to_harvest: Optional[str] = Field(None, max_length=1000)

    # Uses & Propagation
    uses: Optional[str] = Field(None, max_length=10000)
    propagation_methods: Optional[str] = Field(None, max_length=500)
    cultivation_details: Optional[str] = Field(None, max_length=10000)

    # Warnings
    known_hazards: Optional[str] = Field(None, max_length=1000)
    special_considerations: Optional[str] = Field(None, max_length=1000)

    notes: Optional[str] = Field(None, max_length=5000)
    references: Optional[str] = Field(None, max_length=10000)
    tag_ids: Optional[List[int]] = None


class PlantUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    latin_name: Optional[str] = Field(None, max_length=150)
    variety: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=5000)
    location: Optional[str] = Field(None, max_length=200)
    sub_location: Optional[str] = Field(None, max_length=200)
    date_planted: Optional[datetime] = None

    grow_zones: Optional[str] = Field(None, max_length=50)
    sun_requirement: Optional[SunRequirement] = None
    soil_requirements: Optional[str] = Field(None, max_length=500)
    plant_spacing: Optional[str] = Field(None, max_length=100)
    size_full_grown: Optional[str] = Field(None, max_length=100)
    growth_rate: Optional[GrowthRate] = None

    min_temp: Optional[float] = Field(None, ge=-50, le=120)
    frost_sensitive: Optional[bool] = None
    needs_cover_below_temp: Optional[float] = Field(None, ge=-50, le=120)
    heat_tolerant: Optional[bool] = None
    drought_tolerant: Optional[bool] = None

    water_schedule: Optional[str] = Field(None, max_length=200)
    moisture_preference: Optional[MoisturePreference] = None
    fertilize_schedule: Optional[str] = Field(None, max_length=200)
    last_watered: Optional[datetime] = None
    last_watering_decision: Optional[datetime] = None
    last_fertilized: Optional[datetime] = None
    last_pruned: Optional[datetime] = None

    # Automatic watering
    receives_rain: Optional[bool] = None
    rain_threshold_inches: Optional[float] = Field(None, ge=0.1, le=2.0)
    sprinkler_enabled: Optional[bool] = None
    sprinkler_schedule: Optional[str] = Field(None, max_length=100)

    prune_frequency: Optional[str] = Field(None, max_length=100)
    prune_months: Optional[str] = Field(None, max_length=50)
    produces_months: Optional[str] = Field(None, max_length=100)
    harvest_frequency: Optional[str] = Field(None, max_length=100)
    how_to_harvest: Optional[str] = Field(None, max_length=1000)

    uses: Optional[str] = Field(None, max_length=10000)
    propagation_methods: Optional[str] = Field(None, max_length=500)
    cultivation_details: Optional[str] = Field(None, max_length=10000)
    known_hazards: Optional[str] = Field(None, max_length=1000)
    special_considerations: Optional[str] = Field(None, max_length=1000)
    notes: Optional[str] = Field(None, max_length=5000)
    references: Optional[str] = Field(None, max_length=10000)
    tag_ids: Optional[List[int]] = None


class PlantResponse(BaseModel):
    id: int
    name: str
    latin_name: Optional[str]
    variety: Optional[str]
    description: Optional[str]
    location: Optional[str]
    sub_location: Optional[str]
    date_planted: Optional[datetime]
    source: Optional[str]

    grow_zones: Optional[str]
    sun_requirement: Optional[SunRequirement]
    soil_requirements: Optional[str]
    plant_spacing: Optional[str]
    size_full_grown: Optional[str]
    growth_rate: Optional[GrowthRate]

    min_temp: Optional[float]
    frost_sensitive: bool
    needs_cover_below_temp: Optional[float]
    heat_tolerant: bool
    drought_tolerant: bool
    salt_tolerant: bool
    needs_shade_above_temp: Optional[float]

    water_schedule: Optional[str]
    moisture_preference: Optional[MoisturePreference]
    last_watered: Optional[datetime]
    last_watering_decision: Optional[datetime]
    fertilize_schedule: Optional[str]
    last_fertilized: Optional[datetime]

    # Automatic watering
    receives_rain: bool = False
    rain_threshold_inches: Optional[float]
    sprinkler_enabled: bool = False
    sprinkler_schedule: Optional[str]

    prune_frequency: Optional[str]
    prune_months: Optional[str]
    last_pruned: Optional[datetime]

    produces_months: Optional[str]
    harvest_frequency: Optional[str]
    how_to_harvest: Optional[str]

    uses: Optional[str]
    propagation_methods: Optional[str]
    cultivation_details: Optional[str]
    known_hazards: Optional[str]
    special_considerations: Optional[str]

    is_active: bool
    notes: Optional[str]
    references: Optional[str]
    created_at: datetime

    tags: List[TagResponse] = []

    # Computed fields
    age_years: Optional[float] = None
    next_watering: Optional[datetime] = None
    next_fertilizing: Optional[datetime] = None
    water_days_current_season: Optional[int] = None
    fertilize_days_current_season: Optional[int] = None

    class Config:
        from_attributes = True


class CareLogCreate(BaseModel):
    care_type: str  # watered, fertilized, pruned, treated, harvested
    notes: Optional[str] = None
    quantity: Optional[str] = None
    performed_at: Optional[datetime] = None


class CareLogResponse(BaseModel):
    id: int
    plant_id: int
    care_type: str
    notes: Optional[str]
    quantity: Optional[str]
    performed_at: datetime

    class Config:
        from_attributes = True


async def sync_plant_reminders(db: AsyncSession, plant: Plant):
    """Sync all care reminders for plants to calendar.

    Since plant reminders are now grouped by location, we re-sync all plant
    reminders when any plant is updated to ensure groups are correct.
    """
    from services.auto_reminders import sync_all_plant_reminders
    try:
        await sync_all_plant_reminders(db)
    except Exception as e:
        logger.error(f"Failed to sync plant reminders: {e}")


def plant_to_response(plant: Plant) -> dict:
    """Convert Plant model to response with computed fields"""
    data = {
        "id": plant.id,
        "name": plant.name,
        "latin_name": plant.latin_name,
        "variety": plant.variety,
        "description": plant.description,
        "location": plant.location,
        "sub_location": plant.sub_location,
        "date_planted": plant.date_planted,
        "source": plant.source,
        "grow_zones": plant.grow_zones,
        "sun_requirement": plant.sun_requirement,
        "soil_requirements": plant.soil_requirements,
        "plant_spacing": plant.plant_spacing,
        "size_full_grown": plant.size_full_grown,
        "growth_rate": plant.growth_rate,
        "min_temp": plant.min_temp,
        "frost_sensitive": plant.frost_sensitive,
        "needs_cover_below_temp": plant.needs_cover_below_temp,
        "heat_tolerant": plant.heat_tolerant,
        "drought_tolerant": plant.drought_tolerant,
        "salt_tolerant": plant.salt_tolerant,
        "needs_shade_above_temp": plant.needs_shade_above_temp,
        "water_schedule": plant.water_schedule,
        "moisture_preference": plant.moisture_preference,
        "last_watered": plant.last_watered,
        "last_watering_decision": plant.last_watering_decision,
        "receives_rain": plant.receives_rain,
        "rain_threshold_inches": plant.rain_threshold_inches,
        "sprinkler_enabled": plant.sprinkler_enabled,
        "sprinkler_schedule": plant.sprinkler_schedule,
        "fertilize_schedule": plant.fertilize_schedule,
        "last_fertilized": plant.last_fertilized,
        "prune_frequency": plant.prune_frequency,
        "prune_months": plant.prune_months,
        "last_pruned": plant.last_pruned,
        "produces_months": plant.produces_months,
        "harvest_frequency": plant.harvest_frequency,
        "how_to_harvest": plant.how_to_harvest,
        "uses": plant.uses,
        "propagation_methods": plant.propagation_methods,
        "cultivation_details": plant.cultivation_details,
        "known_hazards": plant.known_hazards,
        "special_considerations": plant.special_considerations,
        "is_active": plant.is_active,
        "notes": plant.notes,
        "references": plant.references,
        "created_at": plant.created_at,
        "tags": [{"id": t.id, "name": t.name, "color": t.color} for t in plant.tags],
        "age_years": plant.age_years,
        "next_watering": plant.next_watering,
        "next_fertilizing": plant.next_fertilizing,
        "water_days_current_season": plant.get_water_days_for_season(),
        "fertilize_days_current_season": plant.get_fertilize_days_for_season(),
    }
    return data


# Routes
@router.get("/")
async def list_plants(
    tag: Optional[str] = None,
    active_only: bool = True,
    frost_sensitive: Optional[bool] = None,
    needs_water: Optional[bool] = None,
    limit: int = 500,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """List all plants with optional filtering"""
    # Cap limit for DoS prevention
    limit = min(limit, 1000)

    query = select(Plant).options(selectinload(Plant.tags))

    if active_only:
        query = query.where(Plant.is_active == True)
    if frost_sensitive is not None:
        query = query.where(Plant.frost_sensitive == frost_sensitive)

    query = query.order_by(Plant.name).offset(offset).limit(limit)
    result = await db.execute(query)
    plants = result.scalars().all()

    # Filter by tag if specified
    if tag:
        plants = [p for p in plants if any(t.name.lower() == tag.lower() for t in p.tags)]

    # Filter by needs water
    if needs_water:
        now = datetime.utcnow()
        plants = [p for p in plants if p.next_watering and p.next_watering <= now]

    return [plant_to_response(p) for p in plants]


@router.post("/")
async def create_plant(
    plant: PlantCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_create("plants"))
):
    """Add a new plant to the catalog"""
    data = plant.model_dump(exclude={'tag_ids'})
    db_plant = Plant(**data)

    # Add tags if specified
    if plant.tag_ids:
        result = await db.execute(select(Tag).where(Tag.id.in_(plant.tag_ids)))
        tags = result.scalars().all()
        db_plant.tags = tags

    db.add(db_plant)
    await db.commit()
    await db.refresh(db_plant)

    # Sync care reminders to calendar
    await sync_plant_reminders(db, db_plant)

    # Reload with tags
    result = await db.execute(
        select(Plant).options(selectinload(Plant.tags)).where(Plant.id == db_plant.id)
    )
    db_plant = result.scalar_one()
    return plant_to_response(db_plant)


@router.get("/tags/")
async def list_tags(db: AsyncSession = Depends(get_db)):
    """Get all available tags"""
    result = await db.execute(select(Tag).order_by(Tag.name))
    return result.scalars().all()


@router.post("/tags/")
async def create_tag(
    name: str,
    color: str = "gray",
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_create("plants"))
):
    """Create a new tag"""
    tag = Tag(name=name, color=color)
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return tag


# Plant Import Schemas (must be before /{plant_id} routes)
class PlantImportRequest(BaseModel):
    url: str = Field(..., description="URL to import plant data from (pfaf.org or permapeople.org)")


class PlantImportPreview(BaseModel):
    """Preview of imported data before creating plant"""
    data: dict
    source_url: str


@router.post("/import/preview/")
async def preview_plant_import(request: PlantImportRequest):
    """
    Preview plant data from a URL before importing.
    Supports pfaf.org and permapeople.org URLs.
    Returns extracted plant data without creating a plant.
    """
    try:
        data = await plant_import_service.import_from_url(request.url)
        return PlantImportPreview(data=data, source_url=request.url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to import plant from {request.url}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch plant data: {str(e)}")


@router.post("/import/", response_model=PlantResponse)
async def import_plant(
    request: PlantImportRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_create("plants"))
):
    """
    Import plant data from a URL and create a new plant.
    Supports pfaf.org and permapeople.org URLs.
    """
    try:
        data = await plant_import_service.import_from_url(request.url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to import plant from {request.url}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch plant data: {str(e)}")

    if not data.get("name"):
        raise HTTPException(status_code=400, detail="Could not extract plant name from URL")

    # Map growth_rate string to enum
    growth_rate = GrowthRate.MODERATE
    if "growth_rate" in data:
        rate_map = {
            "slow": GrowthRate.SLOW,
            "moderate": GrowthRate.MODERATE,
            "fast": GrowthRate.FAST,
            "very_fast": GrowthRate.VERY_FAST,
        }
        growth_rate = rate_map.get(data["growth_rate"], GrowthRate.MODERATE)

    # Map sun_requirement string to enum
    sun_requirement = SunRequirement.FULL_SUN
    if "sun_requirement" in data:
        sun_map = {
            "full_sun": SunRequirement.FULL_SUN,
            "partial_sun": SunRequirement.PARTIAL_SUN,
            "partial_shade": SunRequirement.PARTIAL_SHADE,
            "full_shade": SunRequirement.FULL_SHADE,
        }
        sun_requirement = sun_map.get(data["sun_requirement"], SunRequirement.FULL_SUN)

    # Map moisture_preference string to enum
    moisture_preference = None
    if "moisture_preference" in data:
        moisture_map = {
            "dry": MoisturePreference.DRY,
            "dry_moist": MoisturePreference.DRY_MOIST,
            "moist": MoisturePreference.MOIST,
            "moist_wet": MoisturePreference.MOIST_WET,
            "wet": MoisturePreference.WET,
        }
        moisture_preference = moisture_map.get(data["moisture_preference"])

    # Add source URL to notes
    notes = data.get("notes", "")
    notes = f"{notes}\nSource: {request.url}" if notes else f"Source: {request.url}"

    # Create plant
    plant = Plant(
        name=data.get("name"),
        latin_name=data.get("latin_name"),
        variety=data.get("variety"),
        description=data.get("description"),
        grow_zones=data.get("grow_zones"),
        sun_requirement=sun_requirement,
        moisture_preference=moisture_preference,
        soil_requirements=data.get("soil_requirements"),
        size_full_grown=data.get("size_full_grown"),
        growth_rate=growth_rate,
        min_temp=data.get("min_temp"),
        frost_sensitive=data.get("frost_sensitive", False),
        uses=data.get("uses"),
        known_hazards=data.get("known_hazards"),
        propagation_methods=data.get("propagation_methods"),
        cultivation_details=data.get("cultivation"),
        references=data.get("references"),
        notes=notes,
    )

    db.add(plant)
    await db.commit()
    await db.refresh(plant)

    logger.info(f"Imported plant '{plant.name}' from {request.url}")
    return plant_to_response(plant)


@router.get("/water-overview/")
async def get_water_overview(
    days: int = Query(7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
):
    """
    Get comprehensive water overview for all plants.

    Returns rain totals, watering activity, smart watering decisions,
    soil moisture status, and upcoming watering schedule.
    """
    now = datetime.utcnow()
    cutoff = now - timedelta(days=days)

    # --- Rain Data ---
    rain_result = await db.execute(
        select(
            func.date(WeatherReading.timestamp).label('day'),
            func.max(WeatherReading.rain_daily).label('rain_daily')
        )
        .where(WeatherReading.timestamp >= cutoff)
        .group_by(func.date(WeatherReading.timestamp))
        .order_by(desc(func.date(WeatherReading.timestamp)))
    )
    rain_rows = rain_result.all()

    rain_by_day = []
    total_rain = 0.0
    for row in rain_rows:
        day_str = str(row.day)
        daily_rain = float(row.rain_daily or 0)
        rain_by_day.append({"date": day_str, "rain_inches": round(daily_rain, 2)})
        total_rain += daily_rain

    rain_days = len([r for r in rain_by_day if r["rain_inches"] > 0])

    # Current rain (latest reading)
    latest_weather = await db.execute(
        select(WeatherReading)
        .order_by(desc(WeatherReading.timestamp))
        .limit(1)
    )
    latest = latest_weather.scalar_one_or_none()
    current_rain = {
        "rain_rate": round(float(latest.rain_rate or 0), 2) if latest else 0,
        "rain_daily": round(float(latest.rain_daily or 0), 2) if latest else 0,
        "rain_weekly": round(float(latest.rain_weekly or 0), 2) if latest else 0,
        "rain_monthly": round(float(latest.rain_monthly or 0), 2) if latest else 0,
    }

    # Soil moisture from latest reading
    soil_moisture = None
    if latest:
        sensors = []
        for i in range(1, 5):
            val = getattr(latest, f'soil_moisture_{i}', None)
            if val is not None:
                sensors.append({"sensor": i, "moisture_pct": round(float(val), 1)})
        if sensors:
            soil_moisture = sensors

    # --- Watering Activity ---
    care_result = await db.execute(
        select(PlantCareLog)
        .where(and_(
            PlantCareLog.performed_at >= cutoff,
            PlantCareLog.care_type.in_(["watered", "skipped"])
        ))
        .order_by(desc(PlantCareLog.performed_at))
    )
    care_logs = list(care_result.scalars().all())

    watered_count = len([c for c in care_logs if c.care_type == "watered"])
    skipped_count = len([c for c in care_logs if c.care_type == "skipped"])

    # Skip reasons breakdown
    skip_reasons = {}
    for c in care_logs:
        if c.care_type == "skipped" and c.skip_reason:
            skip_reasons[c.skip_reason] = skip_reasons.get(c.skip_reason, 0) + 1

    # Watering activity by day
    activity_by_day = {}
    for c in care_logs:
        day_str = c.performed_at.strftime('%Y-%m-%d') if c.performed_at else None
        if day_str:
            if day_str not in activity_by_day:
                activity_by_day[day_str] = {"watered": 0, "skipped": 0}
            activity_by_day[day_str][c.care_type] = activity_by_day[day_str].get(c.care_type, 0) + 1

    # --- Plant Watering Status ---
    plants_result = await db.execute(
        select(Plant)
        .options(selectinload(Plant.tags))
        .where(Plant.is_active == True)
    )
    all_plants = list(plants_result.scalars().all())

    needs_water = []
    recently_watered = []
    rain_tracked = 0
    sprinkler_tracked = 0
    total_with_schedule = 0

    for p in all_plants:
        next_water = p.next_watering
        if next_water and next_water <= now:
            needs_water.append({
                "id": p.id,
                "name": p.name,
                "location": p.location,
                "days_overdue": (now - next_water).days,
                "last_watered": p.last_watered.isoformat() if p.last_watered else None,
            })
        elif p.last_watered and (now - p.last_watered).days <= 2:
            recently_watered.append({
                "id": p.id,
                "name": p.name,
                "last_watered": p.last_watered.isoformat(),
            })

        if p.receives_rain:
            rain_tracked += 1
        if p.sprinkler_enabled:
            sprinkler_tracked += 1
        if p.water_schedule or p.moisture_preference:
            total_with_schedule += 1

    # Sort needs_water by most overdue first
    needs_water.sort(key=lambda x: x["days_overdue"], reverse=True)

    return {
        "period_days": days,
        "rain": {
            "total_inches": round(total_rain, 2),
            "rain_days": rain_days,
            "dry_days": days - rain_days,
            "current": current_rain,
            "by_day": rain_by_day[:14],  # Last 14 days max
        },
        "soil_moisture": soil_moisture,
        "watering_activity": {
            "total_watered": watered_count,
            "total_skipped": skipped_count,
            "skip_reasons": skip_reasons,
            "by_day": [
                {"date": k, **v}
                for k, v in sorted(activity_by_day.items(), reverse=True)
            ][:14],
        },
        "plant_status": {
            "total_plants": len(all_plants),
            "needs_water_now": len(needs_water),
            "recently_watered": len(recently_watered),
            "rain_tracked": rain_tracked,
            "sprinkler_tracked": sprinkler_tracked,
            "with_schedule": total_with_schedule,
            "needs_water_list": needs_water[:20],
            "recently_watered_list": recently_watered[:10],
        },
    }


@router.get("/{plant_id}/")
async def get_plant(plant_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific plant by ID"""
    result = await db.execute(
        select(Plant).options(selectinload(Plant.tags)).where(Plant.id == plant_id)
    )
    plant = result.scalar_one_or_none()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    return plant_to_response(plant)


@router.patch("/{plant_id}/")
async def update_plant(
    plant_id: int,
    updates: PlantUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_edit("plants"))
):
    """Update a plant's information"""
    result = await db.execute(
        select(Plant).options(selectinload(Plant.tags)).where(Plant.id == plant_id)
    )
    plant = result.scalar_one_or_none()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    update_data = updates.model_dump(exclude_unset=True, exclude={'tag_ids'})
    for field, value in update_data.items():
        setattr(plant, field, value)

    # Update tags if specified
    if updates.tag_ids is not None:
        result = await db.execute(select(Tag).where(Tag.id.in_(updates.tag_ids)))
        tags = result.scalars().all()
        plant.tags = tags

    plant.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(plant)

    # Sync care reminders to calendar
    await sync_plant_reminders(db, plant)

    # Reload with tags
    result = await db.execute(
        select(Plant).options(selectinload(Plant.tags)).where(Plant.id == plant_id)
    )
    plant = result.scalar_one()
    return plant_to_response(plant)


@router.delete("/{plant_id}/")
async def delete_plant(
    plant_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_delete("plants"))
):
    """Deactivate a plant (soft delete)"""
    result = await db.execute(select(Plant).where(Plant.id == plant_id))
    plant = result.scalar_one_or_none()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    plant.is_active = False
    plant.updated_at = datetime.utcnow()
    await db.commit()

    # Delete all calendar reminders for this plant
    await delete_reminder(db, "plant_watering", plant_id)
    await delete_reminder(db, "plant_fertilizing", plant_id)
    await delete_reminder(db, "plant_harvest", plant_id)

    return {"message": "Plant deactivated"}


# Care Logs
@router.get("/{plant_id}/care-logs/", response_model=List[CareLogResponse])
async def get_care_logs(
    plant_id: int,
    care_type: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Get care logs for a plant"""
    query = select(PlantCareLog).where(PlantCareLog.plant_id == plant_id)

    if care_type:
        query = query.where(PlantCareLog.care_type == care_type)

    query = query.order_by(PlantCareLog.performed_at.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/{plant_id}/care-logs/", response_model=CareLogResponse)
async def add_care_log(
    plant_id: int,
    log: CareLogCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_interact("plants"))
):
    """Log a care activity for a plant and update last_* fields"""
    result = await db.execute(select(Plant).where(Plant.id == plant_id))
    plant = result.scalar_one_or_none()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    performed_at = log.performed_at or datetime.utcnow()

    # Update plant's last care dates
    if log.care_type == "watered":
        plant.last_watered = performed_at
    elif log.care_type == "fertilized":
        plant.last_fertilized = performed_at
    elif log.care_type == "pruned":
        plant.last_pruned = performed_at

    care_log = PlantCareLog(
        plant_id=plant_id,
        care_type=log.care_type,
        notes=log.notes,
        quantity=log.quantity,
        performed_at=performed_at,
    )
    db.add(care_log)
    await db.commit()
    await db.refresh(care_log)
    await db.refresh(plant)

    # Sync updated care reminders to calendar (recalculated next dates)
    if log.care_type in ["watered", "fertilized"]:
        await sync_plant_reminders(db, plant)

    return care_log


@router.get("/frost-sensitive/list/")
async def get_frost_sensitive_plants(db: AsyncSession = Depends(get_db)):
    """Get all frost-sensitive plants (for weather alerts)"""
    result = await db.execute(
        select(Plant)
        .options(selectinload(Plant.tags))
        .where(Plant.frost_sensitive == True)
        .where(Plant.is_active == True)
        .order_by(Plant.name)
    )
    plants = result.scalars().all()
    return [plant_to_response(p) for p in plants]


@router.get("/needs-water/today/")
async def get_plants_needing_water(db: AsyncSession = Depends(get_db)):
    """Get plants that need watering today"""
    result = await db.execute(
        select(Plant)
        .options(selectinload(Plant.tags))
        .where(Plant.is_active == True)
    )
    plants = result.scalars().all()

    now = datetime.utcnow()
    needs_water = []
    for p in plants:
        next_water = p.next_watering
        if next_water and next_water <= now:
            needs_water.append(plant_to_response(p))
        elif not p.last_watered:
            # Never watered, might need water
            needs_water.append(plant_to_response(p))

    return needs_water


@router.get("/needs-fertilizer/today/")
async def get_plants_needing_fertilizer(db: AsyncSession = Depends(get_db)):
    """Get plants that need fertilizing"""
    result = await db.execute(
        select(Plant)
        .options(selectinload(Plant.tags))
        .where(Plant.is_active == True)
    )
    plants = result.scalars().all()

    now = datetime.utcnow()
    needs_fert = []
    for p in plants:
        next_fert = p.next_fertilizing
        if next_fert and next_fert <= now:
            needs_fert.append(plant_to_response(p))

    return needs_fert


# Skip watering schemas
class SkipWateringRequest(BaseModel):
    reason: str = Field(..., description="Reason for skip: soil_moist, rain, dormant, other")
    notes: Optional[str] = None


class WateringHistoryResponse(BaseModel):
    total_events: int
    waters: int
    skips: int
    skip_rate: float
    avg_days_between: Optional[float]
    suggestion: Optional[str]
    suggested_adjustment: Optional[int]


@router.post("/{plant_id}/skip-watering/")
async def skip_watering(
    plant_id: int,
    request: SkipWateringRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_interact("plants"))
):
    """
    Skip watering for a plant.

    This updates last_watering_decision (for schedule calculation) but NOT last_watered
    (preserving actual watering history). Also logs the skip for trend analysis.
    """
    result = await db.execute(
        select(Plant).where(Plant.id == plant_id)
    )
    plant = result.scalar_one_or_none()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    now = datetime.now()

    # Calculate days since last actual watering
    days_since_water = None
    if plant.last_watered:
        days_since_water = (now - plant.last_watered).days

    # Get current scheduled interval
    scheduled_interval = plant.get_water_days_for_season()

    # Create care log entry for the skip
    care_log = PlantCareLog(
        plant_id=plant_id,
        care_type="skipped",
        skip_reason=request.reason,
        notes=request.notes,
        days_since_last_water=days_since_water,
        scheduled_interval=scheduled_interval,
        performed_at=now,
    )
    db.add(care_log)

    # Update last_watering_decision (NOT last_watered)
    plant.last_watering_decision = now

    await db.commit()

    # Sync reminders so next watering date is calculated from new decision date
    await db.refresh(plant, ["tags"])
    await sync_plant_reminders(db, plant)

    logger.info(f"Skipped watering for {plant.name}: {request.reason}")

    return {
        "message": f"Watering skipped for {plant.name}",
        "reason": request.reason,
        "next_watering": plant.next_watering,
        "days_since_last_actual_water": days_since_water,
    }


@router.post("/{plant_id}/water/")
async def water_plant(
    plant_id: int,
    notes: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_interact("plants"))
):
    """
    Mark a plant as watered.

    Updates both last_watered and last_watering_decision, and logs the watering.
    """
    result = await db.execute(
        select(Plant).where(Plant.id == plant_id)
    )
    plant = result.scalar_one_or_none()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    now = datetime.now()

    # Calculate days since last actual watering
    days_since_water = None
    if plant.last_watered:
        days_since_water = (now - plant.last_watered).days

    # Get current scheduled interval
    scheduled_interval = plant.get_water_days_for_season()

    # Create care log entry
    care_log = PlantCareLog(
        plant_id=plant_id,
        care_type="watered",
        notes=notes,
        days_since_last_water=days_since_water,
        scheduled_interval=scheduled_interval,
        performed_at=now,
    )
    db.add(care_log)

    # Update both timestamps
    plant.last_watered = now
    plant.last_watering_decision = now

    await db.commit()

    # Sync reminders
    await db.refresh(plant, ["tags"])
    await sync_plant_reminders(db, plant)

    logger.info(f"Watered {plant.name}")

    return {
        "message": f"Watered {plant.name}",
        "next_watering": plant.next_watering,
    }


@router.get("/{plant_id}/watering-history/", response_model=WateringHistoryResponse)
async def get_watering_history(
    plant_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Get watering history analysis for a plant.

    Returns water/skip counts, patterns, and suggestions for schedule adjustments.
    """
    from services.watering_calculator import analyze_watering_history

    result = await db.execute(
        select(Plant).where(Plant.id == plant_id)
    )
    plant = result.scalar_one_or_none()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    history = await analyze_watering_history(db, plant_id)
    return history
