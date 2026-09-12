# Slice 4 — Stall → Recommend → Approve → Act

Status: Not started
Size: L
Depends on: Slice 2 (Slice 3 optional; the demo order assumes 3 is done)
PRD coverage: F10 (stall detection), F11 (recommendation), F12 (human approval), F13 (civic adapter), F14 (mock department system). Flows E, F, I. §12 recommendations/approvals/dashboard-stalled endpoints. §13 `recommendations`, `approvals`. §14 recommendation enums. §18 adapter contract. §20 double-click, stale approval, worker restart, adapter timeout. Appendix B (escalation chain), Appendix D approval-required tools. US-05, US-07, US-12. Acceptance A6, A8, A9, A10.

## Goal

A background worker detects cases with no progress past a threshold, flags them, and creates exactly one evidence-backed recommendation per incident. An operator reviews the recommendation, approves it, and the server executes the action through a replaceable civic adapter with an idempotency key. The case only becomes `ESCALATED` when the adapter confirms. Everything lands in the timeline and audit log.

## What this proves

The "wow factor" second half (§1): background event detection, the human approval boundary, exactly-once external action, replaceable adapter, and truthful failure. This is the slice that separates Awwaz from a chatbot (R8).

## In scope

### Worker (`backend/app/workers/`)

- `scheduler.py`: `python -m app.workers.scheduler` loop; interval `WORKER_INTERVAL_SECONDS` (default 30). Each tick runs `stall_detector.run()` then `commitment_checker.run()` (the latter is a no-op until slice 5). Each tick is one DB transaction per case; failures on one case are logged and do not stop the tick. Uses the seeded SERVICE actor for audit.
- `stall_detector.py`:
  - Eligible statuses: `SUBMITTED, ACKNOWLEDGED, ASSIGNED, IN_PROGRESS, ESCALATED`. Not eligible: `REPORTED` (not yet routed), `WAITING_FOR_CITIZEN` (waiting on the citizen), `ESCALATION_PENDING` (already under human decision), `RESOLVED`, `CLOSED`.
  - Threshold: `routing_rules.stall_threshold_hours` for the case's category, else `STALL_THRESHOLD_HOURS` (default 72).
  - `hours_since = now - last_progress_at` (denormalised in slice 2; falls back to the latest `PROGRESS_EVENT_TYPES` event, then `created_at`).
  - If `hours_since >= threshold` and `stalled=false`: set `stalled=true`, append `STALL_DETECTED` (non-progress) with evidence, then ask `EscalationService.create_recommendation`.
  - If progress has resumed (`last_progress_at` newer than the `STALL_DETECTED` event) and `stalled=true`: set `stalled=false` and mark any still-`PENDING` stall recommendation for that incident `SUPERSEDED` (a terminal status added for this purpose) with an event.
  - Incident key: `STALL:{complaint_id}:{last_progress_event_id}`. Same key on re-run → no new recommendation (A6, §20 "worker restart"). New progress then a new stall → new key → new recommendation.
  - Recommendation type rule (deterministic): `ESCALATE` if the case has a `MISSED` commitment (slice 5 populates this; empty until then) **or** `hours_since >= 2 × threshold` **or** status is `ESCALATED` and still stalled (escalate to the next chain level); otherwise `FOLLOW_UP`. A1024 (72 h, missed commitment in slice 5) → `ESCALATE` in the final demo; before slice 5 it yields `FOLLOW_UP` unless the threshold is set to 36 h, which the demo runbook documents.
  - Evidence JSON (what the operator sees, Flow D/E step 6): `last_progress_at`, `hours_since_progress`, `threshold_hours`, `status`, `department`, `responsibility_name`, `responsibility_level`, `missed_commitments[]`, `previous_escalations`.

### Escalation domain (`backend/app/domain/escalation/`)

