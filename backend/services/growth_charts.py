"""
Growth chart percentile calculations using CDC LMS parameters.
Calculates z-scores and percentiles for weight-for-age, height-for-age, and BMI-for-age.
"""

import json
import math
import os
from datetime import datetime
from typing import Optional, Tuple

from loguru import logger

# Load CDC growth reference data
_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "reference_data")
_growth_data = None
_milestone_data = None


def _load_growth_data():
    global _growth_data
    if _growth_data is None:
        path = os.path.join(_DATA_DIR, "cdc_growth_charts.json")
        with open(path, "r") as f:
            _growth_data = json.load(f)
    return _growth_data


def _load_milestone_data():
    global _milestone_data
    if _milestone_data is None:
        path = os.path.join(_DATA_DIR, "developmental_milestones.json")
        with open(path, "r") as f:
            _milestone_data = json.load(f)
    return _milestone_data


def _normal_cdf(z: float) -> float:
    """
    Approximate the standard normal cumulative distribution function.
    Uses the Abramowitz and Stegun approximation (error < 7.5e-8).
    """
    if z < -8:
        return 0.0
    if z > 8:
        return 1.0

    a1 = 0.254829592
    a2 = -0.284496736
    a3 = 1.421413741
    a4 = -1.453152027
    a5 = 1.061405429
    p = 0.3275911

    sign = 1 if z >= 0 else -1
    z_abs = abs(z)

    t = 1.0 / (1.0 + p * z_abs)
    y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * math.exp(-z_abs * z_abs / 2.0)

    return 0.5 * (1.0 + sign * y)


def _get_lms(gender: str, measurement_type: str, age_months: int) -> Optional[Tuple[float, float, float]]:
    """Get LMS parameters for a given gender, measurement type, and age in months."""
    data = _load_growth_data()

    key = f"{measurement_type}_for_age"
    if key not in data:
        return None

    gender_key = gender.lower()
    if gender_key not in data[key]:
        return None

    entries = data[key][gender_key]

    # Find exact match or closest
    for entry in entries:
        if entry["month"] == age_months:
            return entry["L"], entry["M"], entry["S"]

    # If exact month not found, interpolate between closest
    lower = None
    upper = None
    for entry in entries:
        if entry["month"] <= age_months:
            lower = entry
        if entry["month"] >= age_months and upper is None:
            upper = entry

    if lower is None or upper is None:
        return None

    if lower["month"] == upper["month"]:
        return lower["L"], lower["M"], lower["S"]

    # Linear interpolation
    frac = (age_months - lower["month"]) / (upper["month"] - lower["month"])
    L = lower["L"] + frac * (upper["L"] - lower["L"])
    M = lower["M"] + frac * (upper["M"] - lower["M"])
    S = lower["S"] + frac * (upper["S"] - lower["S"])

    return L, M, S


def calculate_zscore(L: float, M: float, S: float, value: float) -> float:
    """
    Calculate z-score using the LMS method.
    Z = ((value/M)^L - 1) / (L * S)  when L != 0
    Z = ln(value/M) / S              when L == 0
    """
    if M <= 0 or S <= 0:
        return 0.0

    if abs(L) < 0.001:
        # L approximately 0, use log formula
        if value <= 0:
            return -4.0
        return math.log(value / M) / S
    else:
        if value <= 0:
            return -4.0
        return (math.pow(value / M, L) - 1) / (L * S)


def calculate_percentile(
    gender: str,
    age_months: int,
    measurement_type: str,
    value: float
) -> Optional[dict]:
    """
    Calculate growth percentile for a given measurement.

    Args:
        gender: "male" or "female"
        age_months: Age in months (0-240)
        measurement_type: "weight", "height", or "bmi"
        value: Measurement value in metric units (kg for weight, cm for height, kg/m^2 for BMI)

    Returns:
        dict with z_score, percentile, and status, or None if data unavailable
    """
    lms = _get_lms(gender, measurement_type, age_months)
    if lms is None:
        return None

    L, M, S = lms
    z = calculate_zscore(L, M, S, value)

    # Clamp z-score to reasonable range
    z = max(-4.0, min(4.0, z))

    percentile = round(_normal_cdf(z) * 100, 1)
    status = get_growth_status(percentile, measurement_type)

    return {
        "z_score": round(z, 2),
        "percentile": percentile,
        "status": status,
        "median": round(M, 2)
    }


def get_growth_status(percentile: float, measurement_type: str = None) -> str:
    """
    Determine growth status from percentile.
    Returns: "on_track", "monitor", or "concern"

    For height: Only low percentiles are concerning (short stature may indicate growth issues).
                High percentiles (tall) are generally not a medical concern for children.
    For weight/BMI: Both low and high percentiles are concerning.
    """
    # For height, only flag LOW percentiles as concerning
    if measurement_type == "height":
        if percentile < 3:
            return "concern"
        elif percentile < 10:
            return "monitor"
        else:
            return "on_track"

    # For weight and BMI, flag both extremes
    if percentile < 3 or percentile > 97:
        return "concern"
    elif percentile < 10 or percentile > 90:
        return "monitor"
    else:
        return "on_track"


