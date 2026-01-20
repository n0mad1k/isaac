"""
Translation Service using DeepL API
Provides English to Spanish translation for worker task content
With persistent database caching to reduce API usage
"""

import httpx
from loguru import logger
from typing import Optional
from sqlalchemy import select
from datetime import datetime

from models.translation import TranslationCache

# In-memory cache for fast lookups (populated from DB on first access)
_translation_cache: dict[str, str] = {}
_cache_loaded: bool = False

# DeepL API endpoint (free tier uses different URL)
DEEPL_FREE_URL = "https://api-free.deepl.com/v2/translate"
DEEPL_PRO_URL = "https://api.deepl.com/v2/translate"


async def get_deepl_key():
    """Get DeepL API key from settings"""
    try:
        from services.scheduler import get_setting_value
        return await get_setting_value("deepl_api_key")
    except Exception as e:
        logger.debug(f"Could not get DeepL key from settings: {e}")
        return None


async def _get_cached_translation(source_text: str, target_lang: str) -> Optional[str]:
    """Get translation from database cache"""
    try:
        from models.database import async_session

        async with async_session() as db:
            result = await db.execute(
                select(TranslationCache).where(
                    TranslationCache.source_text == source_text,
                    TranslationCache.target_lang == target_lang.upper()
                )
            )
            cached = result.scalar_one_or_none()
            if cached:
                return cached.translated_text
    except Exception as e:
        logger.debug(f"Cache lookup failed: {e}")
    return None


async def _save_translation_to_cache(source_text: str, target_lang: str, translated_text: str):
    """Save translation to database cache"""
    try:
        from models.database import async_session

        async with async_session() as db:
            # Check if already exists
            result = await db.execute(
                select(TranslationCache).where(
                    TranslationCache.source_text == source_text,
                    TranslationCache.target_lang == target_lang.upper()
                )
            )
            existing = result.scalar_one_or_none()

            if existing:
                existing.translated_text = translated_text
                existing.updated_at = datetime.utcnow()
            else:
                cache_entry = TranslationCache(
                    source_text=source_text,
                    target_lang=target_lang.upper(),
                    translated_text=translated_text
                )
                db.add(cache_entry)

            await db.commit()
    except Exception as e:
        logger.debug(f"Failed to save translation to cache: {e}")


async def translate(text: str, target_lang: str = "ES") -> str:
    """
    Translate text from English to target language using DeepL API
    Uses persistent database cache to reduce API calls

    Args:
        text: Text to translate (English)
        target_lang: Target language code (ES for Spanish)

    Returns:
        Translated text, or original text if translation fails
    """
    if not text or not text.strip():
        return text

    # Normalize language code for DeepL (uses uppercase)
    target_lang = target_lang.upper()
    if target_lang == "EN":
        return text

    # Check in-memory cache first (fast)
    cache_key = f"en:{target_lang}:{text}"
    if cache_key in _translation_cache:
        return _translation_cache[cache_key]

    # Check database cache (persistent across restarts)
    cached = await _get_cached_translation(text, target_lang)
    if cached:
        # Store in memory cache for faster subsequent lookups
        _translation_cache[cache_key] = cached
        logger.debug(f"Cache hit for '{text}' -> '{cached}'")
        return cached

    # Get API key
    api_key = await get_deepl_key()
    if not api_key:
        logger.warning("DeepL API key not configured - returning original text")
        return text

    try:
        # Determine which endpoint to use (free keys end with ":fx")
        url = DEEPL_FREE_URL if api_key.endswith(":fx") else DEEPL_PRO_URL

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                url,
                headers={
                    "Authorization": f"DeepL-Auth-Key {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "text": [text],
                    "source_lang": "EN",
                    "target_lang": target_lang,
                },
            )

            if response.status_code == 200:
                result = response.json()
                translated = result["translations"][0]["text"]

                # Cache in memory
                _translation_cache[cache_key] = translated

                # Cache in database for persistence
                await _save_translation_to_cache(text, target_lang, translated)

                logger.debug(f"Translated '{text}' -> '{translated}' (API call)")
                return translated
            else:
                logger.error(f"DeepL API error: {response.status_code} - {response.text}")
                return text

    except Exception as e:
        logger.error(f"Translation failed: {e}")
        return text


async def translate_task(task_dict: dict, target_lang: str = "es") -> dict:
    """
    Translate task fields (title, description) to target language

    Args:
        task_dict: Task dictionary with title, description fields
        target_lang: Target language code

    Returns:
        Task dictionary with translated fields
    """
    if target_lang.lower() == "en":
        return task_dict

    translated = task_dict.copy()

    # Translate title
    if task_dict.get("title"):
        translated["title"] = await translate(task_dict["title"], target_lang)

    # Translate description
    if task_dict.get("description"):
        translated["description"] = await translate(task_dict["description"], target_lang)

    # Keep original values for reference
    translated["original_title"] = task_dict.get("title")
    translated["original_description"] = task_dict.get("description")

    return translated


def clear_cache():
    """Clear both in-memory and database translation cache"""
    global _translation_cache
    _translation_cache = {}
    logger.info("In-memory translation cache cleared")


async def clear_database_cache():
    """Clear the database translation cache"""
    try:
        from models.database import async_session

        async with async_session() as db:
            await db.execute("DELETE FROM translation_cache")
            await db.commit()
        logger.info("Database translation cache cleared")
    except Exception as e:
        logger.error(f"Failed to clear database cache: {e}")


def get_cache_stats() -> dict:
    """Get translation cache statistics"""
    return {
        "memory_cache_entries": len(_translation_cache),
    }


async def get_full_cache_stats() -> dict:
    """Get full cache statistics including database"""
    try:
        from models.database import async_session

        async with async_session() as db:
            result = await db.execute("SELECT COUNT(*) FROM translation_cache")
            db_count = result.scalar() or 0

            return {
                "memory_cache_entries": len(_translation_cache),
                "database_cache_entries": db_count,
            }
    except Exception as e:
        return {
            "memory_cache_entries": len(_translation_cache),
            "database_cache_entries": "error",
        }
