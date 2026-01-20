"""
Translation Service using DeepL API
Provides English to Spanish translation for worker task content
"""

import httpx
from loguru import logger
from typing import Optional
import asyncio

# In-memory cache for translations
_translation_cache: dict[str, str] = {}

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


async def translate(text: str, target_lang: str = "ES") -> str:
    """
    Translate text from English to target language using DeepL API

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

    # Check cache first
    cache_key = f"en:{target_lang}:{text}"
    if cache_key in _translation_cache:
        return _translation_cache[cache_key]

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
                data={
                    "auth_key": api_key,
                    "text": text,
                    "source_lang": "EN",
                    "target_lang": target_lang,
                },
            )

            if response.status_code == 200:
                result = response.json()
                translated = result["translations"][0]["text"]

                # Cache the result
                _translation_cache[cache_key] = translated
                logger.debug(f"Translated '{text}' -> '{translated}'")
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
    """Clear the translation cache"""
    global _translation_cache
    _translation_cache = {}
    logger.info("Translation cache cleared")


def get_cache_stats() -> dict:
    """Get translation cache statistics"""
    return {
        "cached_translations": len(_translation_cache),
    }
