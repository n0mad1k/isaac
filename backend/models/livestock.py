"""
Livestock and Animal Models
Supports two categories: Pets and Livestock
- Pets: Recurring care tracking (worming, shots, hoof trims, dental, etc.)
- Livestock: Slaughter date tracking, expense/cost tracking
"""

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, Enum, Date
from sqlalchemy.orm import relationship
from datetime import datetime, date, timedelta
import enum

from .database import Base


class AnimalCategory(enum.Enum):
    PET = "pet"
    LIVESTOCK = "livestock"


class AnimalType(enum.Enum):
    # Common livestock
    CATTLE = "cattle"
    GOAT = "goat"
    SHEEP = "sheep"
    PIG = "pig"
    CHICKEN = "chicken"
    DUCK = "duck"
    TURKEY = "turkey"
    RABBIT = "rabbit"
    # Common pets
    HORSE = "horse"
    MINI_HORSE = "mini_horse"
    DOG = "dog"
    CAT = "cat"
    DONKEY = "donkey"
    LLAMA = "llama"
    ALPACA = "alpaca"
    OTHER = "other"


class Animal(Base):
    __tablename__ = "animals"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    animal_type = Column(Enum(AnimalType), nullable=False)
    category = Column(Enum(AnimalCategory), nullable=False)  # pet or livestock
    breed = Column(String(100))

    # Identification
    tag_number = Column(String(50))
    microchip = Column(String(50))
    registration_number = Column(String(100))

    # Physical
    color = Column(String(50))
    markings = Column(Text)
    sex = Column(String(20))  # male, female, gelding, steer, etc.
    birth_date = Column(Date)  # For age calculation
    acquisition_date = Column(Date)
    current_weight = Column(Float)  # Current weight in lbs

    # Feeding info
    feed_type = Column(String(200))  # e.g., "Hay", "Grain", "Pellets", etc.
    feed_amount = Column(String(100))  # e.g., "2 cups", "5 lbs"
    feed_frequency = Column(String(100))  # e.g., "twice daily", "once daily"

    # Location
    pasture = Column(String(100))  # Primary location (now using as location field)
    sub_location = Column(String(200))  # Sub-location detail (e.g., "3rd paddock", "Stall 5")
    farm_area_id = Column(Integer, ForeignKey("farm_areas.id"), nullable=True)

    # === LIVESTOCK SPECIFIC ===
    # Slaughter planning (for livestock category)
    target_weight = Column(Float)  # Target slaughter weight in lbs
    slaughter_date = Column(Date)  # Planned slaughter date
    slaughter_time = Column(String(10))  # Planned slaughter time "HH:MM"
    processor = Column(String(200))  # Slaughter/processor name
    processor_address = Column(String(500))  # Processor address/location
    pickup_date = Column(Date)  # Date to pickup from butcher
    pickup_time = Column(String(10))  # Pickup time "HH:MM"

    # === PET SPECIFIC - Recurring Care Schedules ===
    # Each care type has: last_date, frequency_days, and computed next_date

    # Worming
    last_wormed = Column(DateTime)
    worming_frequency_days = Column(Integer)  # e.g., 60 for every 2 months
    wormer_rotation = Column(String(200))  # Track which wormer to use next

    # Vaccinations/Shots
    last_vaccinated = Column(DateTime)
    vaccination_frequency_days = Column(Integer)  # e.g., 365 for annual

    # Hoof care (horses, goats, etc.)
    last_hoof_trim = Column(DateTime)
    hoof_trim_frequency_days = Column(Integer)  # e.g., 42 for 6 weeks

    # Dental
    last_dental = Column(DateTime)
    dental_frequency_days = Column(Integer)  # e.g., 365 for annual

    # Custom care schedules stored as JSON-like string
    # Format: "care_name:last_date:frequency_days,..."
    custom_care_schedules = Column(Text)

    # Vet info
    last_vet_visit = Column(Date)
    vet_notes = Column(Text)

    # Cold tolerance (for blanketing/shelter alerts)
    min_temp = Column(Float)  # Minimum comfortable temperature in F
    needs_blanket_below = Column(Float)  # Temperature below which they need a blanket
    cold_sensitive = Column(Boolean, default=False)

    # Status
    is_active = Column(Boolean, default=True)
    status = Column(String(50), default="healthy")  # healthy, injured, sick, sold, deceased, slaughtered
    tags = Column(String(500))  # Comma-separated tags: sick, pregnant, for_sale, quarantine, etc.
    notes = Column(Text)
    special_instructions = Column(Text)  # Feeding instructions shown in feed widget

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    care_logs = relationship("AnimalCareLog", back_populates="animal", cascade="all, delete-orphan")
    expenses = relationship("AnimalExpense", back_populates="animal", cascade="all, delete-orphan")
    care_schedules = relationship("AnimalCareSchedule", back_populates="animal", cascade="all, delete-orphan")
    feeds = relationship("AnimalFeed", back_populates="animal", cascade="all, delete-orphan")
    farm_area = relationship("FarmArea", back_populates="animals")

    @property
    def age_months(self):
        """Calculate animal age in months"""
        if not self.birth_date:
            return None
        today = date.today()
        months = (today.year - self.birth_date.year) * 12 + (today.month - self.birth_date.month)
        return max(0, months)

    @property
    def age_display(self):
        """Human readable age"""
        months = self.age_months
        if months is None:
            return None
        if months < 12:
            return f"{months} months"
        years = months // 12
        remaining_months = months % 12
        if remaining_months == 0:
            return f"{years} years"
        return f"{years} years, {remaining_months} months"

    @property
    def days_until_slaughter(self):
        """Calculate days until slaughter (livestock only)"""
        if self.category != AnimalCategory.LIVESTOCK or not self.slaughter_date:
            return None
        delta = self.slaughter_date - date.today()
        return delta.days

    @property
    def total_expenses(self):
        """Sum of all expenses for this animal"""
        return sum(e.amount for e in self.expenses if e.amount)

    # Care schedule computed properties
    def _get_next_care_date(self, last_date, frequency_days):
        """Helper to calculate next care date"""
        if not last_date or not frequency_days:
            return None
        if isinstance(last_date, datetime):
            return last_date + timedelta(days=frequency_days)
        return datetime.combine(last_date, datetime.min.time()) + timedelta(days=frequency_days)

    def _is_overdue(self, last_date, frequency_days):
        """Check if care is overdue"""
        next_date = self._get_next_care_date(last_date, frequency_days)
        if not next_date:
            return False
        return datetime.utcnow() > next_date

    @property
    def next_worming(self):
        return self._get_next_care_date(self.last_wormed, self.worming_frequency_days)

    @property
    def worming_overdue(self):
        return self._is_overdue(self.last_wormed, self.worming_frequency_days)

    @property
    def next_vaccination(self):
        return self._get_next_care_date(self.last_vaccinated, self.vaccination_frequency_days)

    @property
    def vaccination_overdue(self):
        return self._is_overdue(self.last_vaccinated, self.vaccination_frequency_days)

    @property
    def next_hoof_trim(self):
        return self._get_next_care_date(self.last_hoof_trim, self.hoof_trim_frequency_days)

    @property
    def hoof_trim_overdue(self):
        return self._is_overdue(self.last_hoof_trim, self.hoof_trim_frequency_days)

    @property
    def next_dental(self):
        return self._get_next_care_date(self.last_dental, self.dental_frequency_days)

    @property
    def dental_overdue(self):
        return self._is_overdue(self.last_dental, self.dental_frequency_days)

    def __repr__(self):
        return f"<Animal {self.name} ({self.animal_type.value}, {self.category.value})>"


