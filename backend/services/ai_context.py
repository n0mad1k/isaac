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
                    last_water_date = p.last_watered.date() if hasattr(p.last_watered, 'date') else p.last_watered
                    days_ago = (date.today() - last_water_date).days
                    parts.append(f"watered {days_ago}d ago")
                if p.last_fertilized:
                    last_fert_date = p.last_fertilized.date() if hasattr(p.last_fertilized, 'date') else p.last_fertilized
                    days_ago = (date.today() - last_fert_date).days
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
    """Gather fitness/health context data including readiness scores"""
    from models.team import TeamMember, MemberWeightLog, MemberSubjectiveInput

    lines = []

    try:
        # Get all active team members
        result = await db.execute(
            select(TeamMember)
            .where(TeamMember.is_active == True)
            .order_by(TeamMember.id)
        )
        members = result.scalars().all()
        if not members:
            return "No fitness data available."

        for member in members:
            lines.append(f"\n--- {member.name} ---")

            # Readiness data from TeamMember model
            if member.overall_readiness:
                lines.append(f"Overall readiness: {member.overall_readiness.value if hasattr(member.overall_readiness, 'value') else member.overall_readiness}")
            if member.readiness_score is not None:
                lines.append(f"Readiness score: {member.readiness_score:.0f}/100")
            if member.performance_readiness_score is not None:
                lines.append(f"Performance readiness: {member.performance_readiness_score:.0f}/100")
            if member.medical_readiness:
                lines.append(f"Medical readiness: {member.medical_readiness.value if hasattr(member.medical_readiness, 'value') else member.medical_readiness}")
            if member.fitness_tier:
                tier_label = member.fitness_tier
                if member.fitness_sub_tier:
                    tier_label += f" ({member.fitness_sub_tier})"
                lines.append(f"Fitness tier: {tier_label}")

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

            # Recent subjective inputs (energy, sleep quality, etc.)
            result = await db.execute(
                select(MemberSubjectiveInput)
                .where(MemberSubjectiveInput.member_id == member.id)
                .order_by(desc(MemberSubjectiveInput.input_date))
                .limit(7)
            )
            subjective = result.scalars().all()
            if subjective:
                latest_s = subjective[0]
                if latest_s.energy_level is not None:
                    lines.append(f"Latest energy level: {latest_s.energy_level}/10")
                if latest_s.sleep_quality is not None:
                    sleep_vals = [s.sleep_quality for s in subjective if s.sleep_quality is not None]
                    if sleep_vals:
                        avg_sleep = sum(sleep_vals) / len(sleep_vals)
                        lines.append(f"7-day sleep quality avg: {avg_sleep:.1f}/10")
                if latest_s.sleep_hours is not None:
                    hour_vals = [s.sleep_hours for s in subjective if s.sleep_hours is not None]
                    if hour_vals:
                        avg_hours = sum(hour_vals) / len(hour_vals)
                        lines.append(f"7-day sleep hours avg: {avg_hours:.1f}")
                if latest_s.soreness is not None:
                    lines.append(f"Current soreness: {latest_s.soreness}/10")
                if latest_s.pain_severity is not None and latest_s.pain_severity > 0:
                    pain_info = f"Pain: {latest_s.pain_severity}/10"
                    if latest_s.pain_location:
                        pain_info += f" ({latest_s.pain_location})"
                    lines.append(pain_info)

    except Exception as e:
        logger.error(f"Error gathering fitness context: {e}")
        lines.append("(Fitness data unavailable)")

    return "\n".join(lines)


