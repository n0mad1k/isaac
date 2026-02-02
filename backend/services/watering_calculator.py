"""
Watering Calculator Service

Calculates watering intervals based on:
1. Plant moisture preference (from PFAF or user override)
2. USDA zone (climate adjustment)
3. Season (summer needs more water than winter)
4. Watering history (skip patterns suggest interval adjustments)
"""

from datetime import datetime
from typing import Optional, Dict, List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from loguru import logger

from models.plants import PlantCareLog


# Base watering intervals by moisture preference (days)
# These are baseline for moderate zones (6-7)
BASE_INTERVALS = {
    "dry": {"summer": 14, "winter": 21, "spring": 16, "fall": 18},
    "dry_moist": {"summer": 10, "winter": 14, "spring": 12, "fall": 12},
    "moist": {"summer": 7, "winter": 10, "spring": 8, "fall": 8},
    "moist_wet": {"summer": 5, "winter": 7, "spring": 6, "fall": 6},
    "wet": {"summer": 3, "winter": 5, "spring": 4, "fall": 4},
}

# Zone modifiers (multiply base interval)
# Lower = water more often, Higher = water less often
ZONE_MODIFIERS = {
    # Hot zones - more evaporation, water more often
    "13a": 0.6, "13b": 0.6,
    "12a": 0.65, "12b": 0.65,
    "11a": 0.7, "11b": 0.7,
    "10a": 0.75, "10b": 0.75,
    "9a": 0.8, "9b": 0.8,
    # Warm-moderate zones
    "8a": 0.9, "8b": 0.9,
    # Moderate zones - baseline
    "7a": 1.0, "7b": 1.0,
    "6a": 1.0, "6b": 1.0,
    # Cool zones - less evaporation
    "5a": 1.1, "5b": 1.1,
    "4a": 1.2, "4b": 1.2,
    "3a": 1.3, "3b": 1.3,
    "2a": 1.4, "2b": 1.4,
    "1a": 1.5, "1b": 1.5,
}


def get_current_season() -> str:
    """Determine season from current month."""
    month = datetime.now().month
    if month in [12, 1, 2]:
        return "winter"
    elif month in [3, 4, 5]:
        return "spring"
    elif month in [6, 7, 8]:
        return "summer"
    else:
        return "fall"


def calculate_watering_interval(
    moisture_preference: str,
    usda_zone: str = "7a",
    season: str = None
) -> int:
    """
    Calculate recommended watering interval in days.

    Args:
        moisture_preference: dry, dry_moist, moist, moist_wet, wet
        usda_zone: e.g., "9b", "7a"
        season: override season (default: current)

    Returns:
        Recommended days between watering
    """
    if not season:
        season = get_current_season()

    # Get base interval for moisture preference
    if moisture_preference not in BASE_INTERVALS:
        logger.warning(f"Unknown moisture preference '{moisture_preference}', defaulting to 'moist'")
    base = BASE_INTERVALS.get(moisture_preference, BASE_INTERVALS["moist"])
    interval = base.get(season, 7)

    # Apply zone modifier
    zone_key = usda_zone.lower() if usda_zone else "7a"
    if not usda_zone:
        logger.warning("No USDA zone provided, defaulting to '7a'")
    elif zone_key not in ZONE_MODIFIERS:
        logger.warning(f"Unknown USDA zone '{usda_zone}', using modifier 1.0")
    zone_mod = ZONE_MODIFIERS.get(zone_key, 1.0)
    interval = round(interval * zone_mod)

    # Clamp to reasonable range (2-45 days)
    result = max(2, min(45, interval))
    logger.info(f"Watering interval calculated: {result} days (moisture={moisture_preference}, zone={usda_zone}, season={season})")
    return result


