from typing import Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.workers.stall_detector import StallDetectorWorker
from app.workers.commitment_checker import CommitmentCheckerWorker


class BackgroundScheduler:
    @staticmethod
    async def run_all(session: AsyncSession) -> Dict[str, Any]:
        """Run all deterministic worker tasks."""
        stalled = await StallDetectorWorker.run(session)
        missed = await CommitmentCheckerWorker.run(session)
        return {
            "stalled_cases_detected": len(stalled),
            "stalled_cases": stalled,
            "missed_commitments_detected": len(missed),
            "missed_commitments": missed,
        }
