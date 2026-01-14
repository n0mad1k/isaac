"""
Dev Tracker API Routes - For QA testing and feature tracking (Dev instance only)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime, timedelta

from models.database import get_db
from models.dev_tracker import DevTrackerItem, DevTrackerMetrics, ItemType, ItemPriority, ItemStatus
from config import settings


router = APIRouter(prefix="/dev-tracker", tags=["Dev Tracker"])


# Pydantic Schemas
class ItemCreate(BaseModel):
    item_type: ItemType = ItemType.TEST
    priority: ItemPriority = ItemPriority.MEDIUM
    title: str = Field(..., min_length=1, max_length=2000)  # Allow paragraph-length descriptions
    description: Optional[str] = None
    version: Optional[str] = None
    requires_collab: Optional[bool] = False  # When True, Claude must work interactively with user


class ItemUpdate(BaseModel):
    item_type: Optional[ItemType] = None
    priority: Optional[ItemPriority] = None
    status: Optional[ItemStatus] = None
    title: Optional[str] = Field(None, min_length=1, max_length=2000)
    description: Optional[str] = None
    version: Optional[str] = None
    test_notes: Optional[str] = None
    fail_note: Optional[str] = None
    requires_collab: Optional[bool] = None  # When True, Claude must work interactively with user


class ItemResponse(BaseModel):
    id: int
    item_type: ItemType
    priority: ItemPriority
    status: ItemStatus
    title: str
    description: Optional[str]
    version: Optional[str]
    test_notes: Optional[str]
    fail_note: Optional[str]
    fail_count: Optional[int]
    requires_collab: Optional[bool] = False  # When True, Claude must work interactively with user
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]
    is_archived: Optional[bool] = False
    archived_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MetricsResponse(BaseModel):
    # Current stats
    total_items: int
    pending: int
    testing: int
    verified: int
    # Today's activity
    completed_today: int
    created_today: int
    # Historical
    completed_this_week: int
    completed_this_month: int
    avg_items_per_day: float
    # By priority
    by_priority: dict


def check_dev_only():
    """Ensure this is only accessible on dev instance"""
    if not settings.is_dev_instance:
        raise HTTPException(status_code=403, detail="Dev Tracker is only available on dev instance")


async def archive_old_items(db: AsyncSession):
    """Archive verified items older than 30 days"""
    cutoff = datetime.utcnow() - timedelta(days=30)
    result = await db.execute(
        select(DevTrackerItem).where(
            and_(
                DevTrackerItem.status.in_([ItemStatus.VERIFIED, ItemStatus.DONE]),
                DevTrackerItem.completed_at < cutoff,
                DevTrackerItem.is_archived == False
            )
        )
    )
    old_items = result.scalars().all()

    for item in old_items:
        item.is_archived = True
        item.archived_at = datetime.utcnow()

    if old_items:
        await db.commit()

    return len(old_items)


# Routes
@router.get("/", response_model=List[ItemResponse])
async def get_all_items(
    item_type: Optional[ItemType] = None,
    status: Optional[ItemStatus] = None,
    version: Optional[str] = None,
    include_archived: bool = False,
    db: AsyncSession = Depends(get_db)
):
    """Get all dev tracker items"""
    check_dev_only()

    # Auto-archive old items on each request
    await archive_old_items(db)

    query = select(DevTrackerItem)

    # Filter out archived by default
    if not include_archived:
        query = query.where(
            (DevTrackerItem.is_archived == False) | (DevTrackerItem.is_archived == None)
        )

    if item_type:
        query = query.where(DevTrackerItem.item_type == item_type)
    if status:
        query = query.where(DevTrackerItem.status == status)
    if version:
        query = query.where(DevTrackerItem.version == version)

    # Order: by status (pending first), then priority (critical first), then created
    query = query.order_by(
        DevTrackerItem.status.asc(),
        DevTrackerItem.priority.desc(),
        DevTrackerItem.created_at.desc()
    )

    result = await db.execute(query)
    items = result.scalars().all()

    return items


@router.get("/stats/summary")
async def get_stats(db: AsyncSession = Depends(get_db)):
    """Get summary statistics"""
    check_dev_only()

    result = await db.execute(select(DevTrackerItem))
    items = result.scalars().all()

    stats = {
        "total": len(items),
        "by_type": {},
        "by_status": {},
        "by_priority": {},
    }

    for item in items:
        t = item.item_type.value
        stats["by_type"][t] = stats["by_type"].get(t, 0) + 1
        s = item.status.value
        stats["by_status"][s] = stats["by_status"].get(s, 0) + 1
        p = item.priority.value
        stats["by_priority"][p] = stats["by_priority"].get(p, 0) + 1

    return stats


@router.get("/metrics/", response_model=MetricsResponse)
async def get_metrics(db: AsyncSession = Depends(get_db)):
    """Get comprehensive metrics including historical data"""
    check_dev_only()

    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)
    month_start = today_start - timedelta(days=30)

    result = await db.execute(select(DevTrackerItem))
    all_items = result.scalars().all()

    active_items = [i for i in all_items if not i.is_archived]
    pending = len([i for i in active_items if i.status in [ItemStatus.PENDING, ItemStatus.IN_PROGRESS]])
    testing = len([i for i in active_items if i.status == ItemStatus.TESTING])
    verified = len([i for i in active_items if i.status in [ItemStatus.VERIFIED, ItemStatus.DONE]])

    completed_today = len([i for i in all_items if i.completed_at and i.completed_at >= today_start])
    created_today = len([i for i in all_items if i.created_at and i.created_at >= today_start])
    completed_this_week = len([i for i in all_items if i.completed_at and i.completed_at >= week_start])
    completed_this_month = len([i for i in all_items if i.completed_at and i.completed_at >= month_start])

    completed_items = [i for i in all_items if i.completed_at]
    if completed_items:
        oldest = min(i.completed_at for i in completed_items)
        days_span = max((now - oldest).days, 1)
        avg_items_per_day = round(len(completed_items) / days_span, 1)
    else:
        avg_items_per_day = 0.0

    by_priority = {
        "critical": len([i for i in all_items if i.priority == ItemPriority.CRITICAL and i.status in [ItemStatus.VERIFIED, ItemStatus.DONE]]),
        "high": len([i for i in all_items if i.priority == ItemPriority.HIGH and i.status in [ItemStatus.VERIFIED, ItemStatus.DONE]]),
        "medium": len([i for i in all_items if i.priority == ItemPriority.MEDIUM and i.status in [ItemStatus.VERIFIED, ItemStatus.DONE]]),
        "low": len([i for i in all_items if i.priority == ItemPriority.LOW and i.status in [ItemStatus.VERIFIED, ItemStatus.DONE]]),
    }

    return MetricsResponse(
        total_items=len(all_items),
        pending=pending,
        testing=testing,
        verified=verified,
        completed_today=completed_today,
        created_today=created_today,
        completed_this_week=completed_this_week,
        completed_this_month=completed_this_month,
        avg_items_per_day=avg_items_per_day,
        by_priority=by_priority,
    )


@router.get("/{item_id}", response_model=ItemResponse)
async def get_item(item_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific item"""
    check_dev_only()

    result = await db.execute(
        select(DevTrackerItem).where(DevTrackerItem.id == item_id)
    )
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    return item


