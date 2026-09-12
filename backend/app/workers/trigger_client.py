"""
Trigger.dev Background Task Integration.
Enables cloud-native durable background jobs for 72-hour SLA stall detection, commitment tracking,
and asynchronous municipal dispatch notifications.
"""

import httpx
from typing import Dict, Any, Optional
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("workers.trigger_dev")


class TriggerDevClient:
    """
    Client for Trigger.dev (https://trigger.dev) durable execution platform.
    Dispatches background tasks with automatic retries, scheduling, and execution telemetry.
    """

    def __init__(self, api_key: Optional[str] = None, project_id: Optional[str] = None):
        self.api_key = api_key or settings.TRIGGER_API_KEY
        self.project_id = project_id or settings.TRIGGER_PROJECT_ID
        self.api_url = settings.TRIGGER_API_URL.rstrip("/")

    async def trigger_stall_check_job(self) -> Dict[str, Any]:
        """Trigger an on-demand SLA stall detection pass via Trigger.dev cloud workflow."""
        if not self.api_key:
            logger.info("Trigger.dev API key not provided; operating in local scheduler mode.")
            return {"status": "skipped", "mode": "local_cron"}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                }
                payload = {
                    "task": "awwaz-sla-stall-sentinel",
                    "payload": {"threshold_hours": settings.STALL_THRESHOLD_HOURS},
                }
                resp = await client.post(f"{self.api_url}/api/v1/tasks/trigger", json=payload, headers=headers)
                if resp.status_code in (200, 201):
                    return {"status": "dispatched", "run_id": resp.json().get("id")}
                return {"status": "error", "code": resp.status_code}
        except Exception as exc:
            logger.error(f"Failed to dispatch Trigger.dev job: {exc}")
            return {"status": "error", "detail": str(exc)}

    async def trigger_escalation_dispatch(self, recommendation_id: str, complaint_id: str) -> Dict[str, Any]:
        """Dispatch external civic notification task after human-in-the-loop approval."""
        if not self.api_key:
            return {"status": "skipped", "mode": "in_process"}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                }
                payload = {
                    "task": "awwaz-civic-escalation-dispatch",
                    "payload": {
                        "recommendation_id": recommendation_id,
                        "complaint_id": complaint_id,
                    },
                }
                resp = await client.post(f"{self.api_url}/api/v1/tasks/trigger", json=payload, headers=headers)
                return {"status": "dispatched", "run_id": resp.json().get("id")}
        except Exception as exc:
            logger.error(f"Failed to dispatch escalation job to Trigger.dev: {exc}")
            return {"status": "error", "detail": str(exc)}
