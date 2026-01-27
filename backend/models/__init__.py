"""
Isaac Database Models
"""

from .database import Base, engine, async_session, init_db
from .plants import Plant, PlantCareLog, Tag, GrowthRate, SunRequirement as PlantSunRequirement
from .seeds import Seed, SeedCategory, SunRequirement, WaterRequirement
from .livestock import Animal, AnimalType, AnimalCategory, AnimalCareLog, AnimalExpense
from .tasks import Task, TaskCategory, TaskRecurrence, TaskType, task_member_assignments
from .weather import WeatherReading, WeatherAlert
from .settings import AppSetting
from .home_maintenance import HomeMaintenance, HomeMaintenanceLog, DEFAULT_CATEGORIES
from .vehicles import Vehicle, VehicleMaintenance, VehicleMaintenanceLog, VehicleType
from .equipment import Equipment, EquipmentMaintenance, EquipmentMaintenanceLog, EquipmentType
from .farm_areas import FarmArea, FarmAreaMaintenance, FarmAreaMaintenanceLog, FarmAreaType
from .production import (
    LivestockProduction, PlantHarvest, HarvestQuality, Sale, SaleCategory,
    Customer, LivestockOrder, OrderPayment, ProductionAllocation, HarvestAllocation,
    OrderStatus, PaymentType, PaymentMethod, AllocationType, HarvestUseType, PortionType
)
from .users import User, Session, UserRole, LoginAttempt, AuditLog, AuditAction
from .dev_tracker import DevTrackerItem, ItemType, ItemPriority, ItemStatus
from .workers import Worker
from .supply_requests import SupplyRequest, RequestStatus, RequestPriority
from .customer_feedback import CustomerFeedback, FeedbackType, FeedbackStatus
from .translation import TranslationCache
from .team import (
    TeamMember, MemberWeightLog, MemberMedicalLog, MentoringSession,
    ValuesAssessmentHistory, WeeklyObservation, WeeklyAAR,
    MemberRole, ReadinessStatus, VisionStatus, GoalsMet,
    ObservationType, ObservationScope,
    # Gear tracking
    MemberGear, MemberGearMaintenance, MemberGearContents, MemberGearMaintenanceLog,
    GearCategory, GearStatus, ContentStatus,
    # Training tracking
    MemberTraining, MemberTrainingLog, TrainingCategory,
    # Medical appointments
    MemberMedicalAppointment, AppointmentType
)

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
    "DEFAULT_CATEGORIES",
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
    "Sale",
    "SaleCategory",
    "Customer",
    "LivestockOrder",
    "OrderPayment",
    "ProductionAllocation",
    "HarvestAllocation",
    "OrderStatus",
    "PaymentType",
    "PaymentMethod",
    "AllocationType",
    "HarvestUseType",
    "PortionType",
    "User",
    "Session",
    "UserRole",
    "LoginAttempt",
    "AuditLog",
    "AuditAction",
    "DevTrackerItem",
    "ItemType",
    "ItemPriority",
    "ItemStatus",
    "Worker",
    "SupplyRequest",
    "RequestStatus",
    "RequestPriority",
    "CustomerFeedback",
    "FeedbackType",
    "FeedbackStatus",
    "TranslationCache",
    # Team models
    "TeamMember",
    "MemberWeightLog",
    "MemberMedicalLog",
    "MentoringSession",
    "ValuesAssessmentHistory",
    "WeeklyObservation",
    "WeeklyAAR",
    "MemberRole",
    "ReadinessStatus",
    "VisionStatus",
    "GoalsMet",
    "ObservationType",
    "ObservationScope",
    # Gear tracking
    "MemberGear",
    "MemberGearMaintenance",
    "MemberGearContents",
    "MemberGearMaintenanceLog",
    "GearCategory",
    "GearStatus",
    "ContentStatus",
    # Training tracking
    "MemberTraining",
    "MemberTrainingLog",
    "TrainingCategory",
    # Medical appointments
    "MemberMedicalAppointment",
    "AppointmentType",
]
