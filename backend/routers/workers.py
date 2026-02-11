"""
Workers Router
Manage external workers (maids, contractors, farm hands) who can be assigned tasks
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, update, desc
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from loguru import logger

from models.database import get_db
from models.workers import Worker, WorkerStandardTask, WorkerVisit, WorkerVisitTask, VisitStatus
from models.tasks import Task
from services.translation import translate_task
from models.users import User
from services.permissions import require_view, require_create, require_interact, require_edit, require_delete

router = APIRouter(prefix="/workers", tags=["Workers"])


# Pydantic schemas
class WorkerCreate(BaseModel):
    name: str
    role: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None
    language: Optional[str] = "en"  # "en", "es", etc.


class WorkerUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None
    language: Optional[str] = None
    is_active: Optional[bool] = None


class WorkerResponse(BaseModel):
    id: int
    name: str
    role: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    notes: Optional[str]
    language: str = "en"
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
    user: User = Depends(require_view("workers")),
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
            "language": worker.language or "en",
            "is_active": worker.is_active,
            "created_at": worker.created_at,
            "task_count": task_count
        }
        worker_list.append(worker_dict)

    return worker_list


@router.post("/")
async def create_worker(
    data: WorkerCreate,
    user: User = Depends(require_create("workers")),
    db: AsyncSession = Depends(get_db)
):
    """Create a new worker"""
    worker = Worker(
        name=data.name,
        role=data.role,
        phone=data.phone,
        email=data.email,
        notes=data.notes,
        language=data.language or "en"
    )
    db.add(worker)
    await db.commit()
    await db.refresh(worker)

    logger.info(f"Created worker '{worker.name}' (id={worker.id}, role={worker.role}, lang={worker.language})")

    return {
        "id": worker.id,
        "name": worker.name,
        "role": worker.role,
        "phone": worker.phone,
        "email": worker.email,
        "notes": worker.notes,
        "language": worker.language or "en",
        "is_active": worker.is_active,
        "created_at": worker.created_at,
        "task_count": 0
    }


@router.get("/assignable-tasks/")
async def get_assignable_tasks(
    user: User = Depends(require_view("workers")),
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
    user: User = Depends(require_view("workers")),
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
        "language": worker.language or "en",
        "is_active": worker.is_active,
        "created_at": worker.created_at,
        "task_count": task_count
    }


@router.patch("/{worker_id}/")
async def update_worker(
    worker_id: int,
    data: WorkerUpdate,
    user: User = Depends(require_edit("workers")),
    db: AsyncSession = Depends(get_db)
):
    """Update a worker"""
    result = await db.execute(select(Worker).where(Worker.id == worker_id))
    worker = result.scalar_one_or_none()

    if not worker:
        logger.error(f"Update failed: worker {worker_id} not found")
        raise HTTPException(status_code=404, detail="Worker not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(worker, key, value)

    worker.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(worker)

    logger.info(f"Updated worker '{worker.name}' (id={worker_id}, fields={list(update_data.keys())})")

    return {
        "id": worker.id,
        "name": worker.name,
        "role": worker.role,
        "phone": worker.phone,
        "email": worker.email,
        "notes": worker.notes,
        "language": worker.language or "en",
        "is_active": worker.is_active,
        "created_at": worker.created_at
    }


@router.delete("/{worker_id}/")
async def delete_worker(
    worker_id: int,
    user: User = Depends(require_delete("workers")),
    db: AsyncSession = Depends(get_db)
):
    """Soft delete a worker (set is_active=False)"""
    result = await db.execute(select(Worker).where(Worker.id == worker_id))
    worker = result.scalar_one_or_none()

    if not worker:
        logger.error(f"Delete failed: worker {worker_id} not found")
        raise HTTPException(status_code=404, detail="Worker not found")

    logger.info(f"Deactivated worker '{worker.name}' (id={worker_id})")
    worker.is_active = False
    worker.updated_at = datetime.utcnow()
    await db.commit()

    return {"message": "Worker deactivated"}


@router.get("/{worker_id}/tasks/")
async def get_worker_tasks(
    worker_id: int,
    include_completed: bool = False,
    user: User = Depends(require_view("workers")),
    db: AsyncSession = Depends(get_db)
):
    """Get all tasks assigned to a worker (translated if worker language is not English)"""
    # Verify worker exists
    result = await db.execute(select(Worker).where(Worker.id == worker_id))
    worker = result.scalar_one_or_none()

    if not worker:
        logger.error(f"Get worker tasks failed: worker {worker_id} not found")
        raise HTTPException(status_code=404, detail="Worker not found")

    query = select(Task).where(
        and_(
            Task.assigned_to_worker_id == worker_id,
            Task.is_active == True
        )
    )

    if not include_completed:
        query = query.where(Task.is_completed == False)

    query = query.order_by(
        Task.is_backlog.asc(),  # Active tasks first, backlog second
        Task.sort_order.asc().nullslast(),  # Manual order within group
        Task.due_date.asc().nullslast(),
        Task.priority.asc()
    )

    result = await db.execute(query)
    tasks = result.scalars().all()

    # Build task list
    task_list = []
    worker_lang = worker.language or "en"

    for task in tasks:
        task_dict = {
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
            "completed_at": task.completed_at.isoformat() if task.completed_at else None,
            "is_backlog": task.is_backlog or False,
            "sort_order": task.sort_order
        }

        # Translate if worker language is not English
        if worker_lang != "en":
            task_dict = await translate_task(task_dict, worker_lang)

        task_list.append(task_dict)

    return task_list


@router.post("/{worker_id}/tasks/{task_id}/note/")
async def update_worker_note(
    worker_id: int,
    task_id: int,
    note: str = "",
    user: User = Depends(require_interact("workers")),
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
        logger.error(f"Worker note failed: task {task_id} not found or not assigned to worker {worker_id}")
        raise HTTPException(status_code=404, detail="Task not found or not assigned to this worker")

    task.worker_note = note.strip() if note else None
    await db.commit()

    logger.info(f"Worker note updated on task {task_id} by worker {worker_id}")

    return {"message": "Note updated", "task_id": task_id, "note": task.worker_note}


@router.post("/{worker_id}/tasks/{task_id}/start/")
async def start_worker_task(
    worker_id: int,
    task_id: int,
    user: User = Depends(require_interact("workers")),
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
        logger.error(f"Start task failed: task {task_id} not found or not assigned to worker {worker_id}")
        raise HTTPException(status_code=404, detail="Task not found or not assigned to this worker")

    task.is_in_progress = True
    task.is_blocked = False
    task.blocked_reason = None
    await db.commit()

    logger.info(f"Task {task_id} started by worker {worker_id}")

    return {"message": "Task started", "task_id": task_id}


@router.post("/{worker_id}/tasks/{task_id}/stop/")
async def stop_worker_task(
    worker_id: int,
    task_id: int,
    user: User = Depends(require_interact("workers")),
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
        logger.error(f"Stop task failed: task {task_id} not found or not assigned to worker {worker_id}")
        raise HTTPException(status_code=404, detail="Task not found or not assigned to this worker")

    task.is_in_progress = False
    await db.commit()

    logger.info(f"Task {task_id} paused by worker {worker_id}")

    return {"message": "Task paused", "task_id": task_id}


@router.post("/{worker_id}/tasks/{task_id}/complete/")
async def complete_worker_task(
    worker_id: int,
    task_id: int,
    note: Optional[str] = None,
    user: User = Depends(require_interact("workers")),
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
        logger.error(f"Complete task failed: task {task_id} not found or not assigned to worker {worker_id}")
        raise HTTPException(status_code=404, detail="Task not found or not assigned to this worker")

    task.is_completed = True
    task.is_in_progress = False
    task.is_blocked = False
    task.blocked_reason = None
    task.completion_note = note
    task.completed_at = datetime.utcnow()
    task.completion_count = (task.completion_count or 0) + 1

    await db.commit()

    logger.info(f"Task {task_id} completed by worker {worker_id} (completion_count={task.completion_count})")

    return {"message": "Task completed", "task_id": task_id}


@router.post("/{worker_id}/tasks/{task_id}/uncomplete/")
async def uncomplete_worker_task(
    worker_id: int,
    task_id: int,
    user: User = Depends(require_interact("workers")),
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
        logger.error(f"Uncomplete task failed: task {task_id} not found or not assigned to worker {worker_id}")
        raise HTTPException(status_code=404, detail="Task not found or not assigned to this worker")

    task.is_completed = False
    task.completed_at = None
    # Keep the completion_note as a record of what was done

    await db.commit()

    logger.info(f"Task {task_id} reverted to incomplete by worker {worker_id}")

    return {"message": "Task marked incomplete", "task_id": task_id}


@router.post("/{worker_id}/tasks/{task_id}/block/")
async def block_worker_task(
    worker_id: int,
    task_id: int,
    reason: str,
    user: User = Depends(require_interact("workers")),
    db: AsyncSession = Depends(get_db)
):
    """Mark a task as blocked (cannot complete), with required reason"""
    if not reason or not reason.strip():
        logger.error(f"Block task failed: no reason provided for task {task_id} by worker {worker_id}")
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
        logger.error(f"Block task failed: task {task_id} not found or not assigned to worker {worker_id}")
        raise HTTPException(status_code=404, detail="Task not found or not assigned to this worker")

    task.is_blocked = True
    task.blocked_reason = reason.strip()

    await db.commit()

    logger.info(f"Task {task_id} blocked by worker {worker_id}: {reason.strip()}")

    return {"message": "Task marked as blocked", "task_id": task_id, "reason": reason}


@router.post("/{worker_id}/tasks/{task_id}/unblock/")
async def unblock_worker_task(
    worker_id: int,
    task_id: int,
    user: User = Depends(require_interact("workers")),
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
        logger.error(f"Unblock task failed: task {task_id} not found or not assigned to worker {worker_id}")
        raise HTTPException(status_code=404, detail="Task not found or not assigned to this worker")

    task.is_blocked = False
    task.blocked_reason = None

    await db.commit()

    logger.info(f"Task {task_id} unblocked for worker {worker_id}")

    return {"message": "Task unblocked", "task_id": task_id}


@router.post("/{worker_id}/assign/{task_id}/")
async def assign_task_to_worker(
    worker_id: int,
    task_id: int,
    user: User = Depends(require_edit("workers")),
    db: AsyncSession = Depends(get_db)
):
    """Assign an existing task to a worker"""
    # Verify worker exists
    worker_result = await db.execute(select(Worker).where(Worker.id == worker_id))
    worker = worker_result.scalar_one_or_none()
    if not worker:
        logger.error(f"Assign task failed: worker {worker_id} not found")
        raise HTTPException(status_code=404, detail="Worker not found")

    # Get the task
    task_result = await db.execute(select(Task).where(Task.id == task_id))
    task = task_result.scalar_one_or_none()
    if not task:
        logger.error(f"Assign task failed: task {task_id} not found")
        raise HTTPException(status_code=404, detail="Task not found")

    # Assign to worker
    task.assigned_to_worker_id = worker_id
    await db.commit()

    logger.info(f"Assigned task {task_id} to worker '{worker.name}' (worker_id={worker_id})")

    return {"message": f"Task assigned to {worker.name}", "task_id": task_id, "worker_id": worker_id}


@router.post("/{worker_id}/unassign/{task_id}/")
async def unassign_task_from_worker(
    worker_id: int,
    task_id: int,
    user: User = Depends(require_edit("workers")),
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
        logger.error(f"Unassign task failed: task {task_id} not found or not assigned to worker {worker_id}")
        raise HTTPException(status_code=404, detail="Task not found or not assigned to this worker")

    task.assigned_to_worker_id = None
    task.is_blocked = False
    task.blocked_reason = None
    await db.commit()

    logger.info(f"Unassigned task {task_id} from worker {worker_id}")

    return {"message": "Task unassigned from worker", "task_id": task_id}


class ReorderRequest(BaseModel):
    task_ids: List[int]  # Task IDs in desired order


@router.post("/{worker_id}/tasks/reorder/")
async def reorder_worker_tasks(
    worker_id: int,
    data: ReorderRequest,
    user: User = Depends(require_edit("workers")),
    db: AsyncSession = Depends(get_db)
):
    """Reorder tasks for a worker. task_ids should be in desired display order."""
    result = await db.execute(select(Worker).where(Worker.id == worker_id))
    worker = result.scalar_one_or_none()
    if not worker:
        logger.error(f"Reorder tasks failed: worker {worker_id} not found")
        raise HTTPException(status_code=404, detail="Worker not found")

    # Fetch all specified tasks assigned to this worker
    task_result = await db.execute(
        select(Task).where(
            and_(
                Task.id.in_(data.task_ids),
                Task.assigned_to_worker_id == worker_id,
                Task.is_active == True
            )
        )
    )
    tasks = {t.id: t for t in task_result.scalars().all()}

    updated = 0
    for idx, task_id in enumerate(data.task_ids):
        if task_id in tasks:
            tasks[task_id].sort_order = idx
            updated += 1

    await db.commit()

    logger.info(f"Reordered {updated} tasks for worker '{worker.name}' (worker_id={worker_id})")

    return {"message": f"Reordered {updated} tasks", "worker_id": worker_id}


@router.post("/{worker_id}/tasks/{task_id}/backlog/")
async def toggle_worker_task_backlog(
    worker_id: int,
    task_id: int,
    user: User = Depends(require_edit("workers")),
    db: AsyncSession = Depends(get_db)
):
    """Toggle a task's backlog status for a worker."""
    result = await db.execute(
        select(Task).where(
            and_(
                Task.id == task_id,
                Task.assigned_to_worker_id == worker_id,
                Task.is_active == True
            )
        )
    )
    task = result.scalar_one_or_none()
    if not task:
        logger.error(f"Toggle backlog failed: task {task_id} not found or not assigned to worker {worker_id}")
        raise HTTPException(status_code=404, detail="Task not found or not assigned to this worker")

    task.is_backlog = not (task.is_backlog or False)
    task.sort_order = None  # Reset order when moving between lists
    await db.commit()

    logger.info(f"Task {task_id} {'moved to backlog' if task.is_backlog else 'moved to active'} for worker {worker_id}")

    return {
        "message": f"Task {'moved to backlog' if task.is_backlog else 'moved to active'}",
        "task_id": task_id,
        "is_backlog": task.is_backlog
    }


