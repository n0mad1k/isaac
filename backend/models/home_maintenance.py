"""
Home Maintenance Models
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


# Default categories (kept for backwards compatibility and as suggestions)
DEFAULT_CATEGORIES = [
    "hvac",
    "plumbing",
    "electrical",
    "exterior",
    "appliances",
    "pool",
    "safety",
    "general",
]


class HomeMaintenance(Base):
    """Home maintenance tasks with recurring schedules"""
    __tablename__ = "home_maintenance"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    category = Column(String(50), default="general")  # Now supports custom categories
    area_or_appliance = Column(String(100))  # e.g., "Pool", "A/C Unit", "Dishwasher", "Garage"
    area_icon = Column(String(50))  # Icon name: "Waves", "Wind", "Flame", etc.
    description = Column(Text)

    # Frequency
    frequency_days = Column(Integer, nullable=False)  # Days between tasks
    frequency_label = Column(String(50))  # Human readable: "Monthly", "Every 6 months"

    # Scheduling
    last_completed = Column(DateTime)
    next_due = Column(DateTime)
    manual_due_date = Column(DateTime, nullable=True)  # User-set override

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
        """Calculate next due date based on last completed or manual override"""
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