def generate_water_schedule(
    moisture_preference: str,
    usda_zone: str = "7a"
) -> str:
    """
    Generate a full seasonal water_schedule string.
    Format: "summer:X,winter:Y,spring:Z,fall:W"
    """
    seasons = ["summer", "winter", "spring", "fall"]
    parts = []
    for season in seasons:
        days = calculate_watering_interval(moisture_preference, usda_zone, season)
        parts.append(f"{season}:{days}")
    schedule = ",".join(parts)
    logger.info(f"Generated water schedule for moisture={moisture_preference}, zone={usda_zone}: {schedule}")
    return schedule


async def analyze_watering_history(
    db: AsyncSession,
    plant_id: int,
    lookback_count: int = 10
) -> Dict:
    """
    Analyze recent watering history for a plant to detect patterns.

    Returns:
        {
            "total_events": int,
            "waters": int,
            "skips": int,
            "skip_rate": float (0-1),
            "avg_days_between": float or None,
            "suggestion": str or None,
            "suggested_adjustment": int or None (days to add/subtract)
        }
    """
    result = await db.execute(
        select(PlantCareLog)
        .where(PlantCareLog.plant_id == plant_id)
        .where(PlantCareLog.care_type.in_(["watered", "skipped"]))
        .order_by(PlantCareLog.performed_at.desc())
        .limit(lookback_count)
    )
    logs = result.scalars().all()

    if not logs:
        logger.warning(f"No watering history found for plant_id={plant_id}")
        return {
            "total_events": 0,
            "waters": 0,
            "skips": 0,
            "skip_rate": 0,
            "avg_days_between": None,
            "suggestion": None,
            "suggested_adjustment": None,
        }

    waters = [l for l in logs if l.care_type == "watered"]
    skips = [l for l in logs if l.care_type == "skipped"]
    total = len(logs)

    skip_rate = len(skips) / total if total > 0 else 0

    # Calculate average days between actual waterings
    avg_days = None
    if len(waters) >= 2:
        intervals = []
        for i in range(len(waters) - 1):
            delta = (waters[i].performed_at - waters[i + 1].performed_at).days
            if delta > 0:
                intervals.append(delta)
        if intervals:
            avg_days = sum(intervals) / len(intervals)

    # Generate suggestion based on patterns
    suggestion = None
    suggested_adjustment = None

    if total >= 5:  # Need enough data
        if skip_rate >= 0.5:
            # Skipping half or more - interval too short
            suggestion = f"You've skipped {len(skips)} of last {total} waterings. Consider increasing interval."
            suggested_adjustment = 2  # Add 2 days
        elif skip_rate >= 0.3:
            suggestion = f"You've skipped {len(skips)} of last {total} waterings. Interval may be too short."
            suggested_adjustment = 1
        elif skip_rate == 0 and avg_days and len(waters) >= 3:
            # Check if watering consistently earlier than scheduled
            early_waters = [l for l in waters if l.scheduled_interval and l.days_since_last_water
                           and l.days_since_last_water < l.scheduled_interval - 1]
            if len(early_waters) >= 3:
                suggestion = "You often water before schedule. Consider decreasing interval."
                suggested_adjustment = -1

    logger.info(f"Watering history analysis for plant_id={plant_id}: {len(waters)} waters, {len(skips)} skips, skip_rate={round(skip_rate, 2)}, avg_days={round(avg_days, 1) if avg_days else None}")
    return {
        "total_events": total,
        "waters": len(waters),
        "skips": len(skips),
        "skip_rate": round(skip_rate, 2),
        "avg_days_between": round(avg_days, 1) if avg_days else None,
        "suggestion": suggestion,
        "suggested_adjustment": suggested_adjustment,
    }


def get_moisture_label(moisture_preference: str) -> str:
    """Get human-readable label for moisture preference."""
    labels = {
        "dry": "Drought Tolerant",
        "dry_moist": "Low Water",
        "moist": "Average",
        "moist_wet": "High Water",
        "wet": "Bog/Aquatic",
    }
    return labels.get(moisture_preference, "Average")
