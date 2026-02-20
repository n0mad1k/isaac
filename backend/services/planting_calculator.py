"""
Planting Calculator Service
Parses seed data + frost dates → monthly planting calendar
"""

import re
from datetime import date, timedelta
from typing import List, Dict, Optional, Tuple
from loguru import logger

# Month name/abbreviation to number mapping
MONTH_MAP = {
    'jan': 1, 'january': 1,
    'feb': 2, 'february': 2,
    'mar': 3, 'march': 3,
    'apr': 4, 'april': 4,
    'may': 5,
    'jun': 6, 'june': 6,
    'jul': 7, 'july': 7,
    'aug': 8, 'august': 8,
    'sep': 9, 'sept': 9, 'september': 9,
    'oct': 10, 'october': 10,
    'nov': 11, 'november': 11,
    'dec': 12, 'december': 12,
}

MONTH_NAMES = [
    "", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
]


def parse_month_range(text: str) -> List[int]:
    """Parse month range text into list of month numbers.

    Examples:
        "Feb-Apr" → [2, 3, 4]
        "Nov-Feb" → [11, 12, 1, 2]
        "Jan-Mar, Sep-Nov" → [1, 2, 3, 9, 10, 11]
        "May" → [5]
    """
    if not text or not text.strip():
        return []

    months = set()

    # Split on commas for multiple ranges
    for part in text.split(','):
        part = part.strip().lower()
        if not part:
            continue

        # Check for range (e.g., "Feb-Apr" or "Feb - Apr")
        range_match = re.match(r'(\w+)\s*[-–]\s*(\w+)', part)
        if range_match:
            start_str, end_str = range_match.groups()
            start = MONTH_MAP.get(start_str.strip())
            end = MONTH_MAP.get(end_str.strip())
            if start and end:
                if start <= end:
                    months.update(range(start, end + 1))
                else:
                    # Wrapping (e.g., Nov-Feb)
                    months.update(range(start, 13))
                    months.update(range(1, end + 1))
        else:
            # Single month
            month = MONTH_MAP.get(part.strip())
            if month:
                months.add(month)

    return sorted(months)


def parse_weeks_before_frost(text: str) -> Optional[int]:
    """Parse indoor start text to extract weeks before last frost.

    Examples:
        "6 weeks before last frost" → 6
        "Start 8 weeks before last frost date" → 8
        "4-6 weeks before last frost" → 5 (average)
    """
    if not text:
        return None

    text_lower = text.lower()
    if 'before' not in text_lower or 'frost' not in text_lower:
        return None

    # Try range first: "4-6 weeks"
    range_match = re.search(r'(\d+)\s*[-–]\s*(\d+)\s*weeks?', text_lower)
    if range_match:
        low, high = int(range_match.group(1)), int(range_match.group(2))
        return (low + high) // 2

    # Single value: "6 weeks"
    single_match = re.search(r'(\d+)\s*weeks?', text_lower)
    if single_match:
        return int(single_match.group(1))

    return None


def parse_day_range(text: str) -> Optional[Tuple[int, int]]:
    """Parse day range text into (min, max) tuple.

    Examples:
        "60-90 days" → (60, 90)
        "7-14 days" → (7, 14)
        "45 days" → (45, 45)
    """
    if not text:
        return None

    # Try range: "60-90 days" or "60-90"
    range_match = re.search(r'(\d+)\s*[-–]\s*(\d+)', text)
    if range_match:
        return (int(range_match.group(1)), int(range_match.group(2)))

    # Single value: "45 days" or just "45"
    single_match = re.search(r'(\d+)', text)
    if single_match:
        val = int(single_match.group(1))
        return (val, val)

    return None


def _get_frost_date(mm_dd: str, year: int) -> date:
    """Convert MM/DD string to a date object for the given year."""
    parts = mm_dd.split('/')
    return date(year, int(parts[0]), int(parts[1]))


def calculate_planting_schedule(
    seeds: list,
    last_frost_mm_dd: str = "02/15",
    first_frost_mm_dd: str = "12/15",
    year: int = None
) -> Dict:
    """Calculate full year planting schedule from seed data and frost dates.

    Args:
        seeds: List of seed model objects
        last_frost_mm_dd: Last spring frost date as MM/DD
        first_frost_mm_dd: First fall frost date as MM/DD
        year: Calendar year (defaults to current year)

    Returns:
        Dict with frost_dates and 12 months of activities
    """
    if year is None:
        year = date.today().year

    if not seeds:
        logger.warning("calculate_planting_schedule called with no seeds")

    logger.info(f"Calculating planting schedule for {len(seeds) if seeds else 0} seeds (year={year}, last_frost={last_frost_mm_dd}, first_frost={first_frost_mm_dd})")

    try:
        last_frost = _get_frost_date(last_frost_mm_dd, year)
    except Exception as e:
        logger.error(f"Failed to parse last frost date '{last_frost_mm_dd}': {e}")
        raise

    try:
        first_frost = _get_frost_date(first_frost_mm_dd, year)
    except Exception as e:
        logger.error(f"Failed to parse first frost date '{first_frost_mm_dd}': {e}")
        raise

    # Initialize 12 months
    months = []
    for m in range(1, 13):
        months.append({
            "month": m,
            "name": MONTH_NAMES[m],
            "activities": {
                "start_indoors": [],
                "direct_sow": [],
                "transplant": [],
                "harvest": [],
            }
        })

    for seed in seeds:
        try:
            _process_seed(seed, months, last_frost, first_frost, year)
        except Exception as e:
            logger.error(f"Failed to process seed '{getattr(seed, 'name', '?')}' (id={getattr(seed, 'id', '?')}) for planting schedule: {e}")
            continue

    total_activities = sum(
        len(m["activities"][a])
        for m in months
        for a in m["activities"]
    )
    logger.info(f"Planting schedule complete: {total_activities} total activities across 12 months")

    return {
        "frost_dates": {
            "last_frost": last_frost_mm_dd,
            "first_frost": first_frost_mm_dd,
        },
        "months": months,
    }


