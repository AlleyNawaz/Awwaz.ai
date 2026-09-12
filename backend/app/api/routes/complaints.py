from typing import Dict, Any, Optional, List
from datetime import datetime
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc
from sqlalchemy.orm import selectinload
from app.repositories.database import get_db
from app.repositories.models import ComplaintModel, ComplaintEventModel, CommitmentModel
from app.domain.complaints.service import ComplaintService
from app.domain.commitments.service import CommitmentService
from app.api.deps import get_current_user, format_response, get_request_id, require_roles
from app.core.security import Roles
from app.core.errors import ValidationException, NotFoundException

router = APIRouter(prefix="/complaints", tags=["Complaints"])


class CreateComplaintRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    description: str = Field(..., min_length=5)
    category: str = Field(...)
    priority: str = Field("MEDIUM")
    location_text: str = Field(...)
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class UpdateStatusRequest(BaseModel):
    target_status: str = Field(...)
    reason: Optional[str] = None
    expected_version: Optional[int] = None


class CreateCommitmentRequest(BaseModel):
    description: str = Field(..., min_length=3)
    due_at: datetime = Field(...)
    commitment_type: str = Field("VISIT")


@router.post("")
async def create_complaint(
    req: CreateComplaintRequest,
    session: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    request_id: str = Depends(get_request_id),
):
    citizen_id = current_user.get("user_id")
    complaint = await ComplaintService.create_complaint(
        session=session,
        citizen_id=citizen_id,
        title=req.title,
        description=req.description,
        category=req.category,
        location_text=req.location_text,
        priority=req.priority,
        latitude=req.latitude,
        longitude=req.longitude,
        actor_id=citizen_id,
        request_id=request_id,
    )
    return format_response({
        "id": complaint.id,
        "title": complaint.title,
        "category": complaint.category,
        "status": complaint.status,
        "priority": complaint.priority,
        "responsibility": complaint.responsibility_name,
        "version": complaint.version,
    }, request_id=request_id)


@router.get("")
async def list_complaints(
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    stalled: Optional[bool] = Query(None),
    citizen_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    request_id: str = Depends(get_request_id),
):
    query = select(ComplaintModel).options(selectinload(ComplaintModel.department))
    filters = []

    # If role is citizen, filter only to citizen's complaints
    user_role = current_user.get("role")
    if user_role == Roles.CITIZEN:
        filters.append(ComplaintModel.citizen_id == current_user.get("user_id"))
    elif citizen_id:
        filters.append(ComplaintModel.citizen_id == citizen_id)

    if status:
        filters.append(ComplaintModel.status == status)
    if priority:
        filters.append(ComplaintModel.priority == priority)
    if category:
        filters.append(ComplaintModel.category == category)
    if stalled is not None:
        filters.append(ComplaintModel.stalled == stalled)

    if filters:
        query = query.where(and_(*filters))

    # Priority sort: PENDING / ESCALATION_PENDING first, then stalled, then priority, then updated_at
    query = query.order_by(
        desc(ComplaintModel.stalled),
        desc(ComplaintModel.created_at),
    ).offset((page - 1) * page_size).limit(page_size)

    res = await session.execute(query)
    complaints = res.scalars().all()

    return format_response([
        {
            "id": c.id,
            "title": c.title,
            "category": c.category,
            "priority": c.priority,
            "status": c.status,
            "stalled": c.stalled,
            "location": c.location_text,
            "responsibility": c.responsibility_name,
            "department": c.department.name if c.department else None,
            "version": c.version,
            "created_at": c.created_at.isoformat(),
            "updated_at": c.updated_at.isoformat(),
            "external_reference": c.external_reference,
        }
        for c in complaints
    ], request_id=request_id)


