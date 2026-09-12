import hmac
import hashlib
import base64
import json
import time
from typing import Optional, Dict, Any
from app.core.config import settings
from app.core.errors import UnauthorizedException, ForbiddenException


class Roles:
    CITIZEN = "CITIZEN"
    OPERATOR = "OPERATOR"
    ADMIN = "ADMIN"
    SERVICE = "SERVICE"


def create_session_token(user_id: str, role: str, email: str, name: str) -> str:
    """Create a signed, tamper-evident session token."""
    payload = {
        "user_id": user_id,
        "role": role,
        "email": email,
        "name": name,
        "exp": int(time.time()) + settings.SESSION_MAX_AGE_SECONDS,
    }
    payload_bytes = json.dumps(payload, sort_keys=True).encode("utf-8")
    signature = hmac.new(
        settings.AUTH_SECRET.encode("utf-8"),
        payload_bytes,
        hashlib.sha256,
    ).digest()
    return f"{base64.urlsafe_b64encode(payload_bytes).decode('utf-8')}.{base64.urlsafe_b64encode(signature).decode('utf-8')}"


def decode_session_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify and decode a signed session token."""
    try:
        parts = token.split(".")
        if len(parts) != 2:
            return None
        payload_b64, sig_b64 = parts[0], parts[1]
        payload_bytes = base64.urlsafe_b64decode(payload_b64.encode("utf-8"))
        expected_sig = hmac.new(
            settings.AUTH_SECRET.encode("utf-8"),
            payload_bytes,
            hashlib.sha256,
        ).digest()
        provided_sig = base64.urlsafe_b64decode(sig_b64.encode("utf-8"))

        if not hmac.compare_digest(expected_sig, provided_sig):
            return None

        payload = json.loads(payload_bytes.decode("utf-8"))
        if payload.get("exp", 0) < time.time():
            return None

        return payload
    except Exception:
        return None


def verify_resource_ownership(current_user: Dict[str, Any], resource_owner_id: str):
    """Verify that current user owns the resource or has OPERATOR / ADMIN privileges."""
    user_role = current_user.get("role")
    user_id = current_user.get("user_id")

    if user_role in (Roles.OPERATOR, Roles.ADMIN, Roles.SERVICE):
        return True

    if user_id != resource_owner_id:
        raise ForbiddenException("You are not authorized to access or modify this resource")
    return True
