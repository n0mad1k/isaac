"""
Home Maintenance Models
"""

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
import enum

from .database import Base


class HomeMaintenanceCategory(enum.Enum):
    HVAC = "hvac"
    PLUMBING = "plumbing"
    ELECTRICAL = "electrical"
    EXTERIOR = "exterior"
    APPLIANCES = "appliances"
    POOL = "pool"
    SAFETY = "safety"
    GENERAL = "general"


class HomeMaintenance(Base):
    """Home maintenance tasks with recurring schedules"""
    __tablename__ = "home_maintenance"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    category = Column(Enum(HomeMaintenanceCategory), default=HomeMaintenanceCategory.GENERAL)
    description = Column(Text)

    # Frequency
    frequency_days = Column(Integer, nullable=False)  # Days between tasks
    frequency_label = Column(String(50))  # Human readable: "Monthly", "Every 6 months"

    # Scheduling
    last_completed = Column(DateTime)
    next_due = Column(DateTime)

    # Notifications
    notify_channels = Column(String(100), default="dashboard,calendar")  # dashboard,email,calendar

    # Status
    is_active = Column(Boolean, default=True)
    notes = Column(Text)

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    logs = relationship("HomeMaintenanceLog", back_populates="maintenance", cascade="all, delete-orphan")

    def calculate_next_due(self):
        """Calculate next due date based on last completed"""
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
        return f"<HomeMaintenance {self.name}>"


class HomeMaintenanceLog(Base):
    """Log of completed home maintenance tasks"""
    __tablename__ = "home_maintenance_logs"

    id = Column(Integer, primary_key=True, index=True)
    maintenance_id = Column(Integer, ForeignKey("home_maintenance.id"), nullable=False)

    performed_at = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text)
    cost = Column(Float, nullable=True)  # Optional cost tracking

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    maintenance = relationship("HomeMaintenance", back_populates="logs")

    def __repr__(self):
        return f"<HomeMaintenanceLog {self.maintenance_id} at {self.performed_at}>"
