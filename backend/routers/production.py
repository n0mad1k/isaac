"""
Farm Production API Routes
Tracks livestock processing and plant harvests
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, extract
from typing import List, Optional
from datetime import datetime, date
from pydantic import BaseModel, Field

from models.database import get_db
from models.production import LivestockProduction, PlantHarvest, HarvestQuality
from models.livestock import Animal, AnimalExpense
from models.plants import Plant


router = APIRouter(prefix="/production", tags=["Production"])


# Pydantic Schemas
class LivestockProductionCreate(BaseModel):
    animal_id: int = Field(..., ge=1)  # The animal to archive
    slaughter_date: Optional[date] = None
    processor: Optional[str] = Field(None, max_length=200)
    pickup_date: Optional[date] = None
    live_weight: Optional[float] = Field(None, ge=0, le=10000)
    hanging_weight: Optional[float] = Field(None, ge=0, le=10000)
    final_weight: Optional[float] = Field(None, ge=0, le=10000)
    processing_cost: Optional[float] = Field(None, ge=0, le=100000)
    notes: Optional[str] = Field(None, max_length=5000)


class LivestockProductionUpdate(BaseModel):
    slaughter_date: Optional[date] = None
    processor: Optional[str] = Field(None, max_length=200)
    pickup_date: Optional[date] = None
    live_weight: Optional[float] = Field(None, ge=0, le=10000)
    hanging_weight: Optional[float] = Field(None, ge=0, le=10000)
    final_weight: Optional[float] = Field(None, ge=0, le=10000)
    processing_cost: Optional[float] = Field(None, ge=0, le=100000)
    notes: Optional[str] = Field(None, max_length=5000)


class LivestockProductionResponse(BaseModel):
    id: int
    animal_id: Optional[int]
    animal_name: str
    animal_type: str
    breed: Optional[str]
    sex: Optional[str]
    birth_date: Optional[date]
    slaughter_date: Optional[date]
    processor: Optional[str]
    pickup_date: Optional[date]
    live_weight: Optional[float]
    hanging_weight: Optional[float]
    final_weight: Optional[float]
    total_expenses: Optional[float]
    processing_cost: Optional[float]
    cost_per_pound: Optional[float]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class PlantHarvestCreate(BaseModel):
    plant_id: int = Field(..., ge=1)
    harvest_date: Optional[date] = None
    quantity: float = Field(..., ge=0, le=100000)
    unit: str = Field("lbs", min_length=1, max_length=20)
    quality: HarvestQuality = HarvestQuality.GOOD
    notes: Optional[str] = Field(None, max_length=2000)


class PlantHarvestUpdate(BaseModel):
    harvest_date: Optional[date] = None
    quantity: Optional[float] = Field(None, ge=0, le=100000)
    unit: Optional[str] = Field(None, min_length=1, max_length=20)
    quality: Optional[HarvestQuality] = None
    notes: Optional[str] = Field(None, max_length=2000)


class PlantHarvestResponse(BaseModel):
    id: int
    plant_id: Optional[int]
    plant_name: str
    plant_variety: Optional[str]
    harvest_date: Optional[date]
    quantity: float
    unit: str
    quality: HarvestQuality
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# Routes

@router.get("/stats/")
async def get_production_stats(
    year: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    """Get production statistics"""
    # Livestock stats
    livestock_query = select(LivestockProduction)
    if year:
        livestock_query = livestock_query.where(
            extract('year', LivestockProduction.slaughter_date) == year
        )
    livestock_result = await db.execute(livestock_query)
    livestock = livestock_result.scalars().all()

    # Harvest stats
    harvest_query = select(PlantHarvest)
    if year:
        harvest_query = harvest_query.where(
            extract('year', PlantHarvest.harvest_date) == year
        )
    harvest_result = await db.execute(harvest_query)
    harvests = harvest_result.scalars().all()

    # Calculate stats
    total_meat = sum(p.final_weight or 0 for p in livestock)
    total_expenses = sum(p.total_expenses or 0 for p in livestock)
    total_processing = sum(p.processing_cost or 0 for p in livestock)

    # Group harvests by unit
    harvest_by_unit = {}
    for h in harvests:
        unit = h.unit or "unknown"
        harvest_by_unit[unit] = harvest_by_unit.get(unit, 0) + (h.quantity or 0)

    # Livestock by type
    livestock_by_type = {}
    for p in livestock:
        animal_type = p.animal_type
        if animal_type not in livestock_by_type:
            livestock_by_type[animal_type] = {"count": 0, "weight": 0}
        livestock_by_type[animal_type]["count"] += 1
        livestock_by_type[animal_type]["weight"] += p.final_weight or 0

    return {
        "livestock": {
            "total_processed": len(livestock),
            "total_meat_lbs": total_meat,
            "total_expenses": total_expenses,
            "total_processing_cost": total_processing,
            "avg_cost_per_pound": (total_expenses + total_processing) / total_meat if total_meat > 0 else None,
            "by_type": livestock_by_type,
        },
        "harvests": {
            "total_harvests": len(harvests),
            "by_unit": harvest_by_unit,
        },
        "year": year,
    }


@router.get("/livestock/", response_model=List[LivestockProductionResponse])
async def list_livestock_production(
    year: Optional[int] = None,
    animal_type: Optional[str] = None,
    limit: int = Query(default=100, le=500),
    db: AsyncSession = Depends(get_db),
):
    """List all livestock production records"""
    query = select(LivestockProduction)

    if year:
        query = query.where(
            extract('year', LivestockProduction.slaughter_date) == year
        )
    if animal_type:
        query = query.where(LivestockProduction.animal_type == animal_type)

    query = query.order_by(LivestockProduction.slaughter_date.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/livestock/", response_model=LivestockProductionResponse)
async def archive_livestock(
    data: LivestockProductionCreate,
    db: AsyncSession = Depends(get_db),
):
    """Archive a livestock animal and create production record"""
    # Get the animal
    result = await db.execute(select(Animal).where(Animal.id == data.animal_id))
    animal = result.scalar_one_or_none()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")

    # Calculate total expenses
    expenses_result = await db.execute(
        select(AnimalExpense).where(AnimalExpense.animal_id == animal.id)
    )
    expenses = expenses_result.scalars().all()
    total_expenses = sum(e.amount for e in expenses if e.amount)

    # Calculate cost per pound
    final_weight = data.final_weight
    total_cost = total_expenses + (data.processing_cost or 0)
    cost_per_pound = total_cost / final_weight if final_weight and final_weight > 0 else None

    # Create production record
    production = LivestockProduction(
        animal_id=animal.id,
        animal_name=animal.name,
        animal_type=animal.animal_type.value if hasattr(animal.animal_type, 'value') else str(animal.animal_type),
        breed=animal.breed,
        sex=animal.sex,
        birth_date=animal.birth_date,
        slaughter_date=data.slaughter_date or animal.slaughter_date,
        processor=data.processor or animal.processor,
        pickup_date=data.pickup_date or animal.pickup_date,
        live_weight=data.live_weight or animal.current_weight,
        hanging_weight=data.hanging_weight,
        final_weight=data.final_weight,
        total_expenses=total_expenses,
        processing_cost=data.processing_cost,
        cost_per_pound=cost_per_pound,
        notes=data.notes,
    )

    db.add(production)

    # Mark animal as inactive (archived) and update status
    animal.is_active = False
    animal.status = "slaughtered"

    await db.commit()
    await db.refresh(production)
    return production


@router.get("/livestock/{production_id}/", response_model=LivestockProductionResponse)
async def get_livestock_production(
    production_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get a specific livestock production record"""
    result = await db.execute(
        select(LivestockProduction).where(LivestockProduction.id == production_id)
    )
    production = result.scalar_one_or_none()
    if not production:
        raise HTTPException(status_code=404, detail="Production record not found")
    return production


