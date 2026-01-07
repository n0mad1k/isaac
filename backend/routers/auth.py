"""
Authentication API Routes
Handles user login, registration, and session management
"""

import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional, List
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel, Field, EmailStr
from loguru import logger
from passlib.context import CryptContext

from models.database import get_db
from models.users import User, Session, UserRole, Role, DEFAULT_PERMISSIONS


router = APIRouter(prefix="/auth", tags=["Authentication"])
security = HTTPBearer(auto_error=False)

# Session configuration
SESSION_EXPIRY_DAYS = 30
TOKEN_BYTES = 32

# Account lockout configuration
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15

# Track failed login attempts: {username: [(timestamp, ip), ...]}
_failed_attempts: dict = defaultdict(list)

# Password hashing context - bcrypt is the recommended scheme
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# Pydantic Schemas
class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(default="", max_length=200)  # Empty allowed for kiosk users


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern=r'^[a-zA-Z0-9._-]+$')
    email: Optional[EmailStr] = None
    password: str = Field(..., min_length=8, max_length=200)
    display_name: Optional[str] = Field(None, max_length=100)


class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str]
    display_name: Optional[str]
    role: UserRole
    is_active: bool
    is_kiosk: bool = False
    last_login: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    token: str
    user: UserResponse
    expires_at: datetime


class UserUpdateRequest(BaseModel):
    display_name: Optional[str] = Field(None, max_length=100)
    email: Optional[EmailStr] = None


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=200)


class UserRoleUpdateRequest(BaseModel):
    role: UserRole


class CreateUserRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern=r'^[a-zA-Z0-9._-]+$')
    email: Optional[str] = None  # Optional, can be empty
    password: Optional[str] = Field(None, min_length=8, max_length=200)
    display_name: Optional[str] = Field(None, max_length=100)
    role: UserRole = UserRole.VIEWER
    is_kiosk: bool = False  # Kiosk users can login without password


class AdminUserUpdateRequest(BaseModel):
    """Admin can update any user's info"""
    username: Optional[str] = Field(None, min_length=3, max_length=50, pattern=r'^[a-zA-Z0-9._-]+$')
    email: Optional[str] = None  # Allow any string, empty string clears email
    display_name: Optional[str] = Field(None, max_length=100)
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    is_kiosk: Optional[bool] = None


class AdminPasswordResetRequest(BaseModel):
    """Admin can reset any user's password"""
    new_password: str = Field(..., min_length=8, max_length=200)


class RoleResponse(BaseModel):
    id: int
    name: str
    display_name: str
    description: Optional[str]
    color: str
    permissions: dict
    is_builtin: bool
    created_at: datetime

    class Config:
        from_attributes = True


class CreateRoleRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=50, pattern=r'^[a-z0-9_-]+$')
    display_name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    color: str = Field(default="#6B7280", max_length=20)
    permissions: dict = Field(default_factory=dict)


class UpdateRoleRequest(BaseModel):
    display_name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    color: Optional[str] = Field(None, max_length=20)
    permissions: Optional[dict] = None


