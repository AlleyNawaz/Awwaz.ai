from abc import ABC, abstractmethod
from typing import Dict, Any, List
from app.agent.schemas import ExtractionResult


class LLMProvider(ABC):
    @abstractmethod
    async def extract_complaint(
        self,
        message: str,
        conversation_history: List[Dict[str, Any]],
        context: Dict[str, Any],
    ) -> ExtractionResult:
        """Extract structured civic intent, category, location, and missing fields."""
        pass
