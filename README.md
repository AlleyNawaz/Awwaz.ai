# Awwaz.ai — Autonomous Civic Intelligence Platform

An enterprise-grade, stateful AI municipal coordination engine that transforms unstructured citizen communications across Urdu, Roman Urdu, and English into deterministic, routed actions. Awwaz monitors operational case state, autonomously detects stalls exceeding SLA thresholds, enforces human authorization for consequential department escalations, and anchors every transition in a sequential SHA-256 cryptographic audit ledger.

---

## Video Demonstration

Watch the complete end-to-end product demonstration and architecture walkthrough:
https://youtu.be/4NAGoNHyNrM

---

## Core Problem and Value Proposition

Traditional civic complaint portals function as passive digital suggestion boxes. Citizens fill out complex forms, receive automated ticket numbers, and cases languish indefinitely in departmental queues without follow-up or accountability.

Awwaz re-engineers municipal coordination around an active, stateful loop:
Existing systems collect complaints. Awwaz guarantees municipal action.

Instead of acting as a passive wrapper around an LLM, Awwaz implements a deterministic state machine, continuous background SLA monitoring, grounded recommendation synthesis, strict human authorization boundaries, and verifiable audit trails.

---

## End-to-End Coordination Lifecycle

The system operates across a ten-stage autonomous loop:

1. Understand: Multilingual NLP parser resolves conversational citizen voice notes and text across Urdu, Roman Urdu, and English.
2. Structure: Extracts typed entities including problem category, landmark, normalized address, severity, and intent.
3. Route: Deterministically assigns cases to responsible municipal directorates (WASA, CDA, RDA, IESCO, Waste Management).
4. Track: Records state progressions to an append-only chronological timeline.
5. Detect: Background worker evaluates SLA clocks and automatically flags cases stalled for more than 72 hours without progress.
6. Recommend: Synthesizes grounded operational proposals citing verifiable database facts and timestamps without hallucination.
7. Approve: Enforces strict human-in-the-loop security boundaries; external escalations require explicit operator authorization.
8. Act: Executes civic service adapters, dispatches upstream municipal notifications, and records external reference IDs.
9. Verify: Hashes every state mutation into a sequential SHA-256 cryptographic block chain.
10. Remember: Correlates incoming reports against historical temporal and geographic clusters to detect recurring infrastructure failures.

---

## Architectural Pillars

### 1. Multilingual Citizen Intake
- Supports conversational Roman Urdu (for example, "Bhai 3 din se G-9 markaz me gutter overflow ho raha hai"), Urdu script, and English.
- Autonomous location normalization resolves informal landmarks to municipal administrative sectors.
- Zero-friction interface requiring no pre-registration or bureaucratic forms.
- Media upload pipeline supporting photo evidence with MIME validation and 10 MB size limits.

### 2. Deterministic State Machine and Concurrency Control
- Strict 10-state lifecycle: SUBMITTED, ACKNOWLEDGED, ASSIGNED, IN_PROGRESS, WAITING_FOR_CITIZEN, ESCALATION_PENDING, ESCALATED, RESOLVED, CLOSED, REJECTED.
- Enforces valid transition matrices; invalid state jumps are rejected with structured error codes.
- Optimistic Concurrency Control compares version tokens before mutations to prevent race conditions.

### 3. Background Stall Sentinel and SLA Commitments
- Autonomous background worker scans active cases at regular intervals.
- Detects cases exceeding the 72-hour operational inactivity threshold.
- Tracks time-bounded operational commitments (12h, 24h, 48h, 72h) and automatically flags missed promises.

### 4. Human-in-the-Loop Authorization Boundary
- Consequential external actions (department escalations, field dispatches) cannot be triggered autonomously by AI.
- Grounded recommendation cards display cited facts and timestamps for operator verification.
- In-app authorization modal allows authorized operators to review, input verification notes, or reject proposals.

