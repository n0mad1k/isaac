"""
Levi API Routers
"""

from .plants import router as plants_router
from .animals import router as animals_router
from .tasks import router as tasks_router
from .weather import router as weather_router
from .dashboard import router as dashboard_router
from .seeds import router as seeds_router
from .settings import router as settings_router

__all__ = [
    "plants_router",
    "animals_router",
    "tasks_router",
    "weather_router",
    "dashboard_router",
    "seeds_router",
    "settings_router",
]
