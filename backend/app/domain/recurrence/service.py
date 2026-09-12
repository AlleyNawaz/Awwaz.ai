import re
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.models import ComplaintModel


class RecurrenceService:
    @staticmethod
    def normalize_location(location_text: Optional[str]) -> str:
        """
        Normalize civic location strings into canonical tokens.
        E.g. 'Near ABC Chowk, Sector G-9, Islamabad' -> 'abc chowk g-9 islamabad'
        """
        if not location_text:
            return ""
        text = location_text.lower().strip()
        # Filter out navigation noise and conversational filler
        stopwords = {
            "near", "opposite", "opp", "behind", "front", "side", "street", "st",
            "sector", "sec", "road", "bhai", "yahan", "phir", "band", "hai", "raha",
            "wala", "wali", "mein", "par", "the", "and", "broken", "issue", "please",
            "sir", "madam", "outside", "house", "streetlight", "light", "garbage",
            "kachra", "sewage", "gutter", "pothole", "ganda", "pani", "overflow"
        }
        # Replace punctuation with spaces
        text = re.sub(r"[^\w\s-]", " ", text)
        tokens = [t for t in text.split() if len(t) > 1 and t not in stopwords]
        return " ".join(tokens)

    @staticmethod
    async def find_potential_recurrences(
        session: AsyncSession,
        category: str,
        location_text: str,
        current_complaint_id: Optional[str] = None,
        days_window: int = 30,
    ) -> List[Dict[str, Any]]:
        """Find complaints in the same category and overlapping location within the window."""
        normalized = RecurrenceService.normalize_location(location_text)
        if not normalized:
            return []

        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_window)
        query = select(ComplaintModel).where(
            and_(
                ComplaintModel.category == category,
                ComplaintModel.created_at >= cutoff_date,
            )
        )
        if current_complaint_id:
            query = query.where(ComplaintModel.id != current_complaint_id)

        result = await session.execute(query)
        candidates = result.scalars().all()

        tokens = set(normalized.split())
        matched_cases = []

        for candidate in candidates:
            cand_norm = candidate.normalized_location or RecurrenceService.normalize_location(candidate.location_text)
            cand_tokens = set(cand_norm.split())
            overlap = tokens.intersection(cand_tokens)

            # If there is token overlap in location
            if overlap:
                score = len(overlap) / max(len(tokens), 1)
                matched_cases.append({
                    "id": candidate.id,
                    "external_reference": candidate.external_reference,
                    "title": candidate.title,
                    "status": candidate.status,
                    "created_at": candidate.created_at.isoformat() if candidate.created_at else None,
                    "location_text": candidate.location_text,
                    "similarity_score": round(score, 2),
                    "match_reason": f"Shared civic area tokens: {', '.join(overlap)}",
                })

        # Sort by highest score first, then newest
        matched_cases.sort(key=lambda x: (x["similarity_score"], x["created_at"] or ""), reverse=True)
        return matched_cases[:10]
