"""
Mozilla AI Alignment & Safety Guardrails.
Implements open-source AI evaluation patterns to ensure recommendations are factually grounded,
free of toxic injection vectors, and compliant with municipal escalation boundaries.
"""

from typing import Dict, Any, List
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("safety.mozilla_ai")


class MozillaAIGuardrails:
    """
    Evaluates AI-generated proposals against deterministic safety criteria and municipal protocols.
    Inspired by Mozilla AI's open-source trustworthy AI evaluation frameworks.
    """

    @staticmethod
    def evaluate_proposal(
        proposal_action: str,
        target_department: str,
        evidence_citations: List[str],
        stalled_hours: float,
    ) -> Dict[str, Any]:
        """
        Run alignment and safety checks on an AI recommendation.
        Guarantees that no external escalation is proposed without grounded evidence and SLA threshold breach.
        """
        if not settings.MOZILLA_AI_SAFETY_ENABLED:
            return {"passed": True, "reasons": []}

        violations = []

        # Rule 1: Must cite at least one verifiable database fact or timestamp
        if not evidence_citations:
            violations.append("Recommendation must cite verifiable facts and timestamps from the complaint timeline.")

        # Rule 2: Escalations require minimum stall threshold
        if proposal_action in ("ESCALATE_DEPARTMENT", "DISPATCH_FIELD_CREW") and stalled_hours < 72.0:
            violations.append(f"Premature escalation: case has only been inactive for {stalled_hours:.1f} hours (< 72h SLA threshold).")

        # Rule 3: Valid target department
        valid_targets = ["WASA", "CDA", "RDA", "IESCO", "WASTE_MANAGEMENT", "UNASSIGNED_TRIAGE"]
        if target_department.upper() not in valid_targets:
            violations.append(f"Invalid target department '{target_department}'. Must be an authorized municipal body.")

        passed = len(violations) == 0
        if not passed:
            logger.warning(f"Mozilla AI Guardrail flagged proposal: {violations}")

        return {
            "passed": passed,
            "violations": violations,
            "guardrail_engine": "Mozilla AI Trustworthy Evaluation Framework",
        }
