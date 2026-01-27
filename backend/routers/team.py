"""
Team/Unit/Family Management API Routes
Inspired by USMC Marine Corps Mentoring Program (NAVMC DIR 1500.58)
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc
from sqlalchemy.orm.attributes import flag_modified
from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime, date, timedelta
import json
import os
import uuid
import shutil

from models.database import get_db
from models.settings import AppSetting
from models.team import (
    TeamMember, MemberWeightLog, MemberMedicalLog, MentoringSession,
    ValuesAssessmentHistory, WeeklyObservation, WeeklyAAR,
    MemberRole, ReadinessStatus, VisionStatus, GoalsMet,
    ObservationType, ObservationScope,
    # Gear tracking
    MemberGear, MemberGearMaintenance, MemberGearContents, MemberGearMaintenanceLog,
    GearCategory, GearStatus, ContentStatus,
    # Training tracking
    MemberTraining, MemberTrainingLog, TrainingCategory,
    # Medical appointments
    MemberMedicalAppointment, AppointmentType
)
from routers.auth import require_auth, require_admin
from routers.settings import get_setting, set_setting
from models.users import User


router = APIRouter(prefix="/team", tags=["Team"])


# ============================================
# Pydantic Schemas
# ============================================

class TeamMemberCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    nickname: Optional[str] = None
    callsign: Optional[str] = None
    role: MemberRole = MemberRole.MEMBER
    role_title: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    join_date: Optional[datetime] = None
    birth_date: Optional[datetime] = None
    height_inches: Optional[float] = None
    current_weight: Optional[float] = None
    target_weight: Optional[float] = None
    blood_type: Optional[str] = None
    shoe_size: Optional[str] = None
    shirt_size: Optional[str] = None
    pants_size: Optional[str] = None
    hat_size: Optional[str] = None
    glove_size: Optional[str] = None
    allergies: Optional[List[str]] = []
    medical_conditions: Optional[List[str]] = []
    current_medications: Optional[List[dict]] = []
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    medical_readiness: ReadinessStatus = ReadinessStatus.GREEN
    medical_readiness_notes: Optional[str] = None
    dental_status: ReadinessStatus = ReadinessStatus.GREEN
    last_dental_date: Optional[datetime] = None
    next_dental_due: Optional[datetime] = None
    vision_status: VisionStatus = VisionStatus.NA
    vision_prescription: Optional[str] = None
    last_vision_date: Optional[datetime] = None
    next_vision_due: Optional[datetime] = None
    last_physical_date: Optional[datetime] = None
    next_physical_due: Optional[datetime] = None
    physical_limitations: Optional[str] = None
    skills: Optional[List[str]] = []
    responsibilities: Optional[List[str]] = []
    trainings: Optional[List[str]] = []
    overall_readiness: ReadinessStatus = ReadinessStatus.GREEN
    readiness_notes: Optional[str] = None
    is_active: bool = True
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class TeamMemberUpdate(BaseModel):
    name: Optional[str] = None
    nickname: Optional[str] = None
    callsign: Optional[str] = None
    role: Optional[MemberRole] = None
    role_title: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    join_date: Optional[datetime] = None
    birth_date: Optional[datetime] = None
    height_inches: Optional[float] = None
    current_weight: Optional[float] = None
    target_weight: Optional[float] = None
    blood_type: Optional[str] = None
    shoe_size: Optional[str] = None
    shirt_size: Optional[str] = None
    pants_size: Optional[str] = None
    hat_size: Optional[str] = None
    glove_size: Optional[str] = None
    allergies: Optional[List[str]] = None
    medical_conditions: Optional[List[str]] = None
    current_medications: Optional[List[dict]] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    medical_readiness: Optional[ReadinessStatus] = None
    medical_readiness_notes: Optional[str] = None
    dental_status: Optional[ReadinessStatus] = None
    last_dental_date: Optional[datetime] = None
    next_dental_due: Optional[datetime] = None
    vision_status: Optional[VisionStatus] = None
    vision_prescription: Optional[str] = None
    last_vision_date: Optional[datetime] = None
    next_vision_due: Optional[datetime] = None
    last_physical_date: Optional[datetime] = None
    next_physical_due: Optional[datetime] = None
    physical_limitations: Optional[str] = None
    skills: Optional[List[str]] = None
    responsibilities: Optional[List[str]] = None
    trainings: Optional[List[str]] = None
    overall_readiness: Optional[ReadinessStatus] = None
    readiness_notes: Optional[str] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class WeightLogCreate(BaseModel):
    weight: float
    height_inches: Optional[float] = None
    notes: Optional[str] = None


class MedicalLogCreate(BaseModel):
    log_type: str
    previous_value: Optional[str] = None
    new_value: Optional[str] = None
    notes: Optional[str] = None


class MedicalStatusUpdate(BaseModel):
    medical_readiness: Optional[ReadinessStatus] = None
    medical_readiness_notes: Optional[str] = None
    dental_status: Optional[ReadinessStatus] = None
    last_dental_date: Optional[datetime] = None
    next_dental_due: Optional[datetime] = None
    vision_status: Optional[VisionStatus] = None
    vision_prescription: Optional[str] = None
    last_vision_date: Optional[datetime] = None
    next_vision_due: Optional[datetime] = None
    last_physical_date: Optional[datetime] = None
    next_physical_due: Optional[datetime] = None
    physical_limitations: Optional[str] = None


class MentoringSessionCreate(BaseModel):
    session_date: datetime
    week_number: Optional[int] = None
    previous_goals_met: Optional[GoalsMet] = None
    previous_goals_review: Optional[str] = None
    professional_goals: Optional[List[dict]] = []
    personal_goals: Optional[List[dict]] = []
    readiness_goals: Optional[List[dict]] = []
    values_assessment: Optional[dict] = {}
    positive_observations: Optional[str] = None
    areas_for_improvement: Optional[str] = None
    conversation_triggers: Optional[List[str]] = []
    mentor_notes: Optional[str] = None
    member_notes: Optional[str] = None
    action_items: Optional[List[dict]] = []


class MentoringSessionUpdate(BaseModel):
    session_date: Optional[datetime] = None
    week_number: Optional[int] = None
    previous_goals_met: Optional[GoalsMet] = None
    previous_goals_review: Optional[str] = None
    professional_goals: Optional[List[dict]] = None
    personal_goals: Optional[List[dict]] = None
    readiness_goals: Optional[List[dict]] = None
    values_assessment: Optional[dict] = None
    positive_observations: Optional[str] = None
    areas_for_improvement: Optional[str] = None
    conversation_triggers: Optional[List[str]] = None
    mentor_notes: Optional[str] = None
    member_notes: Optional[str] = None
    action_items: Optional[List[dict]] = None
    is_archived: Optional[bool] = None


class ObservationCreate(BaseModel):
    observation_type: ObservationType
    scope: ObservationScope = ObservationScope.INDIVIDUAL
    content: str = Field(..., min_length=1)
    linked_value: Optional[str] = None
    linked_goal_category: Optional[str] = None
    week_start: Optional[datetime] = None  # If not provided, calculated from current date


class AARCreate(BaseModel):
    week_start: datetime
    week_number: Optional[int] = None
    summary_notes: Optional[str] = None
    action_items: Optional[List[dict]] = []


class AARUpdate(BaseModel):
    summary_notes: Optional[str] = None
    action_items: Optional[List[dict]] = None
    is_completed: Optional[bool] = None


class TeamSettingsUpdate(BaseModel):
    team_enabled: Optional[bool] = None
    team_name: Optional[str] = None
    team_mission: Optional[str] = None
    team_units: Optional[str] = None  # "imperial" or "metric"
    mentoring_day: Optional[str] = None
    aar_day: Optional[str] = None
    team_values: Optional[List[dict]] = None


# ============================================
# Gear Schemas
# ============================================

class GearCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    category: GearCategory = GearCategory.OTHER
    subcategory: Optional[str] = None
    serial_number: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    caliber: Optional[str] = None
    color: Optional[str] = None
    status: GearStatus = GearStatus.SERVICEABLE
    location: Optional[str] = None
    is_container: bool = False
    requires_cleaning: bool = False
    requires_charging: bool = False
    has_expirables: bool = False
    assigned_date: Optional[datetime] = None
    notes: Optional[str] = None


class GearUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[GearCategory] = None
    subcategory: Optional[str] = None
    serial_number: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    caliber: Optional[str] = None
    color: Optional[str] = None
    status: Optional[GearStatus] = None
    location: Optional[str] = None
    is_container: Optional[bool] = None
    requires_cleaning: Optional[bool] = None
    requires_charging: Optional[bool] = None
    has_expirables: Optional[bool] = None
    assigned_date: Optional[datetime] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class GearMaintenanceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    frequency_days: Optional[int] = None
    frequency_rounds: Optional[int] = None
    next_due_date: Optional[datetime] = None
    notes: Optional[str] = None


class GearMaintenanceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    frequency_days: Optional[int] = None
    frequency_rounds: Optional[int] = None
    next_due_date: Optional[datetime] = None
    manual_due_date: Optional[datetime] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class GearContentsCreate(BaseModel):
    item_name: str = Field(..., min_length=1, max_length=100)
    category: Optional[str] = None
    quantity: int = 1
    min_quantity: Optional[int] = None
    expiration_date: Optional[datetime] = None  # Simple: single expiration for all
    expiration_alert_days: int = 30
    units: Optional[List[dict]] = []  # Advanced: [{expiration_date, lot_number, notes}]
    status: ContentStatus = ContentStatus.GOOD
    notes: Optional[str] = None


class GearContentsUpdate(BaseModel):
    item_name: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[int] = None
    min_quantity: Optional[int] = None
    expiration_date: Optional[datetime] = None
    expiration_alert_days: Optional[int] = None
    units: Optional[List[dict]] = None  # [{expiration_date, lot_number, notes}]
    status: Optional[ContentStatus] = None
    last_checked: Optional[datetime] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class GearMaintenanceComplete(BaseModel):
    action: str = "Completed"
    round_count_at: Optional[int] = None
    notes: Optional[str] = None


# ============================================
# Training Schemas
# ============================================

class TrainingCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    category: TrainingCategory = TrainingCategory.OTHER
    description: Optional[str] = None
    frequency_days: Optional[int] = None
    notes: Optional[str] = None


class TrainingUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[TrainingCategory] = None
    description: Optional[str] = None
    frequency_days: Optional[int] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class TrainingLogCreate(BaseModel):
    trained_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    notes: Optional[str] = None


# ============================================
# Medical Appointment Schemas
# ============================================

class MedicalAppointmentCreate(BaseModel):
    appointment_type: AppointmentType
    custom_type_name: Optional[str] = None
    provider_name: Optional[str] = None
    provider_phone: Optional[str] = None
    provider_address: Optional[str] = None
    last_appointment: Optional[datetime] = None
    next_due: Optional[datetime] = None
    frequency_months: int = 12
    notes: Optional[str] = None


class MedicalAppointmentUpdate(BaseModel):
    appointment_type: Optional[AppointmentType] = None
    custom_type_name: Optional[str] = None
    provider_name: Optional[str] = None
    provider_phone: Optional[str] = None
    provider_address: Optional[str] = None
    last_appointment: Optional[datetime] = None
    next_due: Optional[datetime] = None
    frequency_months: Optional[int] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class MedicalAppointmentComplete(BaseModel):
    appointment_date: Optional[datetime] = None
    notes: Optional[str] = None


# ============================================
# Helper Functions
# ============================================

def get_monday_of_week(dt: datetime) -> datetime:
    """Get the Monday of the week for a given datetime"""
    days_since_monday = dt.weekday()
    monday = dt - timedelta(days=days_since_monday)
    return monday.replace(hour=0, minute=0, second=0, microsecond=0)


def serialize_member(member: TeamMember) -> dict:
    """Serialize a team member to dict"""
    return {
        "id": member.id,
        "name": member.name,
        "nickname": member.nickname,
        "callsign": member.callsign,
        "role": member.role.value if member.role else None,
        "role_title": member.role_title,
        "photo_path": member.photo_path,
        "email": member.email,
        "phone": member.phone,
        "join_date": member.join_date.isoformat() if member.join_date else None,
        "birth_date": member.birth_date.isoformat() if member.birth_date else None,
        "height_inches": member.height_inches,
        "current_weight": member.current_weight,
        "target_weight": member.target_weight,
        "blood_type": member.blood_type,
        "shoe_size": member.shoe_size,
        "shirt_size": member.shirt_size,
        "pants_size": member.pants_size,
        "hat_size": member.hat_size,
        "glove_size": member.glove_size,
        "allergies": member.allergies or [],
        "medical_conditions": member.medical_conditions or [],
        "current_medications": member.current_medications or [],
        "emergency_contact_name": member.emergency_contact_name,
        "emergency_contact_phone": member.emergency_contact_phone,
        "medical_readiness": member.medical_readiness.value if member.medical_readiness else None,
        "medical_readiness_notes": member.medical_readiness_notes,
        "dental_status": member.dental_status.value if member.dental_status else None,
        "last_dental_date": member.last_dental_date.isoformat() if member.last_dental_date else None,
        "next_dental_due": member.next_dental_due.isoformat() if member.next_dental_due else None,
        "vision_status": member.vision_status.value if member.vision_status else None,
        "vision_prescription": member.vision_prescription,
        "last_vision_date": member.last_vision_date.isoformat() if member.last_vision_date else None,
        "next_vision_due": member.next_vision_due.isoformat() if member.next_vision_due else None,
        "last_physical_date": member.last_physical_date.isoformat() if member.last_physical_date else None,
        "next_physical_due": member.next_physical_due.isoformat() if member.next_physical_due else None,
        "physical_limitations": member.physical_limitations,
        "skills": member.skills or [],
        "responsibilities": member.responsibilities or [],
        "trainings": member.trainings or [],
        "overall_readiness": member.overall_readiness.value if member.overall_readiness else None,
        "readiness_notes": member.readiness_notes,
        "is_active": member.is_active,
        "notes": member.notes,
        "created_at": member.created_at.isoformat() if member.created_at else None,
        "updated_at": member.updated_at.isoformat() if member.updated_at else None,
    }


# ============================================
# Settings Endpoints
# ============================================

DEFAULT_TEAM_VALUES = [
    {
        "name": "Faith",
        "description": "Trust in God, anchor of purpose and moral compass",
        "questions": [
            "How did you prioritize time with God this week?",
            "Did you lead by example in faith?",
            "How did your faith guide decisions?"
        ]
    },
    {
        "name": "Lethality",
        "description": "Excellence in execution, peak physical and mental readiness",
        "questions": [
            "Did you maintain training discipline?",
            "How did you push your limits?",
            "Are you ready to perform under pressure?"
        ]
    },
    {
        "name": "Service",
        "description": "Family first, mission focused, selfless contribution",
        "questions": [
            "How did you serve your family this week?",
            "Did you put others before yourself?",
            "What did you sacrifice for the mission?"
        ]
    }
]


@router.get("/settings/")
async def get_team_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get team management settings"""
    team_enabled = await get_setting(db, "team_enabled")
    team_name = await get_setting(db, "team_name")
    team_mission = await get_setting(db, "team_mission")
    team_units = await get_setting(db, "team_units")
    mentoring_day = await get_setting(db, "mentoring_day")
    aar_day = await get_setting(db, "aar_day")
    team_values_str = await get_setting(db, "team_values")
    team_logo = await get_setting(db, "team_logo")

    # Parse team values
    team_values = DEFAULT_TEAM_VALUES
    if team_values_str:
        try:
            team_values = json.loads(team_values_str)
        except json.JSONDecodeError:
            pass

    return {
        "team_enabled": team_enabled == "true",
        "team_name": team_name or "My Team",
        "team_mission": team_mission or "",
        "team_units": team_units or "imperial",
        "mentoring_day": mentoring_day or "Sunday",
        "aar_day": aar_day or "Saturday",
        "team_values": team_values,
        "team_logo": team_logo,
    }


