"""
AI Service — Multi-provider support
Supports: Ollama (self-hosted), Claude (Anthropic), OpenAI (ChatGPT)
Each provider implements the same interface: check_health, generate, generate_stream, close
"""

import httpx
from abc import ABC, abstractmethod
from typing import AsyncGenerator, Optional, List, Dict
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.settings import AppSetting


# ─── Defaults ───────────────────────────────────────────────
DEFAULT_OLLAMA_URL = "http://localhost:11434"
DEFAULT_OLLAMA_MODEL = "llama3.2"
DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-20250514"
DEFAULT_OPENAI_MODEL = "gpt-4o-mini"


# ─── Shared helper ──────────────────────────────────────────
async def get_setting_value(db: AsyncSession, key: str, default: str = "") -> str:
    """Get a setting value from the database"""
    result = await db.execute(
        select(AppSetting).where(AppSetting.key == key)
    )
    setting = result.scalar_one_or_none()
    if setting and setting.value is not None:
        return setting.value
    return default


# ─── Base class ─────────────────────────────────────────────
class AiService(ABC):
    """Common interface for all AI providers"""

    model: str
    provider: str  # "ollama" | "claude" | "openai"

    @abstractmethod
    async def check_health(self) -> bool: ...

    @abstractmethod
    async def generate(self, prompt: str, system_prompt: str = "", context: str = "") -> str: ...

    @abstractmethod
    async def generate_stream(self, prompt: str, system_prompt: str = "", context: str = "", history: Optional[List[Dict]] = None) -> AsyncGenerator[str, None]: ...

    @abstractmethod
    async def close(self): ...


