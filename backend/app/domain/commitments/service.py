from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.models import CommitmentModel, ComplaintEventModel, RecommendationModel
from app.domain.complaints.entities import CommitmentStatus, EventType, RecommendationType, RecommendationStatus
from app.core.errors import NotFoundException


class CommitmentService:
    @staticmethod
    async def create_commitment(
        session: AsyncSession,
        complaint_id: str,
        description: str,
        due_at: datetime,
        commitment_type: str = "VISIT",
        source_event_id: Optional[str] = None,
        actor_id: Optional[str] = None,
    ) -> CommitmentModel:
        """Create and track a promised civic commitment."""
        commitment = CommitmentModel(
            complaint_id=complaint_id,
            description=description,
            due_at=due_at,
            commitment_type=commitment_type,
            source_event_id=source_event_id,
            status=CommitmentStatus.PENDING,
        )
        session.add(commitment)

        # Append event to complaint timeline
        event = ComplaintEventModel(
            complaint_id=complaint_id,
            event_type=EventType.COMMITMENT_CREATED,
            actor_type="OPERATOR" if actor_id else "SYSTEM",
            actor_id=actor_id,
            payload={
                "commitment_id": commitment.id,
                "description": description,
                "due_at": due_at.isoformat(),
                "commitment_type": commitment_type,
            },
        )
        session.add(event)
        await session.commit()
        await session.refresh(commitment)
        return commitment

    @staticmethod
    async def fulfill_commitment(
        session: AsyncSession,
        commitment_id: str,
        actor_id: Optional[str] = None,
    ) -> CommitmentModel:
        """Mark a commitment as fulfilled."""
        result = await session.execute(select(CommitmentModel).where(CommitmentModel.id == commitment_id))
        commitment = result.scalar_one_or_none()
        if not commitment:
            raise NotFoundException("Commitment not found")

        # Idempotent: if already fulfilled, return early
        if commitment.status == CommitmentStatus.FULFILLED:
            return commitment

        commitment.status = CommitmentStatus.FULFILLED
        commitment.fulfilled_at = datetime.now(timezone.utc)

        event = ComplaintEventModel(
            complaint_id=commitment.complaint_id,
            event_type=EventType.COMMITMENT_FULFILLED,
            actor_type="OPERATOR" if actor_id else "SYSTEM",
            actor_id=actor_id,
            payload={"commitment_id": commitment.id, "description": commitment.description},
        )
        session.add(event)
        await session.commit()
        await session.refresh(commitment)
        return commitment

    @staticmethod
    async def check_missed_commitments(session: AsyncSession) -> List[Dict[str, Any]]:
        """
        Deterministic evaluation:
        due_at < now AND status == PENDING -> status = MISSED.
        Also creates recommendation if not already existing.
        """
        now = datetime.now(timezone.utc)
        stmt = select(CommitmentModel).where(
            and_(
                CommitmentModel.status == CommitmentStatus.PENDING,
                CommitmentModel.due_at < now,
            )
        )
        result = await session.execute(stmt)
        overdue_commitments = result.scalars().all()
        missed_reports = []

        for comm in overdue_commitments:
            comm.status = CommitmentStatus.MISSED

            # Add timeline event
            event = ComplaintEventModel(
                complaint_id=comm.complaint_id,
                event_type=EventType.COMMITMENT_MISSED,
                actor_type="SYSTEM",
                payload={
                    "commitment_id": comm.id,
                    "description": comm.description,
                    "due_at": comm.due_at.isoformat(),
                },
            )
            session.add(event)

            # Check if a recommendation already exists for this missed commitment
            incident_key = f"missed_commitment:{comm.id}"
            rec_stmt = select(RecommendationModel).where(
                and_(
                    RecommendationModel.complaint_id == comm.complaint_id,
                    RecommendationModel.incident_key == incident_key,
                )
            )
            rec_res = await session.execute(rec_stmt)
            existing_rec = rec_res.scalar_one_or_none()

            if not existing_rec:
                rec = RecommendationModel(
                    complaint_id=comm.complaint_id,
                    type=RecommendationType.VERIFY_COMMITMENT,
                    status=RecommendationStatus.PENDING,
                    reason=f"Commitment missed: '{comm.description}' was due at {comm.due_at.strftime('%Y-%m-%d %H:%M UTC')}.",
                    evidence=[
                        f"Commitment recorded on case: '{comm.description}'",
                        f"SLA deadline expired at {comm.due_at.isoformat()}",
                        "No fulfilling event recorded prior to deadline",
                    ],
                    requires_approval=True,
                    incident_key=incident_key,
                )
                session.add(rec)

            missed_reports.append({
                "commitment_id": comm.id,
                "complaint_id": comm.complaint_id,
                "description": comm.description,
                "due_at": comm.due_at.isoformat(),
            })

        await session.commit()
        return missed_reports
