import pytest
from datetime import datetime, timezone, timedelta
from app.repositories.models import ComplaintModel, RecommendationModel
from app.domain.complaints.entities import ComplaintStatus, ComplaintCategory, RecommendationType, RecommendationStatus
from app.workers.stall_detector import StallDetectorWorker
from sqlalchemy import select


@pytest.mark.asyncio
async def test_stall_detection_and_idempotent_recommendation(db_session):
    now = datetime.now(timezone.utc)
    time_74h_ago = now - timedelta(hours=74)

    # 1. Create case with old last_progress_at
    case = ComplaintModel(
        citizen_id="test_citizen_1",
        title="Stalled Case Test",
        description="No progress for 74 hours",
        category=ComplaintCategory.ROADS,
        status=ComplaintStatus.ASSIGNED,
        location_text="Sector F-8",
        last_progress_at=time_74h_ago,
        created_at=time_74h_ago,
        stalled=False,
    )
    db_session.add(case)
    await db_session.commit()
    await db_session.refresh(case)

    # 2. Run stall detector worker
    detected = await StallDetectorWorker.run(db_session, threshold_hours=72)
    assert len(detected) == 1
    assert detected[0]["complaint_id"] == case.id

    # Refresh case to verify stalled flag
    await db_session.refresh(case)
    assert case.stalled is True

    # Verify recommendation created
    recs_res = await db_session.execute(
        select(RecommendationModel).where(RecommendationModel.complaint_id == case.id)
    )
    recs = recs_res.scalars().all()
    assert len(recs) == 1
    assert recs[0].type == RecommendationType.ESCALATE
    assert recs[0].status == RecommendationStatus.PENDING
    assert recs[0].requires_approval is True

    # 3. Re-run worker -> must be idempotent, NO duplicate recommendations!
    second_run = await StallDetectorWorker.run(db_session, threshold_hours=72)
    recs_res_2 = await db_session.execute(
        select(RecommendationModel).where(RecommendationModel.complaint_id == case.id)
    )
    recs_2 = recs_res_2.scalars().all()
    assert len(recs_2) == 1  # Still exactly 1 recommendation!
