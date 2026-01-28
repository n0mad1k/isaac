"""
Team/Unit/Family Management Models
Inspired by USMC Marine Corps Mentoring Program (NAVMC DIR 1500.58)
"""

from sqlalchemy import Column, Integer, String, Boolean, Float, Text, DateTime, ForeignKey, Enum as SQLEnum, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from .database import Base


class MemberRole(str, enum.Enum):
    LEADER = "LEADER"
    MEMBER = "MEMBER"
    SUPPORT = "SUPPORT"
    TRAINEE = "TRAINEE"


class ReadinessStatus(str, enum.Enum):
    GREEN = "GREEN"
    AMBER = "AMBER"
    RED = "RED"


class VisionStatus(str, enum.Enum):
    CORRECTED = "CORRECTED"
    UNCORRECTED = "UNCORRECTED"
    NA = "N/A"


class GoalsMet(str, enum.Enum):
    YES = "YES"
    PARTIAL = "PARTIAL"
    NO = "NO"


class ObservationType(str, enum.Enum):
    WENT_WELL = "went_well"
    NEEDS_IMPROVEMENT = "needs_improvement"


class ObservationScope(str, enum.Enum):
    INDIVIDUAL = "individual"
    TEAM = "team"
    OPERATIONS = "operations"


# ============================================
# Gear Tracking Enums
# ============================================

class GearCategory(str, enum.Enum):
    FIREARM = "FIREARM"
    BAG = "BAG"
    MEDICAL = "MEDICAL"
    COMMS = "COMMS"
    OPTICS = "OPTICS"
    CLOTHING = "CLOTHING"
    TOOLS = "TOOLS"
    ELECTRONICS = "ELECTRONICS"
    OTHER = "OTHER"


class GearStatus(str, enum.Enum):
    SERVICEABLE = "SERVICEABLE"
    NEEDS_MAINTENANCE = "NEEDS_MAINTENANCE"
    NEEDS_REPAIR = "NEEDS_REPAIR"
    OUT_OF_SERVICE = "OUT_OF_SERVICE"


class ContentStatus(str, enum.Enum):
    GOOD = "GOOD"
    LOW = "LOW"
    EXPIRED = "EXPIRED"
    MISSING = "MISSING"
    NEEDS_REPLACEMENT = "NEEDS_REPLACEMENT"


# ============================================
# Training Tracking Enums
# ============================================

class TrainingCategory(str, enum.Enum):
    SHOOTING = "SHOOTING"
    MEDICAL = "MEDICAL"
    COMMS = "COMMS"
    NAVIGATION = "NAVIGATION"
    FITNESS = "FITNESS"
    DRIVING = "DRIVING"
    OTHER = "OTHER"


# ============================================
# Medical Appointment Enums
# ============================================

class AppointmentType(str, enum.Enum):
    PHYSICAL = "PHYSICAL"
    DENTAL = "DENTAL"
    VISION = "VISION"
    SPECIALIST = "SPECIALIST"
    IMMUNIZATION = "IMMUNIZATION"
    LAB_WORK = "LAB_WORK"
    OBGYN = "OBGYN"
    MAMMOGRAM = "MAMMOGRAM"
    PAP_SMEAR = "PAP_SMEAR"
    PEDIATRIC = "PEDIATRIC"
    WELL_CHILD = "WELL_CHILD"
    CUSTOM = "CUSTOM"


# ============================================
# Vitals Tracking Enums
# ============================================

class VitalType(str, enum.Enum):
    BLOOD_PRESSURE = "blood_pressure"  # Systolic/Diastolic
    HEART_RATE = "heart_rate"  # Active/normal heart rate BPM
    RESTING_HEART_RATE = "resting_heart_rate"  # Resting heart rate BPM (measured at rest, e.g. morning)
    HRV = "hrv"  # Heart Rate Variability (ms)
    TEMPERATURE = "temperature"  # Fahrenheit
    BLOOD_OXYGEN = "blood_oxygen"  # SpO2 percentage
    BODY_FAT = "body_fat"  # Percentage
    RESPIRATORY_RATE = "respiratory_rate"  # Breaths per minute
    WAIST = "waist"  # Circumference in inches
    NECK = "neck"  # Circumference in inches (for taping method)
    HIP = "hip"  # Circumference in inches (for females)


