"""
User Authentication Model
Supports role-based access control with customizable roles and permissions
"""

from datetime import datetime
from enum import Enum
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum as SQLEnum, Text, JSON
from sqlalchemy.orm import relationship

from .database import Base


def _get_now():
    """Get current time in configured timezone (naive datetime for DB comparison)"""
    try:
        import pytz
        from config import settings
        tz = pytz.timezone(settings.timezone)
        return datetime.now(tz).replace(tzinfo=None)
    except Exception:
        return datetime.utcnow()


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
# "interact" = functional use (complete tasks, log weights, add notes) without full edit access
DEFAULT_PERMISSIONS = {
    "admin": {
        "users": {"view": True, "create": True, "edit": True, "delete": True},
        "roles": {"view": True, "create": True, "edit": True, "delete": True},
        "settings": {"view": True, "edit": True, "email": True, "calendar": True},
        "dashboard": {"view": True},
        "calendar": {"view": True, "create": True, "interact": True, "edit": True, "delete": True},
        "tasks": {"view": True, "create": True, "interact": True, "edit": True, "delete": True},
        "animals": {"view": True, "create": True, "interact": True, "edit": True, "delete": True},
        "plants": {"view": True, "create": True, "interact": True, "edit": True, "delete": True},
        "seeds": {"view": True, "create": True, "interact": True, "edit": True, "delete": True},
        "equipment": {"view": True, "create": True, "interact": True, "edit": True, "delete": True},
        "vehicles": {"view": True, "create": True, "interact": True, "edit": True, "delete": True},
        "home": {"view": True, "create": True, "interact": True, "edit": True, "delete": True},
        "farm": {"view": True, "create": True, "interact": True, "edit": True, "delete": True},
        "production": {"view": True, "create": True, "interact": True, "edit": True, "delete": True},
        "workers": {"view": True, "create": True, "interact": True, "edit": True, "delete": True},
        "budget": {"view": True, "create": True, "edit": True, "delete": True},
        "team": {"view": True, "create": True, "interact": True, "edit": True, "delete": True},
        "garden": {"view": True, "create": True, "interact": True, "edit": True, "delete": True},
        "supply_requests": {"view": True, "create": True, "edit": True, "delete": True},
    },
    "editor": {
        "users": {"view": False, "create": False, "edit": False, "delete": False},
        "roles": {"view": False, "create": False, "edit": False, "delete": False},
        "settings": {"view": True, "edit": False, "email": False, "calendar": False},
        "dashboard": {"view": True},
        "calendar": {"view": True, "create": True, "interact": True, "edit": True, "delete": True},
        "tasks": {"view": True, "create": True, "interact": True, "edit": True, "delete": True},
        "animals": {"view": True, "create": True, "interact": True, "edit": True, "delete": True},
        "plants": {"view": True, "create": True, "interact": True, "edit": True, "delete": True},
        "seeds": {"view": True, "create": True, "interact": True, "edit": True, "delete": True},
        "equipment": {"view": True, "create": True, "interact": True, "edit": True, "delete": True},
        "vehicles": {"view": True, "create": True, "interact": True, "edit": True, "delete": True},
        "home": {"view": True, "create": True, "interact": True, "edit": True, "delete": True},
        "farm": {"view": True, "create": True, "interact": True, "edit": True, "delete": True},
        "production": {"view": True, "create": True, "interact": True, "edit": True, "delete": True},
        "workers": {"view": True, "create": True, "interact": True, "edit": True, "delete": True},
        "budget": {"view": True, "create": True, "edit": True, "delete": True},
        "team": {"view": True, "create": True, "interact": True, "edit": True, "delete": True},
        "garden": {"view": True, "create": True, "interact": True, "edit": True, "delete": True},
        "supply_requests": {"view": True, "create": True, "edit": True, "delete": True},
    },
    "viewer": {
        # Viewer: can see everything except settings, users, roles - read-only access
        "users": {"view": False, "create": False, "edit": False, "delete": False},
        "roles": {"view": False, "create": False, "edit": False, "delete": False},
        "settings": {"view": False, "edit": False, "email": False, "calendar": False},
        "dashboard": {"view": True},
        "calendar": {"view": True, "create": False, "interact": False, "edit": False, "delete": False},
        "tasks": {"view": True, "create": False, "interact": False, "edit": False, "delete": False},
        "animals": {"view": True, "create": False, "interact": False, "edit": False, "delete": False},
        "plants": {"view": True, "create": False, "interact": False, "edit": False, "delete": False},
        "seeds": {"view": True, "create": False, "interact": False, "edit": False, "delete": False},
        "equipment": {"view": True, "create": False, "interact": False, "edit": False, "delete": False},
        "vehicles": {"view": True, "create": False, "interact": False, "edit": False, "delete": False},
        "home": {"view": True, "create": False, "interact": False, "edit": False, "delete": False},
        "farm": {"view": True, "create": False, "interact": False, "edit": False, "delete": False},
        "production": {"view": True, "create": False, "interact": False, "edit": False, "delete": False},
        "workers": {"view": True, "create": False, "interact": False, "edit": False, "delete": False},
        "budget": {"view": True, "create": False, "edit": False, "delete": False},
        "team": {"view": True, "create": False, "interact": False, "edit": False, "delete": False},
        "garden": {"view": True, "create": False, "interact": False, "edit": False, "delete": False},
        "supply_requests": {"view": True, "create": False, "edit": False, "delete": False},
    },
    "kiosk": {
        # Kiosk users: passwordless login for kitchen display, full access like editor
        "users": {"view": False, "create": False, "edit": False, "delete": False},
        "roles": {"view": False, "create": False, "edit": False, "delete": False},
        "settings": {"view": True, "edit": False, "email": False, "calendar": False},
        "dashboard": {"view": True},
        "calendar": {"view": True, "create": True, "interact": True, "edit": True, "delete": True},
        "tasks": {"view": True, "create": True, "interact": True, "edit": True, "delete": True},
        "animals": {"view": True, "create": True, "interact": True, "edit": True, "delete": True},
        "plants": {"view": True, "create": True, "interact": True, "edit": True, "delete": True},
        "seeds": {"view": True, "create": True, "edit": True, "delete": True},
        "equipment": {"view": True, "create": True, "interact": True, "edit": True, "delete": True},
        "vehicles": {"view": True, "create": True, "interact": True, "edit": True, "delete": True},
        "home": {"view": True, "create": True, "interact": True, "edit": True, "delete": True},
        "farm": {"view": True, "create": True, "interact": True, "edit": True, "delete": True},
        "production": {"view": True, "create": True, "edit": True, "delete": True},
        "workers": {"view": True, "create": True, "interact": True, "edit": False, "delete": False},
        "budget": {"view": True, "create": True, "edit": True, "delete": True},
        "team": {"view": True, "create": True, "interact": True, "edit": True, "delete": True},
        "garden": {"view": True, "create": True, "interact": True, "edit": True, "delete": True},
        "supply_requests": {"view": True, "create": True, "edit": True, "delete": True},
    },
    "farmhand": {
        # Farmhand users: only see tasks marked visible_to_farmhands, can interact
        "users": {"view": False, "create": False, "edit": False, "delete": False},
        "roles": {"view": False, "create": False, "edit": False, "delete": False},
        "settings": {"view": False, "edit": False, "email": False, "calendar": False},
        "dashboard": {"view": True},
        "calendar": {"view": True, "create": False, "edit": False, "delete": False},
        "tasks": {"view": True, "create": False, "interact": True, "edit": False, "delete": False},
        "animals": {"view": True, "create": False, "interact": True, "edit": False, "delete": False},
        "plants": {"view": True, "create": False, "interact": True, "edit": False, "delete": False},
        "seeds": {"view": False, "create": False, "edit": False, "delete": False},
        "equipment": {"view": True, "create": False, "interact": True, "edit": False, "delete": False},
        "vehicles": {"view": True, "create": False, "interact": True, "edit": False, "delete": False},
        "home": {"view": True, "create": False, "interact": True, "edit": False, "delete": False},
        "farm": {"view": True, "create": False, "interact": True, "edit": False, "delete": False},
        "production": {"view": False, "create": False, "edit": False, "delete": False},
        "workers": {"view": False, "create": False, "interact": False, "edit": False, "delete": False},
        "budget": {"view": False, "create": False, "edit": False, "delete": False},
        "team": {"view": True, "create": False, "interact": True, "edit": False, "delete": False},
        "garden": {"view": True, "create": False, "interact": True, "edit": False, "delete": False},
        "supply_requests": {"view": True, "create": True, "edit": False, "delete": False},
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
    is_farmhand = Column(Boolean, default=False, nullable=False)  # Farm hand users see limited dashboard
    expires_at = Column(DateTime, nullable=True)  # Account auto-disables after this time

    # Invitation system - for email-based user creation
    invitation_token = Column(String(64), unique=True, nullable=True, index=True)
    invitation_expires_at = Column(DateTime, nullable=True)

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

    @property
    def is_expired(self) -> bool:
        """Check if account has expired"""
        if self.expires_at is None:
            return False
        return _get_now() > self.expires_at


class Session(Base):
    """User session for token-based auth"""
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    # token_hash stores SHA-256 hash of the session token (security best practice)
    # The actual token is only sent to the client, never stored in plain text
    token_hash = Column(String(64), unique=True, nullable=True, index=True)  # SHA-256 hex = 64 chars
    # Legacy plaintext token column - kept temporarily for migration, then cleared
    token = Column(String(255), unique=True, nullable=True, index=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    ip_address = Column(String(45), nullable=True)  # IPv6 can be up to 45 chars
    user_agent = Column(String(500), nullable=True)

    def __repr__(self):
        return f"<Session user_id={self.user_id}>"

    @property
    def is_expired(self) -> bool:
        return _get_now() > self.expires_at


class LoginAttempt(Base):
    """Track failed login attempts for rate limiting (persisted)"""
    __tablename__ = "login_attempts"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), nullable=False, index=True)
    ip_address = Column(String(45), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    def __repr__(self):
        return f"<LoginAttempt {self.username} @ {self.timestamp}>"


class AuditAction(str, Enum):
    """Types of auditable actions"""
    LOGIN = "login"
    LOGOUT = "logout"
    LOGIN_FAILED = "login_failed"
    PASSWORD_CHANGE = "password_change"
    USER_CREATE = "user_create"
    USER_DELETE = "user_delete"
    SETTINGS_CHANGE = "settings_change"
    DB_PULL_PROD = "db_pull_prod"
    DB_PUSH_PROD = "db_push_prod"
    CALENDAR_SYNC = "calendar_sync"


class AuditLog(Base):
    """Security audit log for critical operations"""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    action = Column(SQLEnum(AuditAction), nullable=False, index=True)
    user_id = Column(Integer, nullable=True, index=True)  # Null for failed logins
    username = Column(String(50), nullable=True)  # Store username for failed logins
    ip_address = Column(String(45), nullable=True)  # IPv6 can be up to 45 chars
    user_agent = Column(String(500), nullable=True)
    details = Column(JSON, nullable=True)  # Additional context
    success = Column(Boolean, default=True, nullable=False)

    def __repr__(self):
        return f"<AuditLog {self.action.value} user_id={self.user_id}>"
