"""
Audit Logging Service
Logs critical security operations for compliance and monitoring
"""

from datetime import datetime
from typing import Optional
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Request
from loguru import logger

from models.users import AuditLog, AuditAction
from models.database import async_session


async def log_audit(
    action: AuditAction,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    request: Optional[Request] = None,
    details: Optional[dict] = None,
    success: bool = True,
    db: Optional[AsyncSession] = None
) -> AuditLog:
    """
    Log an auditable action.

    Args:
        action: The type of action being logged
        user_id: ID of the user performing the action (None for failed logins)
        username: Username (useful for failed logins where user_id is unknown)
        request: FastAPI request object to extract IP and user agent
        details: Additional context as a dict
        success: Whether the action succeeded
        db: Optional database session (creates new one if not provided)

    Returns:
        The created AuditLog entry
    """
    ip_address = None
    user_agent = None

    if request:
        # Get real IP from X-Forwarded-For if behind proxy, otherwise use client host
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            ip_address = forwarded.split(",")[0].strip()
        else:
            ip_address = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent", "")[:500]

    audit_log = AuditLog(
        timestamp=datetime.utcnow(),
        action=action,
        user_id=user_id,
        username=username,
        ip_address=ip_address,
        user_agent=user_agent,
        details=details,
        success=success
    )

    try:
        if db:
            db.add(audit_log)
            await db.commit()
            await db.refresh(audit_log)
        else:
            async with async_session() as session:
                session.add(audit_log)
                await session.commit()
                await session.refresh(audit_log)

        logger.info(f"Audit log created: action={action.value}, user_id={user_id}, username={username}, success={success}")
        return audit_log
    except Exception as e:
        logger.error(f"Failed to create audit log: action={action.value}, user_id={user_id}, username={username}, error={e}")
        raise


async def get_audit_logs(
    db: AsyncSession,
    limit: int = 100,
    offset: int = 0,
    action: Optional[AuditAction] = None,
    user_id: Optional[int] = None,
    success_only: Optional[bool] = None
) -> list[AuditLog]:
    """
    Retrieve audit logs with optional filtering.

    Args:
        db: Database session
        limit: Maximum number of logs to return
        offset: Number of logs to skip
        action: Filter by action type
        user_id: Filter by user ID
        success_only: If True, only successful actions; if False, only failures

    Returns:
        List of AuditLog entries
    """
    query = select(AuditLog).order_by(desc(AuditLog.timestamp))

    if action:
        query = query.where(AuditLog.action == action)
    if user_id is not None:
        query = query.where(AuditLog.user_id == user_id)
    if success_only is not None:
        query = query.where(AuditLog.success == success_only)

    query = query.offset(offset).limit(limit)

    result = await db.execute(query)
    return result.scalars().all()


async def cleanup_old_audit_logs(db: AsyncSession, days: int = 90) -> int:
    """
    Remove audit logs older than specified days.

    Args:
        db: Database session
        days: Number of days to retain logs

    Returns:
        Number of logs deleted
    """
    from datetime import timedelta
    cutoff = datetime.utcnow() - timedelta(days=days)

    try:
        result = await db.execute(
            select(AuditLog).where(AuditLog.timestamp < cutoff)
        )
        logs = result.scalars().all()
        count = len(logs)

        for log in logs:
            await db.delete(log)

        await db.commit()
        logger.info(f"Cleaned up {count} audit logs older than {days} days (cutoff: {cutoff.isoformat()})")
        return count
    except Exception as e:
        logger.error(f"Failed to clean up audit logs older than {days} days: {e}")
        raise