class AnimalCareLog(Base):
    """Log of care activities performed on animals"""
    __tablename__ = "animal_care_logs"

    id = Column(Integer, primary_key=True, index=True)
    animal_id = Column(Integer, ForeignKey("animals.id"), nullable=False)

    care_type = Column(String(50), nullable=False)
    # Types: wormed, vaccinated, hoof_trim, dental, vet_visit, weighed, medicated, groomed, custom

    details = Column(Text)  # What was done
    product_used = Column(String(200))  # Wormer name, vaccine, etc.
    dosage = Column(String(100))

    performed_by = Column(String(100))  # Farrier name, vet name, self
    performed_at = Column(DateTime, default=datetime.utcnow)

    # For weight tracking
    weight = Column(Float)

    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    animal = relationship("Animal", back_populates="care_logs")

    def __repr__(self):
        return f"<AnimalCareLog {self.care_type} for {self.animal_id}>"


class AnimalExpense(Base):
    """Track expenses for animals (purchase, feed, medicine, vet, etc.)"""
    __tablename__ = "animal_expenses"

    id = Column(Integer, primary_key=True, index=True)
    animal_id = Column(Integer, ForeignKey("animals.id"), nullable=False)

    expense_type = Column(String(50), nullable=False)
    # Types: purchase, feed, medicine, vet, equipment, farrier, other

    description = Column(String(500))
    amount = Column(Float, nullable=False)  # Cost in dollars (this animal's portion)

    expense_date = Column(Date, default=date.today)
    vendor = Column(String(200))  # Where purchased

    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Split expense fields
    expense_group_id = Column(String(36), nullable=True, index=True)  # UUID linking split expenses
    total_amount = Column(Float, nullable=True)  # Original total before split (for reference)

    # Relationships
    animal = relationship("Animal", back_populates="expenses")

    def __repr__(self):
        return f"<AnimalExpense ${self.amount} {self.expense_type} for {self.animal_id}>"


