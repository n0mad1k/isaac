"""
Vehicles API Routes
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, date, timedelta
from pydantic import BaseModel

from models.database import get_db
from models.vehicles import Vehicle, VehicleMaintenance, VehicleMaintenanceLog, VehicleType


router = APIRouter(prefix="/vehicles", tags=["Vehicles"])


# Pydantic Schemas
class VehicleCreate(BaseModel):
    name: str
    type: VehicleType
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    vin: Optional[str] = None
    license_plate: Optional[str] = None
    color: Optional[str] = None
    purchase_date: Optional[date] = None
    purchase_price: Optional[float] = None
    current_mileage: int = 0
    current_hours: int = 0
    notes: Optional[str] = None
    image_url: Optional[str] = None


class VehicleUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[VehicleType] = None
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    vin: Optional[str] = None
    license_plate: Optional[str] = None
    color: Optional[str] = None
    purchase_date: Optional[date] = None
    purchase_price: Optional[float] = None
    current_mileage: Optional[int] = None
    current_hours: Optional[int] = None
    notes: Optional[str] = None
    image_url: Optional[str] = None
    is_active: Optional[bool] = None


class MaintenanceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    frequency_miles: Optional[int] = None
    frequency_hours: Optional[int] = None
    frequency_days: Optional[int] = None
    notify_channels: str = "dashboard,calendar"
    notes: Optional[str] = None


class MaintenanceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    frequency_miles: Optional[int] = None
    frequency_hours: Optional[int] = None
    frequency_days: Optional[int] = None
    notify_channels: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class LogCreate(BaseModel):
    mileage_at: Optional[int] = None
    hours_at: Optional[int] = None
    cost: Optional[float] = None
    notes: Optional[str] = None
    performed_at: Optional[datetime] = None


class VehicleResponse(BaseModel):
    id: int
    name: str
    type: VehicleType
    make: Optional[str]
    model: Optional[str]
    year: Optional[int]
    vin: Optional[str]
    license_plate: Optional[str]
    color: Optional[str]
    purchase_date: Optional[date]
    purchase_price: Optional[float]
    current_mileage: int
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
    vehicle_id: int
    name: str
    description: Optional[str]
    frequency_miles: Optional[int]
    frequency_hours: Optional[int]
    frequency_days: Optional[int]
    last_completed: Optional[datetime]
    last_mileage: Optional[int]
    last_hours: Optional[int]
    next_due_date: Optional[datetime]
    next_due_mileage: Optional[int]
    next_due_hours: Optional[int]
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
    vehicle_id: int
    maintenance_id: Optional[int]
    name: Optional[str]
    performed_at: datetime
    mileage_at: Optional[int]
    hours_at: Optional[int]
    cost: Optional[float]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# Vehicle Routes
@router.get("/", response_model=List[VehicleResponse])
async def get_all_vehicles(
    type: Optional[VehicleType] = None,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db)
):
    """Get all vehicles"""
    query = select(Vehicle).options(selectinload(Vehicle.maintenance_tasks))

    if type:
        query = query.where(Vehicle.type == type)
    if active_only:
        query = query.where(Vehicle.is_active == True)

    query = query.order_by(Vehicle.name)

    result = await db.execute(query)
    vehicles = result.scalars().all()

    return [VehicleResponse(
        id=v.id,
        name=v.name,
        type=v.type,
        make=v.make,
        model=v.model,
        year=v.year,
        vin=v.vin,
        license_plate=v.license_plate,
        color=v.color,
        purchase_date=v.purchase_date,
        purchase_price=v.purchase_price,
        current_mileage=v.current_mileage,
        current_hours=v.current_hours,
        is_active=v.is_active,
        notes=v.notes,
        image_url=v.image_url,
        created_at=v.created_at,
        updated_at=v.updated_at,
        maintenance_count=len(v.maintenance_tasks),
        overdue_count=sum(1 for m in v.maintenance_tasks if m.status == "overdue")
    ) for v in vehicles]


@router.get("/{vehicle_id}", response_model=VehicleResponse)
async def get_vehicle(vehicle_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific vehicle"""
    result = await db.execute(
        select(Vehicle)
        .options(selectinload(Vehicle.maintenance_tasks))
        .where(Vehicle.id == vehicle_id)
    )
    vehicle = result.scalar_one_or_none()

    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    return VehicleResponse(
        id=vehicle.id,
        name=vehicle.name,
        type=vehicle.type,
        make=vehicle.make,
        model=vehicle.model,
        year=vehicle.year,
        vin=vehicle.vin,
        license_plate=vehicle.license_plate,
        color=vehicle.color,
        purchase_date=vehicle.purchase_date,
        purchase_price=vehicle.purchase_price,
        current_mileage=vehicle.current_mileage,
        current_hours=vehicle.current_hours,
        is_active=vehicle.is_active,
        notes=vehicle.notes,
        image_url=vehicle.image_url,
        created_at=vehicle.created_at,
        updated_at=vehicle.updated_at,
        maintenance_count=len(vehicle.maintenance_tasks),
        overdue_count=sum(1 for m in vehicle.maintenance_tasks if m.status == "overdue")
    )


