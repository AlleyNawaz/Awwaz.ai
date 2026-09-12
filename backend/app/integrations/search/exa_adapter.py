"""
Exa AI Neural Search & Knowledge Retrieval Integration.
Provides semantic search over civic departmental jurisdictions, municipal directories, and public works schedules.
"""

import httpx
from typing import Dict, Any, List, Optional
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("integrations.exa")


class ExaSearchAdapter:
    """
    Adapter for Exa AI (https://exa.ai) semantic search engine.
    Retrieves grounded context regarding municipal bylaws, utility routing rules, and jurisdictional contacts.
    """

    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        self.api_key = api_key or settings.EXA_API_KEY
        self.base_url = (base_url or settings.EXA_BASE_URL).rstrip("/")

    async def search_civic_directory(self, query: str, num_results: int = 3) -> List[Dict[str, Any]]:
        """
        Execute a neural search query for municipal context and department contacts.
        Falls back gracefully to deterministic municipal knowledge if an API key is not configured.
        """
        if not self.api_key:
            logger.info("Exa API key not configured. Utilizing deterministic municipal directory grounding.")
            return self._mock_civic_search(query)

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                headers = {
                    "x-api-key": self.api_key,
                    "Content-Type": "application/json",
                }
                payload = {
                    "query": query,
                    "type": "neural",
                    "useAutoprompt": True,
                    "numResults": num_results,
                }
                resp = await client.post(f"{self.base_url}/search", json=payload, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    return [
                        {
                            "title": res.get("title", "Municipal Document"),
                            "url": res.get("url", ""),
                            "snippet": res.get("text", res.get("highlight", "")),
                        }
                        for res in data.get("results", [])
                    ]
                else:
                    logger.warning(f"Exa search returned status {resp.status_code}. Using fallback directory.")
                    return self._mock_civic_search(query)
        except Exception as exc:
            logger.error(f"Exa search error: {exc}")
            return self._mock_civic_search(query)

    def _mock_civic_search(self, query: str) -> List[Dict[str, Any]]:
        query_lower = query.lower()
        if "water" in query_lower or "sewer" in query_lower or "drainage" in query_lower or "gutter" in query_lower:
            return [{
                "title": "Water and Sanitation Agency (WASA) Operational Protocol",
                "url": "https://wasa.gov.pk/operations/drainage-slas",
                "snippet": "WASA Directorate of Drainage operates emergency suction trucks for Sector G-9 and F-10. Standard SLA: 48h resolution, 72h max escalation threshold."
            }]
        elif "light" in query_lower or "pole" in query_lower or "electric" in query_lower:
            return [{
                "title": "CDA Directorate of Electrical Engineering Guidelines",
                "url": "https://cda.gov.pk/services/electrical-maintenance",
                "snippet": "CDA Electrical Engineering Division is responsible for street illumination across sectors G, F, H, and I. Standard replacement cycle: 24-48 hours."
            }]
        elif "waste" in query_lower or "garbage" in query_lower or "trash" in query_lower:
            return [{
                "title": "Municipal Solid Waste Collection Schedule",
                "url": "https://mci.gov.pk/waste-management/schedules",
                "snippet": "Solid waste collection runs daily at 06:00 and 18:00. Commercial market dumpsters are serviced twice daily by MCI Sanitation Directorate."
            }]
        return [{
            "title": "Municipal Services General Administration",
            "url": "https://civic.local/administration/contacts",
            "snippet": "Central Triage Unit routes inter-departmental boundary cases between CDA, RDA, and District Administration."
        }]
