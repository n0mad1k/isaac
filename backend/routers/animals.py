"""
Livestock and Animal API Routes
Supports Pets and Livestock categories with expense tracking and recurring care schedules
"""

from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, date, timedelta
from pydantic import BaseModel, Field
import uuid
import csv
import io
import os
import shutil
import logging

from models.database import get_db
from models.livestock import Animal, AnimalType, AnimalCategory, AnimalCareLog, AnimalExpense, AnimalCareSchedule, AnimalFeed
from models.settings import AppSetting
from models.users import User
from services.permissions import require_create, require_edit, require_delete, require_interact
from services.auto_reminders import (
    sync_all_animal_reminders,
    delete_reminder,
)

logger = logging.getLogger(__name__)

RECEIPT_DIR = "data/expense_receipts"

router = APIRouter(prefix="/animals", tags=["Animals"])


# Pydantic Schemas
class AnimalCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    animal_type: AnimalType
    category: AnimalCategory
    breed: Optional[str] = Field(None, max_length=100)
    color: Optional[str] = Field(None, max_length=50)
    tag_number: Optional[str] = Field(None, max_length=50)
    microchip: Optional[str] = Field(None, max_length=50)
    sex: Optional[str] = Field(None, max_length=20)
    birth_date: Optional[date] = None
    acquisition_date: Optional[date] = None
    current_weight: Optional[float] = Field(None, ge=0, le=10000)
    feed_amount: Optional[str] = Field(None, max_length=100)
    feed_frequency: Optional[str] = Field(None, max_length=100)
    feed_type: Optional[str] = Field(None, max_length=200)
    pasture: Optional[str] = Field(None, max_length=100)
    sub_location: Optional[str] = Field(None, max_length=200)
    # Livestock specific
    target_weight: Optional[float] = Field(None, ge=0, le=10000)
    slaughter_date: Optional[date] = None
    slaughter_start_time: Optional[str] = Field(None, max_length=10)
    slaughter_end_time: Optional[str] = Field(None, max_length=10)
    slaughter_notes: Optional[str] = Field(None, max_length=2000)
    processor: Optional[str] = Field(None, max_length=200)
    processor_address: Optional[str] = Field(None, max_length=500)
    pickup_date: Optional[date] = None
    pickup_start_time: Optional[str] = Field(None, max_length=10)
    pickup_end_time: Optional[str] = Field(None, max_length=10)
    pickup_notes: Optional[str] = Field(None, max_length=2000)
    # Pet care schedules (frequency in days)
    worming_frequency_days: Optional[int] = Field(None, ge=1, le=730)
    vaccination_frequency_days: Optional[int] = Field(None, ge=1, le=730)
    hoof_trim_frequency_days: Optional[int] = Field(None, ge=1, le=365)
    dental_frequency_days: Optional[int] = Field(None, ge=1, le=730)
    wormer_rotation: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = Field(None, max_length=5000)
    special_instructions: Optional[str] = Field(None, max_length=2000)
    # Cold tolerance
    cold_sensitive: Optional[bool] = None
    min_temp: Optional[float] = Field(None, ge=-50, le=120)
    needs_blanket_below: Optional[float] = Field(None, ge=-50, le=120)
    # Tags
    tags: Optional[str] = Field(None, max_length=500)
    # Farm area
    farm_area_id: Optional[int] = Field(None, ge=1)


class AnimalUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    animal_type: Optional[AnimalType] = None
    category: Optional[AnimalCategory] = None
    breed: Optional[str] = Field(None, max_length=100)
    color: Optional[str] = Field(None, max_length=50)
    tag_number: Optional[str] = Field(None, max_length=50)
    microchip: Optional[str] = Field(None, max_length=50)
    sex: Optional[str] = Field(None, max_length=20)
    birth_date: Optional[date] = None
    acquisition_date: Optional[date] = None
    current_weight: Optional[float] = Field(None, ge=0, le=10000)
    feed_amount: Optional[str] = Field(None, max_length=100)
    feed_frequency: Optional[str] = Field(None, max_length=100)
    feed_type: Optional[str] = Field(None, max_length=200)
    pasture: Optional[str] = Field(None, max_length=100)
    sub_location: Optional[str] = Field(None, max_length=200)
    status: Optional[str] = Field(None, max_length=50)
    # Livestock
    target_weight: Optional[float] = Field(None, ge=0, le=10000)
    slaughter_date: Optional[date] = None
    slaughter_start_time: Optional[str] = Field(None, max_length=10)
    slaughter_end_time: Optional[str] = Field(None, max_length=10)
    slaughter_notes: Optional[str] = Field(None, max_length=2000)
    processor: Optional[str] = Field(None, max_length=200)
    processor_address: Optional[str] = Field(None, max_length=500)
    pickup_date: Optional[date] = None
    pickup_start_time: Optional[str] = Field(None, max_length=10)
    pickup_end_time: Optional[str] = Field(None, max_length=10)
    pickup_notes: Optional[str] = Field(None, max_length=2000)
    # Pet care schedules
    worming_frequency_days: Optional[int] = Field(None, ge=1, le=730)
    vaccination_frequency_days: Optional[int] = Field(None, ge=1, le=730)
    hoof_trim_frequency_days: Optional[int] = Field(None, ge=1, le=365)
    dental_frequency_days: Optional[int] = Field(None, ge=1, le=730)
    wormer_rotation: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = Field(None, max_length=5000)
    special_instructions: Optional[str] = Field(None, max_length=2000)
    # Cold tolerance
    cold_sensitive: Optional[bool] = None
    min_temp: Optional[float] = Field(None, ge=-50, le=120)
    needs_blanket_below: Optional[float] = Field(None, ge=-50, le=120)
    # Tags
    tags: Optional[str] = Field(None, max_length=500)
    # Farm area
    farm_area_id: Optional[int] = Field(None, ge=1)


