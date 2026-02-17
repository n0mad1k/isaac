"""
AI Insights Service
Generates proactive insights on a schedule using Claude
"""

from datetime import datetime, timedelta
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import async_session
from models.chat import AiInsight, InsightPriority
from models.settings import AppSetting
from services.ollama_service import get_configured_service
from services.ai_context import (
    gather_garden_context,
    gather_fitness_context,
    gather_budget_context,
    gather_tasks_context,
    gather_weather_context,
    gather_animals_context,
    build_system_prompt,
    get_shared_domains,
)


async def _get_setting(key: str, default: str = "") -> str:
    """Get a setting value from database"""
    async with async_session() as db:
        result = await db.execute(
            select(AppSetting).where(AppSetting.key == key)
        )
        setting = result.scalar_one_or_none()
        if setting and setting.value is not None:
            return setting.value
    return default


async def _is_enabled() -> bool:
    """Check if AI and proactive insights are enabled"""
    ai_enabled = await _get_setting("ai_enabled", "true")
    insights_enabled = await _get_setting("ai_proactive_insights", "true")
    return ai_enabled == "true" and insights_enabled == "true"


async def _save_insight(
    domain: str,
    insight_type: str,
    title: str,
    content: str,
    priority: InsightPriority = InsightPriority.MEDIUM,
    expires_hours: int = 48,
):
    """Save an AI insight to the database"""
    async with async_session() as db:
        insight = AiInsight(
            domain=domain,
            insight_type=insight_type,
            title=title,
            content=content,
            priority=priority,
            expires_at=datetime.utcnow() + timedelta(hours=expires_hours),
        )
        db.add(insight)
        await db.commit()
        logger.info(f"Saved AI insight: {title}")


async def _get_shared_domains() -> set:
    """Get the set of domains the user has opted into sharing with AI"""
    async with async_session() as db:
        return await get_shared_domains(db)


async def _generate_insight(prompt: str, system_prompt: str, context: str) -> str:
    """Generate an insight using Claude (non-streaming)"""
    async with async_session() as db:
        service = await get_configured_service(db)
        try:
            response = await service.generate(
                prompt=prompt,
                system_prompt=system_prompt,
                context=context,
            )
            return response
        finally:
            await service.close()


async def generate_morning_digest():
    """Generate a daily morning briefing insight"""
    if not await _is_enabled():
        logger.debug("AI insights disabled, skipping morning digest")
        return

    logger.info("Generating AI morning digest...")
    try:
        allowed = await _get_shared_domains()
        logger.info(f"Morning digest shared domains: {allowed}")
        # Morning digest uses tasks, weather, animals, garden — only include allowed
        async with async_session() as db:
            tasks_ctx = await gather_tasks_context(db) if "tasks" in allowed else ""
            weather_ctx = await gather_weather_context(db) if "weather" in allowed else ""
            animals_ctx = await gather_animals_context(db) if "animals" in allowed else ""
            garden_ctx = await gather_garden_context(db) if "garden" in allowed else ""

        # Log the gathered context for debugging
        logger.info(f"Morning digest context lengths - tasks: {len(tasks_ctx)}, weather: {len(weather_ctx)}, animals: {len(animals_ctx)}, garden: {len(garden_ctx)}")

        # If no domains are enabled, skip generation entirely
        if not any([tasks_ctx, weather_ctx, animals_ctx, garden_ctx]):
            logger.debug("No shared domains for morning digest, skipping")
            return

        parts = []
        if tasks_ctx:
            parts.append(f"TASKS:\n{tasks_ctx}")
            logger.debug(f"Tasks context:\n{tasks_ctx}")
        if weather_ctx:
            parts.append(f"WEATHER:\n{weather_ctx}")
            logger.debug(f"Weather context:\n{weather_ctx}")
        if animals_ctx:
            parts.append(f"ANIMALS:\n{animals_ctx}")
            logger.debug(f"Animals context:\n{animals_ctx}")
        if garden_ctx:
            parts.append(f"GARDEN:\n{garden_ctx}")
        context = "\n\n".join(parts)
        logger.info(f"Total morning digest context length: {len(context)} chars")
        system = build_system_prompt("tasks")

        prompt = (
            "Review today's data and give a brief morning briefing. Format:\n"
            "- Top priorities (overdue + due today)\n"
            "- Weather impact on plans\n"
            "- Animal care needs\n"
            "- Any alerts or anomalies\n\n"
            "Weather guidance:\n"
            "- Don't suggest outdoor water tasks (pool, pressure washing) if temp is below 60°F\n"
            "- Rain provides water - don't say plants 'need watering' after rain\n"
            "- Plants with sprinkler_enabled are auto-watered on schedule\n\n"
            "Keep it under 150 words. Lead with the most important item. Be practical."
        )

        response = await _generate_insight(prompt, system, context)
        if response and len(response.strip()) > 10:
            await _save_insight(
                domain="tasks",
                insight_type="digest",
                title="Morning Briefing",
                content=response.strip(),
                priority=InsightPriority.HIGH,
                expires_hours=18,
            )
    except Exception as e:
        logger.error(f"Failed to generate morning digest: {e}")


