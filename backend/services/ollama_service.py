"""
Ollama LLM Service
Communicates with self-hosted Ollama API for AI assistant features
"""

import httpx
from typing import AsyncGenerator, Optional, List, Dict
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.settings import AppSetting


# Default settings
DEFAULT_OLLAMA_URL = "http://localhost:11434"
DEFAULT_OLLAMA_MODEL = "qwen2.5:1.5b"


async def get_setting_value(db: AsyncSession, key: str, default: str = "") -> str:
    """Get a setting value from the database"""
    result = await db.execute(
        select(AppSetting).where(AppSetting.key == key)
    )
    setting = result.scalar_one_or_none()
    if setting and setting.value is not None:
        return setting.value
    return default


class OllamaService:
    """Client for Ollama LLM API"""

    def __init__(self, base_url: str = DEFAULT_OLLAMA_URL, model: str = DEFAULT_OLLAMA_MODEL):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=120.0)
        return self._client

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    async def check_health(self) -> bool:
        """Check if Ollama is running and accessible"""
        try:
            response = await self.client.get(f"{self.base_url}/api/tags", timeout=10.0)
            return response.status_code == 200
        except Exception:
            return False

    async def list_models(self) -> List[Dict]:
        """List available models from Ollama"""
        try:
            response = await self.client.get(f"{self.base_url}/api/tags", timeout=10.0)
            response.raise_for_status()
            data = response.json()
            return data.get("models", [])
        except Exception as e:
            logger.error(f"Failed to list Ollama models: {e}")
            return []

    async def generate(
        self,
        prompt: str,
        system_prompt: str = "",
        context: str = "",
    ) -> str:
        """Generate a complete response (non-streaming)"""
        messages = self._build_messages(prompt, system_prompt, context)

        try:
            response = await self.client.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model,
                    "messages": messages,
                    "stream": False,
                    "options": {
                        "num_ctx": 4096,
                        "temperature": 0.7,
                    },
                },
                timeout=120.0,
            )
            response.raise_for_status()
            data = response.json()
            return data.get("message", {}).get("content", "")
        except httpx.TimeoutException:
            logger.error("Ollama request timed out")
            return "I'm taking too long to respond. Try a shorter question or check that Ollama is running."
        except Exception as e:
            logger.error(f"Ollama generate error: {e}")
            return "I couldn't generate a response. Check that Ollama is running."

    async def generate_stream(
        self,
        prompt: str,
        system_prompt: str = "",
        context: str = "",
        history: Optional[List[Dict]] = None,
    ) -> AsyncGenerator[str, None]:
        """Generate a streaming response, yielding tokens as they arrive"""
        messages = self._build_messages(prompt, system_prompt, context, history)

        try:
            async with self.client.stream(
                "POST",
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model,
                    "messages": messages,
                    "stream": True,
                    "options": {
                        "num_ctx": 4096,
                        "temperature": 0.7,
                    },
                },
                timeout=120.0,
            ) as response:
                response.raise_for_status()
                import json as json_mod
                async for line in response.aiter_lines():
                    if line.strip():
                        try:
                            data = json_mod.loads(line)
                            content = data.get("message", {}).get("content", "")
                            if content:
                                yield content
                            if data.get("done", False):
                                break
                        except json_mod.JSONDecodeError:
                            continue
        except httpx.TimeoutException:
            logger.error("Ollama stream timed out")
            yield "I'm taking too long to respond. Try a shorter question."
        except Exception as e:
            logger.error(f"Ollama stream error: {e}")
            yield "I couldn't generate a response. Check that Ollama is running."

    def _build_messages(
        self,
        prompt: str,
        system_prompt: str = "",
        context: str = "",
        history: Optional[List[Dict]] = None,
    ) -> List[Dict]:
        """Build the messages list for the Ollama chat API"""
        messages = []

        # System message with context
        system_content = system_prompt
        if context:
            system_content += f"\n\n{context}"
        if system_content.strip():
            messages.append({"role": "system", "content": system_content})

        # Conversation history
        if history:
            messages.extend(history)

        # Current user message
        messages.append({"role": "user", "content": prompt})

        return messages


async def get_configured_service(db: AsyncSession) -> OllamaService:
    """Factory: create an OllamaService configured from database settings"""
    url = await get_setting_value(db, "ollama_url", DEFAULT_OLLAMA_URL)
    model = await get_setting_value(db, "ollama_model", DEFAULT_OLLAMA_MODEL)
    return OllamaService(base_url=url, model=model)