class TeamMember(Base):
    """Operator-style dossier profile for team members"""
    __tablename__ = "team_members"

    id = Column(Integer, primary_key=True, index=True)

    # Identity
    name = Column(String(100), nullable=False)
    nickname = Column(String(50), nullable=True)
    callsign = Column(String(50), nullable=True)
    role = Column(SQLEnum(MemberRole), default=MemberRole.MEMBER)
    role_title = Column(String(100), nullable=True)  # Custom: "Farm Manager", "Medic"
    photo_path = Column(String(255), nullable=True)  # Uploaded file path

    # Contact
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    join_date = Column(DateTime, nullable=True)
    birth_date = Column(DateTime, nullable=True)

    # Physical (configurable units in settings)
    height_inches = Column(Float, nullable=True)
    current_weight = Column(Float, nullable=True)
    target_weight = Column(Float, nullable=True)

    # Sizing (for gear/equipment)
    blood_type = Column(String(10), nullable=True)  # A+, A-, B+, B-, AB+, AB-, O+, O-
    shoe_size = Column(String(20), nullable=True)   # "10.5", "11W"
    shirt_size = Column(String(10), nullable=True)  # XS, S, M, L, XL, XXL
    pants_size = Column(String(20), nullable=True)  # "32x30", "34W"
    hat_size = Column(String(20), nullable=True)    # "7 1/4", "L/XL"
    glove_size = Column(String(10), nullable=True)  # S, M, L, XL

    # Medical
    allergies = Column(JSON, default=list)           # ["Penicillin", "Bee stings"]
    medical_conditions = Column(JSON, default=list)  # ["Asthma", "Color blind"]
    current_medications = Column(JSON, default=list) # [{name, dosage, frequency}]
    emergency_contact_name = Column(String(100), nullable=True)
    emergency_contact_phone = Column(String(50), nullable=True)

    # Medical Readiness (like MEDPROS with date tracking)
    medical_readiness = Column(SQLEnum(ReadinessStatus), default=ReadinessStatus.GREEN)
    medical_readiness_notes = Column(Text, nullable=True)

    # Dental tracking
    dental_status = Column(SQLEnum(ReadinessStatus), default=ReadinessStatus.GREEN)
    last_dental_date = Column(DateTime, nullable=True)
    next_dental_due = Column(DateTime, nullable=True)

    # Vision tracking
    vision_status = Column(SQLEnum(VisionStatus), default=VisionStatus.NA)
    vision_prescription = Column(String(255), nullable=True)
    last_vision_date = Column(DateTime, nullable=True)
    next_vision_due = Column(DateTime, nullable=True)

    # Physical exam tracking
    last_physical_date = Column(DateTime, nullable=True)
    next_physical_due = Column(DateTime, nullable=True)
    physical_limitations = Column(Text, nullable=True)  # Any duty limitations

    # Skills, Responsibilities & Training
    skills = Column(JSON, default=list)             # ["First Aid", "Welding", "Drone Ops"]
    responsibilities = Column(JSON, default=list)   # ["Morning feeding", "Vehicle maint"]
    trainings = Column(JSON, default=list)          # ["Rappelling", "Land Nav", "TCCC", "Comms"]

    # Overall Readiness
    overall_readiness = Column(SQLEnum(ReadinessStatus), default=ReadinessStatus.GREEN)
    readiness_notes = Column(Text, nullable=True)

    # Status
    is_active = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    weight_logs = relationship("MemberWeightLog", back_populates="member", cascade="all, delete-orphan")
    vitals_logs = relationship("MemberVitalsLog", back_populates="member", cascade="all, delete-orphan")
    medical_logs = relationship("MemberMedicalLog", back_populates="member", cascade="all, delete-orphan")
    mentoring_sessions = relationship("MentoringSession", back_populates="member", cascade="all, delete-orphan")
    values_history = relationship("ValuesAssessmentHistory", back_populates="member", cascade="all, delete-orphan")
    observations = relationship("WeeklyObservation", back_populates="member", cascade="all, delete-orphan")
    gear = relationship("MemberGear", back_populates="member", cascade="all, delete-orphan")
    training_items = relationship("MemberTraining", back_populates="member", cascade="all, delete-orphan")
    medical_appointments = relationship("MemberMedicalAppointment", back_populates="member", cascade="all, delete-orphan")
    supply_requests = relationship("SupplyRequest", back_populates="member", cascade="all, delete-orphan")


