from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

# In-memory in-app notification center for demo session
_NOTIFICATIONS: List[Dict[str, Any]] = []


class InAppNotificationAdapter:
    @staticmethod
    def send_notification(user_id: str, title: str, message: str, level: str = "INFO") -> Dict[str, Any]:
        notif = {
            "id": f"notif_{len(_NOTIFICATIONS) + 1}",
            "user_id": user_id,
            "title": title,
            "message": message,
            "level": level,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "read": False,
        }
        _NOTIFICATIONS.append(notif)
        return notif

    @staticmethod
    def get_notifications(user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        if user_id:
            return [n for n in _NOTIFICATIONS if n["user_id"] == user_id]
        return _NOTIFICATIONS