def _process_seed(seed, months: list, last_frost: date, first_frost: date, year: int):
    """Process a single seed and add its activities to the monthly calendar."""
    seed_info = {
        "seed_id": seed.id,
        "name": seed.name,
        "category": seed.category.value if seed.category else None,
    }

    # --- Indoor Start ---
    indoor_months = set()
    if not seed.direct_sow:
        if not seed.indoor_start and not seed.sow_months:
            logger.warning(f"Seed '{seed.name}' (id={seed.id}) is not direct sow but has no indoor_start or sow_months data")
        weeks = parse_weeks_before_frost(seed.indoor_start)
        if weeks:
            indoor_date = last_frost - timedelta(weeks=weeks)
            indoor_months.add(indoor_date.month)
            seed_info_indoor = {
                **seed_info,
                "notes": seed.indoor_start or f"{weeks} weeks before last frost",
                "target_date": indoor_date.isoformat(),
            }
            months[indoor_date.month - 1]["activities"]["start_indoors"].append(seed_info_indoor)
        elif seed.sow_months:
            # Fall back to sow_months if no frost-relative info
            sow_months = parse_month_range(seed.sow_months)
            for m in sow_months:
                indoor_months.add(m)
                months[m - 1]["activities"]["start_indoors"].append({
                    **seed_info,
                    "notes": f"Start indoors ({seed.sow_months})",
                })

    # --- Direct Sow ---
    direct_sow_months = set()
    if seed.direct_sow:
        if not seed.sow_months and not seed.spring_planting and not seed.fall_planting:
            logger.warning(f"Seed '{seed.name}' (id={seed.id}) is direct sow but has no sow_months, spring_planting, or fall_planting data")
        # Use sow_months first, then spring/fall planting
        if seed.sow_months:
            sow_months = parse_month_range(seed.sow_months)
            direct_sow_months.update(sow_months)
        else:
            if seed.spring_planting:
                direct_sow_months.update(parse_month_range(seed.spring_planting))
            if seed.fall_planting:
                direct_sow_months.update(parse_month_range(seed.fall_planting))

        # If frost sensitive, restrict to after last frost
        if seed.frost_sensitive and direct_sow_months:
            direct_sow_months = {m for m in direct_sow_months if m >= last_frost.month or m <= first_frost.month}

        for m in sorted(direct_sow_months):
            months[m - 1]["activities"]["direct_sow"].append({
                **seed_info,
                "notes": seed.sow_months or seed.spring_planting or seed.fall_planting or "",
            })

    # --- Transplant ---
    if indoor_months and not seed.direct_sow:
        germ_days = parse_day_range(seed.days_to_germination)
        germ_avg = ((germ_days[0] + germ_days[1]) // 2) if germ_days else 14
        hardening_days = 14  # 2 weeks hardening off

        for indoor_month in sorted(indoor_months):
            # Calculate transplant date from indoor start
            indoor_date_approx = date(year, indoor_month, 15)
            transplant_date = indoor_date_approx + timedelta(days=germ_avg + hardening_days)

            # Don't transplant before last frost if frost sensitive
            if seed.frost_sensitive and transplant_date < last_frost:
                transplant_date = last_frost + timedelta(days=7)

            t_month = transplant_date.month
            if 1 <= t_month <= 12:
                months[t_month - 1]["activities"]["transplant"].append({
                    **seed_info,
                    "notes": f"~{germ_avg + hardening_days} days after indoor start",
                    "target_date": transplant_date.isoformat(),
                })

    # --- Harvest ---
    harvest_months_set = set()
    if seed.harvest_months:
        harvest_months_set = set(parse_month_range(seed.harvest_months))

    # If no explicit harvest months, calculate from maturity
    if not harvest_months_set and seed.days_to_maturity:
        maturity = parse_day_range(seed.days_to_maturity)
        if maturity:
            maturity_avg = (maturity[0] + maturity[1]) // 2
            # Calculate from sow months
            sow_source = direct_sow_months or indoor_months
            for sow_month in sow_source:
                sow_date_approx = date(year, sow_month, 15)
                harvest_date = sow_date_approx + timedelta(days=maturity_avg)
                # Handle year wrapping
                if harvest_date.year == year:
                    harvest_months_set.add(harvest_date.month)

    if not harvest_months_set:
        logger.warning(f"Seed '{seed.name}' (id={seed.id}) has no determinable harvest months (no harvest_months or days_to_maturity data)")

    for m in sorted(harvest_months_set):
        months[m - 1]["activities"]["harvest"].append({
            **seed_info,
            "notes": seed.harvest_months or (f"~{seed.days_to_maturity} after sowing" if seed.days_to_maturity else ""),
        })
