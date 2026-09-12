"""
OpenAI LLM Provider Integration.
Leverages OpenAI GPT-4o / GPT-4o-mini structured outputs for high-precision multilingual civic intake.
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

logger = get_logger("integrations.openai")


class OpenAILLMProvider(LLMProvider):
    """
    OpenAI (https://openai.com) Direct Provider.
    Implements structured JSON outputs for municipal entity extraction.
    """

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or settings.OPENAI_API_KEY
        self.model = model or settings.OPENAI_MODEL
        self.fallback = FixtureLLMProvider()

    async def extract_complaint(
        self,
        message: str,
        conversation_history: List[Dict[str, Any]],
        context: Dict[str, Any],
    ) -> ExtractionResult:
        if not self.api_key:
            logger.info("OpenAI API key not configured. Using deterministic multilingual fixture engine.")
            return await self.fallback.extract_complaint(message, conversation_history, context)

        system_prompt = (
            "You are an expert civic intake parser for municipal governance in Pakistan. "
            "Parse complaints across English, Urdu, and Roman Urdu. "
            "Extract intent, category, title, description, location_text, priority, and missing_fields in valid JSON format."
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
                    "Content-Type": "application/json",
                }
                payload = {
                    "model": self.model,
                    "messages": messages,
                    "response_format": {"type": "json_object"},
                    "temperature": 0.1,
                }
                resp = await client.post("https://api.openai.com/v1/chat/completions", json=payload, headers=headers)
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
                    return await self.fallback.extract_complaint(message, conversation_history, context)
        except Exception as exc:
            logger.error(f"OpenAI extraction error: {exc}. Using fallback.")
            return await self.fallback.extract_complaint(message, conversation_history, context)
