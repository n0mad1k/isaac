"""
Evidence-Based Readiness Analysis Service

Two-track system:
1. MEDICAL SAFETY (Hard Gate) - BP, SpO2, temperature, severe symptoms
2. PERFORMANCE READINESS - Autonomic recovery (RHR/HRV), training load, subjective factors

Key improvements over previous version:
- Dual baselines (7-day short + 35-day long term)
- Persistence-based HRV/RHR decisions (2+ days required to trigger flags)
- Separate medical safety from performance readiness
- Uncertainty handling (no more "neutral = 85" when data is missing)
- ACC/AHA blood pressure categories
- Body composition as long-term context only
- Explainable readiness with primary drivers

Uses Marine Corps taping method for body composition - NO BMI.
"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc
from loguru import logger
import math

from models.team import (
    TeamMember, MemberVitalsLog, MemberWeightLog, MemberTraining, MemberTrainingLog,
    MemberWorkout, WorkoutType,
    VitalType, ReadinessStatus, Gender
)


# ============================================
# Data Classes
# ============================================

@dataclass
class BaselineData:
    """Dual baseline for a vital type"""
    short_avg: Optional[float] = None   # 7-day average
    long_avg: Optional[float] = None    # 35-day average
    short_count: int = 0
    long_count: int = 0
    trend: str = "unknown"              # improving, stable, declining
    confidence: str = "LOW"             # LOW, MEDIUM, HIGH


@dataclass
class MedicalSafetyResult:
    """Medical safety assessment (hard gate)"""
    status: str                         # GREEN, AMBER, RED
    flags: List[str] = field(default_factory=list)
    action: Optional[str] = None


@dataclass
class PerformanceIndicator:
    """Individual performance metric with score and explanation"""
    name: str
    category: str                       # autonomic, cardiovascular, illness, training_load, subjective
    value: float                        # 0-100 score
    trend: str                          # improving, stable, declining, insufficient_data
    explanation: str
    confidence: str                     # LOW, MEDIUM, HIGH
    contributing_factors: List[str] = field(default_factory=list)
    details: Dict[str, Any] = field(default_factory=dict)  # actual_values, normal_ranges, recommendation


@dataclass
class TrainingLoadAnalysis:
    """Training load metrics"""
    acute_load: float                   # Last 7 days
    chronic_load: float                 # Last 28 days average per week
    acwr: float                         # Acute:Chronic Workload Ratio
    risk_level: str                     # LOW, MODERATE, HIGH
    spike_detected: bool = False
    monotony: Optional[float] = None    # Training monotony score
    weeks_of_data: int = 4              # Actual weeks of chronic data available
    notes: List[str] = field(default_factory=list)


@dataclass
class RiskFlag:
    """Warning flag for concerning indicators"""
    code: str
    severity: str                       # low, moderate, high, critical
    title: str
    explanation: str
    recommendation: Optional[str] = None
    source: str = "physical"            # "physical" or "medical"


@dataclass
class ReadinessAnalysis:
    """Complete readiness analysis result"""
    overall_status: str                 # GREEN, AMBER, RED
    score: float                        # 0-100
    confidence: str                     # LOW, MEDIUM, HIGH

    # Explainability (required)
    primary_drivers: List[str]          # Top 2-4 reasons for status
    data_sources_used: List[str]        # What data influenced result
    data_quality_note: str              # e.g., "Based on 12 datapoints over 14 days"

    # Breakdown
    medical_safety: MedicalSafetyResult
    performance_readiness: float        # 0-100
    training_load: Optional[TrainingLoadAnalysis] = None
    subjective_factors: List[str] = field(default_factory=list)

    # Detailed data
    indicators: List[PerformanceIndicator] = field(default_factory=list)
    risk_flags: List[RiskFlag] = field(default_factory=list)
    data_quality: Dict[str, Any] = field(default_factory=dict)
    analyzed_at: str = ""
    member_updated: bool = False


# ============================================
# Constants
# ============================================

SHORT_BASELINE_DAYS = 7
LONG_BASELINE_DAYS = 35

# Minimum data points for confidence levels
MIN_DATAPOINTS_LOW = 1
MIN_DATAPOINTS_MEDIUM = 7
MIN_DATAPOINTS_HIGH = 15

# ACC/AHA Blood Pressure Categories
BP_CATEGORIES = {
    "normal": {"systolic": (0, 120), "diastolic": (0, 80)},
    "elevated": {"systolic": (120, 130), "diastolic": (0, 80)},
    "stage1": {"systolic": (130, 140), "diastolic": (80, 90)},
    "stage2": {"systolic": (140, 180), "diastolic": (90, 120)},
    "crisis": {"systolic": (180, 999), "diastolic": (120, 999)}
}

# ACE Fitness body fat standards (max for "Normal/Acceptable" category)
ACE_BF_STANDARDS_MALE = {(17, 999): 24}
ACE_BF_STANDARDS_FEMALE = {(17, 999): 31}

# Minimum age for body composition analysis (Marine Corps taping method not appropriate for children)
MIN_AGE_BODY_COMPOSITION = 16

# Pediatric blood pressure ranges (simplified from AAP guidelines)
# Format: (normal_sys_max, elevated_sys_max, stage1_sys_max, normal_dia_max, elevated_dia_max, stage1_dia_max)
PEDIATRIC_BP_RANGES = {
    (1, 5): (110, 115, 120, 70, 75, 80),
    (6, 12): (120, 125, 130, 80, 82, 85),
    (13, 17): (120, 130, 140, 80, 80, 90),
}

# Pediatric respiratory rate ranges (breaths/min)
# Format: (normal_max, elevated_threshold, high_threshold)
PEDIATRIC_RR_RANGES = {
    (0, 1): (40, 50, 60),
    (1, 3): (30, 35, 40),
    (4, 5): (25, 30, 35),
    (6, 12): (22, 28, 35),
    (13, 17): (20, 25, 30),
}

# Pediatric resting heart rate ranges (bpm)
# Format: (normal_min, normal_max)
PEDIATRIC_HR_RANGES = {
    (0, 1): (100, 160),
    (1, 3): (80, 130),
    (4, 5): (80, 120),
    (6, 12): (70, 110),
    (13, 17): (60, 100),
}


# ============================================
# Helper Functions
# ============================================

def _get_age_from_birthdate(birth_date: Optional[datetime]) -> Optional[int]:
    """Calculate age from birthdate"""
    if not birth_date:
        return None
    today = datetime.now()
    age = today.year - birth_date.year
    if (today.month, today.day) < (birth_date.month, birth_date.day):
        age -= 1
    return age


def _is_child(age: Optional[int]) -> bool:
    """Check if age indicates a child (under 18)"""
    return age is not None and age < 18


def _get_pediatric_bp_category(systolic: float, diastolic: float, age: int) -> str:
    """Get BP category using pediatric ranges based on age."""
    ranges = None
    for (min_age, max_age), vals in PEDIATRIC_BP_RANGES.items():
        if min_age <= age <= max_age:
            ranges = vals
            break
    if not ranges:
        return _get_bp_category(systolic, diastolic)  # Fall back to adult

    normal_sys, elevated_sys, stage1_sys, normal_dia, elevated_dia, stage1_dia = ranges

    if systolic >= 180 or diastolic >= 120:
        return "crisis"
    if systolic >= stage1_sys or diastolic >= stage1_dia:
        return "stage2"
    if systolic >= elevated_sys or diastolic >= elevated_dia:
        return "stage1"
    if systolic >= normal_sys or diastolic >= normal_dia:
        return "elevated"
    return "normal"


def _get_rr_thresholds(age: Optional[int]) -> Tuple[float, float]:
    """Get respiratory rate thresholds (elevated, high) based on age."""
    if age is not None:
        for (min_age, max_age), (_, elevated, high) in PEDIATRIC_RR_RANGES.items():
            if min_age <= age <= max_age:
                return (elevated, high)
    # Adult defaults
    return (20, 25)


def _get_pediatric_hr_range(age: Optional[int]) -> Optional[Tuple[int, int]]:
    """Get normal resting heart rate range (min, max) for pediatric ages."""
    if age is not None:
        for (min_age, max_age), (hr_min, hr_max) in PEDIATRIC_HR_RANGES.items():
            if min_age <= age <= max_age:
                return (hr_min, hr_max)
    return None


def _calculate_body_fat_taping(
    height_inches: float,
    waist: float,
    neck: float,
    hip: Optional[float] = None,
    is_female: bool = False
) -> Optional[float]:
    """
    Marine Corps body fat calculation using tape measurements.

    Males: BF% = 86.010 × log10(waist - neck) - 70.041 × log10(height) + 36.76
    Females: BF% = 163.205 × log10(waist + hip - neck) - 97.684 × log10(height) - 78.387
    """
    if not height_inches or not waist or not neck:
        return None

    if is_female:
        if not hip:
            return None
        circumference_value = waist + hip - neck
        if circumference_value <= 0:
            return None
        bf = 163.205 * math.log10(circumference_value) - 97.684 * math.log10(height_inches) - 78.387
    else:
        circumference_value = waist - neck
        if circumference_value <= 0:
            return None
        bf = 86.010 * math.log10(circumference_value) - 70.041 * math.log10(height_inches) + 36.76

    return max(0, min(60, bf))


def _get_bf_standard(age: Optional[int], is_female: bool) -> float:
    """Get max allowable body fat % for age/gender (ACE fitness standards)"""
    standards = ACE_BF_STANDARDS_FEMALE if is_female else ACE_BF_STANDARDS_MALE
    if not age:
        age = 30

    for (min_age, max_age), max_bf in standards.items():
        if min_age <= age <= max_age:
            return max_bf
    return 24 if not is_female else 31


def _get_confidence_level(datapoints: int) -> str:
    """Get confidence level based on number of data points"""
    if datapoints >= MIN_DATAPOINTS_HIGH:
        return "HIGH"
    elif datapoints >= MIN_DATAPOINTS_MEDIUM:
        return "MEDIUM"
    return "LOW"


def _calculate_dual_baseline(
    vitals: List[MemberVitalsLog],
    vital_type: VitalType
) -> BaselineData:
    """
    Calculate dual baselines (7-day short-term + 35-day long-term).

    Returns BaselineData with trend analysis.
    """
    now = datetime.utcnow()
    short_cutoff = now - timedelta(days=SHORT_BASELINE_DAYS)
    long_cutoff = now - timedelta(days=LONG_BASELINE_DAYS)

    short_values = [v.value for v in vitals if v.vital_type == vital_type and v.recorded_at >= short_cutoff]
    long_values = [v.value for v in vitals if v.vital_type == vital_type and v.recorded_at >= long_cutoff]

    result = BaselineData()

    if short_values:
        result.short_avg = sum(short_values) / len(short_values)
        result.short_count = len(short_values)

    if long_values:
        result.long_avg = sum(long_values) / len(long_values)
        result.long_count = len(long_values)

    # Determine confidence
    result.confidence = _get_confidence_level(result.long_count)

    # Determine trend
    if result.short_avg and result.long_avg:
        pct_diff = ((result.short_avg - result.long_avg) / result.long_avg) * 100
        if pct_diff > 5:
            result.trend = "increasing"
        elif pct_diff < -5:
            result.trend = "decreasing"
        else:
            result.trend = "stable"
    else:
        result.trend = "unknown"

    return result


def _get_latest_vital(vitals: List[MemberVitalsLog], vital_type: VitalType) -> Optional[MemberVitalsLog]:
    """Get most recent vital of a specific type"""
    matching = [v for v in vitals if v.vital_type == vital_type]
    if not matching:
        return None
    return max(matching, key=lambda v: v.recorded_at)


def _get_recent_vitals(
    vitals: List[MemberVitalsLog],
    vital_type: VitalType,
    days: int = 3
) -> List[MemberVitalsLog]:
    """Get vitals from the last N days for persistence checking"""
    cutoff = datetime.utcnow() - timedelta(days=days)
    return [v for v in vitals if v.vital_type == vital_type and v.recorded_at >= cutoff]


def _get_bp_category(systolic: float, diastolic: float) -> str:
    """Classify blood pressure using ACC/AHA categories"""
    for category, ranges in BP_CATEGORIES.items():
        sys_range = ranges["systolic"]
        dia_range = ranges["diastolic"]
        if (sys_range[0] <= systolic < sys_range[1]) or (dia_range[0] <= diastolic < dia_range[1]):
            if category == "crisis" and (systolic >= 180 or diastolic >= 120):
                return "crisis"
            elif category == "stage2" and (systolic >= 140 or diastolic >= 90):
                return "stage2"
            elif category == "stage1" and (systolic >= 130 or diastolic >= 80):
                return "stage1"
            elif category == "elevated" and (systolic >= 120):
                return "elevated"
            else:
                continue

    # Default classification
    if systolic >= 180 or diastolic >= 120:
        return "crisis"
    elif systolic >= 140 or diastolic >= 90:
        return "stage2"
    elif systolic >= 130 or diastolic >= 80:
        return "stage1"
    elif systolic >= 120:
        return "elevated"
    return "normal"


# ============================================
# Medical Safety Assessment (Hard Gate)
# ============================================

def _assess_medical_safety(
    vitals: List[MemberVitalsLog],
    context_factors: Optional[List[str]] = None,
    age: Optional[int] = None
) -> MedicalSafetyResult:
    """
    Assess medical safety - this is a HARD GATE.
    If RED, overall status is RED regardless of performance readiness.

    Checks:
    - Blood pressure (ACC/AHA for adults, AAP for children)
    - SpO2 (<92% = critical, <95% = concern)
    - Temperature (fever detection)
    - Severe symptom patterns
    """
    flags = []
    status = "GREEN"
    action = None

    # Blood Pressure - use age-appropriate ranges
    latest_bp = _get_latest_vital(vitals, VitalType.BLOOD_PRESSURE)
    if latest_bp:
        systolic = latest_bp.value
        diastolic = latest_bp.value_secondary or 80
        if _is_child(age):
            bp_category = _get_pediatric_bp_category(systolic, diastolic, age)
        else:
            bp_category = _get_bp_category(systolic, diastolic)

        # Combine context factors from the vital log itself and passed parameters
        bp_context_factors = list(latest_bp.context_factors or []) if latest_bp.context_factors else []
        if context_factors:
            bp_context_factors.extend(context_factors)

        # Context factors that can explain elevated BP readings
        bp_explainable_factors = ["caffeine", "stress", "post_exercise", "white_coat", "high_caffeine", "high_stress"]
        has_explainable_factors = any(f in bp_explainable_factors for f in bp_context_factors)

        if bp_category == "crisis":
            status = "RED"
            flags.append(f"BP CRISIS: {systolic:.0f}/{diastolic:.0f}")
            action = "Seek immediate medical evaluation"
        elif bp_category == "stage2":
            if status != "RED":
                status = "AMBER"
            flags.append(f"BP Stage 2: {systolic:.0f}/{diastolic:.0f}")
            action = "Medical follow-up recommended"
            if has_explainable_factors:
                flags.append(f"  (Context: {', '.join(bp_context_factors)})")
        elif bp_category == "stage1":
            # Only flag if no context factors explain it
            if not has_explainable_factors:
                if status == "GREEN":
                    status = "AMBER"
                flags.append(f"BP Stage 1: {systolic:.0f}/{diastolic:.0f}")
            else:
                # Add note that context factors explain the reading
                flags.append(f"BP elevated but context explains it: {', '.join(bp_context_factors)}")

    # Blood Oxygen (SpO2)
    latest_spo2 = _get_latest_vital(vitals, VitalType.BLOOD_OXYGEN)
    if latest_spo2:
        spo2 = latest_spo2.value
        if spo2 < 92:
            status = "RED"
            flags.append(f"SpO2 CRITICAL: {spo2:.0f}%")
            action = "Seek immediate medical attention"
        elif spo2 < 95:
            if status != "RED":
                status = "AMBER"
            flags.append(f"SpO2 low: {spo2:.0f}%")

    # Temperature (fever detection)
    latest_temp = _get_latest_vital(vitals, VitalType.TEMPERATURE)
    if latest_temp:
        temp = latest_temp.value
        if temp >= 103:
            status = "RED"
            flags.append(f"HIGH FEVER: {temp:.1f}°F")
            action = "Seek medical evaluation"
        elif temp >= 100.4:
            if status != "RED":
                status = "AMBER"
            flags.append(f"Fever: {temp:.1f}°F")

    return MedicalSafetyResult(status=status, flags=flags, action=action)


# ============================================
# Autonomic Recovery (Persistence-Based)
# ============================================

def _check_autonomic_fatigue(
    vitals: List[MemberVitalsLog],
    all_vitals: List[MemberVitalsLog]
) -> Tuple[Optional[str], List[str]]:
    """
    Check for autonomic fatigue using persistence-based logic.

    Requires pattern to persist for 2+ days before flagging.
    Single-day HRV/RHR changes are common and often meaningless.

    Returns: (fatigue_type, factors_list)
    """
    factors = []

    # Get baselines
    rhr_baseline = _calculate_dual_baseline(all_vitals, VitalType.RESTING_HEART_RATE)
    hrv_baseline = _calculate_dual_baseline(all_vitals, VitalType.HRV)

    # Fall back to regular heart rate if no resting HR
    if not rhr_baseline.long_avg:
        rhr_baseline = _calculate_dual_baseline(all_vitals, VitalType.HEART_RATE)

    # Get last 3 days of data for persistence check
    recent_rhr = _get_recent_vitals(vitals, VitalType.RESTING_HEART_RATE, days=3)
    if not recent_rhr:
        recent_rhr = _get_recent_vitals(vitals, VitalType.HEART_RATE, days=3)

    recent_hrv = _get_recent_vitals(vitals, VitalType.HRV, days=3)

    # Count suppressed/elevated days
    hrv_suppressed_days = 0
    rhr_elevated_days = 0

    if rhr_baseline.long_avg and recent_rhr:
        for v in recent_rhr:
            if v.value > rhr_baseline.long_avg + 5:
                rhr_elevated_days += 1

    if hrv_baseline.long_avg and recent_hrv:
        for v in recent_hrv:
            if v.value < hrv_baseline.long_avg * 0.85:
                hrv_suppressed_days += 1

    # Check for fatigue patterns (require 2+ days)
    fatigue_type = None

    if hrv_suppressed_days >= 2 and rhr_elevated_days >= 2:
        fatigue_type = "STACKED_FATIGUE"
        factors.append(f"HRV suppressed {hrv_suppressed_days}/3 days + RHR elevated {rhr_elevated_days}/3 days")
    elif hrv_suppressed_days >= 2:
        fatigue_type = "HRV_FATIGUE"
        factors.append(f"HRV suppressed {hrv_suppressed_days} of last 3 days")
    elif rhr_elevated_days >= 2:
        fatigue_type = "RHR_FATIGUE"
        factors.append(f"RHR elevated {rhr_elevated_days} of last 3 days")

    # Add baseline context
    if rhr_baseline.long_avg:
        latest_rhr = _get_latest_vital(vitals, VitalType.RESTING_HEART_RATE)
        if not latest_rhr:
            latest_rhr = _get_latest_vital(vitals, VitalType.HEART_RATE)
        if latest_rhr:
            diff = latest_rhr.value - rhr_baseline.long_avg
            if abs(diff) > 3:
                factors.append(f"RHR: {latest_rhr.value:.0f} bpm (baseline: {rhr_baseline.long_avg:.0f})")

    if hrv_baseline.long_avg:
        latest_hrv = _get_latest_vital(vitals, VitalType.HRV)
        if latest_hrv:
            pct = ((latest_hrv.value - hrv_baseline.long_avg) / hrv_baseline.long_avg) * 100
            if abs(pct) > 10:
                factors.append(f"HRV: {latest_hrv.value:.0f} ms ({pct:+.0f}% vs baseline)")

    return fatigue_type, factors


def _analyze_autonomic_recovery(
    vitals: List[MemberVitalsLog],
    all_vitals: List[MemberVitalsLog]
) -> PerformanceIndicator:
    """
    Analyze autonomic recovery using persistence-based logic.

    Key change: Single-day drops don't trigger flags.
    """
    factors = []
    score = 85  # Default uncertain
    confidence = "LOW"

    # Check for fatigue patterns
    fatigue_type, fatigue_factors = _check_autonomic_fatigue(vitals, all_vitals)
    factors.extend(fatigue_factors)

    # Get baselines for confidence
    rhr_baseline = _calculate_dual_baseline(all_vitals, VitalType.RESTING_HEART_RATE)
    hrv_baseline = _calculate_dual_baseline(all_vitals, VitalType.HRV)

    total_datapoints = rhr_baseline.long_count + hrv_baseline.long_count
    confidence = _get_confidence_level(total_datapoints // 2)

    if fatigue_type == "STACKED_FATIGUE":
        score = 45
        factors.append("Both HRV and RHR indicate fatigue (persistent)")
    elif fatigue_type == "HRV_FATIGUE":
        score = 60
        factors.append("HRV suppressed (persistent pattern)")
    elif fatigue_type == "RHR_FATIGUE":
        score = 65
        factors.append("RHR elevated (persistent pattern)")
    elif total_datapoints < MIN_DATAPOINTS_MEDIUM:
        # Insufficient data - assume neutral, don't penalize for missing data
        score = 85
        factors.append("Limited autonomic data - using available readings")
        confidence = "LOW"
    else:
        # Check for positive signals
        latest_hrv = _get_latest_vital(vitals, VitalType.HRV)
        if latest_hrv and hrv_baseline.long_avg:
            pct = ((latest_hrv.value - hrv_baseline.long_avg) / hrv_baseline.long_avg) * 100
            if pct >= 10:
                score = 95
                factors.append(f"HRV elevated +{pct:.0f}% - good recovery")
            elif pct >= 0:
                score = 85
                factors.append("HRV stable - normal recovery")

        latest_rhr = _get_latest_vital(vitals, VitalType.RESTING_HEART_RATE)
        if latest_rhr and rhr_baseline.long_avg:
            diff = latest_rhr.value - rhr_baseline.long_avg
            if diff <= -5:
                score = min(100, score + 5)
                factors.append(f"RHR improved {diff:.0f} bpm")

    trend = "stable"
    if score < 70:
        trend = "declining"
    elif score >= 90:
        trend = "improving"

    if not factors:
        factors.append("Autonomic indicators within normal range")

    # Build detailed values for informative display
    details = {"actual_values": [], "normal_ranges": []}
    latest_rhr = _get_latest_vital(vitals, VitalType.RESTING_HEART_RATE)
    latest_hrv = _get_latest_vital(vitals, VitalType.HRV)
    if latest_rhr:
        details["actual_values"].append(f"RHR: {latest_rhr.value:.0f} bpm")
        if rhr_baseline.long_avg:
            details["actual_values"].append(f"RHR baseline: {rhr_baseline.long_avg:.0f} bpm")
        details["normal_ranges"].append("Healthy adult RHR: 50-80 bpm (lower = fitter)")
    if latest_hrv:
        details["actual_values"].append(f"HRV: {latest_hrv.value:.0f} ms")
        if hrv_baseline.long_avg:
            details["actual_values"].append(f"HRV baseline: {hrv_baseline.long_avg:.0f} ms")
        details["normal_ranges"].append("HRV varies widely; your baseline is what matters")

    if score < 60:
        details["recommendation"] = "Recovery is suppressed. Prioritize sleep (7-9 hrs), reduce training intensity, and stay hydrated."
    elif score < 80:
        details["recommendation"] = "Recovery is moderate. Monitor for persistent patterns. Light activity is OK."
    else:
        details["recommendation"] = "Recovery looks good. Normal training load is appropriate."

    # Make explanation specific to actual state
    if score < 60:
        explanation = "Autonomic markers indicate incomplete recovery — consider a rest day"
    elif score < 80:
        explanation = "Autonomic recovery is moderate — monitor trends"
    else:
        explanation = "Autonomic recovery is strong — well-recovered"

    return PerformanceIndicator(
        name="Autonomic Recovery",
        category="autonomic",
        value=score,
        trend=trend,
        explanation=explanation,
        confidence=confidence,
        contributing_factors=factors,
        details=details
    )


# ============================================
# Cardiovascular Assessment
# ============================================

def _analyze_cardiovascular(vitals: List[MemberVitalsLog], age: Optional[int] = None) -> PerformanceIndicator:
    """Analyze cardiovascular health from BP and SpO2. Uses age-appropriate BP ranges for children."""
    factors = []
    bp_score = 100
    spo2_score = 100
    confidence = "LOW"
    datapoints = 0

    latest_bp = _get_latest_vital(vitals, VitalType.BLOOD_PRESSURE)
    if latest_bp:
        sys = latest_bp.value
        dia = latest_bp.value_secondary or 80
        if _is_child(age):
            bp_category = _get_pediatric_bp_category(sys, dia, age)
        else:
            bp_category = _get_bp_category(sys, dia)

        if bp_category == "crisis":
            bp_score = 30
            factors.append(f"BP Critical: {sys:.0f}/{dia:.0f}")
        elif bp_category == "stage2":
            bp_score = 50
            factors.append(f"BP High (Stage 2): {sys:.0f}/{dia:.0f}")
        elif bp_category == "stage1":
            bp_score = 70
            factors.append(f"BP Elevated (Stage 1): {sys:.0f}/{dia:.0f}")
        elif bp_category == "elevated":
            bp_score = 85
            factors.append(f"BP Slightly Elevated: {sys:.0f}/{dia:.0f}")
        else:
            factors.append(f"BP Normal: {sys:.0f}/{dia:.0f}")
        datapoints += 1

    latest_spo2 = _get_latest_vital(vitals, VitalType.BLOOD_OXYGEN)
    if latest_spo2:
        spo2 = latest_spo2.value
        if spo2 < 92:
            spo2_score = 30
            factors.append(f"SpO2 critical: {spo2:.0f}%")
        elif spo2 < 95:
            spo2_score = 60
            factors.append(f"SpO2 low: {spo2:.0f}%")
        elif spo2 < 97:
            spo2_score = 80
            factors.append(f"SpO2 borderline: {spo2:.0f}%")
        else:
            factors.append(f"SpO2 normal: {spo2:.0f}%")
        datapoints += 1

    final_score = min(bp_score, spo2_score) if datapoints > 0 else 85
    confidence = _get_confidence_level(datapoints * 5)

    if not factors:
        factors.append("No cardiovascular data available")
        final_score = 85
        confidence = "LOW"

    trend = "stable" if final_score >= 70 else "declining"

    # Build detailed values
    details = {"actual_values": [], "normal_ranges": []}
    if latest_bp:
        sys = latest_bp.value
        dia = latest_bp.value_secondary or 80
        details["actual_values"].append(f"Blood Pressure: {sys:.0f}/{dia:.0f} mmHg")
        if _is_child(age):
            details["normal_ranges"].append(f"Pediatric BP varies by age/height percentile")
        else:
            details["normal_ranges"].append("Normal: <120/80 | Elevated: 120-129 | Stage 1: 130-139/80-89 | Stage 2: 140+/90+")
    if latest_spo2:
        details["actual_values"].append(f"SpO2: {latest_spo2.value:.0f}%")
        details["normal_ranges"].append("Normal SpO2: 95-100% | Below 92% is critical")

    if final_score < 60:
        details["recommendation"] = "Cardiovascular readings are concerning. Consult a healthcare provider. Avoid intense exercise."
    elif final_score < 80:
        details["recommendation"] = "Some readings are borderline. Monitor daily, reduce sodium, stay active."
    else:
        details["recommendation"] = "Cardiovascular markers are healthy. Maintain current lifestyle."

    # Specific explanation
    if final_score < 60:
        explanation = "Cardiovascular readings are elevated — monitor closely"
    elif final_score < 80:
        explanation = "Some cardiovascular markers are borderline — track trends"
    else:
        explanation = "Cardiovascular health looks good"

    return PerformanceIndicator(
        name="Cardiovascular",
        category="cardiovascular",
        value=final_score,
        trend=trend,
        explanation=explanation,
        confidence=confidence,
        contributing_factors=factors,
        details=details
    )


# ============================================
# Illness Detection (Pattern-Based)
# ============================================

def _detect_illness_pattern(
    vitals: List[MemberVitalsLog],
    all_vitals: List[MemberVitalsLog],
    age: Optional[int] = None
) -> PerformanceIndicator:
    """
    Detect potential illness using pattern recognition.
    Uses age-appropriate respiratory rate thresholds for children.

    Illness appears as PATTERN before thresholds are crossed.
    """
    factors = []
    score = 95  # Default healthy
    signals = []
    confidence = "LOW"

    latest_temp = _get_latest_vital(vitals, VitalType.TEMPERATURE)
    rhr_baseline = _calculate_dual_baseline(all_vitals, VitalType.RESTING_HEART_RATE)
    latest_rhr = _get_latest_vital(vitals, VitalType.RESTING_HEART_RATE)
    latest_hrv = _get_latest_vital(vitals, VitalType.HRV)
    hrv_baseline = _calculate_dual_baseline(all_vitals, VitalType.HRV)
    latest_rr = _get_latest_vital(vitals, VitalType.RESPIRATORY_RATE)

    datapoints = sum(1 for v in [latest_temp, latest_rhr, latest_hrv, latest_rr] if v)
    confidence = _get_confidence_level(datapoints * 3)

    # Pattern: Temp elevated + RHR elevated together
    if latest_temp and latest_rhr and rhr_baseline.long_avg:
        if latest_temp.value > 99.0 and latest_rhr.value > rhr_baseline.long_avg + 8:
            signals.append("temp_rhr_pattern")
            factors.append(f"Temperature ({latest_temp.value:.1f}°F) + elevated RHR")

    # Get age-appropriate respiratory rate thresholds
    rr_elevated, rr_high = _get_rr_thresholds(age)

    # Pattern: HRV drops sharply + respiratory changes
    if latest_hrv and hrv_baseline.long_avg and latest_rr:
        # Use a proportional threshold for children (RR baseline is higher)
        rr_concern = rr_elevated * 0.9  # Slightly below elevated threshold
        if latest_hrv.value < hrv_baseline.long_avg * 0.75 and latest_rr.value > rr_concern:
            signals.append("hrv_respiratory_pattern")
            factors.append("HRV significantly suppressed + elevated respiratory rate")

    # Pattern: Multiple minor elevations
    minor_flags = 0
    if latest_temp and latest_temp.value > 98.8:
        minor_flags += 1
    if latest_rhr and rhr_baseline.long_avg and latest_rhr.value > rhr_baseline.long_avg + 5:
        minor_flags += 1
    if latest_hrv and hrv_baseline.long_avg and latest_hrv.value < hrv_baseline.long_avg * 0.9:
        minor_flags += 1

    if minor_flags >= 2:
        signals.append("multi_minor_elevation")
        factors.append(f"Multiple minor elevations detected ({minor_flags} indicators)")

    # Single-factor illness indicators
    if latest_temp:
        if latest_temp.value >= 100.4:
            score = min(score, 40)
            factors.append(f"Fever: {latest_temp.value:.1f}°F")
        elif latest_temp.value >= 99.5:
            score = min(score, 70)
            factors.append(f"Elevated temp: {latest_temp.value:.1f}°F")

    if latest_rr:
        if latest_rr.value >= rr_high:
            score = min(score, 50)
            factors.append(f"Respiratory rate high: {latest_rr.value:.0f}/min")
        elif latest_rr.value >= rr_elevated:
            score = min(score, 75)
            factors.append(f"Respiratory rate elevated: {latest_rr.value:.0f}/min")

    # Apply illness pattern penalty
    if len(signals) >= 2:
        score = min(score, 50)
        factors.append("ILLNESS LIKELY: Multiple illness patterns detected")
    elif len(signals) == 1:
        score = min(score, 70)

    if not factors:
        factors.append("No illness indicators detected - vitals within normal range")

    trend = "stable" if score >= 80 else "declining"

    # Build a human-readable status label
    if score >= 90:
        status_label = "Healthy"
    elif score >= 70:
        status_label = "Watch - minor elevation detected"
    elif score >= 50:
        status_label = "Concern - potential illness pattern"
    else:
        status_label = "Alert - strong illness indicators"

    factors.insert(0, f"Status: {status_label}")

    # Build detailed values
    details = {"actual_values": [], "normal_ranges": []}
    if latest_temp:
        details["actual_values"].append(f"Temperature: {latest_temp.value:.1f}°F")
        details["normal_ranges"].append("Normal: 97.0-99.0°F | Fever: >100.4°F")
    if latest_rr:
        details["actual_values"].append(f"Respiratory Rate: {latest_rr.value:.0f}/min")
        if _is_child(age):
            details["normal_ranges"].append(f"Pediatric RR varies by age (elevated threshold: {rr_elevated}/min)")
        else:
            details["normal_ranges"].append("Normal adult: 12-20/min | Elevated: >20/min")
    if latest_rhr and rhr_baseline.long_avg:
        diff = latest_rhr.value - rhr_baseline.long_avg
        details["actual_values"].append(f"RHR vs baseline: {diff:+.0f} bpm")

    if score < 60:
        details["recommendation"] = "Strong illness pattern detected. Rest, hydrate, monitor temperature. Consider medical evaluation."
    elif score < 80:
        details["recommendation"] = "Minor elevation detected. Get extra sleep, wash hands frequently, stay hydrated."
    else:
        details["recommendation"] = "No illness indicators. Immune markers look healthy."

    return PerformanceIndicator(
        name="Immune Health",
        category="illness",
        value=score,
        trend=trend,
        explanation=status_label,
        confidence=confidence,
        contributing_factors=factors,
        details=details
    )


# ============================================
# Training Load Analysis
# ============================================

def _calculate_session_load(workout: MemberWorkout) -> float:
    """
    Calculate session load: duration × RPE

    For rucks: Apply ton-miles multiplier.
    """
    duration = workout.duration_minutes or 30  # Default 30 min
    rpe = workout.rpe or 5  # Default moderate effort

    session_load = duration * rpe

    # Ruck multiplier
    if workout.workout_type == WorkoutType.RUCK and workout.weight_carried_lbs and workout.distance_miles:
        ton_miles = workout.weight_carried_lbs * workout.distance_miles
        session_load *= (1 + ton_miles / 100)

    return session_load


def _steps_to_load(steps: float, stairs: float = 0) -> float:
    """
    Convert daily steps and stairs climbed into training load points.

    Steps are low-intensity locomotion; stairs add intensity.
    Scaled so typical activity doesn't dominate workout-based load:
      10,000 steps = ~30 load pts (vs ~210 for a moderate 30-min workout)
      10 flights stairs = ~50 load pts (stairs are significantly harder)
    """
    steps_load = (steps / 1000) * 3  # 3 pts per 1,000 steps
    stairs_load = stairs * 5  # 5 pts per flight of stairs
    return steps_load + stairs_load


def _analyze_training_load(workouts: List[MemberWorkout], step_data: Optional[dict] = None) -> TrainingLoadAnalysis:
    """
    Analyze training load using Acute:Chronic Workload Ratio (ACWR).

    Acute = last 7 days total load
    Chronic = last 28 days average weekly load

    Includes steps and stairs climbed as ambulatory training load.

    ACWR > 1.5 = HIGH injury risk
    ACWR 1.3-1.5 = MODERATE risk
    ACWR < 1.3 = LOW risk
    """
    now = datetime.utcnow()
    acute_cutoff = now - timedelta(days=7)
    chronic_cutoff = now - timedelta(days=28)

    acute_workouts = [w for w in workouts if w.workout_date and w.workout_date >= acute_cutoff]
    chronic_workouts = [w for w in workouts if w.workout_date and w.workout_date >= chronic_cutoff]

    acute_load = sum(_calculate_session_load(w) for w in acute_workouts)
    chronic_total = sum(_calculate_session_load(w) for w in chronic_workouts)

    # Add ambulatory load from steps/stairs
    ambulatory_acute = 0
    ambulatory_chronic = 0
    if step_data:
        for day_key, data in step_data.items():
            day_load = _steps_to_load(data.get("steps", 0), data.get("stairs", 0))
            if day_key >= acute_cutoff.date():
                ambulatory_acute += day_load
            if day_key >= chronic_cutoff.date():
                ambulatory_chronic += day_load
        acute_load += ambulatory_acute
        chronic_total += ambulatory_chronic

    # Calculate actual weeks of data available (min 1, max 4)
    # This prevents inflated ACWR when only 1-2 weeks of data exist
    if chronic_workouts:
        oldest_chronic = min(w.workout_date for w in chronic_workouts if w.workout_date)
        days_of_data = (now - oldest_chronic).days
        weeks_of_data = max(1, min(4, (days_of_data + 6) // 7))  # Round up to nearest week, cap at 4
    else:
        weeks_of_data = 4
    chronic_load = chronic_total / weeks_of_data if chronic_total > 0 else 0

    if chronic_load > 0:
        acwr = acute_load / chronic_load
    elif acute_load == 0:
        acwr = 1.0  # No training at all
    else:
        # No chronic baseline yet - can't compute meaningful ratio
        # Treat as baseline-building, not a spike
        acwr = 1.0

    notes = []
    spike_detected = False
    no_baseline = chronic_load == 0 and acute_load > 0
    acute_sessions = len(acute_workouts)
    chronic_sessions = len(chronic_workouts)

    if no_baseline:
        risk_level = "LOW"
        notes.append(f"Building training baseline ({acute_sessions} session{'s' if acute_sessions != 1 else ''} this week). Need 3-4 weeks of data for accurate load tracking.")
    elif acwr > 1.5:
        risk_level = "HIGH"
        spike_detected = True
        notes.append(f"This week's load ({acute_load:.0f} pts) is {acwr:.1f}x your {weeks_of_data}-week average ({chronic_load:.0f} pts/wk). Rapid increases above 1.5x are associated with higher soft-tissue injury risk.")
    elif acwr > 1.3:
        risk_level = "MODERATE"
        notes.append(f"This week's load ({acute_load:.0f} pts) is {acwr:.1f}x your {weeks_of_data}-week average ({chronic_load:.0f} pts/wk). Slightly elevated - monitor for fatigue.")
    elif acwr < 0.8:
        risk_level = "LOW"
        notes.append(f"This week's load ({acute_load:.0f} pts) is only {acwr:.1f}x your {weeks_of_data}-week average ({chronic_load:.0f} pts/wk). Training volume dropping - detraining may occur.")
    else:
        risk_level = "LOW"
        notes.append(f"This week's load ({acute_load:.0f} pts) is {acwr:.1f}x your {weeks_of_data}-week average ({chronic_load:.0f} pts/wk). Well balanced.")

    # Note ambulatory load contribution if significant
    if step_data and ambulatory_acute > 0:
        avg_daily_steps = sum(d.get("steps", 0) for d in step_data.values()) / max(len(step_data), 1)
        avg_daily_stairs = sum(d.get("stairs", 0) for d in step_data.values()) / max(len(step_data), 1)
        parts = []
        if avg_daily_steps > 0:
            parts.append(f"{avg_daily_steps:,.0f} steps/day")
        if avg_daily_stairs > 0:
            parts.append(f"{avg_daily_stairs:.0f} flights/day")
        if parts:
            notes.append(f"Ambulatory load included: {', '.join(parts)} ({ambulatory_acute:.0f} pts this week)")

    # Calculate monotony (standard deviation of daily loads)
    monotony = None
    if len(chronic_workouts) >= 7 or (step_data and len(step_data) >= 7):
        daily_loads = {}
        for w in chronic_workouts:
            day_key = w.workout_date.date() if w.workout_date else None
            if day_key:
                daily_loads[day_key] = daily_loads.get(day_key, 0) + _calculate_session_load(w)
        # Add step/stair loads to daily totals
        if step_data:
            for day_key, data in step_data.items():
                if day_key >= chronic_cutoff.date():
                    day_load = _steps_to_load(data.get("steps", 0), data.get("stairs", 0))
                    daily_loads[day_key] = daily_loads.get(day_key, 0) + day_load

        if len(daily_loads) >= 5:
            loads = list(daily_loads.values())
            mean_load = sum(loads) / len(loads)
            variance = sum((l - mean_load) ** 2 for l in loads) / len(loads)
            std_dev = variance ** 0.5
            if std_dev > 0:
                monotony = mean_load / std_dev
                if monotony > 2.0:
                    notes.append(f"High training monotony ({monotony:.1f}) - increase variety")

    return TrainingLoadAnalysis(
        acute_load=round(acute_load, 1),
        chronic_load=round(chronic_load, 1),
        acwr=round(acwr, 2),
        risk_level=risk_level,
        spike_detected=spike_detected,
        monotony=round(monotony, 1) if monotony else None,
        weeks_of_data=weeks_of_data,
        notes=notes
    )


# ============================================
# Body Composition (Context Only)
# ============================================

def _get_body_composition_context(
    member: TeamMember,
    vitals: List[MemberVitalsLog]
) -> Dict[str, Any]:
    """
    Get body composition context (NOT used in daily readiness scoring).

    This is long-term health context only.
    Skipped for children under MIN_AGE_BODY_COMPOSITION as the Marine Corps
    taping method is not validated for pediatric use.
    """
    age = _get_age_from_birthdate(member.birth_date)
    if age is not None and age < MIN_AGE_BODY_COMPOSITION:
        return {
            "body_fat_pct": None,
            "within_standards": None,
            "note": "Body composition analysis not applicable for children"
        }

    height = member.height_inches
    latest_waist = _get_latest_vital(vitals, VitalType.WAIST)
    latest_neck = _get_latest_vital(vitals, VitalType.NECK)
    latest_hip = _get_latest_vital(vitals, VitalType.HIP)

    result = {
        "body_fat_pct": None,
        "within_standards": None,
        "note": "Context only - does not affect daily readiness"
    }

    if height and latest_waist and latest_neck:
        waist = latest_waist.value
        neck = latest_neck.value
        hip = latest_hip.value if latest_hip else None
        is_female = member.gender == Gender.FEMALE if member.gender else False

        if is_female and not hip:
            result["note"] = "Female body fat calculation requires hip measurement"
        else:
            bf_pct = _calculate_body_fat_taping(height, waist, neck, hip, is_female)
            if bf_pct is not None:
                age = _get_age_from_birthdate(member.birth_date)
                max_bf = _get_bf_standard(age, is_female)
                result["body_fat_pct"] = round(bf_pct, 1)
                result["within_standards"] = bf_pct <= max_bf
                result["standard"] = max_bf

    return result


# ============================================
# Subjective Integration
# ============================================

def _integrate_subjective(
    objective_score: float,
    subjective_fatigue: Optional[int] = None,
    pain_severity: Optional[int] = None,
    pain_location: Optional[str] = None,
    sleep_hours: Optional[float] = None,
    sleep_quality: Optional[int] = None
) -> Tuple[float, List[str]]:
    """
    Integrate subjective inputs into readiness score.

    Subjective inputs can LOWER readiness but not artificially raise it.
    """
    modifiers = []

    if subjective_fatigue is not None:
        if subjective_fatigue >= 7:
            modifiers.append(("High subjective fatigue reported", -10))
        elif subjective_fatigue >= 5:
            modifiers.append(("Moderate fatigue reported", -5))

    if pain_severity is not None:
        if pain_severity >= 6:
            loc = f": {pain_location}" if pain_location else ""
            modifiers.append((f"Pain reported (severity {pain_severity}/10){loc}", -15))
        elif pain_severity >= 3:
            loc = f": {pain_location}" if pain_location else ""
            modifiers.append((f"Minor pain reported{loc}", -5))

    if sleep_hours is not None:
        if sleep_hours < 5:
            modifiers.append(("Severe sleep deficit (<5 hours)", -10))
        elif sleep_hours < 6:
            modifiers.append(("Sleep deficit (<6 hours)", -5))

    if sleep_quality is not None:
        if sleep_quality <= 2:
            modifiers.append(("Poor sleep quality reported", -5))

    total_modifier = sum(m[1] for m in modifiers)
    adjusted_score = max(0, objective_score + total_modifier)

    return adjusted_score, [m[0] for m in modifiers]


# ============================================
# Risk Flag Generation
# ============================================

def _generate_risk_flags(
    indicators: List[PerformanceIndicator],
    medical_safety: MedicalSafetyResult,
    training_load: Optional[TrainingLoadAnalysis]
) -> List[RiskFlag]:
    """Generate risk flags from all analysis components"""
    flags = []

    # Medical safety flags
    if medical_safety.status == "RED":
        flags.append(RiskFlag(
            code="medical_red",
            severity="critical",
            title="Medical Safety RED",
            explanation="; ".join(medical_safety.flags),
            recommendation=medical_safety.action,
            source="medical"
        ))
    elif medical_safety.status == "AMBER":
        flags.append(RiskFlag(
            code="medical_amber",
            severity="moderate",
            title="Medical Safety AMBER",
            explanation="; ".join(medical_safety.flags),
            recommendation=medical_safety.action or "Monitor and follow up",
            source="medical"
        ))

    # Indicator-based flags
    for ind in indicators:
        if ind.value < 60:
            severity = "high" if ind.value < 40 else "moderate"
            flags.append(RiskFlag(
                code=f"low_{ind.category}",
                severity=severity,
                title=f"Low {ind.name} Score",
                explanation="; ".join(ind.contributing_factors[:2]),
                recommendation=_get_recommendation(ind.category, severity),
                source="physical"
            ))
        elif ind.value < 75 and ind.confidence != "LOW":
            flags.append(RiskFlag(
                code=f"borderline_{ind.category}",
                severity="low",
                title=f"Borderline {ind.name}",
                explanation="; ".join(ind.contributing_factors[:2]),
                recommendation=_get_recommendation(ind.category, "low"),
                source="physical"
            ))

    # Training load flags
    if training_load:
        if training_load.spike_detected:
            flags.append(RiskFlag(
                code="training_spike",
                severity="moderate",
                title="Training Load Spike",
                explanation=f"Your Acute-to-Chronic Workload Ratio (ACWR) is {training_load.acwr:.2f}. This means your training this week is {training_load.acwr:.1f}x higher than your {training_load.weeks_of_data}-week average. Research shows ratios above 1.5 correlate with increased soft-tissue injury risk.",
                recommendation="Reduce training intensity for 2-3 days. Focus on recovery (sleep, hydration, light movement). Gradual load increases of 10-15% per week are safer.",
                source="physical"
            ))

    return flags


def _get_recommendation(category: str, severity: str) -> str:
    """Get recommendation based on category and severity"""
    recommendations = {
        "autonomic": {
            "low": "Your resting heart rate is slightly elevated. Try to get extra sleep tonight and limit caffeine/alcohol.",
            "moderate": "Your autonomic recovery markers suggest incomplete recovery. Prioritize 7-9 hours of sleep and consider a lighter training day.",
            "high": "Your body is showing signs of significant stress or poor recovery. Take a rest day, evaluate sleep quality, hydration, and recent stressors."
        },
        "cardiovascular": {
            "low": "Blood pressure readings are slightly outside normal range. Reduce sodium intake and stay hydrated.",
            "moderate": "Blood pressure or oxygen levels are concerning. Consider scheduling a checkup with your healthcare provider.",
            "high": "Cardiovascular readings are significantly abnormal. Seek medical evaluation before resuming intense exercise."
        },
        "illness": {
            "low": "Minor signs detected (slight temperature change, etc.). Stay hydrated and monitor how you feel over the next 24 hours.",
            "moderate": "Your vitals suggest your immune system may be fighting something. Rest, hydrate well, and avoid hard training until symptoms resolve.",
            "high": "Strong indicators of illness detected. Rest is required - training while sick delays recovery and increases complication risk."
        },
        "training_load": {
            "low": "Your training volume has been inconsistent. Try to maintain a regular schedule to build a sustainable fitness base.",
            "moderate": "Training load is moderately elevated. Consider a lighter session or active recovery (walking, stretching, yoga).",
            "high": "Training load has spiked significantly. Reduce intensity for 2-3 days to prevent overuse injuries. Focus on sleep and nutrition."
        }
    }
    return recommendations.get(category, {}).get(severity, "Monitor and reassess")


# ============================================
# Main Analysis Entry Point
# ============================================

async def analyze_readiness(
    member_id: int,
    db: AsyncSession,
    lookback_days: int = 35,
    update_member: bool = True,
    subjective_fatigue: Optional[int] = None,
    pain_severity: Optional[int] = None,
    pain_location: Optional[str] = None,
    sleep_hours: Optional[float] = None,
    sleep_quality: Optional[int] = None,
    context_factors: Optional[List[str]] = None
) -> ReadinessAnalysis:
    """
    Main entry point for readiness analysis.

    Two-track system:
    1. Medical Safety (hard gate) - RED medical = RED overall
    2. Performance Readiness - autonomic, training load, illness patterns

    Includes subjective input integration and full explainability.
    """
    # Fetch member
    result = await db.execute(select(TeamMember).where(TeamMember.id == member_id))
    member = result.scalar_one_or_none()

    if not member:
        raise ValueError(f"Member {member_id} not found")

    # Calculate age for age-appropriate vital ranges
    member_age = _get_age_from_birthdate(member.birth_date)

    # Fetch all vitals for analysis
    baseline_cutoff = datetime.utcnow() - timedelta(days=max(lookback_days, LONG_BASELINE_DAYS + 7))
    vitals_result = await db.execute(
        select(MemberVitalsLog)
        .where(and_(
            MemberVitalsLog.member_id == member_id,
            MemberVitalsLog.recorded_at >= baseline_cutoff
        ))
        .order_by(desc(MemberVitalsLog.recorded_at))
    )
    all_vitals = list(vitals_result.scalars().all())

    # Recent vitals (7 days)
    recent_cutoff = datetime.utcnow() - timedelta(days=7)
    recent_vitals = [v for v in all_vitals if v.recorded_at >= recent_cutoff]

    # Fetch workouts for training load
    workout_cutoff = datetime.utcnow() - timedelta(days=28)
    workouts_result = await db.execute(
        select(MemberWorkout)
        .where(and_(
            MemberWorkout.member_id == member_id,
            MemberWorkout.is_active == True,
            MemberWorkout.workout_date >= workout_cutoff
        ))
        .order_by(desc(MemberWorkout.workout_date))
    )
    workouts = list(workouts_result.scalars().all())

    # Track data sources used
    data_sources = []
    if recent_vitals:
        vital_types = set(v.vital_type.value for v in recent_vitals)
        data_sources.extend(vital_types)
    if workouts:
        data_sources.append("workouts")
    if any([subjective_fatigue, pain_severity, sleep_hours]):
        data_sources.append("subjective")

    # ============================================
    # TRACK 1: Medical Safety (Hard Gate)
    # ============================================
    medical_safety = _assess_medical_safety(recent_vitals, context_factors, age=member_age)

    # ============================================
    # TRACK 2: Performance Readiness
    # ============================================

    # Analyze each component (pass age for age-appropriate thresholds)
    autonomic = _analyze_autonomic_recovery(recent_vitals, all_vitals)
    cardiovascular = _analyze_cardiovascular(recent_vitals, age=member_age)
    illness = _detect_illness_pattern(recent_vitals, all_vitals, age=member_age)

    # Gather step/stair data for training load
    step_data = {}
    for v in all_vitals:
        if v.vital_type in (VitalType.STEPS, VitalType.STAIRS_CLIMBED):
            day_key = v.recorded_at.date() if v.recorded_at else None
            if day_key:
                if day_key not in step_data:
                    step_data[day_key] = {"steps": 0, "stairs": 0}
                if v.vital_type == VitalType.STEPS:
                    step_data[day_key]["steps"] = max(step_data[day_key]["steps"], v.value or 0)
                elif v.vital_type == VitalType.STAIRS_CLIMBED:
                    step_data[day_key]["stairs"] = max(step_data[day_key]["stairs"], v.value or 0)

    # Training load analysis (workouts + steps/stairs)
    training_load = None
    has_activity_data = workouts or step_data
    if has_activity_data:
        training_load = _analyze_training_load(workouts, step_data=step_data if step_data else None)

    indicators = [autonomic, cardiovascular, illness]

    # Calculate performance score (weighted)
    # Autonomic: 45%, Illness: 30%, Cardiovascular: 25%
    performance_score = (
        autonomic.value * 0.45 +
        illness.value * 0.30 +
        cardiovascular.value * 0.25
    )

    # Apply training load penalty if spike detected
    training_penalty = 0
    if training_load and training_load.spike_detected:
        training_penalty = 10
        performance_score = max(0, performance_score - training_penalty)

    # Integrate subjective inputs
    subjective_factors = []
    if any([subjective_fatigue, pain_severity, sleep_hours, sleep_quality]):
        performance_score, subjective_factors = _integrate_subjective(
            performance_score,
            subjective_fatigue=subjective_fatigue,
            pain_severity=pain_severity,
            pain_location=pain_location,
            sleep_hours=sleep_hours,
            sleep_quality=sleep_quality
        )

    # ============================================
    # Combine Medical Safety + Performance
    # ============================================

    # Medical Safety is a HARD GATE
    if medical_safety.status == "RED":
        overall_status = "RED"
        overall_score = min(performance_score, 40)
    elif medical_safety.status == "AMBER":
        # Amber medical doesn't force overall amber, but caps score
        overall_score = min(performance_score, 75)
        overall_status = "RED" if overall_score < 60 else ("AMBER" if overall_score < 80 else "AMBER")
    else:
        overall_score = performance_score
        if overall_score < 60:
            overall_status = "RED"
        elif overall_score < 80:
            overall_status = "AMBER"
        else:
            overall_status = "GREEN"


    # ============================================
    # Build Primary Drivers (Explainability)
    # ============================================

    primary_drivers = []

    # Medical flags always go first
    if medical_safety.flags:
        for flag in medical_safety.flags[:2]:
            primary_drivers.append(f"Medical: {flag}")

    # Add top contributing factors from lowest-scoring indicators
    sorted_indicators = sorted(indicators, key=lambda x: x.value)
    for ind in sorted_indicators[:2]:
        if ind.value < 85 and ind.contributing_factors:
            primary_drivers.append(ind.contributing_factors[0])

    # Training load driver
    if training_load and training_load.spike_detected:
        primary_drivers.append(f"Training spike: this week's load is {training_load.acwr:.1f}x your average (above 1.5x threshold)")

    # Subjective factors
    for sf in subjective_factors[:2]:
        primary_drivers.append(sf)

    if not primary_drivers:
        primary_drivers.append("All indicators within normal range")

    # Limit to top 4 drivers
    primary_drivers = primary_drivers[:4]

    # ============================================
    # Data Quality Assessment
    # ============================================

    total_datapoints = len(all_vitals)
    days_with_data = len(set(v.recorded_at.date() for v in all_vitals)) if all_vitals else 0

    overall_confidence = "LOW"
    if total_datapoints >= MIN_DATAPOINTS_HIGH:
        overall_confidence = "HIGH"
    elif total_datapoints >= MIN_DATAPOINTS_MEDIUM:
        overall_confidence = "MEDIUM"

    data_quality_note = f"Based on {total_datapoints} datapoints over {days_with_data} days"
    if overall_confidence == "LOW":
        data_quality_note += " - limited data, conservative assessment"

    # Count vitals in specific time windows
    cutoff_7d = datetime.utcnow() - timedelta(days=7)
    cutoff_30d = datetime.utcnow() - timedelta(days=30)
    data_points_7d = len([v for v in all_vitals if v.recorded_at >= cutoff_7d])
    data_points_30d = len([v for v in all_vitals if v.recorded_at >= cutoff_30d])

    # Check taping method availability (waist + neck required, hip for females)
    recent_vital_types = set(v.vital_type.value for v in all_vitals) if all_vitals else set()
    has_waist = "waist" in recent_vital_types
    has_neck = "neck" in recent_vital_types
    is_female = member.gender == Gender.FEMALE if member.gender else False
    if is_female:
        taping_available = has_waist and has_neck and ("hip" in recent_vital_types)
    else:
        taping_available = has_waist and has_neck

    # Determine missing vitals (key types used in readiness assessment)
    key_vital_types = ["resting_heart_rate", "blood_pressure", "blood_oxygen", "temperature"]
    vitals_missing = [vt for vt in key_vital_types if vt not in recent_vital_types]

    data_quality = {
        "total_datapoints": total_datapoints,
        "days_with_data": days_with_data,
        "workouts_28d": len(workouts),
        "confidence": overall_confidence,
        "data_points_7d": data_points_7d,
        "data_points_30d": data_points_30d,
        "taping_available": taping_available,
        "vitals_missing": vitals_missing,
    }

    # ============================================
    # Generate Risk Flags
    # ============================================

    risk_flags = _generate_risk_flags(indicators, medical_safety, training_load)

    # ============================================
    # Update Member (if requested)
    # ============================================

    member_updated = False
    if update_member:
        # Convert string to enum
        if overall_status == "GREEN":
            member.overall_readiness = ReadinessStatus.GREEN
        elif overall_status == "AMBER":
            member.overall_readiness = ReadinessStatus.AMBER
        else:
            member.overall_readiness = ReadinessStatus.RED

        # Save all readiness scores
        member.readiness_score = round(overall_score, 1)
        member.performance_readiness_score = round(performance_score, 1)
        member.medical_safety_status = medical_safety.status
        member.readiness_notes = f"Auto-calculated: {overall_status} (score: {overall_score:.0f}) as of {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}"
        await db.commit()
        member_updated = True
        logger.info(f"Updated member {member_id} overall_readiness to {overall_status} (score: {overall_score:.0f})")

    return ReadinessAnalysis(
        overall_status=overall_status,
        score=round(overall_score, 1),
        confidence=overall_confidence,
        primary_drivers=primary_drivers,
        data_sources_used=list(set(data_sources)),
        data_quality_note=data_quality_note,
        medical_safety=medical_safety,
        performance_readiness=round(performance_score, 1),
        training_load=training_load,
        subjective_factors=subjective_factors,
        indicators=indicators,
        risk_flags=risk_flags,
        data_quality=data_quality,
        analyzed_at=datetime.utcnow().isoformat(),
        member_updated=member_updated
    )