# Password hashing utilities
def hash_password(password: str) -> str:
    """Hash a password using bcrypt (secure, slow algorithm)"""
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its hash.

    Supports both new bcrypt hashes and legacy SHA-256 hashes for backward compatibility.
    """
    if not hashed:
        return False

    # Check if this is a legacy SHA-256 hash (format: salt$hash, 32 hex + $ + 64 hex)
    if '$' in hashed and not hashed.startswith('$2'):
        try:
            salt, hash_value = hashed.split('$')
            # Legacy SHA-256 format: 32-char salt + 64-char hash
            if len(salt) == 32 and len(hash_value) == 64:
                check_hash = hashlib.sha256((salt + password).encode()).hexdigest()
                return secrets.compare_digest(check_hash, hash_value)
        except Exception:
            pass

    # Try bcrypt verification (use bcrypt directly due to passlib compatibility issues)
    try:
        import bcrypt as bcrypt_lib
        return bcrypt_lib.checkpw(password.encode(), hashed.encode())
    except Exception:
        # Fallback to passlib
        try:
            return pwd_context.verify(password, hashed)
        except Exception:
            return False


def is_account_locked(username: str) -> tuple[bool, int]:
    """Check if an account is locked due to too many failed attempts.

    Returns: (is_locked, remaining_seconds)
    """
    now = datetime.utcnow()
    cutoff = now - timedelta(minutes=LOCKOUT_DURATION_MINUTES)

    # Clean old attempts and count recent ones
    recent_attempts = [
        (ts, ip) for ts, ip in _failed_attempts.get(username, [])
        if ts > cutoff
    ]
    _failed_attempts[username] = recent_attempts

    if len(recent_attempts) >= MAX_FAILED_ATTEMPTS:
        oldest_attempt = min(ts for ts, _ in recent_attempts)
        unlock_time = oldest_attempt + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
        remaining = int((unlock_time - now).total_seconds())
        return True, max(0, remaining)

    return False, 0


def record_failed_attempt(username: str, ip: str) -> None:
    """Record a failed login attempt."""
    _failed_attempts[username].append((datetime.utcnow(), ip))
    logger.warning(f"Failed login attempt {len(_failed_attempts[username])} for user: {username} from IP: {ip}")


def clear_failed_attempts(username: str) -> None:
    """Clear failed login attempts after successful login."""
    if username in _failed_attempts:
        del _failed_attempts[username]


def generate_token() -> str:
    """Generate a secure session token"""
    return secrets.token_urlsafe(TOKEN_BYTES)


# Authentication dependencies
async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """Get the current authenticated user from session token"""
    token = None

    # Try to get token from Authorization header
    if credentials:
        token = credentials.credentials

    # Fallback to cookie
    if not token:
        token = request.cookies.get("session_token")

    if not token:
        return None

    # Find session
    result = await db.execute(
        select(Session).where(Session.token == token)
    )
    session = result.scalar_one_or_none()

    if not session or session.is_expired:
        return None

    # Get user
    result = await db.execute(
        select(User).where(User.id == session.user_id)
    )
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        return None

    return user


async def require_auth(user: Optional[User] = Depends(get_current_user)) -> User:
    """Require authentication - raise 401 if not authenticated"""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


async def require_editor(user: User = Depends(require_auth)) -> User:
    """Require editor or admin role"""
    if not user.can_edit:
        raise HTTPException(status_code=403, detail="Editor access required")
    return user


async def require_admin(user: User = Depends(require_auth)) -> User:
    """Require admin role"""
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# Routes
@router.post("/login", response_model=LoginResponse)
async def login(
    request: Request,
    response: Response,
    data: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """Login with username and password"""
    client_ip = request.client.host if request.client else "unknown"

    # Check if account is locked
    is_locked, remaining_seconds = is_account_locked(data.username)
    if is_locked:
        remaining_minutes = (remaining_seconds + 59) // 60  # Round up
        logger.warning(f"Login attempt for locked account: {data.username} from IP: {client_ip}")
        raise HTTPException(
            status_code=429,
            detail=f"Account temporarily locked due to too many failed attempts. Try again in {remaining_minutes} minute(s)."
        )

    # Find user
    result = await db.execute(
        select(User).where(User.username == data.username)
    )
    user = result.scalar_one_or_none()

    if not user:
        record_failed_attempt(data.username, client_ip)
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # Check password - kiosk users can login without password (empty string)
    if user.is_kiosk:
        # Kiosk users can login with empty password or any password
        pass
    elif not user.hashed_password or not verify_password(data.password, user.hashed_password):
        record_failed_attempt(data.username, client_ip)
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if not user.is_active:
        raise HTTPException(status_code=401, detail="Account is disabled")

    # Clear failed attempts on successful login
    clear_failed_attempts(data.username)

    # Create session
    token = generate_token()
    expires_at = datetime.utcnow() + timedelta(days=SESSION_EXPIRY_DAYS)

    session = Session(
        user_id=user.id,
        token=token,
        expires_at=expires_at,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "")[:500]
    )
    db.add(session)

    # Update last login
    user.last_login = datetime.utcnow()

    await db.commit()

    logger.info(f"User {user.username} logged in successfully")

    # Set cookie for browser clients
    # Detect if request came over HTTPS by checking headers (nginx sets X-Forwarded-Proto)
    is_https = request.headers.get("x-forwarded-proto") == "https" or request.url.scheme == "https"
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        secure=is_https,  # Secure cookie only over HTTPS
        samesite="lax",
        max_age=SESSION_EXPIRY_DAYS * 24 * 60 * 60
    )

    return LoginResponse(
        token=token,
        user=UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            display_name=user.display_name,
            role=user.role,
            is_active=user.is_active,
            is_kiosk=user.is_kiosk,
            last_login=user.last_login,
            created_at=user.created_at
        ),
        expires_at=expires_at
    )


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """Logout and invalidate session"""
    token = None

    if credentials:
        token = credentials.credentials
    if not token:
        token = request.cookies.get("session_token")

    if token:
        await db.execute(
            delete(Session).where(Session.token == token)
        )
        await db.commit()

    response.delete_cookie("session_token")

    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(user: User = Depends(require_auth)):
    """Get current authenticated user's info"""
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        is_active=user.is_active,
        is_kiosk=user.is_kiosk,
        last_login=user.last_login,
        created_at=user.created_at
    )


