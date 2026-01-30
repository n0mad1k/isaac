"""
Authentication API Routes
Handles user login, registration, and session management
"""

import secrets
from datetime import datetime, timedelta
from typing import Optional, List
from collections import defaultdict

import pytz
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel, Field, EmailStr, validator
from loguru import logger
from passlib.context import CryptContext

from models.database import get_db
from models.users import User, Session, UserRole, Role, DEFAULT_PERMISSIONS, AuditAction, LoginAttempt
from services.audit import log_audit
from config import settings


def get_now() -> datetime:
    """Get current time in configured timezone (naive datetime for DB storage)"""
    tz = pytz.timezone(settings.timezone)
    return datetime.now(tz).replace(tzinfo=None)


router = APIRouter(prefix="/auth", tags=["Authentication"])
security = HTTPBearer(auto_error=False)

# Session configuration
SESSION_EXPIRY_DAYS = 7  # Reduced from 30 for security (auto-logout after a week)
TOKEN_BYTES = 32

# Account lockout configuration
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15

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
    is_farmhand: bool = False
    expires_at: Optional[datetime] = None
    invitation_token: Optional[str] = None  # Only indicates if pending (not actual token)
    last_login: Optional[datetime]
    created_at: datetime
    permissions: Optional[dict] = None  # Granular permissions from role

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
    is_farmhand: bool = False  # Farm hand users see limited dashboard
    expires_at: Optional[datetime] = None  # Account auto-disables after this time

    @validator('expires_at', pre=True, always=True)
    def validate_expires_at(cls, v):
        # Treat empty strings as None
        if v == '' or v is None:
            return None
        return v


