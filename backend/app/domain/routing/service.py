from typing import Optional, Dict, Any, Tuple
from app.domain.complaints.entities import ComplaintCategory
from app.domain.routing.mappings import DEFAULT_DEPARTMENTS


class RoutingService:
    @staticmethod
    def get_department_config(category: str) -> Optional[Dict[str, Any]]:
        return DEFAULT_DEPARTMENTS.get(category)

    @staticmethod
    def resolve_category_from_text(text: str) -> Tuple[str, float]:
        """Deterministic keyword-based classification with confidence score."""
        text_lower = text.lower()
        best_category = ComplaintCategory.UNKNOWN
        max_matches = 0

        for cat, config in DEFAULT_DEPARTMENTS.items():
            matches = sum(1 for kw in config["keywords"] if kw in text_lower)
            if matches > max_matches:
                max_matches = matches
                best_category = cat

        if max_matches >= 2:
            confidence = min(0.70 + (max_matches * 0.08), 0.96)
            return best_category, round(confidence, 2)
        elif max_matches == 1:
            return best_category, 0.75
        else:
            return ComplaintCategory.GENERAL_SERVICES, 0.40

    @staticmethod
    def get_initial_assignment(category: str) -> Dict[str, str]:
        """Return the default department name, initial responsible role, and escalation desk."""
        config = DEFAULT_DEPARTMENTS.get(category, DEFAULT_DEPARTMENTS[ComplaintCategory.GENERAL_SERVICES])
        return {
            "department_name": config["name"],
            "responsibility_type": "DEPARTMENT_ROLE",
            "responsibility_name": config["primary_role"],
            "escalation_target": config["escalation_target"],
        }