@router.post("/", response_model=VehicleResponse)
async def create_vehicle(data: VehicleCreate, db: AsyncSession = Depends(get_db)):
    """Create a new vehicle"""
    vehicle = Vehicle(**data.model_dump())

    db.add(vehicle)
    await db.commit()
    await db.refresh(vehicle)

    return VehicleResponse(
        id=vehicle.id,
        name=vehicle.name,
        type=vehicle.type,
        make=vehicle.make,
        model=vehicle.model,
        year=vehicle.year,
        vin=vehicle.vin,
        license_plate=vehicle.license_plate,
        color=vehicle.color,
        purchase_date=vehicle.purchase_date,
        purchase_price=vehicle.purchase_price,
        current_mileage=vehicle.current_mileage,
        current_hours=vehicle.current_hours,
        is_active=vehicle.is_active,
        notes=vehicle.notes,
        image_url=vehicle.image_url,
        created_at=vehicle.created_at,
        updated_at=vehicle.updated_at,
        maintenance_count=0,
        overdue_count=0
    )


@router.put("/{vehicle_id}", response_model=VehicleResponse)
async def update_vehicle(vehicle_id: int, data: VehicleUpdate, db: AsyncSession = Depends(get_db)):
    """Update a vehicle"""
    result = await db.execute(
        select(Vehicle)
        .options(selectinload(Vehicle.maintenance_tasks))
        .where(Vehicle.id == vehicle_id)
    )
    vehicle = result.scalar_one_or_none()

    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(vehicle, key, value)

    await db.commit()
    await db.refresh(vehicle)

    return VehicleResponse(
        id=vehicle.id,
        name=vehicle.name,
        type=vehicle.type,
        make=vehicle.make,
        model=vehicle.model,
        year=vehicle.year,
        vin=vehicle.vin,
        license_plate=vehicle.license_plate,
        color=vehicle.color,
        purchase_date=vehicle.purchase_date,
        purchase_price=vehicle.purchase_price,
        current_mileage=vehicle.current_mileage,
        current_hours=vehicle.current_hours,
        is_active=vehicle.is_active,
        notes=vehicle.notes,
        image_url=vehicle.image_url,
        created_at=vehicle.created_at,
        updated_at=vehicle.updated_at,
        maintenance_count=len(vehicle.maintenance_tasks),
        overdue_count=sum(1 for m in vehicle.maintenance_tasks if m.status == "overdue")
    )


