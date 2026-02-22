"""
Isaac - Farm & Homestead Assistant
Main FastAPI Application
"""

from contextlib import asynccontextmanager
from collections import defaultdict
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from loguru import logger
import sys


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses"""
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"
        # XSS protection (legacy but still useful)
        response.headers["X-XSS-Protection"] = "1; mode=block"
        # Referrer policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # Permissions policy (restrict powerful features)
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        # Content Security Policy - defense-in-depth against XSS
        response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'"
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


class LocalNetworkOnlyMiddleware(BaseHTTPMiddleware):
    """Restrict API access to localhost, local network, and Tailscale

    Security model:
    - Localhost connections (nginx/cloudflared) are always trusted
    - Direct connections must be from local network or Tailscale
    - X-Forwarded-For is ignored to prevent IP spoofing
    """
    LOCAL_NETWORK_PREFIXES = (
        "192.168.",  # Private network
        "10.",       # Private network
        "172.16.", "172.17.", "172.18.", "172.19.",  # Private network
        "172.20.", "172.21.", "172.22.", "172.23.",
        "172.24.", "172.25.", "172.26.", "172.27.",
        "172.28.", "172.29.", "172.30.", "172.31.",
        "100.",      # Tailscale CGNAT range (100.64.0.0/10)
    )

    async def dispatch(self, request: Request, call_next):
        # Get the raw TCP socket IP from ASGI scope (not affected by X-Forwarded-For)
        # This is the actual peer address of the connection
        client_info = request.scope.get("client")
        socket_ip = client_info[0] if client_info else None

        if socket_ip:
            # Always trust localhost - this is nginx proxying from cloudflared tunnel
            # or direct local connections. Cloudflare tunnel auth happens at edge.
            if socket_ip.startswith("127.") or socket_ip == "::1":
                return await call_next(request)

            # For non-localhost, check if from allowed local network
            if not any(socket_ip.startswith(prefix) for prefix in self.LOCAL_NETWORK_PREFIXES):
                from fastapi.responses import JSONResponse
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
        # Skip rate limiting for auth endpoints (handled by account lockout)
        if request.url.path.startswith("/api/auth/"):
            return await call_next(request)

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


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown"""
    # Startup
    logger.info(f"Starting {settings.app_name} v{settings.app_version}")

    # Initialize database
    await init_db()
    logger.info("Database initialized")

    # Start scheduler
    await scheduler.start()
    logger.info("Scheduler started")

    yield

    # Shutdown
    logger.info("Shutting down...")
    await scheduler.stop()


# Create application
app = FastAPI(
    title=settings.app_name,
    description="Farm & Homestead Management Assistant",
    version=settings.app_version,
    lifespan=lifespan,
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
    "https://levi.local",
    "https://isaac.local",
    "https://192.168.5.57",
    "https://192.168.5.57:8000",
    "https://192.168.5.57:8443",
    "http://localhost",
    "http://localhost:5173",   # Vite dev server
    "http://localhost:3000",
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
    """Health check endpoint"""
    return {
        "status": "healthy",
        "scheduler_running": scheduler.scheduler.running,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
