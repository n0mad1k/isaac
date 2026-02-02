"""
AI Context Service
Topic detection and domain-specific data gathering for AI assistant context injection
"""

import re
from datetime import datetime, date, timedelta
from typing import Optional, Dict, List
from loguru import logger
from sqlalchemy import select, and_, or_, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings

# Topic detection keywords
TOPIC_KEYWORDS = {
    "garden": ["plant", "seed", "water", "fertilize", "harvest", "garden", "grow", "prune", "zone", "soil", "mulch", "compost", "weed", "transplant", "germinate", "bloom", "flower", "vegetable", "herb", "fruit", "planting"],
    "fitness": ["workout", "exercise", "weight", "readiness", "hrv", "recovery", "training", "fitness", "sleep", "reps", "sets", "cardio", "strength", "run", "mile", "body fat"],
    "budget": ["budget", "bill", "expense", "income", "spending", "money", "account", "savings", "transaction", "payment", "balance", "category", "finance", "cost", "dollar", "pay"],
    "production": ["egg", "milk", "honey", "production", "yield", "livestock", "harvest", "sale", "order", "customer", "butcher", "slaughter"],
    "animals": ["animal", "horse", "dog", "chicken", "goat", "feed", "vet", "care", "farrier", "worming", "vaccination", "hoof", "blanket", "pen", "pasture", "cattle", "pig", "sheep"],
    "weather": ["weather", "rain", "temperature", "forecast", "frost", "wind", "humidity", "storm", "heat", "cold", "snow", "degree"],
    "tasks": ["task", "todo", "reminder", "schedule", "calendar", "overdue", "due", "appointment", "event"],
}


def detect_topic(message: str) -> Optional[str]:
    """Detect the primary topic from a user message using keyword matching"""
    message_lower = message.lower()
    scores: Dict[str, int] = {}

    for topic, keywords in TOPIC_KEYWORDS.items():
        score = 0
        for keyword in keywords:
            # Use word boundary matching to avoid partial matches
            pattern = r'\b' + re.escape(keyword) + r'\b'
            matches = re.findall(pattern, message_lower)
            score += len(matches)
        if score > 0:
            scores[topic] = score

    if not scores:
        return None

    # Return the topic with the highest score
    return max(scores, key=scores.get)


async def gather_garden_context(db: AsyncSession) -> str:
    """Gather garden/plant context data"""
    from models.plants import Plant
    from models.tasks import Task

    lines = []

    try:
        # Active plants summary
        result = await db.execute(
            select(Plant)
            .where(Plant.is_active == True)
            .order_by(Plant.name)
        )
        plants = result.scalars().all()

        if plants:
            lines.append(f"Active plants ({len(plants)}):")
            for p in plants[:20]:  # Cap at 20 to control token usage
                parts = [f"  - {p.name}"]
                if p.location:
                    parts.append(f"in {p.location}")
                if p.growth_stage:
                    parts.append(f"({p.growth_stage})")
                if p.last_watered:
                    days_ago = (date.today() - p.last_watered).days
                    parts.append(f"watered {days_ago}d ago")
                if p.last_fertilized:
                    days_ago = (date.today() - p.last_fertilized).days
                    parts.append(f"fertilized {days_ago}d ago")
                lines.append(" ".join(parts))
            if len(plants) > 20:
                lines.append(f"  ... and {len(plants) - 20} more")
        else:
            lines.append("No active plants in the garden.")

        # Upcoming plant care tasks
        today = date.today()
        result = await db.execute(
            select(Task)
            .where(Task.is_active == True)
            .where(Task.is_completed == False)
            .where(Task.notes.like("auto:plant_%"))
            .where(or_(Task.due_date <= today + timedelta(days=3), Task.due_date.is_(None)))
            .order_by(Task.due_date)
            .limit(10)
        )
        care_tasks = result.scalars().all()

        if care_tasks:
            lines.append(f"\nUpcoming plant care ({len(care_tasks)}):")
            for t in care_tasks:
                due = t.due_date.strftime("%m/%d") if t.due_date else "no date"
                lines.append(f"  - {t.title} (due {due})")

    except Exception as e:
        logger.error(f"Error gathering garden context: {e}")
        lines.append("(Garden data unavailable)")

    return "\n".join(lines)


