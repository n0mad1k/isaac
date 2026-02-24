"""
Farm Area Models - Gardens, Pastures, Coops, etc.
"""

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
import enum
import pytz

from .database import Base
from config import settings


def get_local_now():
    """Get current time in configured timezone"""
    tz = pytz.timezone(settings.timezone)
    return datetime.now(tz).replace(tzinfo=None)


class FarmAreaType(enum.Enum):
    # Indoor/Buildings
    HOUSE = "house"
    BARN = "barn"
    POLE_BARN = "pole_barn"
    WORKSHOP = "workshop"
    GREENHOUSE = "greenhouse"
    SHED = "shed"
    GARAGE = "garage"
    STORAGE = "storage"

    # Rooms/Indoor Sub-locations
    BEDROOM = "bedroom"
    BATHROOM = "bathroom"
    KITCHEN = "kitchen"
    LIVING_ROOM = "living_room"
    OFFICE = "office"
    LAUNDRY = "laundry"
    CLOSET = "closet"
    ATTIC = "attic"
    BASEMENT = "basement"

    # Outdoor/Growing
    GARDEN = "garden"
    FIELD = "field"
    NURSERY = "nursery"
    FOOD_FOREST = "food_forest"
    ORCHARD = "orchard"
    PASTURE = "pasture"
    YARD = "yard"
    FRONT_YARD = "front_yard"
    BACK_YARD = "back_yard"
    SIDE_YARD = "side_yard"

    # Water Features
    POND = "pond"
    POOL = "pool"

    # Animal Housing
    CHICKEN_COOP = "chicken_coop"
    RABBIT_HUTCH = "rabbit_hutch"
    DOG_KENNEL = "dog_kennel"
    STALL = "stall"
    PEN = "pen"
    APIARY = "apiary"  # Bee yard

    # Other
    DRIVEWAY = "driveway"
    DECK = "deck"
    PATIO = "patio"
    PORCH = "porch"
    FENCE = "fence"
    CUSTOM = "custom"


class FarmArea(Base):
    """Farm areas/zones for organization and maintenance tracking"""
    __tablename__ = "farm_areas"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)  # e.g., "Front Pasture", "Main Garden"
    type = Column(Enum(FarmAreaType), nullable=False)
    custom_type = Column(String(100))  # If type is CUSTOM

    # Hierarchical structure for sub-locations
    parent_id = Column(Integer, ForeignKey("farm_areas.id"), nullable=True)

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
    equipment = relationship("Equipment", back_populates="farm_area")

    # Hierarchical relationships
    parent = relationship("FarmArea", remote_side=[id], backref="children")

    @property
    def display_type(self):
        """Return display name for type"""
        if self.type == FarmAreaType.CUSTOM and self.custom_type:
            return self.custom_type
        return self.type.value.replace("_", " ").title()

    @property
    def full_path(self):
        """Return full hierarchical path (e.g., 'House > Master Bedroom')"""
        if self.parent:
            return f"{self.parent.full_path} > {self.name}"
        return self.name

    @property
    def is_sub_location(self):
        """Return True if this is a sub-location"""
        return self.parent_id is not None

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
    manual_due_date = Column(DateTime, nullable=True)  # User-set override

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
        """Calculate next due date based on frequency or manual override"""
        if self.last_completed:
            if self.frequency_days and self.frequency_days > 0:
                self.next_due = self.last_completed + timedelta(days=self.frequency_days)
                self.manual_due_date = None  # Clear manual date after recurring calc
            else:
                # No day-based frequency - clear date tracking
                # Task needs manual due date to be set again
                self.next_due = None
                self.manual_due_date = None
        return self.next_due

    def set_manual_due_date(self, due_date):
        """Set a manual due date override"""
        self.manual_due_date = due_date
        self.next_due = due_date

    @property
    def status(self):
        """Return status: ok, due_soon, overdue"""
        if not self.next_due:
            return "unknown"
        now = get_local_now()
        # Compare dates only (ignore time component)
        today = now.date()
        due = self.next_due.date() if hasattr(self.next_due, 'date') else self.next_due
        days_until = (due - today).days
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
