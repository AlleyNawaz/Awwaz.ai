# Awwaz — Live Demo Script & Judge Evaluation Guide

This guide walks through the exact 23-step critical acceptance scenario demonstrated in Awwaz, fulfilling all criteria specified in Section 101 of the Product Requirements Document.

---

## 🎯 Demo Summary in 30 Seconds

> **Existing systems collect complaints. Awwaz works on what happens next.**
>
> 1. Citizen submits a messy report in Roman Urdu with missing location.
> 2. Awwaz understands the civic problem, clarifies the location, and creates a formal tracked case.
> 3. An older seeded case becomes stalled past municipal SLA.
> 4. An autonomous background worker detects the stall and drafts a factual recommendation to escalate.
> 5. A human operator reviews the evidence and approves the escalation.
> 6. The civic adapter confirms the external action and updates the case with an immutable audit trail.
> 7. A subsequent complaint in the same neighborhood triggers automated recurrence detection.

---

## 🏁 Step-by-Step Live Demo Walkthrough

### Preparation & Reset
1. Open your browser to `http://localhost:3000`.
2. Ensure you can see the top navigation bar with the **Active Persona Switcher** (`Citizen`, `Operator`, `Admin`).
3. Click on the **Admin** tab or navigate to `http://localhost:3000/admin`.
4. Click **Reset Demo Data**.  
   *Result:* The database is reset to a clean deterministic state with pre-seeded cases `A1024` through `A1028`.

---

### Phase 1: Citizen Natural Language Intake & Clarification (Steps 1–8)

1. Switch persona to **Citizen (Tariq Mahmood)** and click **New Report** (or go to `http://localhost:3000/citizen`).
2. Type the following Roman Urdu complaint:
   ```text
   Bhai yahan 3 din se gutter overflow ho raha hai.
   ```
3. Press **Send**.
4. **Observe the AI Response**:
   - Awwaz classifies the issue as **Water & Drainage (`WATER_DRAINAGE`)** with **High Priority**.
   - Because no location was provided, Awwaz **does not** create a premature empty case. Instead, it politely clarifies:
     > *"Gutter overflow ka masla darj kar liya gaya hai. Barah-e-karam apna ilaqa, street ya landmark batayein."*
5. Now reply with the location:
   ```text
   Near ABC Chowk, Sector G-9, Islamabad
   ```
6. Press **Send**.
7. **Observe Case Creation & Routing**:
   - The complaint is created and assigned to **WASA (Water and Sanitation Agency)**.
   - Responsible Role: `WASA Drainage Operations Coordinator`.
   - The UI displays the canonical case badge and clickable link to view the case.
8. Click **View Complaint**:
   - Note the **Append-Only Timeline**: Displays `COMPLAINT_CREATED`, `COMPLAINT_ROUTED`, and `COMPLAINT_ASSIGNED` events with timestamps.

---

### Phase 2: Autonomous Stall Detection & SLA Evaluation (Steps 9–13)

1. Switch persona to **Operator (Fatima Noor)** and click **Dashboard** (`http://localhost:3000/dashboard`).
2. **Review the Operational Queue**:
   - Notice the summary counters: *Open Cases*, *High Priority*, *Stalled Cases*, *Pending Approval*.
   - In the queue table, find case **#A1024** (`Broken streetlight outside residence`).
   - Notice its status is `IN_PROGRESS`, but it has been idle for **>72 hours** and shows the amber **Stalled** indicator.
3. Click the **Run SLA Workers** button in the dashboard top bar:
   - Evaluates background rules:
     - Detects idle duration > 72h on #A1024.
     - Evaluates missed technician visit commitment on #A1024.
     - Synthesizes an **ESCALATE** recommendation.

---

### Phase 3: Human-in-the-Loop Approval & External Action (Steps 14–20)

1. Click on **Pending Approvals** in the top navigation (`http://localhost:3000/dashboard/approvals`).
2. Inspect the Recommendation Card for **#A1024**:
   - **Type**: `ESCALATE`
   - **Reason**: *"Case has had zero progress for 72+ hours and technician visit commitment was missed."*
   - **Cited Factual Evidence**:
     - *Case assigned 73 hours ago with no progress updates recorded.*
     - *Technician visit commitment was due 24 hours ago and was not fulfilled.*
     - *Exceeds municipal 72-hour SLA threshold for Electrical Infrastructure.*
     - *Target escalation: Superintending Engineer (Street Infrastructure).*
3. Type an optional operator note:
   ```text
   SLA breach verified. Authorizing immediate supervisory escalation.
   ```
4. Click **Approve Escalation**:
   - The button enters a loading state to prevent double-click submissions.
   - The backend validates operator authorization and executes the `MockCivicServiceAdapter`.
   - The adapter returns a real external reference: `CIVIC-ESC-XXXXX`.
5. Open case **#A1024**:
   - Current status is updated to `ESCALATION_PENDING` / `ESCALATED`.
   - Responsibility updated to: `Superintending Engineer (Street Infrastructure)`.
   - The timeline reflects `EXTERNAL_ACTION_SUCCEEDED` with the external reference ID and approval log.

---

### Phase 4: Neighborhood Memory & Recurrence Detection (Steps 21–23)

1. Switch persona back to **Citizen** (`http://localhost:3000/citizen`).
2. Enter a new complaint regarding recurring streetlight issues:
   ```text
   Streetlight phir band hai. Street 14, Sector F-7/2, Islamabad
   ```
3. Press **Send**.
4. The system creates the new complaint and instantly runs the **Recurrence Engine**.
5. Click **View Complaint**:
   - In the case details sidebar, notice the **Potential Recurrence** panel:
     - Displays historical case **#A1024** (`Broken streetlight outside residence`).
     - Shows token match score: `1.0` (Shared civic area: `14, f-7, islamabad`).
     - Demonstrates that Awwaz recognizes neighborhood patterns rather than treating recurring civic issues in isolation!

---

## ⚡ Automated 1-Command Live Demonstration

To execute the entire 23-step scenario in 2 seconds via automated HTTP assertions:

```bash
python verify_e2e_flow.py
```

Expected output:
```text
🚀 Starting 23-Step End-to-End Acceptance Test on Live Server...

🌱 Baseline: Deterministic Demo Data Reset & Seeded.
✅ Step 1: Health & System Gateway Verified.
✅ Steps 2-4: Roman Urdu understood as WATER_DRAINAGE; location clarification requested.
✅ Steps 5-7: Case created and routed to WASA.
✅ Step 8: Append-only timeline verified with 3 events.
✅ Step 9: Case verified visible in Operator queue.
✅ Steps 10-11: Background worker evaluated SLAs.
✅ Steps 12-13: Grounded escalation recommendation inspected with cited facts.
✅ Steps 14-19: Operator approval executed mock civic adapter -> Ref: CIVIC-ESC-3D49F.
✅ Step 20: Verified case state updated to ESCALATION_PENDING.
✅ Steps 21-23: Recurrence detected! New case linked to historical case #A1024.

🎉 ALL 23 STEPS OF THE CRITICAL ACCEPTANCE SCENARIO PASSED!
```
