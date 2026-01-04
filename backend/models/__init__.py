"""
Levi Database Models
"""

from .database import Base, engine, async_session, init_db
from .plants import Plant, PlantCareLog, Tag, GrowthRate, SunRequirement as PlantSunRequirement
from .seeds import Seed, SeedCategory, SunRequirement, WaterRequirement
from .livestock import Animal, AnimalType, AnimalCategory, AnimalCareLog, AnimalExpense
from .tasks import Task, TaskCategory, TaskRecurrence
from .weather import WeatherReading, WeatherAlert
from .settings import AppSetting
from .home_maintenance import HomeMaintenance, HomeMaintenanceLog, HomeMaintenanceCategory
from .vehicles import Vehicle, VehicleMaintenance, VehicleMaintenanceLog, VehicleType
from .equipment import Equipment, EquipmentMaintenance, EquipmentMaintenanceLog, EquipmentType
from .farm_areas import FarmArea, FarmAreaMaintenance, FarmAreaMaintenanceLog, FarmAreaType
from .production import LivestockProduction, PlantHarvest, HarvestQuality
from .users import User, Session, UserRole

__all__ = [
    "Base",
    "engine",
    "async_session",
    "init_db",
    "Plant",
    "PlantCareLog",
    "Tag",
    "GrowthRate",
    "PlantSunRequirement",
    "Seed",
    "SeedCategory",
    "SunRequirement",
    "WaterRequirement",
    "Animal",
    "AnimalType",
    "AnimalCategory",
    "AnimalCareLog",
    "AnimalExpense",
    "Task",
    "TaskCategory",
    "TaskRecurrence",
    "WeatherReading",
    "WeatherAlert",
    "AppSetting",
    "HomeMaintenance",
    "HomeMaintenanceLog",
    "HomeMaintenanceCategory",
    "Vehicle",
    "VehicleMaintenance",
    "VehicleMaintenanceLog",
    "VehicleType",
    "Equipment",
    "EquipmentMaintenance",
    "EquipmentMaintenanceLog",
    "EquipmentType",
    "FarmArea",
    "FarmAreaMaintenance",
    "FarmAreaMaintenanceLog",
    "FarmAreaType",
    "LivestockProduction",
    "PlantHarvest",
    "HarvestQuality",
    "User",
    "Session",
    "UserRole",
]