async def gather_fitness_context(db: AsyncSession) -> str:
    """Gather fitness/health context data"""
    from models.team import TeamMember, MemberWeightLog, MemberVitalsLog, VitalType

    lines = []

    try:
        # Get first team member (primary user)
        result = await db.execute(
            select(TeamMember).order_by(TeamMember.id).limit(1)
        )
        member = result.scalar_one_or_none()
        if not member:
            return "No fitness data available."

        lines.append(f"Member: {member.name}")

        # Recent weight
        result = await db.execute(
            select(MemberWeightLog)
            .where(MemberWeightLog.member_id == member.id)
            .order_by(desc(MemberWeightLog.recorded_at))
            .limit(7)
        )
        weights = result.scalars().all()
        if weights:
            latest = weights[0]
            lines.append(f"Current weight: {latest.weight} lbs (as of {latest.recorded_at.strftime('%m/%d')})")
            if len(weights) > 1:
                oldest = weights[-1]
                change = latest.weight - oldest.weight
                direction = "up" if change > 0 else "down" if change < 0 else "stable"
                lines.append(f"7-day trend: {direction} {abs(change):.1f} lbs")

        # Recent readiness scores (from vitals)
        result = await db.execute(
            select(MemberVitalsLog)
            .where(MemberVitalsLog.member_id == member.id)
            .where(MemberVitalsLog.vital_type == VitalType.READINESS)
            .order_by(desc(MemberVitalsLog.recorded_at))
            .limit(7)
        )
        readiness = result.scalars().all()
        if readiness:
            latest_r = readiness[0]
            avg = sum(r.value for r in readiness) / len(readiness)
            lines.append(f"Latest readiness: {latest_r.value}/10 (7-day avg: {avg:.1f})")

        # Recent sleep quality
        result = await db.execute(
            select(MemberVitalsLog)
            .where(MemberVitalsLog.member_id == member.id)
            .where(MemberVitalsLog.vital_type == VitalType.SLEEP_QUALITY)
            .order_by(desc(MemberVitalsLog.recorded_at))
            .limit(7)
        )
        sleep = result.scalars().all()
        if sleep:
            avg_sleep = sum(s.value for s in sleep) / len(sleep)
            lines.append(f"7-day sleep quality avg: {avg_sleep:.1f}/10")

    except Exception as e:
        logger.error(f"Error gathering fitness context: {e}")
        lines.append("(Fitness data unavailable)")

    return "\n".join(lines)


async def gather_budget_context(db: AsyncSession) -> str:
    """Gather budget/finance context data"""
    from models.budget import BudgetAccount, BudgetCategory, BudgetTransaction, BudgetIncome

    lines = []

    try:
        # Account balances
        result = await db.execute(select(BudgetAccount).order_by(BudgetAccount.name))
        accounts = result.scalars().all()
        if accounts:
            lines.append("Accounts:")
            for a in accounts:
                lines.append(f"  - {a.name}: ${a.balance:,.2f}" if hasattr(a, 'balance') and a.balance is not None else f"  - {a.name}")

        # Budget categories with current period spending
        today = date.today()
        month_start = today.replace(day=1)

        result = await db.execute(
            select(BudgetCategory).order_by(BudgetCategory.name)
        )
        categories = result.scalars().all()

        if categories:
            lines.append(f"\nBudget categories (month of {month_start.strftime('%m/%Y')}):")
            for cat in categories[:15]:
                budget_amt = cat.budgeted_amount if hasattr(cat, 'budgeted_amount') and cat.budgeted_amount else 0
                lines.append(f"  - {cat.name}: ${budget_amt:,.2f} budgeted")

        # Income sources
        result = await db.execute(select(BudgetIncome).order_by(BudgetIncome.source))
        incomes = result.scalars().all()
        if incomes:
            total_income = sum(i.amount for i in incomes if hasattr(i, 'amount') and i.amount)
            lines.append(f"\nTotal monthly income: ${total_income:,.2f}")

    except Exception as e:
        logger.error(f"Error gathering budget context: {e}")
        lines.append("(Budget data unavailable)")

    return "\n".join(lines)


