"""
Home Maintenance API Routes
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel

from models.database import get_db
from models.home_maintenance import HomeMaintenance, HomeMaintenanceLog, HomeMaintenanceCategory


router = APIRouter(prefix="/home-maintenance", tags=["Home Maintenance"])


# Pydantic Schemas
class MaintenanceCreate(BaseModel):
    name: str
    category: HomeMaintenanceCategory = HomeMaintenanceCategory.GENERAL
    description: Optional[str] = None
    frequency_days: int
    frequency_label: Optional[str] = None
    notify_channels: str = "dashboard,calendar"
    notes: Optional[str] = None


class MaintenanceUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[HomeMaintenanceCategory] = None
    description: Optional[str] = None
    frequency_days: Optional[int] = None
    frequency_label: Optional[str] = None
    notify_channels: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class LogCreate(BaseModel):
    notes: Optional[str] = None
    cost: Optional[float] = None
    performed_at: Optional[datetime] = None


class MaintenanceResponse(BaseModel):
    id: int
    name: str
    category: HomeMaintenanceCategory
    description: Optional[str]
    frequency_days: int
    frequency_label: Optional[str]
    last_completed: Optional[datetime]
    next_due: Optional[datetime]
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
    for key, value in update_data.items():
        setattr(task, key, value)

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
