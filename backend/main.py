"""
Isaac - Farm & Homestead Assistant
Main FastAPI Application
"""

from contextlib import asynccontextmanager
from collections import defaultdict
import time
import asyncio
import pathlib
from datetime import datetime, timedelta
from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from loguru import logger
import sys
from sqlalchemy import select
from services.encryption import is_value_decryptable
from services.email import EmailService, ConfigurationError
from models.settings import AppSetting


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses"""
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        # XSS protection (legacy but still useful)
        response.headers["X-XSS-Protection"] = "1; mode=block"
        # Referrer policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # Permissions policy (restrict powerful features)
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        # Content Security Policy - defense-in-depth against XSS
        response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'self'"
        return response


class TrailingSlashMiddleware(BaseHTTPMiddleware):
    """Normalize all paths to have trailing slashes to match router definitions"""
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        # Add trailing slash if missing (except for root and file paths)
        if not path.endswith("/") and "." not in path.split("/")[-1]:
            scope = request.scope.copy()
            scope["path"] = path + "/"
            request = Request(scope, request.receive)
        return await call_next(request)


LOCAL_NETWORK_PREFIXES = (
    "192.168.",
    "10.",
    "172.16.", "172.17.", "172.18.", "172.19.",
    "172.20.", "172.21.", "172.22.", "172.23.",
    "172.24.", "172.25.", "172.26.", "172.27.",
    "172.28.", "172.29.", "172.30.", "172.31.",
)


def is_tailscale_ip(ip: str) -> bool:
    """Tailscale CGNAT range 100.64.0.0/10 (second octet 64-127)."""
    if not ip or not ip.startswith("100."):
        return False
    try:
        parts = ip.split(".")
        return 64 <= int(parts[1]) <= 127
    except (IndexError, ValueError):
        return False


def is_lan_or_tailscale(ip: str) -> bool:
    if not ip:
        return False
    return any(ip.startswith(p) for p in LOCAL_NETWORK_PREFIXES) or is_tailscale_ip(ip)



def is_loopback(ip: str) -> bool:
    """Check if IP is loopback (localhost/127.x or ::1)."""
    if not ip:
        return False
    return ip == "::1" or ip.startswith("127.")

def resolve_client_ip(request: Request) -> str | None:
    """Best-effort real client IP.

    Prefers X-Real-IP (set by trusted nginx from the TCP peer), falls back to
    the rightmost entry of X-Forwarded-For (added by the nearest proxy), then
    the raw socket IP. Cloudflare's CF-Connecting-IP is honored when present —
    it is the external client and will not be in LAN/Tailscale ranges.
    """
    cf_ip = request.headers.get("CF-Connecting-IP")
    if cf_ip:
        return cf_ip.strip()

    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()

    xff = request.headers.get("X-Forwarded-For")
    if xff:
        parts = [p.strip() for p in xff.split(",") if p.strip()]
        if parts:
            return parts[-1]

    client_info = request.scope.get("client")
    return client_info[0] if client_info else None


class LocalNetworkOnlyMiddleware(BaseHTTPMiddleware):
    """Restrict API access to localhost, local network, and Tailscale.

    - Direct connections must be from LAN or Tailscale.
    - Localhost (127.*, ::1) is allowed so nginx/cloudflared can reach the app;
      per-route kiosk checks must use resolve_client_ip() to verify LAN origin.
    """

    async def dispatch(self, request: Request, call_next):
        client_info = request.scope.get("client")
        socket_ip = client_info[0] if client_info else None

        if socket_ip:
            if socket_ip.startswith("127.") or socket_ip == "::1":
                return await call_next(request)

            if not is_lan_or_tailscale(socket_ip):
                logger.warning(f"Blocked request from non-local IP: {socket_ip}")
                return JSONResponse(
                    status_code=403,
                    content={"detail": "Access denied. This API is only accessible from the local network."}
                )

        return await call_next(request)

class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple in-memory rate limiter per client IP.

    Limits:
    - 200 total requests per minute per IP (GET + write)
    - 60 write requests (POST/PUT/DELETE/PATCH) per minute per IP
    - Auth endpoints excluded (handled by account lockout in auth.py)
    """
    GLOBAL_LIMIT = 200   # total requests per window
    WRITE_LIMIT = 60     # write requests per window
    WINDOW = 60          # seconds

    def __init__(self, app):
        super().__init__(app)
        self._requests = defaultdict(list)
        self._writes = defaultdict(list)
        self._last_cleanup = time.monotonic()

    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host if request.client else "unknown"
        now = time.monotonic()
        cutoff = now - self.WINDOW

        # Periodic cleanup of stale IPs (every 5 minutes)
        if now - self._last_cleanup > 300:
            stale = [ip for ip, ts in self._requests.items() if not ts or ts[-1] < cutoff]
            for ip in stale:
                self._requests.pop(ip, None)
                self._writes.pop(ip, None)
            self._last_cleanup = now

        # Clean old entries for this IP
        reqs = self._requests[client_ip]
        self._requests[client_ip] = [t for t in reqs if t > cutoff]

        # Check global limit
        if len(self._requests[client_ip]) >= self.GLOBAL_LIMIT:
            logger.warning(f"Rate limit exceeded for {client_ip}: {len(self._requests[client_ip])} requests/min")
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please try again later."},
                headers={"Retry-After": str(self.WINDOW)}
            )

        # Check write limit
        if request.method in ("POST", "PUT", "DELETE", "PATCH"):
            writes = self._writes[client_ip]
            self._writes[client_ip] = [t for t in writes if t > cutoff]
            if len(self._writes[client_ip]) >= self.WRITE_LIMIT:
                logger.warning(f"Write rate limit exceeded for {client_ip}: {len(self._writes[client_ip])} writes/min")
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Too many write requests. Please try again later."},
                    headers={"Retry-After": str(self.WINDOW)}
                )
            self._writes[client_ip].append(now)

        self._requests[client_ip].append(now)
        return await call_next(request)


