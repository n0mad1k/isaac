"""
Plant and Tree API Routes
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, date, timedelta
from pydantic import BaseModel

from models.database import get_db
from models.plants import Plant, PlantCareLog, Tag, GrowthRate, SunRequirement
from services.auto_reminders import (
    sync_plant_watering_reminder,
    sync_plant_fertilizing_reminder,
    sync_plant_harvest_reminder,
    delete_reminder,
)


router = APIRouter(prefix="/plants", tags=["Plants"])


# Pydantic Schemas
class TagResponse(BaseModel):
    id: int
    name: str
    color: str

    class Config:
        from_attributes = True


class PlantCreate(BaseModel):
    name: str
    latin_name: Optional[str] = None
    variety: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    date_planted: Optional[datetime] = None
    source: Optional[str] = None

    # Growing requirements
    grow_zones: Optional[str] = None
    sun_requirement: SunRequirement = SunRequirement.FULL_SUN
    soil_requirements: Optional[str] = None
    plant_spacing: Optional[str] = None

    # Size & Growth
    size_full_grown: Optional[str] = None
    growth_rate: GrowthRate = GrowthRate.MODERATE

    # Cold tolerance
    min_temp: Optional[float] = None
    frost_sensitive: bool = False
    needs_cover_below_temp: Optional[float] = None

    # Heat/drought tolerance
    heat_tolerant: bool = True
    drought_tolerant: bool = False
    salt_tolerant: bool = False
    needs_shade_above_temp: Optional[float] = None

    # Watering & Fertilizing
    water_schedule: Optional[str] = None  # "summer:3,winter:10,spring:5,fall:7"
    fertilize_schedule: Optional[str] = None

    # Pruning
    prune_frequency: Optional[str] = None
    prune_months: Optional[str] = None

    # Production
    produces_months: Optional[str] = None
    harvest_frequency: Optional[str] = None
    how_to_harvest: Optional[str] = None

    # Uses & Propagation
    uses: Optional[str] = None
    propagation_methods: Optional[str] = None

    # Warnings
    known_hazards: Optional[str] = None
    special_considerations: Optional[str] = None

    notes: Optional[str] = None
    tag_ids: Optional[List[int]] = None


class PlantUpdate(BaseModel):
    name: Optional[str] = None
    latin_name: Optional[str] = None
    variety: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    date_planted: Optional[datetime] = None

    grow_zones: Optional[str] = None
    sun_requirement: Optional[SunRequirement] = None
    soil_requirements: Optional[str] = None
    plant_spacing: Optional[str] = None
    size_full_grown: Optional[str] = None
    growth_rate: Optional[GrowthRate] = None

    min_temp: Optional[float] = None
    frost_sensitive: Optional[bool] = None
    needs_cover_below_temp: Optional[float] = None
    heat_tolerant: Optional[bool] = None
    drought_tolerant: Optional[bool] = None

    water_schedule: Optional[str] = None
    fertilize_schedule: Optional[str] = None
    last_watered: Optional[datetime] = None
    last_fertilized: Optional[datetime] = None
    last_pruned: Optional[datetime] = None

    prune_frequency: Optional[str] = None
    prune_months: Optional[str] = None
    produces_months: Optional[str] = None
    harvest_frequency: Optional[str] = None
    how_to_harvest: Optional[str] = None

    uses: Optional[str] = None
    propagation_methods: Optional[str] = None
    known_hazards: Optional[str] = None
    special_considerations: Optional[str] = None
    notes: Optional[str] = None
    tag_ids: Optional[List[int]] = None


class PlantResponse(BaseModel):
    id: int
    name: str
    latin_name: Optional[str]
    variety: Optional[str]
    description: Optional[str]
    location: Optional[str]
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
    last_watered: Optional[datetime]
    fertilize_schedule: Optional[str]
    last_fertilized: Optional[datetime]

    prune_frequency: Optional[str]
    prune_months: Optional[str]
    last_pruned: Optional[datetime]

    produces_months: Optional[str]
    harvest_frequency: Optional[str]
    how_to_harvest: Optional[str]

    uses: Optional[str]
    propagation_methods: Optional[str]
    known_hazards: Optional[str]
    special_considerations: Optional[str]

    is_active: bool
    notes: Optional[str]
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
    """Sync all care reminders for a plant to calendar"""
    # Sync watering
    if plant.next_watering:
        next_water_date = plant.next_watering.date() if isinstance(plant.next_watering, datetime) else plant.next_watering
        await sync_plant_watering_reminder(
            db=db,
            plant_id=plant.id,
            plant_name=plant.name,
            next_watering=next_water_date,
            location=plant.location,
        )
    else:
        await delete_reminder(db, "plant_watering", plant.id)

    # Sync fertilizing
    if plant.next_fertilizing:
        next_fert_date = plant.next_fertilizing.date() if isinstance(plant.next_fertilizing, datetime) else plant.next_fertilizing
        await sync_plant_fertilizing_reminder(
            db=db,
            plant_id=plant.id,
            plant_name=plant.name,
            next_fertilizing=next_fert_date,
            location=plant.location,
        )
    else:
        await delete_reminder(db, "plant_fertilizing", plant.id)


def plant_to_response(plant: Plant) -> dict:
    """Convert Plant model to response with computed fields"""
    data = {
        "id": plant.id,
        "name": plant.name,
        "latin_name": plant.latin_name,
        "variety": plant.variety,
        "description": plant.description,
        "location": plant.location,
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
        "last_watered": plant.last_watered,
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
        "known_hazards": plant.known_hazards,
        "special_considerations": plant.special_considerations,
        "is_active": plant.is_active,
        "notes": plant.notes,
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
    db: AsyncSession = Depends(get_db),
):
    """List all plants with optional filtering"""
    query = select(Plant).options(selectinload(Plant.tags))

    if active_only:
        query = query.where(Plant.is_active == True)
    if frost_sensitive is not None:
        query = query.where(Plant.frost_sensitive == frost_sensitive)

    query = query.order_by(Plant.name)
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
async def create_plant(plant: PlantCreate, db: AsyncSession = Depends(get_db)):
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
async def create_tag(name: str, color: str = "gray", db: AsyncSession = Depends(get_db)):
    """Create a new tag"""
    tag = Tag(name=name, color=color)
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return tag


@router.get("/{plant_id}")
async def get_plant(plant_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific plant by ID"""
    result = await db.execute(
        select(Plant).options(selectinload(Plant.tags)).where(Plant.id == plant_id)
    )
    plant = result.scalar_one_or_none()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    return plant_to_response(plant)


@router.patch("/{plant_id}")
async def update_plant(
    plant_id: int,
    updates: PlantUpdate,
    db: AsyncSession = Depends(get_db),
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


@router.delete("/{plant_id}")
async def delete_plant(plant_id: int, db: AsyncSession = Depends(get_db)):
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
