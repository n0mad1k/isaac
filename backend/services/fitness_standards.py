"""
Fitness Standards Service - Three-Tier Performance Classification

Implements gender/age-normalized performance scoring with three classification levels:
- CIVILIAN (0-69): General population fitness standards
- MARINE (70-89): Military-grade fitness (standard service requirements)
- SF (90-100): Special Forces / Elite operator fitness

Uses real USMC PFT/CFT scoring tables, MARSOC A&S anchors, and population data.
Nine explicit thresholds per bracket:
  [SF_Exc(97), SF_Good(94), SF_Pass(90), Mar_Exc(84), Mar_Good(77),
   Mar_Pass(70), Civ_Exc(65), Civ_Good(55), Civ_Pass(40)]
"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, date
from enum import Enum
import math
import json
import re


# ============================================
# Enums
# ============================================

class FitnessTier(str, Enum):
    CIVILIAN = "CIVILIAN"
    MARINE = "MARINE"
    SF = "SF"


class FitnessSubTier(str, Enum):
    # Civilian sub-tiers (0-69)
    BELOW_AVERAGE = "Below Average"  # 0-39
    PASSING = "Passing"              # 40-54
    GOOD = "Good"                    # 55-64
    EXCELLENT = "Excellent"          # 65-69

    # Marine sub-tiers (70-89)
    MARINE_PASSING = "Passing"       # 70-76
    MARINE_GOOD = "Good"             # 77-83
    MARINE_EXCELLENT = "Excellent"   # 84-89

    # SF sub-tiers (90-100)
    SF_PASSING = "Passing"           # 90-93
    SF_GOOD = "Good"                 # 94-96
    SF_EXCELLENT = "Excellent"       # 97-100


# ============================================
# FitnessScore Dataclass
# ============================================

@dataclass
class FitnessScore:
    """Performance score with tier classification"""
    score: float                     # 0-100
    tier: FitnessTier                # CIVILIAN, MARINE, SF
    sub_tier: str                    # "Passing", "Good", "Excellent"
    badge_color: str                 # blue, green, gold
    percentile: Optional[float] = None
    explanation: str = ""
    contributing_factors: List[str] = field(default_factory=list)
    validated: bool = True           # False if distance-scaled
    validation_note: str = ""        # e.g. "Estimated from 1.0mi effort"
    confidence: str = "HIGH"         # HIGH, MEDIUM, LOW


# ============================================
# Age Brackets (Marine Corps CFT style)
# ============================================

AGE_BRACKETS = [
    (17, 20),   # 0
    (21, 25),   # 1
    (26, 30),   # 2
    (31, 35),   # 3
    (36, 40),   # 4
    (41, 45),   # 5
    (46, 50),   # 6
    (51, 55),   # 7
    (56, 999),  # 8
]


def get_age_bracket(age: int) -> Tuple[int, int]:
    """Get the age bracket for a given age"""
    for bracket in AGE_BRACKETS:
        if bracket[0] <= age <= bracket[1]:
            return bracket
    return (56, 999)


def get_age_bracket_index(age: int) -> int:
    """Get the index of age bracket (0-8) for lookup tables"""
    for i, bracket in enumerate(AGE_BRACKETS):
        if bracket[0] <= age <= bracket[1]:
            return i
    return len(AGE_BRACKETS) - 1


# ============================================
# 9-Threshold Score Boundaries
# ============================================
# [SF_Exc(97), SF_Good(94), SF_Pass(90), Mar_Exc(84), Mar_Good(77),
#  Mar_Pass(70), Civ_Exc(65), Civ_Good(55), Civ_Pass(40)]
SCORE_BOUNDARIES = [97, 94, 90, 84, 77, 70, 65, 55, 40]


# ============================================
# Classification
# ============================================

def classify_score(score: float) -> Tuple[FitnessTier, str, str]:
    """
    Classify a numeric score into tier, sub-tier, and badge color.
    Returns: (tier, sub_tier, badge_color)
    """
    score = max(0, min(100, score))

    if score >= 90:
        if score >= 97:
            return (FitnessTier.SF, "Excellent", "gold")
        elif score >= 94:
            return (FitnessTier.SF, "Good", "gold")
        else:
            return (FitnessTier.SF, "Passing", "gold")
    elif score >= 70:
        if score >= 84:
            return (FitnessTier.MARINE, "Excellent", "green")
        elif score >= 77:
            return (FitnessTier.MARINE, "Good", "green")
        else:
            return (FitnessTier.MARINE, "Passing", "green")
    else:
        if score >= 65:
            return (FitnessTier.CIVILIAN, "Excellent", "blue")
        elif score >= 55:
            return (FitnessTier.CIVILIAN, "Good", "blue")
        elif score >= 40:
            return (FitnessTier.CIVILIAN, "Passing", "blue")
        else:
            return (FitnessTier.CIVILIAN, "Below Average", "blue")


def pace_seconds_to_string(seconds: int) -> str:
    """Convert pace in seconds per mile to mm:ss format"""
    minutes = seconds // 60
    secs = seconds % 60
    return f"{minutes}:{secs:02d}/mi"


def _time_to_string(seconds: int) -> str:
    """Convert seconds to mm:ss format"""
    minutes = seconds // 60
    secs = seconds % 60
    return f"{minutes}:{secs:02d}"


# ============================================
# Generic 9-Threshold Scoring Helpers
# ============================================

def _score_from_pace(pace: float, thresholds: list, below_avg_buffer: int = 180) -> float:
    """
    Score from pace (lower is better) against 9 thresholds.
    thresholds: [SF_Exc, SF_Good, SF_Pass, Mar_Exc, Mar_Good, Mar_Pass, Civ_Exc, Civ_Good, Civ_Pass]
    """
    sf_exc, sf_good, sf_pass, mar_exc, mar_good, mar_pass, civ_exc, civ_good, civ_pass = thresholds

    if pace <= sf_exc:
        # At or faster than SF Excellent
        bonus = min(3, (sf_exc - pace) / max(1, sf_exc * 0.05) * 3)
        return min(100, 97 + bonus)
    elif pace <= sf_good:
        ratio = (sf_good - pace) / max(1, sf_good - sf_exc)
        return 94 + ratio * 3
    elif pace <= sf_pass:
        ratio = (sf_pass - pace) / max(1, sf_pass - sf_good)
        return 90 + ratio * 4
    elif pace <= mar_exc:
        ratio = (mar_exc - pace) / max(1, mar_exc - sf_pass)
        return 84 + ratio * 6
    elif pace <= mar_good:
        ratio = (mar_good - pace) / max(1, mar_good - mar_exc)
        return 77 + ratio * 7
    elif pace <= mar_pass:
        ratio = (mar_pass - pace) / max(1, mar_pass - mar_good)
        return 70 + ratio * 7
    elif pace <= civ_exc:
        ratio = (civ_exc - pace) / max(1, civ_exc - mar_pass)
        return 65 + ratio * 5
    elif pace <= civ_good:
        ratio = (civ_good - pace) / max(1, civ_good - civ_exc)
        return 55 + ratio * 10
    elif pace <= civ_pass:
        ratio = (civ_pass - pace) / max(1, civ_pass - civ_good)
        return 40 + ratio * 15
    else:
        # Below average
        slowest = civ_pass + below_avg_buffer
        if pace >= slowest:
            return 0
        ratio = (slowest - pace) / max(1, slowest - civ_pass)
        return ratio * 40


def _score_from_value(value: float, thresholds: list) -> float:
    """
    Score from value (higher is better) against 9 thresholds.
    thresholds: [SF_Exc, SF_Good, SF_Pass, Mar_Exc, Mar_Good, Mar_Pass, Civ_Exc, Civ_Good, Civ_Pass]
    """
    sf_exc, sf_good, sf_pass, mar_exc, mar_good, mar_pass, civ_exc, civ_good, civ_pass = thresholds

    if value >= sf_exc:
        bonus = min(3, (value - sf_exc) / max(1, sf_exc * 0.05) * 3)
        return min(100, 97 + bonus)
    elif value >= sf_good:
        ratio = (value - sf_good) / max(1, sf_exc - sf_good)
        return 94 + ratio * 3
    elif value >= sf_pass:
        ratio = (value - sf_pass) / max(1, sf_good - sf_pass)
        return 90 + ratio * 4
    elif value >= mar_exc:
        ratio = (value - mar_exc) / max(1, sf_pass - mar_exc)
        return 84 + ratio * 6
    elif value >= mar_good:
        ratio = (value - mar_good) / max(1, mar_exc - mar_good)
        return 77 + ratio * 7
    elif value >= mar_pass:
        ratio = (value - mar_pass) / max(1, mar_good - mar_pass)
        return 70 + ratio * 7
    elif value >= civ_exc:
        ratio = (value - civ_exc) / max(1, mar_pass - civ_exc)
        return 65 + ratio * 5
    elif value >= civ_good:
        ratio = (value - civ_good) / max(1, civ_exc - civ_good)
        return 55 + ratio * 10
    elif value >= civ_pass:
        ratio = (value - civ_pass) / max(1, civ_good - civ_pass)
        return 40 + ratio * 15
    else:
        # Below civ_pass
        if civ_pass <= 0:
            return 0
        ratio = value / civ_pass
        return max(0, ratio * 40)


# ============================================
# Distance Scaling
# ============================================

DISTANCE_SCALING = {
    "RUN":  [(3.0, 1.00), (2.0, 0.85), (1.0, 0.60), (0.0, 0.50)],
    "RUCK": [(4.0, 1.00), (3.0, 0.90), (2.0, 0.75), (1.0, 0.60), (0.0, 0.50)],
    "SWIM": [(0.186, 1.00), (0.124, 0.80), (0.0, 0.50)],   # 300m, 200m in miles
    "BIKE": [(10.0, 1.00), (5.0, 0.80), (3.0, 0.65), (0.0, 0.50)],
    "ROW":  [(1.243, 1.00), (0.621, 0.80), (0.311, 0.65), (0.0, 0.50)],  # 2000m, 1000m, 500m
}

NEUTRAL_POINT = 55  # Civilian Passing/Good boundary


def _apply_distance_scaling(score: float, distance_miles: Optional[float],
                            workout_type: str) -> Tuple[float, bool, str]:
    """
    Apply distance scaling. Returns (adjusted_score, validated, note).
    Neutral point = 55.
    """
    wtype = workout_type.upper()
    if distance_miles is None or wtype not in DISTANCE_SCALING:
        return score, True, ""

    scaling = DISTANCE_SCALING[wtype]
    full_credit_dist = scaling[0][0]

    if distance_miles >= full_credit_dist:
        return score, True, ""

    # Find the factor by interpolating between scaling breakpoints
    factor = scaling[-1][1]  # default to minimum
    for i in range(len(scaling) - 1):
        upper_dist, upper_factor = scaling[i]
        lower_dist, lower_factor = scaling[i + 1]
        if distance_miles >= lower_dist:
            if upper_dist == lower_dist:
                factor = upper_factor
            else:
                ratio = (distance_miles - lower_dist) / (upper_dist - lower_dist)
                factor = lower_factor + ratio * (upper_factor - lower_factor)
            break

    adjusted = NEUTRAL_POINT + (score - NEUTRAL_POINT) * factor
    adjusted = max(0, min(100, adjusted))
    note = f"Estimated from {distance_miles:.1f}mi effort ({factor:.0%} credit)"
    return adjusted, False, note


# ============================================
# SECTION 2: Run Scoring (Official USMC PFT 3-Mile)
# ============================================

# Official PFT 3-Mile Run scoring data
# Format: (max_time_seconds_for_100pts, min_time_seconds_for_40pts)
PFT_RUN_MALE = {
    0: (18 * 60, 27 * 60 + 40),    # 17-20: 18:00, 27:40
    1: (18 * 60, 27 * 60 + 40),    # 21-25
    2: (18 * 60, 28 * 60),          # 26-30
    3: (18 * 60, 28 * 60 + 20),    # 31-35
    4: (18 * 60, 28 * 60 + 40),    # 36-40
    5: (18 * 60 + 30, 29 * 60 + 20),  # 41-45
    6: (19 * 60, 30 * 60),          # 46-50
    7: (19 * 60 + 30, 33 * 60),    # 51+
    8: (19 * 60 + 30, 33 * 60),    # 56+ (same as 51+)
}

PFT_RUN_FEMALE = {
    0: (21 * 60, 30 * 60 + 50),    # 17-20: 21:00, 30:50
    1: (21 * 60, 30 * 60 + 50),    # 21-25
    2: (21 * 60, 31 * 60 + 10),    # 26-30
    3: (21 * 60, 31 * 60 + 30),    # 31-35
    4: (21 * 60, 31 * 60 + 50),    # 36-40
    5: (21 * 60 + 30, 32 * 60 + 30),  # 41-45
    6: (22 * 60, 33 * 60 + 30),    # 46-50
    7: (22 * 60 + 30, 36 * 60),    # 51+
    8: (22 * 60 + 30, 36 * 60),    # 56+
}


def _pft_run_points(time_seconds_3mi: int, bracket_idx: int, is_female: bool) -> float:
    """
    Official PFT 3-mile run scoring: time -> 0-100 PFT points.
    Linear interpolation between max time (100pts) and min time (40pts).
    Faster than max = 100. Slower than min = below 40 (extrapolated down to 0).
    """
    table = PFT_RUN_FEMALE if is_female else PFT_RUN_MALE
    max_idx = min(bracket_idx, max(table.keys()))
    max_time, min_time = table.get(max_idx, table[1])

    if time_seconds_3mi <= max_time:
        return 100.0
    elif time_seconds_3mi >= min_time:
        # Below minimum: extrapolate down from 40 toward 0
        # At min_time = 40pts, at min_time + same_range = 0pts
        range_sec = min_time - max_time
        overshoot = time_seconds_3mi - min_time
        pts = 40.0 - (overshoot / max(1, range_sec)) * 40.0
        return max(0.0, pts)
    else:
        # Linear interpolation between max (100) and min (40)
        ratio = (min_time - time_seconds_3mi) / max(1, min_time - max_time)
        return 40.0 + ratio * 60.0


def _pft_to_score(pft_points: float) -> float:
    """
    Map PFT event points (0-100) to our 0-100 score.
    1st Class PFT avg (~78pts) = Marine Excellent (84).
    SF Passing (90) requires ~85pts — must EXCEED 1st Class.

    Anchor points:
    PFT 100 -> Score 97 (SF Excellent)
    PFT 95  -> Score 94 (SF Good)
    PFT 85  -> Score 90 (SF Passing)
    PFT 78  -> Score 84 (Marine Excellent)
    PFT 65  -> Score 77 (Marine Good)
    PFT 50  -> Score 70 (Marine Passing)
    PFT 40  -> Score 65 (Civilian Excellent = bare event minimum)
    PFT 0   -> Score 0
    """
    anchors = [
        (100, 97),
        (95, 94),
        (85, 90),
        (78, 84),
        (65, 77),
        (50, 70),
        (40, 65),
        (0, 0),
    ]

    if pft_points >= 100:
        return min(100, 97 + (pft_points - 100) * 0.3)
    if pft_points <= 0:
        return 0

    # Find the two anchor points to interpolate between
    for i in range(len(anchors) - 1):
        upper_pft, upper_score = anchors[i]
        lower_pft, lower_score = anchors[i + 1]
        if pft_points >= lower_pft:
            ratio = (pft_points - lower_pft) / max(1, upper_pft - lower_pft)
            return lower_score + ratio * (upper_score - lower_score)

    return 0


# Civilian below-PFT range thresholds (for runs slower than PFT minimum)
# These are added to PFT min time to define Civ Good and Civ Passing
CIV_BELOW_PFT_GOOD_BUFFER = 2 * 60     # +2:00 for Civ Good (55)
CIV_BELOW_PFT_PASS_BUFFER = 5 * 60     # +5:00 for Civ Passing (40)


def calculate_run_score(
    pace_seconds_per_mile: int,
    age: int,
    is_female: bool = False,
    distance_miles: Optional[float] = None
) -> FitnessScore:
    """
    Calculate fitness score for a run using official USMC PFT 3-mile scoring.
    Converts pace to 3-mile equivalent time, scores via PFT function, then maps
    to our 0-100 scale. Distance scaling applied for non-3-mile distances.
    """
    bracket_idx = get_age_bracket_index(age)
    factors = []

    # Convert pace to 3-mile time
    time_3mi = pace_seconds_per_mile * 3

    # Get PFT points
    pft_pts = _pft_run_points(time_3mi, bracket_idx, is_female)

    # Map PFT points to our score
    if pft_pts >= 40:
        score = _pft_to_score(pft_pts)
    else:
        # Below PFT minimum — handle civilian range
        table = PFT_RUN_FEMALE if is_female else PFT_RUN_MALE
        max_idx = min(bracket_idx, max(table.keys()))
        _, min_time = table.get(max_idx, table[1])
        min_pace = min_time / 3  # pace at PFT minimum

        civ_good_pace = min_pace + CIV_BELOW_PFT_GOOD_BUFFER / 3
        civ_pass_pace = min_pace + CIV_BELOW_PFT_PASS_BUFFER / 3

        if pace_seconds_per_mile <= min_pace:
            score = 65  # Exactly at PFT min
        elif pace_seconds_per_mile <= civ_good_pace:
            ratio = (civ_good_pace - pace_seconds_per_mile) / max(1, civ_good_pace - min_pace)
            score = 55 + ratio * 10
        elif pace_seconds_per_mile <= civ_pass_pace:
            ratio = (civ_pass_pace - pace_seconds_per_mile) / max(1, civ_pass_pace - civ_good_pace)
            score = 40 + ratio * 15
        else:
            # Below Civ Passing
            slowest = civ_pass_pace + 120  # 2 min/mi buffer beyond pass
            if pace_seconds_per_mile >= slowest:
                score = 0
            else:
                ratio = (slowest - pace_seconds_per_mile) / max(1, slowest - civ_pass_pace)
                score = ratio * 40

    factors.append(f"Pace: {pace_seconds_to_string(pace_seconds_per_mile)}")
    factors.append(f"3mi equiv: {_time_to_string(time_3mi)}")
    if pft_pts >= 40:
        factors.append(f"PFT points: {pft_pts:.0f}/100")

    # Distance scaling
    validated = True
    validation_note = ""
    if distance_miles is not None:
        score, validated, validation_note = _apply_distance_scaling(score, distance_miles, "RUN")
        if not validated:
            factors.append(validation_note)
        factors.append(f"Distance: {distance_miles:.2f} mi")

    # Add context
    gender_str = "female" if is_female else "male"
    bracket = get_age_bracket(age)
    factors.append(f"Standards: {gender_str}, age {bracket[0]}-{bracket[1]}")

    score = max(0, min(100, score))
    tier, sub_tier, badge_color = classify_score(score)

    return FitnessScore(
        score=round(score, 1),
        tier=tier,
        sub_tier=sub_tier,
        badge_color=badge_color,
        explanation=f"{tier.value} {sub_tier}",
        contributing_factors=factors,
        validated=validated,
        validation_note=validation_note
    )


# ============================================
# SECTION 3: Ruck Standards (MARSOC A&S Anchored)
# ============================================

# Male ruck pace standards (seconds/mile, ~45lb load)
# [SF_Exc, SF_Good, SF_Pass, Mar_Exc, Mar_Good, Mar_Pass, Civ_Exc, Civ_Good, Civ_Pass]
MALE_RUCK_PACE_STANDARDS = {
    0: [540, 600, 660, 750, 825, 900, 1020, 1110, 1200],   # 17-20
    1: [540, 600, 660, 750, 825, 900, 1020, 1110, 1200],   # 21-25
    2: [560, 620, 680, 775, 850, 930, 1050, 1140, 1230],   # 26-30
    3: [560, 620, 680, 775, 850, 930, 1050, 1140, 1230],   # 31-35
    4: [580, 645, 710, 810, 885, 960, 1080, 1170, 1260],   # 36-40
    5: [580, 645, 710, 810, 885, 960, 1080, 1170, 1260],   # 41-45
    6: [620, 690, 750, 860, 930, 1000, 1120, 1210, 1300],  # 46-50
    7: [620, 690, 750, 860, 930, 1000, 1120, 1210, 1300],  # 51-55
    8: [660, 730, 790, 900, 970, 1050, 1170, 1260, 1350],  # 56+
}

# Female ruck pace standards (~60s slower per threshold)
FEMALE_RUCK_PACE_STANDARDS = {
    0: [600, 660, 720, 810, 885, 960, 1080, 1170, 1260],   # 17-20
    1: [600, 660, 720, 810, 885, 960, 1080, 1170, 1260],   # 21-25
    2: [620, 680, 740, 835, 910, 990, 1110, 1200, 1290],   # 26-30
    3: [620, 680, 740, 835, 910, 990, 1110, 1200, 1290],   # 31-35
    4: [640, 710, 770, 870, 945, 1020, 1140, 1230, 1320],  # 36-40
    5: [640, 710, 770, 870, 945, 1020, 1140, 1230, 1320],  # 41-45
    6: [680, 750, 810, 920, 990, 1060, 1180, 1270, 1360],  # 46-50
    7: [680, 750, 810, 920, 990, 1060, 1180, 1270, 1360],  # 51-55
    8: [720, 790, 850, 960, 1030, 1110, 1230, 1320, 1410], # 56+
}

# Ruck weight adjustments (% of BW)
RUCK_WEIGHT_ADJUSTMENTS = [
    (0.30, 5),     # 30%+ BW = +5 bonus
    (0.25, 3),     # 25-30% BW = +3
    (0.20, 0),     # 20-25% BW = standard
    (0.15, -3),    # 15-20% BW = -3
    (0.10, -5),    # 10-15% BW = -5
    (0.0, -8),     # <10% BW = -8
]


def get_ruck_weight_adjustment(weight_carried_lbs: float, body_weight_lbs: float) -> int:
    """Calculate score adjustment based on ruck weight as % of body weight"""
    if not body_weight_lbs or body_weight_lbs <= 0:
        return 0
    ratio = weight_carried_lbs / body_weight_lbs
    for threshold, adjustment in RUCK_WEIGHT_ADJUSTMENTS:
        if ratio >= threshold:
            return adjustment
    return -8


def calculate_ruck_score(
    pace_seconds_per_mile: int,
    weight_carried_lbs: float,
    body_weight_lbs: float,
    age: int,
    is_female: bool = False,
    distance_miles: Optional[float] = None
) -> FitnessScore:
    """
    Calculate fitness score for a ruck using MARSOC-anchored pace standards.
    Training capability anchor: 4 miles (full credit).
    """
    bracket_idx = get_age_bracket_index(age)
    standards = FEMALE_RUCK_PACE_STANDARDS if is_female else MALE_RUCK_PACE_STANDARDS
    thresholds = standards.get(bracket_idx, standards[1])
    factors = []

    # Score against 9-threshold pace table
    score = _score_from_pace(pace_seconds_per_mile, thresholds, below_avg_buffer=300)
    factors.append(f"Ruck pace: {pace_seconds_to_string(pace_seconds_per_mile)}")

    # Distance scaling (4mi = full credit, neutral at 55)
    validated = True
    validation_note = ""
    if distance_miles is not None:
        score, validated, validation_note = _apply_distance_scaling(score, distance_miles, "RUCK")
        if not validated:
            factors.append(validation_note)

    # Apply ruck weight adjustment
    weight_adjustment = get_ruck_weight_adjustment(weight_carried_lbs, body_weight_lbs)
    score = max(0, min(100, score + weight_adjustment))

    if body_weight_lbs and body_weight_lbs > 0:
        weight_pct = (weight_carried_lbs / body_weight_lbs) * 100
        factors.append(f"Weight: {weight_carried_lbs:.0f} lbs ({weight_pct:.0f}% BW)")
        if weight_adjustment > 0:
            factors.append(f"Heavy load bonus: +{weight_adjustment}")
        elif weight_adjustment < 0:
            factors.append(f"Light load penalty: {weight_adjustment}")
    else:
        factors.append(f"Weight: {weight_carried_lbs:.0f} lbs")

    gender_str = "female" if is_female else "male"
    bracket = get_age_bracket(age)
    factors.append(f"Standards: {gender_str}, age {bracket[0]}-{bracket[1]}")

    if distance_miles:
        ton_miles = (weight_carried_lbs * distance_miles) / 2000
        factors.append(f"Distance: {distance_miles:.2f} mi, Ton-miles: {ton_miles:.2f}")

    score = max(0, min(100, score))
    tier, sub_tier, badge_color = classify_score(score)

    return FitnessScore(
        score=round(score, 1),
        tier=tier,
        sub_tier=sub_tier,
        badge_color=badge_color,
        explanation=f"{tier.value} {sub_tier}",
        contributing_factors=factors,
        validated=validated,
        validation_note=validation_note
    )


# ============================================
# SECTION 4: Swim Standards (300m Primary)
# ============================================

# Male 300m swim time standards (seconds)
# [SF_Exc, SF_Good, SF_Pass, Mar_Exc, Mar_Good, Mar_Pass, Civ_Exc, Civ_Good, Civ_Pass]
MALE_SWIM_300M_STANDARDS = {
    0: [240, 270, 300, 360, 420, 480, 540, 660, 780],   # 17-20: 4:00-13:00
    1: [240, 270, 300, 360, 420, 480, 540, 660, 780],   # 21-25
    2: [250, 280, 310, 370, 430, 490, 555, 680, 800],   # 26-30
    3: [250, 280, 310, 370, 430, 490, 555, 680, 800],   # 31-35
    4: [260, 290, 320, 385, 445, 510, 575, 700, 830],   # 36-40
    5: [260, 290, 320, 385, 445, 510, 575, 700, 830],   # 41-45
    6: [280, 310, 345, 410, 475, 540, 610, 740, 870],   # 46-50
    7: [280, 310, 345, 410, 475, 540, 610, 740, 870],   # 51-55
    8: [300, 335, 370, 440, 510, 580, 650, 790, 920],   # 56+
}

# Female 300m swim time standards (~15-20% slower)
FEMALE_SWIM_300M_STANDARDS = {
    0: [280, 315, 350, 420, 490, 560, 630, 770, 910],   # 17-20
    1: [280, 315, 350, 420, 490, 560, 630, 770, 910],   # 21-25
    2: [290, 325, 360, 430, 500, 575, 645, 790, 930],   # 26-30
    3: [290, 325, 360, 430, 500, 575, 645, 790, 930],   # 31-35
    4: [305, 340, 375, 450, 520, 595, 670, 815, 960],   # 36-40
    5: [305, 340, 375, 450, 520, 595, 670, 815, 960],   # 41-45
    6: [325, 365, 400, 480, 555, 630, 710, 860, 1010],  # 46-50
    7: [325, 365, 400, 480, 555, 630, 710, 860, 1010],  # 51-55
    8: [350, 390, 430, 515, 595, 680, 760, 920, 1080],  # 56+
}


def calculate_swim_score(
    pace_seconds_per_mile: int,
    age: int,
    is_female: bool = False,
    distance_miles: Optional[float] = None
) -> FitnessScore:
    """
    Calculate fitness score for a swim.
    Converts pace to 300m time equivalent, scores against 300m standards.
    """
    bracket_idx = get_age_bracket_index(age)
    standards = FEMALE_SWIM_300M_STANDARDS if is_female else MALE_SWIM_300M_STANDARDS
    thresholds = standards.get(bracket_idx, standards[1])
    factors = []

    # Convert pace_seconds_per_mile to 300m time
    # 300m = 0.18641 miles
    miles_300m = 300 / 1609.34
    time_300m = pace_seconds_per_mile * miles_300m

    # Score against 300m standards (lower time = better, use _score_from_pace)
    score = _score_from_pace(time_300m, thresholds, below_avg_buffer=300)

    factors.append(f"Swim pace: {pace_seconds_to_string(pace_seconds_per_mile)}")
    factors.append(f"300m equiv: {_time_to_string(int(time_300m))}")

    # Distance scaling
    validated = True
    validation_note = ""
    if distance_miles is not None:
        score, validated, validation_note = _apply_distance_scaling(score, distance_miles, "SWIM")
        if not validated:
            factors.append(validation_note)
        factors.append(f"Distance: {distance_miles:.3f} mi ({distance_miles * 1609.34:.0f}m)")

    gender_str = "female" if is_female else "male"
    bracket = get_age_bracket(age)
    factors.append(f"Standards: {gender_str}, age {bracket[0]}-{bracket[1]}")

    score = max(0, min(100, score))
    tier, sub_tier, badge_color = classify_score(score)

    return FitnessScore(
        score=round(score, 1),
        tier=tier,
        sub_tier=sub_tier,
        badge_color=badge_color,
        explanation=f"{tier.value} {sub_tier}",
        contributing_factors=factors,
        validated=validated,
        validation_note=validation_note
    )


# ============================================
# SECTION 5: Bike Standards
# ============================================

# Male bike pace standards (seconds/mile)
# [SF_Exc, SF_Good, SF_Pass, Mar_Exc, Mar_Good, Mar_Pass, Civ_Exc, Civ_Good, Civ_Pass]
MALE_BIKE_PACE_STANDARDS = {
    0: [150, 160, 171, 189, 212, 240, 277, 313, 360],   # 17-20
    1: [150, 160, 171, 189, 212, 240, 277, 313, 360],   # 21-25
    2: [155, 165, 177, 195, 218, 245, 282, 320, 370],   # 26-30
    3: [155, 165, 177, 195, 218, 245, 282, 320, 370],   # 31-35
    4: [163, 173, 184, 204, 227, 255, 293, 333, 383],   # 36-40
    5: [163, 173, 184, 204, 227, 255, 293, 333, 383],   # 41-45
    6: [173, 184, 196, 218, 243, 267, 308, 350, 400],   # 46-50
    7: [173, 184, 196, 218, 243, 267, 308, 350, 400],   # 51-55
    8: [184, 196, 209, 233, 259, 282, 327, 370, 420],   # 56+
}

# Female bike pace standards (~2 mph slower)
FEMALE_BIKE_PACE_STANDARDS = {
    0: [164, 175, 189, 212, 240, 277, 327, 370, 424],   # 17-20
    1: [164, 175, 189, 212, 240, 277, 327, 370, 424],   # 21-25
    2: [169, 181, 195, 218, 245, 282, 335, 380, 436],   # 26-30
    3: [169, 181, 195, 218, 245, 282, 335, 380, 436],   # 31-35
    4: [177, 189, 204, 229, 257, 293, 346, 393, 450],   # 36-40
    5: [177, 189, 204, 229, 257, 293, 346, 393, 450],   # 41-45
    6: [189, 202, 218, 245, 274, 308, 360, 409, 469],   # 46-50
    7: [189, 202, 218, 245, 274, 308, 360, 409, 469],   # 51-55
    8: [200, 214, 231, 260, 290, 327, 380, 431, 495],   # 56+
}


def calculate_bike_score(
    pace_seconds_per_mile: int,
    age: int,
    is_female: bool = False,
    distance_miles: Optional[float] = None
) -> FitnessScore:
    """Calculate fitness score for a bike ride."""
    bracket_idx = get_age_bracket_index(age)
    standards = FEMALE_BIKE_PACE_STANDARDS if is_female else MALE_BIKE_PACE_STANDARDS
    thresholds = standards.get(bracket_idx, standards[1])
    factors = []

    score = _score_from_pace(pace_seconds_per_mile, thresholds, below_avg_buffer=120)

    # Bike speed for context
    if pace_seconds_per_mile > 0:
        mph = 3600 / pace_seconds_per_mile
        factors.append(f"Bike speed: {mph:.1f} mph ({pace_seconds_to_string(pace_seconds_per_mile)})")

    # Distance scaling
    validated = True
    validation_note = ""
    if distance_miles is not None:
        score, validated, validation_note = _apply_distance_scaling(score, distance_miles, "BIKE")
        if not validated:
            factors.append(validation_note)
        factors.append(f"Distance: {distance_miles:.1f} mi")

    # Confidence: outdoor cycling is medium confidence
    confidence = "MEDIUM"
    factors.append("Outdoor cycling — speed affected by terrain/wind")

    gender_str = "female" if is_female else "male"
    bracket = get_age_bracket(age)
    factors.append(f"Standards: {gender_str}, age {bracket[0]}-{bracket[1]}")

    score = max(0, min(100, score))
    tier, sub_tier, badge_color = classify_score(score)

    return FitnessScore(
        score=round(score, 1),
        tier=tier,
        sub_tier=sub_tier,
        badge_color=badge_color,
        explanation=f"{tier.value} {sub_tier}",
        contributing_factors=factors,
        validated=validated,
        validation_note=validation_note,
        confidence=confidence
    )


# ============================================
# SECTION 6: Row Standards (500m Split Primary)
# ============================================

# Male row 500m split standards (seconds)
# [SF_Exc, SF_Good, SF_Pass, Mar_Exc, Mar_Good, Mar_Pass, Civ_Exc, Civ_Good, Civ_Pass]
MALE_ROW_500M_STANDARDS = {
    0: [79, 83, 88, 96, 103, 110, 118, 128, 140],   # 17-20
    1: [79, 83, 88, 96, 103, 110, 118, 128, 140],   # 21-25
    2: [79, 83, 88, 96, 103, 110, 118, 128, 140],   # 26-30
    3: [80, 84, 89, 97, 105, 112, 120, 130, 142],   # 31-35
    4: [82, 87, 92, 100, 108, 116, 125, 135, 148],  # 36-40
    5: [82, 87, 92, 100, 108, 116, 125, 135, 148],  # 41-45
    6: [82, 87, 92, 100, 108, 116, 125, 135, 148],  # 46-50
    7: [84, 89, 95, 103, 112, 120, 130, 140, 153],  # 51-55
    8: [91, 96, 102, 111, 120, 129, 140, 152, 166], # 56+
}

# Female row 500m split standards (seconds)
FEMALE_ROW_500M_STANDARDS = {
    0: [98, 104, 110, 120, 130, 140, 152, 166, 182],   # 17-20
    1: [98, 104, 110, 120, 130, 140, 152, 166, 182],   # 21-25
    2: [98, 104, 110, 120, 130, 140, 152, 166, 182],   # 26-30
    3: [99, 105, 112, 122, 132, 142, 155, 168, 185],   # 31-35
    4: [97, 103, 110, 119, 129, 139, 150, 164, 180],   # 36-40
    5: [97, 103, 110, 119, 129, 139, 150, 164, 180],   # 41-45
    6: [104, 111, 118, 128, 139, 150, 162, 176, 194],  # 46-50
    7: [107, 114, 121, 132, 143, 155, 168, 182, 200],  # 51-55
    8: [112, 120, 128, 139, 151, 163, 177, 192, 210],  # 56+
}


def calculate_row_score(
    pace_seconds_per_mile: int,
    age: int,
    is_female: bool = False,
    distance_miles: Optional[float] = None
) -> FitnessScore:
    """
    Calculate fitness score for rowing.
    Converts pace_seconds_per_mile to 500m split, scores against 500m standards.
    """
    bracket_idx = get_age_bracket_index(age)
    standards = FEMALE_ROW_500M_STANDARDS if is_female else MALE_ROW_500M_STANDARDS
    thresholds = standards.get(bracket_idx, standards[1])
    factors = []

    # Convert pace_per_mile to 500m split
    # 500m = 0.31069 miles
    split_500m = pace_seconds_per_mile * 0.31069

    # Score against 500m standards (lower = faster = better)
    score = _score_from_pace(split_500m, thresholds, below_avg_buffer=60)

    factors.append(f"500m split: {_time_to_string(int(split_500m))}")

    # Distance scaling
    validated = True
    validation_note = ""
    if distance_miles is not None:
        score, validated, validation_note = _apply_distance_scaling(score, distance_miles, "ROW")
        if not validated:
            factors.append(validation_note)
        meters = distance_miles * 1609.34
        factors.append(f"Distance: {meters:.0f}m ({distance_miles:.2f} mi)")

    gender_str = "female" if is_female else "male"
    bracket = get_age_bracket(age)
    factors.append(f"Standards: {gender_str}, age {bracket[0]}-{bracket[1]}")

    score = max(0, min(100, score))
    tier, sub_tier, badge_color = classify_score(score)

    return FitnessScore(
        score=round(score, 1),
        tier=tier,
        sub_tier=sub_tier,
        badge_color=badge_color,
        explanation=f"{tier.value} {sub_tier}",
        contributing_factors=factors,
        validated=validated,
        validation_note=validation_note
    )


# ============================================
# SECTION 7: Strength Scoring
# ============================================

# Exercise name matching
EXERCISE_CATEGORIES = {
    "SQUAT": ["squat", "back squat", "front squat", "goblet squat"],
    "DEADLIFT": ["deadlift", "sumo deadlift", "trap bar", "rdl", "romanian"],
    "BENCH": ["bench", "bench press", "incline bench", "floor press", "dumbbell bench", "db bench"],
    "OHP": ["overhead press", "ohp", "military press", "shoulder press"],
    "PULLUP": ["pull-up", "pullup", "chin-up", "chinup", "chin up", "pull up"],
    "PUSHUP": ["push-up", "pushup", "push up"],
    "SITUP": ["sit-up", "situp", "sit up", "crunch", "crunches"],
    "PLANK": ["plank", "plank hold", "forearm plank"],
}


def _match_exercise(name: str) -> Optional[str]:
    """Fuzzy match exercise name to canonical category."""
    if not name:
        return None
    name_lower = name.lower().strip()
    for category, patterns in EXERCISE_CATEGORIES.items():
        for pattern in patterns:
            if pattern in name_lower or name_lower in pattern:
                return category
    return None


def _estimate_1rm(weight: float, reps: int) -> float:
    """Epley formula for estimated 1RM."""
    if reps <= 0 or weight <= 0:
        return 0
    if reps == 1:
        return weight
    return weight * (1 + reps / 30)


# BW Ratio Standards for Barbell Lifts
# [SF_Exc, SF_Good, SF_Pass, Mar_Exc, Mar_Good, Mar_Pass, Civ_Exc, Civ_Good, Civ_Pass]
MALE_BW_RATIO = {
    "SQUAT":    [2.50, 2.35, 2.20, 2.00, 1.85, 1.75, 1.50, 1.35, 1.25],
    "DEADLIFT": [2.75, 2.60, 2.50, 2.25, 2.10, 2.00, 1.75, 1.60, 1.50],
    "BENCH":    [1.75, 1.65, 1.50, 1.35, 1.25, 1.15, 1.00, 0.90, 0.85],
    "OHP":      [1.15, 1.08, 1.00, 0.90, 0.82, 0.75, 0.65, 0.58, 0.55],
}

FEMALE_BW_RATIO = {
    "SQUAT":    [2.00, 1.88, 1.75, 1.50, 1.38, 1.25, 1.10, 1.00, 0.90],
    "DEADLIFT": [2.25, 2.13, 2.00, 1.75, 1.63, 1.50, 1.25, 1.13, 1.00],
    "BENCH":    [1.15, 1.08, 1.00, 0.85, 0.78, 0.70, 0.55, 0.50, 0.45],
    "OHP":      [0.75, 0.70, 0.65, 0.55, 0.50, 0.45, 0.35, 0.33, 0.30],
}

# Age multiplier for barbell lift standards
STRENGTH_AGE_MULTIPLIER = {
    0: 0.90, 1: 0.97, 2: 1.00, 3: 1.00, 4: 0.97, 5: 0.93, 6: 0.88, 7: 0.83, 8: 0.78
}

# Bodyweight Exercise Rep Standards
# Pull-ups Male [SF_Exc, SF_Good, SF_Pass, Mar_Exc, Mar_Good, Mar_Pass, Civ_Exc, Civ_Good, Civ_Pass]
MALE_PULLUP_STANDARDS = {
    0: [20, 18, 16, 12, 8, 4, 3, 2, 1],    # 17-20
    1: [23, 21, 18, 14, 10, 5, 4, 3, 2],   # 21-25
    2: [23, 21, 18, 14, 10, 5, 4, 3, 2],   # 26-30
    3: [23, 21, 18, 14, 10, 5, 4, 3, 2],   # 31-35
    4: [21, 19, 17, 13, 9, 5, 4, 3, 2],    # 36-40
    5: [20, 18, 16, 12, 9, 5, 3, 2, 1],    # 41-45
    6: [19, 17, 15, 11, 8, 5, 3, 2, 1],    # 46-50
    7: [19, 17, 15, 11, 8, 4, 3, 2, 1],    # 51-55
    8: [19, 17, 15, 11, 8, 4, 3, 2, 1],    # 56+
}

FEMALE_PULLUP_STANDARDS = {
    0: [7, 6, 5, 3, 2, 1, 1, 0, 0],        # 17-20
    1: [11, 10, 9, 7, 5, 3, 2, 1, 1],      # 21-25
    2: [12, 11, 9, 7, 6, 4, 3, 2, 1],      # 26-30
    3: [11, 10, 9, 7, 5, 3, 2, 1, 1],      # 31-35
    4: [10, 9, 8, 6, 5, 3, 2, 1, 1],       # 36-40
    5: [8, 7, 6, 4, 3, 2, 1, 1, 0],        # 41-45
    6: [6, 5, 5, 3, 3, 2, 1, 1, 0],        # 46-50
    7: [4, 4, 3, 2, 2, 2, 1, 1, 0],        # 51-55
    8: [4, 4, 3, 2, 2, 2, 1, 1, 0],        # 56+
}

# Push-ups Male
MALE_PUSHUP_STANDARDS = {
    0: [82, 76, 70, 57, 50, 42, 30, 22, 15],   # 17-20
    1: [87, 81, 74, 60, 50, 40, 30, 22, 15],   # 21-25
    2: [84, 78, 72, 58, 49, 39, 28, 21, 14],   # 26-30
    3: [80, 74, 68, 55, 46, 36, 26, 19, 13],   # 31-35
    4: [76, 70, 64, 52, 43, 34, 24, 18, 12],   # 36-40
    5: [72, 66, 60, 48, 39, 30, 22, 16, 11],   # 41-45
    6: [68, 62, 56, 45, 35, 25, 18, 14, 9],    # 46-50
    7: [64, 58, 52, 40, 30, 20, 15, 12, 8],    # 51-55
    8: [64, 58, 52, 40, 30, 20, 15, 12, 8],    # 56+
}

FEMALE_PUSHUP_STANDARDS = {
    0: [42, 39, 35, 28, 24, 19, 14, 10, 7],    # 17-20
    1: [48, 44, 40, 32, 25, 18, 13, 10, 7],    # 21-25
    2: [50, 46, 42, 33, 26, 18, 13, 10, 7],    # 26-30
    3: [46, 42, 38, 30, 23, 16, 12, 9, 6],     # 31-35
    4: [43, 40, 36, 28, 21, 14, 10, 8, 5],     # 36-40
    5: [41, 38, 34, 26, 19, 12, 9, 7, 5],      # 41-45
    6: [40, 37, 33, 25, 18, 11, 8, 6, 4],      # 46-50
    7: [38, 35, 31, 23, 17, 10, 7, 5, 4],      # 51-55
    8: [38, 35, 31, 23, 17, 10, 7, 5, 4],      # 56+
}

# Plank standards (seconds, same for all ages/genders per USMC PFT)
# [SF_Exc, SF_Good, SF_Pass, Mar_Exc, Mar_Good, Mar_Pass, Civ_Exc, Civ_Good, Civ_Pass]
PLANK_STANDARDS = [225, 210, 195, 165, 135, 105, 90, 80, 70]

# Sit-ups/Crunches (supplemental, NOT PFT-derived)
MALE_CRUNCH_STANDARDS = {
    0: [105, 98, 90, 80, 75, 70, 50, 40, 30],   # 17-20
    1: [110, 103, 95, 83, 77, 70, 50, 40, 30],  # 21-25
    2: [115, 107, 98, 85, 78, 70, 50, 40, 30],  # 26-30
    3: [115, 107, 98, 85, 78, 70, 50, 40, 30],  # 31-35
    4: [110, 103, 95, 83, 77, 70, 50, 40, 30],  # 36-40
    5: [105, 98, 90, 78, 72, 65, 45, 35, 25],   # 41-45
    6: [100, 93, 85, 70, 60, 50, 35, 28, 20],   # 46-50
    7: [100, 90, 80, 65, 53, 40, 30, 22, 15],   # 51-55
    8: [100, 90, 80, 65, 53, 40, 30, 22, 15],   # 56+
}

# Female crunches (~85-90% of male)
FEMALE_CRUNCH_STANDARDS = {
    0: [89, 83, 77, 68, 64, 60, 43, 34, 26],   # 17-20
    1: [94, 88, 81, 71, 65, 60, 43, 34, 26],   # 21-25
    2: [98, 91, 83, 72, 66, 60, 43, 34, 26],   # 26-30
    3: [98, 91, 83, 72, 66, 60, 43, 34, 26],   # 31-35
    4: [94, 88, 81, 71, 65, 60, 43, 34, 26],   # 36-40
    5: [89, 83, 77, 66, 61, 55, 38, 30, 21],   # 41-45
    6: [85, 79, 72, 60, 51, 43, 30, 24, 17],   # 46-50
    7: [85, 77, 68, 55, 45, 34, 26, 19, 13],   # 51-55
    8: [85, 77, 68, 55, 45, 34, 26, 19, 13],   # 56+
}


def _score_exercise(exercise: dict, age: int, is_female: bool,
                    body_weight_lbs: float, bracket_idx: int) -> Optional[Tuple[float, str]]:
    """
    Score a single exercise from workout exercises JSON.
    Returns (score, description) or None if exercise not recognized.
    """
    name = exercise.get("exercise", "") or exercise.get("name", "")
    category = _match_exercise(name)
    if not category:
        return None

    reps = exercise.get("reps", 0) or 0
    weight = exercise.get("weight_lbs", 0) or exercise.get("weight", 0) or 0
    sets = exercise.get("sets", 1) or 1
    duration_sec = exercise.get("duration_seconds", 0) or exercise.get("duration", 0) or 0

    # Barbell lifts: BW ratio scoring
    if category in ["SQUAT", "DEADLIFT", "BENCH", "OHP"]:
        if weight <= 0 or reps <= 0:
            return None
        if not body_weight_lbs or body_weight_lbs <= 0:
            body_weight_lbs = 180  # Default

        e1rm = _estimate_1rm(weight, reps)
        ratio = e1rm / body_weight_lbs

        # Apply age multiplier to standards (age-adjusted thresholds)
        age_mult = STRENGTH_AGE_MULTIPLIER.get(bracket_idx, 1.0)
        bw_table = FEMALE_BW_RATIO if is_female else MALE_BW_RATIO
        base_thresholds = bw_table.get(category)
        if not base_thresholds:
            return None

        # Adjust thresholds: younger/older athletes get easier thresholds (multiply down)
        adjusted = [t * age_mult for t in base_thresholds]
        score = _score_from_value(ratio, adjusted)
        desc = f"{name}: {weight}×{reps} → e1RM {e1rm:.0f}lbs ({ratio:.2f}x BW)"
        return (score, desc)

    # Pull-ups: rep-based scoring
    if category == "PULLUP":
        max_reps = reps  # Already the max set typically
        table = FEMALE_PULLUP_STANDARDS if is_female else MALE_PULLUP_STANDARDS
        thresholds = table.get(bracket_idx, table[1])
        score = _score_from_value(max_reps, thresholds)
        return (score, f"Pull-ups: {max_reps} reps")

    # Push-ups: rep-based scoring
    if category == "PUSHUP":
        max_reps = reps
        table = FEMALE_PUSHUP_STANDARDS if is_female else MALE_PUSHUP_STANDARDS
        thresholds = table.get(bracket_idx, table[1])
        score = _score_from_value(max_reps, thresholds)
        return (score, f"Push-ups: {max_reps} reps")

    # Plank: time-based (same standards for all age/gender)
    if category == "PLANK":
        plank_time = duration_sec if duration_sec > 0 else (reps if reps > 10 else 0)
        if plank_time <= 0:
            return None
        score = _score_from_value(plank_time, PLANK_STANDARDS)
        return (score, f"Plank: {_time_to_string(int(plank_time))}")

    # Sit-ups/Crunches (supplemental)
    if category == "SITUP":
        max_reps = reps
        table = FEMALE_CRUNCH_STANDARDS if is_female else MALE_CRUNCH_STANDARDS
        thresholds = table.get(bracket_idx, table[1])
        score = _score_from_value(max_reps, thresholds)
        return (score, f"Crunches: {max_reps} reps (supplemental)")

    return None


def calculate_strength_score(
    exercises: Optional[List[dict]],
    age: int,
    is_female: bool = False,
    body_weight_lbs: Optional[float] = None,
    rpe: Optional[int] = None,
    duration_minutes: Optional[int] = None
) -> FitnessScore:
    """
    Calculate fitness score for a strength workout.
    Parses exercises JSON, scores each recognized exercise, averages.
    Falls back to RPE+duration if no recognized exercises.
    """
    bracket_idx = get_age_bracket_index(age)
    factors = []
    exercise_scores = []

    if exercises:
        # Handle string exercises (JSON encoded)
        if isinstance(exercises, str):
            try:
                exercises = json.loads(exercises)
            except (json.JSONDecodeError, TypeError):
                exercises = []

        if isinstance(exercises, list):
            for ex in exercises:
                if isinstance(ex, dict):
                    result = _score_exercise(ex, age, is_female,
                                             body_weight_lbs or 180, bracket_idx)
                    if result:
                        score_val, desc = result
                        exercise_scores.append(score_val)
                        factors.append(desc)

    if exercise_scores:
        avg_score = sum(exercise_scores) / len(exercise_scores)
        factors.insert(0, f"Scored {len(exercise_scores)} exercise(s)")
    elif rpe:
        # Fallback: RPE + duration
        avg_score = _score_from_rpe_duration(rpe, duration_minutes, cap=89)
        factors.append(f"RPE: {rpe}/10")
        if duration_minutes:
            factors.append(f"Duration: {duration_minutes} min")
        factors.append("Score estimated from perceived effort")
    else:
        return None

    gender_str = "female" if is_female else "male"
    bracket = get_age_bracket(age)
    factors.append(f"Standards: {gender_str}, age {bracket[0]}-{bracket[1]}")

    avg_score = max(0, min(100, avg_score))
    tier, sub_tier, badge_color = classify_score(avg_score)

    return FitnessScore(
        score=round(avg_score, 1),
        tier=tier,
        sub_tier=sub_tier,
        badge_color=badge_color,
        explanation=f"{tier.value} {sub_tier}",
        contributing_factors=factors
    )


# ============================================
# SECTION 8: HIIT/COMBAT Scoring
# ============================================

def _score_from_rpe_duration(rpe: int, duration_minutes: Optional[int],
                              cap: int = 89,
                              avg_heart_rate: Optional[int] = None,
                              max_heart_rate: Optional[int] = None,
                              age: Optional[int] = None) -> float:
    """
    Score from RPE and duration with optional HR bonus.
    Used for HIIT, COMBAT, and fallback strength scoring.
    """
    base = rpe * 8  # RPE 10 -> 80, RPE 7 -> 56

    # Duration bonus: log2-based scaling
    duration_bonus = 0
    if duration_minutes and duration_minutes > 0:
        if duration_minutes >= 15:
            duration_bonus = math.log2(duration_minutes / 15) * 8
        # Very short sessions still get some credit
        elif duration_minutes >= 5:
            duration_bonus = (duration_minutes / 15) * 4

    # HR bonus
    hr_bonus = 0
    actual_max_hr = None
    if max_heart_rate and max_heart_rate > 0:
        actual_max_hr = max_heart_rate
    elif age and age > 0:
        actual_max_hr = 220 - age  # Estimated, lower confidence

    if avg_heart_rate and actual_max_hr and actual_max_hr > 0:
        hr_pct = avg_heart_rate / actual_max_hr
        if hr_pct > 0.85:
            hr_bonus = 5
        elif hr_pct > 0.80:
            hr_bonus = 3

    score = base + duration_bonus + hr_bonus
    return min(cap, max(0, score))


def calculate_hiit_score(
    rpe: int,
    duration_minutes: Optional[int] = None,
    avg_heart_rate: Optional[int] = None,
    max_heart_rate: Optional[int] = None,
    age: Optional[int] = None
) -> FitnessScore:
    """
    Calculate fitness score for HIIT/COMBAT workouts.
    Cap at 96 (SF Good) — HIIT cannot reach SF Excellent.
    """
    factors = []
    score = _score_from_rpe_duration(
        rpe, duration_minutes, cap=96,
        avg_heart_rate=avg_heart_rate,
        max_heart_rate=max_heart_rate,
        age=age
    )

    factors.append(f"RPE: {rpe}/10")
    if duration_minutes:
        factors.append(f"Duration: {duration_minutes} min")
    if avg_heart_rate:
        factors.append(f"Avg HR: {avg_heart_rate} bpm")
        if max_heart_rate:
            hr_pct = avg_heart_rate / max_heart_rate * 100
            factors.append(f"HR intensity: {hr_pct:.0f}% of max ({max_heart_rate} bpm)")
        elif age:
            est_max = 220 - age
            hr_pct = avg_heart_rate / est_max * 100
            factors.append(f"HR intensity: {hr_pct:.0f}% of est max ({est_max} bpm, estimated)")

    confidence = "HIGH"
    if max_heart_rate is None and age:
        confidence = "MEDIUM"
        factors.append("Max HR estimated from age (220-age)")

    tier, sub_tier, badge_color = classify_score(score)

    return FitnessScore(
        score=round(score, 1),
        tier=tier,
        sub_tier=sub_tier,
        badge_color=badge_color,
        explanation=f"{tier.value} {sub_tier}",
        contributing_factors=factors,
        confidence=confidence
    )


# ============================================
# SECTION 9: PT_TEST Scoring (PFT/CFT Mapping)
# ============================================

# PFT (0-300) -> Our Score (0-100)
# 1st Class PFT (235+) = Marine Excellent. SF requires exceeding 1st Class.
PFT_CLASS_MAPPING = [
    (300, 100),
    (285, 97),    # SF Excellent
    (270, 94),    # SF Good
    (250, 90),    # SF Passing
    (235, 84),    # Marine Excellent — 1st Class boundary
    (210, 77),    # Marine Good
    (200, 70),    # Marine Passing — 2nd Class boundary
    (150, 55),    # Civilian Good — 3rd Class boundary
    (120, 40),    # Civilian Passing
    (0, 0),
]

# CFT same mapping
CFT_CLASS_MAPPING = [
    (300, 100),
    (285, 97),
    (270, 94),
    (250, 90),
    (235, 84),
    (210, 77),
    (200, 70),
    (150, 55),
    (120, 40),
    (0, 0),
]


def _map_test_score(raw_score: float, mapping: list) -> float:
    """Map a raw test score (0-300 typically) to our 0-100 using anchor interpolation."""
    if raw_score >= mapping[0][0]:
        return mapping[0][1]
    if raw_score <= mapping[-1][0]:
        return mapping[-1][1]

    for i in range(len(mapping) - 1):
        upper_raw, upper_out = mapping[i]
        lower_raw, lower_out = mapping[i + 1]
        if raw_score >= lower_raw:
            ratio = (raw_score - lower_raw) / max(1, upper_raw - lower_raw)
            return lower_out + ratio * (upper_out - lower_out)

    return 0


def calculate_pt_test_score(
    score: Optional[float] = None,
    test_standard: Optional[str] = None,
    rpe: Optional[int] = None,
    duration_minutes: Optional[int] = None
) -> Optional[FitnessScore]:
    """
    Calculate fitness score for a PT test.
    If score and test_standard provided, maps PFT/CFT to our scale.
    Otherwise falls back to RPE.
    """
    factors = []

    if score is not None:
        if test_standard and "PFT" in test_standard.upper():
            our_score = _map_test_score(score, PFT_CLASS_MAPPING)
            factors.append(f"PFT score: {score:.0f}/300")
            factors.append(f"Mapped: {our_score:.1f}/100")
        elif test_standard and "CFT" in test_standard.upper():
            our_score = _map_test_score(score, CFT_CLASS_MAPPING)
            factors.append(f"CFT score: {score:.0f}/300")
            factors.append(f"Mapped: {our_score:.1f}/100")
        else:
            # Assume raw 0-100 scale
            our_score = max(0, min(100, score))
            factors.append(f"Test score: {score:.0f}")
            if test_standard:
                factors.append(f"Standard: {test_standard}")
    elif rpe:
        our_score = _score_from_rpe_duration(rpe, duration_minutes, cap=89)
        factors.append(f"RPE: {rpe}/10")
        if duration_minutes:
            factors.append(f"Duration: {duration_minutes} min")
        factors.append("Score estimated from perceived effort")
    else:
        return None

    our_score = max(0, min(100, our_score))
    tier, sub_tier, badge_color = classify_score(our_score)

    return FitnessScore(
        score=round(our_score, 1),
        tier=tier,
        sub_tier=sub_tier,
        badge_color=badge_color,
        explanation=f"{tier.value} {sub_tier}",
        contributing_factors=factors
    )


# ============================================
# SECTION 10: MOBILITY Scoring
# ============================================

def calculate_mobility_score(duration_minutes: Optional[int] = None) -> FitnessScore:
    """
    Participation credit, hard-capped at Civilian Excellent (69).
    """
    if duration_minutes and duration_minutes >= 60:
        score = 69
    elif duration_minutes and duration_minutes >= 45:
        score = 65
    elif duration_minutes and duration_minutes >= 30:
        score = 60
    elif duration_minutes and duration_minutes >= 15:
        score = 55
    else:
        score = 45

    factors = [
        f"Duration: {duration_minutes or 0} min",
        "Mobility: participation credit (capped at Civilian Excellent)"
    ]

    tier, sub_tier, badge_color = classify_score(score)

    return FitnessScore(
        score=round(score, 1),
        tier=tier,
        sub_tier=sub_tier,
        badge_color=badge_color,
        explanation=f"{tier.value} {sub_tier}",
        contributing_factors=factors
    )


# ============================================
# Main Workout Scoring Dispatcher
# ============================================

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
    exercises: Optional[List[dict]] = None,
    score: Optional[float] = None,
    avg_heart_rate: Optional[int] = None,
    max_heart_rate: Optional[int] = None,
    test_standard: Optional[str] = None
) -> Optional[FitnessScore]:
    """
    Calculate fitness score for any workout type.
    Returns None if insufficient data for scoring.
    """
    workout_type_upper = workout_type.upper() if workout_type else "OTHER"

    # RUN: PFT-based scoring
    if workout_type_upper == "RUN":
        if pace_seconds_per_mile and pace_seconds_per_mile > 0:
            return calculate_run_score(
                pace_seconds_per_mile=pace_seconds_per_mile,
                age=age,
                is_female=is_female,
                distance_miles=distance_miles
            )

    # RUCK: MARSOC-anchored with weight adjustment
    if workout_type_upper == "RUCK":
        if pace_seconds_per_mile and pace_seconds_per_mile > 0 and weight_carried_lbs:
            return calculate_ruck_score(
                pace_seconds_per_mile=pace_seconds_per_mile,
                weight_carried_lbs=weight_carried_lbs,
                body_weight_lbs=body_weight_lbs or 180,
                age=age,
                is_female=is_female,
                distance_miles=distance_miles
            )

    # SWIM: 300m standard-based
    if workout_type_upper == "SWIM":
        if pace_seconds_per_mile and pace_seconds_per_mile > 0:
            return calculate_swim_score(
                pace_seconds_per_mile=pace_seconds_per_mile,
                age=age,
                is_female=is_female,
                distance_miles=distance_miles
            )

    # BIKE: population-based with confidence
    if workout_type_upper == "BIKE":
        if pace_seconds_per_mile and pace_seconds_per_mile > 0:
            return calculate_bike_score(
                pace_seconds_per_mile=pace_seconds_per_mile,
                age=age,
                is_female=is_female,
                distance_miles=distance_miles
            )

    # ROW: 500m split-based
    if workout_type_upper == "ROW":
        if pace_seconds_per_mile and pace_seconds_per_mile > 0:
            return calculate_row_score(
                pace_seconds_per_mile=pace_seconds_per_mile,
                age=age,
                is_female=is_female,
                distance_miles=distance_miles
            )

    # STRENGTH: exercise-level scoring
    if workout_type_upper == "STRENGTH":
        return calculate_strength_score(
            exercises=exercises,
            age=age,
            is_female=is_female,
            body_weight_lbs=body_weight_lbs,
            rpe=rpe,
            duration_minutes=duration_minutes
        )

    # HIIT / COMBAT: RPE × duration + HR bonus
    if workout_type_upper in ["HIIT", "COMBAT"]:
        if rpe:
            return calculate_hiit_score(
                rpe=rpe,
                duration_minutes=duration_minutes,
                avg_heart_rate=avg_heart_rate,
                max_heart_rate=max_heart_rate,
                age=age
            )

    # PT_TEST: PFT/CFT class mapping
    if workout_type_upper == "PT_TEST":
        return calculate_pt_test_score(
            score=score,
            test_standard=test_standard,
            rpe=rpe,
            duration_minutes=duration_minutes
        )

    # MOBILITY: participation credit
    if workout_type_upper == "MOBILITY":
        return calculate_mobility_score(duration_minutes=duration_minutes)

    # Fallback: RPE-based for any other type with RPE
    if rpe:
        base_score = _score_from_rpe_duration(rpe, duration_minutes, cap=89,
                                               avg_heart_rate=avg_heart_rate,
                                               max_heart_rate=max_heart_rate,
                                               age=age)
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

    return None


# ============================================
# SECTION 12: Composite/Overall Score
# ============================================

# Type categories for composite scoring
COMPOSITE_TYPE_MAP = {
    "RUN": "CARDIO_RUN",
    "RUCK": "CARDIO_RUCK",
    "SWIM": "CARDIO_SWIM",
    "BIKE": "CARDIO_BIKE",
    "ROW": "CARDIO_ROW",
    "STRENGTH": "STRENGTH",
    "HIIT": "HIIT",
    "COMBAT": "HIIT",       # COMBAT grouped with HIIT
    "PT_TEST": "PT_TEST",
    "MOBILITY": "MOBILITY",
}


def get_fitness_profile(
    workouts: List[dict],
    age: int,
    is_female: bool = False,
    body_weight_lbs: Optional[float] = None
) -> Dict[str, Any]:
    """
    Generate a comprehensive fitness profile from workout history.

    Composite score = average of BEST recent score per workout type category.
    - Best per type, not average all (recovery jog doesn't drag down run score)
    - Only score types you do (no penalty for missing types)
    - No minimum frequency
    - 90-day rolling window
    """
    best_by_category: Dict[str, float] = {}
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
            exercises=workout.get("exercises"),
            score=workout.get("score"),
            avg_heart_rate=workout.get("avg_heart_rate"),
            max_heart_rate=workout.get("max_heart_rate"),
            test_standard=workout.get("test_standard"),
        )

        if score_result:
            wtype_upper = workout_type.upper() if workout_type else "OTHER"

            if wtype_upper not in scores_by_type:
                scores_by_type[wtype_upper] = []
            scores_by_type[wtype_upper].append(score_result.score)
            all_scores.append(score_result.score)

            # Track best per composite category
            category = COMPOSITE_TYPE_MAP.get(wtype_upper, wtype_upper)
            if category not in best_by_category or score_result.score > best_by_category[category]:
                best_by_category[category] = score_result.score

            scored_workouts.append({
                "workout_id": workout.get("id"),
                "date": workout.get("workout_date"),
                "type": workout_type,
                "score": score_result.score,
                "tier": score_result.tier.value,
                "sub_tier": score_result.sub_tier,
                "badge_color": score_result.badge_color,
                "validated": score_result.validated,
                "confidence": score_result.confidence,
            })

    # Calculate averages by type (for display)
    type_averages = {}
    for wtype, scores in scores_by_type.items():
        avg_score = sum(scores) / len(scores)
        best_score = max(scores)
        tier, sub_tier, badge_color = classify_score(best_score)
        type_averages[wtype] = {
            "average_score": round(avg_score, 1),
            "best_score": round(best_score, 1),
            "workout_count": len(scores),
            "tier": tier.value,
            "sub_tier": sub_tier,
            "badge_color": badge_color
        }

    # Composite: average of BEST scores per category
    if best_by_category:
        overall_score = sum(best_by_category.values()) / len(best_by_category)
    else:
        overall_score = None

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
        "categories_scored": len(best_by_category),
        "best_by_category": {k: round(v, 1) for k, v in best_by_category.items()},
        "by_type": type_averages,
        "recent_scored_workouts": scored_workouts[-10:] if scored_workouts else [],
        "age_bracket": get_age_bracket(age),
        "gender": "female" if is_female else "male"
    }


# ============================================
# Tier Thresholds (for API/display)
# ============================================

def get_tier_thresholds() -> Dict[str, Any]:
    """Return threshold information for display/documentation."""
    return {
        "tiers": {
            "CIVILIAN": {
                "score_range": [0, 69],
                "badge_color": "blue",
                "sub_tiers": {
                    "Below Average": [0, 39],
                    "Passing": [40, 54],
                    "Good": [55, 64],
                    "Excellent": [65, 69]
                }
            },
            "MARINE": {
                "score_range": [70, 89],
                "badge_color": "green",
                "sub_tiers": {
                    "Passing": [70, 76],
                    "Good": [77, 83],
                    "Excellent": [84, 89]
                }
            },
            "SF": {
                "score_range": [90, 100],
                "badge_color": "gold",
                "sub_tiers": {
                    "Passing": [90, 93],
                    "Good": [94, 96],
                    "Excellent": [97, 100]
                }
            }
        },
        "age_brackets": AGE_BRACKETS,
        "scoring_methods": {
            "RUN": "USMC PFT 3-mile run scoring function",
            "RUCK": "MARSOC A&S anchored pace tables (4mi full credit)",
            "SWIM": "300m continuous swim time standards",
            "BIKE": "Population speed data (medium confidence for outdoor)",
            "ROW": "500m split time standards",
            "STRENGTH": "BW ratio + PFT bodyweight exercise standards",
            "HIIT": "RPE × duration + HR bonus (capped at SF Good)",
            "COMBAT": "RPE × duration + HR bonus (capped at SF Good)",
            "PT_TEST": "PFT/CFT class-based mapping (0-300 → 0-100)",
            "MOBILITY": "Participation credit (capped at Civilian Excellent)",
        }
    }
