import pytest
from app.repositories.models import ComplaintModel
from app.domain.complaints.entities import ComplaintCategory, ComplaintStatus
from app.domain.complaints.service import ComplaintService
from app.core.security import create_session_token, decode_session_token, Roles
from app.core.errors import ForbiddenException


@pytest.mark.asyncio
async def test_session_token_tampering():
    token = create_session_token("test_user_1", Roles.CITIZEN, "user@test.com", "Test User")
    decoded = decode_session_token(token)
    assert decoded is not None
    assert decoded["user_id"] == "test_user_1"

    # Tamper with token payload
    parts = token.split(".")
    tampered = f"badpayload.{parts[1]}"
    assert decode_session_token(tampered) is None


@pytest.mark.asyncio
async def test_idor_citizen_cannot_view_other_citizen_complaint(db_session):
    # Case belongs to citizen 1
    case = ComplaintModel(
        citizen_id="test_citizen_1",
        title="Citizen 1 Case",
        description="Private complaint",
        category=ComplaintCategory.SANITATION,
        location_text="Location 1",
    )
    db_session.add(case)
    await db_session.commit()
    await db_session.refresh(case)

    # Citizen 2 attempts to view Citizen 1's case -> Forbidden
    citizen_2_user = {"user_id": "test_citizen_2", "role": Roles.CITIZEN}
    with pytest.raises(ForbiddenException):
        await ComplaintService.get_visible_complaint(
            session=db_session,
            complaint_id=case.id,
            current_user=citizen_2_user,
        )

    # Operator CAN view Citizen 1's case
    operator_user = {"user_id": "test_operator_1", "role": Roles.OPERATOR}
    res = await ComplaintService.get_visible_complaint(
        session=db_session,
        complaint_id=case.id,
        current_user=operator_user,
    )
    assert res["complaint"].id == case.id


@pytest.mark.asyncio
async def test_citizen_cannot_approve_recommendation_api(client, citizen_token):
    # Send approve request with citizen token
    headers = {"Authorization": f"Bearer {citizen_token}"}
    response = await client.post(
        "/api/v1/recommendations/rec_123/approve",
        headers=headers,
        json={"comment": "Attempted citizen approval"},
    )
    assert response.status_code == 403
