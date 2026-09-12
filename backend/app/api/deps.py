import uuid
from typing import Dict, Any, Optional, List
from fastapi import Request, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.database import get_db
from app.core.security import decode_session_token, Roles
from app.core.errors import UnauthorizedException, ForbiddenException
from app.core.config import settings


def get_request_id(request: Request) -> str:
    req_id = request.headers.get("X-Request-ID")
    if not req_id:
        req_id = f"req_{uuid.uuid4().hex[:8]}"
    return req_id


async def get_current_user(request: Request) -> Dict[str, Any]:
    """
    Extract authenticated user from:
    1. Authorization Bearer header
    2. Session cookie
    3. Demo/convenience headers for testing ('X-Demo-Role', 'X-Demo-User-Id')
    """
    # 1. Bearer token
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
        payload = decode_session_token(token)
        if payload:
            return payload

    # 2. Session cookie
    cookie_token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if cookie_token:
        payload = decode_session_token(cookie_token)
        if payload:
            return payload

    # 3. Header-based demo/test convenience
    demo_role = request.headers.get("X-Demo-Role")
    demo_user_id = request.headers.get("X-Demo-User-Id")
    demo_email = request.headers.get("X-Demo-Email")
    demo_name = request.headers.get("X-Demo-Name")

    if demo_role:
        return {
            "user_id": demo_user_id or f"demo_{demo_role.lower()}_id",
            "role": demo_role.upper(),
            "email": demo_email or f"{demo_role.lower()}@awwaz.ai",
            "name": demo_name or f"Demo {demo_role.capitalize()}",
        }

    # Default citizen identity for unauthenticated public flow
    return {
        "user_id": "citizen_demo_user_1",
        "role": Roles.CITIZEN,
        "email": "tariq@awwaz.ai",
        "name": "Tariq Mahmood",
    }


def require_roles(allowed_roles: List[str]):
    def role_checker(current_user: Dict[str, Any] = Depends(get_current_user)):
        user_role = current_user.get("role")
        if user_role not in allowed_roles:
            raise ForbiddenException(f"Requires one of roles: {', '.join(allowed_roles)}")
        return current_user
    return role_checker


def format_response(data: Any, request_id: Optional[str] = None) -> Dict[str, Any]:
    """Uniform PRD API response contract."""
    return {
        "success": True,
        "data": data,
        "meta": {
            "request_id": request_id or f"req_{uuid.uuid4().hex[:8]}",
        },
    }
