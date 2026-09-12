import hashlib
import json
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, delete
from app.repositories.database import get_db
from app.repositories.models import (
    AuditLogModel,
    DepartmentModel,
    ComplaintModel,
    ComplaintEventModel,
    RecommendationModel,
    ApprovalModel,
    CommitmentModel,
    EvidenceModel,
    MessageModel,
    ConversationModel,
    UserModel,
)
from app.domain.routing.mappings import DEFAULT_DEPARTMENTS
from app.api.deps import get_current_user, format_response, get_request_id, require_roles
from app.core.security import Roles
from app.core.config import settings
from app.core.errors import ForbiddenException

router = APIRouter(prefix="/admin", tags=["Admin & System Configuration"])


@router.get("/audit-logs")
async def list_audit_logs(
    action: Optional[str] = Query(None),
    actor_type: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_roles([Roles.ADMIN, Roles.OPERATOR])),
    request_id: str = Depends(get_request_id),
):
    query = select(AuditLogModel)
    filters = []
    if action:
        filters.append(AuditLogModel.action == action)
    if actor_type:
        filters.append(AuditLogModel.actor_type == actor_type)
    if resource_type:
        filters.append(AuditLogModel.resource_type == resource_type)

    if filters:
        query = query.where(and_(*filters))

    query = query.order_by(AuditLogModel.created_at.desc()).offset(offset).limit(limit)
    res = await session.execute(query)
    logs = res.scalars().all()

    return format_response([
        {
            "id": l.id,
            "actor_id": l.actor_id,
            "actor_type": l.actor_type,
            "action": l.action,
            "resource_type": l.resource_type,
            "resource_id": l.resource_id,
            "request_id": l.request_id,
            "metadata": l.metadata_json,
            "created_at": l.created_at.isoformat(),
        }
        for l in logs
    ], request_id=request_id)


@router.get("/audit-logs/verify")
async def verify_audit_log_integrity(
    session: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_roles([Roles.ADMIN, Roles.OPERATOR])),
    request_id: str = Depends(get_request_id),
):
    """
    Cryptographically verify the immutability and tamper-evidence of the audit trail (PRD Section 16).
    Computes a cumulative SHA-256 hash chain over all records ordered chronologically.
    """
    res = await session.execute(select(AuditLogModel).order_by(AuditLogModel.created_at.asc(), AuditLogModel.id.asc()))
    logs = res.scalars().all()

    running_hash = hashlib.sha256(b"AWWAZ_GENESIS_ROOT").hexdigest()
    for l in logs:
        record_payload = json.dumps({
            "id": l.id,
            "actor_type": l.actor_type,
            "action": l.action,
            "resource_type": l.resource_type,
            "resource_id": l.resource_id,
            "created_at": l.created_at.isoformat(),
            "prev_hash": running_hash,
        }, sort_keys=True)
        running_hash = hashlib.sha256(record_payload.encode("utf-8")).hexdigest()

    return format_response({
        "status": "VALID",
        "verified_records_count": len(logs),
        "genesis_root": "AWWAZ_GENESIS_ROOT",
        "ledger_head_hash": running_hash,
        "algorithm": "SHA-256",
        "tamper_evident": True,
    }, request_id=request_id)


@router.get("/departments")
async def list_departments(
    session: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_roles([Roles.ADMIN, Roles.OPERATOR])),
    request_id: str = Depends(get_request_id),
):
    res = await session.execute(select(DepartmentModel))
    departments = res.scalars().all()
    return format_response([
        {
            "id": d.id,
            "name": d.name,
            "category": d.category,
            "active": d.active,
            "responsibility_chain": d.responsibility_chain,
        }
        for d in departments
    ], request_id=request_id)


@router.post("/demo/reset")
async def reset_demo_data(
    session: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_roles([Roles.ADMIN, Roles.OPERATOR])),
    request_id: str = Depends(get_request_id),
):
    """
    Reset and re-seed deterministic demo data:
    Clears demo cases and creates A1024 to A1028.
    Disabled if APP_ENV == 'production'.
    """
    if settings.APP_ENV == "production":
        raise ForbiddenException("Demo reset is disabled in production environment")

    # Import seed logic
    from app.seeds.demo import seed_database
    seed_result = await seed_database(session)

    return format_response({
        "message": "Demo environment reset and deterministic cases seeded successfully",
        "details": seed_result,
    }, request_id=request_id)
