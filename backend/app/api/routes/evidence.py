from typing import Dict, Any
from pathlib import Path
from fastapi import APIRouter, Depends, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.repositories.database import get_db
from app.repositories.models import ComplaintModel, EvidenceModel, ComplaintEventModel
from app.integrations.storage.local import LocalStorageService
from app.domain.complaints.entities import EventType
from app.api.deps import get_current_user, format_response, get_request_id
from app.core.config import settings
from app.core.errors import NotFoundException, ValidationException

router = APIRouter(tags=["Evidence"])


@router.post("/complaints/{complaint_id}/evidence")
async def upload_evidence(
    complaint_id: str,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    request_id: str = Depends(get_request_id),
):
    # Verify complaint exists
    stmt = select(ComplaintModel).where(ComplaintModel.id == complaint_id)
    res = await session.execute(stmt)
    complaint = res.scalar_one_or_none()
    if not complaint:
        raise NotFoundException("Complaint not found")

    content = await file.read()
    if not content:
        raise ValidationException("Uploaded file is empty")

    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    if len(content) > MAX_FILE_SIZE:
        raise ValidationException("File size exceeds 10MB limit")

    ALLOWED_MIMES = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
    content_type = file.content_type or "image/jpeg"
    if content_type not in ALLOWED_MIMES:
        raise ValidationException(f"Unsupported file format: {content_type}. Allowed: JPEG, PNG, WebP, PDF.")

    file_info = LocalStorageService.save_evidence_file(
        file_bytes=content,
        filename=file.filename or "evidence.jpg",
        content_type=content_type,
    )

    evidence = EvidenceModel(
        complaint_id=complaint.id,
        storage_key=file_info["storage_key"],
        filename=file_info["filename"],
        mime_type=file_info["mime_type"],
        size_bytes=file_info["size_bytes"],
        sha256=file_info["sha256"],
    )
    session.add(evidence)

    # Timeline event
    event = ComplaintEventModel(
        complaint_id=complaint.id,
        event_type="EVIDENCE_ATTACHED",
        actor_type=current_user.get("role"),
        actor_id=current_user.get("user_id"),
        payload={
            "filename": file_info["filename"],
            "mime_type": file_info["mime_type"],
            "storage_key": file_info["storage_key"],
            "size_bytes": file_info["size_bytes"],
        },
        request_id=request_id,
    )
    session.add(event)

    await session.commit()
    await session.refresh(evidence)

    return format_response({
        "id": evidence.id,
        "storage_key": evidence.storage_key,
        "filename": evidence.filename,
        "mime_type": evidence.mime_type,
        "size_bytes": evidence.size_bytes,
        "url": f"/api/v1/evidence/{evidence.storage_key}",
    }, request_id=request_id)


@router.get("/evidence/{storage_key}")
@router.head("/evidence/{storage_key}")
async def get_evidence_file(storage_key: str):
    file_path = Path(settings.UPLOAD_DIR) / storage_key
    if not file_path.exists():
        raise NotFoundException("Evidence file not found")
    return FileResponse(path=file_path)
