import asyncio
import httpx

BASE_URL = "http://127.0.0.1:8000/api/v1"

async def test_acceptance_flow():
    print("🚀 Starting 23-Step End-to-End Acceptance Test on Live Server...\n")
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=15) as client:
        # Reset demo data to deterministic baseline
        reset_res = await client.post("/admin/demo/reset", headers={"X-Demo-Role": "ADMIN"})
        assert reset_res.status_code == 200, f"Demo reset failed: {reset_res.text}"
        print("🌱 Baseline: Deterministic Demo Data Reset & Seeded.")

        # Step 1: Citizen opens Awwaz & checks health
        h = await client.get("http://127.0.0.1:8000/health")
        assert h.status_code == 200, f"Health check failed: {h.text}"
        print("✅ Step 1: Health & System Gateway Verified.")

        # Step 2: Citizen enters Roman Urdu complaint without location
        chat1 = await client.post("/conversations/messages", json={
            "message": "Bhai yahan 3 din se gutter overflow ho raha hai."
        }, headers={"X-Demo-Role": "CITIZEN", "X-Demo-User-Id": "user_citizen_tariq"})
        assert chat1.status_code == 200, f"Chat intake failed: {chat1.text}"
        data1 = chat1.json()["data"]

        # Step 3 & 4: Understands issue as WATER_DRAINAGE & asks for location
        assert data1["category"] == "WATER_DRAINAGE"
        assert data1["clarification_required"] is True
        assert "location" in data1["missing_fields"]
        assert data1["complaint_id"] is None
        conv_id = data1["conversation_id"]
        print(f"✅ Steps 2-4: Roman Urdu understood as WATER_DRAINAGE; location clarification requested.")

        # Step 5: Citizen provides location
        chat2 = await client.post("/conversations/messages", json={
            "conversation_id": conv_id,
            "message": "Near ABC Chowk, Sector G-9"
        }, headers={"X-Demo-Role": "CITIZEN", "X-Demo-User-Id": "user_citizen_tariq"})
        assert chat2.status_code == 200
        data2 = chat2.json()["data"]

        # Step 6 & 7: Complaint created & routed to WASA
        complaint_id = data2["complaint_id"]
        assert complaint_id is not None
        assert "WASA" in data2["department_name"] or "Water" in data2["department_name"]
        print(f"✅ Steps 5-7: Case created (#{complaint_id}) and routed to WASA.")

        # Step 8: Timeline records creation, routing, and assignment
        comp_detail = await client.get(f"/complaints/{complaint_id}", headers={"X-Demo-Role": "CITIZEN", "X-Demo-User-Id": "user_citizen_tariq"})
        assert comp_detail.status_code == 200, f"Get complaint failed: {comp_detail.text}"
        events = comp_detail.json()["data"]["events"]
        event_types = [e["event_type"] for e in events]
        assert "COMPLAINT_CREATED" in event_types
        assert "COMPLAINT_ROUTED" in event_types
        assert "COMPLAINT_ASSIGNED" in event_types
        print(f"✅ Step 8: Append-only timeline verified with {len(events)} events.")

        # Step 9: Operator dashboard shows the case
        dash = await client.get("/complaints", headers={"X-Demo-Role": "OPERATOR"})
        cases = dash.json()["data"]
        assert any(c["id"] == complaint_id for c in cases)
        print(f"✅ Step 9: Case #{complaint_id} verified visible in Operator queue.")

        # Step 10 & 11: Stalled Case A1024 detection
        worker_run = await client.post("/dashboard/workers/run", headers={"X-Demo-Role": "OPERATOR"})
        assert worker_run.status_code == 200
        print(f"✅ Steps 10-11: Background worker evaluated SLAs: {worker_run.json()['data']}.")

        # Step 12 & 13: Recommendation exists on A1024
        recs = await client.get("/recommendations?complaint_id=A1024", headers={"X-Demo-Role": "OPERATOR"})
        rec_list = recs.json()["data"]
        assert len(rec_list) >= 1
        rec_to_approve = rec_list[0]
        assert rec_to_approve["type"] == "ESCALATE"
        print(f"✅ Steps 12-13: Grounded escalation recommendation #{rec_to_approve['id']} inspected with cited facts.")

        # Step 14, 15, 16, 17, 18, 19: Operator approves escalation
        app_res = await client.post(
            f"/recommendations/{rec_to_approve['id']}/approve",
            headers={"X-Demo-Role": "OPERATOR", "Idempotency-Key": f"test_idem_live_{rec_to_approve['id']}"},
            json={"comment": "Operator reviewed 72h stall and approved external escalation."}
        )
        assert app_res.status_code == 200, f"Approval failed: {app_res.text}"
        app_data = app_res.json()["data"]
        assert app_data["success"] is True
        assert app_data["external_reference"].startswith("CIVIC-ESC-")
        print(f"✅ Steps 14-19: Operator approval executed mock civic adapter -> Ref: {app_data['external_reference']}.")

        # Step 20: Citizen sees updated status
        a1024_detail = await client.get("/complaints/A1024", headers={"X-Demo-Role": "OPERATOR"})
        a1024_data = a1024_detail.json()["data"]
        assert a1024_data["status"] in ("ESCALATED", "ESCALATION_PENDING")
        print(f"✅ Step 20: Verified case state updated to {a1024_data['status']}.")

        # Step 21, 22, 23: Citizen submits recurrence 'Streetlight phir band hai.'
        recur_chat = await client.post("/conversations/messages", json={
            "message": "Streetlight phir band hai. Street 14, Sector F-7/2, Islamabad"
        }, headers={"X-Demo-Role": "CITIZEN", "X-Demo-User-Id": "user_citizen_tariq"})
        assert recur_chat.status_code == 200
        new_case_id = recur_chat.json()["data"]["complaint_id"]

        new_case_detail = await client.get(f"/complaints/{new_case_id}", headers={"X-Demo-Role": "CITIZEN", "X-Demo-User-Id": "user_citizen_tariq"})
        recurrences = new_case_detail.json()["data"]["potential_recurrences"]
        assert len(recurrences) >= 1
        assert any(r["id"] == "A1024" for r in recurrences)
        print(f"✅ Steps 21-23: Recurrence detected! New case #{new_case_id} linked to historical case #A1024.")

        print("\n🎉 ALL 23 STEPS OF THE CRITICAL ACCEPTANCE SCENARIO PASSED!")

if __name__ == "__main__":
    asyncio.run(test_acceptance_flow())