async def gather_production_context(db: AsyncSession) -> str:
    """Gather production (eggs, milk, etc.) context data"""
    from models.production import LivestockProduction, PlantHarvest, Sale

    lines = []

    try:
        # Recent livestock production
        week_ago = datetime.utcnow() - timedelta(days=7)
        result = await db.execute(
            select(LivestockProduction)
            .where(LivestockProduction.created_at >= week_ago)
            .order_by(desc(LivestockProduction.created_at))
            .limit(20)
        )
        productions = result.scalars().all()
        if productions:
            lines.append(f"Recent production (last 7 days): {len(productions)} entries")

        # Recent harvests
        result = await db.execute(
            select(PlantHarvest)
            .where(PlantHarvest.created_at >= week_ago)
            .order_by(desc(PlantHarvest.created_at))
            .limit(10)
        )
        harvests = result.scalars().all()
        if harvests:
            lines.append(f"Recent harvests (last 7 days): {len(harvests)} entries")

        # Recent sales
        result = await db.execute(
            select(Sale)
            .where(Sale.created_at >= week_ago)
            .order_by(desc(Sale.created_at))
            .limit(10)
        )
        sales = result.scalars().all()
        if sales:
            total = sum(s.total_amount for s in sales if hasattr(s, 'total_amount') and s.total_amount)
            lines.append(f"Recent sales (last 7 days): {len(sales)} sales, ${total:,.2f} total")

        if not lines:
            lines.append("No recent production data.")

    except Exception as e:
        logger.error(f"Error gathering production context: {e}")
        lines.append("(Production data unavailable)")

    return "\n".join(lines)


async def gather_animals_context(db: AsyncSession) -> str:
    """Gather animal care context data"""
    from models.livestock import Animal, AnimalType

    lines = []

    try:
        result = await db.execute(
            select(Animal)
            .where(Animal.is_active == True)
            .order_by(Animal.name)
        )
        animals = result.scalars().all()

        if animals:
            lines.append(f"Active animals ({len(animals)}):")
            for a in animals[:20]:
                animal_type = a.animal_type.value if a.animal_type else "unknown"
                parts = [f"  - {a.name} ({animal_type})"]
                if hasattr(a, 'next_worming_date') and a.next_worming_date:
                    days = (a.next_worming_date - date.today()).days
                    if days <= 14:
                        parts.append(f"worming {'overdue' if days < 0 else f'in {days}d'}")
                if hasattr(a, 'next_farrier_date') and a.next_farrier_date:
                    days = (a.next_farrier_date - date.today()).days
                    if days <= 14:
                        parts.append(f"farrier {'overdue' if days < 0 else f'in {days}d'}")
                lines.append(", ".join(parts))
            if len(animals) > 20:
                lines.append(f"  ... and {len(animals) - 20} more")
        else:
            lines.append("No active animals.")

    except Exception as e:
        logger.error(f"Error gathering animals context: {e}")
        lines.append("(Animal data unavailable)")

    return "\n".join(lines)