- `service.py`:
  - `is_eligible(complaint, now, threshold)` pure function.
  - `create_recommendation(db, complaint, type, reason, evidence, incident_key, requires_approval)`: insert-or-return-existing on the partial unique index; appends `RECOMMENDATION_CREATED`; `LINK_RECURRING` and `REQUEST_INFORMATION` (future) can be `requires_approval=false`; `FOLLOW_UP` and `ESCALATE` always require approval.
  - `approve(db, actor, recommendation_id, comment, idempotency_key, expected_case_version)`: see approval flow below.
  - `reject(db, actor, recommendation_id, comment)`: `PENDING → REJECTED`, approval row with decision `REJECTED`, `RECOMMENDATION_REJECTED` event, audit.
  - `retry(db, actor, recommendation_id, idempotency_key)`: `FAILED → EXECUTING` and re-run `execute` with the new key.
  - `execute(db, recommendation)`: dispatch by type — `ESCALATE` → `adapter.escalate_case`, `FOLLOW_UP` → `adapter.request_follow_up`. Records an `external_actions` row per attempt.
- `policies.py`: who may approve (OPERATOR, ADMIN; never CITIZEN, never AGENT, never the model), next chain level computation from `departments.escalation_chain`.

### Approval flow (Flow F, server-side, single transaction around state, adapter call outside the lock)

1. `require_roles(OPERATOR, ADMIN)`.
2. `Idempotency-Key` header required (400 `VALIDATION_ERROR` if absent). Look up `(key, actor_id, route)`: completed → replay stored response with `meta.idempotent_replay=true`; in flight → 409 `CONFLICT`.
3. Lock the recommendation row (`FOR UPDATE`). Must be `PENDING`, else 409 `ACTION_ALREADY_EXECUTED` (§20 "stale approval").
4. If `expected_case_version` supplied and differs → 409 `CONFLICT`.
5. Insert `approvals` row (decision `APPROVED`, comment). Recommendation `APPROVED → EXECUTING`. Append `RECOMMENDATION_APPROVED`. For `ESCALATE`: transition case to `ESCALATION_PENDING` via slice 2's `transition_status` as `ActorType.SYSTEM` (D9). Commit.
6. Call the adapter with `timeout=CIVIC_ADAPTER_TIMEOUT_SECONDS` (default 5), `request_id`, and the idempotency key as `external_idempotency_key`. Append `EXTERNAL_ACTION_REQUESTED`.
7. Success → `external_actions` row (`SUCCEEDED`, external reference), recommendation `EXECUTED`, `EXTERNAL_ACTION_CONFIRMED` event (progress), for `ESCALATE`: case `ESCALATION_PENDING → ESCALATED`, `responsibility_level += 1`, `responsibility_name` = next chain role, `stalled=false`; for `FOLLOW_UP`: `FOLLOW_UP_SENT` event (progress), `stalled=false`. Audit `RECOMMENDATION_EXECUTED` with result.
8. Failure/timeout → `external_actions` row (`FAILED`, error class), recommendation `FAILED`, `EXTERNAL_ACTION_FAILED` event, case status unchanged from step 5 (`ESCALATION_PENDING` for escalations, per D9; never `ESCALATED` — A9). Audit with `result=FAILURE`. Response is 200 with `data.recommendation.status="FAILED"` and the §19 message "The action was not confirmed, so the case status was not changed", because the approval itself succeeded and was recorded.
9. Store the final response body against the idempotency key.

### Civic adapter (`backend/app/integrations/civic/`)

- `interface.py`: `CivicServiceAdapter` protocol with `submit_case`, `request_follow_up`, `escalate_case` (§18 contract), typed inputs/results (`external_reference`, `accepted_at`, `message`), `CivicAdapterError`, `CivicAdapterTimeout`.
- `mock.py`: `MockCivicServiceAdapter` — deterministic. Reference format `MOCK-ESC-{sha1(external_idempotency_key)[:8]}` so replays return the same reference. Simulated latency `CIVIC_MOCK_LATENCY_MS` (default 400). Failure control: `CIVIC_MOCK_MODE=success|timeout|error` globally, and a per-case override when `location_text` contains the token `[[fail]]` (test and demo hook, documented in the runbook). Keeps an in-memory log of received requests so tests can assert exactly-once (A8).
- `factory.py`: `CIVIC_ADAPTER=mock` (only value for MVP); `CIVIC_SERVICE_BASE_URL` reserved for the future HTTP adapter (§27).