@router.post("/", response_model=ItemResponse)
async def create_item(data: ItemCreate, db: AsyncSession = Depends(get_db)):
    """Create a new tracker item"""
    check_dev_only()

    item = DevTrackerItem(
        item_type=data.item_type,
        priority=data.priority,
        title=data.title,
        description=data.description,
        version=data.version,
        requires_collab=data.requires_collab,
    )

    db.add(item)
    await db.commit()
    await db.refresh(item)

    return item


@router.put("/{item_id}", response_model=ItemResponse)
async def update_item(item_id: int, data: ItemUpdate, db: AsyncSession = Depends(get_db)):
    """Update an item"""
    check_dev_only()

    result = await db.execute(
        select(DevTrackerItem).where(DevTrackerItem.id == item_id)
    )
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    update_data = data.model_dump(exclude_unset=True)

    # Track completion time
    if 'status' in update_data:
        new_status = update_data['status']
        if new_status in [ItemStatus.VERIFIED, ItemStatus.DONE] and not item.completed_at:
            item.completed_at = datetime.utcnow()
        elif new_status not in [ItemStatus.VERIFIED, ItemStatus.DONE]:
            item.completed_at = None

        # Track fail_count when failing, clear fail_note on success
        if new_status == ItemStatus.PENDING and 'fail_note' in update_data and update_data['fail_note']:
            # Increment fail count when marking as failed
            item.fail_count = (item.fail_count or 0) + 1
        elif new_status == ItemStatus.TESTING:
            # Clear fail note when moving to testing (successful fix)
            item.fail_note = None

    for key, value in update_data.items():
        setattr(item, key, value)

    await db.commit()
    await db.refresh(item)

    return item


@router.delete("/{item_id}")
async def delete_item(item_id: int, db: AsyncSession = Depends(get_db)):
    """Delete an item"""
    check_dev_only()

    result = await db.execute(
        select(DevTrackerItem).where(DevTrackerItem.id == item_id)
    )
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    await db.delete(item)
    await db.commit()

    return {"message": "Item deleted"}


@router.post("/seed-from-changelog")
async def seed_from_changelog(version: str, db: AsyncSession = Depends(get_db)):
    """Seed test items from changelog for a specific version"""
    check_dev_only()

    import os
    import re

    # Read changelog
    changelog_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "CHANGELOG.md")
    try:
        with open(changelog_path, "r") as f:
            changelog = f.read()
    except:
        raise HTTPException(status_code=500, detail="Could not read CHANGELOG.md")

    # Find the version section
    version_pattern = rf"## \[{re.escape(version)}\].*?\n(.*?)(?=\n## \[|$)"
    match = re.search(version_pattern, changelog, re.DOTALL)

    if not match:
        raise HTTPException(status_code=404, detail=f"Version {version} not found in changelog")

    section = match.group(1)
    items_created = 0

    # Extract bullet points
    for line in section.split('\n'):
        line = line.strip()
        if line.startswith('- '):
            title = line[2:].strip()
            # Skip sub-items (those that are indented further)
            if len(title) > 0 and not title.startswith('-'):
                # Check if already exists
                result = await db.execute(
                    select(DevTrackerItem)
                    .where(DevTrackerItem.title == title)
                    .where(DevTrackerItem.version == version)
                )
                existing = result.scalar_one_or_none()

                if not existing:
                    # Determine type based on content
                    item_type = ItemType.TEST
                    if "fix" in title.lower():
                        item_type = ItemType.BUG

                    item = DevTrackerItem(
                        item_type=item_type,
                        priority=ItemPriority.MEDIUM,
                        title=title[:200],  # Truncate if needed
                        version=version,
                        status=ItemStatus.TESTING,
                    )
                    db.add(item)
                    items_created += 1

    await db.commit()

    return {"message": f"Created {items_created} test items for version {version}"}
