"""
Farm Areas API Routes
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel, Field

from models.database import get_db
from models.farm_areas import FarmArea, FarmAreaMaintenance, FarmAreaMaintenanceLog, FarmAreaType
from models.plants import Plant
from models.livestock import Animal


router = APIRouter(prefix="/farm-areas", tags=["Farm Areas"])


# Pydantic Schemas
class AreaCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    type: FarmAreaType
    custom_type: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = Field(None, max_length=2000)
    location_notes: Optional[str] = Field(None, max_length=500)
    size_acres: Optional[float] = Field(None, ge=0, le=100000)
    size_sqft: Optional[float] = Field(None, ge=0, le=100000000)
    soil_type: Optional[str] = Field(None, max_length=100)
    irrigation_type: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=5000)


class AreaUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    type: Optional[FarmAreaType] = None
    custom_type: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = Field(None, max_length=2000)
    location_notes: Optional[str] = Field(None, max_length=500)
    size_acres: Optional[float] = Field(None, ge=0, le=100000)
    size_sqft: Optional[float] = Field(None, ge=0, le=100000000)
    soil_type: Optional[str] = Field(None, max_length=100)
    irrigation_type: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=5000)
    is_active: Optional[bool] = None


class MaintenanceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=1000)
    frequency_days: Optional[int] = Field(None, ge=1, le=3650)
    frequency_label: Optional[str] = Field(None, max_length=50)
    seasonal: bool = False
    active_months: Optional[str] = Field(None, max_length=50)
    last_completed: Optional[datetime] = None  # When was this last done
    manual_due_date: Optional[datetime] = None
    notify_channels: str = Field("dashboard,calendar", max_length=100)
    notes: Optional[str] = Field(None, max_length=2000)


class MaintenanceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=1000)
    frequency_days: Optional[int] = Field(None, ge=1, le=3650)
    frequency_label: Optional[str] = Field(None, max_length=50)
    seasonal: Optional[bool] = None
    active_months: Optional[str] = Field(None, max_length=50)
    last_completed: Optional[datetime] = None  # When was this last done
    manual_due_date: Optional[datetime] = None
    notify_channels: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=2000)
    is_active: Optional[bool] = None


class SetDueDateRequest(BaseModel):
    due_date: datetime


class LogCreate(BaseModel):
    notes: Optional[str] = Field(None, max_length=2000)
    cost: Optional[float] = Field(None, ge=0, le=1000000)
    performed_at: Optional[datetime] = None


class PlantSummary(BaseModel):
    id: int
    name: str
    variety: Optional[str]
    location: Optional[str]

    class Config:
        from_attributes = True


class AnimalSummary(BaseModel):
    id: int
    name: str
    animal_type: str
    breed: Optional[str]

    class Config:
        from_attributes = True


class AreaResponse(BaseModel):
    id: int
    name: str
    type: FarmAreaType
    custom_type: Optional[str]
    display_type: str
    description: Optional[str]
    location_notes: Optional[str]
    size_acres: Optional[float]
    size_sqft: Optional[float]
    soil_type: Optional[str]
    irrigation_type: Optional[str]
    is_active: bool
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    plant_count: int = 0
    animal_count: int = 0
    maintenance_count: int = 0
    overdue_count: int = 0

    class Config:
        from_attributes = True


class AreaDetailResponse(AreaResponse):
    plants: List[PlantSummary] = []
    animals: List[AnimalSummary] = []


class MaintenanceResponse(BaseModel):
    id: int
    area_id: int
    name: str
    description: Optional[str]
    frequency_days: Optional[int]
    frequency_label: Optional[str]
    seasonal: bool
    active_months: Optional[str]
    last_completed: Optional[datetime]
    next_due: Optional[datetime]
    manual_due_date: Optional[datetime]
    notify_channels: str
    is_active: bool
    notes: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LogResponse(BaseModel):
    id: int
    area_id: int
    maintenance_id: Optional[int]
    name: Optional[str]
    performed_at: datetime
    cost: Optional[float]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# Area Routes
@router.get("/", response_model=List[AreaResponse])
async def get_all_areas(
    type: Optional[FarmAreaType] = None,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db)
):
    """Get all farm areas"""
    query = select(FarmArea).options(
        selectinload(FarmArea.maintenance_tasks),
        selectinload(FarmArea.plants),
        selectinload(FarmArea.animals)
    )

    if type:
        query = query.where(FarmArea.type == type)
    if active_only:
        query = query.where(FarmArea.is_active == True)

    query = query.order_by(FarmArea.name)

    result = await db.execute(query)
    areas = result.scalars().all()

    return [AreaResponse(
        id=a.id,
        name=a.name,
        type=a.type,
        custom_type=a.custom_type,
        display_type=a.display_type,
        description=a.description,
        location_notes=a.location_notes,
        size_acres=a.size_acres,
        size_sqft=a.size_sqft,
        soil_type=a.soil_type,
        irrigation_type=a.irrigation_type,
        is_active=a.is_active,
        notes=a.notes,
        created_at=a.created_at,
        updated_at=a.updated_at,
        plant_count=len(a.plants),
        animal_count=len(a.animals),
        maintenance_count=len(a.maintenance_tasks),
        overdue_count=sum(1 for m in a.maintenance_tasks if m.status == "overdue")
    ) for a in areas]


@router.get("/{area_id}", response_model=AreaDetailResponse)
async def get_area(area_id: int, db: AsyncSession = Depends(get_db)):
    """Get specific farm area with plants and animals"""
    result = await db.execute(
        select(FarmArea)
        .options(
            selectinload(FarmArea.maintenance_tasks),
            selectinload(FarmArea.plants),
            selectinload(FarmArea.animals)
        )
        .where(FarmArea.id == area_id)
    )
    area = result.scalar_one_or_none()

    if not area:
        raise HTTPException(status_code=404, detail="Farm area not found")

    return AreaDetailResponse(
        id=area.id,
        name=area.name,
        type=area.type,
        custom_type=area.custom_type,
        display_type=area.display_type,
        description=area.description,
        location_notes=area.location_notes,
        size_acres=area.size_acres,
        size_sqft=area.size_sqft,
        soil_type=area.soil_type,
        irrigation_type=area.irrigation_type,
        is_active=area.is_active,
        notes=area.notes,
        created_at=area.created_at,
        updated_at=area.updated_at,
        plant_count=len(area.plants),
        animal_count=len(area.animals),
        maintenance_count=len(area.maintenance_tasks),
        overdue_count=sum(1 for m in area.maintenance_tasks if m.status == "overdue"),
        plants=[PlantSummary(
            id=p.id,
            name=p.name,
            variety=p.variety,
            location=p.location
        ) for p in area.plants if p.is_active],
        animals=[AnimalSummary(
            id=a.id,
            name=a.name,
            animal_type=a.animal_type.value,
            breed=a.breed
        ) for a in area.animals if a.is_active]
    )


@router.post("/", response_model=AreaResponse)
async def create_area(data: AreaCreate, db: AsyncSession = Depends(get_db)):
    """Create a new farm area"""
    area = FarmArea(**data.model_dump())

    db.add(area)
    await db.commit()
    await db.refresh(area)

    return AreaResponse(
        id=area.id,
        name=area.name,
        type=area.type,
        custom_type=area.custom_type,
        display_type=area.display_type,
        description=area.description,
        location_notes=area.location_notes,
        size_acres=area.size_acres,
        size_sqft=area.size_sqft,
        soil_type=area.soil_type,
        irrigation_type=area.irrigation_type,
        is_active=area.is_active,
        notes=area.notes,
        created_at=area.created_at,
        updated_at=area.updated_at,
        plant_count=0,
        animal_count=0,
        maintenance_count=0,
        overdue_count=0
    )


@router.put("/{area_id}", response_model=AreaResponse)
async def update_area(area_id: int, data: AreaUpdate, db: AsyncSession = Depends(get_db)):
    """Update a farm area"""
    result = await db.execute(
        select(FarmArea)
        .options(
            selectinload(FarmArea.maintenance_tasks),
            selectinload(FarmArea.plants),
            selectinload(FarmArea.animals)
        )
        .where(FarmArea.id == area_id)
    )
    area = result.scalar_one_or_none()

    if not area:
        raise HTTPException(status_code=404, detail="Farm area not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(area, key, value)

    await db.commit()
    await db.refresh(area)

    return AreaResponse(
        id=area.id,
        name=area.name,
        type=area.type,
        custom_type=area.custom_type,
        display_type=area.display_type,
        description=area.description,
        location_notes=area.location_notes,
        size_acres=area.size_acres,
        size_sqft=area.size_sqft,
        soil_type=area.soil_type,
        irrigation_type=area.irrigation_type,
        is_active=area.is_active,
        notes=area.notes,
        created_at=area.created_at,
        updated_at=area.updated_at,
        plant_count=len(area.plants),
        animal_count=len(area.animals),
        maintenance_count=len(area.maintenance_tasks),
        overdue_count=sum(1 for m in area.maintenance_tasks if m.status == "overdue")
    )


@router.delete("/{area_id}")
async def delete_area(area_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a farm area"""
    result = await db.execute(
        select(FarmArea).where(FarmArea.id == area_id)
    )
    area = result.scalar_one_or_none()

    if not area:
        raise HTTPException(status_code=404, detail="Farm area not found")

    # Clear farm_area_id from associated plants and animals
    await db.execute(
        Plant.__table__.update()
        .where(Plant.farm_area_id == area_id)
        .values(farm_area_id=None)
    )
    await db.execute(
        Animal.__table__.update()
        .where(Animal.farm_area_id == area_id)
        .values(farm_area_id=None)
    )

    await db.delete(area)
    await db.commit()

    return {"message": "Farm area deleted"}