@router.delete("/{vehicle_id}")
async def delete_vehicle(vehicle_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a vehicle"""
    result = await db.execute(
        select(Vehicle).where(Vehicle.id == vehicle_id)
    )
    vehicle = result.scalar_one_or_none()

    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    await db.delete(vehicle)
    await db.commit()

    return {"message": "Vehicle deleted"}


@router.put("/{vehicle_id}/mileage")
async def update_mileage(vehicle_id: int, mileage: int, hours: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    """Update vehicle mileage/hours"""
    result = await db.execute(
        select(Vehicle).where(Vehicle.id == vehicle_id)
    )
    vehicle = result.scalar_one_or_none()

    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    vehicle.current_mileage = mileage
    if hours is not None:
        vehicle.current_hours = hours

    await db.commit()
    return {"message": "Mileage updated", "current_mileage": mileage, "current_hours": vehicle.current_hours}


# Maintenance Routes
@router.get("/{vehicle_id}/maintenance", response_model=List[MaintenanceResponse])
async def get_vehicle_maintenance(vehicle_id: int, active_only: bool = True, db: AsyncSession = Depends(get_db)):
    """Get maintenance tasks for a vehicle"""
    query = select(VehicleMaintenance).where(VehicleMaintenance.vehicle_id == vehicle_id)

    if active_only:
        query = query.where(VehicleMaintenance.is_active == True)

    query = query.order_by(VehicleMaintenance.next_due_date.asc().nullsfirst())

    result = await db.execute(query)
    tasks = result.scalars().all()

    return [MaintenanceResponse(
        id=t.id,
        vehicle_id=t.vehicle_id,
        name=t.name,
        description=t.description,
        frequency_miles=t.frequency_miles,
        frequency_hours=t.frequency_hours,
        frequency_days=t.frequency_days,
        last_completed=t.last_completed,
        last_mileage=t.last_mileage,
        last_hours=t.last_hours,
        next_due_date=t.next_due_date,
        next_due_mileage=t.next_due_mileage,
        next_due_hours=t.next_due_hours,
        notify_channels=t.notify_channels or "dashboard,calendar",
        is_active=t.is_active,
        notes=t.notes,
        status=t.status,
        created_at=t.created_at,
        updated_at=t.updated_at
    ) for t in tasks]


@router.post("/{vehicle_id}/maintenance", response_model=MaintenanceResponse)
async def create_vehicle_maintenance(vehicle_id: int, data: MaintenanceCreate, db: AsyncSession = Depends(get_db)):
    """Create a maintenance task for a vehicle"""
    # Verify vehicle exists
    result = await db.execute(select(Vehicle).where(Vehicle.id == vehicle_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Vehicle not found")

    task = VehicleMaintenance(
        vehicle_id=vehicle_id,
        **data.model_dump()
    )

    db.add(task)
    await db.commit()
    await db.refresh(task)

    return MaintenanceResponse(
        id=task.id,
        vehicle_id=task.vehicle_id,
        name=task.name,
        description=task.description,
        frequency_miles=task.frequency_miles,
        frequency_hours=task.frequency_hours,
        frequency_days=task.frequency_days,
        last_completed=task.last_completed,
        last_mileage=task.last_mileage,
        last_hours=task.last_hours,
        next_due_date=task.next_due_date,
        next_due_mileage=task.next_due_mileage,
        next_due_hours=task.next_due_hours,
        notify_channels=task.notify_channels or "dashboard,calendar",
        is_active=task.is_active,
        notes=task.notes,
        status=task.status,
        created_at=task.created_at,
        updated_at=task.updated_at
    )


@router.put("/maintenance/{task_id}", response_model=MaintenanceResponse)
async def update_vehicle_maintenance(task_id: int, data: MaintenanceUpdate, db: AsyncSession = Depends(get_db)):
    """Update a maintenance task"""
    result = await db.execute(
        select(VehicleMaintenance).where(VehicleMaintenance.id == task_id)
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
        vehicle_id=task.vehicle_id,
        name=task.name,
        description=task.description,
        frequency_miles=task.frequency_miles,
        frequency_hours=task.frequency_hours,
        frequency_days=task.frequency_days,
        last_completed=task.last_completed,
        last_mileage=task.last_mileage,
        last_hours=task.last_hours,
        next_due_date=task.next_due_date,
        next_due_mileage=task.next_due_mileage,
        next_due_hours=task.next_due_hours,
        notify_channels=task.notify_channels or "dashboard,calendar",
        is_active=task.is_active,
        notes=task.notes,
        status=task.status,
        created_at=task.created_at,
        updated_at=task.updated_at
    )


@router.delete("/maintenance/{task_id}")
async def delete_vehicle_maintenance(task_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a maintenance task"""
    result = await db.execute(
        select(VehicleMaintenance).where(VehicleMaintenance.id == task_id)
    )
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="Maintenance task not found")

    await db.delete(task)
    await db.commit()

    return {"message": "Maintenance task deleted"}


