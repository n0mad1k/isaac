"""
Isaac API Routers
"""

from .plants import router as plants_router
from .animals import router as animals_router
from .tasks import router as tasks_router
from .weather import router as weather_router
from .dashboard import router as dashboard_router
from .seeds import router as seeds_router
from .settings import router as settings_router
from .home_maintenance import router as home_maintenance_router
from .vehicles import router as vehicles_router
from .equipment import router as equipment_router
from .farm_areas import router as farm_areas_router
from .production import router as production_router
from .auth import router as auth_router
try:
    from .dev_tracker import router as dev_tracker_router
except ImportError:
    dev_tracker_router = None  # Not available in public release
from .workers import router as workers_router
from .supply_requests import router as supply_requests_router
from .customer_feedback import router as customer_feedback_router
from .team import router as team_router
from .garden import router as garden_router
from .budget import router as budget_router
from .chat import router as chat_router
from .setup import router as setup_router

__all__ = [
    "plants_router",
    "animals_router",
    "tasks_router",
    "weather_router",
    "dashboard_router",
    "seeds_router",
    "settings_router",
    "home_maintenance_router",
    "vehicles_router",
    "equipment_router",
    "farm_areas_router",
    "production_router",
    "auth_router",
    "dev_tracker_router",
    "workers_router",
    "supply_requests_router",
    "customer_feedback_router",
    "team_router",
    "garden_router",
    "budget_router",
    "chat_router",
    "setup_router",
]
