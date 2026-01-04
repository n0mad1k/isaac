"""
Levi - Farm & Homestead Assistant
Main FastAPI Application
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
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
    """Restrict API access to localhost, local network, and Tailscale"""
    ALLOWED_PREFIXES = (
        "127.",      # localhost IPv4
        "::1",       # localhost IPv6
        "192.168.",  # Private network
        "10.",       # Private network
        "172.16.", "172.17.", "172.18.", "172.19.",  # Private network
        "172.20.", "172.21.", "172.22.", "172.23.",
        "172.24.", "172.25.", "172.26.", "172.27.",
        "172.28.", "172.29.", "172.30.", "172.31.",
        "100.",      # Tailscale CGNAT range (100.64.0.0/10)
    )

    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host if request.client else None

        # Allow if from local network or localhost
        if client_ip:
            if not any(client_ip.startswith(prefix) for prefix in self.ALLOWED_PREFIXES):
                from fastapi.responses import JSONResponse
                logger.warning(f"Blocked request from non-local IP: {client_ip}")
                return JSONResponse(
                    status_code=403,
                    content={"detail": "Access denied. This API is only accessible from the local network."}
                )

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
)
from routers.settings import get_setting


# Configure logging
# Security: Only enable DEBUG in debug mode, otherwise INFO level only
log_level = "DEBUG" if settings.debug else "INFO"
logger.remove()
logger.add(
    sys.stderr,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    level=log_level,
)
logger.add(
    "logs/levi.log",
    rotation="10 MB",
    retention="30 days",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
    level=log_level,  # Match console level for security
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

# Security - restrict to local network only
app.add_middleware(LocalNetworkOnlyMiddleware)

# Trailing slash middleware - normalize URLs
app.add_middleware(TrailingSlashMiddleware)

# CORS middleware - allow frontend access
# Security is handled by LocalNetworkOnlyMiddleware which restricts to local IPs
# CORS allows access from any origin on local network since the middleware already filters
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # LocalNetworkOnlyMiddleware handles network-level security
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)

# Include routers
app.include_router(auth_router)  # Auth first for setup check
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
