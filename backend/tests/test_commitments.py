import pytest
from datetime import datetime, timezone, timedelta
from app.repositories.models import ComplaintModel
from app.domain.complaints.entities import ComplaintStatus, ComplaintCategory, CommitmentStatus
from app.domain.commitments.service import CommitmentService
from sqlalchemy import select


@pytest.mark.asyncio
async def test_commitment_lifecycle_and_missed_detection(db_session):
    now = datetime.now(timezone.utc)

    # 1. Create a complaint
    complaint = ComplaintModel(
        citizen_id="test_citizen_1",
        title="Commitment Test Case",
        description="Testing commitments",
        category=ComplaintCategory.ELECTRICAL_INFRASTRUCTURE,
        status=ComplaintStatus.IN_PROGRESS,
        location_text="Street 5, F-6",
    )
    db_session.add(complaint)
    await db_session.commit()
    await db_session.refresh(complaint)

    # 2. Create commitment with due_at in the past
    past_due = now - timedelta(hours=2)
    commitment = await CommitmentService.create_commitment(
        session=db_session,
        complaint_id=complaint.id,
        description="Technician will replace transformer fuse",
        due_at=past_due,
        commitment_type="REPAIR",
        actor_id="test_operator_1",
    )
    assert commitment.status == CommitmentStatus.PENDING

    # 3. Run check_missed_commitments
    missed_reports = await CommitmentService.check_missed_commitments(db_session)
    assert len(missed_reports) >= 1
    assert any(m["commitment_id"] == commitment.id for m in missed_reports)

    # Refresh commitment
    await db_session.refresh(commitment)
    assert commitment.status == CommitmentStatus.MISSED

    # 4. Create another commitment and fulfill it
    future_due = now + timedelta(days=2)
    comm2 = await CommitmentService.create_commitment(
        session=db_session,
        complaint_id=complaint.id,
        description="Follow-up call to verify lighting",
        due_at=future_due,
        commitment_type="CALL",
        actor_id="test_operator_1",
    )
    assert comm2.status == CommitmentStatus.PENDING

    fulfilled = await CommitmentService.fulfill_commitment(
        session=db_session,
        commitment_id=comm2.id,
        actor_id="test_operator_1",
    )
    assert fulfilled.status == CommitmentStatus.FULFILLED
    assert fulfilled.fulfilled_at is not None
