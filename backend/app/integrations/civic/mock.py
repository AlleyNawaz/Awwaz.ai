import hashlib
from datetime import datetime, timezone
from typing import Optional
from app.integrations.civic.interface import (
    CivicServiceAdapter,
    SubmitCaseInput,
    SubmitCaseResult,
    EscalateCaseInput,
    EscalateCaseResult,
    FollowUpInput,
    FollowUpResult,
)


class MockCivicServiceAdapter(CivicServiceAdapter):
    """
    Mock civic operations adapter implementing external department behavior.
    Can simulate success, timeout, and rejection for testing and demo flows.
    """

    def __init__(self, simulate_failure: bool = False, simulate_timeout: bool = False):
        self.simulate_failure = simulate_failure
        self.simulate_timeout = simulate_timeout

    def _generate_external_ref(self, prefix: str, identifier: str) -> str:
        h = hashlib.sha256(identifier.encode("utf-8")).hexdigest()[:5].upper()
        return f"{prefix}-{h}"

    async def submit_case(self, data: SubmitCaseInput) -> SubmitCaseResult:
        if self.simulate_timeout or "SIMULATE_TIMEOUT" in data.description:
            return SubmitCaseResult(
                success=False,
                error_code="EXTERNAL_TIMEOUT",
                message="External civic gateway timed out after 10s",
            )
        if self.simulate_failure or "SIMULATE_FAILURE" in data.description:
            return SubmitCaseResult(
                success=False,
                error_code="EXTERNAL_REJECTED",
                message="External civic intake rejected submission",
            )

        now = datetime.now(timezone.utc).isoformat()
        ref = self._generate_external_ref("CIVIC", data.complaint_id)
        return SubmitCaseResult(
            success=True,
            external_reference=ref,
            received_at=now,
            message=f"Case recorded in {data.department_name or 'Municipal'} portal",
        )

    async def request_follow_up(self, data: FollowUpInput) -> FollowUpResult:
        now = datetime.now(timezone.utc).isoformat()
        ref = data.external_reference or self._generate_external_ref("CIVIC", data.complaint_id)
        return FollowUpResult(
            success=True,
            external_reference=ref,
            received_at=now,
            message="Department coordinator notified of citizen follow-up request",
        )

    async def escalate_case(self, data: EscalateCaseInput) -> EscalateCaseResult:
        if self.simulate_timeout or "SIMULATE_TIMEOUT" in data.reason:
            return EscalateCaseResult(
                success=False,
                error_code="EXTERNAL_TIMEOUT",
                message="Civic service adapter timed out during escalation request",
            )
        if self.simulate_failure or "SIMULATE_FAILURE" in data.reason:
            return EscalateCaseResult(
                success=False,
                error_code="ESCALATION_REJECTED",
                message="External escalation desk rejected request: missing jurisdictional authority",
            )

        now = datetime.now(timezone.utc).isoformat()
        ref = self._generate_external_ref("CIVIC-ESC", f"{data.complaint_id}:{data.idempotency_key}")
        return EscalateCaseResult(
            success=True,
            external_reference=ref,
            escalation_tier=data.target_role,
            received_at=now,
            message=f"Escalation approved and confirmed by {data.target_role}",
        )