class ExpenseCreate(BaseModel):
    expense_type: str = Field(..., min_length=1, max_length=50)  # purchase, feed, medicine, vet, equipment, farrier, other
    description: Optional[str] = Field(None, max_length=500)
    amount: float = Field(..., ge=0, le=1000000)
    expense_date: Optional[date] = None
    vendor: Optional[str] = Field(None, max_length=200)
    notes: Optional[str] = Field(None, max_length=2000)


class ExpenseResponse(BaseModel):
    id: int
    animal_id: int
    expense_type: str
    description: Optional[str]
    amount: float
    expense_date: date
    vendor: Optional[str]
    notes: Optional[str]
    receipt_path: Optional[str] = None
    created_at: datetime
    expense_group_id: Optional[str] = None
    total_amount: Optional[float] = None

    class Config:
        from_attributes = True


class AnimalSplit(BaseModel):
    """Individual animal allocation in a split expense"""
    animal_id: int
    amount: float = Field(..., ge=0)


class SplitExpenseCreate(BaseModel):
    """Create an expense split across multiple animals"""
    expense_type: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = Field(None, max_length=500)
    total_amount: float = Field(..., ge=0, le=1000000)
    expense_date: Optional[date] = None
    vendor: Optional[str] = Field(None, max_length=200)
    notes: Optional[str] = Field(None, max_length=2000)
    splits: List[AnimalSplit] = Field(..., min_length=1)


class CareLogCreate(BaseModel):
    care_type: str = Field(..., min_length=1, max_length=50)  # wormed, vaccinated, hoof_trim, dental, vet_visit, weighed, medicated, groomed
    details: Optional[str] = Field(None, max_length=1000)
    product_used: Optional[str] = Field(None, max_length=200)
    dosage: Optional[str] = Field(None, max_length=100)
    performed_by: Optional[str] = Field(None, max_length=100)
    weight: Optional[float] = Field(None, ge=0, le=10000)
    notes: Optional[str] = Field(None, max_length=2000)
    performed_at: Optional[datetime] = None


class CareLogResponse(BaseModel):
    id: int
    animal_id: int
    care_type: str
    details: Optional[str]
    product_used: Optional[str]
    dosage: Optional[str]
    performed_by: Optional[str]
    weight: Optional[float]
    performed_at: datetime

    class Config:
        from_attributes = True


# Care Schedule schemas
class CareScheduleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    frequency_days: Optional[int] = Field(None, ge=1, le=730)
    last_performed: Optional[date] = None
    manual_due_date: Optional[date] = None
    due_time: Optional[str] = Field(None, pattern=r'^([01]?[0-9]|2[0-3]):[0-5][0-9]$')  # HH:MM format
    notes: Optional[str] = Field(None, max_length=2000)


class CareScheduleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    frequency_days: Optional[int] = Field(None, ge=1, le=730)
    last_performed: Optional[date] = None
    manual_due_date: Optional[date] = None
    due_time: Optional[str] = Field(None, pattern=r'^([01]?[0-9]|2[0-3]):[0-5][0-9]$')  # HH:MM format
    notes: Optional[str] = Field(None, max_length=2000)
    is_active: Optional[bool] = None


def feed_to_response(feed: AnimalFeed) -> dict:
    """Convert feed to response dict"""
    return {
        "id": feed.id,
        "animal_id": feed.animal_id,
        "feed_type": feed.feed_type,
        "amount": feed.amount,
        "frequency": feed.frequency,
        "notes": feed.notes,
    }


def care_schedule_to_response(schedule: AnimalCareSchedule) -> dict:
    """Convert care schedule to response with computed fields"""
    return {
        "id": schedule.id,
        "animal_id": schedule.animal_id,
        "name": schedule.name,
        "frequency_days": schedule.frequency_days,
        "last_performed": schedule.last_performed,
        "manual_due_date": schedule.manual_due_date,
        "due_date": schedule.due_date,
        "due_time": schedule.due_time,
        "is_overdue": schedule.is_overdue,
        "days_until_due": schedule.days_until_due,
        "notes": schedule.notes,
        "is_active": schedule.is_active,
        "created_at": schedule.created_at,
    }