class MemberWeightLog(Base):
    """Weight/height history for team members"""
    __tablename__ = "member_weight_logs"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("team_members.id", ondelete="CASCADE"), nullable=False)

    weight = Column(Float, nullable=False)
    height_inches = Column(Float, nullable=True)  # Optional - in case height changes
    notes = Column(Text, nullable=True)
    recorded_at = Column(DateTime, default=datetime.utcnow)

    # Relationship
    member = relationship("TeamMember", back_populates="weight_logs")


class MemberVitalsLog(Base):
    """Vitals tracking for team members (blood pressure, heart rate, etc.)"""
    __tablename__ = "member_vitals_logs"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("team_members.id", ondelete="CASCADE"), nullable=False)

    vital_type = Column(SQLEnum(VitalType), nullable=False)

    # Primary value (e.g., systolic BP, heart rate, temperature, etc.)
    value = Column(Float, nullable=False)
    # Secondary value (e.g., diastolic BP) - optional
    value_secondary = Column(Float, nullable=True)
    # Unit for display (e.g., "bpm", "°F", "%", "mg/dL", "in")
    unit = Column(String(20), nullable=True)

    notes = Column(Text, nullable=True)
    recorded_at = Column(DateTime, default=datetime.utcnow)

    # Relationship
    member = relationship("TeamMember", back_populates="vitals_logs")


class MemberMedicalLog(Base):
    """Medical status changes for team members"""
    __tablename__ = "member_medical_logs"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("team_members.id", ondelete="CASCADE"), nullable=False)

    log_type = Column(String(50), nullable=False)  # "readiness_change", "medication", "condition", "exam"
    previous_value = Column(String(255), nullable=True)
    new_value = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    recorded_at = Column(DateTime, default=datetime.utcnow)

    # Relationship
    member = relationship("TeamMember", back_populates="medical_logs")


class MentoringSession(Base):
    """Weekly mentoring session log - MCMP inspired"""
    __tablename__ = "mentoring_sessions"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("team_members.id", ondelete="CASCADE"), nullable=False)

    session_date = Column(DateTime, nullable=False)
    week_number = Column(Integer, nullable=True)  # Week of year

    # Previous session review
    previous_goals_met = Column(SQLEnum(GoalsMet), nullable=True)
    previous_goals_review = Column(Text, nullable=True)

    # Three goal categories (MCMP style)
    professional_goals = Column(JSON, default=list)  # [{goal, status, notes}]
    personal_goals = Column(JSON, default=list)      # [{goal, status, notes}]
    readiness_goals = Column(JSON, default=list)     # [{goal, status, notes}]

    # Values alignment assessment
    # {value_name: {rating: 1-5, notes: "..."}}
    values_assessment = Column(JSON, default=dict)

    # Conversation triggers (from MCMP)
    positive_observations = Column(Text, nullable=True)
    areas_for_improvement = Column(Text, nullable=True)
    conversation_triggers = Column(JSON, default=list)  # Items to discuss next time

    # Session notes
    mentor_notes = Column(Text, nullable=True)   # Leader's private notes
    member_notes = Column(Text, nullable=True)   # Member's input/response
    action_items = Column(JSON, default=list)    # [{item, due, completed}]

    # Archive (keep 4 recent visible)
    is_archived = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    member = relationship("TeamMember", back_populates="mentoring_sessions")


class ValuesAssessmentHistory(Base):
    """Track values alignment over time"""
    __tablename__ = "values_assessment_history"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("team_members.id", ondelete="CASCADE"), nullable=False)

    assessment_date = Column(DateTime, default=datetime.utcnow)
    value_name = Column(String(100), nullable=False)  # "Faith", "Lethality", "Service"
    rating = Column(Integer, nullable=False)  # 1-5
    notes = Column(Text, nullable=True)
    session_id = Column(Integer, ForeignKey("mentoring_sessions.id", ondelete="SET NULL"), nullable=True)

    # Relationship
    member = relationship("TeamMember", back_populates="values_history")


