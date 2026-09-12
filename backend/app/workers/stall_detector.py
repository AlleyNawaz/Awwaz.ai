from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.models import ComplaintModel, RecommendationModel, ComplaintEventModel, to_utc
from app.domain.complaints.entities import ComplaintStatus, RecommendationType, RecommendationStatus, EventType
from app.core.config import settings


class StallDetectorWorker:
    @staticmethod
    async def run(session: AsyncSession, threshold_hours: int = None) -> List[Dict[str, Any]]:
        """
        Deterministic worker evaluating active cases:
        case.status in (ASSIGNED, IN_PROGRESS) AND now - last_progress_at > threshold_hours
        -> stalled = True, create ESCALATE recommendation (idempotent via incident_key).
        """
        hours = threshold_hours if threshold_hours is not None else settings.STALL_THRESHOLD_HOURS
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours)

        stmt = select(ComplaintModel).where(
            and_(
                ComplaintModel.status.in_([ComplaintStatus.ASSIGNED, ComplaintStatus.IN_PROGRESS]),
                ComplaintModel.last_progress_at < cutoff_time,
            )
        )
        res = await session.execute(stmt)
        stalled_cases = res.scalars().all()
        detected = []

        for case in stalled_cases:
            case.stalled = True

            # Incident key ensures deterministic deduplication
            incident_key = f"stall:{hours}h:{case.id}"

            # Check if active recommendation already exists
            rec_stmt = select(RecommendationModel).where(
                and_(
                    RecommendationModel.complaint_id == case.id,
                    RecommendationModel.incident_key == incident_key,
                )
            )
            rec_res = await session.execute(rec_stmt)
            existing_rec = rec_res.scalar_one_or_none()

            if not existing_rec:
                hours_idle = int((datetime.now(timezone.utc) - to_utc(case.last_progress_at)).total_seconds() / 3600)
                rec = RecommendationModel(
                    complaint_id=case.id,
                    type=RecommendationType.ESCALATE,
                    status=RecommendationStatus.PENDING,
                    reason=f"No operational progress recorded for {hours_idle} hours (SLA threshold: {hours}h).",
                    evidence=[
                        f"Case assigned {hours_idle} hours ago",
                        "No progress or status updates recorded since initial assignment",
                        f"Exceeded municipal SLA threshold of {hours} hours",
                        f"Current responsible role: {case.responsibility_name or 'Unassigned'}",
                    ],
                    requires_approval=True,
                    incident_key=incident_key,
                )
                session.add(rec)

                # Timeline event
                event = ComplaintEventModel(
                    complaint_id=case.id,
                    event_type=EventType.RECOMMENDATION_CREATED,
                    actor_type="SYSTEM",
                    payload={
                        "type": RecommendationType.ESCALATE,
                        "incident_key": incident_key,
                        "reason": rec.reason,
                    },
                )
                session.add(event)

            detected.append({
                "complaint_id": case.id,
                "title": case.title,
                "category": case.category,
                "last_progress_at": case.last_progress_at.isoformat(),
            })

        await session.commit()
        return detected
