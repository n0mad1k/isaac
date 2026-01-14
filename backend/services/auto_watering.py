"""
Automatic Plant Watering Service

Redesigned approach:
- On each plant's scheduled watering day, check accumulated rainfall since last watering
- If rainfall >= threshold, SKIP watering (mark as rain-watered)
- If rainfall < threshold, the plant needs manual watering (reminder stays active)

This is more accurate than the old approach which marked plants watered
immediately on any rainy day.
"""

import logging
from datetime import datetime, date, timedelta
from typing import Dict, Optional, List, Tuple

from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from models.plants import Plant
from models.weather import WeatherReading
from models.settings import AppSetting

logger = logging.getLogger(__name__)

# Data retention: 45 days covers even drought-tolerant plants (cacti ~2-6 weeks)
WEATHER_RETENTION_DAYS = 45


async def get_setting(db: AsyncSession, key: str, default: str = None) -> Optional[str]:
    """Get a setting value from the database."""
    result = await db.execute(
        select(AppSetting).where(AppSetting.key == key)
    )
    setting = result.scalar_one_or_none()
    return setting.value if setting else default


async def get_daily_rain_totals(db: AsyncSession, since_date: datetime) -> Dict[date, float]:
    """
    Get daily rain totals since a given date.
    Returns a dict mapping date -> max daily rain for that day.

    This is queried once and reused for all plants to avoid N+1 queries.
    """
    if not since_date:
        return {}

    result = await db.execute(
        select(
            func.date(WeatherReading.reading_time).label('day'),
            func.max(WeatherReading.rain_daily).label('daily_rain')
        )
        .where(WeatherReading.reading_time >= since_date)
        .group_by(func.date(WeatherReading.reading_time))
    )

    return {row.day: row.daily_rain or 0.0 for row in result.all()}


def calculate_rain_since(daily_totals: Dict[date, float], since_date: date) -> float:
    """
    Calculate accumulated rain from cached daily totals since a specific date.
    """
    total = 0.0
    for day, rain in daily_totals.items():
        if day >= since_date:
            total += rain
    return total


async def cleanup_old_weather_readings(db: AsyncSession) -> int:
    """
    Delete weather readings older than WEATHER_RETENTION_DAYS.
    Returns number of records deleted.
    """
    cutoff = datetime.now() - timedelta(days=WEATHER_RETENTION_DAYS)

    result = await db.execute(
        delete(WeatherReading).where(WeatherReading.reading_time < cutoff)
    )

    deleted = result.rowcount
    if deleted > 0:
        await db.commit()
        logger.info(f"Cleaned up {deleted} weather readings older than {WEATHER_RETENTION_DAYS} days")

    return deleted


async def get_soil_moisture_for_watering(db: AsyncSession) -> tuple:
    """
    Get soil moisture data for watering decisions.
    Returns (enabled, current_moisture, threshold, should_skip)
    """
    # Check if soil moisture feature is enabled
    enabled = await get_setting(db, "awn_soil_moisture_enabled", "false")
    if enabled != "true":
        return False, None, None, False

    # Get threshold
    threshold_str = await get_setting(db, "awn_soil_moisture_threshold", "50")
    try:
        threshold = int(threshold_str)
    except ValueError:
        threshold = 50

    # Get latest weather reading with soil moisture
    result = await db.execute(
        select(WeatherReading)
        .where(WeatherReading.reading_time >= datetime.now() - timedelta(hours=6))  # Recent readings only
        .order_by(WeatherReading.reading_time.desc())
        .limit(1)
    )
    reading = result.scalar_one_or_none()

    if not reading:
        return True, None, threshold, False

    # Check if any soil moisture sensor has data
    moisture = None
    if reading.soil_moisture_1 is not None:
        moisture = reading.soil_moisture_1
    elif reading.soil_moisture_2 is not None:
        moisture = reading.soil_moisture_2
    elif reading.soil_moisture_3 is not None:
        moisture = reading.soil_moisture_3
    elif reading.soil_moisture_4 is not None:
        moisture = reading.soil_moisture_4

    if moisture is None:
        return True, None, threshold, False

    should_skip = moisture >= threshold
    return True, moisture, threshold, should_skip


