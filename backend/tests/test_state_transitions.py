import pytest
from app.domain.complaints.entities import ComplaintStatus, Priority, ComplaintCategory
from app.domain.complaints.transitions import can_transition, validate_transition
from app.domain.complaints.service import ComplaintService
from app.core.errors import InvalidStateTransitionException, ConflictException


@pytest.mark.asyncio
async def test_can_transition_matrix():
    # Valid transitions
    assert can_transition(ComplaintStatus.REPORTED, ComplaintStatus.SUBMITTED) is True
    assert can_transition(ComplaintStatus.SUBMITTED, ComplaintStatus.ASSIGNED) is True
    assert can_transition(ComplaintStatus.ASSIGNED, ComplaintStatus.IN_PROGRESS) is True
    assert can_transition(ComplaintStatus.IN_PROGRESS, ComplaintStatus.RESOLVED) is True
    assert can_transition(ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED) is True

    # Escalation path
    assert can_transition(ComplaintStatus.ASSIGNED, ComplaintStatus.ESCALATION_PENDING) is True
    assert can_transition(ComplaintStatus.ESCALATION_PENDING, ComplaintStatus.ESCALATED) is True
    assert can_transition(ComplaintStatus.ESCALATED, ComplaintStatus.IN_PROGRESS) is True

    # Invalid transitions
    assert can_transition(ComplaintStatus.CLOSED, ComplaintStatus.IN_PROGRESS) is False
    assert can_transition(ComplaintStatus.REPORTED, ComplaintStatus.RESOLVED) is False
    assert can_transition(ComplaintStatus.SUBMITTED, ComplaintStatus.CLOSED) is False


@pytest.mark.asyncio
async def test_complaint_lifecycle_and_versioning(db_session):
    # 1. Create complaint (starts in SUBMITTED then assigned)
    complaint = await ComplaintService.create_complaint(
        session=db_session,
        citizen_id="test_citizen_1",
        title="Test Gutter Issue",
        description="Drainage block on street",
        category=ComplaintCategory.WATER_DRAINAGE,
        location_text="Street 1, Sector G-9",
    )
    assert complaint.status == ComplaintStatus.ASSIGNED
    assert complaint.version == 1

    # 2. Transition ASSIGNED -> IN_PROGRESS
    updated = await ComplaintService.transition_status(
        session=db_session,
        complaint_id=complaint.id,
        target_status=ComplaintStatus.IN_PROGRESS,
        actor_id="test_operator_1",
        actor_role="OPERATOR",
        reason="Field unit deployed",
        expected_version=1,
    )
    assert updated.status == ComplaintStatus.IN_PROGRESS
    assert updated.version == 2

    # 3. Transition IN_PROGRESS -> RESOLVED
    resolved = await ComplaintService.transition_status(
        session=db_session,
        complaint_id=complaint.id,
        target_status=ComplaintStatus.RESOLVED,
        actor_id="test_operator_1",
        actor_role="OPERATOR",
        reason="Work completed",
        expected_version=2,
    )
    assert resolved.status == ComplaintStatus.RESOLVED
    assert resolved.version == 3

    # 4. Transition RESOLVED -> CLOSED
    closed = await ComplaintService.transition_status(
        session=db_session,
        complaint_id=complaint.id,
        target_status=ComplaintStatus.CLOSED,
        actor_id="test_operator_1",
        actor_role="OPERATOR",
        expected_version=3,
    )
    assert closed.status == ComplaintStatus.CLOSED
    assert closed.version == 4

    # 5. Attempt invalid transition from CLOSED
    with pytest.raises(InvalidStateTransitionException):
        await ComplaintService.transition_status(
            session=db_session,
            complaint_id=complaint.id,
            target_status=ComplaintStatus.IN_PROGRESS,
            actor_id="test_operator_1",
            actor_role="OPERATOR",
        )


@pytest.mark.asyncio
async def test_optimistic_concurrency_conflict(db_session):
    complaint = await ComplaintService.create_complaint(
        session=db_session,
        citizen_id="test_citizen_1",
        title="Test Pothole",
        description="Pothole on main road",
        category=ComplaintCategory.ROADS,
        location_text="Main Road",
    )
    assert complaint.version == 1

    # Submit with wrong expected version
    with pytest.raises(ConflictException):
        await ComplaintService.transition_status(
            session=db_session,
            complaint_id=complaint.id,
            target_status=ComplaintStatus.IN_PROGRESS,
            actor_id="test_operator_1",
            actor_role="OPERATOR",
            expected_version=99,  # Mismatched version!
        )