async def gather_weather_context(db: AsyncSession) -> str:
    """Gather weather context data"""
    from models.weather import WeatherReading, WeatherAlert

    lines = []

    try:
        # Latest weather reading
        result = await db.execute(
            select(WeatherReading)
            .order_by(desc(WeatherReading.timestamp))
            .limit(1)
        )
        reading = result.scalar_one_or_none()

        if reading:
            lines.append("Current conditions:")
            if hasattr(reading, 'temp_f') and reading.temp_f is not None:
                lines.append(f"  Temperature: {reading.temp_f:.1f}°F")
            if hasattr(reading, 'humidity') and reading.humidity is not None:
                lines.append(f"  Humidity: {reading.humidity}%")
            if hasattr(reading, 'wind_speed') and reading.wind_speed is not None:
                lines.append(f"  Wind: {reading.wind_speed} mph")
            if hasattr(reading, 'daily_rain') and reading.daily_rain is not None:
                lines.append(f"  Rain today: {reading.daily_rain} in")
        else:
            lines.append("No current weather data available.")

        # Active alerts
        result = await db.execute(
            select(WeatherAlert)
            .where(WeatherAlert.is_active == True)
            .order_by(desc(WeatherAlert.created_at))
            .limit(5)
        )
        alerts = result.scalars().all()
        if alerts:
            lines.append(f"\nActive alerts ({len(alerts)}):")
            for a in alerts:
                lines.append(f"  - {a.title}: {a.message}")

    except Exception as e:
        logger.error(f"Error gathering weather context: {e}")
        lines.append("(Weather data unavailable)")

    return "\n".join(lines)


async def gather_tasks_context(db: AsyncSession) -> str:
    """Gather tasks/calendar context data"""
    from models.tasks import Task

    lines = []

    try:
        today = date.today()

        # Overdue tasks
        result = await db.execute(
            select(Task)
            .where(Task.is_active == True)
            .where(Task.is_completed == False)
            .where(Task.due_date < today)
            .where(Task.due_date.isnot(None))
            .order_by(Task.due_date)
            .limit(10)
        )
        overdue = result.scalars().all()
        if overdue:
            lines.append(f"Overdue tasks ({len(overdue)}):")
            for t in overdue:
                days = (today - t.due_date).days
                lines.append(f"  - {t.title} ({days}d overdue)")

        # Today's tasks
        result = await db.execute(
            select(Task)
            .where(Task.is_active == True)
            .where(Task.is_completed == False)
            .where(Task.due_date == today)
            .order_by(Task.priority, Task.due_time)
            .limit(15)
        )
        today_tasks = result.scalars().all()
        if today_tasks:
            lines.append(f"\nToday's tasks ({len(today_tasks)}):")
            for t in today_tasks:
                time_str = f" at {t.due_time}" if t.due_time else ""
                lines.append(f"  - {t.title}{time_str}")

        # Upcoming week
        result = await db.execute(
            select(Task)
            .where(Task.is_active == True)
            .where(Task.is_completed == False)
            .where(Task.due_date > today)
            .where(Task.due_date <= today + timedelta(days=7))
            .order_by(Task.due_date, Task.priority)
            .limit(10)
        )
        upcoming = result.scalars().all()
        if upcoming:
            lines.append(f"\nUpcoming this week ({len(upcoming)}):")
            for t in upcoming:
                lines.append(f"  - {t.title} (due {t.due_date.strftime('%m/%d')})")

        if not overdue and not today_tasks and not upcoming:
            lines.append("No pending tasks.")

    except Exception as e:
        logger.error(f"Error gathering tasks context: {e}")
        lines.append("(Task data unavailable)")

    return "\n".join(lines)


# Map topics to their data gatherers
CONTEXT_GATHERERS = {
    "garden": gather_garden_context,
    "fitness": gather_fitness_context,
    "budget": gather_budget_context,
    "production": gather_production_context,
    "animals": gather_animals_context,
    "weather": gather_weather_context,
    "tasks": gather_tasks_context,
}


async def get_shared_domains(db: AsyncSession) -> set:
    """Read ai_shared_domains setting and return as a set of allowed domain names"""
    from models.settings import AppSetting
    result = await db.execute(
        select(AppSetting).where(AppSetting.key == "ai_shared_domains")
    )
    setting = result.scalar_one_or_none()
    raw = setting.value if setting and setting.value else ""
    return {d.strip().lower() for d in raw.split(",") if d.strip()}


