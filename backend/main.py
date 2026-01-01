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
    """Restrict API access to localhost and local network only"""
    ALLOWED_PREFIXES = (
        "127.",      # localhost IPv4
        "::1",       # localhost IPv6
        "192.168.",  # Private network
        "10.",       # Private network
        "172.16.", "172.17.", "172.18.", "172.19.",  # Private network
        "172.20.", "172.21.", "172.22.", "172.23.",
        "172.24.", "172.25.", "172.26.", "172.27.",
        "172.28.", "172.29.", "172.30.", "172.31.",
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
)


# Configure logging
logger.remove()
logger.add(
    sys.stderr,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    level="DEBUG" if settings.debug else "INFO",
)
logger.add(
    "logs/levi.log",
    rotation="10 MB",
    retention="30 days",
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

# Security - restrict to local network only
app.add_middleware(LocalNetworkOnlyMiddleware)

# Trailing slash middleware - normalize URLs
app.add_middleware(TrailingSlashMiddleware)

# CORS middleware - allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(dashboard_router)
app.include_router(plants_router)
app.include_router(animals_router)
app.include_router(tasks_router)
app.include_router(weather_router)
app.include_router(seeds_router)


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
