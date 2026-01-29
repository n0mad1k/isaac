"""
Supply Requests Router
API endpoints for workers to request supplies
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from models.database import get_db
from models.supply_requests import SupplyRequest, RequestStatus
from models.workers import Worker
from routers.auth import require_auth
from models.users import User

router = APIRouter(prefix="/supply-requests", tags=["Supply Requests"])


# Pydantic schemas
class SupplyRequestCreate(BaseModel):
    worker_id: int
    item_name: str
    quantity: int = 1
    notes: Optional[str] = None


class SupplyRequestUpdate(BaseModel):
    item_name: Optional[str] = None
    quantity: Optional[int] = None
    notes: Optional[str] = None
    status: Optional[RequestStatus] = None
    admin_notes: Optional[str] = None


class SupplyRequestResponse(BaseModel):
    id: int
    worker_id: int
    worker_name: Optional[str] = None
    item_name: str
    quantity: int
    notes: Optional[str]
    status: RequestStatus
    admin_notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


@router.get("/")
async def get_all_requests(
    worker_id: Optional[int] = None,
    status: Optional[RequestStatus] = None,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db)
):
    """Get all supply requests, optionally filtered by worker or status"""
    query = select(SupplyRequest)

    if worker_id:
        query = query.where(SupplyRequest.worker_id == worker_id)
    if status:
        query = query.where(SupplyRequest.status == status)

    query = query.order_by(SupplyRequest.created_at.desc())

    result = await db.execute(query)
    requests = result.scalars().all()

    # Get worker names
    response = []
    for req in requests:
        worker_result = await db.execute(select(Worker).where(Worker.id == req.worker_id))
        worker = worker_result.scalar_one_or_none()

        response.append({
            "id": req.id,
            "worker_id": req.worker_id,
            "worker_name": worker.name if worker else None,
            "item_name": req.item_name,
            "quantity": req.quantity,
            "notes": req.notes,
            "status": req.status,
            "admin_notes": req.admin_notes,
            "created_at": req.created_at,
            "updated_at": req.updated_at
        })

    return response


@router.get("/worker/{worker_id}/")
async def get_worker_requests(
    worker_id: int,
    include_completed: bool = False,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db)
):
    """Get all supply requests for a specific worker"""
    # Verify worker exists
    worker_result = await db.execute(select(Worker).where(Worker.id == worker_id))
    worker = worker_result.scalar_one_or_none()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    query = select(SupplyRequest).where(SupplyRequest.worker_id == worker_id)

    if not include_completed:
        # Only exclude delivered and denied - purchased items should still appear in active list
        query = query.where(
            SupplyRequest.status.notin_([RequestStatus.DELIVERED, RequestStatus.DENIED])
        )

    query = query.order_by(SupplyRequest.created_at.desc())

    result = await db.execute(query)
    requests = result.scalars().all()

    return [
        {
            "id": req.id,
            "worker_id": req.worker_id,
            "worker_name": worker.name,
            "item_name": req.item_name,
            "quantity": req.quantity,
            "notes": req.notes,
            "status": req.status,
            "admin_notes": req.admin_notes,
            "created_at": req.created_at,
            "updated_at": req.updated_at
        }
        for req in requests
    ]


@router.get("/pending/")
async def get_pending_requests(user: User = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    """Get all pending supply requests (for admin review)"""
    query = select(SupplyRequest).where(
        SupplyRequest.status == RequestStatus.PENDING
    ).order_by(SupplyRequest.created_at.asc())

    result = await db.execute(query)
    requests = result.scalars().all()

    response = []
    for req in requests:
        worker_result = await db.execute(select(Worker).where(Worker.id == req.worker_id))
        worker = worker_result.scalar_one_or_none()

        response.append({
            "id": req.id,
            "worker_id": req.worker_id,
            "worker_name": worker.name if worker else None,
            "item_name": req.item_name,
            "quantity": req.quantity,
            "notes": req.notes,
            "status": req.status,
            "admin_notes": req.admin_notes,
            "created_at": req.created_at,
            "updated_at": req.updated_at
        })

    return response


@router.post("/")
async def create_request(
    data: SupplyRequestCreate,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db)
):
    """Create a new supply request"""
    # Verify worker exists
    worker_result = await db.execute(select(Worker).where(Worker.id == data.worker_id))
    worker = worker_result.scalar_one_or_none()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    request = SupplyRequest(
        worker_id=data.worker_id,
        item_name=data.item_name,
        quantity=data.quantity,
        notes=data.notes
    )

    db.add(request)
    await db.commit()
    await db.refresh(request)

    return {
        "id": request.id,
        "worker_id": request.worker_id,
        "worker_name": worker.name,
        "item_name": request.item_name,
        "quantity": request.quantity,
        "notes": request.notes,
        "status": request.status,
        "admin_notes": request.admin_notes,
        "created_at": request.created_at,
        "updated_at": request.updated_at
    }


@router.patch("/{request_id}/")
async def update_request(
    request_id: int,
    data: SupplyRequestUpdate,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db)
):
    """Update a supply request (status, admin notes, etc.)"""
    result = await db.execute(select(SupplyRequest).where(SupplyRequest.id == request_id))
    request = result.scalar_one_or_none()

    if not request:
        raise HTTPException(status_code=404, detail="Supply request not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(request, key, value)

    request.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(request)

    # Get worker name
    worker_result = await db.execute(select(Worker).where(Worker.id == request.worker_id))
    worker = worker_result.scalar_one_or_none()

    return {
        "id": request.id,
        "worker_id": request.worker_id,
        "worker_name": worker.name if worker else None,
        "item_name": request.item_name,
        "quantity": request.quantity,
        "notes": request.notes,
        "status": request.status,
        "admin_notes": request.admin_notes,
        "created_at": request.created_at,
        "updated_at": request.updated_at
    }


@router.delete("/{request_id}/")
async def delete_request(
    request_id: int,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db)
):
    """Delete a supply request"""
    result = await db.execute(select(SupplyRequest).where(SupplyRequest.id == request_id))
    request = result.scalar_one_or_none()

    if not request:
        raise HTTPException(status_code=404, detail="Supply request not found")

    await db.delete(request)
    await db.commit()

    return {"message": "Supply request deleted"}