@router.post("/maintenance/{task_id}/complete", response_model=MaintenanceResponse)
async def complete_vehicle_maintenance(task_id: int, data: LogCreate, db: AsyncSession = Depends(get_db)):
    """Mark a maintenance task as complete"""
    result = await db.execute(
        select(VehicleMaintenance).where(VehicleMaintenance.id == task_id)
    )
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="Maintenance task not found")

    performed_at = data.performed_at or datetime.utcnow()

    # Create log entry
    log = VehicleMaintenanceLog(
        vehicle_id=task.vehicle_id,
        maintenance_id=task_id,
        name=task.name,
        performed_at=performed_at,
        mileage_at=data.mileage_at,
        hours_at=data.hours_at,
        cost=data.cost,
        notes=data.notes
    )
    db.add(log)

    # Update task
    task.last_completed = performed_at
    task.last_mileage = data.mileage_at
    task.last_hours = data.hours_at
    task.calculate_next_due()

    # Update vehicle mileage/hours if provided
    if data.mileage_at or data.hours_at:
        result = await db.execute(select(Vehicle).where(Vehicle.id == task.vehicle_id))
        vehicle = result.scalar_one_or_none()
        if vehicle:
            if data.mileage_at and data.mileage_at > vehicle.current_mileage:
                vehicle.current_mileage = data.mileage_at
            if data.hours_at and data.hours_at > vehicle.current_hours:
                vehicle.current_hours = data.hours_at

    await db.commit()
    await db.refresh(task)

    return MaintenanceResponse(
        id=task.id,
        vehicle_id=task.vehicle_id,
        name=task.name,
        description=task.description,
        frequency_miles=task.frequency_miles,
        frequency_hours=task.frequency_hours,
        frequency_days=task.frequency_days,
        last_completed=task.last_completed,
        last_mileage=task.last_mileage,
        last_hours=task.last_hours,
        next_due_date=task.next_due_date,
        next_due_mileage=task.next_due_mileage,
        next_due_hours=task.next_due_hours,
        notify_channels=task.notify_channels or "dashboard,calendar",
        is_active=task.is_active,
        notes=task.notes,
        status=task.status,
        created_at=task.created_at,
        updated_at=task.updated_at
    )


@router.get("/{vehicle_id}/logs", response_model=List[LogResponse])
async def get_vehicle_logs(vehicle_id: int, db: AsyncSession = Depends(get_db)):
    """Get all maintenance logs for a vehicle"""
    result = await db.execute(
        select(VehicleMaintenanceLog)
        .where(VehicleMaintenanceLog.vehicle_id == vehicle_id)
        .order_by(VehicleMaintenanceLog.performed_at.desc())
    )
    logs = result.scalars().all()

    return [LogResponse(
        id=log.id,
        vehicle_id=log.vehicle_id,
        maintenance_id=log.maintenance_id,
        name=log.name,
        performed_at=log.performed_at,
        mileage_at=log.mileage_at,
        hours_at=log.hours_at,
        cost=log.cost,
        notes=log.notes,
        created_at=log.created_at
    ) for log in logs]


@router.get("/types/list")
async def get_vehicle_types():
    """Get all available vehicle types"""
    return [{"value": t.value, "label": t.value.replace("_", " ").title()} for t in VehicleType]