### 5. Cryptographic Audit Ledger (PRD Section 16)
- Sequential SHA-256 block chain anchoring every event from genesis root (`AWWAZ_GENESIS_ROOT`).
- Each block links the hash of the preceding block, timestamp, actor ID, action type, and payload digest.
- Built-in verification API (`GET /api/v1/admin/audit-logs/verify`) recalculates and validates chain integrity in real time.

### 6. Recurrence and Cluster Detection
- Normalizes address tokens and computes geographic and temporal similarity.
- Flags recurring infrastructure failures within a 30-day temporal window to prevent repetitive siloed repairs.

---

## Technology Stack

### Backend
- Framework: Python 3.11+ / FastAPI
- ORM and Database: SQLAlchemy 2.0 with SQLite (development) and PostgreSQL support (production)
- Validation: Pydantic v2
- Cryptography: Python hashlib (SHA-256 sequential chaining)
- Testing: Pytest with AnyIO and asyncio fixtures (22 automated test suites)

### Frontend
- Framework: Next.js 16 (App Router, Turbopack)
- Library: React 19, TypeScript
- Design System: Custom Vanilla CSS adhering to Stripe and Linear design specifications
- Typography: Plus Jakarta Sans, JetBrains Mono
- Icons: Lucide React

---

## Pre-Seeded Deterministic Benchmark Dataset

The platform includes a deterministic benchmark suite designed for reproducible evaluations:

| Case ID | Category | Department | Scenario |
|---|---|---|---|
| A1024 | WATER_DRAINAGE | WASA | Stalled sewer overflow in Sector G-9 Markaz (>72h idle) |
| A1025 | STREETLIGHT | CDA Electrical | Recurring broken light fixture outside House 14 |
| A1026 | POTHOLE_ROAD | RDA Engineering | Deep crater on Main Boulevard near school zone |
| A1027 | SOLID_WASTE | Waste Management | Uncollected commercial market refuse |
| A1028 | OTHER | Unassigned Triage | Boundary edge case requiring operator review |

---

## Local Installation and Setup

### Prerequisites
- Node.js 18+ and npm
- Python 3.10+
- Git

### 1. Repository Clone
```bash
git clone https://github.com/AlleyNawaz/Awwaz.ai.git
cd Awwaz.ai
```

### 2. Backend Setup
```bash
# Create and activate virtual environment
python3 -m venv backend/venv
source backend/venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Seed deterministic benchmark baseline
python3 seed_demo.py

# Launch FastAPI backend server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --app-dir backend --reload
```
The backend API documentation will be accessible at `http://localhost:8000/docs`.

### 3. Frontend Setup
In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
The frontend application will be running at `http://localhost:3000`.

---

## Running the Automated Test Suites

### Unit and Integration Tests
```bash
source backend/venv/bin/activate
pytest backend/tests -v
```
Verifies state machine transitions, SLA stall detection, prompt injection defenses, IDOR protection, idempotent approvals, recurrence scoring, and acceptance criteria A1 through A15.

### End-to-End Acceptance Verification
```bash
python3 verify_e2e_flow.py
```
Executes a 23-step simulated lifecycle from Roman Urdu intake to deterministic routing, stall detection, operator approval, mock civic adapter execution, and recurrence correlation.

### Frontend Production Build
```bash
cd frontend
npm run build
```
Validates TypeScript compilation, static optimization, and route bundling with zero errors.

---

## Primary API Routes

| Method | Endpoint | Description | Access Role |
|---|---|---|---|
| GET | `/api/v1/health` | Service health and gateway status | Public |
| POST | `/api/v1/conversations/messages` | Multilingual citizen chat intake | Citizen |
| GET | `/api/v1/complaints` | Filterable complaint dockets | Citizen / Operator |
| GET | `/api/v1/complaints/{id}` | Complete complaint dossier and timeline | Authenticated |
| PATCH | `/api/v1/complaints/{id}/status` | Advance lifecycle state machine | Operator |
| POST | `/api/v1/complaints/{id}/evidence` | Attach photo or field report | Authenticated |
| GET | `/api/v1/recommendations` | Active AI proposals queue | Operator |
| POST | `/api/v1/recommendations/{id}/approve` | Human-authorized consequential execution | Operator |
| POST | `/api/v1/recommendations/{id}/reject` | Reject recommendation with reason | Operator |
| GET | `/api/v1/admin/audit-logs/verify` | Verify sequential SHA-256 hash ledger | Admin |
| POST | `/api/v1/admin/reset-demo` | Restore deterministic benchmark dataset | Admin |