def animal_to_response(animal: Animal) -> dict:
    """Convert Animal model to response with computed fields"""
    return {
        "id": animal.id,
        "name": animal.name,
        "animal_type": animal.animal_type,
        "category": animal.category,
        "breed": animal.breed,
        "color": animal.color,
        "tag_number": animal.tag_number,
        "microchip": animal.microchip,
        "sex": animal.sex,
        "birth_date": animal.birth_date,
        "acquisition_date": animal.acquisition_date,
        "current_weight": animal.current_weight,
        "feed_amount": animal.feed_amount,
        "feed_frequency": animal.feed_frequency,
        "feed_type": animal.feed_type,
        "pasture": animal.pasture,
        "sub_location": animal.sub_location,
        "status": animal.status,
        "is_active": animal.is_active,
        # Computed fields
        "age_months": animal.age_months,
        "age_display": animal.age_display,
        # Livestock fields
        "target_weight": animal.target_weight,
        "slaughter_date": animal.slaughter_date,
        "slaughter_start_time": animal.slaughter_start_time,
        "slaughter_end_time": animal.slaughter_end_time,
        "slaughter_notes": animal.slaughter_notes,
        "days_until_slaughter": animal.days_until_slaughter,
        "processor": animal.processor,
        "processor_address": animal.processor_address,
        "pickup_date": animal.pickup_date,
        "pickup_start_time": animal.pickup_start_time,
        "pickup_end_time": animal.pickup_end_time,
        "pickup_notes": animal.pickup_notes,
        "total_expenses": animal.total_expenses,
        # Pet care schedules
        "last_wormed": animal.last_wormed,
        "worming_frequency_days": animal.worming_frequency_days,
        "next_worming": animal.next_worming,
        "worming_overdue": animal.worming_overdue,
        "wormer_rotation": animal.wormer_rotation,
        "last_vaccinated": animal.last_vaccinated,
        "vaccination_frequency_days": animal.vaccination_frequency_days,
        "next_vaccination": animal.next_vaccination,
        "vaccination_overdue": animal.vaccination_overdue,
        "last_hoof_trim": animal.last_hoof_trim,
        "hoof_trim_frequency_days": animal.hoof_trim_frequency_days,
        "next_hoof_trim": animal.next_hoof_trim,
        "hoof_trim_overdue": animal.hoof_trim_overdue,
        "last_dental": animal.last_dental,
        "dental_frequency_days": animal.dental_frequency_days,
        "next_dental": animal.next_dental,
        "dental_overdue": animal.dental_overdue,
        "last_vet_visit": animal.last_vet_visit,
        "vet_notes": animal.vet_notes,
        # Cold tolerance
        "min_temp": animal.min_temp,
        "needs_blanket_below": animal.needs_blanket_below,
        "cold_sensitive": animal.cold_sensitive,
        # Tags
        "tags": animal.tags.split(',') if animal.tags else [],
        "notes": animal.notes,
        "special_instructions": animal.special_instructions,
        "created_at": animal.created_at,
        "updated_at": animal.updated_at,
        # Farm area
        "farm_area_id": animal.farm_area_id,
        "farm_area": {
            "id": animal.farm_area.id,
            "name": animal.farm_area.name,
        } if hasattr(animal, 'farm_area') and animal.farm_area else None,
        # Care schedules
        "care_schedules": [
            care_schedule_to_response(cs)
            for cs in animal.care_schedules
            if cs.is_active
        ] if hasattr(animal, 'care_schedules') and animal.care_schedules else [],
        "feeds": [
            feed_to_response(f)
            for f in animal.feeds
            if f.is_active
        ] if hasattr(animal, 'feeds') and animal.feeds else [],
    }


# Routes
@router.get("/")
async def list_animals(
    category: Optional[AnimalCategory] = None,
    animal_type: Optional[AnimalType] = None,
    active_only: bool = True,
    limit: int = 500,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """List all animals with optional filtering"""
    # Cap limit for DoS prevention
    limit = min(limit, 1000)

    query = select(Animal).options(
        selectinload(Animal.expenses), selectinload(Animal.care_schedules), selectinload(Animal.feeds), selectinload(Animal.farm_area)
    )

    if active_only:
        query = query.where(Animal.is_active == True)
    if category:
        query = query.where(Animal.category == category)
    if animal_type:
        query = query.where(Animal.animal_type == animal_type)

    query = query.order_by(Animal.category, Animal.name).offset(offset).limit(limit)
    result = await db.execute(query)
    animals = result.scalars().all()
    return [animal_to_response(a) for a in animals]


@router.post("/")
async def create_animal(
    animal: AnimalCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_create("animals"))
):
    """Add a new animal"""
    db_animal = Animal(**animal.model_dump())
    db.add(db_animal)
    await db.commit()
    await db.refresh(db_animal)

    # Trigger grouped reminder sync for all animals (creates one reminder per date)
    if db_animal.category == AnimalCategory.LIVESTOCK and db_animal.slaughter_date:
        await sync_all_animal_reminders(db)

    # Reload with expenses
    result = await db.execute(
        select(Animal).options(selectinload(Animal.expenses), selectinload(Animal.care_schedules), selectinload(Animal.feeds), selectinload(Animal.farm_area)).where(Animal.id == db_animal.id)
    )
    db_animal = result.scalar_one()
    return animal_to_response(db_animal)


@router.get("/{animal_id}")
async def get_animal(animal_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific animal by ID"""
    result = await db.execute(
        select(Animal).options(selectinload(Animal.expenses), selectinload(Animal.care_schedules), selectinload(Animal.feeds), selectinload(Animal.farm_area)).where(Animal.id == animal_id)
    )
    animal = result.scalar_one_or_none()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")
    return animal_to_response(animal)


@router.patch("/{animal_id}/")
async def update_animal(
    animal_id: int,
    updates: AnimalUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_edit("animals"))
):
    """Update an animal's information"""
    result = await db.execute(
        select(Animal).options(selectinload(Animal.expenses), selectinload(Animal.care_schedules), selectinload(Animal.feeds), selectinload(Animal.farm_area)).where(Animal.id == animal_id)
    )
    animal = result.scalar_one_or_none()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")

    # Track if slaughter date changed
    old_slaughter_date = animal.slaughter_date

    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(animal, field, value)

    animal.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(animal)

    # Trigger grouped reminder sync if slaughter date changed
    if animal.category == AnimalCategory.LIVESTOCK:
        if animal.slaughter_date != old_slaughter_date:
            # Re-sync all animal reminders to update groupings
            await sync_all_animal_reminders(db)

    return animal_to_response(animal)


@router.delete("/{animal_id}/")
async def delete_animal(
    animal_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_delete("animals"))
):
    """Deactivate an animal (soft delete)"""
    result = await db.execute(
        select(Animal).options(selectinload(Animal.care_schedules)).where(Animal.id == animal_id)
    )
    animal = result.scalar_one_or_none()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")

    animal.is_active = False
    animal.updated_at = datetime.utcnow()
    await db.commit()

    # Re-sync all animal reminders to update groupings (will exclude deleted animal)
    await sync_all_animal_reminders(db)

    return {"message": "Animal deactivated"}