@router.put("/me", response_model=UserResponse)
async def update_current_user(
    data: UserUpdateRequest,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db)
):
    """Update current user's profile"""
    if data.display_name is not None:
        user.display_name = data.display_name

    if data.email is not None:
        # Check if email is already taken
        result = await db.execute(
            select(User).where(User.email == data.email, User.id != user.id)
        )
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already in use")
        user.email = data.email

    await db.commit()
    await db.refresh(user)

    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        is_active=user.is_active,
        is_kiosk=user.is_kiosk,
        last_login=user.last_login,
        created_at=user.created_at
    )


@router.post("/me/password")
async def change_password(
    data: PasswordChangeRequest,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db)
):
    """Change current user's password"""
    if not verify_password(data.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    user.hashed_password = hash_password(data.new_password)
    await db.commit()

    logger.info(f"User {user.username} changed their password")

    return {"message": "Password changed successfully"}


# Admin routes
@router.get("/users", response_model=List[UserResponse])
async def list_users(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """List all users (admin only)"""
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()

    return [
        UserResponse(
            id=u.id,
            username=u.username,
            email=u.email,
            display_name=u.display_name,
            role=u.role,
            is_active=u.is_active,
            is_kiosk=u.is_kiosk,
            last_login=u.last_login,
            created_at=u.created_at
        ) for u in users
    ]


@router.post("/users", response_model=UserResponse)
async def create_user(
    data: CreateUserRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Create a new user (admin only)"""
    # Check for existing username
    result = await db.execute(
        select(User).where(User.username == data.username)
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already exists")

    # Check for existing email (only if email provided and not empty)
    email_to_use = data.email if data.email and data.email.strip() else None
    if email_to_use:
        result = await db.execute(
            select(User).where(User.email == email_to_use)
        )
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already in use")

    # Kiosk users don't need a password, regular users do
    if not data.is_kiosk and not data.password:
        raise HTTPException(status_code=400, detail="Password is required for non-kiosk users")

    user = User(
        username=data.username,
        email=email_to_use,
        hashed_password=hash_password(data.password) if data.password else None,
        display_name=data.display_name,
        role=data.role,
        is_kiosk=data.is_kiosk
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    logger.info(f"Admin {admin.username} created new user: {user.username} with role {user.role.value} (kiosk={user.is_kiosk})")

    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        is_active=user.is_active,
        is_kiosk=user.is_kiosk,
        last_login=user.last_login,
        created_at=user.created_at
    )


@router.put("/users/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: int,
    data: UserRoleUpdateRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Update a user's role (admin only)"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    old_role = user.role
    user.role = data.role
    await db.commit()
    await db.refresh(user)

    logger.info(f"Admin {admin.username} changed {user.username}'s role from {old_role.value} to {user.role.value}")

    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        is_active=user.is_active,
        is_kiosk=user.is_kiosk,
        last_login=user.last_login,
        created_at=user.created_at
    )


@router.put("/users/{user_id}/status")
async def toggle_user_status(
    user_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Enable/disable a user (admin only)"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot disable your own account")

    user.is_active = not user.is_active
    await db.commit()

    action = "enabled" if user.is_active else "disabled"
    logger.info(f"Admin {admin.username} {action} user: {user.username}")

    return {"message": f"User {action}", "is_active": user.is_active}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Delete a user (admin only)"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    # Delete user sessions first
    await db.execute(delete(Session).where(Session.user_id == user_id))

    username = user.username
    await db.delete(user)
    await db.commit()

    logger.info(f"Admin {admin.username} deleted user: {username}")

    return {"message": "User deleted"}


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    data: AdminUserUpdateRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Update any user's info (admin only)"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Update username if provided
    if data.username is not None and data.username != user.username:
        existing = await db.execute(
            select(User).where(User.username == data.username, User.id != user_id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Username already exists")
        user.username = data.username

    # Update email if provided (can be set to empty string to clear)
    if data.email is not None:
        if data.email and data.email != user.email:
            existing = await db.execute(
                select(User).where(User.email == data.email, User.id != user_id)
            )
            if existing.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Email already in use")
        user.email = data.email if data.email else None

    # Update display name
    if data.display_name is not None:
        user.display_name = data.display_name

    # Update role (prevent self-demotion)
    if data.role is not None:
        if user.id == admin.id and data.role != UserRole.ADMIN:
            raise HTTPException(status_code=400, detail="Cannot demote yourself")
        user.role = data.role

    # Update active status (prevent self-disable)
    if data.is_active is not None:
        if user.id == admin.id and not data.is_active:
            raise HTTPException(status_code=400, detail="Cannot disable yourself")
        user.is_active = data.is_active

    # Update kiosk mode
    if data.is_kiosk is not None:
        user.is_kiosk = data.is_kiosk
        # If switching to kiosk mode, clear password
        if data.is_kiosk:
            user.hashed_password = None

    await db.commit()
    await db.refresh(user)

    logger.info(f"Admin {admin.username} updated user: {user.username}")

    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        is_active=user.is_active,
        is_kiosk=user.is_kiosk,
        last_login=user.last_login,
        created_at=user.created_at
    )


@router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: int,
    data: AdminPasswordResetRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Reset any user's password (admin only)"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = hash_password(data.new_password)
    await db.commit()

    # Invalidate all sessions for this user
    await db.execute(delete(Session).where(Session.user_id == user_id))
    await db.commit()

    logger.info(f"Admin {admin.username} reset password for user: {user.username}")

    return {"message": "Password reset successfully"}


# Role management routes
@router.get("/roles", response_model=List[RoleResponse])
async def list_roles(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """List all roles (admin only)"""
    result = await db.execute(select(Role).order_by(Role.name))
    roles = result.scalars().all()

    # If no roles exist, create the built-in ones
    if not roles:
        for role_name, permissions in DEFAULT_PERMISSIONS.items():
            role = Role(
                name=role_name,
                display_name=role_name.capitalize(),
                description=f"Built-in {role_name} role",
                color="#6366F1" if role_name == "admin" else "#3B82F6" if role_name == "editor" else "#6B7280",
                permissions=permissions,
                is_builtin=True
            )
            db.add(role)
        await db.commit()

        result = await db.execute(select(Role).order_by(Role.name))
        roles = result.scalars().all()

    return [RoleResponse(
        id=r.id,
        name=r.name,
        display_name=r.display_name,
        description=r.description,
        color=r.color,
        permissions=r.permissions or {},
        is_builtin=r.is_builtin,
        created_at=r.created_at
    ) for r in roles]


@router.get("/roles/{role_id}", response_model=RoleResponse)
async def get_role(
    role_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get a single role (admin only)"""
    result = await db.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()

    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    return RoleResponse(
        id=role.id,
        name=role.name,
        display_name=role.display_name,
        description=role.description,
        color=role.color,
        permissions=role.permissions or {},
        is_builtin=role.is_builtin,
        created_at=role.created_at
    )


@router.post("/roles", response_model=RoleResponse)
async def create_role(
    data: CreateRoleRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Create a new role (admin only)"""
    # Check for existing name
    result = await db.execute(select(Role).where(Role.name == data.name))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Role name already exists")

    role = Role(
        name=data.name,
        display_name=data.display_name,
        description=data.description,
        color=data.color,
        permissions=data.permissions,
        is_builtin=False
    )

    db.add(role)
    await db.commit()
    await db.refresh(role)

    logger.info(f"Admin {admin.username} created new role: {role.name}")

    return RoleResponse(
        id=role.id,
        name=role.name,
        display_name=role.display_name,
        description=role.description,
        color=role.color,
        permissions=role.permissions or {},
        is_builtin=role.is_builtin,
        created_at=role.created_at
    )


@router.put("/roles/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: int,
    data: UpdateRoleRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Update a role (admin only)"""
    result = await db.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()

    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    if data.display_name is not None:
        role.display_name = data.display_name

    if data.description is not None:
        role.description = data.description

    if data.color is not None:
        role.color = data.color

    if data.permissions is not None:
        role.permissions = data.permissions

    await db.commit()
    await db.refresh(role)

    logger.info(f"Admin {admin.username} updated role: {role.name}")

    return RoleResponse(
        id=role.id,
        name=role.name,
        display_name=role.display_name,
        description=role.description,
        color=role.color,
        permissions=role.permissions or {},
        is_builtin=role.is_builtin,
        created_at=role.created_at
    )


@router.delete("/roles/{role_id}")
async def delete_role(
    role_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Delete a role (admin only, cannot delete built-in roles)"""
    result = await db.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()

    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    if role.is_builtin:
        raise HTTPException(status_code=400, detail="Cannot delete built-in roles")

    role_name = role.name
    await db.delete(role)
    await db.commit()

    logger.info(f"Admin {admin.username} deleted role: {role_name}")

    return {"message": "Role deleted"}


@router.get("/permissions")
async def get_permission_categories(
    admin: User = Depends(require_admin)
):
    """Get all available permission categories for role editing (admin only)"""
    return {
        "categories": {
            "users": {"label": "User Management", "actions": ["view", "create", "edit", "delete"]},
            "roles": {"label": "Role Management", "actions": ["view", "create", "edit", "delete"]},
            "settings": {"label": "Settings", "actions": ["view", "edit", "email", "calendar"]},
            "animals": {"label": "Animals", "actions": ["view", "create", "edit", "delete"]},
            "plants": {"label": "Plants", "actions": ["view", "create", "edit", "delete"]},
            "tasks": {"label": "Tasks", "actions": ["view", "create", "edit", "delete"]},
            "equipment": {"label": "Equipment", "actions": ["view", "create", "edit", "delete"]},
            "vehicles": {"label": "Vehicles", "actions": ["view", "create", "edit", "delete"]},
            "production": {"label": "Production", "actions": ["view", "create", "edit", "delete"]},
        },
        "defaults": DEFAULT_PERMISSIONS
    }


# Setup route - only works if no users exist
@router.post("/setup", response_model=UserResponse)
async def initial_setup(
    data: RegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    """Create the first admin user - only works if no users exist"""
    # Check if any users exist
    result = await db.execute(select(User))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Setup already complete. Users exist.")

    # Create admin user
    user = User(
        username=data.username,
        email=data.email,
        hashed_password=hash_password(data.password),
        display_name=data.display_name,
        role=UserRole.ADMIN
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    logger.info(f"Initial setup complete. Admin user created: {user.username}")

    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        is_active=user.is_active,
        is_kiosk=user.is_kiosk,
        last_login=user.last_login,
        created_at=user.created_at
    )


@router.get("/check")
async def check_auth_status(
    user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Check authentication status and whether setup is needed"""
    # Check if any users exist
    result = await db.execute(select(User).limit(1))
    has_users = result.scalar_one_or_none() is not None

    return {
        "authenticated": user is not None,
        "needs_setup": not has_users,
        "user": UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            display_name=user.display_name,
            role=user.role,
            is_active=user.is_active,
            is_kiosk=user.is_kiosk,
            last_login=user.last_login,
            created_at=user.created_at
        ) if user else None
    }