async def generate_weekly_fitness_review():
    """Generate a weekly fitness analysis insight"""
    if not await _is_enabled():
        return

    # Check if fitness domain is shared
    allowed = await _get_shared_domains()
    if "fitness" not in allowed:
        logger.debug("Fitness domain not shared, skipping fitness review")
        return

    logger.info("Generating AI weekly fitness review...")
    try:
        async with async_session() as db:
            fitness_ctx = await gather_fitness_context(db)

        system = build_system_prompt("fitness")

        prompt = (
            "Analyze the past 7 days of fitness data. Format:\n"
            "- Readiness trend (improving/declining/stable)\n"
            "- Sleep quality pattern\n"
            "- Weight change\n"
            "- Training compliance\n"
            "- One specific adjustment for next week\n"
            "Keep it under 100 words. Be blunt about what's working and what isn't."
        )

        response = await _generate_insight(prompt, system, fitness_ctx)
        if response and len(response.strip()) > 10:
            await _save_insight(
                domain="fitness",
                insight_type="analysis",
                title="Weekly Fitness Review",
                content=response.strip(),
                priority=InsightPriority.MEDIUM,
                expires_hours=168,  # 1 week
            )
    except Exception as e:
        logger.error(f"Failed to generate fitness review: {e}")


async def generate_monthly_garden_review():
    """Generate a monthly garden analysis insight"""
    if not await _is_enabled():
        return

    # Check if garden domain is shared
    allowed = await _get_shared_domains()
    if "garden" not in allowed:
        logger.debug("Garden domain not shared, skipping garden review")
        return

    logger.info("Generating AI monthly garden review...")
    try:
        async with async_session() as db:
            garden_ctx = await gather_garden_context(db)
            weather_ctx = await gather_weather_context(db) if "weather" in allowed else ""

        context = f"GARDEN:\n{garden_ctx}\n\nWEATHER:\n{weather_ctx}"
        system = build_system_prompt("garden")

        from config import settings
        prompt = (
            f"Analyze this month's garden activity. Format:\n"
            f"- Plants needing attention (overdue care)\n"
            f"- What to plant/harvest this month for zone {settings.usda_zone}\n"
            f"- Seasonal prep tasks\n\n"
            f"IMPORTANT: Plants marked [SPRINKLER AUTO-WATERED] do NOT need manual watering.\n"
            f"Only recommend watering for plants without sprinkler coverage.\n"
            f"Keep it under 120 words. Only recommend actions relevant to what's actually "
            f"growing or what's appropriate for the zone and month."
        )

        response = await _generate_insight(prompt, system, context)
        if response and len(response.strip()) > 10:
            await _save_insight(
                domain="garden",
                insight_type="analysis",
                title="Monthly Garden Review",
                content=response.strip(),
                priority=InsightPriority.MEDIUM,
                expires_hours=720,  # ~30 days
            )
    except Exception as e:
        logger.error(f"Failed to generate garden review: {e}")


async def generate_weekly_budget_review():
    """Generate a weekly budget analysis insight"""
    if not await _is_enabled():
        return

    # Check if budget domain is shared
    allowed = await _get_shared_domains()
    if "budget" not in allowed:
        logger.debug("Budget domain not shared, skipping budget review")
        return

    logger.info("Generating AI weekly budget review...")
    try:
        async with async_session() as db:
            budget_ctx = await gather_budget_context(db)

        system = build_system_prompt("budget")

        prompt = (
            "Analyze the BUDGET VS ACTUAL data provided above. IMPORTANT: Only use the exact "
            "numbers shown in the data - do not calculate or infer different amounts. "
            "A category is OVER budget only if it shows 'OVER by $X' in the status. "
            "If it shows 'remaining' or 'left', it is UNDER budget.\n\n"
            "Format your response as:\n"
            "- Categories over budget (only if explicitly marked OVER in the data)\n"
            "- Categories near their limit (80%+ spent)\n"
            "- One actionable saving opportunity based on recent transactions\n"
            "Keep it under 100 words. Use the exact dollar amounts from the data."
        )

        response = await _generate_insight(prompt, system, budget_ctx)
        if response and len(response.strip()) > 10:
            await _save_insight(
                domain="budget",
                insight_type="analysis",
                title="Weekly Budget Review",
                content=response.strip(),
                priority=InsightPriority.MEDIUM,
                expires_hours=168,  # 1 week
            )
    except Exception as e:
        logger.error(f"Failed to generate budget review: {e}")


async def cleanup_expired_insights():
    """Remove expired insights"""
    try:
        from sqlalchemy import delete
        async with async_session() as db:
            result = await db.execute(
                delete(AiInsight).where(
                    AiInsight.expires_at < datetime.utcnow()
                )
            )
            if result.rowcount > 0:
                await db.commit()
                logger.info(f"Cleaned up {result.rowcount} expired AI insights")
    except Exception as e:
        logger.error(f"Failed to cleanup expired insights: {e}")
