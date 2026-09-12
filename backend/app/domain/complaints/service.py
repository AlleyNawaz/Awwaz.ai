from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.repositories.models import (
    ComplaintModel,
    ComplaintEventModel,
    DepartmentModel,
    AuditLogModel,
    UserModel,
)
from app.domain.complaints.entities import (
    ComplaintStatus,
    Priority,
    ComplaintCategory,
    EventType,
)
from app.domain.complaints.transitions import validate_transition
from app.domain.routing.service import RoutingService
from app.domain.recurrence.service import RecurrenceService
from app.core.errors import NotFoundException, ConflictException, ForbiddenException
from app.core.security import Roles


class ComplaintService:
    @staticmethod
    async def create_complaint(
        session: AsyncSession,
        citizen_id: str,
        title: str,
        description: str,
        category: str,
        location_text: str,
        priority: str = Priority.MEDIUM,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        actor_id: Optional[str] = None,
        request_id: Optional[str] = None,
    ) -> ComplaintModel:
        """Create and route a canonical complaint."""
        # 1. Resolve department and assignment
        assignment = RoutingService.get_initial_assignment(category)
        normalized_loc = RecurrenceService.normalize_location(location_text)

        # 2. Find or create department
        dept_stmt = select(DepartmentModel).where(DepartmentModel.category == category)
        dept_res = await session.execute(dept_stmt)
        department = dept_res.scalar_one_or_none()

        dept_id = department.id if department else None

        # 3. Create complaint model
        complaint = ComplaintModel(
            citizen_id=citizen_id,
            department_id=dept_id,
            title=title,
            description=description,
            category=category,
            priority=priority,
            status=ComplaintStatus.SUBMITTED,
            responsibility_type=assignment["responsibility_type"],
            responsibility_name=assignment["responsibility_name"],
            location_text=location_text,
            latitude=latitude,
            longitude=longitude,
            normalized_location=normalized_loc,
            stalled=False,
            version=1,
            last_progress_at=datetime.now(timezone.utc),
        )
        session.add(complaint)
        await session.flush()  # Generate complaint.id

        # 4. Append Creation Events
        created_event = ComplaintEventModel(
            complaint_id=complaint.id,
            event_type=EventType.COMPLAINT_CREATED,
            actor_type="CITIZEN",
            actor_id=citizen_id,
            payload={
                "title": title,
                "category": category,
                "priority": priority,
                "location": location_text,
            },
            request_id=request_id,
        )
        session.add(created_event)

        routed_event = ComplaintEventModel(
            complaint_id=complaint.id,
            event_type=EventType.COMPLAINT_ROUTED,
            actor_type="SYSTEM",
            payload={
                "department": assignment["department_name"],
                "category": category,
            },
            request_id=request_id,
        )
        session.add(routed_event)

        assigned_event = ComplaintEventModel(
            complaint_id=complaint.id,
            event_type=EventType.COMPLAINT_ASSIGNED,
            actor_type="SYSTEM",
            payload={
                "responsible_role": assignment["responsibility_name"],
                "escalation_desk": assignment["escalation_target"],
            },
            request_id=request_id,
        )
        session.add(assigned_event)

        # Transition directly to ASSIGNED as part of autonomous intake triage
        complaint.status = ComplaintStatus.ASSIGNED

        # 5. Audit Log
        audit = AuditLogModel(
            actor_id=actor_id or citizen_id,
            actor_type="CITIZEN",
            action="CREATE_COMPLAINT",
            resource_type="COMPLAINT",
            resource_id=complaint.id,
            request_id=request_id,
            metadata_json={"title": title, "category": category, "priority": priority},
        )
        session.add(audit)

        await session.commit()
        await session.refresh(complaint)
        return complaint

    @staticmethod
    async def transition_status(
        session: AsyncSession,
        complaint_id: str,
        target_status: str,
        actor_id: str,
        actor_role: str,
        reason: Optional[str] = None,
        expected_version: Optional[int] = None,
        request_id: Optional[str] = None,
    ) -> ComplaintModel:
        """Apply a validated state transition with optimistic locking."""
        stmt = select(ComplaintModel).where(ComplaintModel.id == complaint_id)
        res = await session.execute(stmt)
        complaint = res.scalar_one_or_none()
        if not complaint:
            raise NotFoundException("Complaint not found")

        # 1. Optimistic version check
        if expected_version is not None and complaint.version != expected_version:
            raise ConflictException(
                f"State version mismatch: complaint is version {complaint.version}, expected {expected_version}"
            )

        # 2. Validate transition
        validate_transition(complaint.status, target_status)

        old_status = complaint.status
        complaint.status = target_status
        complaint.version += 1
        complaint.last_progress_at = datetime.now(timezone.utc)
        complaint.updated_at = datetime.now(timezone.utc)

        # If progressing or resolving, unstall
        if target_status in (ComplaintStatus.IN_PROGRESS, ComplaintStatus.RESOLVED):
            complaint.stalled = False

        # 3. Append Timeline Event
        event = ComplaintEventModel(
            complaint_id=complaint.id,
            event_type=EventType.STATUS_CHANGED,
            actor_type=actor_role,
            actor_id=actor_id,
            payload={
                "from_status": old_status,
                "to_status": target_status,
                "reason": reason or "Status updated",
            },
            request_id=request_id,
        )
        session.add(event)

        # 4. Audit Log
        audit = AuditLogModel(
            actor_id=actor_id,
            actor_type=actor_role,
            action=f"TRANSITION_{target_status}",
            resource_type="COMPLAINT",
            resource_id=complaint.id,
            request_id=request_id,
            metadata_json={"from": old_status, "to": target_status, "reason": reason},
        )
        session.add(audit)

        await session.commit()
        await session.refresh(complaint)
        return complaint

    @staticmethod
    async def get_visible_complaint(
        session: AsyncSession,
        complaint_id: str,
        current_user: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Fetch full complaint details with ownership check."""
        stmt = (
            select(ComplaintModel)
            .where(ComplaintModel.id == complaint_id)
            .options(
                selectinload(ComplaintModel.events),
                selectinload(ComplaintModel.recommendations),
                selectinload(ComplaintModel.commitments),
                selectinload(ComplaintModel.evidence_items),
                selectinload(ComplaintModel.department),
            )
        )
        res = await session.execute(stmt)
        complaint = res.scalar_one_or_none()
        if not complaint:
            raise NotFoundException("Complaint not found")

        # Verify access: citizen can only view their own cases
        user_role = current_user.get("role")
        user_id = current_user.get("user_id")
        if user_role == Roles.CITIZEN and complaint.citizen_id != user_id:
            raise ForbiddenException("You do not have permission to view this complaint")

        # Find potential recurrences
        potential_recurrences = await RecurrenceService.find_potential_recurrences(
            session=session,
            category=complaint.category,
            location_text=complaint.location_text,
            current_complaint_id=complaint.id,
        )

        return {
            "complaint": complaint,
            "recurrences": potential_recurrences,
        }
