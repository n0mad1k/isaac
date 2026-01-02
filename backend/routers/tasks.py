"""
Task and Reminder API Routes
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Optional
from datetime import datetime, date, timedelta
from pydantic import BaseModel

from models.database import get_db
from models.tasks import Task, TaskCategory, TaskRecurrence, TaskType, FLORIDA_MAINTENANCE_TASKS
from services.calendar_sync import get_calendar_service


router = APIRouter(prefix="/tasks", tags=["Tasks"])


# Pydantic Schemas
class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    task_type: TaskType = TaskType.TODO
    category: TaskCategory = TaskCategory.CUSTOM
    due_date: Optional[date] = None
    due_time: Optional[str] = None
    end_time: Optional[str] = None
    location: Optional[str] = None
    recurrence: TaskRecurrence = TaskRecurrence.ONCE
    recurrence_interval: Optional[int] = None
    recurrence_month: Optional[int] = None
    recurrence_day: Optional[int] = None
    priority: int = 2
    plant_id: Optional[int] = None
    animal_id: Optional[int] = None
    weather_dependent: bool = False
    skip_if_rain: bool = False
    notify_email: bool = True
    notify_days_before: int = 1
    notes: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    task_type: Optional[TaskType] = None
    category: Optional[TaskCategory] = None
    due_date: Optional[date] = None
    due_time: Optional[str] = None
    end_time: Optional[str] = None
    location: Optional[str] = None
    priority: Optional[int] = None
    is_completed: Optional[bool] = None
    notify_email: Optional[bool] = None
    notes: Optional[str] = None


class TaskResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    task_type: TaskType
    category: TaskCategory
    due_date: Optional[date]
    due_time: Optional[str]
    end_time: Optional[str]
    location: Optional[str]
    recurrence: TaskRecurrence
    priority: int
    is_completed: bool
    completed_at: Optional[datetime]
    plant_id: Optional[int]
    animal_id: Optional[int]
    weather_dependent: bool
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# Routes
@router.get("/", response_model=List[TaskResponse])
async def list_tasks(
    category: Optional[TaskCategory] = None,
    completed: Optional[bool] = None,
    priority: Optional[int] = None,
    limit: int = Query(default=100, le=500),
    db: AsyncSession = Depends(get_db),
):
    """List all tasks with optional filtering"""
    query = select(Task).where(Task.is_active == True)

    if category:
        query = query.where(Task.category == category)
    if completed is not None:
        query = query.where(Task.is_completed == completed)
    if priority:
        query = query.where(Task.priority == priority)

    query = query.order_by(Task.due_date, Task.priority).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=TaskResponse)
async def create_task(task: TaskCreate, db: AsyncSession = Depends(get_db)):
    """Create a new task"""
    db_task = Task(**task.model_dump())
    db.add(db_task)
    await db.commit()
    await db.refresh(db_task)

    # Sync to calendar if enabled
    calendar_service = await get_calendar_service(db)
    if calendar_service:
        await calendar_service.sync_task_to_calendar(db_task)

    return db_task


@router.get("/today/", response_model=List[TaskResponse])
async def get_todays_tasks(db: AsyncSession = Depends(get_db)):
    """Get all tasks due today"""
    today = date.today()
    result = await db.execute(
        select(Task)
        .where(Task.due_date == today)
        .where(Task.is_active == True)
        .order_by(Task.priority, Task.due_time)
    )
    return result.scalars().all()


@router.get("/upcoming/", response_model=List[TaskResponse])
async def get_upcoming_tasks(
    days: int = Query(default=7, le=90),
    db: AsyncSession = Depends(get_db),
):
    """Get tasks due in the next X days"""
    today = date.today()
    end_date = today + timedelta(days=days)
    result = await db.execute(
        select(Task)
        .where(Task.due_date >= today)
        .where(Task.due_date <= end_date)
        .where(Task.is_active == True)
        .where(Task.is_completed == False)
        .order_by(Task.due_date, Task.priority)
    )
    return result.scalars().all()


@router.get("/overdue/", response_model=List[TaskResponse])
async def get_overdue_tasks(db: AsyncSession = Depends(get_db)):
    """Get all overdue tasks"""
    today = date.today()
    result = await db.execute(
        select(Task)
        .where(Task.due_date < today)
        .where(Task.is_completed == False)
        .where(Task.is_active == True)
        .order_by(Task.due_date, Task.priority)
    )
    return result.scalars().all()


@router.get("/calendar/", response_model=List[TaskResponse])
async def get_calendar_tasks(
    start_date: date,
    end_date: date,
    db: AsyncSession = Depends(get_db),
):
    """Get tasks for a date range (for calendar view)"""
    result = await db.execute(
        select(Task)
        .where(Task.due_date >= start_date)
        .where(Task.due_date <= end_date)
        .where(Task.is_active == True)
        .order_by(Task.due_date, Task.priority)
    )
    return result.scalars().all()


@router.get("/{task_id}/", response_model=TaskResponse)
async def get_task(task_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific task by ID"""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.patch("/{task_id}/", response_model=TaskResponse)
async def update_task(
    task_id: int,
    updates: TaskUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a task"""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(task, field, value)

    # If marking as completed, set completed_at
    if updates.is_completed:
        task.completed_at = datetime.utcnow()
        task.completion_count = (task.completion_count or 0) + 1
        task.last_completed = datetime.utcnow()

    task.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(task)

    # Sync to calendar if enabled
    calendar_service = await get_calendar_service(db)
    if calendar_service:
        await calendar_service.sync_task_to_calendar(task)

    return task


@router.post("/{task_id}/complete/", response_model=TaskResponse)
async def complete_task(task_id: int, db: AsyncSession = Depends(get_db)):
    """Mark a task as completed"""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.is_completed = True
    task.completed_at = datetime.utcnow()
    task.completion_count = (task.completion_count or 0) + 1
    task.last_completed = datetime.utcnow()
    task.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(task)

    # Sync to calendar if enabled
    calendar_service = await get_calendar_service(db)
    if calendar_service:
        await calendar_service.sync_task_to_calendar(task)

    return task


@router.post("/{task_id}/uncomplete/", response_model=TaskResponse)
async def uncomplete_task(task_id: int, db: AsyncSession = Depends(get_db)):
    """Mark a task as not completed"""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.is_completed = False
    task.completed_at = None
    task.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(task)

    # Sync to calendar if enabled
    calendar_service = await get_calendar_service(db)
    if calendar_service:
        await calendar_service.sync_task_to_calendar(task)

    return task


@router.delete("/{task_id}/")
async def delete_task(task_id: int, db: AsyncSession = Depends(get_db)):
    """Deactivate a task (soft delete)"""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Delete from calendar if enabled (pass calendar_uid for iPhone-originated items)
    calendar_service = await get_calendar_service(db)
    if calendar_service:
        await calendar_service.delete_task_from_calendar(task.id, calendar_uid=task.calendar_uid)

    task.is_active = False
    task.updated_at = datetime.utcnow()
    await db.commit()
    return {"message": "Task deactivated"}


@router.post("/setup-maintenance/")
async def setup_florida_maintenance_tasks(db: AsyncSession = Depends(get_db)):
    """Initialize Florida home maintenance tasks"""
    created = 0
    today = date.today()

    for task_template in FLORIDA_MAINTENANCE_TASKS:
        # Check if task already exists
        result = await db.execute(
            select(Task).where(Task.title == task_template["title"])
        )
        if result.scalar_one_or_none():
            continue

        # Calculate initial due date
        due_date = today
        if task_template.get("recurrence_month"):
            # Set to next occurrence of that month
            month = task_template["recurrence_month"]
            day = task_template.get("recurrence_day", 1)
            due_date = date(today.year, month, min(day, 28))
            if due_date < today:
                due_date = date(today.year + 1, month, min(day, 28))

        task = Task(
            title=task_template["title"],
            description=task_template["description"],
            category=task_template["category"],
            recurrence=task_template["recurrence"],
            recurrence_month=task_template.get("recurrence_month"),
            priority=task_template["priority"],
            due_date=due_date,
            notify_email=True,
            notify_days_before=3,
        )
        db.add(task)
        created += 1

    await db.commit()
    return {"message": f"Created {created} maintenance tasks"}


@router.get("/by-category/{category}/", response_model=List[TaskResponse])
async def get_tasks_by_category(
    category: TaskCategory,
    include_completed: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """Get all tasks in a category"""
    query = select(Task).where(Task.category == category).where(Task.is_active == True)

    if not include_completed:
        query = query.where(Task.is_completed == False)

    query = query.order_by(Task.due_date, Task.priority)
    result = await db.execute(query)
    return result.scalars().all()


# CalDAV Sync
@router.get("/caldav/status/")
async def get_caldav_status():
    """Get CalDAV sync status"""
    return {
        "configured": caldav_service.is_configured(),
        "connected": caldav_service._initialized,
    }


@router.post("/caldav/sync/")
async def sync_tasks_to_caldav(db: AsyncSession = Depends(get_db)):
    """Sync all active tasks to CalDAV calendar"""
    if not caldav_service.is_configured():
        raise HTTPException(
            status_code=400,
            detail="CalDAV not configured. Set CALDAV_URL, CALDAV_USERNAME, and CALDAV_PASSWORD in .env"
        )

    # Get all active, incomplete tasks
    result = await db.execute(
        select(Task)
        .where(Task.is_active == True)
        .where(Task.is_completed == False)
    )
    tasks = result.scalars().all()

    sync_result = await caldav_service.sync_all_tasks(tasks)
    return sync_result


@router.post("/caldav/sync/{task_id}/")
async def sync_single_task(task_id: int, db: AsyncSession = Depends(get_db)):
    """Sync a single task to CalDAV"""
    if not caldav_service.is_configured():
        raise HTTPException(status_code=400, detail="CalDAV not configured")

    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    success = await caldav_service.sync_task(task)
    if success:
        return {"message": "Task synced to CalDAV"}
    raise HTTPException(status_code=500, detail="Failed to sync task")
