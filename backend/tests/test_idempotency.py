import pytest
from app.repositories.models import ComplaintModel, RecommendationModel
from app.domain.complaints.entities import ComplaintStatus, ComplaintCategory, RecommendationType, RecommendationStatus
from app.domain.escalation.service import EscalationService
from app.integrations.civic.mock import MockCivicServiceAdapter
from app.core.errors import ActionAlreadyExecutedException


@pytest.mark.asyncio
async def test_approval_idempotency(db_session):
    adapter = MockCivicServiceAdapter()

    # 1. Create complaint and recommendation
    case = ComplaintModel(
        citizen_id="test_citizen_1",
        title="Idempotency Test Case",
        description="Testing duplicate approval",
        category=ComplaintCategory.ROADS,
        status=ComplaintStatus.IN_PROGRESS,
        location_text="Main Highway",
    )
    db_session.add(case)
    await db_session.commit()
    await db_session.refresh(case)

    rec = RecommendationModel(
        complaint_id=case.id,
        type=RecommendationType.ESCALATE,
        status=RecommendationStatus.PENDING,
        reason="Test escalation",
        evidence=["Evidence item 1"],
        requires_approval=True,
    )
    db_session.add(rec)
    await db_session.commit()
    await db_session.refresh(rec)

    # 2. First approval with idempotency key
    res1 = await EscalationService.approve_recommendation(
        session=db_session,
        recommendation_id=rec.id,
        approver_id="test_operator_1",
        idempotency_key="test_idem_key_456",
        adapter=adapter,
        comment="First approval",
    )
    assert res1["success"] is True
    assert res1["new_status"] in (ComplaintStatus.ESCALATED, ComplaintStatus.ESCALATION_PENDING)
    assert res1.get("external_reference") is not None

    # 3. Second approval with EXACT same idempotency key (simulating network retry or double-click)
    res2 = await EscalationService.approve_recommendation(
        session=db_session,
        recommendation_id=rec.id,
        approver_id="test_operator_1",
        idempotency_key="test_idem_key_456",
        adapter=adapter,
        comment="Duplicate click",
    )
    assert res2.get("idempotent") is True
    assert res2["decision"] == "APPROVED"
    assert res2["external_reference"] == res1["external_reference"]

    # 4. Attempt approval with different key on executed recommendation -> raises ActionAlreadyExecutedException
    with pytest.raises(ActionAlreadyExecutedException):
        await EscalationService.approve_recommendation(
            session=db_session,
            recommendation_id=rec.id,
            approver_id="test_operator_1",
            idempotency_key="different_key_789",
            adapter=adapter,
        )
