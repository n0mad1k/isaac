"""
Customer Feedback API Routes
Allows production users to submit feedback that can be pulled into dev tracker
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime

from models.database import get_db
from models.customer_feedback import CustomerFeedback, FeedbackType, FeedbackStatus
from models.dev_tracker import DevTrackerItem, ItemType, ItemPriority, ItemStatus
from routers.settings import get_setting
from routers.auth import require_admin, get_current_user
from models.users import User
from config import settings as app_settings


router = APIRouter(prefix="/feedback", tags=["Customer Feedback"])


# Pydantic models
class FeedbackCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    feedback_type: str = Field(default="feature")
    submitted_by: Optional[str] = Field(None, max_length=100)


class FeedbackResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    feedback_type: str
    status: str
    submitted_by: Optional[str]
    created_at: datetime


@router.get("/enabled/")
async def check_feedback_enabled(db: AsyncSession = Depends(get_db)):
    """Check if customer feedback is enabled (public endpoint)"""
    enabled = await get_setting(db, "customer_feedback_enabled")
    return {"enabled": enabled == "true"}


@router.post("/submit/")
async def submit_feedback(
    feedback: FeedbackCreate,
    db: AsyncSession = Depends(get_db)
):
    """Submit customer feedback (only works when enabled)"""
    # Check if feedback is enabled
    enabled = await get_setting(db, "customer_feedback_enabled")
    if enabled != "true":
        raise HTTPException(
            status_code=403,
            detail="Customer feedback is currently disabled"
        )

    # Validate feedback type
    try:
        fb_type = FeedbackType(feedback.feedback_type)
    except ValueError:
        fb_type = FeedbackType.OTHER

    # Create feedback entry
    new_feedback = CustomerFeedback(
        title=feedback.title,
        description=feedback.description,
        feedback_type=fb_type,
        submitted_by=feedback.submitted_by,
        status=FeedbackStatus.NEW,
    )

    db.add(new_feedback)
    await db.commit()
    await db.refresh(new_feedback)

    return {
        "message": "Feedback submitted successfully",
        "id": new_feedback.id
    }


@router.get("/")
async def list_feedback(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """List all feedback (admin only, typically used on dev)"""
    query = select(CustomerFeedback).order_by(CustomerFeedback.created_at.desc())

    if status:
        try:
            fb_status = FeedbackStatus(status)
            query = query.where(CustomerFeedback.status == fb_status)
        except ValueError:
            pass

    result = await db.execute(query)
    feedbacks = result.scalars().all()

    return [
        {
            "id": f.id,
            "title": f.title,
            "description": f.description,
            "feedback_type": f.feedback_type.value,
            "status": f.status.value,
            "submitted_by": f.submitted_by,
            "created_at": f.created_at.isoformat(),
            "pulled_at": f.pulled_at.isoformat() if f.pulled_at else None,
        }
        for f in feedbacks
    ]


@router.post("/pull-to-tracker/")
async def pull_feedback_to_tracker(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Pull all new feedback into dev tracker (dev instance only)"""
    if not app_settings.is_dev_instance:
        raise HTTPException(
            status_code=403,
            detail="This action is only available on the dev instance"
        )

    # Get all NEW feedback
    result = await db.execute(
        select(CustomerFeedback).where(CustomerFeedback.status == FeedbackStatus.NEW)
    )
    feedbacks = result.scalars().all()

    if not feedbacks:
        return {"message": "No new feedback to pull", "pulled": 0}

    pulled_count = 0
    for feedback in feedbacks:
        # Map feedback type to dev tracker item type
        item_type = ItemType.FEATURE
        if feedback.feedback_type == FeedbackType.BUG:
            item_type = ItemType.BUG
        elif feedback.feedback_type == FeedbackType.IMPROVEMENT:
            item_type = ItemType.ENHANCEMENT

        # Create dev tracker item
        tracker_item = DevTrackerItem(
            item_type=item_type,
            priority=ItemPriority.MEDIUM,
            status=ItemStatus.PENDING,
            title=f"[User Feedback] {feedback.title}",
            description=feedback.description or "",
        )
        db.add(tracker_item)

        # Mark feedback as pulled
        feedback.status = FeedbackStatus.PULLED
        feedback.pulled_at = datetime.utcnow()

        pulled_count += 1

    await db.commit()

    return {
        "message": f"Pulled {pulled_count} feedback items to dev tracker",
        "pulled": pulled_count
    }