class WeeklyObservation(Base):
    """What went well / what needs improvement observations"""
    __tablename__ = "weekly_observations"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("team_members.id", ondelete="CASCADE"), nullable=False)

    observation_type = Column(SQLEnum(ObservationType), nullable=False)
    scope = Column(SQLEnum(ObservationScope), default=ObservationScope.INDIVIDUAL)
    content = Column(Text, nullable=False)

    # Optional linking
    linked_value = Column(String(100), nullable=True)        # Which value it relates to
    linked_goal_category = Column(String(50), nullable=True) # professional/personal/readiness

    week_start = Column(DateTime, nullable=False)  # Monday of the week

    # AAR tracking
    discussed_in_aar = Column(Boolean, default=False)
    aar_notes = Column(Text, nullable=True)
    action_item = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship
    member = relationship("TeamMember", back_populates="observations")


class WeeklyAAR(Base):
    """After Action Review - weekly team review"""
    __tablename__ = "weekly_aars"

    id = Column(Integer, primary_key=True, index=True)

    week_start = Column(DateTime, unique=True, nullable=False)  # Monday of the week
    week_number = Column(Integer, nullable=True)

    summary_notes = Column(Text, nullable=True)
    action_items = Column(JSON, default=list)  # [{item, assigned_to, due, completed}]

    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ============================================
# Gear Tracking Models
# ============================================

class MemberGear(Base):
    """Equipment/gear tracking - can be assigned to team members or pool (unassigned)"""
    __tablename__ = "member_gear"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True)  # NULL = pool/unassigned

    name = Column(String(100), nullable=False)  # "Glock 19", "72hr Go Bag"
    category = Column(SQLEnum(GearCategory), default=GearCategory.OTHER)
    subcategory = Column(String(50), nullable=True)  # "Pistol", "Rifle", "IFAK"
    serial_number = Column(String(100), nullable=True)
    make = Column(String(100), nullable=True)
    model = Column(String(100), nullable=True)
    caliber = Column(String(50), nullable=True)  # For firearms
    color = Column(String(50), nullable=True)  # For bags, clothing, etc.

    status = Column(SQLEnum(GearStatus), default=GearStatus.SERVICEABLE)
    location = Column(String(100), nullable=True)  # Where stored

    is_container = Column(Boolean, default=False)  # True for go bags (has contents)
    requires_cleaning = Column(Boolean, default=False)  # Needs regular cleaning
    requires_charging = Column(Boolean, default=False)  # Needs regular charging
    has_expirables = Column(Boolean, default=False)  # Has items that expire

    assigned_date = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    member = relationship("TeamMember", back_populates="gear")
    maintenance_schedules = relationship("MemberGearMaintenance", back_populates="gear", cascade="all, delete-orphan")
    contents = relationship("MemberGearContents", back_populates="gear", cascade="all, delete-orphan")
    maintenance_logs = relationship("MemberGearMaintenanceLog", back_populates="gear", cascade="all, delete-orphan")


class MemberGearMaintenance(Base):
    """Recurring maintenance schedules for gear"""
    __tablename__ = "member_gear_maintenance"

    id = Column(Integer, primary_key=True, index=True)
    gear_id = Column(Integer, ForeignKey("member_gear.id", ondelete="CASCADE"), nullable=False)

    name = Column(String(100), nullable=False)  # "Cleaning", "Lubrication", "Battery Check"
    description = Column(Text, nullable=True)

    frequency_days = Column(Integer, nullable=True)  # Days between maintenance
    frequency_rounds = Column(Integer, nullable=True)  # For firearms: clean every X rounds

    last_performed = Column(DateTime, nullable=True)
    last_round_count = Column(Integer, nullable=True)  # Round count at last cleaning
    next_due_date = Column(DateTime, nullable=True)
    manual_due_date = Column(DateTime, nullable=True)  # Override auto-calculated date

    is_active = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    gear = relationship("MemberGear", back_populates="maintenance_schedules")

    @property
    def due_date(self):
        """Get the effective due date (manual overrides calculated)"""
        return self.manual_due_date or self.next_due_date