class AdminUserUpdateRequest(BaseModel):
    """Admin can update any user's info"""
    username: Optional[str] = Field(None, min_length=3, max_length=50, pattern=r'^[a-zA-Z0-9._-]+$')
    email: Optional[str] = None  # Allow any string, empty string clears email
    display_name: Optional[str] = Field(None, max_length=100)
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    is_kiosk: Optional[bool] = None
    is_farmhand: Optional[bool] = None
    expires_at: Optional[datetime] = None  # Use datetime or None to clear

    @validator('expires_at', pre=True, always=True)
    def validate_expires_at(cls, v):
        # Treat empty strings as None
        if v == '' or v is None:
            return None
        return v


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
    import bcrypt as bcrypt_lib
    return bcrypt_lib.hashpw(password.encode(), bcrypt_lib.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its bcrypt hash."""
    if not hashed:
        return False

    # Only bcrypt hashes are supported (start with $2)
    # Legacy SHA-256 hashes are no longer supported for security
    if not hashed.startswith('$2'):
        return False

    # Verify bcrypt hash (use bcrypt directly due to passlib compatibility issues)
    try:
        import bcrypt as bcrypt_lib
        return bcrypt_lib.checkpw(password.encode(), hashed.encode())
    except Exception:
        # Fallback to passlib
        try:
            return pwd_context.verify(password, hashed)
        except Exception:
            return False


async def is_account_locked(username: str, db: AsyncSession) -> tuple[bool, int]:
    """Check if an account is locked due to too many failed attempts.

    Returns: (is_locked, remaining_seconds)
    """
    now = get_now()
    cutoff = now - timedelta(minutes=LOCKOUT_DURATION_MINUTES)

    # Count recent attempts from database
    from sqlalchemy import func
    result = await db.execute(
        select(func.count(LoginAttempt.id)).where(
            LoginAttempt.username == username,
            LoginAttempt.timestamp > cutoff
        )
    )
    attempt_count = result.scalar() or 0

    if attempt_count >= MAX_FAILED_ATTEMPTS:
        # Get oldest attempt to calculate unlock time
        result = await db.execute(
            select(LoginAttempt.timestamp).where(
                LoginAttempt.username == username,
                LoginAttempt.timestamp > cutoff
            ).order_by(LoginAttempt.timestamp.asc()).limit(1)
        )
        oldest = result.scalar()
        if oldest:
            unlock_time = oldest + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
            remaining = int((unlock_time - now).total_seconds())
            return True, max(0, remaining)

    return False, 0


async def record_failed_attempt(username: str, ip: str, db: AsyncSession) -> None:
    """Record a failed login attempt to database."""
    attempt = LoginAttempt(username=username, ip_address=ip, timestamp=get_now())
    db.add(attempt)
    await db.commit()

    # Count for logging
    from sqlalchemy import func
    cutoff = get_now() - timedelta(minutes=LOCKOUT_DURATION_MINUTES)
    result = await db.execute(
        select(func.count(LoginAttempt.id)).where(
            LoginAttempt.username == username,
            LoginAttempt.timestamp > cutoff
        )
    )
    count = result.scalar() or 0
    logger.warning(f"Failed login attempt {count} for user: {username} from IP: {ip}")


async def clear_failed_attempts(username: str, db: AsyncSession) -> None:
    """Clear failed login attempts after successful login."""
    await db.execute(
        delete(LoginAttempt).where(LoginAttempt.username == username)
    )
    await db.commit()


def generate_token() -> str:
    """Generate a secure session token"""
    return secrets.token_urlsafe(TOKEN_BYTES)


def hash_token(token: str) -> str:
    """Hash a session token using SHA-256.

    SHA-256 is appropriate for session tokens because:
    - Tokens are high-entropy random strings (not user passwords)
    - Fast lookup is important for every authenticated request
    - No salt needed since tokens are unique random values
    """
    import hashlib
    return hashlib.sha256(token.encode()).hexdigest()


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

    # Find session by token hash (primary method)
    token_hashed = hash_token(token)
    result = await db.execute(
        select(Session).where(Session.token_hash == token_hashed)
    )
    session = result.scalar_one_or_none()

    # Fallback to legacy plaintext lookup (for migration period)
    if not session:
        result = await db.execute(
            select(Session).where(Session.token == token)
        )
        session = result.scalar_one_or_none()

        # If found via legacy lookup, migrate to hashed version
        if session:
            session.token_hash = token_hashed
            session.token = f"MIGRATED:{session.id}"  # Placeholder (NOT NULL constraint)
            await db.commit()
            logger.debug(f"Migrated session {session.id} to hashed token")

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
    is_locked, remaining_seconds = await is_account_locked(data.username, db)
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
        await record_failed_attempt(data.username, client_ip, db)
        await log_audit(AuditAction.LOGIN_FAILED, username=data.username, request=request, success=False)
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # Check password - kiosk users can login without password (empty string)
    if user.is_kiosk:
        # Kiosk users can login with empty password or any password
        pass
    elif not user.hashed_password or not verify_password(data.password, user.hashed_password):
        await record_failed_attempt(data.username, client_ip, db)
        await log_audit(AuditAction.LOGIN_FAILED, user_id=user.id, username=user.username, request=request, success=False)
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if not user.is_active:
        raise HTTPException(status_code=401, detail="Account is disabled")

    # Check if account has expired
    if user.is_expired:
        raise HTTPException(status_code=401, detail="Account has expired")

    # Clear failed attempts on successful login
    await clear_failed_attempts(data.username, db)

    # Create session with hashed token (plaintext token only sent to client)
    token = generate_token()
    token_hashed = hash_token(token)
    expires_at = get_now() + timedelta(days=SESSION_EXPIRY_DAYS)

    session = Session(
        user_id=user.id,
        token_hash=token_hashed,  # Store hash, not plaintext
        token=f"HASHED:{token_hashed[:8]}",  # Placeholder (NOT NULL constraint in DB)
        expires_at=expires_at,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "")[:500]
    )
    db.add(session)

    # Update last login
    user.last_login = get_now()

    await db.commit()

    logger.info(f"User {user.username} logged in successfully")
    await log_audit(AuditAction.LOGIN, user_id=user.id, username=user.username, request=request)

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
            is_farmhand=user.is_farmhand,
            expires_at=user.expires_at,
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
        # Get user info before deleting session for audit
        token_hashed = hash_token(token)

        # Try to find by hash first, then legacy plaintext
        result = await db.execute(select(Session).where(Session.token_hash == token_hashed))
        session = result.scalar_one_or_none()
        if not session:
            result = await db.execute(select(Session).where(Session.token == token))
            session = result.scalar_one_or_none()

        user_id = session.user_id if session else None

        # Delete by hash or legacy token
        await db.execute(
            delete(Session).where(
                (Session.token_hash == token_hashed) | (Session.token == token)
            )
        )
        await db.commit()

        if user_id:
            await log_audit(AuditAction.LOGOUT, user_id=user_id, request=request)

    response.delete_cookie("session_token")

    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db)
):
    """Get current authenticated user's info with permissions"""
    from services.permissions import get_user_permissions
    permissions = await get_user_permissions(user, db)

    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        is_active=user.is_active,
        is_kiosk=user.is_kiosk,
        is_farmhand=user.is_farmhand,
        expires_at=user.expires_at,
        last_login=user.last_login,
        created_at=user.created_at,
        permissions=permissions
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
            is_farmhand=user.is_farmhand,
            expires_at=user.expires_at,
        last_login=user.last_login,
        created_at=user.created_at
    )


