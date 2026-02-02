"""
Claude AI Service
Communicates with Anthropic Claude API for AI assistant features
"""

import anthropic
from typing import AsyncGenerator, Optional, List, Dict
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.settings import AppSetting


# Default settings
DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-20250514"


async def get_setting_value(db: AsyncSession, key: str, default: str = "") -> str:
    """Get a setting value from the database"""
    result = await db.execute(
        select(AppSetting).where(AppSetting.key == key)
    )
    setting = result.scalar_one_or_none()
    if setting and setting.value is not None:
        return setting.value
    return default


class ClaudeService:
    """Client for Anthropic Claude API"""

    def __init__(self, api_key: str, model: str = DEFAULT_CLAUDE_MODEL):
        self.api_key = api_key
        self.model = model
        self._client: Optional[anthropic.AsyncAnthropic] = None

    @property
    def client(self) -> anthropic.AsyncAnthropic:
        if self._client is None:
            self._client = anthropic.AsyncAnthropic(api_key=self.api_key)
        return self._client

    async def close(self):
        if self._client is not None:
            await self._client.close()
            self._client = None

    async def check_health(self) -> bool:
        """Check if the API key is set and valid by making a minimal request"""
        if not self.api_key:
            return False
        try:
            # Make a minimal request to verify the key works
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=1,
                messages=[{"role": "user", "content": "hi"}],
            )
            return True
        except anthropic.AuthenticationError:
            logger.error("Claude API key is invalid")
            return False
        except Exception as e:
            logger.error(f"Claude health check failed: {e}")
            return False

    async def generate(
        self,
        prompt: str,
        system_prompt: str = "",
        context: str = "",
    ) -> str:
        """Generate a complete response (non-streaming)"""
        system_content = system_prompt
        if context:
            system_content += f"\n\n{context}"

        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=1024,
                system=system_content.strip() if system_content.strip() else anthropic.NOT_GIVEN,
                messages=[{"role": "user", "content": prompt}],
            )
            return response.content[0].text if response.content else ""
        except anthropic.APITimeoutError:
            logger.error("Claude API request timed out")
            return "I'm taking too long to respond. Try a shorter question."
        except anthropic.AuthenticationError:
            logger.error("Claude API key is invalid")
            return "API key is invalid. Check your Anthropic API key in Settings."
        except Exception as e:
            logger.error(f"Claude generate error: {e}")
            return "I couldn't generate a response. Check your API key in Settings."

    async def generate_stream(
        self,
        prompt: str,
        system_prompt: str = "",
        context: str = "",
        history: Optional[List[Dict]] = None,
    ) -> AsyncGenerator[str, None]:
        """Generate a streaming response, yielding tokens as they arrive"""
        messages = self._build_messages(prompt, history)
        system_content = system_prompt
        if context:
            system_content += f"\n\n{context}"

        try:
            async with self.client.messages.stream(
                model=self.model,
                max_tokens=1024,
                system=system_content.strip() if system_content.strip() else anthropic.NOT_GIVEN,
                messages=messages,
            ) as stream:
                async for text in stream.text_stream:
                    yield text

        except anthropic.APITimeoutError:
            logger.error("Claude stream timed out")
            yield "I'm taking too long to respond. Try a shorter question."
        except anthropic.AuthenticationError:
            logger.error("Claude API key is invalid")
            yield "API key is invalid. Check your Anthropic API key in Settings."
        except Exception as e:
            logger.error(f"Claude stream error: {e}")
            yield "I couldn't generate a response. Check your API key in Settings."

    def _build_messages(
        self,
        prompt: str,
        history: Optional[List[Dict]] = None,
    ) -> List[Dict]:
        """Build the messages list for the Claude API (no system role in messages)"""
        messages = []

        # Conversation history (user/assistant only — Claude API does not accept system in messages)
        if history:
            for msg in history:
                if msg.get("role") in ("user", "assistant"):
                    messages.append({"role": msg["role"], "content": msg["content"]})

        # Current user message
        messages.append({"role": "user", "content": prompt})

        return messages


async def get_configured_service(db: AsyncSession) -> ClaudeService:
    """Factory: create a ClaudeService configured from database settings"""
    from services.encryption import decrypt_value, ENCRYPTED_PREFIX
    raw_key = await get_setting_value(db, "anthropic_api_key", "")
    # Decrypt if stored encrypted
    if raw_key.startswith(ENCRYPTED_PREFIX):
        raw_key = decrypt_value(raw_key)
    model = await get_setting_value(db, "claude_model", DEFAULT_CLAUDE_MODEL)
    return ClaudeService(api_key=raw_key, model=model)
