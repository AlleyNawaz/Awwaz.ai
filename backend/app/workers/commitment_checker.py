from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.domain.commitments.service import CommitmentService


class CommitmentCheckerWorker:
    @staticmethod
    async def run(session: AsyncSession) -> List[Dict[str, Any]]:
        """Worker evaluating overdue commitments and creating alerts."""
        return await CommitmentService.check_missed_commitments(session)
