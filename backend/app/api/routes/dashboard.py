from typing import Dict, Any, List
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.repositories.database import get_db
from app.repositories.models import ComplaintModel, RecommendationModel, to_utc
from app.domain.complaints.entities import ComplaintStatus, Priority, RecommendationStatus
from app.workers.scheduler import BackgroundScheduler
from app.api.deps import get_current_user, format_response, get_request_id, require_roles
from app.core.security import Roles

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary")
async def get_dashboard_summary(
    session: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_roles([Roles.OPERATOR, Roles.ADMIN, Roles.SERVICE])),
    request_id: str = Depends(get_request_id),
):
    """Operational KPI summary metrics for Operator Command Center."""
    # 1. Open Cases
    open_stmt = select(func.count(ComplaintModel.id)).where(
        ~ComplaintModel.status.in_([ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED])
    )
    open_res = await session.execute(open_stmt)
    open_count = open_res.scalar_one()

    # 2. High & Critical Priority
    high_stmt = select(func.count(ComplaintModel.id)).where(
        and_(
            ComplaintModel.priority.in_([Priority.HIGH, Priority.CRITICAL]),
            ~ComplaintModel.status.in_([ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED]),
        )
    )
    high_res = await session.execute(high_stmt)
    high_count = high_res.scalar_one()

    # 3. Stalled Cases
    stalled_stmt = select(func.count(ComplaintModel.id)).where(
        and_(
            ComplaintModel.stalled == True,
            ~ComplaintModel.status.in_([ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED]),
        )
    )
    stalled_res = await session.execute(stalled_stmt)
    stalled_count = stalled_res.scalar_one()

    # 4. Pending Approvals
    pending_app_stmt = select(func.count(RecommendationModel.id)).where(
        RecommendationModel.status == RecommendationStatus.PENDING
    )
    pending_app_res = await session.execute(pending_app_stmt)
    pending_app_count = pending_app_res.scalar_one()

    # 5. Resolved Today
    today_cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    resolved_stmt = select(func.count(ComplaintModel.id)).where(
        and_(
            ComplaintModel.status.in_([ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED]),
            ComplaintModel.updated_at >= today_cutoff,
        )
    )
    resolved_res = await session.execute(resolved_stmt)
    resolved_count = resolved_res.scalar_one()

    return format_response({
        "open_cases": open_count,
        "high_priority_cases": high_count,
        "stalled_cases": stalled_count,
        "pending_approvals": pending_app_count,
        "resolved_today": resolved_count,
    }, request_id=request_id)


@router.get("/stalled")
async def get_stalled_cases(
    session: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_roles([Roles.OPERATOR, Roles.ADMIN, Roles.SERVICE])),
    request_id: str = Depends(get_request_id),
):
    stmt = (
        select(ComplaintModel)
        .where(
            and_(
                ComplaintModel.stalled == True,
                ~ComplaintModel.status.in_([ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED]),
            )
        )
        .order_by(ComplaintModel.last_progress_at.asc())
    )
    res = await session.execute(stmt)
    cases = res.scalars().all()

    now = datetime.now(timezone.utc)
    return format_response([
        {
            "id": c.id,
            "title": c.title,
            "category": c.category,
            "priority": c.priority,
            "status": c.status,
            "location": c.location_text,
            "responsibility": c.responsibility_name,
            "hours_idle": int((now - to_utc(c.last_progress_at)).total_seconds() / 3600),
            "last_progress_at": c.last_progress_at.isoformat(),
        }
        for c in cases
    ], request_id=request_id)


@router.post("/workers/run")
async def trigger_workers(
    session: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_roles([Roles.OPERATOR, Roles.ADMIN, Roles.SERVICE])),
    request_id: str = Depends(get_request_id),
):
    """On-demand worker pass to evaluate SLA stalls and missed commitments."""
    result = await BackgroundScheduler.run_all(session)
    return format_response(result, request_id=request_id)