@router.post("/me/password")
async def change_password(
    request: Request,
    data: PasswordChangeRequest,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db)
):
    """Change current user's password"""
    if not verify_password(data.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    user.hashed_password = hash_password(data.new_password)

    # Get current session token to preserve it
    current_token = None
    if credentials:
        current_token = credentials.credentials
    if not current_token:
        current_token = request.cookies.get("session_token")

    # Invalidate all OTHER sessions for this user (keep current session active)
    # This ensures password change logs out any compromised sessions
    if current_token:
        current_token_hash = hash_token(current_token)
        await db.execute(
            delete(Session).where(
                Session.user_id == user.id,
                Session.token_hash != current_token_hash,
                Session.token != current_token  # Also exclude legacy plaintext match
            )
        )
    else:
        # If no current token (shouldn't happen), invalidate all sessions
        await db.execute(delete(Session).where(Session.user_id == user.id))

    await db.commit()

    logger.info(f"User {user.username} changed their password (other sessions invalidated)")
    await log_audit(AuditAction.PASSWORD_CHANGE, user_id=user.id, username=user.username, request=request)

    return {"message": "Password changed successfully. Other sessions have been logged out."}


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
            is_farmhand=u.is_farmhand,
            expires_at=u.expires_at,
            invitation_token="pending" if u.invitation_token else None,  # Indicate pending, don't expose actual token
            last_login=u.last_login,
            created_at=u.created_at
        ) for u in users
    ]


@router.post("/users", response_model=UserResponse)
async def create_user(
    request: Request,
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
        is_kiosk=data.is_kiosk,
        is_farmhand=data.is_farmhand,
        expires_at=data.expires_at
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    logger.info(f"Admin {admin.username} created new user: {user.username} with role {user.role.value} (kiosk={user.is_kiosk})")
    await log_audit(
        AuditAction.USER_CREATE, user_id=admin.id, username=admin.username, request=request,
        details={"created_user": user.username, "role": user.role.value}
    )

    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        is_active=user.is_active,
        is_kiosk=user.is_kiosk,
            is_farmhand=user.is_farmhand,
            expires_at=user.expires_at,
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
            is_farmhand=user.is_farmhand,
            expires_at=user.expires_at,
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
    request: Request,
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

    # Remove from Cloudflare Access if user has email
    if user.email:
        try:
            from services.cloudflare_access import remove_email_from_cloudflare_access
            cf_result = await remove_email_from_cloudflare_access(db, user.email)
            if cf_result:
                logger.info(f"Removed {user.email} from Cloudflare Access")
        except Exception as cf_error:
            logger.warning(f"Cloudflare Access cleanup error (non-fatal): {cf_error}")

    # Delete user sessions first
    await db.execute(delete(Session).where(Session.user_id == user_id))

    username = user.username
    email = user.email
    await db.delete(user)
    await db.commit()

    logger.info(f"Admin {admin.username} deleted user: {username}")
    await log_audit(
        AuditAction.USER_DELETE, user_id=admin.id, username=admin.username, request=request,
        details={"deleted_user": username, "email": email}
    )

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

    # Update farm hand mode
    if data.is_farmhand is not None:
        user.is_farmhand = data.is_farmhand

    # Update expiration date (None to clear)
    if 'expires_at' in data.model_dump(exclude_unset=True):
        user.expires_at = data.expires_at

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
            is_farmhand=user.is_farmhand,
            expires_at=user.expires_at,
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
    existing_names = {r.name for r in roles}

    # Role display settings
    ROLE_DISPLAY = {
        "admin": {"display_name": "Admin", "color": "#6366F1", "description": "Full access - can manage users and all content"},
        "editor": {"display_name": "Editor", "color": "#3B82F6", "description": "Can create, edit, and delete content"},
        "viewer": {"display_name": "Viewer", "color": "#6B7280", "description": "Read-only access"},
        "kiosk": {"display_name": "Kiosk", "color": "#10B981", "description": "Passwordless login for shared displays"},
        "farmhand": {"display_name": "Farm Hand", "color": "#F59E0B", "description": "Limited access - only sees assigned tasks"},
    }

    # Create any missing built-in roles
    created_any = False
    for role_name, permissions in DEFAULT_PERMISSIONS.items():
        if role_name not in existing_names:
            display = ROLE_DISPLAY.get(role_name, {"display_name": role_name.capitalize(), "color": "#6B7280", "description": f"Built-in {role_name} role"})
            role = Role(
                name=role_name,
                display_name=display["display_name"],
                description=display["description"],
                color=display["color"],
                permissions=permissions,
                is_builtin=True
            )
            db.add(role)
            created_any = True

    if created_any:
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
            "dashboard": {"label": "Dashboard", "actions": ["view"]},
            "calendar": {"label": "Calendar", "actions": ["view", "create", "interact", "edit", "delete"]},
            "tasks": {"label": "Tasks / To-Do", "actions": ["view", "create", "interact", "edit", "delete"]},
            "animals": {"label": "Animals", "actions": ["view", "create", "interact", "edit", "delete"]},
            "plants": {"label": "Plants", "actions": ["view", "create", "interact", "edit", "delete"]},
            "seeds": {"label": "Seeds", "actions": ["view", "create", "interact", "edit", "delete"]},
            "equipment": {"label": "Equipment", "actions": ["view", "create", "interact", "edit", "delete"]},
            "vehicles": {"label": "Vehicles", "actions": ["view", "create", "interact", "edit", "delete"]},
            "home": {"label": "Home Maintenance", "actions": ["view", "create", "interact", "edit", "delete"]},
            "farm": {"label": "Farm Areas", "actions": ["view", "create", "interact", "edit", "delete"]},
            "production": {"label": "Production", "actions": ["view", "create", "interact", "edit", "delete"]},
            "workers": {"label": "Worker Tasks", "actions": ["view", "create", "interact", "edit", "delete"]},
            "budget": {"label": "Budget & Finance", "actions": ["view", "create", "edit", "delete"]},
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
            is_farmhand=user.is_farmhand,
            expires_at=user.expires_at,
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
            is_farmhand=user.is_farmhand,
            expires_at=user.expires_at,
            last_login=user.last_login,
            created_at=user.created_at
        ) if user else None
    }


