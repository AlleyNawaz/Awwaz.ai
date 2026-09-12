import re
from typing import Dict, Any, List
from app.integrations.llm.interface import LLMProvider
from app.agent.schemas import ExtractionResult
from app.domain.complaints.entities import ComplaintCategory, Priority
from app.domain.routing.service import RoutingService


class FixtureLLMProvider(LLMProvider):
    """
    Deterministic multilingual NLP engine supporting English, Urdu, and Roman Urdu.
    Provides verified structured outputs for hackathon testing, evaluation, and demo workflows.
    """

    async def extract_complaint(
        self,
        message: str,
        conversation_history: List[Dict[str, Any]],
        context: Dict[str, Any],
    ) -> ExtractionResult:
        msg_clean = message.strip()
        msg_lower = msg_clean.lower()

        # 1. Prompt Injection Defense
        if any(bad in msg_lower for bad in ["ignore previous", "ignore instructions", "disregard instructions", "system override", "approve this escalation"]):
            return ExtractionResult(
                intent="SECURITY_DEFENSE_TRIGGERED",
                category=ComplaintCategory.UNKNOWN,
                title="Untrusted Command Filtered",
                description="Message attempted to override system instructions or permissions.",
                location_text=None,
                priority=Priority.LOW,
                missing_fields=[],
                confidence=0.99,
            )

        # 2. Check if this is a location response to a previous clarification
        last_agent_msg = ""
        for turn in reversed(conversation_history):
            if turn.get("sender_type") in ("AGENT", "SYSTEM"):
                last_agent_msg = turn.get("content", "").lower()
                break

        is_answering_location = any(kw in last_agent_msg for kw in ["location", "kahan", "place", "landmark", "chowk", "sector", "address"])
        # Typical location patterns
        location_keywords = ["near", "sector", "chowk", "street", "road", "g-", "f-", "h-", "i-", "block", "phase", "markaz", "bazaar", "hospital", "school"]
        has_location_markers = any(kw in msg_lower for kw in location_keywords)

        if is_answering_location or (has_location_markers and len(msg_clean.split()) <= 10 and not any(kw in msg_lower for kw in ["gutter", "kachra", "light", "pothole"])):
            # Look back in history to find category from earlier message
            inherited_category = ComplaintCategory.GENERAL_SERVICES
            inherited_desc = "Civic complaint"
            for turn in conversation_history:
                if turn.get("sender_type") == "CITIZEN":
                    prev_text = turn.get("content", "")
                    cat, _ = RoutingService.resolve_category_from_text(prev_text)
                    if cat != ComplaintCategory.UNKNOWN and cat != ComplaintCategory.GENERAL_SERVICES:
                        inherited_category = cat
                        inherited_desc = prev_text
                        break

            return ExtractionResult(
                intent="PROVIDE_LOCATION",
                category=inherited_category,
                title=f"{inherited_category.replace('_', ' ').title()} Issue",
                description=inherited_desc,
                location_text=msg_clean,
                priority=Priority.HIGH if inherited_category == ComplaintCategory.WATER_DRAINAGE else Priority.MEDIUM,
                missing_fields=[],
                confidence=0.95,
            )

        # 3. Test Fixture: Roman Urdu gutter overflow ("Bhai yahan 3 din se gutter overflow ho raha hai.")
        if "gutter" in msg_lower or "ganda pani" in msg_lower or "sewage" in msg_lower:
            loc = None
            for kw in location_keywords:
                if kw in msg_lower:
                    loc = msg_clean
                    break

            missing = [] if loc else ["location"]
            return ExtractionResult(
                intent="CREATE_COMPLAINT",
                category=ComplaintCategory.WATER_DRAINAGE,
                title="Overflowing sewage / drainage",
                description=msg_clean,
                location_text=loc,
                priority=Priority.HIGH,
                missing_fields=missing,
                confidence=0.94,
            )

        # 4. Test Fixture: Streetlight failure / recurrence ("Streetlight phir band hai", "broken streetlight")
        if "streetlight" in msg_lower or "street light" in msg_lower or "batti" in msg_lower or "khamba" in msg_lower:
            loc = None
            for kw in location_keywords:
                if kw in msg_lower:
                    loc = msg_clean
                    break

            missing = [] if loc else ["location"]
            return ExtractionResult(
                intent="CREATE_COMPLAINT",
                category=ComplaintCategory.ELECTRICAL_INFRASTRUCTURE,
                title="Streetlight outage / failure",
                description=msg_clean,
                location_text=loc,
                priority=Priority.MEDIUM,
                missing_fields=missing,
                confidence=0.93,
            )

        # 5. Test Fixture: Road issue ("Road ka masla hai", "pothole", "sadak tuti")
        if "road ka masla" in msg_lower or "sadak ka masla" in msg_lower:
            return ExtractionResult(
                intent="CREATE_COMPLAINT",
                category=ComplaintCategory.ROADS,
                title="Road repair required",
                description="Road surface or infrastructure damaged.",
                location_text=None,
                priority=Priority.MEDIUM,
                missing_fields=["location", "details"],
                confidence=0.72,
            )

        if "pothole" in msg_lower or "gaddha" in msg_lower or "broken road" in msg_lower:
            loc = None
            for kw in location_keywords:
                if kw in msg_lower:
                    loc = msg_clean
                    break
            missing = [] if loc else ["location"]
            return ExtractionResult(
                intent="CREATE_COMPLAINT",
                category=ComplaintCategory.ROADS,
                title="Pothole / Road damage",
                description=msg_clean,
                location_text=loc,
                priority=Priority.HIGH if "school" in msg_lower or "hospital" in msg_lower else Priority.MEDIUM,
                missing_fields=missing,
                confidence=0.92,
            )

        # 6. Test Fixture: Garbage / Sanitation
        if "garbage" in msg_lower or "kachra" in msg_lower or "kooda" in msg_lower:
            loc = None
            for kw in location_keywords:
                if kw in msg_lower:
                    loc = msg_clean
                    break
            missing = [] if loc else ["location"]
            return ExtractionResult(
                intent="CREATE_COMPLAINT",
                category=ComplaintCategory.SANITATION,
                title="Garbage accumulation",
                description=msg_clean,
                location_text=loc,
                priority=Priority.MEDIUM,
                missing_fields=missing,
                confidence=0.91,
            )

        # 7. General taxonomy resolution
        category, confidence = RoutingService.resolve_category_from_text(msg_clean)
        loc = None
        for kw in location_keywords:
            if kw in msg_lower:
                loc = msg_clean
                break
        missing = [] if loc else ["location"]

        return ExtractionResult(
            intent="CREATE_COMPLAINT",
            category=category,
            title=f"{category.replace('_', ' ').title()} report",
            description=msg_clean,
            location_text=loc,
            priority=Priority.MEDIUM,
            missing_fields=missing,
            confidence=confidence,
        )