# ============================================
# Worker Visit Task Management
# ============================================

class StandardTaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    sort_order: int = 0

class StandardTaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None

class VisitTaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    sort_order: int = 0

class VisitTaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    sort_order: Optional[int] = None
    is_completed: Optional[bool] = None

class ReorderTasksRequest(BaseModel):
    task_ids: List[int]


# --- Standard Tasks ---

@router.get("/{worker_id}/standard-tasks/")
async def get_standard_tasks(
    worker_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_view("workers"))
):
    """Get all standard (recurring) tasks for a worker"""
    result = await db.execute(
        select(WorkerStandardTask)
        .where(WorkerStandardTask.worker_id == worker_id, WorkerStandardTask.is_active == True)
        .order_by(WorkerStandardTask.sort_order, WorkerStandardTask.id)
    )
    tasks = result.scalars().all()
    return [
        {
            "id": t.id,
            "title": t.title,
            "description": t.description,
            "sort_order": t.sort_order,
        }
        for t in tasks
    ]


@router.post("/{worker_id}/standard-tasks/")
async def create_standard_task(
    worker_id: int,
    data: StandardTaskCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_create("workers"))
):
    """Create a new standard task for a worker"""
    # Verify worker exists
    worker_result = await db.execute(select(Worker).where(Worker.id == worker_id))
    if not worker_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Worker not found")

    task = WorkerStandardTask(
        worker_id=worker_id,
        title=data.title,
        description=data.description,
        sort_order=data.sort_order
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    logger.info(f"Created standard task '{task.title}' for worker {worker_id}")

    return {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "sort_order": task.sort_order,
    }


@router.put("/{worker_id}/standard-tasks/{task_id}/")
async def update_standard_task(
    worker_id: int,
    task_id: int,
    data: StandardTaskUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_edit("workers"))
):
    """Update a standard task"""
    result = await db.execute(
        select(WorkerStandardTask)
        .where(WorkerStandardTask.id == task_id, WorkerStandardTask.worker_id == worker_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(task, key, value)

    await db.commit()
    await db.refresh(task)

    return {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "sort_order": task.sort_order,
        "is_active": task.is_active,
    }


@router.delete("/{worker_id}/standard-tasks/{task_id}/")
async def delete_standard_task(
    worker_id: int,
    task_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_delete("workers"))
):
    """Delete a standard task"""
    result = await db.execute(
        select(WorkerStandardTask)
        .where(WorkerStandardTask.id == task_id, WorkerStandardTask.worker_id == worker_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    await db.delete(task)
    await db.commit()
    logger.info(f"Deleted standard task {task_id} for worker {worker_id}")
    return {"message": "Task deleted"}


@router.post("/{worker_id}/standard-tasks/reorder/")
async def reorder_standard_tasks(
    worker_id: int,
    data: ReorderTasksRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_edit("workers"))
):
    """Reorder standard tasks by providing ordered list of task IDs"""
    for idx, task_id in enumerate(data.task_ids):
        await db.execute(
            update(WorkerStandardTask)
            .where(WorkerStandardTask.id == task_id, WorkerStandardTask.worker_id == worker_id)
            .values(sort_order=idx)
        )
    await db.commit()
    return {"message": "Tasks reordered"}


# --- Worker Visits ---

@router.get("/{worker_id}/visits/")
async def get_worker_visits(
    worker_id: int,
    limit: int = Query(10, ge=1, le=100),
    include_completed: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_view("workers"))
):
    """Get worker visit history"""
    query = select(WorkerVisit).where(WorkerVisit.worker_id == worker_id)
    if not include_completed:
        query = query.where(WorkerVisit.status != VisitStatus.COMPLETED)
    query = query.order_by(desc(WorkerVisit.visit_date)).limit(limit)

    result = await db.execute(query)
    visits = result.scalars().all()

    response = []
    for v in visits:
        # Get tasks for this visit
        tasks_result = await db.execute(
            select(WorkerVisitTask)
            .where(WorkerVisitTask.visit_id == v.id)
            .order_by(WorkerVisitTask.sort_order, WorkerVisitTask.id)
        )
        tasks = tasks_result.scalars().all()

        completed_count = sum(1 for t in tasks if t.is_completed)

        response.append({
            "id": v.id,
            "visit_date": v.visit_date.isoformat() if v.visit_date else None,
            "status": v.status.value if v.status else "in_progress",
            "notes": v.notes,
            "completed_at": v.completed_at.isoformat() if v.completed_at else None,
            "task_count": len(tasks),
            "completed_count": completed_count,
            "tasks": [
                {
                    "id": t.id,
                    "title": t.title,
                    "description": t.description,
                    "sort_order": t.sort_order,
                    "is_standard": t.is_standard,
                    "is_completed": t.is_completed,
                    "is_backlog": t.is_backlog or False,
                    "completed_at": t.completed_at.isoformat() if t.completed_at else None,
                }
                for t in tasks
            ]
        })

    return response


@router.get("/{worker_id}/visits/current/")
async def get_current_visit(
    worker_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_view("workers"))
):
    """Get the current (in-progress) visit, or create one if none exists"""
    # Verify worker exists
    worker_result = await db.execute(select(Worker).where(Worker.id == worker_id))
    worker = worker_result.scalar_one_or_none()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    # Check for existing in-progress visit
    result = await db.execute(
        select(WorkerVisit)
        .where(
            WorkerVisit.worker_id == worker_id,
            WorkerVisit.status == VisitStatus.IN_PROGRESS
        )
    )
    visit = result.scalar_one_or_none()

    if not visit:
        # Create a new visit
        visit = WorkerVisit(
            worker_id=worker_id,
            visit_date=datetime.utcnow(),
            status=VisitStatus.IN_PROGRESS
        )
        db.add(visit)
        await db.flush()

        # Copy standard tasks to this visit
        std_result = await db.execute(
            select(WorkerStandardTask)
            .where(WorkerStandardTask.worker_id == worker_id, WorkerStandardTask.is_active == True)
            .order_by(WorkerStandardTask.sort_order, WorkerStandardTask.id)
        )
        standard_tasks = std_result.scalars().all()

        for st in standard_tasks:
            vt = WorkerVisitTask(
                visit_id=visit.id,
                title=st.title,
                description=st.description,
                sort_order=st.sort_order,
                is_standard=True,
                standard_task_id=st.id
            )
            db.add(vt)

        # Carry over incomplete one-off tasks from previous visits
        prev_result = await db.execute(
            select(WorkerVisit)
            .where(
                WorkerVisit.worker_id == worker_id,
                WorkerVisit.status == VisitStatus.COMPLETED
            )
            .order_by(desc(WorkerVisit.completed_at))
            .limit(1)
        )
        prev_visit = prev_result.scalar_one_or_none()

        if prev_visit:
            incomplete_result = await db.execute(
                select(WorkerVisitTask)
                .where(
                    WorkerVisitTask.visit_id == prev_visit.id,
                    WorkerVisitTask.is_standard == False,
                    WorkerVisitTask.is_completed == False
                )
            )
            incomplete_tasks = incomplete_result.scalars().all()

            # Get max sort order of current tasks
            max_sort = len(standard_tasks)

            for it in incomplete_tasks:
                vt = WorkerVisitTask(
                    visit_id=visit.id,
                    title=it.title,
                    description=it.description,
                    sort_order=max_sort,
                    is_standard=False
                )
                db.add(vt)
                max_sort += 1

        await db.commit()
        await db.refresh(visit)
        logger.info(f"Created new visit for worker {worker_id}")

    # Get tasks
    tasks_result = await db.execute(
        select(WorkerVisitTask)
        .where(WorkerVisitTask.visit_id == visit.id)
        .order_by(WorkerVisitTask.sort_order, WorkerVisitTask.id)
    )
    tasks = tasks_result.scalars().all()

    return {
        "id": visit.id,
        "visit_date": visit.visit_date.isoformat() if visit.visit_date else None,
        "status": visit.status.value if visit.status else "in_progress",
        "notes": visit.notes,
        "tasks": [
            {
                "id": t.id,
                "title": t.title,
                "description": t.description,
                "sort_order": t.sort_order,
                "is_standard": t.is_standard,
                "is_completed": t.is_completed,
                "is_backlog": t.is_backlog or False,
                "completed_at": t.completed_at.isoformat() if t.completed_at else None,
            }
            for t in tasks
        ]
    }