# ═══════════════════════════════════════════════════════════
#  OLLAMA (self-hosted)
# ═══════════════════════════════════════════════════════════
class OllamaService(AiService):
    provider = "ollama"

    def __init__(self, base_url: str = DEFAULT_OLLAMA_URL, model: str = DEFAULT_OLLAMA_MODEL):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(base_url=self.base_url, timeout=120.0)
        return self._client

    async def close(self):
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def check_health(self) -> bool:
        try:
            resp = await self.client.get("/api/tags")
            return resp.status_code == 200
        except Exception as e:
            logger.error(f"Ollama health check failed: {e}")
            return False

    async def generate(self, prompt: str, system_prompt: str = "", context: str = "") -> str:
        full_system = system_prompt
        if context:
            full_system += f"\n\n{context}"

        try:
            resp = await self.client.post(
                "/api/chat",
                json={
                    "model": self.model,
                    "stream": False,
                    "messages": self._build_messages(prompt, full_system),
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("message", {}).get("content", "")
        except Exception as e:
            logger.error(f"Ollama generate error: {e}")
            return "I couldn't generate a response. Check that Ollama is running."

    async def generate_stream(self, prompt: str, system_prompt: str = "", context: str = "", history: Optional[List[Dict]] = None) -> AsyncGenerator[str, None]:
        full_system = system_prompt
        if context:
            full_system += f"\n\n{context}"

        messages = []
        if full_system.strip():
            messages.append({"role": "system", "content": full_system.strip()})
        if history:
            for m in history:
                if m.get("role") in ("user", "assistant"):
                    messages.append({"role": m["role"], "content": m["content"]})
        messages.append({"role": "user", "content": prompt})

        try:
            async with self.client.stream(
                "POST",
                "/api/chat",
                json={"model": self.model, "stream": True, "messages": messages},
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if line:
                        import json as _json
                        try:
                            data = _json.loads(line)
                            token = data.get("message", {}).get("content", "")
                            if token:
                                yield token
                        except _json.JSONDecodeError:
                            pass
        except Exception as e:
            logger.error(f"Ollama stream error: {e}")
            yield "I couldn't generate a response. Check that Ollama is running."

    def _build_messages(self, prompt: str, system_prompt: str = "") -> List[Dict]:
        msgs: List[Dict] = []
        if system_prompt.strip():
            msgs.append({"role": "system", "content": system_prompt.strip()})
        msgs.append({"role": "user", "content": prompt})
        return msgs


# ═══════════════════════════════════════════════════════════
#  CLAUDE (Anthropic)
# ═══════════════════════════════════════════════════════════
class ClaudeService(AiService):
    provider = "claude"

    def __init__(self, api_key: str, model: str = DEFAULT_CLAUDE_MODEL):
        self.api_key = api_key
        self.model = model
        self._client = None

    @property
    def client(self):
        if self._client is None:
            import anthropic
            self._client = anthropic.AsyncAnthropic(api_key=self.api_key)
        return self._client

    async def close(self):
        if self._client is not None:
            await self._client.close()
            self._client = None

    async def check_health(self) -> bool:
        if not self.api_key:
            return False
        try:
            import anthropic
            await self.client.messages.create(
                model=self.model,
                max_tokens=1,
                messages=[{"role": "user", "content": "hi"}],
            )
            return True
        except Exception as e:
            logger.error(f"Claude health check failed: {e}")
            return False

    async def generate(self, prompt: str, system_prompt: str = "", context: str = "") -> str:
        import anthropic
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
        except Exception as e:
            logger.error(f"Claude generate error: {e}")
            return "I couldn't generate a response. Check your Anthropic API key in Settings."

    async def generate_stream(self, prompt: str, system_prompt: str = "", context: str = "", history: Optional[List[Dict]] = None) -> AsyncGenerator[str, None]:
        import anthropic
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
        except Exception as e:
            logger.error(f"Claude stream error: {e}")
            yield "I couldn't generate a response. Check your Anthropic API key in Settings."

    def _build_messages(self, prompt: str, history: Optional[List[Dict]] = None) -> List[Dict]:
        messages = []
        if history:
            for msg in history:
                if msg.get("role") in ("user", "assistant"):
                    messages.append({"role": msg["role"], "content": msg["content"]})
        messages.append({"role": "user", "content": prompt})
        return messages


# ═══════════════════════════════════════════════════════════
#  OPENAI (ChatGPT)
# ═══════════════════════════════════════════════════════════
class OpenAIService(AiService):
    provider = "openai"

    def __init__(self, api_key: str, model: str = DEFAULT_OPENAI_MODEL):
        self.api_key = api_key
        self.model = model
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url="https://api.openai.com/v1",
                headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                timeout=120.0,
            )
        return self._client

    async def close(self):
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def check_health(self) -> bool:
        if not self.api_key:
            return False
        try:
            resp = await self.client.post(
                "/chat/completions",
                json={
                    "model": self.model,
                    "max_tokens": 1,
                    "messages": [{"role": "user", "content": "hi"}],
                },
            )
            return resp.status_code == 200
        except Exception as e:
            logger.error(f"OpenAI health check failed: {e}")
            return False

    async def generate(self, prompt: str, system_prompt: str = "", context: str = "") -> str:
        system_content = system_prompt
        if context:
            system_content += f"\n\n{context}"
        messages = []
        if system_content.strip():
            messages.append({"role": "system", "content": system_content.strip()})
        messages.append({"role": "user", "content": prompt})

        try:
            resp = await self.client.post(
                "/chat/completions",
                json={"model": self.model, "max_tokens": 1024, "messages": messages},
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]
        except Exception as e:
            logger.error(f"OpenAI generate error: {e}")
            return "I couldn't generate a response. Check your OpenAI API key in Settings."

    async def generate_stream(self, prompt: str, system_prompt: str = "", context: str = "", history: Optional[List[Dict]] = None) -> AsyncGenerator[str, None]:
        import json as _json
        system_content = system_prompt
        if context:
            system_content += f"\n\n{context}"
        messages = []
        if system_content.strip():
            messages.append({"role": "system", "content": system_content.strip()})
        if history:
            for m in history:
                if m.get("role") in ("user", "assistant"):
                    messages.append({"role": m["role"], "content": m["content"]})
        messages.append({"role": "user", "content": prompt})

        try:
            async with self.client.stream(
                "POST",
                "/chat/completions",
                json={"model": self.model, "stream": True, "messages": messages},
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        payload = line[6:]
                        if payload.strip() == "[DONE]":
                            break
                        try:
                            data = _json.loads(payload)
                            delta = data["choices"][0].get("delta", {})
                            token = delta.get("content", "")
                            if token:
                                yield token
                        except (_json.JSONDecodeError, KeyError, IndexError):
                            pass
        except Exception as e:
            logger.error(f"OpenAI stream error: {e}")
            yield "I couldn't generate a response. Check your OpenAI API key in Settings."


# ═══════════════════════════════════════════════════════════
#  FACTORY — reads ai_provider setting and returns the right service
# ═══════════════════════════════════════════════════════════
async def get_configured_service(db: AsyncSession) -> AiService:
    """Create the AI service configured from database settings."""
    from services.encryption import decrypt_value, ENCRYPTED_PREFIX

    raw_provider = await get_setting_value(db, "ai_provider", "ollama")
    provider = raw_provider.strip().lower() if raw_provider else "ollama"
    logger.debug(f"AI provider configured: '{provider}' (raw: '{raw_provider}')")

    if provider == "claude":
        raw_key = await get_setting_value(db, "anthropic_api_key", "")
        if raw_key.startswith(ENCRYPTED_PREFIX):
            raw_key = decrypt_value(raw_key)
        model = await get_setting_value(db, "claude_model", DEFAULT_CLAUDE_MODEL)
        return ClaudeService(api_key=raw_key, model=model)

    elif provider == "openai":
        raw_key = await get_setting_value(db, "openai_api_key", "")
        if raw_key.startswith(ENCRYPTED_PREFIX):
            raw_key = decrypt_value(raw_key)
        model = await get_setting_value(db, "openai_model", DEFAULT_OPENAI_MODEL)
        return OpenAIService(api_key=raw_key, model=model)

    else:  # "ollama" (default / self-hosted)
        url = await get_setting_value(db, "ollama_url", DEFAULT_OLLAMA_URL)
        model = await get_setting_value(db, "ollama_model", DEFAULT_OLLAMA_MODEL)
        return OllamaService(base_url=url, model=model)
