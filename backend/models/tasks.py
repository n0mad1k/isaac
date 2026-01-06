"""
Task and Reminder Models
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Enum, Date, JSON
from datetime import datetime
import enum

from .database import Base


class TaskCategory(enum.Enum):
    PLANT_CARE = "plant_care"
    ANIMAL_CARE = "animal_care"
    HOME_MAINTENANCE = "home_maintenance"
    GARDEN = "garden"
    EQUIPMENT = "equipment"
    SEASONAL = "seasonal"
    CUSTOM = "custom"
    OTHER = "other"


class TaskRecurrence(enum.Enum):
    ONCE = "once"
    DAILY = "daily"
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    BIANNUALLY = "biannually"
    ANNUALLY = "annually"
    CUSTOM = "custom"


class TaskType(enum.Enum):
    TODO = "todo"      # Reminder/task - syncs as VTODO to iOS Reminders
    EVENT = "event"    # Calendar event - syncs as VEVENT to iOS Calendar


class Task(Base):
    """Tasks and scheduled reminders"""
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    task_type = Column(Enum(TaskType), default=TaskType.TODO)  # todo or event
    category = Column(Enum(TaskCategory), default=TaskCategory.CUSTOM)

    # Scheduling
    due_date = Column(Date)
    due_time = Column(String(10))  # "09:00" format - also used as start_time
    end_time = Column(String(10))  # "10:00" format
    location = Column(String(200))  # Event location
    recurrence = Column(Enum(TaskRecurrence), default=TaskRecurrence.ONCE)
    recurrence_interval = Column(Integer)  # For custom: every X days

    # For annual tasks - specific month/day
    recurrence_month = Column(Integer)  # 1-12
    recurrence_day = Column(Integer)  # 1-31

    # Seasonal tasks (useful for FL)
    season = Column(String(20))  # spring, summer, fall, winter, dry_season, wet_season

    # Links to other entities
    plant_id = Column(Integer)  # Link to specific plant
    animal_id = Column(Integer)  # Link to specific animal
    vehicle_id = Column(Integer)  # Link to specific vehicle
    equipment_id = Column(Integer)  # Link to specific equipment
    farm_area_id = Column(Integer)  # Link to specific farm area

    # Priority and status
    priority = Column(Integer, default=2)  # 1=high, 2=medium, 3=low
    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime)

    # Weather-dependent
    weather_dependent = Column(Boolean, default=False)
    skip_if_rain = Column(Boolean, default=False)
    skip_if_temp_below = Column(Integer)
    skip_if_temp_above = Column(Integer)

    # Notifications
    notify_email = Column(Boolean, default=True)
    notify_days_before = Column(Integer, default=1)  # Days before due to notify (legacy)
    # Alert intervals in minutes before due: 0=at time, 60=1hr, 1440=1day, etc.
    # Format: JSON array like [0, 60, 1440] or null for global default
    reminder_alerts = Column(JSON, nullable=True)  # e.g., [0, 60, 1440]
    alerts_sent = Column(JSON, nullable=True)  # Track which alerts have been sent: {"0": "2026-01-03T10:00:00"}
    last_notified = Column(DateTime)

    # For tracking completion history on recurring tasks
    last_completed = Column(DateTime)
    completion_count = Column(Integer, default=0)

    is_active = Column(Boolean, default=True)
    notes = Column(Text)

    # Calendar sync
    calendar_uid = Column(String(255), unique=True, nullable=True, index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Task {self.title}>"


# Pre-defined home maintenance tasks for Florida
FLORIDA_MAINTENANCE_TASKS = [
    {
        "title": "Clean gutters",
        "description": "Remove debris from gutters and downspouts",
        "category": TaskCategory.HOME_MAINTENANCE,
        "recurrence": TaskRecurrence.QUARTERLY,
        "recurrence_month": 3,  # March, June, Sept, Dec
        "priority": 2,
    },
    {
        "title": "Clean A/C drain lines",
        "description": "Flush A/C condensate drain lines with vinegar/bleach solution",
        "category": TaskCategory.HOME_MAINTENANCE,
        "recurrence": TaskRecurrence.MONTHLY,
        "priority": 1,  # High priority in FL - prevents water damage
    },
    {
        "title": "Replace A/C filters",
        "description": "Replace HVAC air filters",
        "category": TaskCategory.HOME_MAINTENANCE,
        "recurrence": TaskRecurrence.MONTHLY,
        "priority": 2,
    },
    {
        "title": "Check hurricane supplies",
        "description": "Inventory and refresh hurricane preparedness kit",
        "category": TaskCategory.SEASONAL,
        "recurrence": TaskRecurrence.ANNUALLY,
        "recurrence_month": 5,  # May - before hurricane season
        "priority": 1,
    },
    {
        "title": "Service A/C unit",
        "description": "Annual A/C maintenance and inspection",
        "category": TaskCategory.HOME_MAINTENANCE,
        "recurrence": TaskRecurrence.ANNUALLY,
        "recurrence_month": 3,  # March - before heavy usage
        "priority": 1,
    },
    {
        "title": "Pressure wash exterior",
        "description": "Pressure wash house, driveway, walkways",
        "category": TaskCategory.HOME_MAINTENANCE,
        "recurrence": TaskRecurrence.ANNUALLY,
        "recurrence_month": 4,
        "priority": 3,
    },
    {
        "title": "Check smoke/CO detectors",
        "description": "Test smoke and carbon monoxide detectors, replace batteries",
        "category": TaskCategory.HOME_MAINTENANCE,
        "recurrence": TaskRecurrence.BIANNUALLY,
        "priority": 1,
    },
    {
        "title": "Inspect roof",
        "description": "Check roof for damage, especially after storm season",
        "category": TaskCategory.HOME_MAINTENANCE,
        "recurrence": TaskRecurrence.ANNUALLY,
        "recurrence_month": 12,  # December - after hurricane season
        "priority": 2,
    },
]
