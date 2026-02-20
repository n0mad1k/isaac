"""
Vehicle Models - Cars, Trucks, Tractors, Motorcycles, ATVs
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


class VehicleType(enum.Enum):
    CAR = "car"
    TRUCK = "truck"
    TRACTOR = "tractor"
    MOTORCYCLE = "motorcycle"
    ATV = "atv"
    UTV = "utv"


class Vehicle(Base):
    """Vehicles requiring maintenance tracking"""
    __tablename__ = "vehicles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)  # e.g., "2020 Ford F-150"
    type = Column(Enum(VehicleType), nullable=False)

    # Details
    make = Column(String(100))
    model = Column(String(100))
    year = Column(Integer)
    vin = Column(String(50))  # VIN or serial number
    license_plate = Column(String(20))
    color = Column(String(50))

    # Acquisition
    purchase_date = Column(Date)
    purchase_price = Column(Float, nullable=True)

    # Current stats
    current_mileage = Column(Integer, default=0)
    current_hours = Column(Integer, default=0)  # For tractors

    # Status
    is_active = Column(Boolean, default=True)
    notes = Column(Text)
    image_url = Column(String(500))

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    maintenance_tasks = relationship("VehicleMaintenance", back_populates="vehicle", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Vehicle {self.name}>"


class VehicleMaintenance(Base):
    """Recurring maintenance tasks for vehicles"""
    __tablename__ = "vehicle_maintenance"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=False)
    name = Column(String(200), nullable=False)  # e.g., "Oil Change"
    description = Column(Text)

    # Frequency - can be miles, hours, or days based
    frequency_miles = Column(Integer, nullable=True)  # e.g., 5000 miles
    frequency_hours = Column(Integer, nullable=True)  # e.g., 100 hours (tractors)
    frequency_days = Column(Integer, nullable=True)   # Fallback: e.g., 180 days

    # Last completed
    last_completed = Column(DateTime)
    last_mileage = Column(Integer, nullable=True)
    last_hours = Column(Integer, nullable=True)

    # Next due (calculated or manual)
    next_due_date = Column(DateTime)
    next_due_mileage = Column(Integer, nullable=True)
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
    vehicle = relationship("Vehicle", back_populates="maintenance_tasks")
    logs = relationship("VehicleMaintenanceLog", back_populates="maintenance", cascade="all, delete-orphan")

    def calculate_next_due(self, current_mileage=None, current_hours=None):
        """Calculate next due based on frequency type or manual date"""
        # If there's a recurring frequency, calculate from last completed
        if self.last_completed:
            if self.frequency_days:
                self.next_due_date = self.last_completed + timedelta(days=self.frequency_days)
                self.manual_due_date = None  # Clear manual date after recurring calc
            else:
                # No day-based frequency - clear date tracking
                # Task is now purely mileage/hours based or needs manual due date
                self.next_due_date = None
                self.manual_due_date = None

        if self.frequency_miles and self.last_mileage is not None:
            self.next_due_mileage = self.last_mileage + self.frequency_miles

        if self.frequency_hours and self.last_hours is not None:
            self.next_due_hours = self.last_hours + self.frequency_hours

    def set_manual_due_date(self, due_date):
        """Set a manual due date override"""
        self.manual_due_date = due_date
        self.next_due_date = due_date

    @property
    def status(self):
        """Return status: ok, due_soon, overdue"""
        # Check date-based
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
        return f"<VehicleMaintenance {self.name} for {self.vehicle_id}>"


class VehicleMaintenanceLog(Base):
    """Log of completed vehicle maintenance"""
    __tablename__ = "vehicle_maintenance_logs"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=False)
    maintenance_id = Column(Integer, ForeignKey("vehicle_maintenance.id"), nullable=True)

    name = Column(String(200))  # Copy of task name for history
    performed_at = Column(DateTime, default=datetime.utcnow)
    mileage_at = Column(Integer, nullable=True)
    hours_at = Column(Integer, nullable=True)

    cost = Column(Float, nullable=True)
    notes = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    maintenance = relationship("VehicleMaintenance", back_populates="logs")

    def __repr__(self):
        return f"<VehicleMaintenanceLog {self.name} at {self.performed_at}>"
