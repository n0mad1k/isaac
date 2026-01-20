"""
Translation Service using argos-translate
Provides English to Spanish translation for worker task content
"""

import argostranslate.package
import argostranslate.translate
from loguru import logger
from typing import Optional
import asyncio
from functools import lru_cache

# In-memory cache for translations
_translation_cache: dict[str, str] = {}
_installed = False


def _ensure_language_installed():
    """Download and install English→Spanish language package if needed"""
    global _installed
    if _installed:
        return True

    try:
        # Check if already installed
        installed_languages = argostranslate.translate.get_installed_languages()
        en_lang = next((l for l in installed_languages if l.code == "en"), None)

        if en_lang:
            es_translation = next((t for t in en_lang.get_translations() if t.to_lang.code == "es"), None)
            if es_translation:
                logger.info("English→Spanish translation package already installed")
                _installed = True
                return True

        # Need to download and install
        logger.info("Downloading English→Spanish translation package...")
        argostranslate.package.update_package_index()
        available_packages = argostranslate.package.get_available_packages()

        # Find en→es package
        package = next(
            (p for p in available_packages if p.from_code == "en" and p.to_code == "es"),
            None
        )

        if not package:
            logger.error("English→Spanish package not found in available packages")
            return False

        # Download and install
        download_path = package.download()
        argostranslate.package.install_from_path(download_path)
        logger.info("English→Spanish translation package installed successfully")
        _installed = True
        return True

    except Exception as e:
        logger.error(f"Failed to install translation package: {e}")
        return False


def translate_sync(text: str, target_lang: str = "es") -> str:
    """
    Translate text from English to target language (synchronous)

    Args:
        text: Text to translate (English)
        target_lang: Target language code (only "es" supported currently)

    Returns:
        Translated text, or original text if translation fails
    """
    if not text or not text.strip():
        return text

    # Only Spanish supported for now
    if target_lang != "es":
        return text

    # Check cache first
    cache_key = f"en:{target_lang}:{text}"
    if cache_key in _translation_cache:
        return _translation_cache[cache_key]

    # Ensure language package is installed
    if not _ensure_language_installed():
        logger.warning("Translation package not available, returning original text")
        return text

    try:
        # Get installed languages
        installed_languages = argostranslate.translate.get_installed_languages()
        en_lang = next((l for l in installed_languages if l.code == "en"), None)
        es_lang = next((l for l in installed_languages if l.code == "es"), None)

        if not en_lang or not es_lang:
            logger.warning("Required languages not found")
            return text

        # Get translation
        translation = en_lang.get_translation(es_lang)
        if not translation:
            logger.warning("Translation not available")
            return text

        translated = translation.translate(text)

        # Cache the result
        _translation_cache[cache_key] = translated

        return translated

    except Exception as e:
        logger.error(f"Translation failed: {e}")
        return text


async def translate(text: str, target_lang: str = "es") -> str:
    """
    Translate text from English to target language (async wrapper)

    Args:
        text: Text to translate (English)
        target_lang: Target language code (only "es" supported currently)

    Returns:
        Translated text, or original text if translation fails
    """
    # Run in thread pool to not block async loop
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, translate_sync, text, target_lang)


async def translate_task(task_dict: dict, target_lang: str = "es") -> dict:
    """
    Translate task fields (title, description) to target language

    Args:
        task_dict: Task dictionary with title, description fields
        target_lang: Target language code

    Returns:
        Task dictionary with translated fields
    """
    if target_lang == "en":
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
        "package_installed": _installed
    }