### Persistence (revision `0004_recommendations`)

```text
recommendations   id UUID PK, complaint_id FK, type, status (PENDING|APPROVED|REJECTED|EXECUTING|EXECUTED|FAILED|SUPERSEDED),
                  reason TEXT, evidence JSONB, requires_approval BOOL, incident_key VARCHAR, created_by_actor_type,
                  created_at, updated_at
                  UNIQUE (incident_key) WHERE status IN ('PENDING','APPROVED','EXECUTING','FAILED')   -- "unique within active state"
                  index (status), (complaint_id)
approvals         id UUID PK, recommendation_id FK, approver_id FK users, decision (APPROVED|REJECTED), reason TEXT,
                  case_version_at_decision INT, created_at
external_actions  id UUID PK, recommendation_id FK, complaint_id FK, action_type, adapter, external_idempotency_key,
                  status (SUCCEEDED|FAILED), external_reference NULL, error_code NULL, request_id, latency_ms, created_at
idempotency_keys  key VARCHAR, actor_id UUID, route VARCHAR, status (IN_FLIGHT|COMPLETED), response_status INT NULL,
                  response_body JSONB NULL, created_at, completed_at NULL
                  PRIMARY KEY (key, actor_id, route)
```

### API

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/v1/recommendations` | OPERATOR, ADMIN | filters `status, type, complaint_id` (§12) |
| GET | `/api/v1/recommendations/{id}` | OPERATOR, ADMIN | with evidence, approvals, external actions, current case version |
| POST | `/api/v1/recommendations/{id}/approve` | OPERATOR, ADMIN | `Idempotency-Key` header; body `{comment, expected_case_version?}` |
| POST | `/api/v1/recommendations/{id}/reject` | OPERATOR, ADMIN | `{comment}` |
| POST | `/api/v1/recommendations/{id}/retry` | OPERATOR, ADMIN | `Idempotency-Key` header; only from `FAILED` |
| GET | `/api/v1/dashboard/stalled` | OPERATOR, ADMIN | stalled cases with hours since progress and open recommendation |
| POST | `/api/v1/admin/demo/run-worker` | ADMIN | demo mode only; runs one tick synchronously and returns what it did |

`GET /complaints/{id}` now fills the `recommendations` array. `dashboard/summary` now counts `stalled` and `pending_approval`; the queue's first two tiers become live.

### Frontend

- `/dashboard/approvals`: list of `RecommendationCard`s (type, case reference and title, reason, key evidence figures, age). Empty state: "No recommendations waiting for a decision."
- `ApprovalDialog` (§10 "Approval modal"): title "Approve escalation?" / "Approve follow-up?", an explicit action statement ("Awwaz will send an escalation to Department Coordinator, Electrical & Street Lighting via the civic service adapter"), evidence block (case age, last progress, commitment status), Approve / Reject / Cancel. Generates one idempotency key when the dialog opens; the approve button disables on first click (§20 "double approval click"); on 409 shows the refresh prompt; on `FAILED` shows the truthful message and a Retry control.
- Case detail: Recommendations section with the same card and controls; a stalled badge in the header; the timeline renders approval, external action requested/confirmed/failed, and status events with distinct icons plus text.
- Dashboard: Stalled and Pending Approval counters live; queue tiers 1–2 populated; `/dashboard/activity` shows the recent audit log for OPERATOR/ADMIN (read-only, this is the first real content for that route).

## Out of scope (deferred)

Commitments and missed-commitment evidence (5). Notifications on execution (6). Rate limits (6). Real external adapter (future).

## Key rules and invariants

- The worker never changes complaint `status`; it only sets `stalled`, appends events, and creates recommendations.
- Only the escalation service performs `ESCALATION_PENDING → ESCALATED`, and only after an adapter success result.
- The adapter is invoked at most once per idempotency key (A8). Replays return the stored response and do not touch the adapter.
- A `FAILED` recommendation is retryable; a retry is a new adapter attempt with a new key, and every attempt is a row in `external_actions`.
- The LLM has no path to any endpoint or tool in this slice. Approval is an HTTP endpoint behind operator roles only.

## Tests

Unit:
- `is_eligible`: 71 h → false, 72 h → true, `WAITING_FOR_CITIZEN` → false, `RESOLVED` → false; per-category threshold overrides global.
- Recommendation type rule: 72 h no commitment → `FOLLOW_UP`; 150 h → `ESCALATE`; already `ESCALATED` and stalled → `ESCALATE` to the next level.
- Incident key stability across runs; new progress produces a new key.
- Mock adapter: same key → same reference; `[[fail]]` → error; `timeout` mode raises `CivicAdapterTimeout`.

Integration (real Postgres, mock adapter):
- A6: seed A1024 at 73 h; run the detector twice → `stalled=true`, exactly one `PENDING` recommendation, one `STALL_DETECTED` event.
- Progress resumes (operator note) → next tick clears `stalled`, marks the recommendation `SUPERSEDED`.
- A8 / US-12: approve twice with the same `Idempotency-Key` → adapter log shows one call; second response has `idempotent_replay=true`.
- Concurrent approvals with different keys → one succeeds, the other 409 `ACTION_ALREADY_EXECUTED`.
- A9 / Flow I: `CIVIC_MOCK_MODE=timeout` → recommendation `FAILED`, `external_actions` row `FAILED`, case `ESCALATION_PENDING` not `ESCALATED`, `EXTERNAL_ACTION_FAILED` event present; retry in success mode → `EXECUTED`, `ESCALATED`, responsibility level incremented.
- US-07: Hamza calling approve → 403; missing `Idempotency-Key` → 400.
- Stale `expected_case_version` → 409 `CONFLICT`, nothing changed.
- A10: after an approval, `audit_logs` has `RECOMMENDATION_APPROVED` and `RECOMMENDATION_EXECUTED` rows with actor, resource, request_id, result.
- `run-worker` endpoint is 404 outside demo mode and 403 for OPERATOR.

## Definition of done

- [ ] With seeds loaded, one worker tick flags A1024 as stalled and creates one recommendation; a second tick creates nothing new.
- [ ] Sara opens Approvals, sees the recommendation with evidence, approves it, and within a few seconds the case detail shows `ESCALATED`, the new responsibility role, and timeline entries for approval → action requested → action confirmed (with the mock external reference).
- [ ] With `CIVIC_MOCK_MODE=timeout`, the same approval shows the truthful failure state, the case stays `ESCALATION_PENDING`, and Retry (after switching the mode back) completes it.
- [ ] Double-clicking Approve produces exactly one external action.
- [ ] All tests above pass; `make check` green; CI green.

## Demo checkpoint

Scenes 4–7 (§32): open stalled A1024 → worker has flagged it → recommendation with evidence → operator approves → mock adapter confirms → timeline shows approval, action, and confirmed result. Appendix G's adapter-failure backup is demonstrable with one environment variable.

## Risks and notes

- R6/R7 (duplicate side effect, unauthorised escalation) are addressed structurally here; both have dedicated tests.
- Holding a DB lock across the adapter call would serialise all approvals behind a slow external system; the flow commits the approval first and calls the adapter outside the lock, which is why `EXECUTING` exists as a status.
- `SUPERSEDED` is an addition to the PRD's `RecommendationStatus` enum, needed so a resolved stall does not leave a misleading `PENDING` recommendation in the queue.