from config import settings
from models.database import init_db
from services.scheduler import SchedulerService
from routers import (
    plants_router,
    animals_router,
    tasks_router,
    lists_router,
    weather_router,
    dashboard_router,
    seeds_router,
    settings_router,
    home_maintenance_router,
    vehicles_router,
    equipment_router,
    farm_areas_router,
    production_router,
    auth_router,
    dev_tracker_router,  # May be None in public release
    workers_router,
    supply_requests_router,
    customer_feedback_router,
    team_router,
    garden_router,
    budget_router,
    chat_router,
    setup_router,
)
from routers.settings import get_setting
from routers.auth import require_admin


# Configure logging
# Console and main log: INFO level (DEBUG only if debug=True)
# Debug log: always captures DEBUG for troubleshooting
log_level = "DEBUG" if settings.debug else "INFO"
logger.remove()
logger.add(
    sys.stderr,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    level=log_level,
)
logger.add(
    "logs/isaac.log",
    rotation="10 MB",
    retention="30 days",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
    level=log_level,
)
# Always-on debug log for troubleshooting (smaller rotation, shorter retention)
logger.add(
    "logs/debug.log",
    rotation="5 MB",
    retention="7 days",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
    level="DEBUG",
)

# Scheduler instance
scheduler = SchedulerService()


async def _send_encryption_error_email(db, error_keys: list) -> None:
    """Send encryption error notification email with timeout.

    Fire-and-forget task scheduled during startup. Logs if it fails but does not
    block startup. If successful, updates the notification timestamp in the database.
    """
    from routers.settings import get_setting
    from models.database import async_session

    try:
        async def send_and_update():
            try:
                email_service = await EmailService.get_configured_service(db)
                admin_email = await get_setting(db, "admin_email")
                if admin_email:
                    error_list = ", ".join(error_keys)
                    body = (
                        f"Isaac encryption audit detected {len(error_keys)} "
                        f"encrypted settings that cannot be decrypted:\n\n"
                        f"{error_list}\n\n"
                        f"Recovery options:\n"
                        f"1. Restore SECRET_KEY from backup\n"
                        f"2. Re-enter these settings in Settings > Passwords\n"
                        f"3. Run: python -m backend.admin rotate-key --reset-encrypted (DESTRUCTIVE)\n\n"
                        f"Log into Isaac and visit Settings to address this issue."
                    )
                    await asyncio.wait_for(
                        email_service.send_email(
                            subject="[Isaac] Encryption Audit: Unreadable Settings",
                            body=body,
                            to=admin_email,
                            html=False,
                            no_prefix=True,
                        ),
                        timeout=10.0
                    )
                    logger.info("Sent encryption error notification email")
            except asyncio.TimeoutError:
                logger.warning("Encryption error email send timed out (10s)")
            except ConfigurationError:
                logger.debug("Email not configured; skipping encryption error notification")
            except Exception as e:
                logger.warning(f"Failed to send encryption error email: {e}")

        await send_and_update()
    except Exception as e:
        logger.warning(f"Encryption error email task failed: {e}")


