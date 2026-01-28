"""
Performance-Readiness Analysis Service

Combines physical readiness (from vitals/training data) with medical readiness
to calculate overall readiness status (GREEN/AMBER/RED).

Uses Marine Corps taping method for body composition - NO BMI.
"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc
from loguru import logger
import math

from models.team import (
    TeamMember, MemberVitalsLog, MemberWeightLog, MemberTraining, MemberTrainingLog,
    VitalType, ReadinessStatus, Gender
)


@dataclass
class PerformanceIndicator:
    """Individual performance metric with score and explanation"""
    name: str                      # e.g., "Autonomic Recovery", "Physical Readiness"
    category: str                  # physical, medical, autonomic, cardiovascular, illness, body_composition
    value: float                   # 0-100 score
    trend: str                     # improving, stable, declining, insufficient_data
    explanation: str
    confidence: float              # 0-1
    contributing_factors: List[str] = field(default_factory=list)


@dataclass
class RiskFlag:
    """Warning flag for concerning indicators"""
    code: str                      # e.g., "elevated_rhr", "medical_red"
    severity: str                  # low, moderate, high, critical
    title: str
    explanation: str
    recommendation: Optional[str]
    source: str                    # "physical" or "medical"


@dataclass
class ReadinessAnalysis:
    """Complete readiness analysis result"""
    overall_status: str            # GREEN, AMBER, RED
    physical_status: str           # GREEN, AMBER, RED
    medical_status: str            # GREEN, AMBER, RED
    score: float                   # 0-100
    confidence: float              # 0-1
    explanation: str
    primary_drivers: List[str]     # Top reasons for status
    indicators: List[PerformanceIndicator] = field(default_factory=list)
    risk_flags: List[RiskFlag] = field(default_factory=list)
    data_quality: Dict[str, Any] = field(default_factory=dict)
    analyzed_at: str = ""
    member_updated: bool = False


# ACE Fitness body fat standards (max for "Normal/Acceptable" category)
# Source: American Council on Exercise
# Males: Essential 2-5%, Athletes 6-13%, Fitness 14-17%, Acceptable 18-24%, Overweight 25%+
# Females: Essential 10-13%, Athletes 14-20%, Fitness 21-24%, Acceptable 25-31%, Overweight 32%+
ACE_BF_STANDARDS_MALE = {
    (17, 999): 24  # Max for "Normal" category (all ages same for general fitness)
}

ACE_BF_STANDARDS_FEMALE = {
    (17, 999): 31  # Max for "Normal" category
}


def _get_age_from_birthdate(birth_date: Optional[datetime]) -> Optional[int]:
    """Calculate age from birthdate"""
    if not birth_date:
        return None
    today = datetime.now()
    age = today.year - birth_date.year
    if (today.month, today.day) < (birth_date.month, birth_date.day):
        age -= 1
    return age


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

    Returns body fat percentage or None if measurements missing.
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

    return max(0, min(60, bf))  # Clamp to reasonable range


def _get_bf_standard(age: Optional[int], is_female: bool) -> float:
    """Get max allowable body fat % for age/gender (ACE fitness standards)"""
    standards = ACE_BF_STANDARDS_FEMALE if is_female else ACE_BF_STANDARDS_MALE
    if not age:
        age = 30  # Default

    for (min_age, max_age), max_bf in standards.items():
        if min_age <= age <= max_age:
            return max_bf
    return 24 if not is_female else 31  # Default to standard max


def _calculate_rolling_baseline(
    vitals: List[MemberVitalsLog],
    vital_type: VitalType,
    window_days: int = 7
) -> Optional[float]:
    """Calculate 7-day rolling average for baseline comparison"""
    cutoff = datetime.utcnow() - timedelta(days=window_days)
    relevant = [v for v in vitals if v.vital_type == vital_type and v.recorded_at >= cutoff]

    if not relevant:
        return None

    return sum(v.value for v in relevant) / len(relevant)


def _get_latest_vital(vitals: List[MemberVitalsLog], vital_type: VitalType) -> Optional[MemberVitalsLog]:
    """Get most recent vital of a specific type"""
    matching = [v for v in vitals if v.vital_type == vital_type]
    if not matching:
        return None
    return max(matching, key=lambda v: v.recorded_at)


def _analyze_autonomic_recovery(
    vitals: List[MemberVitalsLog],
    all_vitals: List[MemberVitalsLog]
) -> PerformanceIndicator:
    """
    Analyze autonomic recovery from RHR and HRV.

    RHR: +5 bpm = AMBER, +10 bpm = RED (vs baseline)
    HRV: -15% = AMBER, -25% = RED (vs baseline)
    """
    factors = []
    rhr_score = 100
    hrv_score = 100
    confidence = 0.0

    # Get current and baseline RHR (prefer RESTING_HEART_RATE, fall back to HEART_RATE)
    latest_rhr = _get_latest_vital(vitals, VitalType.RESTING_HEART_RATE)
    baseline_rhr = _calculate_rolling_baseline(all_vitals, VitalType.RESTING_HEART_RATE, 30)
    # Fall back to regular heart rate if no resting HR data
    if not latest_rhr:
        latest_rhr = _get_latest_vital(vitals, VitalType.HEART_RATE)
        baseline_rhr = _calculate_rolling_baseline(all_vitals, VitalType.HEART_RATE, 30)

    if latest_rhr and baseline_rhr:
        diff = latest_rhr.value - baseline_rhr
        if diff >= 10:
            rhr_score = 40
            factors.append(f"RHR elevated +{diff:.0f} bpm (RED)")
        elif diff >= 5:
            rhr_score = 70
            factors.append(f"RHR elevated +{diff:.0f} bpm (AMBER)")
        elif diff <= -5:
            rhr_score = 100
            factors.append(f"RHR improved {diff:.0f} bpm")
        confidence += 0.4

    # Get current and baseline HRV
    latest_hrv = _get_latest_vital(vitals, VitalType.HRV)
    baseline_hrv = _calculate_rolling_baseline(all_vitals, VitalType.HRV, 30)

    if latest_hrv and baseline_hrv and baseline_hrv > 0:
        pct_change = ((latest_hrv.value - baseline_hrv) / baseline_hrv) * 100
        if pct_change <= -25:
            hrv_score = 40
            factors.append(f"HRV down {abs(pct_change):.0f}% (RED)")
        elif pct_change <= -15:
            hrv_score = 70
            factors.append(f"HRV down {abs(pct_change):.0f}% (AMBER)")
        elif pct_change >= 10:
            hrv_score = 100
            factors.append(f"HRV improved +{pct_change:.0f}%")
        confidence += 0.4

    # Weight RHR more heavily (it's more reliable)
    final_score = (rhr_score * 0.6 + hrv_score * 0.4) if confidence > 0 else 85
    confidence = min(confidence, 1.0)

    trend = "insufficient_data"
    if confidence >= 0.4:
        if final_score >= 90:
            trend = "stable"
        elif final_score >= 70:
            trend = "stable"
        else:
            trend = "declining"

    explanation = "Autonomic nervous system recovery indicators"
    if not factors:
        explanation = "Insufficient RHR/HRV data for baseline comparison"
        final_score = 85  # Conservative default
        confidence = 0.3

    return PerformanceIndicator(
        name="Autonomic Recovery",
        category="autonomic",
        value=final_score,
        trend=trend,
        explanation=explanation,
        confidence=confidence,
        contributing_factors=factors
    )


def _analyze_cardiovascular(
    vitals: List[MemberVitalsLog]
) -> PerformanceIndicator:
    """
    Analyze cardiovascular health from BP and SpO2.

    BP Categories (AHA):
    - Normal: <120/<80
    - Elevated: 120-129/<80
    - Stage 1: 130-139/80-89
    - Stage 2: >=140/>=90

    SpO2: <95% = concern, <92% = critical
    """
    factors = []
    bp_score = 100
    spo2_score = 100
    confidence = 0.0

    # Blood Pressure
    latest_bp = _get_latest_vital(vitals, VitalType.BLOOD_PRESSURE)
    if latest_bp:
        sys = latest_bp.value
        dia = latest_bp.value_secondary or 80

        if sys >= 140 or dia >= 90:
            bp_score = 50
            factors.append(f"BP Stage 2: {sys:.0f}/{dia:.0f}")
        elif sys >= 130 or dia >= 80:
            bp_score = 70
            factors.append(f"BP Stage 1: {sys:.0f}/{dia:.0f}")
        elif sys >= 120:
            bp_score = 85
            factors.append(f"BP Elevated: {sys:.0f}/{dia:.0f}")
        else:
            factors.append(f"BP Normal: {sys:.0f}/{dia:.0f}")
        confidence += 0.5

    # Blood Oxygen
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
            spo2_score = 85
            factors.append(f"SpO2 borderline: {spo2:.0f}%")
        else:
            factors.append(f"SpO2 normal: {spo2:.0f}%")
        confidence += 0.4

    final_score = min(bp_score, spo2_score) if confidence > 0 else 85
    confidence = min(confidence, 1.0)

    trend = "stable" if final_score >= 70 else "declining"
    if confidence < 0.3:
        trend = "insufficient_data"

    return PerformanceIndicator(
        name="Cardiovascular",
        category="cardiovascular",
        value=final_score,
        trend=trend,
        explanation="Blood pressure and oxygen saturation",
        confidence=confidence,
        contributing_factors=factors
    )


def _analyze_illness_indicators(
    vitals: List[MemberVitalsLog],
    all_vitals: List[MemberVitalsLog]
) -> PerformanceIndicator:
    """
    Detect potential illness from temperature, respiratory rate, and RHR.

    Fever: >99.5°F with elevated RHR = flag
    Respiratory: >20/min = concern, >25/min = flag
    """
    factors = []
    score = 100
    confidence = 0.0

    # Temperature
    latest_temp = _get_latest_vital(vitals, VitalType.TEMPERATURE)
    if latest_temp:
        temp = latest_temp.value
        if temp >= 100.4:
            score = min(score, 40)
            factors.append(f"Fever: {temp:.1f}°F")
        elif temp >= 99.5:
            # Check for elevated RHR too (prefer resting HR)
            latest_rhr = _get_latest_vital(vitals, VitalType.RESTING_HEART_RATE)
            baseline_rhr = _calculate_rolling_baseline(all_vitals, VitalType.RESTING_HEART_RATE, 30)
            if not latest_rhr:
                latest_rhr = _get_latest_vital(vitals, VitalType.HEART_RATE)
                baseline_rhr = _calculate_rolling_baseline(all_vitals, VitalType.HEART_RATE, 30)
            if latest_rhr and baseline_rhr and latest_rhr.value > baseline_rhr + 5:
                score = min(score, 60)
                factors.append(f"Low-grade fever ({temp:.1f}°F) with elevated HR")
            else:
                score = min(score, 80)
                factors.append(f"Elevated temp: {temp:.1f}°F")
        confidence += 0.4

    # Respiratory Rate
    latest_rr = _get_latest_vital(vitals, VitalType.RESPIRATORY_RATE)
    if latest_rr:
        rr = latest_rr.value
        if rr >= 25:
            score = min(score, 50)
            factors.append(f"Respiratory rate high: {rr:.0f}/min")
        elif rr >= 20:
            score = min(score, 75)
            factors.append(f"Respiratory rate elevated: {rr:.0f}/min")
        confidence += 0.3

    if not factors:
        factors.append("No illness indicators detected")

    trend = "stable" if score >= 80 else "declining"
    if confidence < 0.3:
        trend = "insufficient_data"
        score = 95  # Assume healthy if no data

    return PerformanceIndicator(
        name="Illness Risk",
        category="illness",
        value=score,
        trend=trend,
        explanation="Temperature and respiratory indicators",
        confidence=max(confidence, 0.3),
        contributing_factors=factors
    )


def _analyze_body_composition(
    member: TeamMember,
    vitals: List[MemberVitalsLog]
) -> PerformanceIndicator:
    """
    Analyze body composition using Marine Corps taping method.
    NO BMI - only tape measurements.
    """
    factors = []
    score = 85  # Default if no data
    confidence = 0.3

    # Get measurements
    height = member.height_inches
    latest_waist = _get_latest_vital(vitals, VitalType.WAIST)
    latest_neck = _get_latest_vital(vitals, VitalType.NECK)
    latest_hip = _get_latest_vital(vitals, VitalType.HIP)

    # Try to calculate body fat via taping
    if height and latest_waist and latest_neck:
        waist = latest_waist.value
        neck = latest_neck.value
        hip = latest_hip.value if latest_hip else None

        # Use member's gender for formula selection and standards
        is_female = member.gender == Gender.FEMALE if member.gender else False

        # Female formula requires hip measurement
        if is_female and not hip:
            factors.append("Female body fat calculation requires hip measurement")
        else:
            bf_pct = _calculate_body_fat_taping(height, waist, neck, hip, is_female)

            if bf_pct is not None:
                age = _get_age_from_birthdate(member.birth_date)
                max_bf = _get_bf_standard(age, is_female)

                if bf_pct > max_bf + 5:
                    score = 50
                    factors.append(f"Body fat {bf_pct:.1f}% exceeds standard ({max_bf}%) by >5%")
                elif bf_pct > max_bf:
                    score = 70
                    factors.append(f"Body fat {bf_pct:.1f}% exceeds standard ({max_bf}%)")
                elif bf_pct <= max_bf - 5:
                    score = 100
                    factors.append(f"Body fat {bf_pct:.1f}% well within standard ({max_bf}%)")
                else:
                    score = 90
                    factors.append(f"Body fat {bf_pct:.1f}% within standard ({max_bf}%)")

                confidence = 0.8
            else:
                factors.append("Taping calculation failed - check measurements")
    else:
        missing = []
        if not height:
            missing.append("height")
        if not latest_waist:
            missing.append("waist")
        if not latest_neck:
            missing.append("neck")
        factors.append(f"Missing measurements: {', '.join(missing)}")

    trend = "insufficient_data" if confidence < 0.5 else "stable"

    return PerformanceIndicator(
        name="Body Composition",
        category="body_composition",
        value=score,
        trend=trend,
        explanation="Body fat via taping method, assessed against ACE fitness standards",
        confidence=confidence,
        contributing_factors=factors
    )


def _generate_risk_flags(
    indicators: List[PerformanceIndicator],
    medical_status: ReadinessStatus
) -> List[RiskFlag]:
    """Generate risk flags from indicators and medical status"""
    flags = []

    # Check each indicator for concerning values
    for ind in indicators:
        if ind.value < 60:
            severity = "high" if ind.value < 40 else "moderate"
            flags.append(RiskFlag(
                code=f"low_{ind.category}",
                severity=severity,
                title=f"Low {ind.name} Score",
                explanation="; ".join(ind.contributing_factors),
                recommendation=_get_recommendation(ind.category, severity),
                source="physical"
            ))
        elif ind.value < 75 and ind.confidence >= 0.5:
            flags.append(RiskFlag(
                code=f"borderline_{ind.category}",
                severity="low",
                title=f"Borderline {ind.name}",
                explanation="; ".join(ind.contributing_factors),
                recommendation=_get_recommendation(ind.category, "low"),
                source="physical"
            ))

    # Medical status flags
    if medical_status == ReadinessStatus.RED:
        flags.append(RiskFlag(
            code="medical_red",
            severity="critical",
            title="Medical Readiness RED",
            explanation="Member has critical medical status requiring attention",
            recommendation="Address medical issues before full duty",
            source="medical"
        ))
    elif medical_status == ReadinessStatus.AMBER:
        flags.append(RiskFlag(
            code="medical_amber",
            severity="moderate",
            title="Medical Readiness AMBER",
            explanation="Member has medical concerns requiring monitoring",
            recommendation="Monitor medical status and follow treatment plan",
            source="medical"
        ))

    return flags


def _get_recommendation(category: str, severity: str) -> str:
    """Get recommendation based on category and severity"""
    recommendations = {
        "autonomic": {
            "low": "Consider additional rest",
            "moderate": "Prioritize sleep and recovery",
            "high": "Recommend rest day, evaluate stressors"
        },
        "cardiovascular": {
            "low": "Monitor blood pressure",
            "moderate": "Consult healthcare provider about BP",
            "high": "Seek medical evaluation for cardiovascular concerns"
        },
        "illness": {
            "low": "Monitor symptoms",
            "moderate": "Rest and hydrate, monitor temperature",
            "high": "Rest required, consider medical evaluation"
        },
        "body_composition": {
            "low": "Review nutrition and exercise plan",
            "moderate": "Implement body composition improvement plan",
            "high": "Structured nutrition and training program recommended"
        }
    }
    return recommendations.get(category, {}).get(severity, "Monitor and reassess")


def _combine_readiness(physical: ReadinessStatus, medical: ReadinessStatus) -> ReadinessStatus:
    """
    Combine physical and medical readiness.
    Overall = worst of both (conservative approach)
    """
    if physical == ReadinessStatus.RED or medical == ReadinessStatus.RED:
        return ReadinessStatus.RED
    if physical == ReadinessStatus.AMBER or medical == ReadinessStatus.AMBER:
        return ReadinessStatus.AMBER
    return ReadinessStatus.GREEN


def _score_to_status(score: float) -> ReadinessStatus:
    """Convert numeric score to readiness status"""
    if score < 60:
        return ReadinessStatus.RED
    if score < 80:
        return ReadinessStatus.AMBER
    return ReadinessStatus.GREEN


async def analyze_readiness(
    member_id: int,
    db: AsyncSession,
    lookback_days: int = 30,
    update_member: bool = True
) -> ReadinessAnalysis:
    """
    Main entry point for readiness analysis.

    Calculates physical readiness from vitals/training, combines with medical
    readiness, and optionally updates member.overall_readiness.
    """
    # Fetch member
    result = await db.execute(select(TeamMember).where(TeamMember.id == member_id))
    member = result.scalar_one_or_none()

    if not member:
        raise ValueError(f"Member {member_id} not found")

    # Fetch vitals within lookback period
    cutoff = datetime.utcnow() - timedelta(days=lookback_days)
    vitals_result = await db.execute(
        select(MemberVitalsLog)
        .where(and_(
            MemberVitalsLog.member_id == member_id,
            MemberVitalsLog.recorded_at >= cutoff
        ))
        .order_by(desc(MemberVitalsLog.recorded_at))
    )
    vitals = list(vitals_result.scalars().all())

    # Fetch all vitals for baseline (longer period)
    baseline_cutoff = datetime.utcnow() - timedelta(days=90)
    all_vitals_result = await db.execute(
        select(MemberVitalsLog)
        .where(and_(
            MemberVitalsLog.member_id == member_id,
            MemberVitalsLog.recorded_at >= baseline_cutoff
        ))
        .order_by(desc(MemberVitalsLog.recorded_at))
    )
    all_vitals = list(all_vitals_result.scalars().all())

    # Recent vitals (7 days) for current assessment
    recent_cutoff = datetime.utcnow() - timedelta(days=7)
    recent_vitals = [v for v in vitals if v.recorded_at >= recent_cutoff]

    # Analyze each component
    autonomic = _analyze_autonomic_recovery(recent_vitals, all_vitals)
    cardiovascular = _analyze_cardiovascular(recent_vitals)
    illness = _analyze_illness_indicators(recent_vitals, all_vitals)
    body_comp = _analyze_body_composition(member, vitals)

    # Calculate physical readiness score with weighting
    # Autonomic: 45%, Illness: 25%, Cardiovascular: 20%, Body Comp: 10%
    physical_score = (
        autonomic.value * 0.45 +
        illness.value * 0.25 +
        cardiovascular.value * 0.20 +
        body_comp.value * 0.10
    )

    # Calculate confidence (weighted average)
    physical_confidence = (
        autonomic.confidence * 0.45 +
        illness.confidence * 0.25 +
        cardiovascular.confidence * 0.20 +
        body_comp.confidence * 0.10
    )

    physical_status = _score_to_status(physical_score)

    # Get medical readiness (existing field)
    medical_status = member.medical_readiness or ReadinessStatus.GREEN
    medical_score = 100 if medical_status == ReadinessStatus.GREEN else (70 if medical_status == ReadinessStatus.AMBER else 40)

    # Combine for overall
    overall_status = _combine_readiness(physical_status, medical_status)
    overall_score = min(physical_score, medical_score)

    # Build indicators list
    indicators = [
        PerformanceIndicator(
            name="Physical Readiness",
            category="physical",
            value=physical_score,
            trend="stable" if physical_score >= 70 else "declining",
            explanation="Combined physical performance indicators",
            confidence=physical_confidence,
            contributing_factors=[f"Score: {physical_score:.0f}/100"]
        ),
        PerformanceIndicator(
            name="Medical Readiness",
            category="medical",
            value=medical_score,
            trend="stable",
            explanation=member.medical_readiness_notes or "Medical status from manual assessment",
            confidence=1.0,  # Manual entry is definitive
            contributing_factors=[f"Status: {medical_status.value}"]
        ),
        autonomic,
        cardiovascular,
        illness,
        body_comp
    ]

    # Generate risk flags
    risk_flags = _generate_risk_flags([autonomic, cardiovascular, illness, body_comp], medical_status)

    # Build primary drivers
    primary_drivers = []
    if physical_status != ReadinessStatus.GREEN:
        # Find lowest scoring physical indicator
        physical_indicators = [autonomic, cardiovascular, illness, body_comp]
        lowest = min(physical_indicators, key=lambda x: x.value)
        if lowest.contributing_factors:
            primary_drivers.append(f"Physical: {lowest.contributing_factors[0]}")

    if medical_status != ReadinessStatus.GREEN:
        primary_drivers.append(f"Medical: {medical_status.value} status")

    if not primary_drivers:
        primary_drivers.append("All indicators within normal range")

    # Data quality info
    vital_types_available = list(set(v.vital_type.value for v in vitals))
    all_vital_types = [vt.value for vt in VitalType]
    vital_types_missing = [vt for vt in all_vital_types if vt not in vital_types_available]

    # Check if taping method is available
    taping_available = (
        member.height_inches is not None and
        VitalType.WAIST.value in vital_types_available and
        VitalType.NECK.value in vital_types_available
    )

    data_quality = {
        "vitals_available": vital_types_available,
        "vitals_missing": vital_types_missing,
        "taping_available": taping_available,
        "data_points_7d": len(recent_vitals),
        "data_points_30d": len(vitals)
    }

    # Build explanation
    explanation = f"Physical readiness is {physical_status.value}"
    if physical_status != ReadinessStatus.GREEN:
        explanation += f" (score: {physical_score:.0f})"
    explanation += f". Medical readiness is {medical_status.value}."

    if len(vitals) < 5:
        explanation += " Limited data available - confidence is lower."

    # Update member if requested
    member_updated = False
    if update_member:
        member.overall_readiness = overall_status
        member.readiness_notes = f"Auto-calculated: Physical={physical_status.value}, Medical={medical_status.value} (as of {datetime.utcnow().strftime('%Y-%m-%d %H:%M')})"
        await db.commit()
        member_updated = True
        logger.info(f"Updated member {member_id} overall_readiness to {overall_status.value}")

    return ReadinessAnalysis(
        overall_status=overall_status.value,
        physical_status=physical_status.value,
        medical_status=medical_status.value,
        score=overall_score,
        confidence=physical_confidence,
        explanation=explanation,
        primary_drivers=primary_drivers,
        indicators=indicators,
        risk_flags=risk_flags,
        data_quality=data_quality,
        analyzed_at=datetime.utcnow().isoformat(),
        member_updated=member_updated
    )
