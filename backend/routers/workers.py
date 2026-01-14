"""
Workers Router
Manage external workers (maids, contractors, farm hands) who can be assigned tasks
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from models.database import get_db
from models.workers import Worker
from models.tasks import Task

router = APIRouter(prefix="/workers", tags=["Workers"])


# Pydantic schemas
class WorkerCreate(BaseModel):
    name: str
    role: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None


class WorkerUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class WorkerResponse(BaseModel):
    id: int
    name: str
    role: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    notes: Optional[str]
    is_active: bool
    created_at: datetime
    task_count: Optional[int] = 0

    class Config:
        from_attributes = True


class TaskResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    due_date: Optional[str]
    due_time: Optional[str]
    priority: int
    is_completed: bool
    is_in_progress: bool = False
    is_blocked: bool
    blocked_reason: Optional[str]
    completion_note: Optional[str]
    worker_note: Optional[str]
    category: Optional[str]

    class Config:
        from_attributes = True


@router.get("/")
async def get_workers(
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db)
):
    """Get all workers with task counts"""
    query = select(Worker)
    if not include_inactive:
        query = query.where(Worker.is_active == True)
    query = query.order_by(Worker.name)

    result = await db.execute(query)
    workers = result.scalars().all()

    # Get task counts for each worker
    worker_list = []
    for worker in workers:
        task_query = select(Task).where(
            and_(
                Task.assigned_to_worker_id == worker.id,
                Task.is_active == True,
                Task.is_completed == False
            )
        )
        task_result = await db.execute(task_query)
        task_count = len(task_result.scalars().all())

        worker_dict = {
            "id": worker.id,
            "name": worker.name,
            "role": worker.role,
            "phone": worker.phone,
            "email": worker.email,
            "notes": worker.notes,
            "is_active": worker.is_active,
            "created_at": worker.created_at,
            "task_count": task_count
        }
        worker_list.append(worker_dict)

    return worker_list


@router.post("/")
async def create_worker(
    data: WorkerCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new worker"""
    worker = Worker(
        name=data.name,
        role=data.role,
        phone=data.phone,
        email=data.email,
        notes=data.notes
    )
    db.add(worker)
    await db.commit()
    await db.refresh(worker)

    return {
        "id": worker.id,
        "name": worker.name,
        "role": worker.role,
        "phone": worker.phone,
        "email": worker.email,
        "notes": worker.notes,
        "is_active": worker.is_active,
        "created_at": worker.created_at,
        "task_count": 0
    }


@router.get("/assignable-tasks/")
async def get_assignable_tasks(
    db: AsyncSession = Depends(get_db)
):
    """Get all unassigned, incomplete tasks that can be assigned to a worker"""
    query = select(Task).where(
        and_(
            Task.is_active == True,
            Task.is_completed == False,
            Task.assigned_to_worker_id == None
        )
    ).order_by(Task.due_date.asc().nullslast(), Task.title.asc())

    result = await db.execute(query)
    tasks = result.scalars().all()

    return [
        {
            "id": task.id,
            "title": task.title,
            "description": task.description,
            "due_date": str(task.due_date) if task.due_date else None,
            "due_time": task.due_time,
            "priority": task.priority,
            "category": task.category.value if task.category else None,
            "task_type": task.task_type.value if task.task_type else None
        }
        for task in tasks
    ]


