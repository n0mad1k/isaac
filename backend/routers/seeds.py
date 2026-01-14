"""
Seed Catalog API Routes
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field

from models.database import get_db
from models.seeds import Seed, SeedCategory, SunRequirement, WaterRequirement
from models.users import User
from services.permissions import require_view, require_create, require_edit, require_delete


router = APIRouter(prefix="/seeds", tags=["Seeds"])


# Pydantic Schemas
class SeedCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    latin_name: Optional[str] = Field(None, max_length=150)
    variety: Optional[str] = Field(None, max_length=100)
    category: SeedCategory = SeedCategory.OTHER
    quantity: Optional[str] = Field(None, max_length=50)
    source: Optional[str] = Field(None, max_length=200)
    days_to_germination: Optional[str] = Field(None, max_length=50)
    days_to_maturity: Optional[str] = Field(None, max_length=50)
    planting_depth: Optional[str] = Field(None, max_length=50)
    spacing: Optional[str] = Field(None, max_length=50)
    row_spacing: Optional[str] = Field(None, max_length=50)
    optimal_germ_temp: Optional[str] = Field(None, max_length=50)
    sun_requirement: SunRequirement = SunRequirement.FULL_SUN
    light_to_germinate: Optional[str] = Field(None, max_length=100)
    water_requirement: WaterRequirement = WaterRequirement.MODERATE
    soil_type: Optional[str] = Field(None, max_length=200)
    ph_range: Optional[str] = Field(None, max_length=50)
    grow_zones: Optional[str] = Field(None, max_length=50)
    spring_planting: Optional[str] = Field(None, max_length=100)
    fall_planting: Optional[str] = Field(None, max_length=100)
    sow_months: Optional[str] = Field(None, max_length=50)
    harvest_months: Optional[str] = Field(None, max_length=50)
    indoor_start: Optional[str] = Field(None, max_length=100)
    direct_sow: bool = True
    frost_sensitive: bool = True
    heat_tolerant: bool = True
    drought_tolerant: bool = False
    height: Optional[str] = Field(None, max_length=50)
    spread: Optional[str] = Field(None, max_length=50)
    is_perennial: bool = False
    is_native: bool = False
    attracts_pollinators: bool = False
    culinary_use: bool = False
    medicinal_use: bool = False
    ornamental_use: bool = False
    special_requirements: Optional[str] = Field(None, max_length=1000)
    description: Optional[str] = Field(None, max_length=5000)
    growing_notes: Optional[str] = Field(None, max_length=2000)
    harvest_notes: Optional[str] = Field(None, max_length=2000)
    medicinal_notes: Optional[str] = Field(None, max_length=2000)
    notes: Optional[str] = Field(None, max_length=5000)


class SeedUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    latin_name: Optional[str] = Field(None, max_length=150)
    variety: Optional[str] = Field(None, max_length=100)
    category: Optional[SeedCategory] = None
    quantity: Optional[str] = Field(None, max_length=50)
    source: Optional[str] = Field(None, max_length=200)
    days_to_germination: Optional[str] = Field(None, max_length=50)
    days_to_maturity: Optional[str] = Field(None, max_length=50)
    planting_depth: Optional[str] = Field(None, max_length=50)
    spacing: Optional[str] = Field(None, max_length=50)
    row_spacing: Optional[str] = Field(None, max_length=50)
    optimal_germ_temp: Optional[str] = Field(None, max_length=50)
    sun_requirement: Optional[SunRequirement] = None
    light_to_germinate: Optional[str] = Field(None, max_length=100)
    water_requirement: Optional[WaterRequirement] = None
    soil_type: Optional[str] = Field(None, max_length=200)
    ph_range: Optional[str] = Field(None, max_length=50)
    grow_zones: Optional[str] = Field(None, max_length=50)
    spring_planting: Optional[str] = Field(None, max_length=100)
    fall_planting: Optional[str] = Field(None, max_length=100)
    sow_months: Optional[str] = Field(None, max_length=50)
    harvest_months: Optional[str] = Field(None, max_length=50)
    indoor_start: Optional[str] = Field(None, max_length=100)
    direct_sow: Optional[bool] = None
    frost_sensitive: Optional[bool] = None
    heat_tolerant: Optional[bool] = None
    drought_tolerant: Optional[bool] = None
    height: Optional[str] = Field(None, max_length=50)
    spread: Optional[str] = Field(None, max_length=50)
    is_perennial: Optional[bool] = None
    is_native: Optional[bool] = None
    attracts_pollinators: Optional[bool] = None
    culinary_use: Optional[bool] = None
    medicinal_use: Optional[bool] = None
    ornamental_use: Optional[bool] = None
    special_requirements: Optional[str] = Field(None, max_length=1000)
    description: Optional[str] = Field(None, max_length=5000)
    growing_notes: Optional[str] = Field(None, max_length=2000)
    harvest_notes: Optional[str] = Field(None, max_length=2000)
    medicinal_notes: Optional[str] = Field(None, max_length=2000)
    notes: Optional[str] = Field(None, max_length=5000)


class SeedResponse(BaseModel):
    id: int
    name: str
    latin_name: Optional[str]
    variety: Optional[str]
    category: SeedCategory
    quantity: Optional[str]
    source: Optional[str]
    days_to_germination: Optional[str]
    days_to_maturity: Optional[str]
    planting_depth: Optional[str]
    spacing: Optional[str]
    row_spacing: Optional[str]
    optimal_germ_temp: Optional[str]
    sun_requirement: SunRequirement
    light_to_germinate: Optional[str]
    water_requirement: WaterRequirement
    soil_type: Optional[str]
    ph_range: Optional[str]
    grow_zones: Optional[str]
    spring_planting: Optional[str]
    fall_planting: Optional[str]
    sow_months: Optional[str]
    harvest_months: Optional[str]
    indoor_start: Optional[str]
    direct_sow: bool
    frost_sensitive: bool
    heat_tolerant: bool
    drought_tolerant: bool
    height: Optional[str]
    spread: Optional[str]
    is_perennial: bool
    is_native: bool
    attracts_pollinators: bool
    culinary_use: bool
    medicinal_use: bool
    ornamental_use: bool
    special_requirements: Optional[str]
    description: Optional[str]
    growing_notes: Optional[str]
    harvest_notes: Optional[str]
    medicinal_notes: Optional[str]
    notes: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# Routes
@router.get("/", response_model=List[SeedResponse])
async def list_seeds(
    category: Optional[SeedCategory] = None,
    search: Optional[str] = None,
    medicinal: Optional[bool] = None,
    native: Optional[bool] = None,
    perennial: Optional[bool] = None,
    limit: int = Query(default=100, le=500),
    db: AsyncSession = Depends(get_db),
):
    """List all seeds with optional filtering"""
    query = select(Seed).where(Seed.is_active == True)

    if category:
        query = query.where(Seed.category == category)
    if search:
        # Escape any SQL-like wildcards and create search pattern
        # SQLAlchemy's ilike() properly parameterizes, but we explicitly
        # escape any user-provided wildcards for clarity
        safe_search = search.replace("%", r"\%").replace("_", r"\_")
        search_pattern = f"%{safe_search}%"
        query = query.where(
            or_(
                Seed.name.ilike(search_pattern),
                Seed.variety.ilike(search_pattern),
                Seed.notes.ilike(search_pattern),
            )
        )
    if medicinal is not None:
        query = query.where(Seed.medicinal_use == medicinal)
    if native is not None:
        query = query.where(Seed.is_native == native)
    if perennial is not None:
        query = query.where(Seed.is_perennial == perennial)

    query = query.order_by(Seed.category, Seed.name).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=SeedResponse)
async def create_seed(
    seed: SeedCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_create("seeds"))
):
    """Add a new seed to the catalog"""
    # Check if seed already exists
    result = await db.execute(select(Seed).where(Seed.name == seed.name))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Seed with this name already exists")

    db_seed = Seed(**seed.model_dump())
    db.add(db_seed)
    await db.commit()
    await db.refresh(db_seed)
    return db_seed


@router.get("/categories/")
async def get_categories():
    """Get all seed categories with counts"""
    return {
        "categories": [
            {"value": c.value, "label": c.value.replace("_", " ").title()}
            for c in SeedCategory
        ]
    }


@router.get("/stats/")
async def get_seed_stats(db: AsyncSession = Depends(get_db)):
    """Get seed catalog statistics"""
    result = await db.execute(select(Seed).where(Seed.is_active == True))
    seeds = result.scalars().all()

    categories = {}
    medicinal_count = 0
    native_count = 0
    perennial_count = 0

    for seed in seeds:
        cat = seed.category.value
        categories[cat] = categories.get(cat, 0) + 1
        if seed.medicinal_use:
            medicinal_count += 1
        if seed.is_native:
            native_count += 1
        if seed.is_perennial:
            perennial_count += 1

    return {
        "total": len(seeds),
        "by_category": categories,
        "medicinal": medicinal_count,
        "native": native_count,
        "perennial": perennial_count,
    }


@router.get("/{seed_id}/", response_model=SeedResponse)
async def get_seed(seed_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific seed by ID"""
    result = await db.execute(select(Seed).where(Seed.id == seed_id))
    seed = result.scalar_one_or_none()
    if not seed:
        raise HTTPException(status_code=404, detail="Seed not found")
    return seed


@router.patch("/{seed_id}/", response_model=SeedResponse)
async def update_seed(
    seed_id: int,
    updates: SeedUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_edit("seeds"))
):
    """Update a seed's information"""
    result = await db.execute(select(Seed).where(Seed.id == seed_id))
    seed = result.scalar_one_or_none()
    if not seed:
        raise HTTPException(status_code=404, detail="Seed not found")

    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(seed, field, value)

    seed.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(seed)
    return seed


@router.delete("/{seed_id}/")
async def delete_seed(
    seed_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_delete("seeds"))
):
    """Remove a seed from the catalog (soft delete)"""
    result = await db.execute(select(Seed).where(Seed.id == seed_id))
    seed = result.scalar_one_or_none()
    if not seed:
        raise HTTPException(status_code=404, detail="Seed not found")

    seed.is_active = False
    seed.updated_at = datetime.utcnow()
    await db.commit()
    return {"message": "Seed removed from catalog"}
