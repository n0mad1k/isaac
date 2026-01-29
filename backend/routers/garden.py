"""
Garden Planning API Routes
Frost dates, planting schedule, planting events, succession planting,
journal, companion planting, garden beds, overview dashboard
"""

from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc
from typing import Optional, List
from datetime import datetime, date, timedelta
from pydantic import BaseModel, Field
import re
import os
import uuid
import json
import shutil
from pathlib import Path

from models.database import get_db
from models.garden import PlantingEvent, JournalEntry, GardenBed, BedPlanting
from models.plants import Plant, PlantCareLog
from models.seeds import Seed
from models.settings import AppSetting
from models.users import User
from routers.auth import require_auth
from services.planting_calculator import calculate_planting_schedule, MONTH_NAMES
from loguru import logger
from config import settings as app_config


router = APIRouter(prefix="/garden", tags=["Garden"])

# Directories
GARDEN_PHOTO_DIR = "data/garden_photos"

# Load companion planting data at module level
try:
    COMPANION_DATA = json.loads(
        (Path(__file__).parent.parent / "services" / "companion_planting.json").read_text()
    )
except Exception as e:
    logger.warning(f"Failed to load companion planting data: {e}")
    COMPANION_DATA = {}


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

# --- Succession Planting Schemas ---

class SuccessionCreate(BaseModel):
    seed_id: int
    activity_type: str = Field(..., pattern=r"^(start_indoors|direct_sow|transplant|harvest|other)$")
    first_date: str  # YYYY-MM-DD
    interval_weeks: int = Field(..., ge=1, le=12)
    num_plantings: int = Field(..., ge=1, le=12)
    notes: Optional[str] = None

# --- Journal Schemas ---

class JournalEntryCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    content: Optional[str] = None
    entry_date: str  # YYYY-MM-DD
    plant_id: Optional[int] = None
    seed_id: Optional[int] = None
    tags: Optional[str] = Field(None, max_length=500)

class JournalEntryUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    content: Optional[str] = None
    entry_date: Optional[str] = None
    plant_id: Optional[int] = None
    seed_id: Optional[int] = None
    tags: Optional[str] = Field(None, max_length=500)

# --- Garden Bed Schemas ---

class GardenBedCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    bed_type: str = Field(default="raised_bed", pattern=r"^(raised_bed|in_ground|container|row|greenhouse)$")
    width_inches: int = Field(default=48, ge=1, le=1200)
    length_inches: int = Field(default=96, ge=1, le=1200)
    x_position: float = Field(default=0)
    y_position: float = Field(default=0)
    rotation: float = Field(default=0, ge=0, le=360)
    spacing_type: str = Field(default="square_foot", pattern=r"^(row|square_foot|custom)$")
    row_spacing_inches: int = Field(default=12, ge=1, le=120)
    plant_spacing_inches: int = Field(default=12, ge=1, le=120)
    farm_area_id: Optional[int] = None
    notes: Optional[str] = None

class GardenBedUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    bed_type: Optional[str] = Field(None, pattern=r"^(raised_bed|in_ground|container|row|greenhouse)$")
    width_inches: Optional[int] = Field(None, ge=1, le=1200)
    length_inches: Optional[int] = Field(None, ge=1, le=1200)
    x_position: Optional[float] = None
    y_position: Optional[float] = None
    rotation: Optional[float] = Field(None, ge=0, le=360)
    spacing_type: Optional[str] = Field(None, pattern=r"^(row|square_foot|custom)$")
    row_spacing_inches: Optional[int] = Field(None, ge=1, le=120)
    plant_spacing_inches: Optional[int] = Field(None, ge=1, le=120)
    farm_area_id: Optional[int] = None
    notes: Optional[str] = None