async def _run_encryption_audit(app: FastAPI):
    """Audit encrypted settings at startup; populate app.state.encryption_errors.

    If errors found and no recent notification (24h), schedule fire-and-forget email alert.
    """
    from routers.settings import get_setting
    from models.database import async_session

    app.state.encryption_errors = []
    start_time = time.monotonic()
    audit_timeout = 5.0

    try:
        async with async_session() as db:
            result = await db.execute(
                select(AppSetting).where(AppSetting.value.like("enc::%"))
            )
            encrypted_rows = result.scalars().all()

            for row in encrypted_rows:
                if time.monotonic() - start_time > audit_timeout:
                    logger.error(
                        f"Encryption audit aborted: exceeded {audit_timeout}s timeout "
                        f"(checked {len(app.state.encryption_errors)} of {len(encrypted_rows)} encrypted settings)"
                    )
                    break

                if not is_value_decryptable(row.value):
                    app.state.encryption_errors.append(row.key)

            if app.state.encryption_errors:
                logger.error(
                    f"Encryption audit: cannot decrypt {len(app.state.encryption_errors)} settings. "
                    f"Re-enter these in Settings UI, or restore SECRET_KEY from backup."
                )

                # Check if we should send a notification email (once per 24h)
                should_notify = True
                try:
                    last_notified_str = await get_setting(db, "last_encryption_error_notified_at")
                    if last_notified_str:
                        try:
                            last_notified = datetime.fromisoformat(last_notified_str)
                            if datetime.utcnow() - last_notified < timedelta(hours=24):
                                should_notify = False
                        except ValueError as e:
                            logger.debug(f"Could not parse encryption notification timestamp: {e}; sending alert anyway")
                except Exception as e:
                    logger.debug(f"Could not check encryption notification timestamp: {e}; sending alert anyway")

                if should_notify:
                    # Fire-and-forget: schedule email task without blocking startup
                    asyncio.create_task(_send_encryption_error_email(db, app.state.encryption_errors))

                    # Update timestamp immediately so duplicate emails don't spam
                    try:
                        result = await db.execute(
                            select(AppSetting).where(AppSetting.key == "last_encryption_error_notified_at")
                        )
                        setting = result.scalar_one_or_none()
                        if setting:
                            setting.value = datetime.utcnow().isoformat()
                        else:
                            db.add(AppSetting(
                                key="last_encryption_error_notified_at",
                                value=datetime.utcnow().isoformat()
                            ))
                        await db.commit()
                    except Exception as e:
                        logger.warning(f"Failed to update encryption error notification timestamp: {e}")

    except Exception as e:
        logger.error(f"Encryption audit failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown"""
    # Startup
    logger.info(f"Starting {settings.app_name} v{settings.app_version}")

    # Initialize database
    await init_db()
    logger.info("Database initialized")

    # Verify encryption probe — check decryptability of all encrypted settings
    try:
        from services.encryption import verify_secret_key_against_db
        db_url = settings.database_url
        # Convert async URL to sync URL: "sqlite+aiosqlite:///..." -> "sqlite:///..."
        db_path = db_url.replace("sqlite+aiosqlite:///", "").replace("+aiosqlite", "")
        if not db_path:
            db_path = pathlib.Path(__file__).resolve().parent / "data" / "levi.db"
        all_decryptable, failed_keys = verify_secret_key_against_db(db_path)
        if not all_decryptable:
            logger.debug(f"Encryption probe failed keys (debug): {failed_keys}")
            logger.error(f"Encryption probe failed: cannot decrypt {len(failed_keys)} settings")
            raise RuntimeError(
                f"Cannot decrypt {len(failed_keys)} encrypted settings. "
                f"SECRET_KEY may have rotated."
            )
        if failed_keys:
            logger.debug(f"Encryption probe orphan keys (debug): {failed_keys}")
            logger.warning(f"Encryption probe: {len(failed_keys)} settings failed (partial failure)")
    except RuntimeError:
        raise
    except Exception as e:
        logger.warning(f"Encryption probe skipped (no encrypted data or probe error): {e}")

    # Run encryption audit
    await _run_encryption_audit(app)

    # Start scheduler
    scheduler.bind_app(app)
    await scheduler.start()
    logger.info("Scheduler started")

    yield

    # Shutdown
    logger.info("Shutting down...")
    await scheduler.stop()


# Create application - disable docs in production
_docs_url = "/docs" if settings.is_dev_instance else None
_redoc_url = "/redoc" if settings.is_dev_instance else None
app = FastAPI(
    title=settings.app_name,
    description="Farm & Homestead Management Assistant",
    version=settings.app_version,
    lifespan=lifespan,
    docs_url=_docs_url,
    redoc_url=_redoc_url,
)

# Security headers - add protective headers to all responses
app.add_middleware(SecurityHeadersMiddleware)

# Rate limiting - prevent API abuse (200 req/min global, 60 writes/min)
app.add_middleware(RateLimitMiddleware)

# Security - restrict to local network only
app.add_middleware(LocalNetworkOnlyMiddleware)

# Trailing slash middleware - normalize URLs
app.add_middleware(TrailingSlashMiddleware)

# CORS middleware - allow frontend access from known local origins
# Using explicit origins instead of "*" to safely allow credentials
_cors_origins = [
    "https://isaac.local",
    "http://localhost",
    "http://localhost:5173",   # Vite dev server
    "http://localhost:3000",
    "https://localhost:443",   # Docker default
    "https://localhost",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)

# Include routers
if setup_router:
    app.include_router(setup_router)  # Setup wizard (deleted after use)
app.include_router(auth_router)  # Auth first
app.include_router(dashboard_router)
app.include_router(plants_router)
app.include_router(animals_router)
app.include_router(lists_router)
app.include_router(tasks_router)
app.include_router(weather_router)
app.include_router(seeds_router)
app.include_router(settings_router)
app.include_router(home_maintenance_router)
app.include_router(vehicles_router)
app.include_router(equipment_router)
app.include_router(farm_areas_router)
app.include_router(production_router)
if dev_tracker_router:  # Only in dev/private builds
    app.include_router(dev_tracker_router)
app.include_router(workers_router)
app.include_router(supply_requests_router)
if customer_feedback_router:  # Only in dev/private builds
    app.include_router(customer_feedback_router)
app.include_router(team_router)
app.include_router(garden_router)
app.include_router(budget_router)
app.include_router(chat_router)


@app.get("/")
async def root():
    """Root endpoint - API info"""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "description": "Farm & Homestead Management Assistant",
        "docs": "/docs",
        "endpoints": {
            "dashboard": "/dashboard",
            "plants": "/plants",
            "animals": "/animals",
            "tasks": "/tasks",
            "weather": "/weather",
            "home_maintenance": "/home-maintenance",
            "vehicles": "/vehicles",
            "equipment": "/equipment",
            "farm_areas": "/farm-areas",
            "production": "/production",
        },
    }


@app.get("/health")
async def health_check():
    """Health check endpoint (unauthenticated)"""
    return {
        "status": "healthy",
        "scheduler_running": scheduler.scheduler.running,
        "has_encryption_errors": bool(getattr(app.state, "encryption_errors", [])),
    }


@app.get("/health/admin")
async def health_check_admin(user=Depends(require_admin)):
    """Health check endpoint with detailed encryption errors (admin only)"""
    return {
        "status": "healthy",
        "scheduler_running": scheduler.scheduler.running,
        "encryption_errors": getattr(app.state, "encryption_errors", []),
        "caldav_last_success_at": getattr(app.state, "caldav_last_success_at", None),
        "caldav_silence_severity": getattr(app.state, "caldav_silence_severity", "ok"),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
