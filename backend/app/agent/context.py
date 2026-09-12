from typing import List, Dict, Any, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.models import MessageModel, ComplaintModel


class ContextBuilder:
    @staticmethod
    async def build_agent_context(
        session: AsyncSession,
        conversation_id: str,
        citizen_id: str,
        max_turns: int = 10,
    ) -> Dict[str, Any]:
        """Assemble bounded context for the agent loop."""
        # 1. Recent conversation history
        msg_stmt = (
            select(MessageModel)
            .where(MessageModel.conversation_id == conversation_id)
            .order_by(MessageModel.created_at.desc())
            .limit(max_turns)
        )
        msg_res = await session.execute(msg_stmt)
        messages = list(reversed(msg_res.scalars().all()))

        history = [
            {
                "sender_type": m.sender_type,
                "content": m.content,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ]

        # 2. Previous complaints for this citizen
        comp_stmt = (
            select(ComplaintModel)
            .where(ComplaintModel.citizen_id == citizen_id)
            .order_by(ComplaintModel.created_at.desc())
            .limit(3)
        )
        comp_res = await session.execute(comp_stmt)
        prev_complaints = [
            {
                "id": c.id,
                "title": c.title,
                "category": c.category,
                "status": c.status,
                "location": c.location_text,
            }
            for c in comp_res.scalars().all()
        ]

        return {
            "conversation_id": conversation_id,
            "citizen_id": citizen_id,
            "history": history,
            "previous_complaints": prev_complaints,
        }
