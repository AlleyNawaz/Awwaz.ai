from typing import Dict, Any, Optional, List
from pydantic import BaseModel
from fastapi import APIRouter, Depends, Header, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from app.repositories.database import get_db
from app.repositories.models import RecommendationModel, ComplaintModel
from app.domain.escalation.service import EscalationService
from app.integrations.civic.mock import MockCivicServiceAdapter
from app.api.deps import get_current_user, format_response, get_request_id, require_roles
from app.core.security import Roles
from app.core.errors import ValidationException, NotFoundException

router = APIRouter(prefix="/recommendations", tags=["Recommendations & Approvals"])
civic_adapter = MockCivicServiceAdapter()


class ApproveRecommendationRequest(BaseModel):
    comment: Optional[str] = "Approved after reviewing the case history and SLA thresholds."
    expected_version: Optional[int] = None


class RejectRecommendationRequest(BaseModel):
    comment: Optional[str] = "Rejected: insufficient operational justification."


@router.get("")
async def list_recommendations(
    status: Optional[str] = Query(None),
    rec_type: Optional[str] = Query(None, alias="type"),
    complaint_id: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_roles([Roles.OPERATOR, Roles.ADMIN, Roles.SERVICE])),
    request_id: str = Depends(get_request_id),
):
    query = select(RecommendationModel).options(selectinload(RecommendationModel.complaint))
    filters = []
    if status:
        filters.append(RecommendationModel.status == status)
    if rec_type:
        filters.append(RecommendationModel.type == rec_type)
    if complaint_id:
        filters.append(RecommendationModel.complaint_id == complaint_id)

    if filters:
        query = query.where(and_(*filters))

    query = query.order_by(RecommendationModel.created_at.desc())
    res = await session.execute(query)
    recs = res.scalars().all()

    return format_response([
        {
            "id": r.id,
            "complaint_id": r.complaint_id,
            "complaint_title": r.complaint.title if r.complaint else None,
            "complaint_category": r.complaint.category if r.complaint else None,
            "complaint_status": r.complaint.status if r.complaint else None,
            "type": r.type,
            "status": r.status,
            "reason": r.reason,
            "evidence": r.evidence,
            "requires_approval": r.requires_approval,
            "incident_key": r.incident_key,
            "created_at": r.created_at.isoformat(),
        }
        for r in recs
    ], request_id=request_id)


@router.post("/{recommendation_id}/approve")
async def approve_recommendation(
    recommendation_id: str,
    req: ApproveRecommendationRequest,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    session: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_roles([Roles.OPERATOR, Roles.ADMIN, Roles.SERVICE])),
    request_id: str = Depends(get_request_id),
):
    # Enforce idempotency key (use header or fallback to stable request_id)
    resolved_idempotency_key = idempotency_key or f"rec_app_{recommendation_id}_{request_id}"

    result = await EscalationService.approve_recommendation(
        session=session,
        recommendation_id=recommendation_id,
        approver_id=current_user.get("user_id"),
        idempotency_key=resolved_idempotency_key,
        adapter=civic_adapter,
        comment=req.comment,
        expected_version=req.expected_version,
        request_id=request_id,
    )
    return format_response(result, request_id=request_id)


@router.post("/{recommendation_id}/reject")
async def reject_recommendation(
    recommendation_id: str,
    req: RejectRecommendationRequest,
    session: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_roles([Roles.OPERATOR, Roles.ADMIN, Roles.SERVICE])),
    request_id: str = Depends(get_request_id),
):
    result = await EscalationService.reject_recommendation(
        session=session,
        recommendation_id=recommendation_id,
        approver_id=current_user.get("user_id"),
        reason=req.comment,
        request_id=request_id,
    )
    return format_response(result, request_id=request_id)