async def gather_budget_context(db: AsyncSession) -> str:
    """Gather budget/finance context data including actual spending.
    Uses bi-weekly pay periods (1st-14th, 15th-end) matching the budget system."""
    from models.budget import BudgetCategory, BudgetTransaction, BudgetIncome, CategoryType
    from calendar import monthrange
    from sqlalchemy import func

    lines = []

    try:
        today = date.today()
        month_start = today.replace(day=1)
        last_day = monthrange(today.year, today.month)[1]

        # Determine current pay period (1st-14th or 15th-end)
        if today.day <= 14:
            period_start = date(today.year, today.month, 1)
            period_end = date(today.year, today.month, 14)
            period_label = "1st - 14th"
            is_first_half = True
        else:
            period_start = date(today.year, today.month, 15)
            period_end = date(today.year, today.month, last_day)
            period_label = f"15th - {last_day}th"
            is_first_half = False

        # Get all active categories with their budgets
        result = await db.execute(
            select(BudgetCategory)
            .where(BudgetCategory.is_active == True)
            .order_by(BudgetCategory.name)
        )
        categories = result.scalars().all()
        category_map = {c.id: c for c in categories}

        # Get current period's transactions (spending by category)
        result = await db.execute(
            select(
                BudgetTransaction.category_id,
                func.sum(BudgetTransaction.amount).label('total')
            )
            .where(BudgetTransaction.transaction_date >= period_start)
            .where(BudgetTransaction.transaction_date <= today)
            .where(BudgetTransaction.amount < 0)  # Only expenses (negative amounts)
            .group_by(BudgetTransaction.category_id)
        )
        period_spending = {row.category_id: abs(row.total) for row in result.all()}

        # Get this month's total transactions for monthly comparison
        result = await db.execute(
            select(
                BudgetTransaction.category_id,
                func.sum(BudgetTransaction.amount).label('total')
            )
            .where(BudgetTransaction.transaction_date >= month_start)
            .where(BudgetTransaction.transaction_date <= today)
            .where(BudgetTransaction.amount < 0)
            .group_by(BudgetTransaction.category_id)
        )
        month_spending = {row.category_id: abs(row.total) for row in result.all()}

        # Current year-month for start/end date filtering
        current_ym = f"{today.year}-{today.month:02d}"

        # Budget vs Actual comparison for current pay period
        if categories:
            lines.append(f"BUDGET VS ACTUAL (pay period {period_label}, {today.strftime('%B %Y')}):")
            over_budget = []

            for cat in categories:
                # Skip categories outside their active date range
                if cat.start_date and current_ym < cat.start_date:
                    continue
                if cat.end_date and current_ym > cat.end_date:
                    continue
                # Skip Roll Over category
                if cat.name == "Roll Over":
                    continue

                # Determine budgeted amount for this period
                if cat.category_type == CategoryType.FIXED:
                    if cat.bill_day:
                        # Fixed bill with a specific due day - only count in the half it falls in
                        bill_in_first = (cat.bill_day <= 14)
                        if is_first_half != bill_in_first:
                            continue  # Bill not due in this period
                        budgeted = cat.monthly_budget if cat.monthly_budget else cat.budget_amount
                    else:
                        # Per-period fixed bill (no specific bill_day)
                        budgeted = cat.budget_amount or 0
                else:
                    # Variable/Transfer categories: budget_amount is per-period
                    budgeted = cat.budget_amount or 0

                if budgeted <= 0:
                    continue

                spent = period_spending.get(cat.id, 0)
                remaining = budgeted - spent
                pct = (spent / budgeted * 100) if budgeted > 0 else 0

                status = ""
                if remaining < 0:
                    status = f"OVER by ${abs(remaining):,.2f}"
                    over_budget.append((cat.name, spent, budgeted, abs(remaining)))
                elif pct >= 80:
                    status = f"near limit (${remaining:,.2f} left)"
                else:
                    status = f"${remaining:,.2f} remaining"

                if spent > 0 or budgeted > 0:
                    lines.append(f"  - {cat.name}: ${spent:,.2f} / ${budgeted:,.2f} {status}")

            if over_budget:
                lines.append(f"\n⚠️ OVER BUDGET ({len(over_budget)} categories):")
                for name, spent, budget, diff in sorted(over_budget, key=lambda x: -x[3]):
                    lines.append(f"  - {name}: ${diff:,.2f} over (${spent:,.2f} spent vs ${budget:,.2f} budget)")

        # Recent transactions (last 7 days)
        week_start = today - timedelta(days=7)
        result = await db.execute(
            select(BudgetTransaction)
            .where(BudgetTransaction.transaction_date >= week_start)
            .where(BudgetTransaction.amount < 0)
            .order_by(desc(BudgetTransaction.transaction_date), desc(BudgetTransaction.amount))
            .limit(15)
        )
        recent_txns = result.scalars().all()

        if recent_txns:
            lines.append(f"\nRECENT TRANSACTIONS (last 7 days):")
            for txn in recent_txns:
                cat_name = category_map.get(txn.category_id, {})
                cat_name = cat_name.name if hasattr(cat_name, 'name') else "Uncategorized"
                lines.append(f"  - {txn.transaction_date.strftime('%m/%d')}: {txn.description[:30]} ${abs(txn.amount):,.2f} [{cat_name}]")

        # Total spending summary
        total_period = sum(period_spending.values())
        total_month = sum(month_spending.values())
        lines.append(f"\nSPENDING TOTALS:")
        lines.append(f"  - This pay period ({period_label}): ${total_period:,.2f}")
        lines.append(f"  - This month: ${total_month:,.2f}")

        # Income sources for context
        result = await db.execute(
            select(BudgetIncome)
            .where(BudgetIncome.is_active == True)
            .order_by(BudgetIncome.name)
        )
        incomes = result.scalars().all()
        if incomes:
            total_income = sum(i.amount for i in incomes if i.amount)
            lines.append(f"  - Monthly income: ${total_income:,.2f}")

        if not recent_txns and not period_spending:
            lines.append("\nNo transactions recorded this period.")

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
            total = sum(s.total_price for s in sales if hasattr(s, 'total_price') and s.total_price)
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
            .order_by(desc(WeatherReading.reading_time))
            .limit(1)
        )
        reading = result.scalar_one_or_none()

        if reading:
            lines.append("Current conditions:")
            if hasattr(reading, 'temp_outdoor') and reading.temp_outdoor is not None:
                lines.append(f"  Temperature: {reading.temp_outdoor:.1f}°F")
            if hasattr(reading, 'humidity_outdoor') and reading.humidity_outdoor is not None:
                lines.append(f"  Humidity: {reading.humidity_outdoor}%")
            if hasattr(reading, 'wind_speed') and reading.wind_speed is not None:
                lines.append(f"  Wind: {reading.wind_speed} mph")
            if hasattr(reading, 'rain_daily') and reading.rain_daily is not None:
                lines.append(f"  Rain today: {reading.rain_daily} in")
        else:
            lines.append("No current weather data available.")

        # Active alerts (only show recent ones - within last 24 hours)
        alert_cutoff = datetime.now() - timedelta(hours=24)
        result = await db.execute(
            select(WeatherAlert)
            .where(WeatherAlert.is_active == True)
            .where(WeatherAlert.created_at >= alert_cutoff)
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
    from models.tasks import Task, TaskType

    lines = []

    try:
        today = date.today()

        # Overdue tasks (exclude events - they auto-expire, don't show as "overdue")
        # Also exclude worker-assigned tasks - they show on Worker Tasks page only
        result = await db.execute(
            select(Task)
            .where(Task.is_active == True)
            .where(Task.is_completed == False)
            .where(Task.due_date < today)
            .where(Task.due_date.isnot(None))
            .where(Task.task_type != TaskType.EVENT)
            .where(Task.assigned_to_worker_id.is_(None))
            .order_by(Task.due_date)
            .limit(10)
        )
        overdue = result.scalars().all()
        if overdue:
            lines.append(f"Overdue tasks ({len(overdue)}):")
            for t in overdue:
                days = (today - t.due_date).days
                lines.append(f"  - {t.title} ({days}d overdue)")

        # Today's tasks (exclude worker-assigned tasks)
        result = await db.execute(
            select(Task)
            .where(Task.is_active == True)
            .where(Task.is_completed == False)
            .where(Task.due_date == today)
            .where(Task.assigned_to_worker_id.is_(None))
            .order_by(Task.priority, Task.due_time)
            .limit(15)
        )
        today_tasks = result.scalars().all()
        if today_tasks:
            lines.append(f"\nToday's tasks ({len(today_tasks)}):")
            for t in today_tasks:
                time_str = f" at {t.due_time}" if t.due_time else ""
                lines.append(f"  - {t.title}{time_str}")

        # Upcoming week (exclude worker-assigned tasks)
        result = await db.execute(
            select(Task)
            .where(Task.is_active == True)
            .where(Task.is_completed == False)
            .where(Task.due_date > today)
            .where(Task.due_date <= today + timedelta(days=7))
            .where(Task.assigned_to_worker_id.is_(None))
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


def build_system_prompt(topic: Optional[str] = None, can_create_tasks: bool = False) -> str:
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

    # Add task creation capability if enabled
    if can_create_tasks:
        base += (
            "\n\n**TASK CREATION CAPABILITY:**\n"
            "When the user asks you to create a reminder, task, or event, or when you think "
            "one would be helpful, respond with a JSON block using this exact format:\n"
            "```task\n"
            '{"title": "Task title", "due_date": "YYYY-MM-DD", "due_time": "HH:MM", "description": "Optional details"}\n'
            "```\n"
            "Only include due_time if a specific time is mentioned. The user's interface will "
            "detect this and create the task. After the task block, confirm what you're creating."
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
            "You see income, bills, spending allocations, and account flows. CRITICAL: Use ONLY "
            "the exact dollar amounts shown in the data. A category is OVER budget only if it "
            "explicitly says 'OVER by $X' in the data. If it shows '$X remaining', it is UNDER "
            "budget. Never calculate or infer different amounts — the data already shows the "
            "correct spent/budget/remaining values. Reference specific line items and accounts."
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
