"""
User Authentication Model
Supports role-based access control with customizable roles and permissions
"""

from datetime import datetime
from enum import Enum
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum as SQLEnum, Text, JSON
from sqlalchemy.orm import relationship

from .database import Base


class UserRole(str, Enum):
    """User role levels for access control"""
    ADMIN = "admin"      # Full access - can manage users and all content
    EDITOR = "editor"    # Can create, edit, and delete content
    VIEWER = "viewer"    # Read-only access (for farm sitters)


class Role(Base):
    """Custom role with granular permissions"""
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False, index=True)
    display_name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String(20), default="#6B7280")  # Tailwind gray-500

    # Permissions as JSON - flexible structure
    permissions = Column(JSON, default=dict)

    # Built-in role flag (cannot be deleted)
    is_builtin = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Role {self.name}>"

    def has_permission(self, permission: str) -> bool:
        """Check if role has a specific permission"""
        if not self.permissions:
            return False
        # Support dot notation like 'animals.create'
        parts = permission.split('.')
        current = self.permissions
        for part in parts:
            if isinstance(current, dict) and part in current:
                current = current[part]
            else:
                return False
        return bool(current)


# Default permissions structure
DEFAULT_PERMISSIONS = {
    "admin": {
        "users": {"view": True, "create": True, "edit": True, "delete": True},
        "roles": {"view": True, "create": True, "edit": True, "delete": True},
        "settings": {"view": True, "edit": True, "email": True, "calendar": True},
        "animals": {"view": True, "create": True, "edit": True, "delete": True},
        "plants": {"view": True, "create": True, "edit": True, "delete": True},
        "tasks": {"view": True, "create": True, "edit": True, "delete": True},
        "equipment": {"view": True, "create": True, "edit": True, "delete": True},
        "vehicles": {"view": True, "create": True, "edit": True, "delete": True},
        "production": {"view": True, "create": True, "edit": True, "delete": True},
    },
    "editor": {
        "users": {"view": False, "create": False, "edit": False, "delete": False},
        "roles": {"view": False, "create": False, "edit": False, "delete": False},
        "settings": {"view": True, "edit": False, "email": False, "calendar": False},
        "animals": {"view": True, "create": True, "edit": True, "delete": True},
        "plants": {"view": True, "create": True, "edit": True, "delete": True},
        "tasks": {"view": True, "create": True, "edit": True, "delete": True},
        "equipment": {"view": True, "create": True, "edit": True, "delete": True},
        "vehicles": {"view": True, "create": True, "edit": True, "delete": True},
        "production": {"view": True, "create": True, "edit": True, "delete": True},
    },
    "viewer": {
        "users": {"view": False, "create": False, "edit": False, "delete": False},
        "roles": {"view": False, "create": False, "edit": False, "delete": False},
        "settings": {"view": True, "edit": False, "email": False, "calendar": False},
        "animals": {"view": True, "create": False, "edit": False, "delete": False},
        "plants": {"view": True, "create": False, "edit": False, "delete": False},
        "tasks": {"view": True, "create": False, "edit": False, "delete": False},
        "equipment": {"view": True, "create": False, "edit": False, "delete": False},
        "vehicles": {"view": True, "create": False, "edit": False, "delete": False},
        "production": {"view": True, "create": False, "edit": False, "delete": False},
    },
}


class User(Base):
    """User account for authentication"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=True, index=True)
    hashed_password = Column(String(255), nullable=True)  # Nullable for kiosk users
    display_name = Column(String(100), nullable=True)
    role = Column(SQLEnum(UserRole), default=UserRole.VIEWER, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_kiosk = Column(Boolean, default=False, nullable=False)  # Kiosk users login without password

    # Session tracking
    last_login = Column(DateTime, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<User {self.username} ({self.role.value})>"

    @property
    def is_admin(self) -> bool:
        return self.role == UserRole.ADMIN

    @property
    def can_edit(self) -> bool:
        return self.role in (UserRole.ADMIN, UserRole.EDITOR)

    @property
    def can_view(self) -> bool:
        return self.is_active


class Session(Base):
    """User session for token-based auth"""
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    token = Column(String(255), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    ip_address = Column(String(45), nullable=True)  # IPv6 can be up to 45 chars
    user_agent = Column(String(500), nullable=True)

    def __repr__(self):
        return f"<Session user_id={self.user_id}>"

    @property
    def is_expired(self) -> bool:
        return datetime.utcnow() > self.expires_at
