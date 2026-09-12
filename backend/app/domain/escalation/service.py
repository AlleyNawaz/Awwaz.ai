from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.models import (
    RecommendationModel,
    ApprovalModel,
    ComplaintModel,
    ComplaintEventModel,
    AuditLogModel,
)
from app.domain.complaints.entities import (
    RecommendationStatus,
    EventType,
    ComplaintStatus,
)
from app.domain.complaints.transitions import can_transition
from app.domain.routing.mappings import DEFAULT_DEPARTMENTS
from app.integrations.civic.interface import CivicServiceAdapter, EscalateCaseInput
from app.core.errors import (
    NotFoundException,
    ConflictException,
    ActionAlreadyExecutedException,
    ExternalServiceUnavailableException,
    ValidationException,
)


class EscalationService:
    @staticmethod
    async def create_recommendation(
        session: AsyncSession,
        complaint_id: str,
        rec_type: str,
        reason: str,
        evidence: List[str],
        incident_key: Optional[str] = None,
        requires_approval: bool = True,
    ) -> RecommendationModel:
        """Create a grounded recommendation backed by system facts."""
        if incident_key:
            existing = await session.execute(
                select(RecommendationModel).where(
                    and_(
                        RecommendationModel.complaint_id == complaint_id,
                        RecommendationModel.incident_key == incident_key,
                        RecommendationModel.status.in_([RecommendationStatus.PENDING, RecommendationStatus.APPROVED]),
                    )
                )
            )
            if existing.scalar_one_or_none():
                # Avoid duplicate active recommendation
                return existing.scalar_one()

        rec = RecommendationModel(
            complaint_id=complaint_id,
            type=rec_type,
            status=RecommendationStatus.PENDING,
            reason=reason,
            evidence=evidence,
            requires_approval=requires_approval,
            incident_key=incident_key,
        )
        session.add(rec)

        # Log recommendation event
        event = ComplaintEventModel(
            complaint_id=complaint_id,
            event_type=EventType.RECOMMENDATION_CREATED,
            actor_type="AGENT",
            payload={
                "type": rec_type,
                "reason": reason,
                "evidence": evidence,
                "requires_approval": requires_approval,
            },
        )
        session.add(event)
        await session.commit()
        await session.refresh(rec)
        return rec

    @staticmethod
    async def approve_recommendation(
        session: AsyncSession,
        recommendation_id: str,
        approver_id: str,
        idempotency_key: str,
        adapter: CivicServiceAdapter,
        comment: Optional[str] = None,
        expected_version: Optional[int] = None,
        request_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Human Approval Boundary:
        1. Validate recommendation exists and is PENDING.
        2. Validate complaint version if expected_version provided.
        3. Check idempotency.
        4. Execute Civic Service Adapter.
        5. If confirmed, transition case state, append events, record audit log.
        6. Return canonical result.
        """
        # 1. Fetch recommendation
        rec_stmt = select(RecommendationModel).where(RecommendationModel.id == recommendation_id)
        rec_res = await session.execute(rec_stmt)
        recommendation = rec_res.scalar_one_or_none()
        if not recommendation:
            raise NotFoundException("Recommendation not found")

        # Check existing approval by idempotency key
        if idempotency_key:
            existing_app_stmt = select(ApprovalModel).where(ApprovalModel.idempotency_key == idempotency_key)
            existing_app_res = await session.execute(existing_app_stmt)
            existing_approval = existing_app_res.scalar_one_or_none()
            if existing_approval:
                return {
                    "success": True,
                    "approval_id": existing_approval.id,
                    "decision": existing_approval.decision,
                    "external_reference": existing_approval.external_reference,
                    "status": recommendation.status,
                    "message": "Action already executed (idempotent replay)",
                    "idempotent": True,
                }

        if recommendation.status != RecommendationStatus.PENDING:
            raise ActionAlreadyExecutedException(f"Recommendation is already in '{recommendation.status}' state")

        # 2. Fetch complaint and verify optimistic lock
        comp_stmt = select(ComplaintModel).where(ComplaintModel.id == recommendation.complaint_id)
        comp_res = await session.execute(comp_stmt)
        complaint = comp_res.scalar_one_or_none()
        if not complaint:
            raise NotFoundException("Associated complaint not found")

        if expected_version is not None and complaint.version != expected_version:
            raise ConflictException(
                f"Complaint version conflict: expected {expected_version}, but found {complaint.version}. Please refresh."
            )

        # 3. Determine escalation target
        dept_config = DEFAULT_DEPARTMENTS.get(complaint.category, {})
        target_role = dept_config.get("escalation_target", "Senior Department Supervisor")

        # 4. Mark recommendation as EXECUTING before invoking external adapter
        recommendation.status = RecommendationStatus.EXECUTING
        await session.commit()

        # 5. Invoke Civic Service Adapter
        external_input = EscalateCaseInput(
            complaint_id=complaint.id,
            external_reference=complaint.external_reference,
            target_role=target_role,
            reason=recommendation.reason,
            evidence=recommendation.evidence,
            idempotency_key=idempotency_key,
        )

        try:
            adapter_res = await adapter.escalate_case(external_input)
        except Exception as e:
            recommendation.status = RecommendationStatus.FAILED
            await session.commit()
            raise ExternalServiceUnavailableException(f"Civic adapter invocation error: {str(e)}")

        # 6. Truthful status update: ONLY update state if adapter confirmed success
        if not adapter_res.success:
            recommendation.status = RecommendationStatus.FAILED
            # Record failure event
            fail_event = ComplaintEventModel(
                complaint_id=complaint.id,
                event_type=EventType.EXTERNAL_ACTION_FAILED,
                actor_type="OPERATOR",
                actor_id=approver_id,
                payload={
                    "recommendation_id": recommendation.id,
                    "error_code": adapter_res.error_code,
                    "message": adapter_res.message,
                },
                request_id=request_id,
            )
            session.add(fail_event)
            await session.commit()
            return {
                "success": False,
                "error": adapter_res.error_code,
                "message": adapter_res.message,
                "case_status_unchanged": complaint.status,
            }

        # 7. Adapter confirmed success: Record approval record
        approval = ApprovalModel(
            recommendation_id=recommendation.id,
            approver_id=approver_id,
            decision="APPROVED",
            reason=comment,
            idempotency_key=idempotency_key,
            external_reference=adapter_res.external_reference,
        )
        session.add(approval)

        recommendation.status = RecommendationStatus.EXECUTED
        recommendation.updated_at = datetime.now(timezone.utc)

        # Update complaint state to ESCALATED if legal transition exists
        if can_transition(complaint.status, ComplaintStatus.ESCALATED):
            complaint.status = ComplaintStatus.ESCALATED
        elif can_transition(complaint.status, ComplaintStatus.ESCALATION_PENDING):
            complaint.status = ComplaintStatus.ESCALATION_PENDING

        complaint.responsibility_type = "ESCALATED_SUPERVISOR"
        complaint.responsibility_name = target_role
        complaint.stalled = False  # Escalation un-stalls the complaint
        complaint.last_progress_at = datetime.now(timezone.utc)
        complaint.version += 1
        complaint.updated_at = datetime.now(timezone.utc)

        # 8. Append Timeline Event
        succ_event = ComplaintEventModel(
            complaint_id=complaint.id,
            event_type=EventType.EXTERNAL_ACTION_SUCCEEDED,
            actor_type="OPERATOR",
            actor_id=approver_id,
            payload={
                "recommendation_id": recommendation.id,
                "action": "ESCALATION_APPROVED",
                "target_role": target_role,
                "external_reference": adapter_res.external_reference,
                "comment": comment,
            },
            request_id=request_id,
        )
        session.add(succ_event)

        # 9. Write Immutable Audit Log
        audit = AuditLogModel(
            actor_id=approver_id,
            actor_type="OPERATOR",
            action="APPROVE_ESCALATION",
            resource_type="COMPLAINT",
            resource_id=complaint.id,
            request_id=request_id,
            metadata_json={
                "recommendation_id": recommendation.id,
                "external_reference": adapter_res.external_reference,
                "target_role": target_role,
                "comment": comment,
            },
        )
        session.add(audit)

        await session.commit()
        await session.refresh(complaint)

        return {
            "success": True,
            "approval_id": approval.id,
            "recommendation_id": recommendation.id,
            "complaint_id": complaint.id,
            "new_status": complaint.status,
            "external_reference": adapter_res.external_reference,
            "responsibility": target_role,
            "message": adapter_res.message,
        }

    @staticmethod
    async def reject_recommendation(
        session: AsyncSession,
        recommendation_id: str,
        approver_id: str,
        reason: Optional[str] = None,
        request_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Reject a pending recommendation with documented reason."""
        rec_stmt = select(RecommendationModel).where(RecommendationModel.id == recommendation_id)
        rec_res = await session.execute(rec_stmt)
        recommendation = rec_res.scalar_one_or_none()
        if not recommendation:
            raise NotFoundException("Recommendation not found")

        if recommendation.status != RecommendationStatus.PENDING:
            raise ActionAlreadyExecutedException(f"Recommendation is already in '{recommendation.status}' state")

        recommendation.status = RecommendationStatus.REJECTED
        recommendation.updated_at = datetime.now(timezone.utc)

        approval = ApprovalModel(
            recommendation_id=recommendation.id,
            approver_id=approver_id,
            decision="REJECTED",
            reason=reason,
        )
        session.add(approval)

        event = ComplaintEventModel(
            complaint_id=recommendation.complaint_id,
            event_type=EventType.APPROVAL_REJECTED,
            actor_type="OPERATOR",
            actor_id=approver_id,
            payload={"recommendation_id": recommendation.id, "reason": reason},
            request_id=request_id,
        )
        session.add(event)

        audit = AuditLogModel(
            actor_id=approver_id,
            actor_type="OPERATOR",
            action="REJECT_RECOMMENDATION",
            resource_type="RECOMMENDATION",
            resource_id=recommendation.id,
            request_id=request_id,
            metadata_json={"reason": reason},
        )
        session.add(audit)

        await session.commit()
        return {
            "success": True,
            "recommendation_id": recommendation.id,
            "status": RecommendationStatus.REJECTED,
            "message": "Recommendation rejected",
        }
