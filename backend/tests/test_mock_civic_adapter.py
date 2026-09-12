import pytest
from app.integrations.civic.mock import MockCivicServiceAdapter
from app.integrations.civic.interface import EscalateCaseInput, SubmitCaseInput
from app.repositories.models import ComplaintModel, RecommendationModel
from app.domain.complaints.entities import ComplaintCategory, ComplaintStatus, RecommendationType
from app.domain.escalation.service import EscalationService


@pytest.mark.asyncio
async def test_mock_adapter_successful_escalation():
    adapter = MockCivicServiceAdapter()
    data = EscalateCaseInput(
        complaint_id="case_123",
        target_role="Director of Infrastructure",
        reason="No progress for 72 hours",
        evidence=["Idle for 72h"],
        idempotency_key="key_1",
    )
    res = await adapter.escalate_case(data)
    assert res.success is True
    assert res.external_reference.startswith("CIVIC-ESC-")
    assert res.received_at is not None


@pytest.mark.asyncio
async def test_mock_adapter_failure_preserves_case_state(db_session):
    adapter = MockCivicServiceAdapter(simulate_failure=True)

    case = ComplaintModel(
        citizen_id="test_citizen_1",
        title="Adapter Failure Test",
        description="Testing failed external escalation",
        category=ComplaintCategory.WATER_DRAINAGE,
        status=ComplaintStatus.IN_PROGRESS,
        location_text="Test Loc",
    )
    db_session.add(case)
    await db_session.commit()
    await db_session.refresh(case)

    rec = RecommendationModel(
        complaint_id=case.id,
        type=RecommendationType.ESCALATE,
        reason="Escalation with failed adapter",
        evidence=["Evidence 1"],
    )
    db_session.add(rec)
    await db_session.commit()
    await db_session.refresh(rec)

    # Attempt approval with failing adapter
    res = await EscalationService.approve_recommendation(
        session=db_session,
        recommendation_id=rec.id,
        approver_id="test_operator_1",
        idempotency_key="fail_key_1",
        adapter=adapter,
    )

    assert res["success"] is False
    assert res["error"] == "ESCALATION_REJECTED"

    # Truthful state check: Case status MUST NOT be changed to ESCALATED!
    await db_session.refresh(case)
    assert case.status == ComplaintStatus.IN_PROGRESS
