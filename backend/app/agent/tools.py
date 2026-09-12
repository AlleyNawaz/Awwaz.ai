from typing import Dict, Any, List, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from app.domain.complaints.service import ComplaintService
from app.domain.commitments.service import CommitmentService
from app.domain.escalation.service import EscalationService
from app.domain.recurrence.service import RecurrenceService
from app.domain.routing.service import RoutingService
from app.core.security import Roles
from app.core.errors import ForbiddenException, ValidationException


class AgentTools:
    """Catalog of typed tools executable by the agent layer with authorization boundaries."""

    @staticmethod
    async def get_current_case(
        session: AsyncSession,
        complaint_id: str,
        current_user: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Read-only: Fetch current case state."""
        res = await ComplaintService.get_visible_complaint(session, complaint_id, current_user)
        comp = res["complaint"]
        return {
            "id": comp.id,
            "title": comp.title,
            "category": comp.category,
            "status": comp.status,
            "priority": comp.priority,
            "stalled": comp.stalled,
            "responsibility": comp.responsibility_name,
            "location": comp.location_text,
            "created_at": comp.created_at.isoformat(),
        }

    @staticmethod
    async def find_related_cases(
        session: AsyncSession,
        category: str,
        location_text: str,
        current_complaint_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Read-only: Find potential recurrence or duplicates."""
        return await RecurrenceService.find_potential_recurrences(
            session=session,
            category=category,
            location_text=location_text,
            current_complaint_id=current_complaint_id,
        )

    @staticmethod
    def get_department_rules(category: str) -> Dict[str, Any]:
        """Read-only: Fetch configured department routing and SLA rules."""
        config = RoutingService.get_department_config(category)
        if not config:
            return {"error": f"Unknown category: {category}"}
        return {
            "name": config["name"],
            "primary_role": config["primary_role"],
            "escalation_target": config["escalation_target"],
            "responsibility_chain": config["responsibility_chain"],
        }

    @staticmethod
    async def search_civic_knowledge(query: str) -> List[Dict[str, Any]]:
        """Read-only (Exa AI): Retrieve grounded municipal documents and contact registries."""
        from app.integrations.search.exa_adapter import ExaSearchAdapter
        adapter = ExaSearchAdapter()
        return await adapter.search_civic_directory(query)

    @staticmethod
    async def create_case(
        session: AsyncSession,
        citizen_id: str,
        title: str,
        description: str,
        category: str,
        location_text: str,
        priority: str = "MEDIUM",
        actor_user: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Low-risk write tool: Create and route a new case."""
        complaint = await ComplaintService.create_complaint(
            session=session,
            citizen_id=citizen_id,
            title=title,
            description=description,
            category=category,
            location_text=location_text,
            priority=priority,
            actor_id=actor_user.get("user_id") if actor_user else citizen_id,
        )
        return {
            "success": True,
            "complaint_id": complaint.id,
            "category": complaint.category,
            "status": complaint.status,
            "responsibility": complaint.responsibility_name,
        }

    @staticmethod
    async def create_commitment(
        session: AsyncSession,
        complaint_id: str,
        description: str,
        due_at: datetime,
        current_user: Dict[str, Any],
        commitment_type: str = "VISIT",
    ) -> Dict[str, Any]:
        """Authorized write tool: Record an operational commitment (Operator/Admin only)."""
        if current_user.get("role") not in (Roles.OPERATOR, Roles.ADMIN, Roles.SERVICE):
            raise ForbiddenException("Only municipal operators can record official case commitments")

        commitment = await CommitmentService.create_commitment(
            session=session,
            complaint_id=complaint_id,
            description=description,
            due_at=due_at,
            commitment_type=commitment_type,
            actor_id=current_user.get("user_id"),
        )
        return {
            "success": True,
            "commitment_id": commitment.id,
            "description": commitment.description,
            "due_at": commitment.due_at.isoformat(),
            "status": commitment.status,
        }

    @staticmethod
    async def create_recommendation(
        session: AsyncSession,
        complaint_id: str,
        rec_type: str,
        reason: str,
        evidence: List[str],
        incident_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Grounded recommendation tool."""
        rec = await EscalationService.create_recommendation(
            session=session,
            complaint_id=complaint_id,
            rec_type=rec_type,
            reason=reason,
            evidence=evidence,
            incident_key=incident_key,
            requires_approval=True,
        )
        return {
            "success": True,
            "recommendation_id": rec.id,
            "type": rec.type,
            "requires_approval": rec.requires_approval,
            "status": rec.status,
        }
