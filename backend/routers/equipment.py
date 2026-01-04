"""
Equipment/Tools API Routes
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, date, timedelta
from pydantic import BaseModel, Field

from models.database import get_db
from models.equipment import Equipment, EquipmentMaintenance, EquipmentMaintenanceLog, EquipmentType


router = APIRouter(prefix="/equipment", tags=["Equipment"])


# Pydantic Schemas
class EquipmentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    type: EquipmentType
    custom_type: Optional[str] = Field(None, max_length=50)
    make: Optional[str] = Field(None, max_length=100)
    model: Optional[str] = Field(None, max_length=100)
    year: Optional[int] = Field(None, ge=1900, le=2100)
    serial_number: Optional[str] = Field(None, max_length=100)
    purchase_date: Optional[date] = None
    purchase_price: Optional[float] = Field(None, ge=0, le=10000000)
    current_hours: int = Field(0, ge=0, le=1000000)
    notes: Optional[str] = Field(None, max_length=5000)
    image_url: Optional[str] = Field(None, max_length=500)


class EquipmentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    type: Optional[EquipmentType] = None
    custom_type: Optional[str] = Field(None, max_length=50)
    make: Optional[str] = Field(None, max_length=100)
    model: Optional[str] = Field(None, max_length=100)
    year: Optional[int] = Field(None, ge=1900, le=2100)
    serial_number: Optional[str] = Field(None, max_length=100)
    purchase_date: Optional[date] = None
    purchase_price: Optional[float] = Field(None, ge=0, le=10000000)
    current_hours: Optional[int] = Field(None, ge=0, le=1000000)
    notes: Optional[str] = Field(None, max_length=5000)
    image_url: Optional[str] = Field(None, max_length=500)
    is_active: Optional[bool] = None


class MaintenanceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=1000)
    frequency_hours: Optional[int] = Field(None, ge=1, le=100000)
    frequency_days: Optional[int] = Field(None, ge=1, le=3650)
    last_completed: Optional[datetime] = None  # When was this last done
    last_hours: Optional[int] = Field(None, ge=0, le=1000000)
    manual_due_date: Optional[datetime] = None
    notify_channels: str = Field("dashboard,calendar", max_length=100)
    notes: Optional[str] = Field(None, max_length=2000)


class MaintenanceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=1000)
    frequency_hours: Optional[int] = Field(None, ge=1, le=100000)
    frequency_days: Optional[int] = Field(None, ge=1, le=3650)
    last_completed: Optional[datetime] = None  # When was this last done
    last_hours: Optional[int] = Field(None, ge=0, le=1000000)
    manual_due_date: Optional[datetime] = None
    notify_channels: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=2000)
    is_active: Optional[bool] = None


class SetDueDateRequest(BaseModel):
    due_date: datetime


class LogCreate(BaseModel):
    hours_at: Optional[int] = Field(None, ge=0, le=1000000)
    cost: Optional[float] = Field(None, ge=0, le=1000000)
    notes: Optional[str] = Field(None, max_length=2000)
    performed_at: Optional[datetime] = None


class EquipmentResponse(BaseModel):
    id: int
    name: str
    type: EquipmentType
    custom_type: Optional[str]
    display_type: str
    make: Optional[str]
    model: Optional[str]
    year: Optional[int]
    serial_number: Optional[str]
    purchase_date: Optional[date]
    purchase_price: Optional[float]
    current_hours: int
    is_active: bool
    notes: Optional[str]
    image_url: Optional[str]
    created_at: datetime
    updated_at: datetime
    maintenance_count: int = 0
    overdue_count: int = 0

    class Config:
        from_attributes = True


class MaintenanceResponse(BaseModel):
    id: int
    equipment_id: int
    name: str
    description: Optional[str]
    frequency_hours: Optional[int]
    frequency_days: Optional[int]
    last_completed: Optional[datetime]
    last_hours: Optional[int]
    next_due_date: Optional[datetime]
    next_due_hours: Optional[int]
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
    equipment_id: int
    maintenance_id: Optional[int]
    name: Optional[str]
    performed_at: datetime
    hours_at: Optional[int]
    cost: Optional[float]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# Equipment Routes
@router.get("/", response_model=List[EquipmentResponse])
async def get_all_equipment(
    type: Optional[EquipmentType] = None,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db)
):
    """Get all equipment"""
    query = select(Equipment).options(selectinload(Equipment.maintenance_tasks))

    if type:
        query = query.where(Equipment.type == type)
    if active_only:
        query = query.where(Equipment.is_active == True)

    query = query.order_by(Equipment.name)

    result = await db.execute(query)
    items = result.scalars().all()

    return [EquipmentResponse(
        id=e.id,
        name=e.name,
        type=e.type,
        custom_type=e.custom_type,
        display_type=e.display_type,
        make=e.make,
        model=e.model,
        year=e.year,
        serial_number=e.serial_number,
        purchase_date=e.purchase_date,
        purchase_price=e.purchase_price,
        current_hours=e.current_hours,
        is_active=e.is_active,
        notes=e.notes,
        image_url=e.image_url,
        created_at=e.created_at,
        updated_at=e.updated_at,
        maintenance_count=len(e.maintenance_tasks),
        overdue_count=sum(1 for m in e.maintenance_tasks if m.status == "overdue")
    ) for e in items]


@router.get("/{equipment_id}", response_model=EquipmentResponse)
async def get_equipment(equipment_id: int, db: AsyncSession = Depends(get_db)):
    """Get specific equipment"""
    result = await db.execute(
        select(Equipment)
        .options(selectinload(Equipment.maintenance_tasks))
        .where(Equipment.id == equipment_id)
    )
    equipment = result.scalar_one_or_none()

    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")

    return EquipmentResponse(
        id=equipment.id,
        name=equipment.name,
        type=equipment.type,
        custom_type=equipment.custom_type,
        display_type=equipment.display_type,
        make=equipment.make,
        model=equipment.model,
        year=equipment.year,
        serial_number=equipment.serial_number,
        purchase_date=equipment.purchase_date,
        purchase_price=equipment.purchase_price,
        current_hours=equipment.current_hours,
        is_active=equipment.is_active,
        notes=equipment.notes,
        image_url=equipment.image_url,
        created_at=equipment.created_at,
        updated_at=equipment.updated_at,
        maintenance_count=len(equipment.maintenance_tasks),
        overdue_count=sum(1 for m in equipment.maintenance_tasks if m.status == "overdue")
    )


@router.post("/", response_model=EquipmentResponse)
async def create_equipment(data: EquipmentCreate, db: AsyncSession = Depends(get_db)):
    """Create new equipment"""
    equipment = Equipment(**data.model_dump())

    db.add(equipment)
    await db.commit()
    await db.refresh(equipment)

    return EquipmentResponse(
        id=equipment.id,
        name=equipment.name,
        type=equipment.type,
        custom_type=equipment.custom_type,
        display_type=equipment.display_type,
        make=equipment.make,
        model=equipment.model,
        year=equipment.year,
        serial_number=equipment.serial_number,
        purchase_date=equipment.purchase_date,
        purchase_price=equipment.purchase_price,
        current_hours=equipment.current_hours,
        is_active=equipment.is_active,
        notes=equipment.notes,
        image_url=equipment.image_url,
        created_at=equipment.created_at,
        updated_at=equipment.updated_at,
        maintenance_count=0,
        overdue_count=0
    )


@router.put("/{equipment_id}", response_model=EquipmentResponse)
async def update_equipment(equipment_id: int, data: EquipmentUpdate, db: AsyncSession = Depends(get_db)):
    """Update equipment"""
    result = await db.execute(
        select(Equipment)
        .options(selectinload(Equipment.maintenance_tasks))
        .where(Equipment.id == equipment_id)
    )
    equipment = result.scalar_one_or_none()

    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(equipment, key, value)

    await db.commit()
    await db.refresh(equipment)

    return EquipmentResponse(
        id=equipment.id,
        name=equipment.name,
        type=equipment.type,
        custom_type=equipment.custom_type,
        display_type=equipment.display_type,
        make=equipment.make,
        model=equipment.model,
        year=equipment.year,
        serial_number=equipment.serial_number,
        purchase_date=equipment.purchase_date,
        purchase_price=equipment.purchase_price,
        current_hours=equipment.current_hours,
        is_active=equipment.is_active,
        notes=equipment.notes,
        image_url=equipment.image_url,
        created_at=equipment.created_at,
        updated_at=equipment.updated_at,
        maintenance_count=len(equipment.maintenance_tasks),
        overdue_count=sum(1 for m in equipment.maintenance_tasks if m.status == "overdue")
    )


@router.delete("/{equipment_id}")
async def delete_equipment(equipment_id: int, db: AsyncSession = Depends(get_db)):
    """Delete equipment"""
    result = await db.execute(
        select(Equipment).where(Equipment.id == equipment_id)
    )
    equipment = result.scalar_one_or_none()

    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")

    await db.delete(equipment)
    await db.commit()

    return {"message": "Equipment deleted"}


@router.put("/{equipment_id}/hours")
async def update_hours(equipment_id: int, hours: int, db: AsyncSession = Depends(get_db)):
    """Update equipment hours"""
    result = await db.execute(
        select(Equipment).where(Equipment.id == equipment_id)
    )
    equipment = result.scalar_one_or_none()

    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")

    equipment.current_hours = hours
    await db.commit()

    return {"message": "Hours updated", "current_hours": hours}


# Maintenance Routes
@router.get("/{equipment_id}/maintenance", response_model=List[MaintenanceResponse])
async def get_equipment_maintenance(equipment_id: int, active_only: bool = True, db: AsyncSession = Depends(get_db)):
    """Get maintenance tasks for equipment"""
    query = select(EquipmentMaintenance).where(EquipmentMaintenance.equipment_id == equipment_id)

    if active_only:
        query = query.where(EquipmentMaintenance.is_active == True)

    query = query.order_by(EquipmentMaintenance.next_due_date.asc().nullsfirst())

    result = await db.execute(query)
    tasks = result.scalars().all()

    return [MaintenanceResponse(
        id=t.id,
        equipment_id=t.equipment_id,
        name=t.name,
        description=t.description,
        frequency_hours=t.frequency_hours,
        frequency_days=t.frequency_days,
        last_completed=t.last_completed,
        last_hours=t.last_hours,
        next_due_date=t.next_due_date,
        next_due_hours=t.next_due_hours,
        manual_due_date=t.manual_due_date,
        notify_channels=t.notify_channels or "dashboard,calendar",
        is_active=t.is_active,
        notes=t.notes,
        status=t.status,
        created_at=t.created_at,
        updated_at=t.updated_at
    ) for t in tasks]


@router.post("/{equipment_id}/maintenance", response_model=MaintenanceResponse)
async def create_equipment_maintenance(equipment_id: int, data: MaintenanceCreate, db: AsyncSession = Depends(get_db)):
    """Create maintenance task for equipment"""
    result = await db.execute(select(Equipment).where(Equipment.id == equipment_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Equipment not found")

    task_data = data.model_dump()
    manual_due = task_data.pop('manual_due_date', None)
    last_completed = task_data.pop('last_completed', None)
    last_hours = task_data.pop('last_hours', None)

    task = EquipmentMaintenance(
        equipment_id=equipment_id,
        **task_data
    )

    # If last_completed was provided, set it and calculate next due
    if last_completed:
        task.last_completed = last_completed
        task.last_hours = last_hours
        task.calculate_next_due()
    elif manual_due:
        task.set_manual_due_date(manual_due)

    db.add(task)
    await db.commit()
    await db.refresh(task)

    return MaintenanceResponse(
        id=task.id,
        equipment_id=task.equipment_id,
        name=task.name,
        description=task.description,
        frequency_hours=task.frequency_hours,
        frequency_days=task.frequency_days,
        last_completed=task.last_completed,
        last_hours=task.last_hours,
        next_due_date=task.next_due_date,
        next_due_hours=task.next_due_hours,
        manual_due_date=task.manual_due_date,
        notify_channels=task.notify_channels or "dashboard,calendar",
        is_active=task.is_active,
        notes=task.notes,
        status=task.status,
        created_at=task.created_at,
        updated_at=task.updated_at
    )


@router.put("/maintenance/{task_id}", response_model=MaintenanceResponse)
async def update_equipment_maintenance(task_id: int, data: MaintenanceUpdate, db: AsyncSession = Depends(get_db)):
    """Update maintenance task"""
    result = await db.execute(
        select(EquipmentMaintenance).where(EquipmentMaintenance.id == task_id)
    )
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="Maintenance task not found")

    update_data = data.model_dump(exclude_unset=True)
    manual_due = update_data.pop('manual_due_date', None)
    last_completed = update_data.pop('last_completed', None)
    last_hours = update_data.pop('last_hours', None)

    for key, value in update_data.items():
        setattr(task, key, value)

    # Handle last_completed update and recalculate next due
    if last_completed is not None:
        task.last_completed = last_completed
        if last_hours is not None:
            task.last_hours = last_hours
        task.calculate_next_due()
    elif manual_due is not None:
        task.set_manual_due_date(manual_due)

    await db.commit()
    await db.refresh(task)

    return MaintenanceResponse(
        id=task.id,
        equipment_id=task.equipment_id,
        name=task.name,
        description=task.description,
        frequency_hours=task.frequency_hours,
        frequency_days=task.frequency_days,
        last_completed=task.last_completed,
        last_hours=task.last_hours,
        next_due_date=task.next_due_date,
        next_due_hours=task.next_due_hours,
        manual_due_date=task.manual_due_date,
        notify_channels=task.notify_channels or "dashboard,calendar",
        is_active=task.is_active,
        notes=task.notes,
        status=task.status,
        created_at=task.created_at,
        updated_at=task.updated_at
    )


@router.delete("/maintenance/{task_id}")
async def delete_equipment_maintenance(task_id: int, db: AsyncSession = Depends(get_db)):
    """Delete maintenance task"""
    result = await db.execute(
        select(EquipmentMaintenance).where(EquipmentMaintenance.id == task_id)
    )
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="Maintenance task not found")

    await db.delete(task)
    await db.commit()

    return {"message": "Maintenance task deleted"}


@router.post("/maintenance/{task_id}/complete", response_model=MaintenanceResponse)
async def complete_equipment_maintenance(task_id: int, data: LogCreate, db: AsyncSession = Depends(get_db)):
    """Mark maintenance as complete"""
    result = await db.execute(
        select(EquipmentMaintenance).where(EquipmentMaintenance.id == task_id)
    )
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="Maintenance task not found")

    performed_at = data.performed_at or datetime.utcnow()

    # Create log entry
    log = EquipmentMaintenanceLog(
        equipment_id=task.equipment_id,
        maintenance_id=task_id,
        name=task.name,
        performed_at=performed_at,
        hours_at=data.hours_at,
        cost=data.cost,
        notes=data.notes
    )
    db.add(log)

    # Update task
    task.last_completed = performed_at
    task.last_hours = data.hours_at
    task.calculate_next_due()

    # Update equipment hours if provided
    if data.hours_at:
        result = await db.execute(select(Equipment).where(Equipment.id == task.equipment_id))
        equipment = result.scalar_one_or_none()
        if equipment and data.hours_at > equipment.current_hours:
            equipment.current_hours = data.hours_at

    await db.commit()
    await db.refresh(task)

    return MaintenanceResponse(
        id=task.id,
        equipment_id=task.equipment_id,
        name=task.name,
        description=task.description,
        frequency_hours=task.frequency_hours,
        frequency_days=task.frequency_days,
        last_completed=task.last_completed,
        last_hours=task.last_hours,
        next_due_date=task.next_due_date,
        next_due_hours=task.next_due_hours,
        manual_due_date=task.manual_due_date,
        notify_channels=task.notify_channels or "dashboard,calendar",
        is_active=task.is_active,
        notes=task.notes,
        status=task.status,
        created_at=task.created_at,
        updated_at=task.updated_at
    )


@router.put("/maintenance/{task_id}/due-date", response_model=MaintenanceResponse)
async def set_equipment_maintenance_due_date(task_id: int, data: SetDueDateRequest, db: AsyncSession = Depends(get_db)):
    """Set a manual due date for a maintenance task"""
    result = await db.execute(
        select(EquipmentMaintenance).where(EquipmentMaintenance.id == task_id)
    )
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="Maintenance task not found")

    task.set_manual_due_date(data.due_date)

    await db.commit()
    await db.refresh(task)

    return MaintenanceResponse(
        id=task.id,
        equipment_id=task.equipment_id,
        name=task.name,
        description=task.description,
        frequency_hours=task.frequency_hours,
        frequency_days=task.frequency_days,
        last_completed=task.last_completed,
        last_hours=task.last_hours,
        next_due_date=task.next_due_date,
        next_due_hours=task.next_due_hours,
        manual_due_date=task.manual_due_date,
        notify_channels=task.notify_channels or "dashboard,calendar",
        is_active=task.is_active,
        notes=task.notes,
        status=task.status,
        created_at=task.created_at,
        updated_at=task.updated_at
    )


@router.get("/{equipment_id}/logs", response_model=List[LogResponse])
async def get_equipment_logs(equipment_id: int, db: AsyncSession = Depends(get_db)):
    """Get maintenance logs for equipment"""
    result = await db.execute(
        select(EquipmentMaintenanceLog)
        .where(EquipmentMaintenanceLog.equipment_id == equipment_id)
        .order_by(EquipmentMaintenanceLog.performed_at.desc())
    )
    logs = result.scalars().all()

    return [LogResponse(
        id=log.id,
        equipment_id=log.equipment_id,
        maintenance_id=log.maintenance_id,
        name=log.name,
        performed_at=log.performed_at,
        hours_at=log.hours_at,
        cost=log.cost,
        notes=log.notes,
        created_at=log.created_at
    ) for log in logs]


@router.get("/types/list")
async def get_equipment_types():
    """Get all equipment types"""
    return [{"value": t.value, "label": t.value.replace("_", " ").title()} for t in EquipmentType]
