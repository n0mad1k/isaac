"""
Home Maintenance API Routes
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel, Field

from models.database import get_db
from models.home_maintenance import HomeMaintenance, HomeMaintenanceLog, HomeMaintenanceCategory


router = APIRouter(prefix="/home-maintenance", tags=["Home Maintenance"])


# Pydantic Schemas
class MaintenanceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    category: HomeMaintenanceCategory = HomeMaintenanceCategory.GENERAL
    description: Optional[str] = Field(None, max_length=1000)
    frequency_days: Optional[int] = Field(None, ge=1, le=3650)  # Now optional - can use manual_due_date instead
    frequency_label: Optional[str] = Field(None, max_length=50)
    last_completed: Optional[datetime] = None  # When was this last done
    manual_due_date: Optional[datetime] = None
    notify_channels: str = Field("dashboard,calendar", max_length=100)
    notes: Optional[str] = Field(None, max_length=2000)


class MaintenanceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    category: Optional[HomeMaintenanceCategory] = None
    description: Optional[str] = Field(None, max_length=1000)
    frequency_days: Optional[int] = Field(None, ge=1, le=3650)
    frequency_label: Optional[str] = Field(None, max_length=50)
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


class MaintenanceResponse(BaseModel):
    id: int
    name: str
    category: HomeMaintenanceCategory
    description: Optional[str]
    frequency_days: Optional[int]
    frequency_label: Optional[str]
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
    maintenance_id: int
    performed_at: datetime
    notes: Optional[str]
    cost: Optional[float]
    created_at: datetime

    class Config:
        from_attributes = True


# Routes
@router.get("/", response_model=List[MaintenanceResponse])
async def get_all_maintenance(
    category: Optional[HomeMaintenanceCategory] = None,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db)
):
    """Get all home maintenance tasks"""
    query = select(HomeMaintenance)

    if category:
        query = query.where(HomeMaintenance.category == category)
    if active_only:
        query = query.where(HomeMaintenance.is_active == True)

    query = query.order_by(HomeMaintenance.next_due.asc().nullsfirst())

    result = await db.execute(query)
    tasks = result.scalars().all()

    return [MaintenanceResponse(
        id=t.id,
        name=t.name,
        category=t.category,
        description=t.description,
        frequency_days=t.frequency_days,
        frequency_label=t.frequency_label,
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


@router.get("/{task_id}", response_model=MaintenanceResponse)
async def get_maintenance(task_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific maintenance task"""
    result = await db.execute(
        select(HomeMaintenance).where(HomeMaintenance.id == task_id)
    )
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="Maintenance task not found")

    return MaintenanceResponse(
        id=task.id,
        name=task.name,
        category=task.category,
        description=task.description,
        frequency_days=task.frequency_days,
        frequency_label=task.frequency_label,
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


@router.post("/", response_model=MaintenanceResponse)
async def create_maintenance(data: MaintenanceCreate, db: AsyncSession = Depends(get_db)):
    """Create a new maintenance task"""
    task = HomeMaintenance(
        name=data.name,
        category=data.category,
        description=data.description,
        frequency_days=data.frequency_days,
        frequency_label=data.frequency_label,
        notify_channels=data.notify_channels,
        notes=data.notes
    )

    # If last_completed was provided, set it and calculate next due
    if data.last_completed:
        task.last_completed = data.last_completed
        task.calculate_next_due()
    # If manual due date was provided, set it
    elif data.manual_due_date:
        task.set_manual_due_date(data.manual_due_date)

    db.add(task)
    await db.commit()
    await db.refresh(task)

    return MaintenanceResponse(
        id=task.id,
        name=task.name,
        category=task.category,
        description=task.description,
        frequency_days=task.frequency_days,
        frequency_label=task.frequency_label,
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


@router.put("/{task_id}", response_model=MaintenanceResponse)
async def update_maintenance(task_id: int, data: MaintenanceUpdate, db: AsyncSession = Depends(get_db)):
    """Update a maintenance task"""
    result = await db.execute(
        select(HomeMaintenance).where(HomeMaintenance.id == task_id)
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
        name=task.name,
        category=task.category,
        description=task.description,
        frequency_days=task.frequency_days,
        frequency_label=task.frequency_label,
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


@router.delete("/{task_id}")
async def delete_maintenance(task_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a maintenance task"""
    result = await db.execute(
        select(HomeMaintenance).where(HomeMaintenance.id == task_id)
    )
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="Maintenance task not found")

    await db.delete(task)
    await db.commit()

    return {"message": "Maintenance task deleted"}


@router.post("/{task_id}/complete", response_model=MaintenanceResponse)
async def complete_maintenance(task_id: int, data: LogCreate, db: AsyncSession = Depends(get_db)):
    """Mark a maintenance task as complete and log it"""
    result = await db.execute(
        select(HomeMaintenance).where(HomeMaintenance.id == task_id)
    )
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="Maintenance task not found")

    # Create log entry
    performed_at = data.performed_at or datetime.utcnow()
    log = HomeMaintenanceLog(
        maintenance_id=task_id,
        performed_at=performed_at,
        notes=data.notes,
        cost=data.cost
    )
    db.add(log)

    # Update task
    task.last_completed = performed_at
    task.calculate_next_due()

    await db.commit()
    await db.refresh(task)

    return MaintenanceResponse(
        id=task.id,
        name=task.name,
        category=task.category,
        description=task.description,
        frequency_days=task.frequency_days,
        frequency_label=task.frequency_label,
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


@router.put("/{task_id}/due-date", response_model=MaintenanceResponse)
async def set_maintenance_due_date(task_id: int, data: SetDueDateRequest, db: AsyncSession = Depends(get_db)):
    """Set a manual due date for a maintenance task"""
    result = await db.execute(
        select(HomeMaintenance).where(HomeMaintenance.id == task_id)
    )
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="Maintenance task not found")

    task.set_manual_due_date(data.due_date)

    await db.commit()
    await db.refresh(task)

    return MaintenanceResponse(
        id=task.id,
        name=task.name,
        category=task.category,
        description=task.description,
        frequency_days=task.frequency_days,
        frequency_label=task.frequency_label,
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


@router.get("/{task_id}/logs", response_model=List[LogResponse])
async def get_maintenance_logs(task_id: int, db: AsyncSession = Depends(get_db)):
    """Get logs for a maintenance task"""
    result = await db.execute(
        select(HomeMaintenanceLog)
        .where(HomeMaintenanceLog.maintenance_id == task_id)
        .order_by(HomeMaintenanceLog.performed_at.desc())
    )
    logs = result.scalars().all()

    return [LogResponse(
        id=log.id,
        maintenance_id=log.maintenance_id,
        performed_at=log.performed_at,
        notes=log.notes,
        cost=log.cost,
        created_at=log.created_at
    ) for log in logs]


@router.get("/categories/list")
async def get_categories():
    """Get all available categories"""
    return [{"value": c.value, "label": c.value.replace("_", " ").title()} for c in HomeMaintenanceCategory]