@router.put("/settings/")
async def update_team_settings(
    data: TeamSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Update team management settings (admin only)"""
    if data.team_enabled is not None:
        await set_setting(db, "team_enabled", "true" if data.team_enabled else "false")
    if data.team_name is not None:
        await set_setting(db, "team_name", data.team_name)
    if data.team_mission is not None:
        await set_setting(db, "team_mission", data.team_mission)
    if data.team_units is not None:
        await set_setting(db, "team_units", data.team_units)
    if data.mentoring_day is not None:
        await set_setting(db, "mentoring_day", data.mentoring_day)
    if data.aar_day is not None:
        await set_setting(db, "aar_day", data.aar_day)
    if data.team_values is not None:
        await set_setting(db, "team_values", json.dumps(data.team_values))

    return await get_team_settings(db, current_user)


# ============================================
# Overview Dashboard
# ============================================

@router.get("/overview/")
async def get_team_overview(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get team overview stats and readiness summary"""
    # Get all active members
    result = await db.execute(
        select(TeamMember).where(TeamMember.is_active == True)
    )
    members = result.scalars().all()

    # Count readiness statuses
    readiness_counts = {"GREEN": 0, "AMBER": 0, "RED": 0}
    medical_counts = {"GREEN": 0, "AMBER": 0, "RED": 0}
    dental_counts = {"GREEN": 0, "AMBER": 0, "RED": 0}

    upcoming_appointments = []
    now = datetime.utcnow()

    for member in members:
        if member.overall_readiness:
            readiness_counts[member.overall_readiness.value] += 1
        if member.medical_readiness:
            medical_counts[member.medical_readiness.value] += 1
        if member.dental_status:
            dental_counts[member.dental_status.value] += 1

        # Check for upcoming due dates
        for field, label in [
            ("next_dental_due", "Dental"),
            ("next_vision_due", "Vision"),
            ("next_physical_due", "Physical")
        ]:
            due_date = getattr(member, field)
            if due_date:
                days_until = (due_date - now).days
                if 0 <= days_until <= 30:
                    upcoming_appointments.append({
                        "member_id": member.id,
                        "member_name": member.name,
                        "type": label,
                        "due_date": due_date.isoformat(),
                        "days_until": days_until
                    })

    # Sort upcoming by days until
    upcoming_appointments.sort(key=lambda x: x["days_until"])

    # Get team settings
    settings = await get_team_settings(db, current_user)

    return {
        "total_members": len(members),
        "active_members": len([m for m in members if m.is_active]),
        "readiness_summary": readiness_counts,
        "medical_summary": medical_counts,
        "dental_summary": dental_counts,
        "upcoming_appointments": upcoming_appointments[:10],
        "team_name": settings["team_name"],
        "team_mission": settings["team_mission"],
        "team_values": settings["team_values"],
    }


@router.get("/skill-matrix/")
async def get_skill_matrix(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get skills across all team members"""
    result = await db.execute(
        select(TeamMember).where(TeamMember.is_active == True)
    )
    members = result.scalars().all()

    # Build skill matrix
    all_skills = set()
    skill_coverage = {}

    for member in members:
        if member.skills:
            for skill in member.skills:
                all_skills.add(skill)
                if skill not in skill_coverage:
                    skill_coverage[skill] = []
                skill_coverage[skill].append({
                    "member_id": member.id,
                    "member_name": member.name
                })

    # Format for response
    matrix = []
    for skill in sorted(all_skills):
        matrix.append({
            "skill": skill,
            "members": skill_coverage[skill],
            "count": len(skill_coverage[skill])
        })

    return {
        "skills": matrix,
        "total_skills": len(all_skills),
        "members_with_skills": len([m for m in members if m.skills])
    }


# ============================================
# Members CRUD
# ============================================

@router.get("/members/")
async def get_members(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get all team members"""
    query = select(TeamMember)
    if active_only:
        query = query.where(TeamMember.is_active == True)
    query = query.order_by(TeamMember.name)

    result = await db.execute(query)
    members = result.scalars().all()

    return [serialize_member(m) for m in members]


@router.post("/members/")
async def create_member(
    data: TeamMemberCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Create a new team member"""
    member = TeamMember(**data.model_dump())
    db.add(member)
    await db.commit()
    await db.refresh(member)

    return serialize_member(member)


@router.get("/members/{member_id}/")
async def get_member(
    member_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get a specific team member"""
    result = await db.execute(
        select(TeamMember).where(TeamMember.id == member_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    return serialize_member(member)


@router.patch("/members/{member_id}/")
async def update_member(
    member_id: int,
    data: TeamMemberUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Update a team member"""
    result = await db.execute(
        select(TeamMember).where(TeamMember.id == member_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # JSON fields that need explicit flag_modified
    json_fields = ['allergies', 'medical_conditions', 'current_medications', 'skills', 'responsibilities', 'trainings']

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(member, key, value)
        # Flag JSON fields as modified so SQLAlchemy detects the change
        if key in json_fields:
            flag_modified(member, key)

    member.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(member)

    return serialize_member(member)


@router.delete("/members/{member_id}/")
async def delete_member(
    member_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Delete a team member"""
    result = await db.execute(
        select(TeamMember).where(TeamMember.id == member_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Delete photo file if exists
    if member.photo_path and os.path.exists(member.photo_path):
        try:
            os.remove(member.photo_path)
        except OSError:
            pass

    await db.delete(member)
    await db.commit()

    return {"message": "Member deleted"}


# ============================================
# Photo Upload
# ============================================

UPLOAD_DIR = "data/team_photos"


@router.get("/photos/{filename}")
async def get_member_photo(filename: str):
    """Serve a member photo file"""
    filepath = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Photo not found")

    # Security: ensure the file is within the upload directory
    abs_upload_dir = os.path.abspath(UPLOAD_DIR)
    abs_filepath = os.path.abspath(filepath)
    if not abs_filepath.startswith(abs_upload_dir):
        raise HTTPException(status_code=403, detail="Access denied")

    return FileResponse(filepath)


@router.post("/members/{member_id}/photo/")
async def upload_member_photo(
    member_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Upload a photo for a team member"""
    result = await db.execute(
        select(TeamMember).where(TeamMember.id == member_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: JPEG, PNG, GIF, WebP")

    # Create upload directory if not exists
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    # Generate unique filename
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"{member_id}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    # Delete old photo if exists
    if member.photo_path and os.path.exists(member.photo_path):
        try:
            os.remove(member.photo_path)
        except OSError:
            pass

    # Save new photo
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Update member record
    member.photo_path = filepath
    member.updated_at = datetime.utcnow()
    await db.commit()

    return {"photo_path": filepath}


@router.delete("/members/{member_id}/photo/")
async def delete_member_photo(
    member_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Delete a member's photo"""
    result = await db.execute(
        select(TeamMember).where(TeamMember.id == member_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    if member.photo_path and os.path.exists(member.photo_path):
        try:
            os.remove(member.photo_path)
        except OSError:
            pass

    member.photo_path = None
    member.updated_at = datetime.utcnow()
    await db.commit()

    return {"message": "Photo deleted"}


# ============================================
# Team Logo
# ============================================

LOGO_DIR = "data/team_logo"


@router.get("/logo/{filename}")
async def get_team_logo(filename: str):
    """Serve the team logo file"""
    filepath = os.path.join(LOGO_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Logo not found")

    # Security: ensure the file is within the logo directory
    abs_logo_dir = os.path.abspath(LOGO_DIR)
    abs_filepath = os.path.abspath(filepath)
    if not abs_filepath.startswith(abs_logo_dir):
        raise HTTPException(status_code=403, detail="Access denied")

    return FileResponse(filepath)


@router.post("/logo/")
async def upload_team_logo(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Upload a team logo"""
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: JPEG, PNG, GIF, WebP, SVG")

    # Create upload directory if not exists
    os.makedirs(LOGO_DIR, exist_ok=True)

    # Delete any existing logo files
    for existing_file in os.listdir(LOGO_DIR) if os.path.exists(LOGO_DIR) else []:
        try:
            os.remove(os.path.join(LOGO_DIR, existing_file))
        except OSError:
            pass

    # Generate filename
    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    filename = f"team_logo_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = os.path.join(LOGO_DIR, filename)

    # Save logo
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Update team_logo setting
    result = await db.execute(
        select(AppSetting).where(AppSetting.key == "team_logo")
    )
    setting = result.scalar_one_or_none()
    if setting:
        setting.value = filepath
    else:
        db.add(AppSetting(key="team_logo", value=filepath, description="Team logo image path"))
    await db.commit()

    return {"logo_path": filepath}


# ============================================
# Weight Tracking
# ============================================

@router.get("/members/{member_id}/weight-history/")
async def get_weight_history(
    member_id: int,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get weight history for a member"""
    result = await db.execute(
        select(MemberWeightLog)
        .where(MemberWeightLog.member_id == member_id)
        .order_by(desc(MemberWeightLog.recorded_at))
        .limit(limit)
    )
    logs = result.scalars().all()

    return [
        {
            "id": log.id,
            "weight": log.weight,
            "height_inches": log.height_inches,
            "notes": log.notes,
            "recorded_at": log.recorded_at.isoformat() if log.recorded_at else None
        }
        for log in logs
    ]


@router.post("/members/{member_id}/weight/")
async def log_weight(
    member_id: int,
    data: WeightLogCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Log a weight entry for a member"""
    result = await db.execute(
        select(TeamMember).where(TeamMember.id == member_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Create weight log
    log = MemberWeightLog(
        member_id=member_id,
        weight=data.weight,
        height_inches=data.height_inches,
        notes=data.notes
    )
    db.add(log)

    # Update current weight on member
    member.current_weight = data.weight
    if data.height_inches:
        member.height_inches = data.height_inches
    member.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(log)

    return {
        "id": log.id,
        "weight": log.weight,
        "height_inches": log.height_inches,
        "notes": log.notes,
        "recorded_at": log.recorded_at.isoformat() if log.recorded_at else None
    }


# ============================================
# Medical Tracking
# ============================================

@router.get("/members/{member_id}/medical-history/")
async def get_medical_history(
    member_id: int,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get medical history for a member"""
    result = await db.execute(
        select(MemberMedicalLog)
        .where(MemberMedicalLog.member_id == member_id)
        .order_by(desc(MemberMedicalLog.recorded_at))
        .limit(limit)
    )
    logs = result.scalars().all()

    return [
        {
            "id": log.id,
            "log_type": log.log_type,
            "previous_value": log.previous_value,
            "new_value": log.new_value,
            "notes": log.notes,
            "recorded_at": log.recorded_at.isoformat() if log.recorded_at else None
        }
        for log in logs
    ]


@router.post("/members/{member_id}/medical/")
async def log_medical_change(
    member_id: int,
    data: MedicalLogCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Log a medical status change for a member"""
    result = await db.execute(
        select(TeamMember).where(TeamMember.id == member_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    log = MemberMedicalLog(
        member_id=member_id,
        log_type=data.log_type,
        previous_value=data.previous_value,
        new_value=data.new_value,
        notes=data.notes
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)

    return {
        "id": log.id,
        "log_type": log.log_type,
        "previous_value": log.previous_value,
        "new_value": log.new_value,
        "notes": log.notes,
        "recorded_at": log.recorded_at.isoformat() if log.recorded_at else None
    }


@router.put("/members/{member_id}/medical-status/")
async def update_medical_status(
    member_id: int,
    data: MedicalStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Update medical readiness status for a member"""
    result = await db.execute(
        select(TeamMember).where(TeamMember.id == member_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    update_data = data.model_dump(exclude_unset=True)

    # Log changes
    for key, value in update_data.items():
        old_value = getattr(member, key)
        if old_value != value:
            # Create log entry for status changes
            if key in ["medical_readiness", "dental_status", "vision_status"]:
                log = MemberMedicalLog(
                    member_id=member_id,
                    log_type="readiness_change",
                    previous_value=str(old_value.value if hasattr(old_value, 'value') else old_value),
                    new_value=str(value.value if hasattr(value, 'value') else value),
                    notes=f"{key} updated"
                )
                db.add(log)

    # Update member
    for key, value in update_data.items():
        setattr(member, key, value)

    member.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(member)

    return serialize_member(member)


# ============================================
# Mentoring Sessions
# ============================================

@router.get("/members/{member_id}/sessions/")
async def get_mentoring_sessions(
    member_id: int,
    include_archived: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get mentoring sessions for a member"""
    query = select(MentoringSession).where(MentoringSession.member_id == member_id)
    if not include_archived:
        query = query.where(MentoringSession.is_archived == False)
    query = query.order_by(desc(MentoringSession.session_date))

    result = await db.execute(query)
    sessions = result.scalars().all()

    return [
        {
            "id": s.id,
            "session_date": s.session_date.isoformat() if s.session_date else None,
            "week_number": s.week_number,
            "previous_goals_met": s.previous_goals_met.value if s.previous_goals_met else None,
            "previous_goals_review": s.previous_goals_review,
            "professional_goals": s.professional_goals or [],
            "personal_goals": s.personal_goals or [],
            "readiness_goals": s.readiness_goals or [],
            "values_assessment": s.values_assessment or {},
            "positive_observations": s.positive_observations,
            "areas_for_improvement": s.areas_for_improvement,
            "conversation_triggers": s.conversation_triggers or [],
            "mentor_notes": s.mentor_notes,
            "member_notes": s.member_notes,
            "action_items": s.action_items or [],
            "is_archived": s.is_archived,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "updated_at": s.updated_at.isoformat() if s.updated_at else None,
        }
        for s in sessions
    ]


@router.post("/members/{member_id}/sessions/")
async def create_mentoring_session(
    member_id: int,
    data: MentoringSessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Create a new mentoring session"""
    # Verify member exists
    result = await db.execute(
        select(TeamMember).where(TeamMember.id == member_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    session = MentoringSession(
        member_id=member_id,
        **data.model_dump()
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    # Auto-archive old sessions (keep only 4 most recent non-archived)
    result = await db.execute(
        select(MentoringSession)
        .where(MentoringSession.member_id == member_id)
        .where(MentoringSession.is_archived == False)
        .order_by(desc(MentoringSession.session_date))
    )
    recent_sessions = result.scalars().all()

    for i, s in enumerate(recent_sessions):
        if i >= 4:
            s.is_archived = True

    await db.commit()

    # Store values assessment in history
    if data.values_assessment:
        for value_name, assessment in data.values_assessment.items():
            history_entry = ValuesAssessmentHistory(
                member_id=member_id,
                assessment_date=session.session_date,
                value_name=value_name,
                rating=assessment.get("rating", 3),
                notes=assessment.get("notes"),
                session_id=session.id
            )
            db.add(history_entry)
        await db.commit()

    return {
        "id": session.id,
        "session_date": session.session_date.isoformat() if session.session_date else None,
        "week_number": session.week_number,
        "created_at": session.created_at.isoformat() if session.created_at else None,
    }


@router.get("/members/{member_id}/sessions/{session_id}/")
async def get_mentoring_session(
    member_id: int,
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get a specific mentoring session"""
    result = await db.execute(
        select(MentoringSession)
        .where(MentoringSession.id == session_id)
        .where(MentoringSession.member_id == member_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "id": session.id,
        "member_id": session.member_id,
        "session_date": session.session_date.isoformat() if session.session_date else None,
        "week_number": session.week_number,
        "previous_goals_met": session.previous_goals_met.value if session.previous_goals_met else None,
        "previous_goals_review": session.previous_goals_review,
        "professional_goals": session.professional_goals or [],
        "personal_goals": session.personal_goals or [],
        "readiness_goals": session.readiness_goals or [],
        "values_assessment": session.values_assessment or {},
        "positive_observations": session.positive_observations,
        "areas_for_improvement": session.areas_for_improvement,
        "conversation_triggers": session.conversation_triggers or [],
        "mentor_notes": session.mentor_notes,
        "member_notes": session.member_notes,
        "action_items": session.action_items or [],
        "is_archived": session.is_archived,
        "created_at": session.created_at.isoformat() if session.created_at else None,
        "updated_at": session.updated_at.isoformat() if session.updated_at else None,
    }


@router.patch("/members/{member_id}/sessions/{session_id}/")
async def update_mentoring_session(
    member_id: int,
    session_id: int,
    data: MentoringSessionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Update a mentoring session"""
    result = await db.execute(
        select(MentoringSession)
        .where(MentoringSession.id == session_id)
        .where(MentoringSession.member_id == member_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(session, key, value)

    session.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(session)

    return {"message": "Session updated", "id": session.id}


@router.get("/members/{member_id}/sessions/current-week/")
async def get_current_week_session(
    member_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get or check for current week's session"""
    now = datetime.utcnow()
    week_start = get_monday_of_week(now)
    week_end = week_start + timedelta(days=7)

    result = await db.execute(
        select(MentoringSession)
        .where(MentoringSession.member_id == member_id)
        .where(MentoringSession.session_date >= week_start)
        .where(MentoringSession.session_date < week_end)
    )
    session = result.scalar_one_or_none()

    if session:
        return {
            "exists": True,
            "id": session.id,
            "session_date": session.session_date.isoformat() if session.session_date else None,
        }
    return {"exists": False, "week_start": week_start.isoformat()}


# ============================================
# Values Assessment History
# ============================================

@router.get("/members/{member_id}/values-history/")
async def get_values_history(
    member_id: int,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get values assessment history for a member"""
    result = await db.execute(
        select(ValuesAssessmentHistory)
        .where(ValuesAssessmentHistory.member_id == member_id)
        .order_by(desc(ValuesAssessmentHistory.assessment_date))
        .limit(limit)
    )
    history = result.scalars().all()

    return [
        {
            "id": h.id,
            "value_name": h.value_name,
            "rating": h.rating,
            "notes": h.notes,
            "assessment_date": h.assessment_date.isoformat() if h.assessment_date else None,
            "session_id": h.session_id,
        }
        for h in history
    ]


@router.get("/values-summary/")
async def get_values_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get team-wide values alignment trends"""
    # Get all active members
    result = await db.execute(
        select(TeamMember).where(TeamMember.is_active == True)
    )
    members = result.scalars().all()
    member_ids = [m.id for m in members]

    if not member_ids:
        return {"values": [], "members": []}

    # Get recent values assessments (last 30 days)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)

    result = await db.execute(
        select(ValuesAssessmentHistory)
        .where(ValuesAssessmentHistory.member_id.in_(member_ids))
        .where(ValuesAssessmentHistory.assessment_date >= thirty_days_ago)
        .order_by(ValuesAssessmentHistory.assessment_date)
    )
    history = result.scalars().all()

    # Aggregate by value
    value_stats = {}
    for h in history:
        if h.value_name not in value_stats:
            value_stats[h.value_name] = {"ratings": [], "latest": {}}

        value_stats[h.value_name]["ratings"].append(h.rating)
        value_stats[h.value_name]["latest"][h.member_id] = h.rating

    # Calculate averages
    values_summary = []
    for value_name, stats in value_stats.items():
        avg_rating = sum(stats["ratings"]) / len(stats["ratings"]) if stats["ratings"] else 0
        values_summary.append({
            "name": value_name,
            "average_rating": round(avg_rating, 2),
            "total_assessments": len(stats["ratings"]),
            "members_assessed": len(stats["latest"])
        })

    return {
        "values": values_summary,
        "total_members": len(members),
        "period_days": 30
    }


# ============================================
# Weekly Observations
# ============================================

@router.get("/members/{member_id}/observations/")
async def get_member_observations(
    member_id: int,
    weeks: int = 4,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get observations for a specific member"""
    cutoff = datetime.utcnow() - timedelta(weeks=weeks)

    result = await db.execute(
        select(WeeklyObservation)
        .where(WeeklyObservation.member_id == member_id)
        .where(WeeklyObservation.created_at >= cutoff)
        .order_by(desc(WeeklyObservation.created_at))
    )
    observations = result.scalars().all()

    return [
        {
            "id": o.id,
            "observation_type": o.observation_type.value,
            "scope": o.scope.value,
            "content": o.content,
            "linked_value": o.linked_value,
            "linked_goal_category": o.linked_goal_category,
            "week_start": o.week_start.isoformat() if o.week_start else None,
            "discussed_in_aar": o.discussed_in_aar,
            "aar_notes": o.aar_notes,
            "action_item": o.action_item,
            "created_at": o.created_at.isoformat() if o.created_at else None,
        }
        for o in observations
    ]


@router.post("/members/{member_id}/observations/")
async def create_observation(
    member_id: int,
    data: ObservationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Create a new observation"""
    # Verify member exists
    result = await db.execute(
        select(TeamMember).where(TeamMember.id == member_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Calculate week start if not provided
    week_start = data.week_start
    if not week_start:
        week_start = get_monday_of_week(datetime.utcnow())

    observation = WeeklyObservation(
        member_id=member_id,
        observation_type=data.observation_type,
        scope=data.scope,
        content=data.content,
        linked_value=data.linked_value,
        linked_goal_category=data.linked_goal_category,
        week_start=week_start
    )
    db.add(observation)
    await db.commit()
    await db.refresh(observation)

    return {
        "id": observation.id,
        "observation_type": observation.observation_type.value,
        "created_at": observation.created_at.isoformat() if observation.created_at else None,
    }


@router.get("/observations/week/{date}/")
async def get_week_observations(
    date: str,  # YYYY-MM-DD format
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get all observations for a specific week (for AAR)"""
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    week_start = get_monday_of_week(target_date)
    week_end = week_start + timedelta(days=7)

    result = await db.execute(
        select(WeeklyObservation)
        .where(WeeklyObservation.week_start >= week_start)
        .where(WeeklyObservation.week_start < week_end)
        .order_by(WeeklyObservation.scope, WeeklyObservation.observation_type)
    )
    observations = result.scalars().all()

    # Get member names
    member_ids = set(o.member_id for o in observations)
    members_dict = {}
    if member_ids:
        result = await db.execute(
            select(TeamMember).where(TeamMember.id.in_(member_ids))
        )
        members = result.scalars().all()
        members_dict = {m.id: m.name for m in members}

    return [
        {
            "id": o.id,
            "member_id": o.member_id,
            "member_name": members_dict.get(o.member_id, "Unknown"),
            "observation_type": o.observation_type.value,
            "scope": o.scope.value,
            "content": o.content,
            "linked_value": o.linked_value,
            "linked_goal_category": o.linked_goal_category,
            "discussed_in_aar": o.discussed_in_aar,
            "aar_notes": o.aar_notes,
            "action_item": o.action_item,
            "created_at": o.created_at.isoformat() if o.created_at else None,
        }
        for o in observations
    ]


# ============================================
# Weekly AAR
# ============================================

@router.get("/aar/")
async def get_aars(
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get recent AARs"""
    result = await db.execute(
        select(WeeklyAAR)
        .order_by(desc(WeeklyAAR.week_start))
        .limit(limit)
    )
    aars = result.scalars().all()

    return [
        {
            "id": a.id,
            "week_start": a.week_start.isoformat() if a.week_start else None,
            "week_number": a.week_number,
            "summary_notes": a.summary_notes,
            "action_items": a.action_items or [],
            "is_completed": a.is_completed,
            "completed_at": a.completed_at.isoformat() if a.completed_at else None,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in aars
    ]


@router.get("/aar/current/")
async def get_current_aar(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get or create current week's AAR"""
    now = datetime.utcnow()
    week_start = get_monday_of_week(now)

    result = await db.execute(
        select(WeeklyAAR).where(WeeklyAAR.week_start == week_start)
    )
    aar = result.scalar_one_or_none()

    # Get observations for this week
    week_end = week_start + timedelta(days=7)
    obs_result = await db.execute(
        select(WeeklyObservation)
        .where(WeeklyObservation.week_start >= week_start)
        .where(WeeklyObservation.week_start < week_end)
    )
    observations = obs_result.scalars().all()

    # Group observations
    went_well = [o for o in observations if o.observation_type == ObservationType.WENT_WELL]
    needs_improvement = [o for o in observations if o.observation_type == ObservationType.NEEDS_IMPROVEMENT]

    if aar:
        return {
            "exists": True,
            "id": aar.id,
            "week_start": aar.week_start.isoformat() if aar.week_start else None,
            "week_number": aar.week_number,
            "summary_notes": aar.summary_notes,
            "action_items": aar.action_items or [],
            "is_completed": aar.is_completed,
            "observations_count": {
                "went_well": len(went_well),
                "needs_improvement": len(needs_improvement)
            }
        }

    return {
        "exists": False,
        "week_start": week_start.isoformat(),
        "observations_count": {
            "went_well": len(went_well),
            "needs_improvement": len(needs_improvement)
        }
    }


@router.post("/aar/")
async def create_aar(
    data: AARCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Create a new AAR"""
    # Check if AAR exists for this week
    week_start = get_monday_of_week(data.week_start)

    result = await db.execute(
        select(WeeklyAAR).where(WeeklyAAR.week_start == week_start)
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="AAR already exists for this week")

    aar = WeeklyAAR(
        week_start=week_start,
        week_number=data.week_number or week_start.isocalendar()[1],
        summary_notes=data.summary_notes,
        action_items=data.action_items or []
    )
    db.add(aar)
    await db.commit()
    await db.refresh(aar)

    return {
        "id": aar.id,
        "week_start": aar.week_start.isoformat() if aar.week_start else None,
        "created_at": aar.created_at.isoformat() if aar.created_at else None,
    }


@router.patch("/aar/{aar_id}/")
async def update_aar(
    aar_id: int,
    data: AARUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Update an AAR"""
    result = await db.execute(
        select(WeeklyAAR).where(WeeklyAAR.id == aar_id)
    )
    aar = result.scalar_one_or_none()
    if not aar:
        raise HTTPException(status_code=404, detail="AAR not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(aar, key, value)

    if data.is_completed and not aar.completed_at:
        aar.completed_at = datetime.utcnow()

    aar.updated_at = datetime.utcnow()
    await db.commit()

    return {"message": "AAR updated", "id": aar.id}


# ============================================
# Readiness
# ============================================

@router.get("/readiness/")
async def get_team_readiness(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get readiness status for all active members"""
    result = await db.execute(
        select(TeamMember)
        .where(TeamMember.is_active == True)
        .order_by(TeamMember.name)
    )
    members = result.scalars().all()

    return [
        {
            "id": m.id,
            "name": m.name,
            "role": m.role.value if m.role else None,
            "role_title": m.role_title,
            "overall_readiness": m.overall_readiness.value if m.overall_readiness else None,
            "medical_readiness": m.medical_readiness.value if m.medical_readiness else None,
            "dental_status": m.dental_status.value if m.dental_status else None,
            "vision_status": m.vision_status.value if m.vision_status else None,
            "readiness_notes": m.readiness_notes,
        }
        for m in members
    ]


@router.put("/members/{member_id}/readiness/")
async def update_member_readiness(
    member_id: int,
    overall_readiness: ReadinessStatus,
    readiness_notes: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Update overall readiness for a member"""
    result = await db.execute(
        select(TeamMember).where(TeamMember.id == member_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    old_readiness = member.overall_readiness
    member.overall_readiness = overall_readiness
    if readiness_notes is not None:
        member.readiness_notes = readiness_notes
    member.updated_at = datetime.utcnow()

    # Log change
    if old_readiness != overall_readiness:
        log = MemberMedicalLog(
            member_id=member_id,
            log_type="readiness_change",
            previous_value=old_readiness.value if old_readiness else "None",
            new_value=overall_readiness.value,
            notes=readiness_notes or "Overall readiness updated"
        )
        db.add(log)

    await db.commit()

    return {"message": "Readiness updated", "overall_readiness": overall_readiness.value}


# ============================================
# Gear CRUD Endpoints
# ============================================

def serialize_gear(gear: MemberGear) -> dict:
    """Serialize a gear item to dict"""
    return {
        "id": gear.id,
        "member_id": gear.member_id,
        "name": gear.name,
        "category": gear.category.value if gear.category else None,
        "subcategory": gear.subcategory,
        "serial_number": gear.serial_number,
        "make": gear.make,
        "model": gear.model,
        "caliber": gear.caliber,
        "color": gear.color,
        "status": gear.status.value if gear.status else None,
        "location": gear.location,
        "is_container": gear.is_container,
        "requires_cleaning": gear.requires_cleaning,
        "requires_charging": gear.requires_charging,
        "has_expirables": gear.has_expirables,
        "assigned_date": gear.assigned_date.isoformat() if gear.assigned_date else None,
        "notes": gear.notes,
        "is_active": gear.is_active,
        "created_at": gear.created_at.isoformat() if gear.created_at else None,
        "updated_at": gear.updated_at.isoformat() if gear.updated_at else None,
    }


def serialize_gear_maintenance(maint: MemberGearMaintenance) -> dict:
    """Serialize a gear maintenance schedule to dict"""
    return {
        "id": maint.id,
        "gear_id": maint.gear_id,
        "name": maint.name,
        "description": maint.description,
        "frequency_days": maint.frequency_days,
        "frequency_rounds": maint.frequency_rounds,
        "last_performed": maint.last_performed.isoformat() if maint.last_performed else None,
        "last_round_count": maint.last_round_count,
        "next_due_date": maint.next_due_date.isoformat() if maint.next_due_date else None,
        "manual_due_date": maint.manual_due_date.isoformat() if maint.manual_due_date else None,
        "due_date": maint.due_date.isoformat() if maint.due_date else None,
        "is_active": maint.is_active,
        "notes": maint.notes,
        "created_at": maint.created_at.isoformat() if maint.created_at else None,
    }


def serialize_gear_contents(content: MemberGearContents) -> dict:
    """Serialize a gear contents item to dict"""
    return {
        "id": content.id,
        "gear_id": content.gear_id,
        "item_name": content.item_name,
        "category": content.category,
        "quantity": content.quantity,
        "min_quantity": content.min_quantity,
        "expiration_date": content.expiration_date.isoformat() if content.expiration_date else None,
        "expiration_alert_days": content.expiration_alert_days,
        "units": content.units or [],  # [{expiration_date, lot_number, notes}]
        "status": content.status.value if content.status else None,
        "last_checked": content.last_checked.isoformat() if content.last_checked else None,
        "notes": content.notes,
        "is_active": content.is_active,
        "created_at": content.created_at.isoformat() if content.created_at else None,
    }


# ============================================
# Team-Wide Gear Endpoints (Pool/Inventory)
# ============================================

class GearAssign(BaseModel):
    member_id: Optional[int] = None  # None = unassign to pool


@router.get("/gear/")
async def get_all_team_gear(
    include_inactive: bool = False,
    category: Optional[GearCategory] = None,
    status: Optional[GearStatus] = None,
    assigned_only: bool = False,
    unassigned_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get all team gear with member info - assigned and unassigned (pool)"""
    query = select(MemberGear)

    if not include_inactive:
        query = query.where(MemberGear.is_active == True)
    if category:
        query = query.where(MemberGear.category == category)
    if status:
        query = query.where(MemberGear.status == status)
    if assigned_only:
        query = query.where(MemberGear.member_id != None)
    if unassigned_only:
        query = query.where(MemberGear.member_id == None)

    query = query.order_by(MemberGear.category, MemberGear.name)

    result = await db.execute(query)
    gear_items = result.scalars().all()

    # Get member info for assigned gear
    member_ids = [g.member_id for g in gear_items if g.member_id]
    members_map = {}
    if member_ids:
        members_result = await db.execute(
            select(TeamMember).where(TeamMember.id.in_(member_ids))
        )
        for m in members_result.scalars().all():
            members_map[m.id] = {"id": m.id, "name": m.name, "nickname": m.nickname}

    result_list = []
    for g in gear_items:
        gear_data = serialize_gear(g)
        gear_data["member"] = members_map.get(g.member_id) if g.member_id else None
        result_list.append(gear_data)

    return result_list


@router.post("/gear/")
async def create_pool_gear(
    data: GearCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Create unassigned (pool) gear"""
    gear = MemberGear(member_id=None, **data.model_dump())
    db.add(gear)
    await db.commit()
    await db.refresh(gear)

    return serialize_gear(gear)


@router.patch("/gear/{gear_id}/assign")
async def assign_gear(
    gear_id: int,
    data: GearAssign,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Assign gear to a member or unassign to pool"""
    result = await db.execute(
        select(MemberGear).where(MemberGear.id == gear_id)
    )
    gear = result.scalar_one_or_none()
    if not gear:
        raise HTTPException(status_code=404, detail="Gear not found")

    # If assigning to a member, verify member exists
    if data.member_id is not None:
        member_result = await db.execute(
            select(TeamMember).where(TeamMember.id == data.member_id)
        )
        member = member_result.scalar_one_or_none()
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")

    old_member_id = gear.member_id
    gear.member_id = data.member_id
    gear.assigned_date = datetime.utcnow() if data.member_id else None

    await db.commit()
    await db.refresh(gear)

    gear_data = serialize_gear(gear)

    # Add member info if assigned
    if gear.member_id:
        member_result = await db.execute(
            select(TeamMember).where(TeamMember.id == gear.member_id)
        )
        member = member_result.scalar_one_or_none()
        if member:
            gear_data["member"] = {"id": member.id, "name": member.name, "nickname": member.nickname}
    else:
        gear_data["member"] = None

    return gear_data


@router.get("/gear/{gear_id}/")
async def get_team_gear_item(
    gear_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get a specific gear item by ID (regardless of assignment)"""
    result = await db.execute(
        select(MemberGear).where(MemberGear.id == gear_id)
    )
    gear = result.scalar_one_or_none()
    if not gear:
        raise HTTPException(status_code=404, detail="Gear not found")

    gear_data = serialize_gear(gear)

    # Add member info if assigned
    if gear.member_id:
        member_result = await db.execute(
            select(TeamMember).where(TeamMember.id == gear.member_id)
        )
        member = member_result.scalar_one_or_none()
        if member:
            gear_data["member"] = {"id": member.id, "name": member.name, "nickname": member.nickname}
    else:
        gear_data["member"] = None

    return gear_data


@router.patch("/gear/{gear_id}/")
async def update_team_gear(
    gear_id: int,
    data: GearUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Update a gear item (regardless of assignment)"""
    result = await db.execute(
        select(MemberGear).where(MemberGear.id == gear_id)
    )
    gear = result.scalar_one_or_none()
    if not gear:
        raise HTTPException(status_code=404, detail="Gear not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(gear, key, value)

    await db.commit()
    await db.refresh(gear)

    return serialize_gear(gear)


@router.delete("/gear/{gear_id}/")
async def delete_team_gear(
    gear_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Delete a gear item (regardless of assignment)"""
    result = await db.execute(
        select(MemberGear).where(MemberGear.id == gear_id)
    )
    gear = result.scalar_one_or_none()
    if not gear:
        raise HTTPException(status_code=404, detail="Gear not found")

    await db.delete(gear)
    await db.commit()

    return {"message": "Gear deleted"}


# ============================================
# Member-Specific Gear Endpoints
# ============================================

@router.get("/members/{member_id}/gear/")
async def get_member_gear(
    member_id: int,
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get all gear for a member"""
    # Verify member exists
    result = await db.execute(
        select(TeamMember).where(TeamMember.id == member_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    query = select(MemberGear).where(MemberGear.member_id == member_id)
    if not include_inactive:
        query = query.where(MemberGear.is_active == True)
    query = query.order_by(MemberGear.name)

    result = await db.execute(query)
    gear_items = result.scalars().all()

    return [serialize_gear(g) for g in gear_items]


@router.post("/members/{member_id}/gear/")
async def create_member_gear(
    member_id: int,
    data: GearCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Create a new gear item for a member"""
    # Verify member exists
    result = await db.execute(
        select(TeamMember).where(TeamMember.id == member_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    gear = MemberGear(member_id=member_id, **data.model_dump())
    db.add(gear)
    await db.commit()
    await db.refresh(gear)

    return serialize_gear(gear)


@router.get("/members/{member_id}/gear/{gear_id}/")
async def get_gear_item(
    member_id: int,
    gear_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get a specific gear item"""
    result = await db.execute(
        select(MemberGear)
        .where(MemberGear.id == gear_id)
        .where(MemberGear.member_id == member_id)
    )
    gear = result.scalar_one_or_none()
    if not gear:
        raise HTTPException(status_code=404, detail="Gear not found")

    return serialize_gear(gear)


@router.patch("/members/{member_id}/gear/{gear_id}/")
async def update_gear_item(
    member_id: int,
    gear_id: int,
    data: GearUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Update a gear item"""
    result = await db.execute(
        select(MemberGear)
        .where(MemberGear.id == gear_id)
        .where(MemberGear.member_id == member_id)
    )
    gear = result.scalar_one_or_none()
    if not gear:
        raise HTTPException(status_code=404, detail="Gear not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(gear, key, value)

    gear.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(gear)

    return serialize_gear(gear)


@router.delete("/members/{member_id}/gear/{gear_id}/")
async def delete_gear_item(
    member_id: int,
    gear_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Delete a gear item"""
    result = await db.execute(
        select(MemberGear)
        .where(MemberGear.id == gear_id)
        .where(MemberGear.member_id == member_id)
    )
    gear = result.scalar_one_or_none()
    if not gear:
        raise HTTPException(status_code=404, detail="Gear not found")

    await db.delete(gear)
    await db.commit()

    return {"message": "Gear deleted"}


# ============================================
# Gear Maintenance Endpoints
# ============================================

@router.get("/members/{member_id}/gear/{gear_id}/maintenance/")
async def get_gear_maintenance(
    member_id: int,
    gear_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get maintenance schedules for a gear item"""
    # Verify gear exists and belongs to member
    result = await db.execute(
        select(MemberGear)
        .where(MemberGear.id == gear_id)
        .where(MemberGear.member_id == member_id)
    )
    gear = result.scalar_one_or_none()
    if not gear:
        raise HTTPException(status_code=404, detail="Gear not found")

    result = await db.execute(
        select(MemberGearMaintenance)
        .where(MemberGearMaintenance.gear_id == gear_id)
        .where(MemberGearMaintenance.is_active == True)
        .order_by(MemberGearMaintenance.name)
    )
    schedules = result.scalars().all()

    return [serialize_gear_maintenance(s) for s in schedules]


@router.post("/members/{member_id}/gear/{gear_id}/maintenance/")
async def create_gear_maintenance(
    member_id: int,
    gear_id: int,
    data: GearMaintenanceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Create a maintenance schedule for a gear item"""
    # Verify gear exists and belongs to member
    result = await db.execute(
        select(MemberGear)
        .where(MemberGear.id == gear_id)
        .where(MemberGear.member_id == member_id)
    )
    gear = result.scalar_one_or_none()
    if not gear:
        raise HTTPException(status_code=404, detail="Gear not found")

    maint = MemberGearMaintenance(gear_id=gear_id, **data.model_dump())
    db.add(maint)
    await db.commit()
    await db.refresh(maint)

    return serialize_gear_maintenance(maint)


@router.patch("/members/{member_id}/gear/{gear_id}/maintenance/{maint_id}/")
async def update_gear_maintenance(
    member_id: int,
    gear_id: int,
    maint_id: int,
    data: GearMaintenanceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Update a maintenance schedule"""
    result = await db.execute(
        select(MemberGearMaintenance)
        .where(MemberGearMaintenance.id == maint_id)
        .where(MemberGearMaintenance.gear_id == gear_id)
    )
    maint = result.scalar_one_or_none()
    if not maint:
        raise HTTPException(status_code=404, detail="Maintenance schedule not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(maint, key, value)

    maint.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(maint)

    return serialize_gear_maintenance(maint)


@router.delete("/members/{member_id}/gear/{gear_id}/maintenance/{maint_id}/")
async def delete_gear_maintenance(
    member_id: int,
    gear_id: int,
    maint_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Delete a maintenance schedule"""
    result = await db.execute(
        select(MemberGearMaintenance)
        .where(MemberGearMaintenance.id == maint_id)
        .where(MemberGearMaintenance.gear_id == gear_id)
    )
    maint = result.scalar_one_or_none()
    if not maint:
        raise HTTPException(status_code=404, detail="Maintenance schedule not found")

    await db.delete(maint)
    await db.commit()

    return {"message": "Maintenance schedule deleted"}


@router.post("/members/{member_id}/gear/{gear_id}/maintenance/{maint_id}/complete/")
async def complete_gear_maintenance(
    member_id: int,
    gear_id: int,
    maint_id: int,
    data: GearMaintenanceComplete,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Mark a maintenance task as complete"""
    result = await db.execute(
        select(MemberGearMaintenance)
        .where(MemberGearMaintenance.id == maint_id)
        .where(MemberGearMaintenance.gear_id == gear_id)
    )
    maint = result.scalar_one_or_none()
    if not maint:
        raise HTTPException(status_code=404, detail="Maintenance schedule not found")

    now = datetime.utcnow()
    maint.last_performed = now
    if data.round_count_at:
        maint.last_round_count = data.round_count_at
    maint.manual_due_date = None  # Clear manual override

    # Calculate next due date
    if maint.frequency_days:
        maint.next_due_date = now + timedelta(days=maint.frequency_days)

    maint.updated_at = now

    # Create log entry
    log = MemberGearMaintenanceLog(
        gear_id=gear_id,
        maintenance_id=maint_id,
        action=data.action,
        performed_at=now,
        round_count_at=data.round_count_at,
        notes=data.notes
    )
    db.add(log)

    await db.commit()
    await db.refresh(maint)

    return serialize_gear_maintenance(maint)


# ============================================
# Gear Contents Endpoints
# ============================================

@router.get("/members/{member_id}/gear/{gear_id}/contents/")
async def get_gear_contents(
    member_id: int,
    gear_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get contents for a container gear item"""
    # Verify gear exists and belongs to member
    result = await db.execute(
        select(MemberGear)
        .where(MemberGear.id == gear_id)
        .where(MemberGear.member_id == member_id)
    )
    gear = result.scalar_one_or_none()
    if not gear:
        raise HTTPException(status_code=404, detail="Gear not found")

    result = await db.execute(
        select(MemberGearContents)
        .where(MemberGearContents.gear_id == gear_id)
        .where(MemberGearContents.is_active == True)
        .order_by(MemberGearContents.category, MemberGearContents.item_name)
    )
    contents = result.scalars().all()

    return [serialize_gear_contents(c) for c in contents]


@router.post("/members/{member_id}/gear/{gear_id}/contents/")
async def create_gear_contents(
    member_id: int,
    gear_id: int,
    data: GearContentsCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Add contents to a container gear item"""
    # Verify gear exists and belongs to member
    result = await db.execute(
        select(MemberGear)
        .where(MemberGear.id == gear_id)
        .where(MemberGear.member_id == member_id)
    )
    gear = result.scalar_one_or_none()
    if not gear:
        raise HTTPException(status_code=404, detail="Gear not found")

    content = MemberGearContents(gear_id=gear_id, **data.model_dump())
    db.add(content)

    # Auto-set has_expirables on the gear if this content has expiration
    if data.expiration_date and not gear.has_expirables:
        gear.has_expirables = True

    await db.commit()
    await db.refresh(content)

    return serialize_gear_contents(content)


@router.patch("/members/{member_id}/gear/{gear_id}/contents/{content_id}/")
async def update_gear_contents(
    member_id: int,
    gear_id: int,
    content_id: int,
    data: GearContentsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Update a contents item"""
    result = await db.execute(
        select(MemberGearContents)
        .where(MemberGearContents.id == content_id)
        .where(MemberGearContents.gear_id == gear_id)
    )
    content = result.scalar_one_or_none()
    if not content:
        raise HTTPException(status_code=404, detail="Content item not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(content, key, value)

    content.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(content)

    return serialize_gear_contents(content)


@router.delete("/members/{member_id}/gear/{gear_id}/contents/{content_id}/")
async def delete_gear_contents(
    member_id: int,
    gear_id: int,
    content_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Delete a contents item"""
    result = await db.execute(
        select(MemberGearContents)
        .where(MemberGearContents.id == content_id)
        .where(MemberGearContents.gear_id == gear_id)
    )
    content = result.scalar_one_or_none()
    if not content:
        raise HTTPException(status_code=404, detail="Content item not found")

    await db.delete(content)
    await db.commit()

    return {"message": "Content item deleted"}


# ============================================
# Training CRUD Endpoints
# ============================================

def serialize_training(training: MemberTraining) -> dict:
    """Serialize a training item to dict"""
    return {
        "id": training.id,
        "member_id": training.member_id,
        "name": training.name,
        "category": training.category.value if training.category else None,
        "description": training.description,
        "last_trained": training.last_trained.isoformat() if training.last_trained else None,
        "frequency_days": training.frequency_days,
        "next_due": training.next_due.isoformat() if training.next_due else None,
        "total_sessions": training.total_sessions,
        "notes": training.notes,
        "is_active": training.is_active,
        "created_at": training.created_at.isoformat() if training.created_at else None,
        "updated_at": training.updated_at.isoformat() if training.updated_at else None,
    }


def serialize_training_log(log: MemberTrainingLog) -> dict:
    """Serialize a training log to dict"""
    return {
        "id": log.id,
        "training_id": log.training_id,
        "trained_at": log.trained_at.isoformat() if log.trained_at else None,
        "duration_minutes": log.duration_minutes,
        "notes": log.notes,
        "created_at": log.created_at.isoformat() if log.created_at else None,
    }


@router.get("/members/{member_id}/training/")
async def get_member_training(
    member_id: int,
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get all training items for a member"""
    # Verify member exists
    result = await db.execute(
        select(TeamMember).where(TeamMember.id == member_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    query = select(MemberTraining).where(MemberTraining.member_id == member_id)
    if not include_inactive:
        query = query.where(MemberTraining.is_active == True)
    query = query.order_by(MemberTraining.name)

    result = await db.execute(query)
    training_items = result.scalars().all()

    return [serialize_training(t) for t in training_items]


@router.post("/members/{member_id}/training/")
async def create_member_training(
    member_id: int,
    data: TrainingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Create a new training item for a member"""
    # Verify member exists
    result = await db.execute(
        select(TeamMember).where(TeamMember.id == member_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    training = MemberTraining(member_id=member_id, **data.model_dump())
    db.add(training)
    await db.commit()
    await db.refresh(training)

    return serialize_training(training)


@router.patch("/members/{member_id}/training/{training_id}/")
async def update_member_training(
    member_id: int,
    training_id: int,
    data: TrainingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Update a training item"""
    result = await db.execute(
        select(MemberTraining)
        .where(MemberTraining.id == training_id)
        .where(MemberTraining.member_id == member_id)
    )
    training = result.scalar_one_or_none()
    if not training:
        raise HTTPException(status_code=404, detail="Training item not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(training, key, value)

    training.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(training)

    return serialize_training(training)


@router.delete("/members/{member_id}/training/{training_id}/")
async def delete_member_training(
    member_id: int,
    training_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Delete a training item"""
    result = await db.execute(
        select(MemberTraining)
        .where(MemberTraining.id == training_id)
        .where(MemberTraining.member_id == member_id)
    )
    training = result.scalar_one_or_none()
    if not training:
        raise HTTPException(status_code=404, detail="Training item not found")

    await db.delete(training)
    await db.commit()

    return {"message": "Training item deleted"}


@router.post("/members/{member_id}/training/{training_id}/log/")
async def log_training_session(
    member_id: int,
    training_id: int,
    data: TrainingLogCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Log a training session"""
    result = await db.execute(
        select(MemberTraining)
        .where(MemberTraining.id == training_id)
        .where(MemberTraining.member_id == member_id)
    )
    training = result.scalar_one_or_none()
    if not training:
        raise HTTPException(status_code=404, detail="Training item not found")

    now = datetime.utcnow()
    trained_at = data.trained_at or now

    # Create log entry
    log = MemberTrainingLog(
        training_id=training_id,
        trained_at=trained_at,
        duration_minutes=data.duration_minutes,
        notes=data.notes
    )
    db.add(log)

    # Update training record
    training.last_trained = trained_at
    training.total_sessions = (training.total_sessions or 0) + 1
    if training.frequency_days:
        training.next_due = trained_at + timedelta(days=training.frequency_days)
    training.updated_at = now

    await db.commit()
    await db.refresh(log)

    return serialize_training_log(log)


@router.get("/members/{member_id}/training/{training_id}/history/")
async def get_training_history(
    member_id: int,
    training_id: int,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get training session history"""
    result = await db.execute(
        select(MemberTrainingLog)
        .where(MemberTrainingLog.training_id == training_id)
        .order_by(desc(MemberTrainingLog.trained_at))
        .limit(limit)
    )
    logs = result.scalars().all()

    return [serialize_training_log(log) for log in logs]


@router.get("/training-summary/")
async def get_training_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get team-wide training overview"""
    # Get all active members
    result = await db.execute(
        select(TeamMember).where(TeamMember.is_active == True)
    )
    members = result.scalars().all()

    # Get all active training items
    result = await db.execute(
        select(MemberTraining).where(MemberTraining.is_active == True)
    )
    all_training = result.scalars().all()

    # Group by category
    by_category = {}
    for t in all_training:
        cat = t.category.value if t.category else "OTHER"
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append({
            "member_id": t.member_id,
            "name": t.name,
            "last_trained": t.last_trained.isoformat() if t.last_trained else None,
            "total_sessions": t.total_sessions,
            "next_due": t.next_due.isoformat() if t.next_due else None,
        })

    # Find overdue training
    now = datetime.utcnow()
    overdue = []
    for t in all_training:
        if t.next_due and t.next_due < now:
            member = next((m for m in members if m.id == t.member_id), None)
            overdue.append({
                "member_id": t.member_id,
                "member_name": member.name if member else "Unknown",
                "training_name": t.name,
                "category": t.category.value if t.category else "OTHER",
                "next_due": t.next_due.isoformat(),
                "days_overdue": (now - t.next_due).days,
            })

    overdue.sort(key=lambda x: x["days_overdue"], reverse=True)

    return {
        "total_members": len(members),
        "total_training_items": len(all_training),
        "by_category": by_category,
        "overdue": overdue[:20],
    }


# ============================================
# Medical Appointment Endpoints
# ============================================

def serialize_appointment(appt: MemberMedicalAppointment) -> dict:
    """Serialize a medical appointment to dict"""
    return {
        "id": appt.id,
        "member_id": appt.member_id,
        "appointment_type": appt.appointment_type.value if appt.appointment_type else None,
        "custom_type_name": appt.custom_type_name,
        "display_type": appt.display_type,
        "provider_name": appt.provider_name,
        "provider_phone": appt.provider_phone,
        "provider_address": appt.provider_address,
        "last_appointment": appt.last_appointment.isoformat() if appt.last_appointment else None,
        "next_due": appt.next_due.isoformat() if appt.next_due else None,
        "frequency_months": appt.frequency_months,
        "is_active": appt.is_active,
        "notes": appt.notes,
        "created_at": appt.created_at.isoformat() if appt.created_at else None,
        "updated_at": appt.updated_at.isoformat() if appt.updated_at else None,
    }


@router.get("/members/{member_id}/appointments/")
async def get_member_appointments(
    member_id: int,
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get all medical appointments for a member"""
    # Verify member exists
    result = await db.execute(
        select(TeamMember).where(TeamMember.id == member_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    query = select(MemberMedicalAppointment).where(MemberMedicalAppointment.member_id == member_id)
    if not include_inactive:
        query = query.where(MemberMedicalAppointment.is_active == True)
    query = query.order_by(MemberMedicalAppointment.next_due.nulls_last())

    result = await db.execute(query)
    appointments = result.scalars().all()

    return [serialize_appointment(a) for a in appointments]


@router.post("/members/{member_id}/appointments/")
async def create_member_appointment(
    member_id: int,
    data: MedicalAppointmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Create a new medical appointment for a member"""
    # Verify member exists
    result = await db.execute(
        select(TeamMember).where(TeamMember.id == member_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    appt = MemberMedicalAppointment(member_id=member_id, **data.model_dump())
    db.add(appt)
    await db.commit()
    await db.refresh(appt)

    return serialize_appointment(appt)


@router.patch("/members/{member_id}/appointments/{appt_id}/")
async def update_member_appointment(
    member_id: int,
    appt_id: int,
    data: MedicalAppointmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Update a medical appointment"""
    result = await db.execute(
        select(MemberMedicalAppointment)
        .where(MemberMedicalAppointment.id == appt_id)
        .where(MemberMedicalAppointment.member_id == member_id)
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(appt, key, value)

    appt.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(appt)

    return serialize_appointment(appt)


@router.delete("/members/{member_id}/appointments/{appt_id}/")
async def delete_member_appointment(
    member_id: int,
    appt_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Delete a medical appointment"""
    result = await db.execute(
        select(MemberMedicalAppointment)
        .where(MemberMedicalAppointment.id == appt_id)
        .where(MemberMedicalAppointment.member_id == member_id)
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    await db.delete(appt)
    await db.commit()

    return {"message": "Appointment deleted"}


@router.post("/members/{member_id}/appointments/{appt_id}/complete/")
async def complete_member_appointment(
    member_id: int,
    appt_id: int,
    data: MedicalAppointmentComplete,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Mark a medical appointment as complete and calculate next due"""
    result = await db.execute(
        select(MemberMedicalAppointment)
        .where(MemberMedicalAppointment.id == appt_id)
        .where(MemberMedicalAppointment.member_id == member_id)
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    now = datetime.utcnow()
    appointment_date = data.appointment_date or now

    appt.last_appointment = appointment_date
    # Calculate next due based on frequency
    if appt.frequency_months:
        # Add months to the appointment date
        next_due = appointment_date
        next_due = next_due.replace(
            year=next_due.year + (next_due.month + appt.frequency_months - 1) // 12,
            month=(next_due.month + appt.frequency_months - 1) % 12 + 1
        )
        appt.next_due = next_due

    if data.notes:
        appt.notes = data.notes

    appt.updated_at = now
    await db.commit()
    await db.refresh(appt)

    return serialize_appointment(appt)