async def gather_context(db: AsyncSession, topic: Optional[str]) -> str:
    """Gather context data for the detected topic, respecting privacy settings.
    Only gathers data if the topic's domain is in ai_shared_domains."""
    if not topic or topic not in CONTEXT_GATHERERS:
        return ""

    # Privacy gate: check if this domain is allowed
    allowed = await get_shared_domains(db)
    if topic not in allowed:
        return ""

    try:
        return await CONTEXT_GATHERERS[topic](db)
    except Exception as e:
        logger.error(f"Error gathering context for {topic}: {e}")
        return ""


def build_system_prompt(topic: Optional[str] = None) -> str:
    """Build the system prompt including domain-specific instructions"""
    import pytz
    tz = pytz.timezone(settings.timezone)
    now = datetime.now(tz)

    base = (
        "You are Isaac, a homestead management assistant. Be direct and practical — short "
        "answers, no fluff. When you give advice, lead with the action. Skip pleasantries.\n\n"
        f"Today is {now.strftime('%m/%d/%Y')} ({now.strftime('%A')}). "
        f"Time: {now.strftime('%I:%M %p')} {settings.timezone}.\n"
        f"Growing zone: {settings.usda_zone}.\n\n"
        "You help manage: garden/plants, animals, fitness tracking, budgeting, farm "
        "production, equipment, vehicles, and daily tasks. Answer from the data provided. "
        "If you don't have enough data, say so briefly — don't guess."
    )

    domain_prompts = {
        "garden": (
            "\n\nGARDEN INSTRUCTIONS:\n"
            "You know this garden's plant inventory, care schedules, and local conditions. "
            f"Give planting/harvest advice based on zone {settings.usda_zone} and current weather. "
            "Flag overdue care immediately. Keep plant recommendations specific to what's "
            "already growing or what suits the zone and season."
        ),
        "fitness": (
            "\n\nFITNESS INSTRUCTIONS:\n"
            "You track daily readiness (1-10), sleep quality, weight, and workout completion. "
            "Adjust training suggestions based on readiness trends — low readiness means back "
            "off, high means push. Flag concerning patterns (declining readiness, poor sleep "
            "streaks, weight spikes). Be specific: 'skip heavy squats today' not 'consider "
            "reducing intensity.'"
        ),
        "budget": (
            "\n\nBUDGET INSTRUCTIONS:\n"
            "You see income, bills, spending allocations, and account flows. Flag overspending "
            "immediately with the dollar amount over. Identify savings opportunities from the "
            "actual data. Don't give generic financial advice — reference specific line items "
            "and accounts."
        ),
        "production": (
            "\n\nPRODUCTION INSTRUCTIONS:\n"
            "You track farm production (eggs, milk, honey, etc). Report trends factually. "
            "Flag anomalies. Suggest causes only when obvious from the data (seasonal, "
            "weather-related). Don't speculate beyond the data."
        ),
        "animals": (
            "\n\nANIMAL INSTRUCTIONS:\n"
            "You know every animal, their care schedules, and feeding routines. Flag overdue "
            "care tasks first. Keep health suggestions practical: 'horse is due for deworming' "
            "not 'consider consulting your veterinarian about parasite management.'"
        ),
        "weather": (
            "\n\nWEATHER INSTRUCTIONS:\n"
            "Relate weather to actionable farm decisions. 'Frost tonight — cover tomatoes' "
            "not 'temperatures will drop below freezing.' Connect forecasts to the garden, "
            "animals, and outdoor tasks that are actually scheduled."
        ),
        "tasks": (
            "\n\nTASKS INSTRUCTIONS:\n"
            "Prioritize overdue items first. When asked about scheduling, reference actual "
            "tasks and calendar events. Suggest task grouping when efficient."
        ),
    }

    if topic and topic in domain_prompts:
        base += domain_prompts[topic]

    return base