async def check_rain_watering(db: AsyncSession) -> Dict[str, any]:
    """
    Check plants that are DUE for watering today and decide WATER or SKIP
    based on accumulated rainfall since last watering decision.

    Also checks soil moisture sensor if enabled - if soil is wet enough,
    skip watering regardless of rain accumulation.

    Uses last_watering_decision (not last_watered) to calculate next due date,
    so skips don't mess up the schedule while preserving actual watering history.

    Returns stats about decisions made.
    """
    stats = {
        "rain_skipped": 0,      # Plants that got enough rain, marked as watered
        "soil_skipped": 0,      # Plants skipped due to soil moisture
        "needs_water": 0,       # Plants that need manual watering
        "not_due": 0,           # Plants not due for watering yet
        "skipped_today": 0,     # Already processed today
        "decisions": [],        # List of decisions made
        "soil_moisture": None,  # Current soil moisture if available
    }

    today = date.today()
    now = datetime.now()

    # Check soil moisture sensor first
    soil_enabled, soil_moisture, soil_threshold, soil_skip = await get_soil_moisture_for_watering(db)
    if soil_enabled:
        stats["soil_moisture"] = {
            "enabled": True,
            "moisture": soil_moisture,
            "threshold": soil_threshold,
            "skip_all": soil_skip
        }
        if soil_skip:
            logger.info(f"Soil moisture {soil_moisture}% >= threshold {soil_threshold}% - will skip all rain-dependent plants")

    # Get USDA zone for interval calculations
    usda_zone = await get_setting(db, "usda_zone", "7a")

    # Get all active plants that receive rain
    result = await db.execute(
        select(Plant)
        .where(Plant.is_active == True)
        .where(Plant.receives_rain == True)
    )
    rain_plants = result.scalars().all()

    if not rain_plants:
        return stats

    # Find the earliest decision date to determine query range
    # Default to 45 days ago (matches retention)
    earliest_date = now - timedelta(days=45)
    for plant in rain_plants:
        # Use last_watering_decision if set, else fall back to last_watered
        decision_date = plant.last_watering_decision or plant.last_watered
        if decision_date and decision_date < earliest_date:
            earliest_date = decision_date

    # Single query: get all daily rain totals since earliest date
    daily_rain = await get_daily_rain_totals(db, earliest_date)
    logger.debug(f"Fetched {len(daily_rain)} days of rain data for {len(rain_plants)} plants")

    for plant in rain_plants:
        # Get the watering interval for current season (zone-adjusted)
        water_days = plant.get_water_days_for_season(usda_zone=usda_zone)

        # Use last_watering_decision for schedule, fall back to last_watered
        last_decision = plant.last_watering_decision or plant.last_watered

        # Calculate when this plant is next due for watering
        if last_decision:
            last_decision_date = last_decision.date()
            next_due_date = last_decision_date + timedelta(days=water_days)
        else:
            # Never watered, consider it due today
            next_due_date = today
            last_decision_date = today - timedelta(days=water_days)

        # Is this plant due for watering today (or overdue)?
        if next_due_date > today:
            stats["not_due"] += 1
            continue

        # Already made a decision today? Skip
        if last_decision and last_decision.date() == today:
            stats["skipped_today"] += 1
            continue

        # Calculate accumulated rain since last actual watering (not decision)
        # Rain matters since last time plant actually got water
        rain_check_date = plant.last_watered.date() if plant.last_watered else (today - timedelta(days=water_days))
        accumulated_rain = calculate_rain_since(daily_rain, rain_check_date)

        # Get threshold for this plant
        threshold = plant.rain_threshold_inches or 0.25

        decision = {
            "plant_id": plant.id,
            "plant_name": plant.name,
            "water_days": water_days,
            "accumulated_rain": round(accumulated_rain, 2),
            "threshold": threshold,
            "soil_moisture": soil_moisture,
        }

        # Check soil moisture first (if enabled and data available)
        if soil_skip:
            # Soil is wet enough - skip watering
            plant.last_watered = now
            plant.last_watering_decision = now
            stats["soil_skipped"] += 1
            decision["action"] = "SKIP"
            decision["reason"] = f"Soil moisture ({soil_moisture}%) >= threshold ({soil_threshold}%)"
            logger.info(f"SKIP watering {plant.name}: soil moisture {soil_moisture}% >= {soil_threshold}% threshold")
        elif accumulated_rain >= threshold:
            # Enough rain - skip manual watering
            # Update both last_watered (rain counts as watering) and last_watering_decision
            plant.last_watered = now
            plant.last_watering_decision = now
            stats["rain_skipped"] += 1
            decision["action"] = "SKIP"
            decision["reason"] = f"Rain ({accumulated_rain:.2f}in) >= threshold ({threshold}in)"
            logger.info(f"SKIP watering {plant.name}: {accumulated_rain:.2f}in rain >= {threshold}in threshold")
        else:
            # Not enough rain - plant needs manual watering
            # Don't update anything - let the reminder stay active
            stats["needs_water"] += 1
            decision["action"] = "WATER"
            decision["reason"] = f"Rain ({accumulated_rain:.2f}in) < threshold ({threshold}in)"
            if soil_enabled and soil_moisture is not None:
                decision["reason"] += f", soil moisture {soil_moisture}% < {soil_threshold}%"
            logger.info(f"WATER needed for {plant.name}: only {accumulated_rain:.2f}in rain < {threshold}in threshold")

        stats["decisions"].append(decision)

    if stats["rain_skipped"] > 0 or stats["soil_skipped"] > 0:
        await db.commit()
        logger.info(f"Watering check: {stats['rain_skipped']} plants skipped (rain), {stats['soil_skipped']} skipped (soil moisture), {stats['needs_water']} need water")

    return stats


