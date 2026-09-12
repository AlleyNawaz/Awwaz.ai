import pytest
from app.repositories.models import ComplaintModel, RecommendationModel
from app.domain.complaints.entities import ComplaintCategory, ComplaintStatus, RecommendationType


@pytest.mark.asyncio
async def test_health_and_ready(client):
    res = await client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"

    res_ready = await client.get("/ready")
    assert res_ready.status_code == 200
    assert res_ready.json()["status"] == "ready"


@pytest.mark.asyncio
async def test_full_api_intake_to_approval_workflow(client, citizen_token, operator_token, db_session):
    cit_headers = {"Authorization": f"Bearer {citizen_token}"}
    op_headers = {"Authorization": f"Bearer {operator_token}"}

    # 1. Citizen Conversation Intake
    chat_res = await client.post(
        "/api/v1/conversations/messages",
        headers=cit_headers,
        json={"message": "Bhai yahan 3 din se gutter overflow ho raha hai."},
    )
    assert chat_res.status_code == 200
    chat_data = chat_res.json()
    assert chat_data["success"] is True
    assert chat_data["data"]["clarification_required"] is True
    conv_id = chat_data["data"]["conversation_id"]

    # 2. Citizen answers location
    loc_res = await client.post(
        "/api/v1/conversations/messages",
        headers=cit_headers,
        json={"conversation_id": conv_id, "message": "Near ABC Chowk, Sector G-9"},
    )
    assert loc_res.status_code == 200
    loc_data = loc_res.json()
    assert loc_data["data"]["clarification_required"] is False
    complaint_id = loc_data["data"]["complaint_id"]
    assert complaint_id is not None

    # 3. Fetch complaint detail
    detail_res = await client.get(f"/api/v1/complaints/{complaint_id}", headers=cit_headers)
    assert detail_res.status_code == 200
    detail = detail_res.json()["data"]
    assert detail["category"] == ComplaintCategory.WATER_DRAINAGE
    assert detail["status"] == ComplaintStatus.ASSIGNED

    # 4. Operator Dashboard Summary
    dash_res = await client.get("/api/v1/dashboard/summary", headers=op_headers)
    assert dash_res.status_code == 200
    assert dash_res.json()["data"]["open_cases"] >= 1

    # 5. Create recommendation and approve it via API
    rec = RecommendationModel(
        complaint_id=complaint_id,
        type=RecommendationType.ESCALATE,
        reason="Test API approval",
        evidence=["Evidence"],
    )
    db_session.add(rec)
    await db_session.commit()
    await db_session.refresh(rec)

    app_res = await client.post(
        f"/api/v1/recommendations/{rec.id}/approve",
        headers=op_headers,
        json={"comment": "Operator verified and approved"},
    )
    assert app_res.status_code == 200
    app_data = app_res.json()
    assert app_data["data"]["success"] is True
    assert app_data["data"]["external_reference"] is not None

    # 6. Verify audit logs record the action
    audit_res = await client.get("/api/v1/admin/audit-logs", headers=op_headers)
    assert audit_res.status_code == 200
    logs = audit_res.json()["data"]
    assert any(l["action"] == "APPROVE_ESCALATION" for l in logs)


@pytest.mark.asyncio
async def test_commitment_and_evidence_api_flow(client, citizen_token, operator_token, db_session):
    cit_headers = {"Authorization": f"Bearer {citizen_token}"}
    op_headers = {"Authorization": f"Bearer {operator_token}"}

    # 1. Create Complaint
    c_res = await client.post(
        "/api/v1/complaints",
        headers=cit_headers,
        json={
            "title": "Evidence and Commitment API Test",
            "description": "Testing full API flow",
            "category": "ROADS",
            "priority": "HIGH",
            "location_text": "Main Road, Sector G-10",
        },
    )
    assert c_res.status_code == 200
    complaint_id = c_res.json()["data"]["id"]

    # 2. Operator adds a commitment
    from datetime import datetime, timezone, timedelta
    due = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    comm_res = await client.post(
        f"/api/v1/complaints/{complaint_id}/commitments",
        headers=op_headers,
        json={
            "description": "Inspection by road engineer",
            "due_at": due,
            "commitment_type": "VISIT",
        },
    )
    assert comm_res.status_code == 200
    comm_data = comm_res.json()["data"]
    commitment_id = comm_data["id"]
    assert comm_data["status"] == "PENDING"

    # 3. Operator marks commitment fulfilled
    ful_res = await client.post(
        f"/api/v1/complaints/{complaint_id}/commitments/{commitment_id}/fulfill",
        headers=op_headers,
    )
    assert ful_res.status_code == 200
    assert ful_res.json()["data"]["status"] == "FULFILLED"

    # 4. Upload photo evidence
    fake_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"
    files = {"file": ("pothole_evidence.png", fake_png, "image/png")}
    ev_res = await client.post(
        f"/api/v1/complaints/{complaint_id}/evidence",
        headers=cit_headers,
        files=files,
    )
    assert ev_res.status_code == 200
    ev_data = ev_res.json()["data"]
    assert ev_data["filename"] == "pothole_evidence.png"
    assert ev_data["storage_key"] is not None