@router.get("/{complaint_id}")
async def get_complaint(
    complaint_id: str,
    session: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    request_id: str = Depends(get_request_id),
):
    case_data = await ComplaintService.get_visible_complaint(session, complaint_id, current_user)
    c: ComplaintModel = case_data["complaint"]

    # Public-safe timeline events
    events = [
        {
            "id": e.id,
            "event_type": e.event_type,
            "actor_type": e.actor_type,
            "payload": e.payload,
            "created_at": e.created_at.isoformat(),
        }
        for e in c.events
    ]

    commitments = [
        {
            "id": comm.id,
            "description": comm.description,
            "due_at": comm.due_at.isoformat(),
            "status": comm.status,
            "commitment_type": comm.commitment_type,
            "fulfilled_at": comm.fulfilled_at.isoformat() if comm.fulfilled_at else None,
        }
        for comm in c.commitments
    ]

    recommendations = [
        {
            "id": r.id,
            "type": r.type,
            "status": r.status,
            "reason": r.reason,
            "evidence": r.evidence,
            "requires_approval": r.requires_approval,
            "created_at": r.created_at.isoformat(),
        }
        for r in c.recommendations
    ]

    evidence_items = [
        {
            "id": ev.id,
            "filename": ev.filename,
            "mime_type": ev.mime_type,
            "size_bytes": ev.size_bytes,
            "storage_key": ev.storage_key,
            "created_at": ev.created_at.isoformat(),
        }
        for ev in c.evidence_items
    ]

    return format_response({
        "id": c.id,
        "title": c.title,
        "description": c.description,
        "category": c.category,
        "priority": c.priority,
        "status": c.status,
        "stalled": c.stalled,
        "location_text": c.location_text,
        "latitude": c.latitude,
        "longitude": c.longitude,
        "responsibility_type": c.responsibility_type,
        "responsibility_name": c.responsibility_name,
        "department": {
            "id": c.department.id,
            "name": c.department.name,
            "escalation_target": c.department.escalation_target_id,
        } if c.department else None,
        "external_reference": c.external_reference,
        "version": c.version,
        "created_at": c.created_at.isoformat(),
        "updated_at": c.updated_at.isoformat(),
        "last_progress_at": c.last_progress_at.isoformat(),
        "events": events,
        "commitments": commitments,
        "recommendations": recommendations,
        "evidence": evidence_items,
        "potential_recurrences": case_data["recurrences"],
    }, request_id=request_id)


@router.patch("/{complaint_id}/status")
async def update_complaint_status(
    complaint_id: str,
    req: UpdateStatusRequest,
    session: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_roles([Roles.OPERATOR, Roles.ADMIN, Roles.SERVICE])),
    request_id: str = Depends(get_request_id),
):
    complaint = await ComplaintService.transition_status(
        session=session,
        complaint_id=complaint_id,
        target_status=req.target_status,
        actor_id=current_user.get("user_id"),
        actor_role=current_user.get("role"),
        reason=req.reason,
        expected_version=req.expected_version,
        request_id=request_id,
    )
    return format_response({
        "id": complaint.id,
        "status": complaint.status,
        "version": complaint.version,
        "updated_at": complaint.updated_at.isoformat(),
    }, request_id=request_id)


@router.post("/{complaint_id}/commitments")
async def create_commitment(
    complaint_id: str,
    req: CreateCommitmentRequest,
    session: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_roles([Roles.OPERATOR, Roles.ADMIN, Roles.SERVICE])),
    request_id: str = Depends(get_request_id),
):
    commitment = await CommitmentService.create_commitment(
        session=session,
        complaint_id=complaint_id,
        description=req.description,
        due_at=req.due_at,
        commitment_type=req.commitment_type,
        actor_id=current_user.get("user_id"),
    )
    return format_response({
        "id": commitment.id,
        "description": commitment.description,
        "due_at": commitment.due_at.isoformat(),
        "status": commitment.status,
    }, request_id=request_id)


@router.post("/{complaint_id}/commitments/{commitment_id}/fulfill")
async def fulfill_commitment(
    complaint_id: str,
    commitment_id: str,
    session: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_roles([Roles.OPERATOR, Roles.ADMIN, Roles.SERVICE])),
    request_id: str = Depends(get_request_id),
):
    fulfilled = await CommitmentService.fulfill_commitment(
        session=session,
        commitment_id=commitment_id,
        actor_id=current_user.get("user_id"),
    )
    return format_response({
        "id": fulfilled.id,
        "description": fulfilled.description,
        "status": fulfilled.status,
        "fulfilled_at": fulfilled.fulfilled_at.isoformat() if fulfilled.fulfilled_at else None,
    }, request_id=request_id)


@router.get("/{complaint_id}/agent-trace")
async def get_agent_trace(
    complaint_id: str,
    session: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    request_id: str = Depends(get_request_id),
):
    """Safe operational activity trace reconstructed from append-only events."""
    stmt = (
        select(ComplaintEventModel)
        .where(ComplaintEventModel.complaint_id == complaint_id)
        .order_by(ComplaintEventModel.created_at.asc())
    )
    res = await session.execute(stmt)
    events = res.scalars().all()

    trace_steps = []
    for idx, ev in enumerate(events, start=1):
        action_title = ev.event_type.replace("_", " ").title()
        trace_steps.append({
            "step": idx,
            "action": action_title,
            "actor": ev.actor_type,
            "details": ev.payload,
            "timestamp": ev.created_at.isoformat(),
        })

    return format_response(trace_steps, request_id=request_id)