# === Expense Endpoints ===
@router.get("/{animal_id}/expenses/", response_model=List[ExpenseResponse])
async def get_expenses(
    animal_id: int,
    expense_type: Optional[str] = None,
    limit: int = Query(default=100, le=500),
    db: AsyncSession = Depends(get_db),
):
    """Get expenses for an animal"""
    query = select(AnimalExpense).where(AnimalExpense.animal_id == animal_id)

    if expense_type:
        query = query.where(AnimalExpense.expense_type == expense_type)

    query = query.order_by(AnimalExpense.expense_date.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/{animal_id}/expenses/", response_model=ExpenseResponse)
async def add_expense(
    animal_id: int,
    expense: ExpenseCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_create("animals"))
):
    """Add an expense for an animal"""
    # Verify animal exists
    result = await db.execute(select(Animal).where(Animal.id == animal_id))
    animal = result.scalar_one_or_none()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")

    db_expense = AnimalExpense(
        animal_id=animal_id,
        expense_type=expense.expense_type,
        description=expense.description,
        amount=expense.amount,
        expense_date=expense.expense_date or date.today(),
        vendor=expense.vendor,
        notes=expense.notes,
    )
    db.add(db_expense)
    await db.commit()
    await db.refresh(db_expense)
    return db_expense


@router.put("/expenses/{expense_id}/", response_model=ExpenseResponse)
async def update_expense(
    expense_id: int,
    expense: ExpenseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_edit("animals")),
):
    """Update an expense"""
    result = await db.execute(select(AnimalExpense).where(AnimalExpense.id == expense_id))
    db_expense = result.scalar_one_or_none()
    if not db_expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    db_expense.expense_type = expense.expense_type
    db_expense.description = expense.description
    db_expense.amount = expense.amount
    db_expense.expense_date = expense.expense_date or db_expense.expense_date
    db_expense.vendor = expense.vendor
    db_expense.notes = expense.notes

    await db.commit()
    await db.refresh(db_expense)
    return db_expense


@router.delete("/expenses/{expense_id}/")
async def delete_expense(
    expense_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_delete("animals")),
):
    """Delete an expense"""
    result = await db.execute(select(AnimalExpense).where(AnimalExpense.id == expense_id))
    db_expense = result.scalar_one_or_none()
    if not db_expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    await db.delete(db_expense)
    await db.commit()
    return {"message": "Expense deleted"}


# ==================== Expense Receipt Routes ====================

@router.get("/expenses/receipts/{filename}")
async def get_expense_receipt(filename: str):
    """Serve an expense receipt file"""
    filepath = os.path.join(RECEIPT_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Receipt not found")

    abs_upload_dir = os.path.abspath(RECEIPT_DIR)
    abs_filepath = os.path.abspath(filepath)
    if not abs_filepath.startswith(abs_upload_dir):
        raise HTTPException(status_code=403, detail="Access denied")

    return FileResponse(
        filepath,
        headers={"Content-Security-Policy": "script-src 'none'; object-src 'none'"}
    )


@router.post("/expenses/{expense_id}/receipt/")
async def upload_expense_receipt(
    expense_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_edit("animals")),
):
    """Upload a receipt for an animal expense"""
    result = await db.execute(
        select(AnimalExpense).where(AnimalExpense.id == expense_id)
    )
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: JPEG, PNG, GIF, WebP, PDF")

    os.makedirs(RECEIPT_DIR, exist_ok=True)

    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"animal_{expense_id}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = os.path.join(RECEIPT_DIR, filename)

    # Delete old receipt if exists
    if expense.receipt_path and os.path.exists(expense.receipt_path):
        try:
            os.remove(expense.receipt_path)
        except OSError:
            pass

    try:
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        logger.error(f"Failed to save receipt file: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")

    expense.receipt_path = filepath
    await db.commit()

    return {"receipt_path": filepath}


@router.delete("/expenses/{expense_id}/receipt/")
async def delete_expense_receipt(
    expense_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_edit("animals")),
):
    """Delete a receipt from an animal expense"""
    result = await db.execute(
        select(AnimalExpense).where(AnimalExpense.id == expense_id)
    )
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    if expense.receipt_path and os.path.exists(expense.receipt_path):
        try:
            os.remove(expense.receipt_path)
        except OSError:
            pass

    expense.receipt_path = None
    await db.commit()

    return {"message": "Receipt deleted"}


