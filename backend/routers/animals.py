"""
Livestock and Animal API Routes
Supports Pets and Livestock categories with expense tracking and recurring care schedules
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, date, timedelta
from pydantic import BaseModel

from models.database import get_db
from models.livestock import Animal, AnimalType, AnimalCategory, AnimalCareLog, AnimalExpense


router = APIRouter(prefix="/animals", tags=["Animals"])


# Pydantic Schemas
class AnimalCreate(BaseModel):
    name: str
    animal_type: AnimalType
    category: AnimalCategory
    breed: Optional[str] = None
    tag_number: Optional[str] = None
    microchip: Optional[str] = None
    sex: Optional[str] = None
    birth_date: Optional[date] = None
    acquisition_date: Optional[date] = None
    current_weight: Optional[float] = None
    feed_amount: Optional[str] = None
    feed_frequency: Optional[str] = None
    pasture: Optional[str] = None
    barn: Optional[str] = None
    # Livestock specific
    target_weight: Optional[float] = None
    slaughter_date: Optional[date] = None
    processor: Optional[str] = None
    # Pet care schedules (frequency in days)
    worming_frequency_days: Optional[int] = None
    vaccination_frequency_days: Optional[int] = None
    hoof_trim_frequency_days: Optional[int] = None
    dental_frequency_days: Optional[int] = None
    wormer_rotation: Optional[str] = None
    notes: Optional[str] = None


class AnimalUpdate(BaseModel):
    name: Optional[str] = None
    breed: Optional[str] = None
    tag_number: Optional[str] = None
    microchip: Optional[str] = None
    sex: Optional[str] = None
    current_weight: Optional[float] = None
    feed_amount: Optional[str] = None
    feed_frequency: Optional[str] = None
    pasture: Optional[str] = None
    barn: Optional[str] = None
    status: Optional[str] = None
    # Livestock
    target_weight: Optional[float] = None
    slaughter_date: Optional[date] = None
    processor: Optional[str] = None
    # Pet care schedules
    worming_frequency_days: Optional[int] = None
    vaccination_frequency_days: Optional[int] = None
    hoof_trim_frequency_days: Optional[int] = None
    dental_frequency_days: Optional[int] = None
    wormer_rotation: Optional[str] = None
    notes: Optional[str] = None


class ExpenseCreate(BaseModel):
    expense_type: str  # purchase, feed, medicine, vet, equipment, farrier, other
    description: Optional[str] = None
    amount: float
    expense_date: Optional[date] = None
    vendor: Optional[str] = None
    notes: Optional[str] = None


class ExpenseResponse(BaseModel):
    id: int
    animal_id: int
    expense_type: str
    description: Optional[str]
    amount: float
    expense_date: date
    vendor: Optional[str]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class CareLogCreate(BaseModel):
    care_type: str  # wormed, vaccinated, hoof_trim, dental, vet_visit, weighed, medicated, groomed
    details: Optional[str] = None
    product_used: Optional[str] = None
    dosage: Optional[str] = None
    performed_by: Optional[str] = None
    weight: Optional[float] = None
    notes: Optional[str] = None
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


def animal_to_response(animal: Animal) -> dict:
    """Convert Animal model to response with computed fields"""
    return {
        "id": animal.id,
        "name": animal.name,
        "animal_type": animal.animal_type,
        "category": animal.category,
        "breed": animal.breed,
        "tag_number": animal.tag_number,
        "microchip": animal.microchip,
        "sex": animal.sex,
        "birth_date": animal.birth_date,
        "acquisition_date": animal.acquisition_date,
        "current_weight": animal.current_weight,
        "feed_amount": animal.feed_amount,
        "feed_frequency": animal.feed_frequency,
        "pasture": animal.pasture,
        "barn": animal.barn,
        "status": animal.status,
        "is_active": animal.is_active,
        # Computed fields
        "age_months": animal.age_months,
        "age_display": animal.age_display,
        # Livestock fields
        "target_weight": animal.target_weight,
        "slaughter_date": animal.slaughter_date,
        "days_until_slaughter": animal.days_until_slaughter,
        "processor": animal.processor,
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
        "notes": animal.notes,
        "created_at": animal.created_at,
    }


# Routes
@router.get("/")
async def list_animals(
    category: Optional[AnimalCategory] = None,
    animal_type: Optional[AnimalType] = None,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
):
    """List all animals with optional filtering"""
    query = select(Animal).options(selectinload(Animal.expenses))

    if active_only:
        query = query.where(Animal.is_active == True)
    if category:
        query = query.where(Animal.category == category)
    if animal_type:
        query = query.where(Animal.animal_type == animal_type)

    query = query.order_by(Animal.category, Animal.name)
    result = await db.execute(query)
    animals = result.scalars().all()
    return [animal_to_response(a) for a in animals]


@router.post("/")
async def create_animal(animal: AnimalCreate, db: AsyncSession = Depends(get_db)):
    """Add a new animal"""
    db_animal = Animal(**animal.model_dump())
    db.add(db_animal)
    await db.commit()
    await db.refresh(db_animal)

    # Reload with expenses
    result = await db.execute(
        select(Animal).options(selectinload(Animal.expenses)).where(Animal.id == db_animal.id)
    )
    db_animal = result.scalar_one()
    return animal_to_response(db_animal)


@router.get("/{animal_id}")
async def get_animal(animal_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific animal by ID"""
    result = await db.execute(
        select(Animal).options(selectinload(Animal.expenses)).where(Animal.id == animal_id)
    )
    animal = result.scalar_one_or_none()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")
    return animal_to_response(animal)


@router.patch("/{animal_id}")
async def update_animal(
    animal_id: int,
    updates: AnimalUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update an animal's information"""
    result = await db.execute(
        select(Animal).options(selectinload(Animal.expenses)).where(Animal.id == animal_id)
    )
    animal = result.scalar_one_or_none()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")

    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(animal, field, value)

    animal.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(animal)
    return animal_to_response(animal)


@router.delete("/{animal_id}")
async def delete_animal(animal_id: int, db: AsyncSession = Depends(get_db)):
    """Deactivate an animal (soft delete)"""
    result = await db.execute(select(Animal).where(Animal.id == animal_id))
    animal = result.scalar_one_or_none()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")

    animal.is_active = False
    animal.updated_at = datetime.utcnow()
    await db.commit()
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


@router.get("/{animal_id}/expenses/total/")
async def get_total_expenses(animal_id: int, db: AsyncSession = Depends(get_db)):
    """Get total expenses for an animal"""
    result = await db.execute(
        select(Animal).options(selectinload(Animal.expenses)).where(Animal.id == animal_id)
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
        .options(selectinload(Animal.expenses))
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
        .options(selectinload(Animal.expenses))
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
        .options(selectinload(Animal.expenses))
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
        .options(selectinload(Animal.expenses))
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
        .options(selectinload(Animal.expenses))
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
        .options(selectinload(Animal.expenses))
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
        .options(selectinload(Animal.expenses))
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
        .options(selectinload(Animal.expenses))
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
    temp: float = Query(..., description="Current temperature in F"),
    db: AsyncSession = Depends(get_db),
):
    """Get animals that need a blanket at the given temperature"""
    result = await db.execute(
        select(Animal)
        .options(selectinload(Animal.expenses))
        .where(Animal.is_active == True)
        .where(Animal.needs_blanket_below.isnot(None))
        .where(Animal.needs_blanket_below >= temp)
        .order_by(Animal.name)
    )
    animals = result.scalars().all()
    return [animal_to_response(a) for a in animals]