class BedPlantingCreate(BaseModel):
    seed_id: Optional[int] = None
    plant_id: Optional[int] = None
    grid_row: int = Field(default=0, ge=0)
    grid_col: int = Field(default=0, ge=0)
    planted_date: Optional[str] = None  # YYYY-MM-DD
    expected_harvest_date: Optional[str] = None  # YYYY-MM-DD
    notes: Optional[str] = None

class BedPlantingUpdate(BaseModel):
    grid_row: Optional[int] = Field(None, ge=0)
    grid_col: Optional[int] = Field(None, ge=0)
    planted_date: Optional[str] = None
    expected_harvest_date: Optional[str] = None
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
# Succession Planting
# ============================================

@router.post("/events/succession/")
async def create_succession_planting(
    data: SuccessionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Create a succession planting group - multiple events spaced at regular intervals."""
    # Validate seed exists
    result = await db.execute(select(Seed).where(Seed.id == data.seed_id))
    seed = result.scalar_one_or_none()
    if not seed:
        raise HTTPException(status_code=404, detail="Seed not found")

    try:
        first_date = date.fromisoformat(data.first_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    group_id = str(uuid.uuid4())
    created_events = []

    try:
        for n in range(data.num_plantings):
            event_date = first_date + timedelta(weeks=data.interval_weeks * n)
            event = PlantingEvent(
                seed_id=data.seed_id,
                activity_type=data.activity_type,
                start_date=event_date,
                succession_group_id=group_id,
                succession_number=n + 1,
                succession_interval_weeks=data.interval_weeks,
                notes=data.notes,
            )
            db.add(event)
            created_events.append(event)

        await db.commit()

        # Refresh all events to get IDs
        for event in created_events:
            await db.refresh(event)

        return {
            "succession_group_id": group_id,
            "num_plantings": data.num_plantings,
            "interval_weeks": data.interval_weeks,
            "events": [
                {
                    "id": e.id,
                    "seed_id": e.seed_id,
                    "seed_name": seed.name,
                    "activity_type": e.activity_type,
                    "start_date": e.start_date.isoformat(),
                    "succession_number": e.succession_number,
                    "succession_group_id": e.succession_group_id,
                    "notes": e.notes,
                }
                for e in created_events
            ],
        }
    except Exception as e:
        logger.error(f"Failed to create succession planting: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.delete("/events/succession/{group_id}/")
async def delete_succession_group(
    group_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Delete all events in a succession planting group (soft delete)."""
    result = await db.execute(
        select(PlantingEvent).where(
            PlantingEvent.succession_group_id == group_id,
            PlantingEvent.is_active == True,
        )
    )
    events = result.scalars().all()

    if not events:
        raise HTTPException(status_code=404, detail="Succession group not found")

    count = 0
    for event in events:
        event.is_active = False
        count += 1

    await db.commit()
    logger.info(f"Soft-deleted {count} events in succession group {group_id}")

    return {"status": "ok", "deleted_count": count, "succession_group_id": group_id}


# ============================================
# Garden Journal CRUD
# ============================================

@router.get("/journal/")
async def list_journal_entries(
    plant_id: Optional[int] = None,
    seed_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    tags: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """List garden journal entries with optional filters."""
    query = select(JournalEntry).where(JournalEntry.is_active == True)

    if plant_id is not None:
        query = query.where(JournalEntry.plant_id == plant_id)
    if seed_id is not None:
        query = query.where(JournalEntry.seed_id == seed_id)
    if start_date:
        try:
            start = date.fromisoformat(start_date)
            query = query.where(JournalEntry.entry_date >= start)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD.")
    if end_date:
        try:
            end = date.fromisoformat(end_date)
            query = query.where(JournalEntry.entry_date <= end)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD.")
    if tags:
        # Search for any of the provided tags (comma-separated input)
        for tag in tags.split(","):
            tag = tag.strip()
            if tag:
                query = query.where(JournalEntry.tags.contains(tag))

    query = query.order_by(desc(JournalEntry.entry_date))
    result = await db.execute(query)
    entries = result.scalars().all()

    return [
        {
            "id": entry.id,
            "entry_date": entry.entry_date.isoformat() if entry.entry_date else None,
            "title": entry.title,
            "content": entry.content,
            "plant_id": entry.plant_id,
            "plant_name": entry.plant.name if entry.plant else None,
            "seed_id": entry.seed_id,
            "seed_name": entry.seed.name if entry.seed else None,
            "photo_path": entry.photo_path,
            "tags": entry.tags,
            "created_at": entry.created_at.isoformat() if entry.created_at else None,
            "updated_at": entry.updated_at.isoformat() if entry.updated_at else None,
        }
        for entry in entries
    ]


@router.post("/journal/")
async def create_journal_entry(
    data: JournalEntryCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Create a new garden journal entry."""
    try:
        entry_date = date.fromisoformat(data.entry_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    # Validate plant_id if provided
    if data.plant_id is not None:
        result = await db.execute(select(Plant).where(Plant.id == data.plant_id))
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Plant not found")

    # Validate seed_id if provided
    if data.seed_id is not None:
        result = await db.execute(select(Seed).where(Seed.id == data.seed_id))
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Seed not found")

    try:
        entry = JournalEntry(
            entry_date=entry_date,
            title=data.title,
            content=data.content,
            plant_id=data.plant_id,
            seed_id=data.seed_id,
            tags=data.tags,
        )
        db.add(entry)
        await db.commit()
        await db.refresh(entry)

        return {
            "id": entry.id,
            "entry_date": entry.entry_date.isoformat(),
            "title": entry.title,
            "content": entry.content,
            "plant_id": entry.plant_id,
            "plant_name": entry.plant.name if entry.plant else None,
            "seed_id": entry.seed_id,
            "seed_name": entry.seed.name if entry.seed else None,
            "photo_path": entry.photo_path,
            "tags": entry.tags,
            "created_at": entry.created_at.isoformat() if entry.created_at else None,
        }
    except Exception as e:
        logger.error(f"Failed to create journal entry: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.patch("/journal/{entry_id}/")
async def update_journal_entry(
    entry_id: int,
    data: JournalEntryUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Update a garden journal entry."""
    result = await db.execute(
        select(JournalEntry).where(JournalEntry.id == entry_id, JournalEntry.is_active == True)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")

    if data.title is not None:
        entry.title = data.title
    if data.content is not None:
        entry.content = data.content
    if data.entry_date is not None:
        try:
            entry.entry_date = date.fromisoformat(data.entry_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    if data.plant_id is not None:
        # Validate plant exists
        result = await db.execute(select(Plant).where(Plant.id == data.plant_id))
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Plant not found")
        entry.plant_id = data.plant_id
    if data.seed_id is not None:
        # Validate seed exists
        result = await db.execute(select(Seed).where(Seed.id == data.seed_id))
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Seed not found")
        entry.seed_id = data.seed_id
    if data.tags is not None:
        entry.tags = data.tags

    entry.updated_at = datetime.utcnow()
    await db.commit()

    return {"status": "ok", "id": entry.id}


@router.delete("/journal/{entry_id}/")
async def delete_journal_entry(
    entry_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Soft delete a garden journal entry."""
    result = await db.execute(
        select(JournalEntry).where(JournalEntry.id == entry_id, JournalEntry.is_active == True)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")

    entry.is_active = False
    await db.commit()

    return {"status": "ok"}


@router.post("/journal/{entry_id}/photo/")
async def upload_journal_photo(
    entry_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Upload a photo for a garden journal entry."""
    result = await db.execute(
        select(JournalEntry).where(JournalEntry.id == entry_id, JournalEntry.is_active == True)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")

    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: JPEG, PNG, WebP")

    # Create upload directory if not exists
    os.makedirs(GARDEN_PHOTO_DIR, exist_ok=True)

    # Generate unique filename
    ext = file.filename.split(".")[-1] if file.filename and "." in file.filename else "jpg"
    # Sanitize extension
    ext = re.sub(r'[^a-zA-Z0-9]', '', ext)[:10]
    filename = f"journal_{entry_id}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = os.path.join(GARDEN_PHOTO_DIR, filename)

    # Delete old photo if exists
    if entry.photo_path and os.path.exists(entry.photo_path):
        try:
            os.remove(entry.photo_path)
        except OSError:
            pass

    # Save new photo
    try:
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        logger.error(f"Failed to save journal photo: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")

    # Update entry record
    entry.photo_path = filepath
    entry.updated_at = datetime.utcnow()
    await db.commit()

    return {"photo_path": filepath}


@router.get("/journal/photos/{filename}")
async def get_journal_photo(filename: str):
    """Serve a garden journal photo file."""
    filepath = os.path.join(GARDEN_PHOTO_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Photo not found")

    # Security: ensure the file is within the upload directory
    abs_upload_dir = os.path.abspath(GARDEN_PHOTO_DIR)
    abs_filepath = os.path.abspath(filepath)
    if not abs_filepath.startswith(abs_upload_dir):
        raise HTTPException(status_code=403, detail="Access denied")

    return FileResponse(
        filepath,
        headers={"Content-Security-Policy": "script-src 'none'; object-src 'none'"}
    )


# ============================================
# Companion Planting
# ============================================

@router.get("/companions/")
async def get_companion_chart(
    user: User = Depends(require_auth),
):
    """Return the full companion planting chart."""
    return COMPANION_DATA


@router.get("/companions/{plant_name}")
async def get_companions_for_plant(
    plant_name: str,
    user: User = Depends(require_auth),
):
    """Return companions and antagonists for a specific plant (case-insensitive fuzzy match)."""
    plant_lower = plant_name.lower().strip()

    # Exact match first
    if plant_lower in COMPANION_DATA:
        return {
            "plant": plant_lower,
            "companions": COMPANION_DATA[plant_lower].get("companions", []),
            "antagonists": COMPANION_DATA[plant_lower].get("antagonists", []),
            "notes": COMPANION_DATA[plant_lower].get("notes", ""),
        }

    # Fuzzy match: find plants that contain the search term or vice versa
    matches = []
    for key in COMPANION_DATA:
        if plant_lower in key or key in plant_lower:
            matches.append(key)

    if len(matches) == 1:
        key = matches[0]
        return {
            "plant": key,
            "companions": COMPANION_DATA[key].get("companions", []),
            "antagonists": COMPANION_DATA[key].get("antagonists", []),
            "notes": COMPANION_DATA[key].get("notes", ""),
        }
    elif len(matches) > 1:
        return {
            "plant": plant_lower,
            "matches": matches,
            "message": "Multiple matches found. Please be more specific.",
        }

    raise HTTPException(status_code=404, detail=f"No companion data found for '{plant_name}'")


# ============================================
# Garden Beds CRUD
# ============================================

def _serialize_bed(bed: GardenBed) -> dict:
    """Serialize a garden bed with its plantings."""
    return {
        "id": bed.id,
        "name": bed.name,
        "bed_type": bed.bed_type,
        "width_inches": bed.width_inches,
        "length_inches": bed.length_inches,
        "x_position": bed.x_position,
        "y_position": bed.y_position,
        "rotation": bed.rotation,
        "spacing_type": bed.spacing_type,
        "row_spacing_inches": bed.row_spacing_inches,
        "plant_spacing_inches": bed.plant_spacing_inches,
        "farm_area_id": bed.farm_area_id,
        "notes": bed.notes,
        "created_at": bed.created_at.isoformat() if bed.created_at else None,
        "updated_at": bed.updated_at.isoformat() if bed.updated_at else None,
        "plantings": [
            {
                "id": p.id,
                "seed_id": p.seed_id,
                "seed_name": p.seed.name if p.seed else None,
                "plant_id": p.plant_id,
                "plant_name": p.plant.name if p.plant else None,
                "grid_row": p.grid_row,
                "grid_col": p.grid_col,
                "planted_date": p.planted_date.isoformat() if p.planted_date else None,
                "expected_harvest_date": p.expected_harvest_date.isoformat() if p.expected_harvest_date else None,
                "notes": p.notes,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in (bed.plantings or [])
            if p.is_active
        ],
    }


@router.get("/beds/")
async def list_garden_beds(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """List all active garden beds with their plantings."""
    result = await db.execute(
        select(GardenBed).where(GardenBed.is_active == True).order_by(GardenBed.name)
    )
    beds = result.scalars().all()

    return [_serialize_bed(bed) for bed in beds]


@router.post("/beds/")
async def create_garden_bed(
    data: GardenBedCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Create a new garden bed."""
    try:
        bed = GardenBed(
            name=data.name,
            bed_type=data.bed_type,
            width_inches=data.width_inches,
            length_inches=data.length_inches,
            x_position=data.x_position,
            y_position=data.y_position,
            rotation=data.rotation,
            spacing_type=data.spacing_type,
            row_spacing_inches=data.row_spacing_inches,
            plant_spacing_inches=data.plant_spacing_inches,
            farm_area_id=data.farm_area_id,
            notes=data.notes,
        )
        db.add(bed)
        await db.commit()
        await db.refresh(bed)

        return _serialize_bed(bed)
    except Exception as e:
        logger.error(f"Failed to create garden bed: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.patch("/beds/{bed_id}/")
async def update_garden_bed(
    bed_id: int,
    data: GardenBedUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Update a garden bed (resize, reposition, rename)."""
    result = await db.execute(
        select(GardenBed).where(GardenBed.id == bed_id, GardenBed.is_active == True)
    )
    bed = result.scalar_one_or_none()
    if not bed:
        raise HTTPException(status_code=404, detail="Garden bed not found")

    if data.name is not None:
        bed.name = data.name
    if data.bed_type is not None:
        bed.bed_type = data.bed_type
    if data.width_inches is not None:
        bed.width_inches = data.width_inches
    if data.length_inches is not None:
        bed.length_inches = data.length_inches
    if data.x_position is not None:
        bed.x_position = data.x_position
    if data.y_position is not None:
        bed.y_position = data.y_position
    if data.rotation is not None:
        bed.rotation = data.rotation
    if data.spacing_type is not None:
        bed.spacing_type = data.spacing_type
    if data.row_spacing_inches is not None:
        bed.row_spacing_inches = data.row_spacing_inches
    if data.plant_spacing_inches is not None:
        bed.plant_spacing_inches = data.plant_spacing_inches
    if data.farm_area_id is not None:
        bed.farm_area_id = data.farm_area_id
    if data.notes is not None:
        bed.notes = data.notes

    bed.updated_at = datetime.utcnow()
    await db.commit()

    return _serialize_bed(bed)


@router.delete("/beds/{bed_id}/")
async def delete_garden_bed(
    bed_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Soft delete a garden bed."""
    result = await db.execute(
        select(GardenBed).where(GardenBed.id == bed_id, GardenBed.is_active == True)
    )
    bed = result.scalar_one_or_none()
    if not bed:
        raise HTTPException(status_code=404, detail="Garden bed not found")

    bed.is_active = False
    await db.commit()

    return {"status": "ok"}


@router.post("/beds/{bed_id}/plantings/")
async def add_bed_planting(
    bed_id: int,
    data: BedPlantingCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Add a plant or seed to a garden bed at a grid position."""
    # Validate bed exists
    result = await db.execute(
        select(GardenBed).where(GardenBed.id == bed_id, GardenBed.is_active == True)
    )
    bed = result.scalar_one_or_none()
    if not bed:
        raise HTTPException(status_code=404, detail="Garden bed not found")

    # Must have either seed_id or plant_id
    if data.seed_id is None and data.plant_id is None:
        raise HTTPException(status_code=400, detail="Either seed_id or plant_id is required")

    # Validate seed_id if provided
    if data.seed_id is not None:
        result = await db.execute(select(Seed).where(Seed.id == data.seed_id))
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Seed not found")

    # Validate plant_id if provided
    if data.plant_id is not None:
        result = await db.execute(select(Plant).where(Plant.id == data.plant_id))
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Plant not found")

    # Parse dates
    planted_date = None
    expected_harvest_date = None
    if data.planted_date:
        try:
            planted_date = date.fromisoformat(data.planted_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid planted_date format. Use YYYY-MM-DD.")
    if data.expected_harvest_date:
        try:
            expected_harvest_date = date.fromisoformat(data.expected_harvest_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid expected_harvest_date format. Use YYYY-MM-DD.")

    try:
        planting = BedPlanting(
            bed_id=bed_id,
            seed_id=data.seed_id,
            plant_id=data.plant_id,
            grid_row=data.grid_row,
            grid_col=data.grid_col,
            planted_date=planted_date,
            expected_harvest_date=expected_harvest_date,
            notes=data.notes,
        )
        db.add(planting)
        await db.commit()
        await db.refresh(planting)

        return {
            "id": planting.id,
            "bed_id": planting.bed_id,
            "seed_id": planting.seed_id,
            "seed_name": planting.seed.name if planting.seed else None,
            "plant_id": planting.plant_id,
            "plant_name": planting.plant.name if planting.plant else None,
            "grid_row": planting.grid_row,
            "grid_col": planting.grid_col,
            "planted_date": planting.planted_date.isoformat() if planting.planted_date else None,
            "expected_harvest_date": planting.expected_harvest_date.isoformat() if planting.expected_harvest_date else None,
            "notes": planting.notes,
            "created_at": planting.created_at.isoformat() if planting.created_at else None,
        }
    except Exception as e:
        logger.error(f"Failed to add bed planting: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.delete("/beds/{bed_id}/plantings/{planting_id}/")
async def remove_bed_planting(
    bed_id: int,
    planting_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Remove a planting from a garden bed (soft delete)."""
    result = await db.execute(
        select(BedPlanting).where(
            BedPlanting.id == planting_id,
            BedPlanting.bed_id == bed_id,
            BedPlanting.is_active == True,
        )
    )
    planting = result.scalar_one_or_none()
    if not planting:
        raise HTTPException(status_code=404, detail="Bed planting not found")

    planting.is_active = False
    await db.commit()

    return {"status": "ok"}


@router.patch("/beds/{bed_id}/plantings/{planting_id}/")
async def update_bed_planting(
    bed_id: int,
    planting_id: int,
    data: BedPlantingUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Update a bed planting (move within bed, update dates)."""
    result = await db.execute(
        select(BedPlanting).where(
            BedPlanting.id == planting_id,
            BedPlanting.bed_id == bed_id,
            BedPlanting.is_active == True,
        )
    )
    planting = result.scalar_one_or_none()
    if not planting:
        raise HTTPException(status_code=404, detail="Bed planting not found")

    if data.grid_row is not None:
        planting.grid_row = data.grid_row
    if data.grid_col is not None:
        planting.grid_col = data.grid_col
    if data.planted_date is not None:
        try:
            planting.planted_date = date.fromisoformat(data.planted_date) if data.planted_date else None
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid planted_date format. Use YYYY-MM-DD.")
    if data.expected_harvest_date is not None:
        try:
            planting.expected_harvest_date = date.fromisoformat(data.expected_harvest_date) if data.expected_harvest_date else None
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid expected_harvest_date format. Use YYYY-MM-DD.")
    if data.notes is not None:
        planting.notes = data.notes

    await db.commit()

    return {
        "status": "ok",
        "id": planting.id,
        "grid_row": planting.grid_row,
        "grid_col": planting.grid_col,
    }


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