@router.get("/{animal_id}/expenses/export/")
async def export_expenses_csv(
    animal_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Export expenses for a single animal to CSV"""
    result = await db.execute(
        select(Animal).options(selectinload(Animal.expenses)).where(Animal.id == animal_id)
    )
    animal = result.scalar_one_or_none()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Type", "Description", "Amount", "Vendor", "Notes"])

    for expense in sorted(animal.expenses, key=lambda e: e.expense_date, reverse=True):
        writer.writerow([
            expense.expense_date.strftime("%Y-%m-%d"),
            expense.expense_type,
            expense.description or "",
            f"{expense.amount:.2f}",
            expense.vendor or "",
            expense.notes or "",
        ])

    # Add total row
    writer.writerow([])
    writer.writerow(["", "", "TOTAL", f"{animal.total_expenses:.2f}", "", ""])

    output.seek(0)
    filename = f"{animal.name.replace(' ', '_')}_expenses.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/expenses/export/all/")
async def export_all_expenses_csv(
    db: AsyncSession = Depends(get_db),
):
    """Export all animal expenses to CSV"""
    result = await db.execute(
        select(Animal).options(selectinload(Animal.expenses)).where(Animal.is_active == True)
    )
    animals = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Animal", "Category", "Date", "Type", "Description", "Amount", "Vendor", "Notes"])

    all_expenses = []
    for animal in animals:
        for expense in animal.expenses:
            all_expenses.append({
                "animal": animal.name,
                "category": animal.category,
                "expense": expense,
            })

    # Sort by date descending
    all_expenses.sort(key=lambda e: e["expense"].expense_date, reverse=True)

    total = 0
    for item in all_expenses:
        expense = item["expense"]
        total += expense.amount
        writer.writerow([
            item["animal"],
            item["category"],
            expense.expense_date.strftime("%Y-%m-%d"),
            expense.expense_type,
            expense.description or "",
            f"{expense.amount:.2f}",
            expense.vendor or "",
            expense.notes or "",
        ])

    # Add total row
    writer.writerow([])
    writer.writerow(["", "", "", "", "TOTAL", f"{total:.2f}", "", ""])

    output.seek(0)
    filename = f"all_animal_expenses_{date.today().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/{animal_id}/expenses/total/")
async def get_total_expenses(animal_id: int, db: AsyncSession = Depends(get_db)):
    """Get total expenses for an animal"""
    result = await db.execute(
        select(Animal).options(selectinload(Animal.expenses), selectinload(Animal.care_schedules), selectinload(Animal.feeds), selectinload(Animal.farm_area)).where(Animal.id == animal_id)
    )
    animal = result.scalar_one_or_none()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")

    return {
        "animal_id": animal_id,
        "animal_name": animal.name,
        "total_expenses": animal.total_expenses,
        "expense_count": len(animal.expenses),
    }


@router.post("/expenses/split/", response_model=List[ExpenseResponse])
async def create_split_expense(
    expense: SplitExpenseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_create("animals")),
):
    """Create an expense split across multiple animals.

    Each animal gets an AnimalExpense record with their portion of the total.
    All records share the same expense_group_id to link them together.
    """
    # Validate that all animals exist
    animal_ids = [s.animal_id for s in expense.splits]
    result = await db.execute(select(Animal).where(Animal.id.in_(animal_ids)))
    found_animals = {a.id for a in result.scalars().all()}

    missing = set(animal_ids) - found_animals
    if missing:
        raise HTTPException(status_code=404, detail=f"Animals not found: {list(missing)}")

    # Validate that split amounts sum to total (with small tolerance for floating point)
    split_sum = sum(s.amount for s in expense.splits)
    if abs(split_sum - expense.total_amount) > 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Split amounts ({split_sum:.2f}) must equal total amount ({expense.total_amount:.2f})"
        )

    # Generate group ID for linking
    group_id = str(uuid.uuid4())
    expense_date = expense.expense_date or date.today()

    # Create expense records for each animal
    created_expenses = []
    for split in expense.splits:
        db_expense = AnimalExpense(
            animal_id=split.animal_id,
            expense_type=expense.expense_type,
            description=expense.description,
            amount=split.amount,
            expense_date=expense_date,
            vendor=expense.vendor,
            notes=expense.notes,
            expense_group_id=group_id,
            total_amount=expense.total_amount,
        )
        db.add(db_expense)
        created_expenses.append(db_expense)

    await db.commit()

    # Refresh all to get IDs
    for exp in created_expenses:
        await db.refresh(exp)

    return created_expenses


# === Care Log Endpoints ===
@router.get("/{animal_id}/care-logs/", response_model=List[CareLogResponse])
async def get_care_logs(
    animal_id: int,
    care_type: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Get care logs for an animal"""
    query = select(AnimalCareLog).where(AnimalCareLog.animal_id == animal_id)

    if care_type:
        query = query.where(AnimalCareLog.care_type == care_type)

    query = query.order_by(AnimalCareLog.performed_at.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/{animal_id}/care-logs/", response_model=CareLogResponse)
async def add_care_log(
    animal_id: int,
    log: CareLogCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_interact("animals"))
):
    """Log a care activity for an animal and update last_* fields"""
    result = await db.execute(select(Animal).where(Animal.id == animal_id))
    animal = result.scalar_one_or_none()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")

    performed_at = log.performed_at or datetime.utcnow()

    care_log = AnimalCareLog(
        animal_id=animal_id,
        care_type=log.care_type,
        details=log.details,
        product_used=log.product_used,
        dosage=log.dosage,
        performed_by=log.performed_by,
        weight=log.weight,
        notes=log.notes,
        performed_at=performed_at,
    )
    db.add(care_log)

    # Update animal's last care dates based on care type
    if log.care_type == "wormed":
        animal.last_wormed = performed_at
    elif log.care_type == "vaccinated":
        animal.last_vaccinated = performed_at
    elif log.care_type == "hoof_trim":
        animal.last_hoof_trim = performed_at
    elif log.care_type == "dental":
        animal.last_dental = performed_at
    elif log.care_type == "vet_visit":
        animal.last_vet_visit = performed_at.date() if isinstance(performed_at, datetime) else performed_at
    elif log.care_type == "weighed" and log.weight:
        animal.current_weight = log.weight

    animal.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(care_log)
    return care_log


# === Category-specific endpoints ===
@router.get("/pets/list/")
async def get_pets(db: AsyncSession = Depends(get_db)):
    """Get all pets"""
    result = await db.execute(
        select(Animal)
        .options(selectinload(Animal.expenses), selectinload(Animal.care_schedules), selectinload(Animal.feeds), selectinload(Animal.farm_area))
        .where(Animal.category == AnimalCategory.PET)
        .where(Animal.is_active == True)
        .order_by(Animal.name)
    )
    animals = result.scalars().all()
    return [animal_to_response(a) for a in animals]


@router.get("/livestock/list/")
async def get_livestock(db: AsyncSession = Depends(get_db)):
    """Get all livestock"""
    result = await db.execute(
        select(Animal)
        .options(selectinload(Animal.expenses), selectinload(Animal.care_schedules), selectinload(Animal.feeds), selectinload(Animal.farm_area))
        .where(Animal.category == AnimalCategory.LIVESTOCK)
        .where(Animal.is_active == True)
        .order_by(Animal.name)
    )
    animals = result.scalars().all()
    return [animal_to_response(a) for a in animals]


# === Care Due Endpoints ===
@router.get("/care-due/worming/")
async def get_animals_needing_worming(
    days: int = Query(default=14),
    db: AsyncSession = Depends(get_db),
):
    """Get pets needing worming (due or overdue)"""
    result = await db.execute(
        select(Animal)
        .options(selectinload(Animal.expenses), selectinload(Animal.care_schedules), selectinload(Animal.feeds), selectinload(Animal.farm_area))
        .where(Animal.category == AnimalCategory.PET)
        .where(Animal.is_active == True)
        .where(Animal.worming_frequency_days.isnot(None))
    )
    animals = result.scalars().all()

    target_date = datetime.utcnow() + timedelta(days=days)
    due_animals = []
    for a in animals:
        next_date = a.next_worming
        if next_date and next_date <= target_date:
            due_animals.append(animal_to_response(a))

    return due_animals


@router.get("/care-due/vaccination/")
async def get_animals_needing_vaccination(
    days: int = Query(default=30),
    db: AsyncSession = Depends(get_db),
):
    """Get pets needing vaccination (due or overdue)"""
    result = await db.execute(
        select(Animal)
        .options(selectinload(Animal.expenses), selectinload(Animal.care_schedules), selectinload(Animal.feeds), selectinload(Animal.farm_area))
        .where(Animal.category == AnimalCategory.PET)
        .where(Animal.is_active == True)
        .where(Animal.vaccination_frequency_days.isnot(None))
    )
    animals = result.scalars().all()

    target_date = datetime.utcnow() + timedelta(days=days)
    due_animals = []
    for a in animals:
        next_date = a.next_vaccination
        if next_date and next_date <= target_date:
            due_animals.append(animal_to_response(a))

    return due_animals


@router.get("/care-due/hoof-trim/")
async def get_animals_needing_hoof_trim(
    days: int = Query(default=14),
    db: AsyncSession = Depends(get_db),
):
    """Get pets needing hoof trim (due or overdue)"""
    result = await db.execute(
        select(Animal)
        .options(selectinload(Animal.expenses), selectinload(Animal.care_schedules), selectinload(Animal.feeds), selectinload(Animal.farm_area))
        .where(Animal.category == AnimalCategory.PET)
        .where(Animal.is_active == True)
        .where(Animal.hoof_trim_frequency_days.isnot(None))
    )
    animals = result.scalars().all()

    target_date = datetime.utcnow() + timedelta(days=days)
    due_animals = []
    for a in animals:
        next_date = a.next_hoof_trim
        if next_date and next_date <= target_date:
            due_animals.append(animal_to_response(a))

    return due_animals


@router.get("/care-due/dental/")
async def get_animals_needing_dental(
    days: int = Query(default=30),
    db: AsyncSession = Depends(get_db),
):
    """Get pets needing dental work (due or overdue)"""
    result = await db.execute(
        select(Animal)
        .options(selectinload(Animal.expenses), selectinload(Animal.care_schedules), selectinload(Animal.feeds), selectinload(Animal.farm_area))
        .where(Animal.category == AnimalCategory.PET)
        .where(Animal.is_active == True)
        .where(Animal.dental_frequency_days.isnot(None))
    )
    animals = result.scalars().all()

    target_date = datetime.utcnow() + timedelta(days=days)
    due_animals = []
    for a in animals:
        next_date = a.next_dental
        if next_date and next_date <= target_date:
            due_animals.append(animal_to_response(a))

    return due_animals


@router.get("/livestock/approaching-slaughter/")
async def get_livestock_approaching_slaughter(
    days: int = Query(default=30),
    db: AsyncSession = Depends(get_db),
):
    """Get livestock approaching slaughter date"""
    target_date = date.today() + timedelta(days=days)
    result = await db.execute(
        select(Animal)
        .options(selectinload(Animal.expenses), selectinload(Animal.care_schedules), selectinload(Animal.feeds), selectinload(Animal.farm_area))
        .where(Animal.category == AnimalCategory.LIVESTOCK)
        .where(Animal.is_active == True)
        .where(Animal.slaughter_date.isnot(None))
        .where(Animal.slaughter_date <= target_date)
        .order_by(Animal.slaughter_date)
    )
    animals = result.scalars().all()
    return [animal_to_response(a) for a in animals]


@router.get("/cold-sensitive/")
async def get_cold_sensitive_animals(
    temp: Optional[float] = None,
    db: AsyncSession = Depends(get_db),
):
    """Get animals that need cold protection at a given temperature.
    If temp is provided, returns animals that need protection at that temp.
    If temp is not provided, returns all cold-sensitive animals."""
    result = await db.execute(
        select(Animal)
        .options(selectinload(Animal.expenses), selectinload(Animal.care_schedules), selectinload(Animal.feeds), selectinload(Animal.farm_area))
        .where(Animal.is_active == True)
        .where(Animal.cold_sensitive == True)
        .order_by(Animal.name)
    )
    animals = result.scalars().all()

    if temp is not None:
        # Filter to animals that need protection at this temp
        animals = [a for a in animals if (
            (a.min_temp is not None and temp <= a.min_temp) or
            (a.needs_blanket_below is not None and temp <= a.needs_blanket_below)
        )]

    return [animal_to_response(a) for a in animals]


@router.get("/needs-blanket/")
async def get_animals_needing_blanket(
    temp: float = Query(..., description="Current/forecast temperature in F"),
    db: AsyncSession = Depends(get_db),
):
    """Get animals that need a blanket at the given temperature (with buffer applied)"""
    # Get cold protection buffer from settings (same as plants use)
    buffer_result = await db.execute(
        select(AppSetting).where(AppSetting.key == "cold_protection_buffer")
    )
    buffer_setting = buffer_result.scalar_one_or_none()
    buffer = float(buffer_setting.value) if buffer_setting and buffer_setting.value else 7.0

    # Add buffer to forecast temp to account for forecast error
    # If forecast is 30 and buffer is 7, check if animal needs blanket at 23 (30-7)
    # Or in other words: show animals whose threshold + buffer >= temp
    result = await db.execute(
        select(Animal)
        .options(selectinload(Animal.expenses), selectinload(Animal.care_schedules), selectinload(Animal.feeds), selectinload(Animal.farm_area))
        .where(Animal.is_active == True)
        .where(Animal.needs_blanket_below.isnot(None))
        .where(Animal.needs_blanket_below + buffer >= temp)
        .order_by(Animal.name)
    )
    animals = result.scalars().all()
    return [animal_to_response(a) for a in animals]


# === Care Schedule Endpoints ===
@router.get("/{animal_id}/care-schedules/")
async def get_care_schedules(
    animal_id: int,
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """Get care schedules for an animal"""
    query = select(AnimalCareSchedule).where(AnimalCareSchedule.animal_id == animal_id)
    if not include_inactive:
        query = query.where(AnimalCareSchedule.is_active == True)
    query = query.order_by(AnimalCareSchedule.name)

    result = await db.execute(query)
    schedules = result.scalars().all()
    return [care_schedule_to_response(s) for s in schedules]


@router.post("/{animal_id}/care-schedules/")
async def create_care_schedule(
    animal_id: int,
    schedule: CareScheduleCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_create("animals"))
):
    """Create a new care schedule item for an animal"""
    # Verify animal exists
    result = await db.execute(select(Animal).where(Animal.id == animal_id))
    animal = result.scalar_one_or_none()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")

    db_schedule = AnimalCareSchedule(
        animal_id=animal_id,
        name=schedule.name,
        frequency_days=schedule.frequency_days,
        last_performed=schedule.last_performed,
        manual_due_date=schedule.manual_due_date,
        due_time=schedule.due_time,
        notes=schedule.notes,
    )
    db.add(db_schedule)
    await db.commit()
    await db.refresh(db_schedule)

    # Trigger grouped reminder sync (creates one reminder per date/care type)
    if db_schedule.due_date:
        await sync_all_animal_reminders(db)

    return care_schedule_to_response(db_schedule)


@router.patch("/{animal_id}/care-schedules/{schedule_id}/")
async def update_care_schedule(
    animal_id: int,
    schedule_id: int,
    updates: CareScheduleUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_edit("animals"))
):
    """Update a care schedule item"""
    result = await db.execute(
        select(AnimalCareSchedule)
        .where(AnimalCareSchedule.id == schedule_id)
        .where(AnimalCareSchedule.animal_id == animal_id)
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(status_code=404, detail="Care schedule not found")

    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(schedule, field, value)

    schedule.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(schedule)

    # Trigger grouped reminder sync to update groupings
    await sync_all_animal_reminders(db)

    return care_schedule_to_response(schedule)


@router.post("/{animal_id}/care-schedules/{schedule_id}/complete/")
async def complete_care_schedule(
    animal_id: int,
    schedule_id: int,
    performed_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_interact("animals"))
):
    """Mark a care schedule item as completed (updates last_performed to today or specified date)"""
    result = await db.execute(
        select(AnimalCareSchedule)
        .where(AnimalCareSchedule.id == schedule_id)
        .where(AnimalCareSchedule.animal_id == animal_id)
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(status_code=404, detail="Care schedule not found")

    schedule.last_performed = performed_date or date.today()
    # Clear manual due date when completing, so it recalculates based on frequency
    schedule.manual_due_date = None
    schedule.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(schedule)

    # Trigger grouped reminder sync (will recalculate with new due date)
    await sync_all_animal_reminders(db)

    return care_schedule_to_response(schedule)


@router.delete("/{animal_id}/care-schedules/{schedule_id}/")
async def delete_care_schedule(
    animal_id: int,
    schedule_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_delete("animals"))
):
    """Delete a care schedule item (soft delete - sets is_active=False)"""
    result = await db.execute(
        select(AnimalCareSchedule)
        .where(AnimalCareSchedule.id == schedule_id)
        .where(AnimalCareSchedule.animal_id == animal_id)
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(status_code=404, detail="Care schedule not found")

    schedule.is_active = False
    schedule.updated_at = datetime.utcnow()
    await db.commit()

    # Trigger grouped reminder sync (will exclude this deactivated schedule)
    await sync_all_animal_reminders(db)

    return {"message": "Care schedule deleted"}


# Bulk Care Schedule Schema
class BulkCareScheduleCreate(BaseModel):
    animal_ids: List[int]
    name: str
    frequency_days: Optional[int] = None
    due_time: Optional[str] = None  # "HH:MM" format
    last_performed: Optional[date] = None
    manual_due_date: Optional[date] = None
    notes: Optional[str] = None


@router.post("/care-schedules/bulk/")
async def create_bulk_care_schedules(
    data: BulkCareScheduleCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_create("animals"))
):
    """Create the same care schedule item for multiple animals at once"""
    # Verify all animals exist
    result = await db.execute(
        select(Animal).where(Animal.id.in_(data.animal_ids))
    )
    animals = result.scalars().all()
    found_ids = {a.id for a in animals}
    missing_ids = set(data.animal_ids) - found_ids

    if missing_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Animals not found: {list(missing_ids)}"
        )

    # Create dict for animal names lookup
    animal_name_map = {a.id: a.name for a in animals}

    created = []
    for animal_id in data.animal_ids:
        db_schedule = AnimalCareSchedule(
            animal_id=animal_id,
            name=data.name,
            frequency_days=data.frequency_days,
            due_time=data.due_time,
            last_performed=data.last_performed,
            manual_due_date=data.manual_due_date,
            notes=data.notes,
        )
        db.add(db_schedule)
        created.append(db_schedule)

    await db.commit()

    # Refresh all to get IDs
    for schedule in created:
        await db.refresh(schedule)

    # Trigger one grouped reminder sync for all new schedules
    await sync_all_animal_reminders(db)

    return {
        "message": f"Created care schedule '{data.name}' for {len(created)} animals",
        "count": len(created),
        "schedules": [care_schedule_to_response(s) for s in created]
    }