class AnimalFeed(Base):
    """Multiple feed entries per animal - e.g., grain once daily + hay constant access"""
    __tablename__ = "animal_feeds"

    id = Column(Integer, primary_key=True, index=True)
    animal_id = Column(Integer, ForeignKey("animals.id"), nullable=False)

    feed_type = Column(String(100), nullable=False)  # e.g., "Grain", "Hay", "Pellets"
    amount = Column(String(100))  # e.g., "1 scoop", "2 flakes"
    frequency = Column(String(100))  # e.g., "Once daily", "Constant access"
    notes = Column(Text)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    animal = relationship("Animal", back_populates="feeds")

    def __repr__(self):
        return f"<AnimalFeed {self.feed_type} for animal {self.animal_id}>"


class AnimalCareSchedule(Base):
    """Flexible care schedule items for animals"""
    __tablename__ = "animal_care_schedules"

    id = Column(Integer, primary_key=True, index=True)
    animal_id = Column(Integer, ForeignKey("animals.id"), nullable=False)

    # Care item details
    name = Column(String(100), nullable=False)  # e.g., "Hoof Trim", "Worming", "Vaccinations"

    # Frequency in days (optional - if not set, must use manual due date)
    frequency_days = Column(Integer)  # e.g., 42 for 6 weeks, 60 for 2 months

    # Last performed date (optional)
    last_performed = Column(Date)

    # Manual due date (optional - overrides calculated due date)
    manual_due_date = Column(Date)

    # Preferred time for this care task (e.g., "08:00" for morning feeding)
    due_time = Column(String(10))  # "HH:MM" format

    # Original due date - set when task first becomes due if last_performed is None
    # This prevents the due date from resetting to "today" every sync
    original_due_date = Column(Date)

    # Notes about this care item
    notes = Column(Text)

    # Is this care item active?
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    animal = relationship("Animal", back_populates="care_schedules")

    @property
    def due_date(self):
        """Calculate due date based on manual date, frequency, or original date"""
        # If manual due date is set, use it
        if self.manual_due_date:
            return self.manual_due_date

        # If frequency and last performed are set, calculate next due date
        if self.frequency_days and self.last_performed:
            return self.last_performed + timedelta(days=self.frequency_days)

        # If only frequency is set (never performed), use original_due_date if set
        # This prevents the due date from resetting to "today" every sync
        if self.frequency_days and not self.last_performed:
            if self.original_due_date:
                return self.original_due_date
            # Fallback to today only if no original date stored
            return date.today()

        # No frequency set and no manual date - no due date
        return None

    @property
    def is_overdue(self):
        """Check if this care item is overdue"""
        due = self.due_date
        if due is None:
            return False
        return date.today() > due

    @property
    def days_until_due(self):
        """Days until due (negative if overdue)"""
        due = self.due_date
        if due is None:
            return None
        return (due - date.today()).days

    def __repr__(self):
        return f"<AnimalCareSchedule {self.name} for animal {self.animal_id}>"
