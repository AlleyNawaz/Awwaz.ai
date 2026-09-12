"""
Ambiguous AI Intent & Entity Disambiguation Engine.
Detects underspecified citizen submissions and generates targeted clarification questions
before committing cases to the municipal dispatch ledger.
"""

from typing import Dict, Any, List, Optional
from app.agent.schemas import ExtractionResult
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("agent.ambiguous_ai")


class AmbiguityEngine:
    """
    Evaluates citizen message completeness and uncertainty.
    Inspired by Ambiguous AI patterns for resolving complex, ambiguous conversational intent.
    """

    @staticmethod
    def evaluate_ambiguity(extraction: ExtractionResult) -> Dict[str, Any]:
        """
        Calculates ambiguity score and suggests targeted clarification prompts.
        """
        is_ambiguous = False
        clarification_prompt: Optional[str] = None
        missing = list(extraction.missing_fields)

        if not extraction.location_text:
            if "location" not in missing:
                missing.append("location")
            is_ambiguous = True
            clarification_prompt = "Bhai baraye meherbani apni specific location ya qareebi landmark batayein taake mutalliqah department ko bhej sakein (e.g. Sector G-9/2 ya Street 14)?"

        elif extraction.confidence < settings.AMBIGUOUS_AI_CONFIDENCE_THRESHOLD:
            is_ambiguous = True
            clarification_prompt = "Aap ka masla samajh agaya hai, lekin behtar routing ke liye mazeed tafseelat faraham karein."

        return {
            "is_ambiguous": is_ambiguous,
            "confidence_score": extraction.confidence,
            "missing_fields": missing,
            "suggested_prompt": clarification_prompt,
            "engine": "Ambiguous AI Intent Resolution",
        }