@router.post("/{worker_id}/visits/{visit_id}/tasks/")
async def add_visit_task(
    worker_id: int,
    visit_id: int,
    data: VisitTaskCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_create("workers"))
):
    """Add a one-off task to a visit"""
    result = await db.execute(
        select(WorkerVisit)
        .where(WorkerVisit.id == visit_id, WorkerVisit.worker_id == worker_id)
    )
    visit = result.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    task = WorkerVisitTask(
        visit_id=visit_id,
        title=data.title,
        description=data.description,
        sort_order=data.sort_order,
        is_standard=False
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    return {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "sort_order": task.sort_order,
        "is_standard": task.is_standard,
        "is_completed": task.is_completed,
    }


@router.put("/{worker_id}/visits/{visit_id}/tasks/{task_id}/")
async def update_visit_task(
    worker_id: int,
    visit_id: int,
    task_id: int,
    data: VisitTaskUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_edit("workers"))
):
    """Update a visit task (including marking complete)"""
    result = await db.execute(
        select(WorkerVisitTask)
        .where(WorkerVisitTask.id == task_id, WorkerVisitTask.visit_id == visit_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        if key == "is_completed" and value:
            task.is_completed = True
            task.completed_at = datetime.utcnow()
        elif key == "is_completed" and not value:
            task.is_completed = False
            task.completed_at = None
        else:
            setattr(task, key, value)

    await db.commit()
    await db.refresh(task)

    return {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "sort_order": task.sort_order,
        "is_standard": task.is_standard,
        "is_completed": task.is_completed,
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
    }


@router.delete("/{worker_id}/visits/{visit_id}/tasks/{task_id}/")
async def delete_visit_task(
    worker_id: int,
    visit_id: int,
    task_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_delete("workers"))
):
    """Delete a visit task (usually one-off tasks)"""
    result = await db.execute(
        select(WorkerVisitTask)
        .where(WorkerVisitTask.id == task_id, WorkerVisitTask.visit_id == visit_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    await db.delete(task)
    await db.commit()
    return {"message": "Task deleted"}


@router.post("/{worker_id}/visits/{visit_id}/tasks/reorder/")
async def reorder_visit_tasks(
    worker_id: int,
    visit_id: int,
    data: ReorderTasksRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_edit("workers"))
):
    """Reorder visit tasks by providing ordered list of task IDs"""
    for idx, task_id in enumerate(data.task_ids):
        await db.execute(
            update(WorkerVisitTask)
            .where(WorkerVisitTask.id == task_id, WorkerVisitTask.visit_id == visit_id)
            .values(sort_order=idx)
        )
    await db.commit()
    return {"message": "Tasks reordered"}


@router.post("/{worker_id}/visits/{visit_id}/complete/")
async def complete_visit(
    worker_id: int,
    visit_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_interact("workers"))
):
    """Mark a visit as completed"""
    result = await db.execute(
        select(WorkerVisit)
        .where(WorkerVisit.id == visit_id, WorkerVisit.worker_id == worker_id)
    )
    visit = result.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    visit.status = VisitStatus.COMPLETED
    visit.completed_at = datetime.utcnow()

    await db.commit()
    logger.info(f"Completed visit {visit_id} for worker {worker_id}")
    return {"message": "Visit completed", "completed_at": visit.completed_at.isoformat()}


@router.post("/{worker_id}/visits/{visit_id}/duplicate/")
async def duplicate_visit(
    worker_id: int,
    visit_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_create("workers"))
):
    """Duplicate a past visit's tasks into a new visit"""
    # Get source visit
    result = await db.execute(
        select(WorkerVisit)
        .where(WorkerVisit.id == visit_id, WorkerVisit.worker_id == worker_id)
    )
    source_visit = result.scalar_one_or_none()
    if not source_visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    # Create new visit
    new_visit = WorkerVisit(
        worker_id=worker_id,
        visit_date=datetime.utcnow(),
        status=VisitStatus.IN_PROGRESS
    )
    db.add(new_visit)
    await db.flush()

    # Copy tasks from source visit
    tasks_result = await db.execute(
        select(WorkerVisitTask)
        .where(WorkerVisitTask.visit_id == source_visit.id)
        .order_by(WorkerVisitTask.sort_order)
    )
    tasks = tasks_result.scalars().all()

    for t in tasks:
        new_task = WorkerVisitTask(
            visit_id=new_visit.id,
            title=t.title,
            description=t.description,
            sort_order=t.sort_order,
            is_standard=t.is_standard,
            standard_task_id=t.standard_task_id
        )
        db.add(new_task)

    await db.commit()
    await db.refresh(new_visit)

    logger.info(f"Duplicated visit {visit_id} to new visit {new_visit.id} for worker {worker_id}")
    return {"message": "Visit duplicated", "new_visit_id": new_visit.id}


@router.post("/{worker_id}/visits/{visit_id}/tasks/{task_id}/toggle-backlog/")
async def toggle_visit_task_backlog(
    worker_id: int,
    visit_id: int,
    task_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_edit("workers"))
):
    """Toggle a visit task's backlog status"""
    result = await db.execute(
        select(WorkerVisitTask)
        .where(WorkerVisitTask.id == task_id, WorkerVisitTask.visit_id == visit_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.is_backlog = not (task.is_backlog or False)
    await db.commit()

    logger.info(f"Task {task_id} {'moved to backlog' if task.is_backlog else 'moved from backlog'}")
    return {
        "message": f"Task {'moved to backlog' if task.is_backlog else 'moved from backlog'}",
        "task_id": task_id,
        "is_backlog": task.is_backlog
    }
