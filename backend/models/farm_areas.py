"""
Farm Area Models - Gardens, Pastures, Coops, etc.
"""

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
import enum

from .database import Base


class FarmAreaType(enum.Enum):
    GARDEN = "garden"
    NURSERY = "nursery"
    FOOD_FOREST = "food_forest"
    ORCHARD = "orchard"
    PASTURE = "pasture"
    POND = "pond"
    BARN = "barn"
    CHICKEN_COOP = "chicken_coop"
    RABBIT_HUTCH = "rabbit_hutch"
    APIARY = "apiary"  # Bee yard
    GREENHOUSE = "greenhouse"
    SHED = "shed"
    CUSTOM = "custom"


class FarmArea(Base):
    """Farm areas/zones for organization and maintenance tracking"""
    __tablename__ = "farm_areas"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)  # e.g., "Front Pasture", "Main Garden"
    type = Column(Enum(FarmAreaType), nullable=False)
    custom_type = Column(String(100))  # If type is CUSTOM

    # Details
    description = Column(Text)
    location_notes = Column(String(500))  # e.g., "Behind the barn"

    # Size
    size_acres = Column(Float, nullable=True)
    size_sqft = Column(Float, nullable=True)

    # Growing info (for gardens/pastures)
    soil_type = Column(String(100))
    irrigation_type = Column(String(100))  # Drip, Sprinkler, None, etc.

    # Status
    is_active = Column(Boolean, default=True)
    notes = Column(Text)

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    maintenance_tasks = relationship("FarmAreaMaintenance", back_populates="area", cascade="all, delete-orphan")
    plants = relationship("Plant", back_populates="farm_area")
    animals = relationship("Animal", back_populates="farm_area")

    @property
    def display_type(self):
        """Return display name for type"""
        if self.type == FarmAreaType.CUSTOM and self.custom_type:
            return self.custom_type
        return self.type.value.replace("_", " ").title()

    def __repr__(self):
        return f"<FarmArea {self.name}>"


class FarmAreaMaintenance(Base):
    """Recurring maintenance tasks for farm areas"""
    __tablename__ = "farm_area_maintenance"

    id = Column(Integer, primary_key=True, index=True)
    area_id = Column(Integer, ForeignKey("farm_areas.id"), nullable=False)
    name = Column(String(200), nullable=False)  # e.g., "Fence Check"
    description = Column(Text)

    # Frequency
    frequency_days = Column(Integer, nullable=False)
    frequency_label = Column(String(50))  # "Monthly", "Weekly", etc.

    # Seasonal tasks
    seasonal = Column(Boolean, default=False)
    active_months = Column(String(50))  # e.g., "Mar-Oct" if seasonal

    # Last completed
    last_completed = Column(DateTime)
    next_due = Column(DateTime)

    # Notifications
    notify_channels = Column(String(100), default="dashboard,calendar")

    # Status
    is_active = Column(Boolean, default=True)
    notes = Column(Text)

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    area = relationship("FarmArea", back_populates="maintenance_tasks")
    logs = relationship("FarmAreaMaintenanceLog", back_populates="maintenance", cascade="all, delete-orphan")

    def calculate_next_due(self):
        """Calculate next due date"""
        if self.last_completed:
            self.next_due = self.last_completed + timedelta(days=self.frequency_days)
        return self.next_due

    @property
    def status(self):
        """Return status: ok, due_soon, overdue"""
        if not self.next_due:
            return "unknown"
        now = datetime.utcnow()
        days_until = (self.next_due - now).days
        if days_until < 0:
            return "overdue"
        elif days_until <= 7:
            return "due_soon"
        return "ok"

    def __repr__(self):
        return f"<FarmAreaMaintenance {self.name} for {self.area_id}>"


class FarmAreaMaintenanceLog(Base):
    """Log of completed farm area maintenance"""
    __tablename__ = "farm_area_maintenance_logs"

    id = Column(Integer, primary_key=True, index=True)
    area_id = Column(Integer, ForeignKey("farm_areas.id"), nullable=False)
    maintenance_id = Column(Integer, ForeignKey("farm_area_maintenance.id"), nullable=True)

    name = Column(String(200))  # Copy of task name for history
    performed_at = Column(DateTime, default=datetime.utcnow)

    cost = Column(Float, nullable=True)
    notes = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    maintenance = relationship("FarmAreaMaintenance", back_populates="logs")

    def __repr__(self):
        return f"<FarmAreaMaintenanceLog {self.name} at {self.performed_at}>"