---

## Hackathon Sponsors and Technology Integrations

Awwaz was built for the AI Tinkerers Agents Everywhere Hackathon, leveraging leading ecosystem tools and sponsor platforms across its agentic workflow:

- AI Tinkerers (@AITinkerers): Global community host for the Agents Everywhere Hackathon, inspiring the design of deterministic autonomous civic coordination.
- OpenAI (@OpenAI): Multilingual entity extraction and structured JSON intent classification across Urdu, Roman Urdu, and English via GPT-4o.
- CopilotKit (@CopilotKit): In-app agent copilot interaction framework powering the municipal operator review interface and human-in-the-loop validation flows.
- OpenRouter (@openrouter): Unified multi-LLM model routing gateway providing intelligent fallback and model failover between proprietary and open-weight architectures.
- Exa AI (@exaailabs): Neural knowledge retrieval and semantic search over municipal regulatory gazettes, departmental jurisdictions, and utility emergency contacts.
- Auth0 (@auth0): Enterprise Single Sign-On (SSO), JWT token validation, and role-based access control (RBAC) separating citizen submissions from municipal operator approvals.
- Ambiguous AI (@ambiguousio): Conversational ambiguity detection and confidence scoring, automatically triggering clarification prompts when reports lack critical landmarks or context.
- Trigger.dev (@triggerdotdev): Durable cloud-native background execution engine for 72-hour SLA stall monitoring, recurring commitment reminders, and civic notification dispatches.
- Mozilla AI (@mozillaAI): Open-source trustworthy AI evaluation framework enforcing grounded fact citations and deterministic escalation boundaries.
- Google Cloud (@googlecloud): Cloud runtime infrastructure, Gemini multimodal vision inference for damage photo verification, and scalable deployment pipelines.

---

## Social Share and Submission Details

### Twitter / X Submission Copy

Built Awwaz for the @AITinkerers #AgentsEverywhere Hackathon!

An enterprise-grade autonomous civic intelligence engine transforming multilingual citizen voice/text across Urdu, Roman Urdu, and English into verified municipal actions with SLA stall monitoring and SHA-256 audit ledgers.

Demo: https://youtu.be/4NAGoNHyNrM
Code: https://github.com/AlleyNawaz/Awwaz.ai

Powered by:
@OpenAI @CopilotKit @openrouter @exaailabs @auth0 @ambiguousio @triggerdotdev @mozillaAI @googlecloud

### LinkedIn Submission Copy

Excited to introduce Awwaz, built together with Asim Ghaffar (VP at 10Pearls) for the AI Tinkerers #AgentsEverywhere Hackathon!

Traditional civic portals act as passive complaint inboxes where tickets get lost. Awwaz re-engineers municipal coordination into an active, autonomous loop: multilingual intake (Urdu, Roman Urdu, English), automated 72-hour SLA stall detection, human-in-the-loop consequential escalation boundaries, and sequential SHA-256 cryptographic audit ledgers.

Watch the full walkthrough: https://youtu.be/4NAGoNHyNrM
GitHub repository: https://github.com/AlleyNawaz/Awwaz.ai

Built leveraging tools from AI Tinkerers, OpenAI, CopilotKit, OpenRouter, Exa, Auth0, Ambiguous AI, Trigger.dev, Mozilla.ai, and Google Cloud.

---

## License

MIT License. Developed for the autonomous civic intelligence ecosystem.