@router.get("/prod-list/")
async def list_prod_feedback(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """List pending feedback from production database (dev instance only)"""
    import sqlite3
    import os

    if not app_settings.is_dev_instance:
        raise HTTPException(
            status_code=403,
            detail="This action is only available on the dev instance"
        )

    prod_db_path = "/opt/levi/backend/data/levi.db"

    if not os.path.exists(prod_db_path):
        return []

    try:
        conn = sqlite3.connect(prod_db_path)
        cursor = conn.cursor()

        # Check if customer_feedback table exists
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='customer_feedback'"
        )
        if not cursor.fetchone():
            conn.close()
            return []

        # Get new feedback from prod (include kickback so user can respond)
        cursor.execute("""
            SELECT id, title, description, feedback_type, submitted_by, created_at, status, admin_response
            FROM customer_feedback
            WHERE status IN ('new', 'kickback')
            ORDER BY created_at DESC
        """)
        feedbacks = cursor.fetchall()
        conn.close()

        return [
            {
                "id": row[0],
                "title": row[1],
                "description": row[2],
                "feedback_type": row[3],
                "submitted_by": row[4],
                "created_at": row[5],
                "status": row[6] if len(row) > 6 else "new",
                "admin_response": row[7] if len(row) > 7 else None
            }
            for row in feedbacks
        ]

    except Exception as e:
        return []


class FeedbackReviewRequest(BaseModel):
    action: str  # approve, decline, kickback
    note: Optional[str] = None  # Required for decline/kickback
    priority: Optional[str] = "medium"  # For approve - what priority in dev tracker


@router.post("/review/{feedback_id}/")
async def review_feedback(
    feedback_id: int,
    review: FeedbackReviewRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Review feedback from production - approve, decline, or kickback (dev instance only)"""
    import sqlite3
    import os
    from datetime import datetime

    if not app_settings.is_dev_instance:
        raise HTTPException(
            status_code=403,
            detail="This action is only available on the dev instance"
        )

    prod_db_path = "/opt/levi/backend/data/levi.db"

    if not os.path.exists(prod_db_path):
        raise HTTPException(status_code=404, detail="Production database not found")

    if review.action not in ['approve', 'decline', 'kickback']:
        raise HTTPException(status_code=400, detail="Invalid action. Use: approve, decline, kickback")

    if review.action in ['decline', 'kickback'] and not review.note:
        raise HTTPException(status_code=400, detail=f"Note is required when {review.action}ing feedback")

    try:
        conn = sqlite3.connect(prod_db_path)
        cursor = conn.cursor()

        # Get the feedback
        cursor.execute(
            "SELECT id, title, description, feedback_type, submitted_by FROM customer_feedback WHERE id = ?",
            (feedback_id,)
        )
        row = cursor.fetchone()

        if not row:
            conn.close()
            raise HTTPException(status_code=404, detail="Feedback not found")

        prod_id, title, description, fb_type, submitted_by = row

        if review.action == 'approve':
            # Create dev tracker item
            item_type = ItemType.FEATURE
            if fb_type == 'bug':
                item_type = ItemType.BUG
            elif fb_type == 'improvement':
                item_type = ItemType.ENHANCEMENT

            priority_map = {
                'critical': ItemPriority.CRITICAL,
                'high': ItemPriority.HIGH,
                'medium': ItemPriority.MEDIUM,
                'low': ItemPriority.LOW
            }
            priority = priority_map.get(review.priority, ItemPriority.MEDIUM)

            tracker_item = DevTrackerItem(
                item_type=item_type,
                priority=priority,
                title=title,
                description=f"{description}\n\n[From user feedback by {submitted_by or 'Anonymous'}]" if description else f"[From user feedback by {submitted_by or 'Anonymous'}]",
                status=ItemStatus.PENDING,
            )
            db.add(tracker_item)
            await db.commit()

            # Update prod feedback status
            cursor.execute(
                "UPDATE customer_feedback SET status = 'approved', reviewed_at = ? WHERE id = ?",
                (datetime.utcnow().isoformat(), feedback_id)
            )
            conn.commit()
            conn.close()

            return {"message": f"Feedback approved and added to dev tracker", "tracker_id": tracker_item.id}

        elif review.action == 'decline':
            cursor.execute(
                "UPDATE customer_feedback SET status = 'declined', admin_response = ?, reviewed_at = ? WHERE id = ?",
                (review.note, datetime.utcnow().isoformat(), feedback_id)
            )
            conn.commit()
            conn.close()

            return {"message": "Feedback declined"}

        elif review.action == 'kickback':
            cursor.execute(
                "UPDATE customer_feedback SET status = 'kickback', admin_response = ?, reviewed_at = ? WHERE id = ?",
                (review.note, datetime.utcnow().isoformat(), feedback_id)
            )
            conn.commit()
            conn.close()

            return {"message": "Feedback kicked back to user for more info"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pull-from-prod/")
async def pull_feedback_from_prod(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Pull feedback from production database into dev (dev instance only)"""
    import sqlite3
    import os

    if not app_settings.is_dev_instance:
        raise HTTPException(
            status_code=403,
            detail="This action is only available on the dev instance"
        )

    prod_db_path = "/opt/levi/backend/data/levi.db"

    if not os.path.exists(prod_db_path):
        raise HTTPException(
            status_code=404,
            detail="Production database not found"
        )

    # Connect to prod database and get NEW feedback
    try:
        conn = sqlite3.connect(prod_db_path)
        cursor = conn.cursor()

        # Check if customer_feedback table exists
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='customer_feedback'"
        )
        if not cursor.fetchone():
            conn.close()
            return {"message": "No feedback table in production yet", "pulled": 0}

        # Get new feedback from prod
        cursor.execute("""
            SELECT id, title, description, feedback_type, submitted_by, created_at
            FROM customer_feedback
            WHERE status = 'NEW'
        """)
        prod_feedbacks = cursor.fetchall()

        if not prod_feedbacks:
            conn.close()
            return {"message": "No new feedback in production", "pulled": 0}

        pulled_count = 0
        prod_ids_to_update = []

        for row in prod_feedbacks:
            prod_id, title, description, fb_type, submitted_by, created_at = row

            # Map feedback type to dev tracker item type
            item_type = ItemType.FEATURE
            if fb_type == 'bug':
                item_type = ItemType.BUG
            elif fb_type == 'improvement':
                item_type = ItemType.ENHANCEMENT

            # Create dev tracker item in dev database
            tracker_item = DevTrackerItem(
                item_type=item_type,
                priority=ItemPriority.MEDIUM,
                status=ItemStatus.PENDING,
                title=f"[User Feedback] {title}",
                description=description or "",
            )
            db.add(tracker_item)

            prod_ids_to_update.append(prod_id)
            pulled_count += 1

        await db.commit()

        # Update prod database to mark as pulled
        for prod_id in prod_ids_to_update:
            cursor.execute(
                "UPDATE customer_feedback SET status = 'PULLED', pulled_at = ? WHERE id = ?",
                (datetime.utcnow().isoformat(), prod_id)
            )
        conn.commit()
        conn.close()

        return {
            "message": f"Pulled {pulled_count} feedback items from production to dev tracker",
            "pulled": pulled_count
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to pull from production: {str(e)}"
        )