# Audit log response model
class AuditLogResponse(BaseModel):
    id: int
    timestamp: datetime
    action: str
    user_id: Optional[int]
    username: Optional[str]
    ip_address: Optional[str]
    details: Optional[dict]
    success: bool

    class Config:
        from_attributes = True


@router.get("/audit-logs")
async def get_audit_logs_route(
    limit: int = 100,
    offset: int = 0,
    action: Optional[str] = None,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get audit logs (admin only)"""
    from models.users import AuditLog
    from services.audit import get_audit_logs

    # Convert action string to enum if provided
    action_enum = None
    if action:
        try:
            action_enum = AuditAction(action)
        except ValueError:
            pass

    logs = await get_audit_logs(db, limit=limit, offset=offset, action=action_enum)

    return [
        AuditLogResponse(
            id=log.id,
            timestamp=log.timestamp,
            action=log.action.value,
            user_id=log.user_id,
            username=log.username,
            ip_address=log.ip_address,
            details=log.details,
            success=log.success
        ) for log in logs
    ]


# ==================== User Invitation System ====================

INVITATION_EXPIRY_HOURS = 48  # Invitations expire after 48 hours


class InviteUserRequest(BaseModel):
    """Request to invite a user via email"""
    email: EmailStr
    display_name: Optional[str] = Field(None, max_length=100)
    role: UserRole = UserRole.VIEWER
    is_farmhand: bool = False
    expires_at: Optional[datetime] = None  # Account expiration (not invitation expiration)

    @validator('expires_at', pre=True, always=True)
    def validate_expires_at(cls, v):
        # Treat empty strings as None
        if v == '' or v is None:
            return None
        return v


class AcceptInvitationRequest(BaseModel):
    """Request to accept an invitation and set password"""
    username: str = Field(..., min_length=3, max_length=50, pattern=r'^[a-zA-Z0-9._-]+$')
    password: str = Field(..., min_length=8, max_length=200)


class InvitationInfoResponse(BaseModel):
    """Public info about an invitation (for the accept page)"""
    email: str
    display_name: Optional[str]
    role: str
    expires_at: datetime  # When invitation expires


@router.post("/invite")
async def invite_user(
    request: Request,
    invite_request: InviteUserRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Invite a new user via email. Creates a pending user account with an invitation token.
    The invited user can then set their own username and password.
    """
    from services.email import EmailService, ConfigurationError
    from routers.settings import get_setting

    # Check if email already exists
    result = await db.execute(
        select(User).where(User.email == invite_request.email)
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="A user with this email already exists")

    # Generate secure invitation token
    invitation_token = secrets.token_urlsafe(32)
    invitation_expires = get_now() + timedelta(hours=INVITATION_EXPIRY_HOURS)

    # Create pending user (no username/password yet)
    # Use email as temporary username (will be changed when they accept)
    temp_username = f"invited_{secrets.token_hex(8)}"

    new_user = User(
        username=temp_username,
        email=invite_request.email,
        hashed_password=None,  # No password until they accept
        display_name=invite_request.display_name,
        role=invite_request.role,
        is_active=False,  # Not active until invitation accepted
        is_farmhand=invite_request.is_farmhand,
        expires_at=invite_request.expires_at,
        invitation_token=invitation_token,
        invitation_expires_at=invitation_expires,
    )

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Send invitation email
    try:
        email_service = await EmailService.get_configured_service(db)

        # Get the base URL from settings or request
        base_url = await get_setting(db, "base_url")
        if not base_url:
            # Try to construct from request
            base_url = f"https://{request.headers.get('host', 'isaac.local')}"

        invite_url = f"{base_url}/accept-invite/{invitation_token}"

        subject = "You've been invited to Isaac"
        body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #10B981;">You've Been Invited!</h2>
            <p>You've been invited to join Isaac, a farm management dashboard.</p>
            <p><strong>Invited by:</strong> {admin.display_name or admin.username}</p>
            <p><strong>Your role:</strong> {invite_request.role.value}</p>

            <p style="margin: 20px 0;">
                <a href="{invite_url}"
                   style="background-color: #10B981; color: white; padding: 12px 24px;
                          text-decoration: none; border-radius: 6px; display: inline-block;">
                    Accept Invitation
                </a>
            </p>

            <p style="color: #666; font-size: 14px;">
                This invitation expires in {INVITATION_EXPIRY_HOURS} hours.
            </p>
            <p style="color: #666; font-size: 12px;">
                If you didn't expect this invitation, you can ignore this email.
            </p>
        </body>
        </html>
        """

        await email_service.send_email(
            subject=subject,
            body=body,
            to=invite_request.email,
            html=True
        )

        logger.info(f"Invitation sent to {invite_request.email} by {admin.username}")

        # Add email to Cloudflare Access policy (if configured)
        try:
            from services.cloudflare_access import add_email_to_cloudflare_access
            cf_result = await add_email_to_cloudflare_access(db, invite_request.email)
            if cf_result:
                logger.info(f"Added {invite_request.email} to Cloudflare Access")
            else:
                logger.warning(f"Failed to add {invite_request.email} to Cloudflare Access")
        except Exception as cf_error:
            logger.warning(f"Cloudflare Access error (non-fatal): {cf_error}")

    except ConfigurationError as e:
        # Delete the user since we couldn't send the email
        await db.delete(new_user)
        await db.commit()
        logger.error(f"Invitation error: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")
    except Exception as e:
        # Delete the user since we couldn't send the email
        await db.delete(new_user)
        await db.commit()
        logger.error(f"Failed to send invitation email: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")

    return {"message": f"Invitation sent to {invite_request.email}", "user_id": new_user.id}


@router.post("/invite/{user_id}/resend")
async def resend_invite(
    request: Request,
    user_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Resend invitation email to a pending user.
    Generates a new token and extends the expiration.
    """
    from services.email import EmailService, ConfigurationError
    from routers.settings import get_setting

    # Get the pending user
    result = await db.execute(select(User).where(User.id == user_id))
    pending_user = result.scalar_one_or_none()

    if not pending_user:
        raise HTTPException(status_code=404, detail="User not found")

    if not pending_user.invitation_token:
        raise HTTPException(status_code=400, detail="User does not have a pending invitation")

    if pending_user.is_active:
        raise HTTPException(status_code=400, detail="User has already accepted the invitation")

    # Generate new invitation token and extend expiration
    pending_user.invitation_token = secrets.token_urlsafe(32)
    pending_user.invitation_expires_at = get_now() + timedelta(hours=INVITATION_EXPIRY_HOURS)

    await db.commit()
    await db.refresh(pending_user)

    # Send invitation email
    try:
        email_service = await EmailService.get_configured_service(db)

        # Get the base URL from settings or request
        base_url = await get_setting(db, "base_url")
        if not base_url:
            base_url = f"https://{request.headers.get('host', 'isaac.local')}"

        invite_url = f"{base_url}/accept-invite/{pending_user.invitation_token}"

        subject = "Reminder: You've been invited to Isaac"
        body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #10B981;">Invitation Reminder</h2>
            <p>This is a reminder that you've been invited to join Isaac, a farm management dashboard.</p>
            <p><strong>Invited by:</strong> {admin.display_name or admin.username}</p>
            <p><strong>Your role:</strong> {pending_user.role}</p>

            <p style="margin: 20px 0;">
                <a href="{invite_url}"
                   style="background-color: #10B981; color: white; padding: 12px 24px;
                          text-decoration: none; border-radius: 6px; display: inline-block;">
                    Accept Invitation
                </a>
            </p>

            <p style="color: #666; font-size: 14px;">
                This invitation expires in {INVITATION_EXPIRY_HOURS} hours.
            </p>
            <p style="color: #666; font-size: 12px;">
                If you didn't expect this invitation, you can ignore this email.
            </p>
        </body>
        </html>
        """

        await email_service.send_email(
            subject=subject,
            body=body,
            to=pending_user.email,
            html=True
        )

        logger.info(f"Invitation resent to {pending_user.email} by {admin.username}")

    except ConfigurationError as e:
        logger.error(f"Invitation acceptance error: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")
    except Exception as e:
        logger.error(f"Failed to resend invitation email: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")

    return {"message": f"Invitation resent to {pending_user.email}"}


@router.get("/invitation/{token}")
async def get_invitation_info(
    token: str,
    db: AsyncSession = Depends(get_db)
):
    """Get information about an invitation (for the accept page)"""
    result = await db.execute(
        select(User).where(User.invitation_token == token)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="Invalid invitation token")

    if user.invitation_expires_at < get_now():
        raise HTTPException(status_code=410, detail="Invitation has expired")

    if user.is_active:
        raise HTTPException(status_code=400, detail="Invitation already accepted")

    return InvitationInfoResponse(
        email=user.email,
        display_name=user.display_name,
        role=user.role.value,
        expires_at=user.invitation_expires_at
    )


@router.post("/invitation/{token}/accept")
async def accept_invitation(
    token: str,
    accept_request: AcceptInvitationRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """Accept an invitation and set username/password"""
    result = await db.execute(
        select(User).where(User.invitation_token == token)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="Invalid invitation token")

    if user.invitation_expires_at < get_now():
        raise HTTPException(status_code=410, detail="Invitation has expired")

    if user.is_active:
        raise HTTPException(status_code=400, detail="Invitation already accepted")

    # Check if username is already taken
    result = await db.execute(
        select(User).where(User.username == accept_request.username)
    )
    existing = result.scalar_one_or_none()
    if existing and existing.id != user.id:
        raise HTTPException(status_code=400, detail="Username already taken")

    # Update user with their chosen username and password
    user.username = accept_request.username
    user.hashed_password = hash_password(accept_request.password)
    user.is_active = True
    user.invitation_token = None  # Clear the token
    user.invitation_expires_at = None
    user.last_login = get_now()

    await db.commit()
    await db.refresh(user)

    # Log the account creation
    ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else None)
    await log_audit(AuditAction.USER_CREATE, user_id=user.id, username=user.username, request=request, details={"method": "invitation"})

    # Create session and log user in automatically (with hashed token)
    session_token = secrets.token_urlsafe(TOKEN_BYTES)
    session_token_hash = hash_token(session_token)
    expires_at = get_now() + timedelta(days=SESSION_EXPIRY_DAYS)

    session = Session(
        user_id=user.id,
        token_hash=session_token_hash,  # Store hash, not plaintext
        token=f"HASHED:{session_token_hash[:8]}",  # Placeholder (NOT NULL constraint in DB)
        expires_at=expires_at,
        ip_address=ip,
        user_agent=request.headers.get("User-Agent"),
    )
    db.add(session)
    await db.commit()

    # Set cookie (must be "session_token" to match get_current_user cookie name)
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=SESSION_EXPIRY_DAYS * 24 * 60 * 60,
        path="/",
    )

    return LoginResponse(
        token=session_token,
        user=UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            display_name=user.display_name,
            role=user.role,
            is_active=user.is_active,
            is_kiosk=user.is_kiosk,
            is_farmhand=user.is_farmhand,
            expires_at=user.expires_at,
            last_login=user.last_login,
            created_at=user.created_at,
        ),
        expires_at=expires_at,
    )