@router.get("/{worker_id}/")
async def get_worker(
    worker_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get a single worker by ID"""
    result = await db.execute(select(Worker).where(Worker.id == worker_id))
    worker = result.scalar_one_or_none()

    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    # Get task count
    task_query = select(Task).where(
        and_(
            Task.assigned_to_worker_id == worker.id,
            Task.is_active == True,
            Task.is_completed == False
        )
    )
    task_result = await db.execute(task_query)
    task_count = len(task_result.scalars().all())

    return {
        "id": worker.id,
        "name": worker.name,
        "role": worker.role,
        "phone": worker.phone,
        "email": worker.email,
        "notes": worker.notes,
        "is_active": worker.is_active,
        "created_at": worker.created_at,
        "task_count": task_count
    }


@router.patch("/{worker_id}/")
async def update_worker(
    worker_id: int,
    data: WorkerUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a worker"""
    result = await db.execute(select(Worker).where(Worker.id == worker_id))
    worker = result.scalar_one_or_none()

    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(worker, key, value)

    worker.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(worker)

    return {
        "id": worker.id,
        "name": worker.name,
        "role": worker.role,
        "phone": worker.phone,
        "email": worker.email,
        "notes": worker.notes,
        "is_active": worker.is_active,
        "created_at": worker.created_at
    }


@router.delete("/{worker_id}/")
async def delete_worker(
    worker_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Soft delete a worker (set is_active=False)"""
    result = await db.execute(select(Worker).where(Worker.id == worker_id))
    worker = result.scalar_one_or_none()

    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    worker.is_active = False
    worker.updated_at = datetime.utcnow()
    await db.commit()

    return {"message": "Worker deactivated"}


@router.get("/{worker_id}/tasks/")
async def get_worker_tasks(
    worker_id: int,
    include_completed: bool = False,
    db: AsyncSession = Depends(get_db)
):
    """Get all tasks assigned to a worker"""
    # Verify worker exists
    result = await db.execute(select(Worker).where(Worker.id == worker_id))
    worker = result.scalar_one_or_none()

    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    query = select(Task).where(
        and_(
            Task.assigned_to_worker_id == worker_id,
            Task.is_active == True
        )
    )

    if not include_completed:
        query = query.where(Task.is_completed == False)

    query = query.order_by(Task.due_date.asc().nullslast(), Task.priority.asc())

    result = await db.execute(query)
    tasks = result.scalars().all()

    return [
        {
            "id": task.id,
            "title": task.title,
            "description": task.description,
            "due_date": str(task.due_date) if task.due_date else None,
            "due_time": task.due_time,
            "priority": task.priority,
            "is_completed": task.is_completed,
            "is_in_progress": task.is_in_progress,
            "is_blocked": task.is_blocked,
            "blocked_reason": task.blocked_reason,
            "completion_note": task.completion_note,
            "worker_note": task.worker_note,
            "category": task.category.value if task.category else None,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None
        }
        for task in tasks
    ]


@router.post("/{worker_id}/tasks/{task_id}/note/")
async def update_worker_note(
    worker_id: int,
    task_id: int,
    note: str = "",
    db: AsyncSession = Depends(get_db)
):
    """Add or update a worker's note on a task"""
    result = await db.execute(
        select(Task).where(
            and_(
                Task.id == task_id,
                Task.assigned_to_worker_id == worker_id
            )
        )
    )
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found or not assigned to this worker")

    task.worker_note = note.strip() if note else None
    await db.commit()

    return {"message": "Note updated", "task_id": task_id, "note": task.worker_note}


@router.post("/{worker_id}/tasks/{task_id}/start/")
async def start_worker_task(
    worker_id: int,
    task_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Mark a task as in-progress"""
    result = await db.execute(
        select(Task).where(
            and_(
                Task.id == task_id,
                Task.assigned_to_worker_id == worker_id
            )
        )
    )
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found or not assigned to this worker")

    task.is_in_progress = True
    task.is_blocked = False
    task.blocked_reason = None
    await db.commit()

    return {"message": "Task started", "task_id": task_id}


@router.post("/{worker_id}/tasks/{task_id}/stop/")
async def stop_worker_task(
    worker_id: int,
    task_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Mark a task as no longer in-progress (paused)"""
    result = await db.execute(
        select(Task).where(
            and_(
                Task.id == task_id,
                Task.assigned_to_worker_id == worker_id
            )
        )
    )
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found or not assigned to this worker")

    task.is_in_progress = False
    await db.commit()

    return {"message": "Task paused", "task_id": task_id}


@router.post("/{worker_id}/tasks/{task_id}/complete/")
async def complete_worker_task(
    worker_id: int,
    task_id: int,
    note: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Mark a task as completed by worker, with optional note"""
    result = await db.execute(
        select(Task).where(
            and_(
                Task.id == task_id,
                Task.assigned_to_worker_id == worker_id
            )
        )
    )
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found or not assigned to this worker")

    task.is_completed = True
    task.is_in_progress = False
    task.is_blocked = False
    task.blocked_reason = None
    task.completion_note = note
    task.completed_at = datetime.utcnow()
    task.completion_count = (task.completion_count or 0) + 1

    await db.commit()

    return {"message": "Task completed", "task_id": task_id}


@router.post("/{worker_id}/tasks/{task_id}/uncomplete/")
async def uncomplete_worker_task(
    worker_id: int,
    task_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Revert a completed task back to incomplete"""
    result = await db.execute(
        select(Task).where(
            and_(
                Task.id == task_id,
                Task.assigned_to_worker_id == worker_id
            )
        )
    )
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found or not assigned to this worker")

    task.is_completed = False
    task.completed_at = None
    # Keep the completion_note as a record of what was done

    await db.commit()

    return {"message": "Task marked incomplete", "task_id": task_id}


@router.post("/{worker_id}/tasks/{task_id}/block/")
async def block_worker_task(
    worker_id: int,
    task_id: int,
    reason: str,
    db: AsyncSession = Depends(get_db)
):
    """Mark a task as blocked (cannot complete), with required reason"""
    if not reason or not reason.strip():
        raise HTTPException(status_code=400, detail="Reason is required when blocking a task")

    result = await db.execute(
        select(Task).where(
            and_(
                Task.id == task_id,
                Task.assigned_to_worker_id == worker_id
            )
        )
    )
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found or not assigned to this worker")

    task.is_blocked = True
    task.blocked_reason = reason.strip()

    await db.commit()

    return {"message": "Task marked as blocked", "task_id": task_id, "reason": reason}


@router.post("/{worker_id}/tasks/{task_id}/unblock/")
async def unblock_worker_task(
    worker_id: int,
    task_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Clear blocked status from a task"""
    result = await db.execute(
        select(Task).where(
            and_(
                Task.id == task_id,
                Task.assigned_to_worker_id == worker_id
            )
        )
    )
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found or not assigned to this worker")

    task.is_blocked = False
    task.blocked_reason = None

    await db.commit()

    return {"message": "Task unblocked", "task_id": task_id}


@router.post("/{worker_id}/assign/{task_id}/")
async def assign_task_to_worker(
    worker_id: int,
    task_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Assign an existing task to a worker"""
    # Verify worker exists
    worker_result = await db.execute(select(Worker).where(Worker.id == worker_id))
    worker = worker_result.scalar_one_or_none()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    # Get the task
    task_result = await db.execute(select(Task).where(Task.id == task_id))
    task = task_result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Assign to worker
    task.assigned_to_worker_id = worker_id
    await db.commit()

    return {"message": f"Task assigned to {worker.name}", "task_id": task_id, "worker_id": worker_id}


@router.post("/{worker_id}/unassign/{task_id}/")
async def unassign_task_from_worker(
    worker_id: int,
    task_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Remove a task from a worker (unassign)"""
    result = await db.execute(
        select(Task).where(
            and_(
                Task.id == task_id,
                Task.assigned_to_worker_id == worker_id
            )
        )
    )
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found or not assigned to this worker")

    task.assigned_to_worker_id = None
    task.is_blocked = False
    task.blocked_reason = None
    await db.commit()

    return {"message": "Task unassigned from worker", "task_id": task_id}