def get_percentile_curves(gender: str, measurement_type: str) -> Optional[dict]:
    """
    Get reference percentile curves for charting.
    Returns data points for 3rd, 10th, 25th, 50th, 75th, 90th, 97th percentile lines.

    Args:
        gender: "male" or "female"
        measurement_type: "weight", "height", or "bmi"

    Returns:
        dict with percentile_lines array, each containing month/value pairs
    """
    data = _load_growth_data()
    key = f"{measurement_type}_for_age"
    if key not in data:
        return None

    gender_key = gender.lower()
    if gender_key not in data[key]:
        return None

    entries = data[key][gender_key]
    target_z = {
        3: -1.88079,
        10: -1.28155,
        25: -0.67449,
        50: 0.0,
        75: 0.67449,
        90: 1.28155,
        97: 1.88079
    }

    percentile_lines = {}
    for pct, z in target_z.items():
        points = []
        for entry in entries:
            L, M, S = entry["L"], entry["M"], entry["S"]
            # Inverse LMS: value = M * (1 + L*S*Z)^(1/L) when L != 0
            # value = M * exp(S*Z) when L == 0
            if abs(L) < 0.001:
                val = M * math.exp(S * z)
            else:
                inner = 1 + L * S * z
                if inner <= 0:
                    # Skip invalid points
                    continue
                val = M * math.pow(inner, 1.0 / L)

            points.append({
                "month": entry["month"],
                "value": round(val, 2)
            })
        percentile_lines[str(pct)] = points

    return {"percentile_lines": percentile_lines}


def get_growth_velocity(
    gender: str,
    measurement_type: str,
    data_points: list
) -> Optional[dict]:
    """
    Analyze growth velocity - whether child is maintaining their percentile band.

    Args:
        gender: "male" or "female"
        measurement_type: "weight" or "height"
        data_points: list of dicts with "age_months" and "value" (metric units), sorted by age

    Returns:
        dict with velocity analysis
    """
    if len(data_points) < 2:
        return {"status": "insufficient_data", "message": "Need at least 2 data points"}

    # Calculate percentiles for each data point
    percentiles = []
    for dp in data_points:
        result = calculate_percentile(gender, dp["age_months"], measurement_type, dp["value"])
        if result:
            percentiles.append({
                "age_months": dp["age_months"],
                "percentile": result["percentile"],
                "value": dp["value"]
            })

    if len(percentiles) < 2:
        return {"status": "insufficient_data", "message": "Could not calculate enough percentiles"}

    # Compare first and last percentile
    first = percentiles[0]
    last = percentiles[-1]
    pct_change = last["percentile"] - first["percentile"]

    # Determine if crossing percentile lines (significant change > 25 percentile points)
    if abs(pct_change) < 10:
        status = "stable"
        message = f"Tracking steadily around the {last['percentile']:.0f}th percentile"
    elif abs(pct_change) < 25:
        direction = "up" if pct_change > 0 else "down"
        status = "minor_shift"
        message = f"Shifted {direction} from {first['percentile']:.0f}th to {last['percentile']:.0f}th percentile"
    else:
        direction = "up" if pct_change > 0 else "down"
        status = "major_shift"
        message = f"Crossed from {first['percentile']:.0f}th to {last['percentile']:.0f}th percentile — discuss with pediatrician"

    return {
        "status": status,
        "message": message,
        "percentile_change": round(pct_change, 1),
        "current_percentile": last["percentile"],
        "data_points": percentiles
    }


def get_milestones_for_age(age_months: int) -> list:
    """
    Get applicable milestone checklists for a given age.
    Returns milestones for the current age group and all previous groups.

    Args:
        age_months: Child's age in months

    Returns:
        list of age group dicts with their milestones
    """
    data = _load_milestone_data()
    applicable = []

    for group in data["age_groups"]:
        applicable.append(group)

    return applicable


def calculate_age_months(birth_date: datetime) -> int:
    """Calculate age in months from birth date."""
    today = datetime.utcnow()
    months = (today.year - birth_date.year) * 12 + (today.month - birth_date.month)
    if today.day < birth_date.day:
        months -= 1
    return max(0, months)


def lbs_to_kg(lbs: float) -> float:
    """Convert pounds to kilograms."""
    return lbs * 0.453592


def inches_to_cm(inches: float) -> float:
    """Convert inches to centimeters."""
    return inches * 2.54


def kg_to_lbs(kg: float) -> float:
    """Convert kilograms to pounds."""
    return kg / 0.453592


def cm_to_inches(cm: float) -> float:
    """Convert centimeters to inches."""
    return cm / 2.54
