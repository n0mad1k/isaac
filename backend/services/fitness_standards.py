"""
Fitness Standards Service - Three-Tier Performance Classification

Implements gender/age-normalized performance scoring with three classification levels:
- CIVILIAN (0-69): General population fitness standards
- MARINE (70-89): Military-grade fitness (standard service requirements)
- SF (90-100): Special Forces / Elite operator fitness

Uses Marine Corps CFT-style age brackets for normalization.
"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, date
from enum import Enum
import math


class FitnessTier(str, Enum):
    CIVILIAN = "CIVILIAN"
    MARINE = "MARINE"
    SF = "SF"


class FitnessSubTier(str, Enum):
    # Civilian sub-tiers (0-69)
    BELOW_AVERAGE = "Below Average"  # 0-39
    AVERAGE = "Average"              # 40-54
    GOOD = "Good"                    # 55-64
    EXCELLENT = "Excellent"          # 65-69 (civilian excellent)

    # Marine sub-tiers (70-89)
    PASSING = "Passing"              # 70-74 (marine) or 90-93 (SF)
    HIGH = "High"                    # 75-82 (marine) or 94-96 (SF)
    MARINE_EXCELLENT = "Excellent"   # 83-89

    # SF sub-tiers (90-100)
    SF_EXCELLENT = "Elite"           # 97-100


@dataclass
class FitnessScore:
    """Performance score with tier classification"""
    score: float                     # 0-100
    tier: FitnessTier                # CIVILIAN, MARINE, SF
    sub_tier: str                    # e.g., "Passing", "High", "Excellent"
    badge_color: str                 # blue, green, gold
    percentile: Optional[float] = None
    explanation: str = ""
    contributing_factors: List[str] = field(default_factory=list)


# Age brackets (Marine Corps CFT style)
AGE_BRACKETS = [
    (17, 20),
    (21, 25),
    (26, 30),
    (31, 35),
    (36, 40),
    (41, 45),
    (46, 50),
    (51, 55),
    (56, 999)
]


def get_age_bracket(age: int) -> Tuple[int, int]:
    """Get the age bracket for a given age"""
    for bracket in AGE_BRACKETS:
        if bracket[0] <= age <= bracket[1]:
            return bracket
    return (56, 999)  # Default to oldest bracket


def get_age_bracket_index(age: int) -> int:
    """Get the index of age bracket (0-8) for lookup tables"""
    for i, bracket in enumerate(AGE_BRACKETS):
        if bracket[0] <= age <= bracket[1]:
            return i
    return len(AGE_BRACKETS) - 1


# ============================================
# Run Pace Standards (seconds per mile)
# ============================================

# Male run pace standards by age bracket index
# Format: [SF Excellent, SF Passing, Marine Excellent, Marine Passing, Civilian Excellent, Civilian Average]
MALE_RUN_PACE_STANDARDS = {
    0: [330, 360, 390, 450, 510, 600],   # 17-20
    1: [330, 360, 390, 450, 510, 600],   # 21-25
    2: [345, 375, 405, 465, 525, 615],   # 26-30
    3: [345, 375, 405, 465, 525, 615],   # 31-35
    4: [360, 390, 420, 480, 540, 630],   # 36-40
    5: [360, 390, 420, 480, 540, 630],   # 41-45
    6: [390, 420, 450, 510, 570, 660],   # 46-50
    7: [390, 420, 450, 510, 570, 660],   # 51-55
    8: [420, 450, 480, 540, 600, 690],   # 56+
}

# Female standards: ~60 seconds slower at each tier
FEMALE_RUN_PACE_STANDARDS = {
    0: [390, 420, 450, 510, 570, 660],   # 17-20
    1: [390, 420, 450, 510, 570, 660],   # 21-25
    2: [405, 435, 465, 525, 585, 675],   # 26-30
    3: [405, 435, 465, 525, 585, 675],   # 31-35
    4: [420, 450, 480, 540, 600, 690],   # 36-40
    5: [420, 450, 480, 540, 600, 690],   # 41-45
    6: [450, 480, 510, 570, 630, 720],   # 46-50
    7: [450, 480, 510, 570, 630, 720],   # 51-55
    8: [480, 510, 540, 600, 660, 750],   # 56+
}


# ============================================
# Ruck Weight Standards (% of body weight)
# ============================================

RUCK_WEIGHT_ADJUSTMENTS = [
    (0.30, 10),    # 30%+ BW = +10 bonus
    (0.25, 5),     # 25-30% BW = +5
    (0.20, 0),     # 20-25% BW = standard (0)
    (0.15, -5),    # 15-20% BW = -5
    (0.10, -10),   # 10-15% BW = -10
    (0.0, -15),    # <10% BW = -15
]


def get_ruck_weight_adjustment(weight_carried_lbs: float, body_weight_lbs: float) -> int:
    """Calculate score adjustment based on ruck weight as % of body weight"""
    if not body_weight_lbs or body_weight_lbs <= 0:
        return 0  # Can't calculate without body weight

    ratio = weight_carried_lbs / body_weight_lbs

    for threshold, adjustment in RUCK_WEIGHT_ADJUSTMENTS:
        if ratio >= threshold:
            return adjustment

    return -15  # Default for very light loads


# ============================================
# Score Classification
# ============================================

def classify_score(score: float) -> Tuple[FitnessTier, str, str]:
    """
    Classify a numeric score into tier, sub-tier, and badge color.

    Returns: (tier, sub_tier, badge_color)
    """
    score = max(0, min(100, score))  # Clamp to 0-100

    if score >= 90:
        # SF Level
        if score >= 97:
            return (FitnessTier.SF, "Elite", "gold")
        elif score >= 94:
            return (FitnessTier.SF, "High", "gold")
        else:
            return (FitnessTier.SF, "Passing", "gold")
    elif score >= 70:
        # Marine Level
        if score >= 83:
            return (FitnessTier.MARINE, "Excellent", "green")
        elif score >= 75:
            return (FitnessTier.MARINE, "High", "green")
        else:
            return (FitnessTier.MARINE, "Passing", "green")
    else:
        # Civilian Level
        if score >= 65:
            return (FitnessTier.CIVILIAN, "Excellent", "blue")
        elif score >= 55:
            return (FitnessTier.CIVILIAN, "Good", "blue")
        elif score >= 40:
            return (FitnessTier.CIVILIAN, "Average", "blue")
        else:
            return (FitnessTier.CIVILIAN, "Below Average", "blue")


def pace_seconds_to_string(seconds: int) -> str:
    """Convert pace in seconds per mile to mm:ss format"""
    minutes = seconds // 60
    secs = seconds % 60
    return f"{minutes}:{secs:02d}/mi"


def calculate_run_score(
    pace_seconds_per_mile: int,
    age: int,
    is_female: bool = False,
    distance_miles: Optional[float] = None
) -> FitnessScore:
    """
    Calculate fitness score for a run based on pace, age, and gender.

    Args:
        pace_seconds_per_mile: Pace in seconds per mile
        age: Age in years
        is_female: True for female standards
        distance_miles: Optional distance for context

    Returns:
        FitnessScore with tier classification
    """
    bracket_idx = get_age_bracket_index(age)
    standards = FEMALE_RUN_PACE_STANDARDS if is_female else MALE_RUN_PACE_STANDARDS
    thresholds = standards.get(bracket_idx, standards[1])  # Default to 21-25 bracket

    # Thresholds: [SF Excellent, SF Passing, Marine Excellent, Marine Passing, Civilian Excellent, Civilian Average]
    sf_excellent = thresholds[0]
    sf_passing = thresholds[1]
    marine_excellent = thresholds[2]
    marine_passing = thresholds[3]
    civilian_excellent = thresholds[4]
    civilian_average = thresholds[5]

    factors = []

    # Calculate score based on where pace falls relative to thresholds
    # Lower pace = faster = better score
    if pace_seconds_per_mile <= sf_excellent:
        # Elite SF level (97-100)
        score = 97 + (sf_excellent - pace_seconds_per_mile) / 30 * 3  # Max 100
        score = min(100, score)
        factors.append(f"Elite pace: {pace_seconds_to_string(pace_seconds_per_mile)}")
    elif pace_seconds_per_mile <= sf_passing:
        # SF High to Excellent (90-97)
        ratio = (sf_passing - pace_seconds_per_mile) / (sf_passing - sf_excellent)
        score = 90 + ratio * 7
        factors.append(f"SF-level pace: {pace_seconds_to_string(pace_seconds_per_mile)}")
    elif pace_seconds_per_mile <= marine_excellent:
        # Marine High to SF Passing (83-90)
        ratio = (marine_excellent - pace_seconds_per_mile) / (marine_excellent - sf_passing)
        score = 83 + ratio * 7
        factors.append(f"Strong Marine pace: {pace_seconds_to_string(pace_seconds_per_mile)}")
    elif pace_seconds_per_mile <= marine_passing:
        # Marine Passing to High (70-83)
        ratio = (marine_passing - pace_seconds_per_mile) / (marine_passing - marine_excellent)
        score = 70 + ratio * 13
        factors.append(f"Marine pace: {pace_seconds_to_string(pace_seconds_per_mile)}")
    elif pace_seconds_per_mile <= civilian_excellent:
        # Civilian Excellent to Marine (65-70)
        ratio = (civilian_excellent - pace_seconds_per_mile) / (civilian_excellent - marine_passing)
        score = 65 + ratio * 5
        factors.append(f"Strong civilian pace: {pace_seconds_to_string(pace_seconds_per_mile)}")
    elif pace_seconds_per_mile <= civilian_average:
        # Civilian Average to Excellent (40-65)
        ratio = (civilian_average - pace_seconds_per_mile) / (civilian_average - civilian_excellent)
        score = 40 + ratio * 25
        factors.append(f"Civilian pace: {pace_seconds_to_string(pace_seconds_per_mile)}")
    else:
        # Below Average (0-40)
        # Scale from 0-40 based on how far below average
        slowest_expected = civilian_average + 180  # 3 min slower than average
        if pace_seconds_per_mile >= slowest_expected:
            score = 0
        else:
            ratio = (slowest_expected - pace_seconds_per_mile) / (slowest_expected - civilian_average)
            score = ratio * 40

        factors.append(f"Below average pace: {pace_seconds_to_string(pace_seconds_per_mile)}")

    # Add age/gender context
    gender_str = "female" if is_female else "male"
    bracket = get_age_bracket(age)
    factors.append(f"Standards: {gender_str}, age {bracket[0]}-{bracket[1]}")

    if distance_miles:
        factors.append(f"Distance: {distance_miles:.2f} mi")

    tier, sub_tier, badge_color = classify_score(score)

    return FitnessScore(
        score=round(score, 1),
        tier=tier,
        sub_tier=sub_tier,
        badge_color=badge_color,
        explanation=f"{tier.value} {sub_tier}",
        contributing_factors=factors
    )


def calculate_ruck_score(
    pace_seconds_per_mile: int,
    weight_carried_lbs: float,
    body_weight_lbs: float,
    age: int,
    is_female: bool = False,
    distance_miles: Optional[float] = None
) -> FitnessScore:
    """
    Calculate fitness score for a ruck, adjusted for weight carried.

    Starts with run pace score, then applies ruck weight adjustment.
    """
    # Get base score from pace (rucks are inherently slower, so standards are more lenient)
    # Apply a 90 second/mile adjustment to pace thresholds for rucks
    adjusted_pace = pace_seconds_per_mile - 90

    base_score_result = calculate_run_score(
        pace_seconds_per_mile=adjusted_pace,
        age=age,
        is_female=is_female,
        distance_miles=distance_miles
    )

    # Apply ruck weight adjustment
    weight_adjustment = get_ruck_weight_adjustment(weight_carried_lbs, body_weight_lbs)

    final_score = max(0, min(100, base_score_result.score + weight_adjustment))

    # Build factors
    factors = [f"Ruck pace: {pace_seconds_to_string(pace_seconds_per_mile)}"]

    if body_weight_lbs and body_weight_lbs > 0:
        weight_pct = (weight_carried_lbs / body_weight_lbs) * 100
        factors.append(f"Weight: {weight_carried_lbs:.0f} lbs ({weight_pct:.0f}% BW)")

        if weight_adjustment > 0:
            factors.append(f"Heavy load bonus: +{weight_adjustment}")
        elif weight_adjustment < 0:
            factors.append(f"Light load penalty: {weight_adjustment}")
    else:
        factors.append(f"Weight: {weight_carried_lbs:.0f} lbs")

    # Add remaining factors from base calculation
    for factor in base_score_result.contributing_factors[1:]:  # Skip pace (we added our own)
        if "pace" not in factor.lower():
            factors.append(factor)

    if distance_miles:
        # Calculate ton-miles (training load metric)
        ton_miles = (weight_carried_lbs * distance_miles) / 2000
        factors.append(f"Ton-miles: {ton_miles:.2f}")

    tier, sub_tier, badge_color = classify_score(final_score)

    return FitnessScore(
        score=round(final_score, 1),
        tier=tier,
        sub_tier=sub_tier,
        badge_color=badge_color,
        explanation=f"{tier.value} {sub_tier}",
        contributing_factors=factors
    )


def calculate_workout_score(
    workout_type: str,
    age: int,
    is_female: bool = False,
    pace_seconds_per_mile: Optional[int] = None,
    duration_minutes: Optional[int] = None,
    distance_miles: Optional[float] = None,
    weight_carried_lbs: Optional[float] = None,
    body_weight_lbs: Optional[float] = None,
    rpe: Optional[int] = None,
    exercises: Optional[List[dict]] = None
) -> Optional[FitnessScore]:
    """
    Calculate fitness score for any workout type.

    Returns None if insufficient data for scoring.
    """
    workout_type_upper = workout_type.upper() if workout_type else "OTHER"

    # Cardio workouts with pace
    if workout_type_upper in ["RUN", "SWIM", "BIKE", "ROW"]:
        if pace_seconds_per_mile and pace_seconds_per_mile > 0:
            return calculate_run_score(
                pace_seconds_per_mile=pace_seconds_per_mile,
                age=age,
                is_female=is_female,
                distance_miles=distance_miles
            )

    # Ruck with weight
    if workout_type_upper == "RUCK":
        if pace_seconds_per_mile and pace_seconds_per_mile > 0 and weight_carried_lbs:
            return calculate_ruck_score(
                pace_seconds_per_mile=pace_seconds_per_mile,
                weight_carried_lbs=weight_carried_lbs,
                body_weight_lbs=body_weight_lbs or 180,  # Default if unknown
                age=age,
                is_female=is_female,
                distance_miles=distance_miles
            )

    # For workouts without pace data, use RPE as rough estimate
    if rpe:
        # RPE 10 = elite effort (score 70-90 depending on duration)
        # RPE 7 = good effort (score 50-70)
        # RPE 5 = moderate effort (score 35-55)
        base_score = (rpe / 10) * 70

        # Duration bonus (sustained effort)
        if duration_minutes:
            if duration_minutes >= 60:
                base_score += 10
            elif duration_minutes >= 45:
                base_score += 7
            elif duration_minutes >= 30:
                base_score += 5

        base_score = min(89, base_score)  # Cap at Marine Excellent for RPE-based

        factors = [
            f"RPE: {rpe}/10",
            f"Duration: {duration_minutes} min" if duration_minutes else "Duration: N/A",
            "Score based on perceived effort"
        ]

        tier, sub_tier, badge_color = classify_score(base_score)

        return FitnessScore(
            score=round(base_score, 1),
            tier=tier,
            sub_tier=sub_tier,
            badge_color=badge_color,
            explanation=f"{tier.value} {sub_tier} (estimated from RPE)",
            contributing_factors=factors
        )

    # Can't calculate score without sufficient data
    return None


def get_fitness_profile(
    workouts: List[dict],
    age: int,
    is_female: bool = False,
    body_weight_lbs: Optional[float] = None
) -> Dict[str, Any]:
    """
    Generate a comprehensive fitness profile from workout history.

    Returns aggregated scores by workout type and overall fitness assessment.
    """
    scores_by_type: Dict[str, List[float]] = {}
    all_scores: List[float] = []
    scored_workouts = []

    for workout in workouts:
        workout_type = workout.get("workout_type", "OTHER")

        score_result = calculate_workout_score(
            workout_type=workout_type,
            age=age,
            is_female=is_female,
            pace_seconds_per_mile=workout.get("pace_seconds_per_mile"),
            duration_minutes=workout.get("duration_minutes"),
            distance_miles=workout.get("distance_miles"),
            weight_carried_lbs=workout.get("weight_carried_lbs"),
            body_weight_lbs=body_weight_lbs,
            rpe=workout.get("rpe"),
            exercises=workout.get("exercises")
        )

        if score_result:
            if workout_type not in scores_by_type:
                scores_by_type[workout_type] = []
            scores_by_type[workout_type].append(score_result.score)
            all_scores.append(score_result.score)

            scored_workouts.append({
                "workout_id": workout.get("id"),
                "date": workout.get("workout_date"),
                "type": workout_type,
                "score": score_result.score,
                "tier": score_result.tier.value,
                "sub_tier": score_result.sub_tier,
                "badge_color": score_result.badge_color
            })

    # Calculate averages by type
    type_averages = {}
    for wtype, scores in scores_by_type.items():
        avg_score = sum(scores) / len(scores)
        tier, sub_tier, badge_color = classify_score(avg_score)
        type_averages[wtype] = {
            "average_score": round(avg_score, 1),
            "workout_count": len(scores),
            "tier": tier.value,
            "sub_tier": sub_tier,
            "badge_color": badge_color
        }

    # Calculate overall average
    overall_score = sum(all_scores) / len(all_scores) if all_scores else None
    overall_tier = None
    overall_sub_tier = None
    overall_badge = None

    if overall_score is not None:
        tier, sub_tier, badge = classify_score(overall_score)
        overall_tier = tier.value
        overall_sub_tier = sub_tier
        overall_badge = badge

    return {
        "overall_score": round(overall_score, 1) if overall_score else None,
        "overall_tier": overall_tier,
        "overall_sub_tier": overall_sub_tier,
        "overall_badge_color": overall_badge,
        "total_scored_workouts": len(all_scores),
        "by_type": type_averages,
        "recent_scored_workouts": scored_workouts[-10:] if scored_workouts else [],  # Last 10
        "age_bracket": get_age_bracket(age),
        "gender": "female" if is_female else "male"
    }


def get_tier_thresholds() -> Dict[str, Any]:
    """
    Return threshold information for display/documentation.
    """
    return {
        "tiers": {
            "CIVILIAN": {
                "score_range": [0, 69],
                "badge_color": "blue",
                "sub_tiers": {
                    "Below Average": [0, 39],
                    "Average": [40, 54],
                    "Good": [55, 64],
                    "Excellent": [65, 69]
                }
            },
            "MARINE": {
                "score_range": [70, 89],
                "badge_color": "green",
                "sub_tiers": {
                    "Passing": [70, 74],
                    "High": [75, 82],
                    "Excellent": [83, 89]
                }
            },
            "SF": {
                "score_range": [90, 100],
                "badge_color": "gold",
                "sub_tiers": {
                    "Passing": [90, 93],
                    "High": [94, 96],
                    "Elite": [97, 100]
                }
            }
        },
        "age_brackets": AGE_BRACKETS,
        "ruck_weight_adjustments": [
            {"threshold_pct": 30, "adjustment": 10, "description": "Heavy load (+10)"},
            {"threshold_pct": 25, "adjustment": 5, "description": "Good load (+5)"},
            {"threshold_pct": 20, "adjustment": 0, "description": "Standard (0)"},
            {"threshold_pct": 15, "adjustment": -5, "description": "Light load (-5)"},
            {"threshold_pct": 10, "adjustment": -10, "description": "Very light (-10)"},
            {"threshold_pct": 0, "adjustment": -15, "description": "Minimal (<10%)"}
        ]
    }
