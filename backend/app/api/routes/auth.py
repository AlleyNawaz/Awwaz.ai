from typing import Dict, Any, Optional
from pydantic import BaseModel, EmailStr
from fastapi import APIRouter, Depends, Response
from app.api.deps import get_current_user, format_response, get_request_id
from app.core.security import create_session_token, Roles
from app.core.config import settings
from app.core.errors import ValidationException

router = APIRouter(prefix="/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    role: str = "CITIZEN"  # CITIZEN, OPERATOR, ADMIN
    email: Optional[str] = None
    name: Optional[str] = None


@router.post("/login")
async def login(req: LoginRequest, response: Response, request_id: str = Depends(get_request_id)):
    role = req.role.upper()
    if role not in (Roles.CITIZEN, Roles.OPERATOR, Roles.ADMIN, Roles.SERVICE):
        raise ValidationException(f"Invalid role. Supported: {Roles.CITIZEN}, {Roles.OPERATOR}, {Roles.ADMIN}")

    # Seed demo user profiles
    if role == Roles.OPERATOR:
        user_id = "user_operator_fatima"
        email = req.email or "fatima.noor@awwaz.ai"
        name = req.name or "Fatima Noor (Operations Coordinator)"
    elif role == Roles.ADMIN:
        user_id = "user_admin_bilal"
        email = req.email or "bilal.khan@awwaz.ai"
        name = req.name or "Bilal Khan (Municipal Admin)"
    else:
        user_id = "user_citizen_tariq"
        email = req.email or "tariq.mahmood@awwaz.ai"
        name = req.name or "Tariq Mahmood"

    token = create_session_token(user_id=user_id, role=role, email=email, name=name)

    # Set HTTP-only session cookie
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=token,
        max_age=settings.SESSION_MAX_AGE_SECONDS,
        httponly=True,
        samesite="lax",
        secure=not settings.APP_DEBUG,
    )

    return format_response({
        "token": token,
        "user": {
            "user_id": user_id,
            "role": role,
            "email": email,
            "name": name,
        }
    }, request_id=request_id)


@router.get("/me")
async def get_me(current_user: Dict[str, Any] = Depends(get_current_user), request_id: str = Depends(get_request_id)):
    return format_response(current_user, request_id=request_id)


@router.post("/logout")
async def logout(response: Response, request_id: str = Depends(get_request_id)):
    response.delete_cookie(key=settings.SESSION_COOKIE_NAME)
    return format_response({"message": "Logged out successfully"}, request_id=request_id)
