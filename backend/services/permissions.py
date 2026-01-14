"""
Permission checking service
Validates user permissions based on their role's granular permissions
"""

from typing import Optional, Callable
from functools import wraps

from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.database import get_db
from models.users import User, Role, DEFAULT_PERMISSIONS


async def get_user_permissions(user: User, db: AsyncSession) -> dict:
    """Get the full permissions dict for a user based on their role.

    Falls back to DEFAULT_PERMISSIONS if role not found in database.
    """
    role_name = user.role.value  # e.g., "admin", "editor", "viewer"

    # Special handling for kiosk and farmhand users
    if user.is_kiosk:
        role_name = "kiosk"
    elif user.is_farmhand:
        role_name = "farmhand"

    # Try to get from database first
    result = await db.execute(
        select(Role).where(Role.name == role_name)
    )
    role = result.scalar_one_or_none()

    if role and role.permissions:
        return role.permissions

    # Fall back to defaults
    return DEFAULT_PERMISSIONS.get(role_name, {})


def has_permission(permissions: dict, category: str, action: str) -> bool:
    """Check if permissions dict grants access to category.action"""
    if not permissions:
        return False

    category_perms = permissions.get(category, {})
    if isinstance(category_perms, dict):
        return category_perms.get(action, False)
    return False


async def check_permission(
    user: User,
    db: AsyncSession,
    category: str,
    action: str
) -> bool:
    """Check if user has a specific permission."""
    permissions = await get_user_permissions(user, db)
    return has_permission(permissions, category, action)


def require_permission(category: str, action: str):
    """
    Factory function to create a FastAPI dependency that checks for a specific permission.

    Usage:
        @router.post("/tasks/")
        async def create_task(user: User = Depends(require_permission("tasks", "create"))):
            ...
    """
    from routers.auth import require_auth

    async def permission_checker(
        user: User = Depends(require_auth),
        db: AsyncSession = Depends(get_db)
    ) -> User:
        has_perm = await check_permission(user, db, category, action)

        if not has_perm:
            raise HTTPException(
                status_code=403,
                detail="Permission denied"
            )

        return user

    return permission_checker


# Convenience functions for common permission checks
def require_view(category: str):
    """Require view permission for a category"""
    return require_permission(category, "view")

def require_create(category: str):
    """Require create permission for a category"""
    return require_permission(category, "create")

def require_interact(category: str):
    """Require interact permission for a category (complete tasks, add notes, etc.)"""
    return require_permission(category, "interact")

def require_edit(category: str):
    """Require edit permission for a category"""
    return require_permission(category, "edit")

def require_delete(category: str):
    """Require delete permission for a category"""
    return require_permission(category, "delete")