def parse_sprinkler_schedule(schedule: str) -> Tuple[List[int], Optional[str]]:
    """
    Parse sprinkler schedule string.
    Format: "days:0,1,3,5;time:06:00" (Mon=0, Tue=1, etc. at 6am)

    Returns: (list of day numbers, time string or None)
    """
    if not schedule:
        return [], None

    days = []
    time_str = None

    for part in schedule.split(";"):
        if part.startswith("days:"):
            day_nums = part.replace("days:", "").split(",")
            days = [int(d.strip()) for d in day_nums if d.strip().isdigit()]
        elif part.startswith("time:"):
            time_str = part.replace("time:", "").strip()

    return days, time_str


async def check_sprinkler_watering(db: AsyncSession) -> Dict[str, int]:
    """
    Check if any plants should be marked as watered based on sprinkler schedule.

    This should be called periodically (e.g., every 15-30 minutes).
    Returns stats about plants updated.
    """
    stats = {"sprinkler_watered": 0, "skipped": 0}

    # Get all active plants with sprinkler enabled
    result = await db.execute(
        select(Plant)
        .where(Plant.is_active == True)
        .where(Plant.sprinkler_enabled == True)
        .where(Plant.sprinkler_schedule.isnot(None))
    )
    sprinkler_plants = result.scalars().all()

    now = datetime.now()
    today = now.date()
    current_weekday = now.weekday()  # Monday=0, Sunday=6
    current_time = now.strftime("%H:%M")

    for plant in sprinkler_plants:
        schedule_days, schedule_time = parse_sprinkler_schedule(plant.sprinkler_schedule)

        if not schedule_days:
            stats["skipped"] += 1
            continue

        # Check if today is a sprinkler day
        if current_weekday not in schedule_days:
            continue

        # Check if schedule time has passed (within the last hour)
        if schedule_time:
            try:
                sched_hour, sched_min = map(int, schedule_time.split(":"))
                sched_datetime = now.replace(hour=sched_hour, minute=sched_min, second=0, microsecond=0)

                # Only mark as watered if we're within 1 hour after schedule time
                time_diff = now - sched_datetime
                if time_diff.total_seconds() < 0 or time_diff.total_seconds() > 3600:
                    continue  # Not in the watering window
            except (ValueError, AttributeError):
                pass  # Invalid time format, skip time check

        # Check if already watered today
        if plant.last_watered and plant.last_watered.date() == today:
            stats["skipped"] += 1
            continue

        # Mark as watered
        plant.last_watered = now
        stats["sprinkler_watered"] += 1
        logger.info(f"Sprinkler watered: {plant.name} (schedule: {plant.sprinkler_schedule})")

    if stats["sprinkler_watered"] > 0:
        await db.commit()
        logger.info(f"Sprinkler watering complete: {stats['sprinkler_watered']} plants watered")

    return stats


async def run_auto_watering_check(db: AsyncSession) -> Dict[str, any]:
    """
    Run both rain and sprinkler watering checks.

    Should be called from the scheduler, typically once daily (morning recommended)
    or after weather updates.
    """
    stats = {
        "rain_skipped": 0,
        "soil_skipped": 0,
        "needs_water": 0,
        "sprinkler_watered": 0,
        "not_due": 0,
        "skipped": 0,
        "decisions": [],
        "soil_moisture": None,
    }

    try:
        rain_stats = await check_rain_watering(db)
        stats["rain_skipped"] = rain_stats.get("rain_skipped", 0)
        stats["soil_skipped"] = rain_stats.get("soil_skipped", 0)
        stats["needs_water"] = rain_stats.get("needs_water", 0)
        stats["not_due"] = rain_stats.get("not_due", 0)
        stats["decisions"] = rain_stats.get("decisions", [])
        stats["soil_moisture"] = rain_stats.get("soil_moisture")
    except Exception as e:
        logger.error(f"Error in rain watering check: {e}")

    try:
        sprinkler_stats = await check_sprinkler_watering(db)
        stats["sprinkler_watered"] = sprinkler_stats.get("sprinkler_watered", 0)
        stats["skipped"] += sprinkler_stats.get("skipped", 0)
    except Exception as e:
        logger.error(f"Error in sprinkler watering check: {e}")

    return stats
