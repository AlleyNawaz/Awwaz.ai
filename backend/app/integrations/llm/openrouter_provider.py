"""
OpenRouter LLM Provider Integration.
Allows Awwaz to dynamically route extraction, classification, and grounded synthesis requests
across top-tier models (GPT-4o, Claude 3.5 Sonnet, Llama 3) via a unified API gateway.
"""

import json
import httpx
from typing import Dict, Any, List, Optional
from app.agent.schemas import ExtractionResult
from app.core.config import settings
from app.core.logging import get_logger
from app.domain.complaints.entities import ComplaintCategory, Priority
from app.integrations.llm.fixture_provider import FixtureLLMProvider
from app.integrations.llm.interface import LLMProvider

logger = get_logger("integrations.openrouter")


class OpenRouterLLMProvider(LLMProvider):
    """
    OpenRouter (https://openrouter.ai) Multi-Model Gateway.
    Routes multilingual extraction tasks with automated fallback to the deterministic fixture provider.
    """

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or settings.OPENROUTER_API_KEY
        self.model = model or settings.OPENROUTER_MODEL
        self.base_url = settings.OPENROUTER_BASE_URL.rstrip("/")
        self.fallback = FixtureLLMProvider()

    async def extract_complaint(
        self,
        message: str,
        conversation_history: List[Dict[str, Any]],
        context: Dict[str, Any],
    ) -> ExtractionResult:
        if not self.api_key:
            logger.info("OpenRouter API key not configured. Using deterministic multilingual fixture engine.")
            return await self.fallback.extract_complaint(message, conversation_history, context)

        system_prompt = (
            "You are an expert civic intake parser for municipal governance in Pakistan. "
            "Your job is to parse citizen complaints submitted in English, Urdu, or Roman Urdu. "
            "Extract: intent, category (WATER_DRAINAGE, STREETLIGHT, POTHOLE_ROAD, SOLID_WASTE, ELECTRICITY, GAS, NOISE_POLLUTION, ILLEGAL_CONSTRUCTION, PARK_RECREATION, GENERAL_SERVICES, UNKNOWN), "
            "title (concise summary in English), description, location_text, priority (CRITICAL, HIGH, MEDIUM, LOW), and missing_fields. "
            "Return valid JSON matching ExtractionResult schema."
        )

        messages = [{"role": "system", "content": system_prompt}]
        for turn in conversation_history[-6:]:
            role = "assistant" if turn.get("sender_type") in ("AGENT", "SYSTEM") else "user"
            messages.append({"role": role, "content": turn.get("content", "")})
        messages.append({"role": "user", "content": message})

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "HTTP-Referer": "https://awwaz.ai",
                    "X-Title": "Awwaz AI Municipal Intelligence",
                    "Content-Type": "application/json",
                }
                payload = {
                    "model": self.model,
                    "messages": messages,
                    "response_format": {"type": "json_object"},
                    "temperature": 0.1,
                }
                resp = await client.post(f"{self.base_url}/chat/completions", json=payload, headers=headers)
                if resp.status_code == 200:
                    raw_json = resp.json()["choices"][0]["message"]["content"]
                    parsed = json.loads(raw_json)
                    return ExtractionResult(
                        intent=parsed.get("intent", "NEW_COMPLAINT"),
                        category=ComplaintCategory(parsed.get("category", "UNKNOWN")),
                        title=parsed.get("title", message[:50]),
                        description=parsed.get("description", message),
                        location_text=parsed.get("location_text"),
                        priority=Priority(parsed.get("priority", "MEDIUM")),
                        missing_fields=parsed.get("missing_fields", []),
                        confidence=float(parsed.get("confidence", 0.95)),
                    )
                else:
                    logger.warning(f"OpenRouter returned status {resp.status_code}. Falling back to fixture engine.")
                    return await self.fallback.extract_complaint(message, conversation_history, context)
        except Exception as exc:
            logger.error(f"OpenRouter extraction exception: {exc}. Utilizing fallback.")
            return await self.fallback.extract_complaint(message, conversation_history, context)
