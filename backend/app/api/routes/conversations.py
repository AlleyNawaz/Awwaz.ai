from typing import Dict, Any, Optional, List
import uuid
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.repositories.database import get_db
from app.repositories.models import ConversationModel, MessageModel
from app.agent.orchestrator import AgentOrchestrator
from app.api.deps import get_current_user, format_response, get_request_id
from app.core.errors import ValidationException, NotFoundException

router = APIRouter(prefix="/conversations", tags=["Conversations"])
orchestrator = AgentOrchestrator()


class SubmitMessageRequest(BaseModel):
    conversation_id: Optional[str] = None
    message: str = Field(..., min_length=1, max_length=2000)
    attachment_ids: Optional[List[str]] = Field(default_factory=list)


@router.post("/messages")
async def submit_message(
    req: SubmitMessageRequest,
    session: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    request_id: str = Depends(get_request_id),
):
    citizen_id = current_user.get("user_id")

    clean_msg = req.message.strip()
    if not clean_msg:
        raise ValidationException("Message cannot be empty or whitespace only")

    # 1. Resolve or create conversation
    conv_id = req.conversation_id
    if conv_id:
        conv_res = await session.execute(select(ConversationModel).where(ConversationModel.id == conv_id))
        conv = conv_res.scalar_one_or_none()
        if not conv:
            conv = ConversationModel(id=conv_id, citizen_id=citizen_id)
            session.add(conv)
            await session.commit()
    else:
        conv = ConversationModel(citizen_id=citizen_id)
        session.add(conv)
        await session.commit()
        await session.refresh(conv)
        conv_id = conv.id

    # 2. Process message through agent orchestrator
    agent_response = await orchestrator.process_user_message(
        session=session,
        conversation_id=conv_id,
        citizen_id=citizen_id,
        user_message=req.message,
        current_user=current_user,
        request_id=request_id,
    )

    return format_response({
        "conversation_id": conv_id,
        "reply": {
            "text": agent_response.reply_text,
        },
        "intent": agent_response.intent,
        "category": agent_response.category,
        "clarification_required": agent_response.clarification_required,
        "missing_fields": agent_response.missing_fields,
        "complaint_id": agent_response.complaint_id,
        "complaint_title": agent_response.complaint_title,
        "department_name": agent_response.department_name,
        "trace": [t.model_dump() for t in agent_response.trace],
    }, request_id=request_id)


@router.get("/{conversation_id}/messages")
async def get_messages(
    conversation_id: str,
    session: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    request_id: str = Depends(get_request_id),
):
    res = await session.execute(
        select(MessageModel)
        .where(MessageModel.conversation_id == conversation_id)
        .order_by(MessageModel.created_at.asc())
    )
    messages = res.scalars().all()
    return format_response([
        {
            "id": m.id,
            "sender_type": m.sender_type,
            "content": m.content,
            "created_at": m.created_at.isoformat(),
            "metadata": m.metadata_json,
        }
        for m in messages
    ], request_id=request_id)