@router.delete("/{feedback_id}/")
async def dismiss_feedback(
    feedback_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Dismiss feedback without adding to tracker"""
    result = await db.execute(
        select(CustomerFeedback).where(CustomerFeedback.id == feedback_id)
    )
    feedback = result.scalar_one_or_none()

    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")

    feedback.status = FeedbackStatus.DISMISSED
    await db.commit()

    return {"message": "Feedback dismissed"}


# ==========================================
# User-facing endpoints (for managing own feedback)
# ==========================================

@router.get("/my/")
async def get_my_feedback(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get feedback submitted by the current authenticated user.
    Feedback is filtered by username or display_name matching submitted_by field.
    """
    # Build list of identifiers to match - username and display_name
    user_identifiers = [current_user.username]
    if current_user.display_name:
        user_identifiers.append(current_user.display_name)

    # Get feedback where submitted_by matches any of the user's identifiers
    from sqlalchemy import or_
    result = await db.execute(
        select(CustomerFeedback)
        .where(
            CustomerFeedback.status != FeedbackStatus.DISMISSED,
            or_(
                CustomerFeedback.submitted_by.in_(user_identifiers),
                # Also include feedback submitted with no name (anonymous) if user is admin
            )
        )
        .order_by(CustomerFeedback.created_at.desc())
    )
    feedbacks = result.scalars().all()

    return [
        {
            "id": f.id,
            "title": f.title,
            "description": f.description,
            "feedback_type": f.feedback_type.value,
            "status": f.status.value,
            "admin_response": f.admin_response,
            "submitted_by": f.submitted_by,
            "created_at": f.created_at.isoformat(),
            "reviewed_at": f.reviewed_at.isoformat() if f.reviewed_at else None,
        }
        for f in feedbacks
    ]


class FeedbackUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    feedback_type: Optional[str] = None


@router.put("/my/{feedback_id}/")
async def update_my_feedback(
    feedback_id: int,
    update: FeedbackUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update feedback (only if status is NEW and owned by current user)"""
    # Check if feedback is enabled
    enabled = await get_setting(db, "customer_feedback_enabled")
    if enabled != "true":
        raise HTTPException(
            status_code=403,
            detail="Customer feedback is currently disabled"
        )

    result = await db.execute(
        select(CustomerFeedback).where(CustomerFeedback.id == feedback_id)
    )
    feedback = result.scalar_one_or_none()

    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")

    # Verify ownership - submitted_by must match username or display_name
    user_identifiers = [current_user.username]
    if current_user.display_name:
        user_identifiers.append(current_user.display_name)

    if feedback.submitted_by not in user_identifiers:
        raise HTTPException(
            status_code=403,
            detail="You can only edit your own feedback"
        )

    # Only allow editing if still NEW or KICKBACK (not pulled or dismissed)
    if feedback.status not in [FeedbackStatus.NEW, FeedbackStatus.KICKBACK]:
        raise HTTPException(
            status_code=403,
            detail="Cannot edit feedback that has already been reviewed"
        )

    # Update fields
    if update.title is not None:
        feedback.title = update.title
    if update.description is not None:
        feedback.description = update.description
    if update.feedback_type is not None:
        try:
            feedback.feedback_type = FeedbackType(update.feedback_type)
        except ValueError:
            pass

    await db.commit()
    await db.refresh(feedback)

    return {
        "id": feedback.id,
        "title": feedback.title,
        "description": feedback.description,
        "feedback_type": feedback.feedback_type.value,
        "status": feedback.status.value,
        "submitted_by": feedback.submitted_by,
        "created_at": feedback.created_at.isoformat(),
    }


@router.delete("/my/{feedback_id}/")
async def delete_my_feedback(
    feedback_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete feedback (only if status is NEW and owned by current user)"""
    # Check if feedback is enabled
    enabled = await get_setting(db, "customer_feedback_enabled")
    if enabled != "true":
        raise HTTPException(
            status_code=403,
            detail="Customer feedback is currently disabled"
        )

    result = await db.execute(
        select(CustomerFeedback).where(CustomerFeedback.id == feedback_id)
    )
    feedback = result.scalar_one_or_none()

    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")

    # Verify ownership - submitted_by must match username or display_name
    user_identifiers = [current_user.username]
    if current_user.display_name:
        user_identifiers.append(current_user.display_name)

    if feedback.submitted_by not in user_identifiers:
        raise HTTPException(
            status_code=403,
            detail="You can only delete your own feedback"
        )

    # Only allow deleting if still NEW
    if feedback.status != FeedbackStatus.NEW:
        raise HTTPException(
            status_code=403,
            detail="Cannot delete feedback that has already been reviewed"
        )

    await db.delete(feedback)
    await db.commit()

    return {"message": "Feedback deleted"}


@router.get("/prod-status/")
async def get_prod_feedback_status(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Check if customer feedback is enabled on production (dev instance only)"""
    import sqlite3
    import os

    if not app_settings.is_dev_instance:
        raise HTTPException(
            status_code=403,
            detail="This action is only available on the dev instance"
        )

    prod_db_path = "/opt/levi/backend/data/levi.db"

    if not os.path.exists(prod_db_path):
        return {"enabled": False, "error": "Production database not found"}

    try:
        conn = sqlite3.connect(prod_db_path)
        cursor = conn.cursor()

        cursor.execute(
            "SELECT value FROM app_settings WHERE key = 'customer_feedback_enabled'"
        )
        result = cursor.fetchone()
        conn.close()

        enabled = result and result[0] == "true"
        return {"enabled": enabled}

    except Exception as e:
        return {"enabled": False, "error": str(e)}


@router.post("/toggle-on-prod/")
async def toggle_feedback_on_prod(
    enable: bool,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Toggle customer feedback setting on production (dev instance only)"""
    import sqlite3
    import os

    if not app_settings.is_dev_instance:
        raise HTTPException(
            status_code=403,
            detail="This action is only available on the dev instance"
        )

    prod_db_path = "/opt/levi/backend/data/levi.db"

    if not os.path.exists(prod_db_path):
        raise HTTPException(
            status_code=404,
            detail="Production database not found"
        )

    try:
        conn = sqlite3.connect(prod_db_path)
        cursor = conn.cursor()

        value = "true" if enable else "false"

        # Check if setting exists
        cursor.execute(
            "SELECT id FROM app_settings WHERE key = 'customer_feedback_enabled'"
        )
        existing = cursor.fetchone()

        if existing:
            cursor.execute(
                "UPDATE app_settings SET value = ?, updated_at = ? WHERE key = 'customer_feedback_enabled'",
                (value, datetime.utcnow().isoformat())
            )
        else:
            cursor.execute(
                "INSERT INTO app_settings (key, value, description, updated_at) VALUES (?, ?, ?, ?)",
                (
                    "customer_feedback_enabled",
                    value,
                    "Enable feedback submission button for users",
                    datetime.utcnow().isoformat()
                )
            )

        conn.commit()
        conn.close()

        return {
            "message": f"Customer feedback {'enabled' if enable else 'disabled'} on production",
            "enabled": enable
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to toggle setting on production: {str(e)}"
        )