class MemberGearContents(Base):
    """Go bag / container contents tracking"""
    __tablename__ = "member_gear_contents"

    id = Column(Integer, primary_key=True, index=True)
    gear_id = Column(Integer, ForeignKey("member_gear.id", ondelete="CASCADE"), nullable=False)

    item_name = Column(String(100), nullable=False)  # "TQ CAT Gen 7", "MRE", "AA Batteries"
    category = Column(String(50), nullable=True)  # "Medical", "Food", "Power", "Tools"
    quantity = Column(Integer, default=1)
    min_quantity = Column(Integer, nullable=True)  # Alert when below min

    expiration_date = Column(DateTime, nullable=True)  # Simple: single expiration for all units
    expiration_alert_days = Column(Integer, default=30)  # Days before expiration to alert
    units = Column(JSON, default=list)  # Advanced: [{expiration_date, lot_number, notes}] for individual tracking

    status = Column(SQLEnum(ContentStatus), default=ContentStatus.GOOD)
    last_checked = Column(DateTime, nullable=True)

    # Battery and maintenance tracking
    battery_type = Column(String(50), nullable=True)  # "AA", "AAA", "CR123A", "18650", etc.
    needs_cleaning = Column(Boolean, default=False)
    needs_recharge = Column(Boolean, default=False)

    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    gear = relationship("MemberGear", back_populates="contents")


class MemberGearMaintenanceLog(Base):
    """Audit trail for gear maintenance"""
    __tablename__ = "member_gear_maintenance_logs"

    id = Column(Integer, primary_key=True, index=True)
    gear_id = Column(Integer, ForeignKey("member_gear.id", ondelete="CASCADE"), nullable=False)
    maintenance_id = Column(Integer, ForeignKey("member_gear_maintenance.id", ondelete="SET NULL"), nullable=True)

    action = Column(String(100), nullable=False)  # "Cleaned", "Lubricated", "Inspected"
    performed_at = Column(DateTime, default=datetime.utcnow)
    round_count_at = Column(Integer, nullable=True)  # For firearms
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    gear = relationship("MemberGear", back_populates="maintenance_logs")


# ============================================
# Training Tracking Models
# ============================================

class MemberTraining(Base):
    """Training tracking for skill development"""
    __tablename__ = "member_training"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("team_members.id", ondelete="CASCADE"), nullable=False)

    name = Column(String(100), nullable=False)  # "Shooting - Pistol", "Medical - TCCC"
    category = Column(SQLEnum(TrainingCategory), default=TrainingCategory.OTHER)
    description = Column(Text, nullable=True)  # Details about the training

    last_trained = Column(DateTime, nullable=True)  # Date of last training session
    frequency_days = Column(Integer, nullable=True)  # Optional: days between training
    next_due = Column(DateTime, nullable=True)  # Calculated from last_trained + frequency_days
    total_sessions = Column(Integer, default=0)  # Count of training sessions logged

    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    member = relationship("TeamMember", back_populates="training_items")
    training_logs = relationship("MemberTrainingLog", back_populates="training", cascade="all, delete-orphan")


class MemberTrainingLog(Base):
    """Training session history"""
    __tablename__ = "member_training_logs"

    id = Column(Integer, primary_key=True, index=True)
    training_id = Column(Integer, ForeignKey("member_training.id", ondelete="CASCADE"), nullable=False)

    trained_at = Column(DateTime, default=datetime.utcnow)  # Date/time of session
    duration_minutes = Column(Integer, nullable=True)  # Optional: how long
    notes = Column(Text, nullable=True)  # What was practiced, performance notes

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship
    training = relationship("MemberTraining", back_populates="training_logs")


# ============================================
# Medical Appointment Tracking
# ============================================

class MemberMedicalAppointment(Base):
    """Flexible medical appointment tracking"""
    __tablename__ = "member_medical_appointments"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("team_members.id", ondelete="CASCADE"), nullable=False)

    appointment_type = Column(SQLEnum(AppointmentType), nullable=False)
    custom_type_name = Column(String(100), nullable=True)  # When type is CUSTOM

    provider_name = Column(String(200), nullable=True)
    provider_phone = Column(String(50), nullable=True)
    provider_address = Column(Text, nullable=True)

    last_appointment = Column(DateTime, nullable=True)
    next_due = Column(DateTime, nullable=True)
    frequency_months = Column(Integer, default=12)  # How often (12 for annual, 6 for biannual)

    is_active = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    member = relationship("TeamMember", back_populates="medical_appointments")

    @property
    def display_type(self):
        """Get display name for appointment type"""
        if self.appointment_type == AppointmentType.CUSTOM and self.custom_type_name:
            return self.custom_type_name
        return self.appointment_type.value.replace("_", " ").title()
