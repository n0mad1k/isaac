"""
Seed Catalog API Routes
"""

from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
import os
import uuid
import shutil

from models.database import get_db
from models.seeds import Seed, SeedCategory, SunRequirement, WaterRequirement
from models.users import User
from services.permissions import require_view, require_create, require_edit, require_delete
from loguru import logger


router = APIRouter(prefix="/seeds", tags=["Seeds"])

SEED_PHOTO_DIR = "data/seed_photos"


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
    photo_path: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================
# Seed Photos
# ============================================

@router.get("/photos/{filename}")
async def get_seed_photo(filename: str, user: User = Depends(require_view("seeds"))):
    """Serve a seed photo file"""
    filepath = os.path.join(SEED_PHOTO_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Photo not found")

    # Security: ensure the file is within the upload directory
    abs_upload_dir = os.path.abspath(SEED_PHOTO_DIR)
    abs_filepath = os.path.abspath(filepath)
    if not abs_filepath.startswith(abs_upload_dir):
        raise HTTPException(status_code=403, detail="Access denied")

    return FileResponse(
        filepath,
        headers={"Content-Security-Policy": "script-src 'none'; object-src 'none'"}
    )


@router.post("/{seed_id}/photo/")
async def upload_seed_photo(
    seed_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_edit("seeds"))
):
    """Upload a photo for a seed"""
    result = await db.execute(
        select(Seed).where(Seed.id == seed_id)
    )
    seed = result.scalar_one_or_none()
    if not seed:
        raise HTTPException(status_code=404, detail="Seed not found")

    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: JPEG, PNG, GIF, WebP")

    # Create upload directory if not exists
    os.makedirs(SEED_PHOTO_DIR, exist_ok=True)

    # Generate unique filename
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"{seed_id}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = os.path.join(SEED_PHOTO_DIR, filename)

    # Delete old photo if exists
    if seed.photo_path and os.path.exists(seed.photo_path):
        try:
            os.remove(seed.photo_path)
        except OSError:
            pass

    # Save new photo
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Update seed record
    seed.photo_path = filepath
    seed.updated_at = datetime.utcnow()
    await db.commit()

    return {"photo_path": filepath}


@router.delete("/{seed_id}/photo/")
async def delete_seed_photo(
    seed_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_edit("seeds"))
):
    """Delete a seed's photo"""
    result = await db.execute(
        select(Seed).where(Seed.id == seed_id)
    )
    seed = result.scalar_one_or_none()
    if not seed:
        raise HTTPException(status_code=404, detail="Seed not found")

    if seed.photo_path and os.path.exists(seed.photo_path):
        try:
            os.remove(seed.photo_path)
        except OSError:
            pass

    seed.photo_path = None
    seed.updated_at = datetime.utcnow()
    await db.commit()

    return {"message": "Photo deleted"}


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
    user: User = Depends(require_view("seeds")),
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
async def get_categories(user: User = Depends(require_view("seeds"))):
    """Get all seed categories with counts"""
    return {
        "categories": [
            {"value": c.value, "label": c.value.replace("_", " ").title()}
            for c in SeedCategory
        ]
    }


@router.get("/stats/")
async def get_seed_stats(db: AsyncSession = Depends(get_db), user: User = Depends(require_view("seeds"))):
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
async def get_seed(seed_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(require_view("seeds"))):
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