# Maintenance Routes
@router.get("/{area_id}/maintenance", response_model=List[MaintenanceResponse])
async def get_area_maintenance(area_id: int, active_only: bool = True, db: AsyncSession = Depends(get_db)):
    """Get maintenance tasks for a farm area"""
    query = select(FarmAreaMaintenance).where(FarmAreaMaintenance.area_id == area_id)

    if active_only:
        query = query.where(FarmAreaMaintenance.is_active == True)

    query = query.order_by(FarmAreaMaintenance.next_due.asc().nullsfirst())

    result = await db.execute(query)
    tasks = result.scalars().all()

    return [MaintenanceResponse(
        id=t.id,
        area_id=t.area_id,
        name=t.name,
        description=t.description,
        frequency_days=t.frequency_days,
        frequency_label=t.frequency_label,
        seasonal=t.seasonal,
        active_months=t.active_months,
        last_completed=t.last_completed,
        next_due=t.next_due,
        manual_due_date=t.manual_due_date,
        notify_channels=t.notify_channels or "dashboard,calendar",
        is_active=t.is_active,
        notes=t.notes,
        status=t.status,
        created_at=t.created_at,
        updated_at=t.updated_at
    ) for t in tasks]


@router.post("/{area_id}/maintenance", response_model=MaintenanceResponse)
async def create_area_maintenance(area_id: int, data: MaintenanceCreate, db: AsyncSession = Depends(get_db)):
    """Create maintenance task for a farm area"""
    result = await db.execute(select(FarmArea).where(FarmArea.id == area_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Farm area not found")

    task_data = data.model_dump()
    manual_due = task_data.pop('manual_due_date', None)
    last_completed = task_data.pop('last_completed', None)

    task = FarmAreaMaintenance(
        area_id=area_id,
        **task_data
    )

    # If last_completed was provided, set it and calculate next due
    if last_completed:
        task.last_completed = last_completed
        task.calculate_next_due()
    elif manual_due:
        task.set_manual_due_date(manual_due)

    db.add(task)
    await db.commit()
    await db.refresh(task)

    return MaintenanceResponse(
        id=task.id,
        area_id=task.area_id,
        name=task.name,
        description=task.description,
        frequency_days=task.frequency_days,
        frequency_label=task.frequency_label,
        seasonal=task.seasonal,
        active_months=task.active_months,
        last_completed=task.last_completed,
        next_due=task.next_due,
        manual_due_date=task.manual_due_date,
        notify_channels=task.notify_channels or "dashboard,calendar",
        is_active=task.is_active,
        notes=task.notes,
        status=task.status,
        created_at=task.created_at,
        updated_at=task.updated_at
    )


@router.put("/maintenance/{task_id}", response_model=MaintenanceResponse)
async def update_area_maintenance(task_id: int, data: MaintenanceUpdate, db: AsyncSession = Depends(get_db)):
    """Update a maintenance task"""
    result = await db.execute(
        select(FarmAreaMaintenance).where(FarmAreaMaintenance.id == task_id)
    )
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="Maintenance task not found")

    update_data = data.model_dump(exclude_unset=True)
    manual_due = update_data.pop('manual_due_date', None)
    last_completed = update_data.pop('last_completed', None)

    for key, value in update_data.items():
        setattr(task, key, value)

    # Handle last_completed update and recalculate next due
    if last_completed is not None:
        task.last_completed = last_completed
        task.calculate_next_due()
    elif manual_due is not None:
        task.set_manual_due_date(manual_due)

    await db.commit()
    await db.refresh(task)

    return MaintenanceResponse(
        id=task.id,
        area_id=task.area_id,
        name=task.name,
        description=task.description,
        frequency_days=task.frequency_days,
        frequency_label=task.frequency_label,
        seasonal=task.seasonal,
        active_months=task.active_months,
        last_completed=task.last_completed,
        next_due=task.next_due,
        manual_due_date=task.manual_due_date,
        notify_channels=task.notify_channels or "dashboard,calendar",
        is_active=task.is_active,
        notes=task.notes,
        status=task.status,
        created_at=task.created_at,
        updated_at=task.updated_at
    )


@router.delete("/maintenance/{task_id}")
async def delete_area_maintenance(task_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a maintenance task"""
    result = await db.execute(
        select(FarmAreaMaintenance).where(FarmAreaMaintenance.id == task_id)
    )
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="Maintenance task not found")

    await db.delete(task)
    await db.commit()

    return {"message": "Maintenance task deleted"}


@router.post("/maintenance/{task_id}/complete", response_model=MaintenanceResponse)
async def complete_area_maintenance(task_id: int, data: LogCreate, db: AsyncSession = Depends(get_db)):
    """Mark maintenance as complete"""
    result = await db.execute(
        select(FarmAreaMaintenance).where(FarmAreaMaintenance.id == task_id)
    )
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="Maintenance task not found")

    performed_at = data.performed_at or datetime.utcnow()

    # Create log entry
    log = FarmAreaMaintenanceLog(
        area_id=task.area_id,
        maintenance_id=task_id,
        name=task.name,
        performed_at=performed_at,
        cost=data.cost,
        notes=data.notes
    )
    db.add(log)

    # Update task
    task.last_completed = performed_at
    task.calculate_next_due()

    await db.commit()
    await db.refresh(task)

    return MaintenanceResponse(
        id=task.id,
        area_id=task.area_id,
        name=task.name,
        description=task.description,
        frequency_days=task.frequency_days,
        frequency_label=task.frequency_label,
        seasonal=task.seasonal,
        active_months=task.active_months,
        last_completed=task.last_completed,
        next_due=task.next_due,
        manual_due_date=task.manual_due_date,
        notify_channels=task.notify_channels or "dashboard,calendar",
        is_active=task.is_active,
        notes=task.notes,
        status=task.status,
        created_at=task.created_at,
        updated_at=task.updated_at
    )


@router.put("/maintenance/{task_id}/due-date", response_model=MaintenanceResponse)
async def set_area_maintenance_due_date(task_id: int, data: SetDueDateRequest, db: AsyncSession = Depends(get_db)):
    """Set a manual due date for a maintenance task"""
    result = await db.execute(
        select(FarmAreaMaintenance).where(FarmAreaMaintenance.id == task_id)
    )
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="Maintenance task not found")

    task.set_manual_due_date(data.due_date)

    await db.commit()
    await db.refresh(task)

    return MaintenanceResponse(
        id=task.id,
        area_id=task.area_id,
        name=task.name,
        description=task.description,
        frequency_days=task.frequency_days,
        frequency_label=task.frequency_label,
        seasonal=task.seasonal,
        active_months=task.active_months,
        last_completed=task.last_completed,
        next_due=task.next_due,
        manual_due_date=task.manual_due_date,
        notify_channels=task.notify_channels or "dashboard,calendar",
        is_active=task.is_active,
        notes=task.notes,
        status=task.status,
        created_at=task.created_at,
        updated_at=task.updated_at
    )


@router.get("/{area_id}/logs", response_model=List[LogResponse])
async def get_area_logs(area_id: int, db: AsyncSession = Depends(get_db)):
    """Get maintenance logs for a farm area"""
    result = await db.execute(
        select(FarmAreaMaintenanceLog)
        .where(FarmAreaMaintenanceLog.area_id == area_id)
        .order_by(FarmAreaMaintenanceLog.performed_at.desc())
    )
    logs = result.scalars().all()

    return [LogResponse(
        id=log.id,
        area_id=log.area_id,
        maintenance_id=log.maintenance_id,
        name=log.name,
        performed_at=log.performed_at,
        cost=log.cost,
        notes=log.notes,
        created_at=log.created_at
    ) for log in logs]


@router.get("/types/list")
async def get_area_types():
    """Get all farm area types"""
    return [{"value": t.value, "label": t.value.replace("_", " ").title()} for t in FarmAreaType]