# ============================================
# ANIMAL FEEDS CRUD
# ============================================

class FeedCreate(BaseModel):
    feed_type: str
    amount: Optional[str] = None
    frequency: Optional[str] = None
    notes: Optional[str] = None


class FeedUpdate(BaseModel):
    feed_type: Optional[str] = None
    amount: Optional[str] = None
    frequency: Optional[str] = None
    notes: Optional[str] = None


@router.get("/{animal_id}/feeds/")
async def get_animal_feeds(animal_id: int, db: AsyncSession = Depends(get_db)):
    """Get all feeds for an animal"""
    result = await db.execute(
        select(Animal)
        .where(Animal.id == animal_id)
        .options(selectinload(Animal.feeds))
    )
    animal = result.scalar_one_or_none()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")

    return [feed_to_response(f) for f in animal.feeds if f.is_active]


@router.post("/{animal_id}/feeds/")
async def create_animal_feed(
    animal_id: int,
    data: FeedCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_create("animals"))
):
    """Create a new feed entry for an animal"""
    result = await db.execute(select(Animal).where(Animal.id == animal_id))
    animal = result.scalar_one_or_none()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")

    db_feed = AnimalFeed(
        animal_id=animal_id,
        feed_type=data.feed_type,
        amount=data.amount,
        frequency=data.frequency,
        notes=data.notes,
    )
    db.add(db_feed)
    await db.commit()
    await db.refresh(db_feed)

    return feed_to_response(db_feed)


@router.patch("/{animal_id}/feeds/{feed_id}/")
async def update_animal_feed(
    animal_id: int,
    feed_id: int,
    data: FeedUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_edit("animals"))
):
    """Update a feed entry"""
    result = await db.execute(
        select(AnimalFeed)
        .where(AnimalFeed.id == feed_id, AnimalFeed.animal_id == animal_id)
    )
    feed = result.scalar_one_or_none()
    if not feed:
        raise HTTPException(status_code=404, detail="Feed not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(feed, key, value)

    await db.commit()
    await db.refresh(feed)

    return feed_to_response(feed)


@router.delete("/{animal_id}/feeds/{feed_id}/")
async def delete_animal_feed(
    animal_id: int,
    feed_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_delete("animals"))
):
    """Delete a feed entry (soft delete)"""
    result = await db.execute(
        select(AnimalFeed)
        .where(AnimalFeed.id == feed_id, AnimalFeed.animal_id == animal_id)
    )
    feed = result.scalar_one_or_none()
    if not feed:
        raise HTTPException(status_code=404, detail="Feed not found")

    feed.is_active = False
    await db.commit()

    return {"message": "Feed deleted"}
