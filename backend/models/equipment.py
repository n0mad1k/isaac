"""
Equipment/Tools Models - Mowers, Chainsaws, Generators, etc.
"""

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, Enum, Date
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


class EquipmentType(enum.Enum):
    MOWER = "mower"
    CHAINSAW = "chainsaw"
    GENERATOR = "generator"
    PRESSURE_WASHER = "pressure_washer"
    WELDER = "welder"
    AIR_COMPRESSOR = "air_compressor"
    POWER_TOOLS = "power_tools"
    HAND_TOOLS = "hand_tools"
    OTHER = "other"


class Equipment(Base):
    """Equipment and tools requiring maintenance tracking"""
    __tablename__ = "equipment"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)  # e.g., "Husqvarna 455 Chainsaw"
    type = Column(Enum(EquipmentType), nullable=False)
    custom_type = Column(String(100))  # If type is OTHER

    # Details
    make = Column(String(100))
    model = Column(String(100))
    year = Column(Integer)
    serial_number = Column(String(100))

    # Acquisition
    purchase_date = Column(Date)
    purchase_price = Column(Float, nullable=True)

    # Current stats
    current_hours = Column(Integer, default=0)

    # Status
    is_active = Column(Boolean, default=True)
    notes = Column(Text)
    image_url = Column(String(500))

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    maintenance_tasks = relationship("EquipmentMaintenance", back_populates="equipment", cascade="all, delete-orphan")

    @property
    def display_type(self):
        """Return display name for type"""
        if self.type == EquipmentType.OTHER and self.custom_type:
            return self.custom_type
        return self.type.value.replace("_", " ").title()

    def __repr__(self):
        return f"<Equipment {self.name}>"


class EquipmentMaintenance(Base):
    """Recurring maintenance tasks for equipment"""
    __tablename__ = "equipment_maintenance"

    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False)
    name = Column(String(200), nullable=False)  # e.g., "Oil Change"
    description = Column(Text)

    # Frequency - hours or days based
    frequency_hours = Column(Integer, nullable=True)  # e.g., 50 hours
    frequency_days = Column(Integer, nullable=True)   # Fallback: e.g., 365 days

    # Last completed
    last_completed = Column(DateTime)
    last_hours = Column(Integer, nullable=True)

    # Next due (calculated or manual)
    next_due_date = Column(DateTime)
    next_due_hours = Column(Integer, nullable=True)
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
    equipment = relationship("Equipment", back_populates="maintenance_tasks")
    logs = relationship("EquipmentMaintenanceLog", back_populates="maintenance", cascade="all, delete-orphan")

    def calculate_next_due(self):
        """Calculate next due based on frequency type or manual date"""
        # If there's a recurring frequency, calculate from last completed
        if self.last_completed:
            if self.frequency_days:
                self.next_due_date = self.last_completed + timedelta(days=self.frequency_days)
                self.manual_due_date = None  # Clear manual date after recurring calc
            elif self.manual_due_date:
                # No recurring schedule - clear manual date after completion
                # User will need to set a new manual date
                self.next_due_date = None
                self.manual_due_date = None

        if self.frequency_hours and self.last_hours is not None:
            self.next_due_hours = self.last_hours + self.frequency_hours

    def set_manual_due_date(self, due_date):
        """Set a manual due date override"""
        self.manual_due_date = due_date
        self.next_due_date = due_date

    @property
    def status(self):
        """Return status: ok, due_soon, overdue"""
        if self.next_due_date:
            now = get_local_now()
            # Compare dates only (ignore time component)
            today = now.date()
            due = self.next_due_date.date() if hasattr(self.next_due_date, 'date') else self.next_due_date
            days_until = (due - today).days
            if days_until < 0:
                return "overdue"
            elif days_until <= 14:
                return "due_soon"
        return "ok"

    def __repr__(self):
        return f"<EquipmentMaintenance {self.name} for {self.equipment_id}>"


class EquipmentMaintenanceLog(Base):
    """Log of completed equipment maintenance"""
    __tablename__ = "equipment_maintenance_logs"

    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False)
    maintenance_id = Column(Integer, ForeignKey("equipment_maintenance.id"), nullable=True)

    name = Column(String(200))  # Copy of task name for history
    performed_at = Column(DateTime, default=datetime.utcnow)
    hours_at = Column(Integer, nullable=True)

    cost = Column(Float, nullable=True)
    notes = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    maintenance = relationship("EquipmentMaintenance", back_populates="logs")

    def __repr__(self):
        return f"<EquipmentMaintenanceLog {self.name} at {self.performed_at}>"