@router.patch("/livestock/{production_id}/", response_model=LivestockProductionResponse)
async def update_livestock_production(
    production_id: int,
    updates: LivestockProductionUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a livestock production record"""
    result = await db.execute(
        select(LivestockProduction).where(LivestockProduction.id == production_id)
    )
    production = result.scalar_one_or_none()
    if not production:
        raise HTTPException(status_code=404, detail="Production record not found")

    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(production, field, value)

    # Recalculate cost per pound if weights/costs changed
    if production.final_weight and production.final_weight > 0:
        total_cost = (production.total_expenses or 0) + (production.processing_cost or 0)
        production.cost_per_pound = total_cost / production.final_weight

    await db.commit()
    await db.refresh(production)
    return production


@router.delete("/livestock/{production_id}/")
async def delete_livestock_production(
    production_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a livestock production record"""
    result = await db.execute(
        select(LivestockProduction).where(LivestockProduction.id == production_id)
    )
    production = result.scalar_one_or_none()
    if not production:
        raise HTTPException(status_code=404, detail="Production record not found")

    await db.delete(production)
    await db.commit()
    return {"message": "Production record deleted"}


# Plant Harvest Routes

@router.get("/harvests/", response_model=List[PlantHarvestResponse])
async def list_plant_harvests(
    year: Optional[int] = None,
    plant_id: Optional[int] = None,
    limit: int = Query(default=100, le=500),
    db: AsyncSession = Depends(get_db),
):
    """List all plant harvest records"""
    query = select(PlantHarvest)

    if year:
        query = query.where(
            extract('year', PlantHarvest.harvest_date) == year
        )
    if plant_id:
        query = query.where(PlantHarvest.plant_id == plant_id)

    query = query.order_by(PlantHarvest.harvest_date.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/harvests/", response_model=PlantHarvestResponse)
async def record_plant_harvest(
    data: PlantHarvestCreate,
    db: AsyncSession = Depends(get_db),
):
    """Record a plant harvest"""
    # Get the plant
    result = await db.execute(select(Plant).where(Plant.id == data.plant_id))
    plant = result.scalar_one_or_none()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    # Create harvest record
    harvest = PlantHarvest(
        plant_id=plant.id,
        plant_name=plant.name,
        plant_variety=plant.variety,
        harvest_date=data.harvest_date or date.today(),
        quantity=data.quantity,
        unit=data.unit,
        quality=data.quality,
        notes=data.notes,
    )

    db.add(harvest)
    await db.commit()
    await db.refresh(harvest)
    return harvest


@router.get("/harvests/{harvest_id}/", response_model=PlantHarvestResponse)
async def get_plant_harvest(
    harvest_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get a specific plant harvest record"""
    result = await db.execute(
        select(PlantHarvest).where(PlantHarvest.id == harvest_id)
    )
    harvest = result.scalar_one_or_none()
    if not harvest:
        raise HTTPException(status_code=404, detail="Harvest record not found")
    return harvest


@router.patch("/harvests/{harvest_id}/", response_model=PlantHarvestResponse)
async def update_plant_harvest(
    harvest_id: int,
    updates: PlantHarvestUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a plant harvest record"""
    result = await db.execute(
        select(PlantHarvest).where(PlantHarvest.id == harvest_id)
    )
    harvest = result.scalar_one_or_none()
    if not harvest:
        raise HTTPException(status_code=404, detail="Harvest record not found")

    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(harvest, field, value)

    await db.commit()
    await db.refresh(harvest)
    return harvest


@router.delete("/harvests/{harvest_id}/")
async def delete_plant_harvest(
    harvest_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a plant harvest record"""
    result = await db.execute(
        select(PlantHarvest).where(PlantHarvest.id == harvest_id)
    )
    harvest = result.scalar_one_or_none()
    if not harvest:
        raise HTTPException(status_code=404, detail="Harvest record not found")

    await db.delete(harvest)
    await db.commit()
    return {"message": "Harvest record deleted"}
