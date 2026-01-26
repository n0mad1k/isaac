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
    medical_logs = relationship("MemberMedicalLog", back_populates="member", cascade="all, delete-orphan")
    mentoring_sessions = relationship("MentoringSession", back_populates="member", cascade="all, delete-orphan")
    values_history = relationship("ValuesAssessmentHistory", back_populates="member", cascade="all, delete-orphan")
    observations = relationship("WeeklyObservation", back_populates="member", cascade="all, delete-orphan")


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
