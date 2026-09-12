# Slice 4 — Stall → Recommend → Approve → Act

Status: Not started
Size: L
Depends on: Slice 2 (Slice 3 optional; the demo order assumes 3 is done)
PRD coverage: F10 (stall detection), F11 (recommendation), F12 (human approval), F13 (civic adapter), F14 (mock department system). Flows E, F, I. §12 recommendations/approvals/dashboard-stalled endpoints. §13 `recommendations`, `approvals`. §14 recommendation enums. §18 adapter contract. §20 double-click, stale approval, worker restart, adapter timeout. Appendix B (escalation chain), Appendix D approval-required tools. US-05, US-07, US-12. Acceptance A6, A8, A9, A10.

## Goal

A background worker detects cases with no progress past a threshold, flags them, and creates exactly one evidence-backed recommendation per incident. An operator reviews the recommendation, approves it, and the server executes the action through a replaceable civic adapter with a stable external idempotency key. The case only becomes `ESCALATED` when the adapter confirms. Interrupted executions are recovered, not stranded. Everything lands in the timeline and audit log.

## What this proves

The "wow factor" second half (§1): background event detection, the human approval boundary, exactly-once external action, replaceable adapter, and truthful failure. This is the slice that separates Awwaz from a chatbot (R8).

## In scope

### Worker (`backend/app/workers/`)

- `scheduler.py`: `python -m app.workers.scheduler` loop; interval `WORKER_INTERVAL_SECONDS` (default 30). Each tick runs `stall_detector.run()`, `execution_reconciler.run()`, then `commitment_checker.run()` (the latter is a no-op until slice 5). Each tick is one DB transaction per case; failures on one case are logged and do not stop the tick. Uses the seeded SERVICE actor for audit.
- `stall_detector.py`:
  - Eligible statuses: `SUBMITTED, ACKNOWLEDGED, ASSIGNED, IN_PROGRESS, ESCALATED`. Not eligible: `REPORTED` (not yet routed), `WAITING_FOR_CITIZEN` (waiting on the citizen), `ESCALATION_PENDING` (already under human decision), `RESOLVED`, `CLOSED`.
  - Threshold: `routing_rules.stall_threshold_hours` for the case's category, else `STALL_THRESHOLD_HOURS` (default 72).
  - `hours_since = now - last_progress_at` (denormalised in slice 2; falls back to the latest `PROGRESS_EVENT_TYPES` event, then `created_at`).
  - If `hours_since >= threshold` and `stalled=false`: set `stalled=true`, append `STALL_DETECTED` (non-progress) with evidence, then ask `EscalationService.create_recommendation`.
  - If progress has resumed (`last_progress_at` newer than the `STALL_DETECTED` event) and `stalled=true`: set `stalled=false` and mark any still-`PENDING` stall recommendation for that incident `SUPERSEDED` (a terminal status added for this purpose) with an event.
  - Incident key: `STALL:{complaint_id}:{last_progress_event_id}`. Same key on re-run → no new recommendation (A6, §20 "worker restart"). New progress then a new stall → new key → new recommendation.
  - Recommendation type rule (deterministic): `ESCALATE` if the case has a `MISSED` commitment (slice 5 populates this; empty until then) **or** `hours_since >= 2 × threshold` **or** status is `ESCALATED` and still stalled (escalate to the next chain level); otherwise `FOLLOW_UP`. A1024 (72 h, missed commitment in slice 5) → `ESCALATE` in the final demo; before slice 5 it yields `FOLLOW_UP` unless the threshold is set to 36 h, which the demo runbook documents.
  - Evidence JSON (what the operator sees, Flow D/E step 6): `last_progress_at`, `hours_since_progress`, `threshold_hours`, `status`, `department`, `responsibility_name`, `responsibility_level`, `missed_commitments[]`, `previous_escalations`.
- `execution_reconciler.py`: recovers executions whose lease has expired. Specified under "Recovering interrupted executions" below.

### Escalation domain (`backend/app/domain/escalation/`)

- `service.py`:
  - `is_eligible(complaint, now, threshold)` pure function.
  - `create_recommendation(db, complaint, type, reason, evidence, incident_key, requires_approval)`: insert-or-return-existing on the partial unique index; appends `RECOMMENDATION_CREATED`; `LINK_RECURRING` and `REQUEST_INFORMATION` (future) can be `requires_approval=false`; `FOLLOW_UP` and `ESCALATE` always require approval.
  - `approve(db, actor, recommendation_id, comment, idempotency_key, expected_case_version)`: see approval flow below. Mints the recommendation's `external_idempotency_key` exactly once.
  - `reject(db, actor, recommendation_id, comment)`: `PENDING → REJECTED`, approval row with decision `REJECTED`, `RECOMMENDATION_REJECTED` event, audit.
  - `retry(db, actor, recommendation_id, idempotency_key)`: `FAILED → EXECUTING` and a new attempt row via `begin_attempt`, then `run_attempt`. If `begin_attempt` raises `CaseStateChanged` (an operator moved the case after a lapsed reservation) → 409 `CONFLICT`, code `CASE_STATE_CHANGED`, no attempt row, no state change; the message names the current status and says to move the case back to Escalation Pending or reject the recommendation. The HTTP `Idempotency-Key` only governs replay of this HTTP response; the adapter is always called with the recommendation's **stored** `external_idempotency_key`, so a retry after an ambiguous failure cannot produce a second external escalation.
  - `begin_attempt(db, recommendation, actor)`: in **one transaction**, with the recommendation row locked `FOR UPDATE`: moves the recommendation to `EXECUTING`, sets the lease, increments `execution_attempts`, inserts the `external_actions` row for that attempt with `status=PENDING`, **and sets or renews the case reservation** (`complaints.execution_lock_recommendation_id`, `execution_lock_expires_at` = the attempt's lease). Before writing anything it also locks the complaint row and asserts the case is still in a state the approved action expects (`expected_case_states(type)`: `ESCALATE` → `ESCALATION_PENDING`; `FOLLOW_UP` → any of `SUBMITTED, ACKNOWLEDGED, ASSIGNED, IN_PROGRESS, ESCALATED`); otherwise it raises `CaseStateChanged` and starts nothing. The approval path performs the `ESCALATION_PENDING` transition earlier in the same transaction (step 5), so the assertion holds on the first attempt; retries and re-drives find the case still there or are refused. This is the only way an attempt starts (approval, operator retry, and automatic re-drive all call it), so there is never an `EXECUTING` recommendation without a `PENDING` attempt row, no attempt ever runs on an unreserved case, and no attempt is ever dispatched for a case an operator has since redirected or closed.
  - `run_attempt(db, recommendation, attempt)`: dispatch by type — `ESCALATE` → `adapter.escalate_case`, `FOLLOW_UP` → `adapter.request_follow_up` — then hand the outcome to `finalize_attempt`. The attempt row is the outbox record: an attempt interrupted at any point after `begin_attempt` is visible as a `PENDING` row past its lease.
  - `finalize_attempt(db, recommendation_id, attempt, outcome)`: locks the recommendation row `FOR UPDATE`, then the complaint row. **Always** finalises this attempt's `external_actions` row. Mutates the recommendation, the case, and the reservation only when the outcome is authoritative: a **success from any attempt** is authoritative (the external action happened, and the stable key makes every other attempt a duplicate), so it is applied unless the recommendation is already `EXECUTED`; a **failure is authoritative only from the current attempt** (`attempt == execution_attempts`) while the recommendation is still `EXECUTING`. A failure from a superseded attempt marks its own row `superseded=true` and changes nothing else, because a newer attempt is running under a newer lease and reservation. Steps 7–8 below are this function's two branches.
  - `reconcile_stale_executions(db, now)`: used by the worker and by the request path when a lease has expired.
- `policies.py`: who may approve (OPERATOR, ADMIN; never CITIZEN, never AGENT, never the model); next chain level computation from `departments.escalation_chain`; `assert_not_reserved(complaint, actor_type, now)` used by slice 2's `transition_status` (see "Reserving the case during execution").

### Two idempotency keys (D13)

| Key | Minted | Scope | Purpose |
|---|---|---|---|
| HTTP `Idempotency-Key` | by the client, once per dialog open / retry click | one HTTP request and its replays | return the same HTTP response for a repeated request; detect concurrent duplicates |
| `external_idempotency_key` | by the server at approval, `awwaz-{recommendation_id}-{approval_id}` | the recommendation's external action, across **every** attempt | let the external system dedupe: a retry after a timeout must never be a second escalation |

The external key is stored on `recommendations` and is immutable once set. Every `external_actions` row for that recommendation carries the same key with an incrementing `attempt`.

### Approval flow (Flow F, server-side; state committed before the adapter call, adapter call outside any DB lock)

1. `require_roles(OPERATOR, ADMIN)`.
2. `Idempotency-Key` header required (400 `VALIDATION_ERROR` if absent). Look up `(key, actor_id, route)`:
   - `COMPLETED` → replay the stored response with `meta.idempotent_replay=true`.
   - `IN_FLIGHT` with an unexpired lease → 409 `CONFLICT` with `Retry-After` (a concurrent duplicate, e.g. a double click racing the first request).
   - `IN_FLIGHT` with an expired lease → treat as a resume: run `reconcile_stale_executions` for the linked recommendation inline, then return its current state with `meta.recovered=true` (200). The key is never a permanent 409.
   - `ABANDONED` (the reconciler got there first) → same as the resume case.
   - Absent → insert `IN_FLIGHT` with `lease_expires_at = now + IDEMPOTENCY_LEASE_SECONDS` (default 90) and continue.
3. Lock the recommendation row (`FOR UPDATE`). Must be `PENDING`, else 409 `ACTION_ALREADY_EXECUTED` (§20 "stale approval").
4. If `expected_case_version` supplied and differs → 409 `CONFLICT`.
5. In one transaction, **in this order**: insert `approvals` row (decision `APPROVED`, comment); mint `external_idempotency_key`; **for `ESCALATE`, transition the case to `ESCALATION_PENDING` first**, via slice 2's `transition_status` as `ActorType.SYSTEM` (D9) — if the case cannot legally enter `ESCALATION_PENDING` from its current status (it was resolved or closed after the recommendation was created), this raises `INVALID_STATE_TRANSITION`, the transaction rolls back, the response is 409, and the message tells the operator to reject the recommendation instead; **then** `begin_attempt`, whose case-state assertion now holds for `ESCALATE` because the transition just happened in this same transaction, and holds for `FOLLOW_UP` while the case is still in a stall-eligible status (otherwise `CaseStateChanged` → 409 `CASE_STATE_CHANGED`, rollback, nothing written) — recommendation `PENDING → EXECUTING` with `execution_lease_expires_at = now + EXECUTION_LEASE_SECONDS` (default `2 × CIVIC_ADAPTER_TIMEOUT_SECONDS + 30`, i.e. 40 s), `execution_attempts = 1`, the `external_actions` row for attempt 1 (`status=PENDING`, the external key, `request_id`), **and the case reservation** (`complaints.execution_lock_recommendation_id`, `execution_lock_expires_at` = the same lease); link the idempotency row to the recommendation; append `RECOMMENDATION_APPROVED`. Commit. From this point a crash at any moment leaves a `PENDING` attempt row past its lease, which is exactly what the reconciler looks for.
6. Call the adapter with `timeout=CIVIC_ADAPTER_TIMEOUT_SECONDS` (default 5), `request_id`, and `external_idempotency_key`. Append `EXTERNAL_ACTION_REQUESTED`.
7. Success → `finalize_attempt(SUCCESS)`, one transaction, recommendation row then complaint row locked `FOR UPDATE`: this attempt's `external_actions` row → `SUCCEEDED` with the external reference. If the recommendation is already `EXECUTED` (an earlier attempt's late success got there first): stop; the reference is expected to match, and a mismatch appends `RECONCILIATION_REQUIRED`. Otherwise, **whether or not this attempt is the current one**: recommendation → `EXECUTED`; clear the reservation; append `EXTERNAL_ACTION_CONFIRMED` (progress). For `ESCALATE`: if the case is still `ESCALATION_PENDING` → `ESCALATED`, `responsibility_level += 1`, `responsibility_name` = next chain role, `stalled=false`. If the case is **not** `ESCALATION_PENDING` (only reachable after a lease expiry released the reservation and an operator moved the case before a late success arrived): leave the status as the operator set it, append `RECONCILIATION_REQUIRED` with both facts (external reference, current status, who changed it), and raise an operator notification (slice 6). External reality is recorded truthfully either way. For `FOLLOW_UP`: `FOLLOW_UP_SENT` event (progress), `stalled=false`. Audit `RECOMMENDATION_EXECUTED` with result.
8. Failure → classify: `REJECTED` (the adapter returned a definitive refusal), `TIMEOUT` or `TRANSPORT` (ambiguous: the external system may have accepted the action). `finalize_attempt(FAILURE)`, same locks: this attempt's `external_actions` row → `FAILED` with `error_class`. If this attempt is **not** the current one, or the recommendation is no longer `EXECUTING`: mark the row `superseded=true` and stop; a stale failure never fails the recommendation, never clears a reservation that is protecting a newer attempt, and never overwrites a success. Otherwise: recommendation → `FAILED`; clear the reservation; append `EXTERNAL_ACTION_FAILED`; case status unchanged from step 5 (`ESCALATION_PENDING` for escalations, per D9; never `ESCALATED` — A9). Audit with `result=FAILURE`. Response is 200 with `data.recommendation.status="FAILED"`, `error_class`, and the §19 message "The action was not confirmed, so the case status was not changed", because the approval itself succeeded and was recorded. If the request's own attempt turned out to be stale (its lease expired and the reconciler re-drove during the call), the response instead returns the recommendation's current state with `meta.superseded_attempt=<n>`.
9. Store the final response body against the idempotency key (`COMPLETED`).

### Recovering interrupted executions (D14)

The process can die between step 5 and step 9 (deploy, crash, OOM). Without recovery the recommendation would sit in `EXECUTING` forever, the case would stay reserved, the same HTTP key would return 409 forever, and a fresh key would hit `ACTION_ALREADY_EXECUTED`. Leases plus a reconciler bound every one of those.

- Leases: `recommendations.execution_lease_expires_at` and `idempotency_keys.lease_expires_at` are set when work starts and refreshed on each attempt. Nothing is ever considered stuck before its lease expires.
- `execution_reconciler.run(now)` (worker step, every tick; also invoked inline by the request path in step 2): for each recommendation `EXECUTING` with an expired lease:
  1. Mark the `PENDING` `external_actions` row for `execution_attempts` `INTERRUPTED` (its outcome is unknown; the adapter may or may not have received it). Because `begin_attempt` writes that row in the same transaction that sets `EXECUTING`, the row always exists; as a defensive guard against a hand-edited or partially migrated database, a missing row is synthesised with `status=INTERRUPTED` and `error_class=INTERRUPTED` for that attempt number so the attempt history stays complete and recovery proceeds rather than skipping the case.
  2. **Re-validate the case before any re-drive.** The reservation lapsed with the lease, so an operator may legitimately have moved the case since (`ESCALATION_PENDING → IN_PROGRESS` or `CLOSED`, for example). Lock the complaint row and compare its status with `expected_case_states(type)`. If it no longer matches: write a refused attempt row (`status=FAILED`, `error_class=CASE_STATE_CHANGED`, no adapter call, `latency_ms NULL`), recommendation → `FAILED`, clear any reservation, append `RECONCILIATION_REQUIRED` with the facts (expected status, actual status, who changed it and when, and that the interrupted attempt's dispatch to the adapter is unknown), raise an operator notification (slice 6), and stop. The operator decides: move the case back and Retry (which re-validates), or Reject. The external action is never re-sent for a case that is no longer in the approved state.
  3. Otherwise, if `execution_attempts <= MAX_AUTO_REDRIVES + 1` (default `MAX_AUTO_REDRIVES=1`, i.e. one automatic re-drive beyond the operator's original attempt): start a new attempt via `begin_attempt` as the SERVICE actor with the **same** external key and a fresh lease (attempt row and renewed case reservation written atomically with the lease; `begin_attempt` repeats the state assertion under its own lock), then `run_attempt`. Append `EXTERNAL_ACTION_REDRIVEN`. The human already approved; completing the approved action is a system responsibility, and the stable external key makes the re-drive safe.
  4. Otherwise: `finalize_attempt(FAILURE, error_class=INTERRUPTED)` for the current attempt → recommendation `FAILED`, `EXTERNAL_ACTION_FAILED`, reservation cleared, operator notification (slice 6). The operator's Retry button is available and safe for the same reason.
  5. Mark the linked idempotency row `ABANDONED` if still `IN_FLIGHT`, so a replay of that key returns the recommendation's current state rather than a conflict.
- Frontend: if the approve request fails at the transport level (no HTTP response), `ApprovalDialog` polls `GET /recommendations/{id}` until the status leaves `EXECUTING` (bounded by the lease) instead of reporting failure. A network blip is not shown as "not confirmed" until the server says so.

### Reserving the case during execution (D15)

Slice 2's state machine lets operators move `ESCALATION_PENDING → ASSIGNED | IN_PROGRESS | CLOSED`. Those transitions exist for the aftermath of a `FAILED` execution or a deliberate operator decision, but if one lands **while** the adapter is executing, a successful external escalation could arrive to a case that is no longer `ESCALATION_PENDING`. The reservation closes that window; the step 7 fallback covers the residue.

- `begin_attempt` sets or renews `complaints.execution_lock_recommendation_id` and `execution_lock_expires_at` (same lease as the attempt) on **every** attempt: the operator's approval, an operator retry after a `FAILED` attempt cleared the previous reservation, and a reconciler re-drive after the previous reservation expired. `finalize_attempt` clears them only when it moves the recommendation to a terminal state on an authoritative outcome; a superseded attempt's late failure never releases a reservation that is protecting a newer attempt.
- A reservation lapses with its lease. After that an operator may legitimately redirect or close the case, so every later attempt (retry or re-drive) re-validates the case state inside `begin_attempt` under the complaint row lock and refuses to dispatch if the case is no longer in the state the approval expects.
- Slice 2's `transition_status` calls `policies.assert_not_reserved(complaint, actor_type, now)`: an operator- or agent-initiated transition on a case with an unexpired reservation → 409 `CONFLICT`, code `CASE_RESERVED`, message "An approved action is executing on this case. Try again in a moment." `SYSTEM` transitions (the escalation service itself) are exempt. Notes, commitments, and evidence are not blocked; only status transitions are.
- Because the reservation shares the execution lease, a stranded execution can freeze a case for at most one lease before the reconciler releases it.
- Case DTO exposes `executing_recommendation_id` (null when not reserved); the operator status control is disabled with the same explanation while it is set. Dashboard queue shows an "executing" indicator on the row.
- Step 7 applies `ESCALATION_PENDING → ESCALATED` under a `FOR UPDATE` lock on the complaint row, so even a transition that slips in after lease expiry is serialised with the success write and the `RECONCILIATION_REQUIRED` branch sees a consistent state.

### Civic adapter (`backend/app/integrations/civic/`)

- `interface.py`: `CivicServiceAdapter` protocol with `submit_case`, `request_follow_up`, `escalate_case` (§18 contract). Every side-effecting input carries a required `external_idempotency_key` and `request_id`; results carry `external_reference`, `accepted_at`, `message`, `duplicate: bool` (true when the adapter recognised the key). Exceptions: `CivicAdapterRejected` (definitive refusal), `CivicAdapterTimeout`, `CivicAdapterUnavailable` (both ambiguous). Adapter authors are required to dedupe on the key; the contract says so in the docstring and the mock demonstrates it.
- `mock.py`: `MockCivicServiceAdapter` — deterministic. Reference format `MOCK-ESC-{sha1(external_idempotency_key)[:8]}` so a repeated key returns the same reference with `duplicate=true`. Simulated latency `CIVIC_MOCK_LATENCY_MS` (default 400). Failure control: `CIVIC_MOCK_MODE=success|timeout|error` globally, and a per-case override when `location_text` contains the token `[[fail]]` (test and demo hook, documented in the runbook). `timeout` mode models the ambiguous case faithfully: it **records the request, then raises** `CivicAdapterTimeout`, so a later attempt with the same key is a duplicate, not a new action. `error` mode raises `CivicAdapterRejected`. Keeps an in-memory log exposing `requests()` and `unique_actions()` so tests can assert exactly-once (A8) across retries.
- `factory.py`: `CIVIC_ADAPTER=mock` (only value for MVP); `CIVIC_SERVICE_BASE_URL` reserved for the future HTTP adapter (§27).

### Persistence (revision `0004_recommendations`)

```text
recommendations   id UUID PK, complaint_id FK, type, status (PENDING|APPROVED|REJECTED|EXECUTING|EXECUTED|FAILED|SUPERSEDED),
                  reason TEXT, evidence JSONB, requires_approval BOOL, incident_key VARCHAR, created_by_actor_type,
                  external_idempotency_key VARCHAR UNIQUE NULL,      -- minted once at approval, immutable
                  execution_lease_expires_at TIMESTAMPTZ NULL, execution_attempts INT DEFAULT 0,
                  created_at, updated_at
                  UNIQUE (incident_key) WHERE status IN ('PENDING','APPROVED','EXECUTING','FAILED')   -- "unique within active state"
                  index (status), (complaint_id), (status, execution_lease_expires_at)
approvals         id UUID PK, recommendation_id FK, approver_id FK users, decision (APPROVED|REJECTED), reason TEXT,
                  case_version_at_decision INT, created_at
external_actions  id UUID PK, recommendation_id FK, complaint_id FK, action_type, adapter, external_idempotency_key,
                  attempt INT, status (PENDING|SUCCEEDED|FAILED|INTERRUPTED), superseded BOOL DEFAULT false,
                  error_class (REJECTED|TIMEOUT|TRANSPORT|INTERRUPTED|CASE_STATE_CHANGED) NULL, external_reference NULL,
                  request_id, initiated_by_actor_type, started_at, finished_at NULL, latency_ms NULL
                  UNIQUE (recommendation_id, attempt)
idempotency_keys  key VARCHAR, actor_id UUID, route VARCHAR, status (IN_FLIGHT|COMPLETED|ABANDONED),
                  recommendation_id UUID NULL, lease_expires_at TIMESTAMPTZ, response_status INT NULL,
                  response_body JSONB NULL, created_at, completed_at NULL
                  PRIMARY KEY (key, actor_id, route); index (status, lease_expires_at)
complaints        + execution_lock_recommendation_id UUID FK recommendations NULL, + execution_lock_expires_at TIMESTAMPTZ NULL
```

New event types (added to slice 2's list): `EXTERNAL_ACTION_REDRIVEN`, `RECONCILIATION_REQUIRED` (both non-progress).

### API

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/v1/recommendations` | OPERATOR, ADMIN | filters `status, type, complaint_id` (§12) |
| GET | `/api/v1/recommendations/{id}` | OPERATOR, ADMIN | with evidence, approvals, all `external_actions` attempts, current case version, lease state |
| POST | `/api/v1/recommendations/{id}/approve` | OPERATOR, ADMIN | `Idempotency-Key` header; body `{comment, expected_case_version?}` |
| POST | `/api/v1/recommendations/{id}/reject` | OPERATOR, ADMIN | `{comment}` |
| POST | `/api/v1/recommendations/{id}/retry` | OPERATOR, ADMIN | `Idempotency-Key` header; only from `FAILED`; reuses the stored external key |
| GET | `/api/v1/dashboard/stalled` | OPERATOR, ADMIN | stalled cases with hours since progress and open recommendation |
| POST | `/api/v1/admin/demo/run-worker` | ADMIN | demo mode only; runs one tick synchronously (detector, reconciler, checker) and returns what it did |

`GET /complaints/{id}` now fills the `recommendations` array and exposes `executing_recommendation_id`. `dashboard/summary` now counts `stalled` and `pending_approval`; the queue's first two tiers become live.

### Frontend

- `/dashboard/approvals`: list of `RecommendationCard`s (type, case reference and title, reason, key evidence figures, age). Empty state: "No recommendations waiting for a decision."
- `ApprovalDialog` (§10 "Approval modal"): title "Approve escalation?" / "Approve follow-up?", an explicit action statement ("Awwaz will send an escalation to Department Coordinator, Electrical & Street Lighting via the civic service adapter"), evidence block (case age, last progress, commitment status), Approve / Reject / Cancel. Generates one HTTP idempotency key when the dialog opens; the approve button disables on first click (§20 "double approval click"); on 409 shows the refresh prompt; on transport failure polls the recommendation until it leaves `EXECUTING`; on `FAILED` shows the truthful message, the `error_class`, and a Retry control. For ambiguous classes the copy says "The department system may already have received this. Retrying is safe: Awwaz reuses the same action key."
- Case detail: Recommendations section with the same card and controls, including the attempt history; a stalled badge in the header; the status control disabled with the reservation message while an action is executing; the timeline renders approval, action requested/confirmed/failed/re-driven, reconciliation-required, and status events with distinct icons plus text.
- Dashboard: Stalled and Pending Approval counters live; queue tiers 1–2 populated with an "executing" indicator where applicable; `/dashboard/activity` shows the recent audit log for OPERATOR/ADMIN (read-only, this is the first real content for that route).

## Out of scope (deferred)

Commitments and missed-commitment evidence (5). Notifications on execution and on reconciliation-required (6; the events and hooks exist here). Rate limits (6). Real external adapter (future).

## Key rules and invariants

- The worker never changes complaint `status`; it only sets `stalled`, appends events, creates recommendations, and re-drives or fails stranded executions.
- Only the escalation service performs `ESCALATION_PENDING → ESCALATED`, and only after an adapter success result, under a lock on the complaint row.
- One external key per approved recommendation, for life. The adapter sees the same key on every attempt, so the external action happens at most once per approval regardless of retries, re-drives, or replays (A8).
- Every adapter attempt is an `external_actions` row written in the same transaction that moves the recommendation to `EXECUTING`, before any adapter call; no attempt is invisible, and no `EXECUTING` recommendation lacks a `PENDING` attempt row.
- `EXECUTING`, `IN_FLIGHT`, and the case reservation are all leased; none can outlive its lease without the reconciler acting on it.
- A `FAILED` recommendation is retryable; a retry is a new attempt row with the same external key, and it re-reserves the case for its own lease.
- Outcome authority: a success from any attempt is applied unless the recommendation is already `EXECUTED`; a failure is applied only from the current attempt while the recommendation is `EXECUTING`. A late result from a superseded attempt can never fail the recommendation, release a newer attempt's reservation, or overwrite a success.
- No adapter call is ever started for a case whose status no longer matches the approved action. `begin_attempt` asserts the expected state under the complaint row lock on every attempt; a mismatch is refused (`CASE_STATE_CHANGED`) and surfaced for human reconciliation, never sent.
- The LLM has no path to any endpoint or tool in this slice. Approval is an HTTP endpoint behind operator roles only.

## Tests

Unit:
- `is_eligible`: 71 h → false, 72 h → true, `WAITING_FOR_CITIZEN` → false, `RESOLVED` → false; per-category threshold overrides global.
- Recommendation type rule: 72 h no commitment → `FOLLOW_UP`; 150 h → `ESCALATE`; already `ESCALATED` and stalled → `ESCALATE` to the next level.
- Incident key stability across runs; new progress produces a new key.
- Mock adapter: same key → same reference and `duplicate=true`; `[[fail]]` → timeout; `timeout` mode records the request then raises `CivicAdapterTimeout`; `error` mode raises `CivicAdapterRejected`.
- `assert_not_reserved`: unexpired lock blocks OPERATOR and AGENT, allows SYSTEM; expired lock blocks nobody.

Integration (real Postgres, mock adapter):
- A6: seed A1024 at 73 h; run the detector twice → `stalled=true`, exactly one `PENDING` recommendation, one `STALL_DETECTED` event.
- Progress resumes (operator note) → next tick clears `stalled`, marks the recommendation `SUPERSEDED`.
- **First escalation approval passes the state assertion**: approving an `ESCALATE` recommendation on an `IN_PROGRESS` case → the case is `ESCALATION_PENDING` before `begin_attempt` runs, the attempt-1 row exists, and the adapter is called once. Approving an `ESCALATE` recommendation whose case was `CLOSED` in the meantime → 409 `INVALID_STATE_TRANSITION`, recommendation still `PENDING`, no attempt row, no reservation. Approving a `FOLLOW_UP` recommendation whose case moved to `RESOLVED` → 409 `CASE_STATE_CHANGED`, nothing written.
- A8 / US-12: approve twice with the same `Idempotency-Key` → adapter log shows one call; second response has `idempotent_replay=true`.
- Concurrent approvals with different keys → one succeeds, the other 409 `ACTION_ALREADY_EXECUTED`.
- **Ambiguous retry is exactly-once**: `CIVIC_MOCK_MODE=timeout` → recommendation `FAILED` with `error_class=TIMEOUT`, case `ESCALATION_PENDING`; switch to `success`, retry with a new HTTP key → `EXECUTED`, `ESCALATED`, and `unique_actions()` on the mock shows **one** external action whose reference equals the first attempt's; two `external_actions` rows with the same external key and attempts 1 and 2.
- A9 / Flow I: as above, asserting after the first attempt that the case is `ESCALATION_PENDING` not `ESCALATED` and `EXTERNAL_ACTION_FAILED` is present.
- **Interrupted execution is recovered**: a test hook aborts the request after step 5 commits and before the adapter call (lease set to 1 s). At the crash point assert the recommendation is `EXECUTING` **and** an `external_actions` row for attempt 1 exists with `status=PENDING`. Next reconciler run → that attempt is `INTERRUPTED`, a second attempt is made with the same external key, `EXTERNAL_ACTION_REDRIVEN` present, recommendation `EXECUTED`. A second variant deletes the attempt-1 row before the reconciler runs (simulating a corrupted record) and asserts the reconciler synthesises an `INTERRUPTED` row and still recovers. Same scenario with the adapter unavailable → recommendation `FAILED` (`error_class=INTERRUPTED`), reservation cleared, Retry succeeds when the adapter recovers.
- **Stranded HTTP key is not a permanent 409**: after the interrupted scenario, replaying the original `Idempotency-Key` returns 200 with the current recommendation state and `meta.recovered=true`; before the lease expires it returns 409 with `Retry-After`.
- **Reservation**: while a recommendation is `EXECUTING` (adapter latency raised to exceed the test's timing), Sara's `PATCH /complaints/{id}/status` → 409 `CASE_RESERVED`; after completion the same PATCH succeeds; the SYSTEM transition inside step 7 is unaffected.
- **Race fallback**: force lease expiry, let the reconciler release the reservation, move the case `ESCALATION_PENDING → IN_PROGRESS` as Sara, then deliver a late adapter success for attempt 1 → recommendation `EXECUTED`, `EXTERNAL_ACTION_CONFIRMED` present, status remains `IN_PROGRESS`, `RECONCILIATION_REQUIRED` event present with both facts.
- **Retry and re-drive re-reserve the case**: after a `FAILED` attempt cleared the reservation, Sara's retry → reservation present with the new lease and `PATCH /complaints/{id}/status` → 409 `CASE_RESERVED` for the duration of attempt 2; the same holds for a reconciler re-drive after the original reservation expired.
- **Stale failure does not fail a newer attempt**: attempt 1's lease expires mid-call, the reconciler begins attempt 2, then attempt 1 returns `TIMEOUT` → attempt-1 row `FAILED` with `superseded=true`, recommendation still `EXECUTING`, reservation intact with attempt 2's lease; attempt 2 then succeeds → `EXECUTED`, `ESCALATED`.
- **Stale success is applied**: attempt 1 returns a late success after attempt 2 was definitively `REJECTED` → recommendation `EXECUTED`, case `ESCALATED`, attempt-1 row `SUCCEEDED`, attempt-2 row `FAILED`; a subsequent duplicate success for attempt 2 changes nothing and its reference matches.
- **Re-drive refused after operator redirect**: attempt 1's lease expires before the adapter was reached, the reservation lapses, Sara moves the case `ESCALATION_PENDING → IN_PROGRESS`, the reconciler runs → the mock adapter log is unchanged, a refused attempt row exists (`FAILED`, `CASE_STATE_CHANGED`), recommendation `FAILED`, `RECONCILIATION_REQUIRED` present naming both statuses and Sara; Retry → 409 `CASE_STATE_CHANGED`; after Sara moves the case back to `ESCALATION_PENDING`, Retry dispatches once and completes.
- US-07: Hamza calling approve → 403; missing `Idempotency-Key` → 400.
- Stale `expected_case_version` → 409 `CONFLICT`, nothing changed.
- A10: after an approval, `audit_logs` has `RECOMMENDATION_APPROVED` and `RECOMMENDATION_EXECUTED` rows with actor, resource, request_id, result; re-drives are audited as the SERVICE actor.
- `run-worker` endpoint is 404 outside demo mode and 403 for OPERATOR.

## Definition of done

- [ ] With seeds loaded, one worker tick flags A1024 as stalled and creates one recommendation; a second tick creates nothing new.
- [ ] Sara opens Approvals, sees the recommendation with evidence, approves it, and within a few seconds the case detail shows `ESCALATED`, the new responsibility role, and timeline entries for approval → action requested → action confirmed (with the mock external reference).
- [ ] With `CIVIC_MOCK_MODE=timeout`, the same approval shows the truthful failure state with `error_class=TIMEOUT`, the case stays `ESCALATION_PENDING`, and Retry (after switching the mode back) completes it with the **same** external reference the mock would have issued the first time.
- [ ] Killing the backend between approval and adapter response leaves the recommendation recoverable: the next worker tick completes or fails it, and the case is not stuck reserved.
- [ ] If an operator redirects the case while an attempt is interrupted, the re-drive does not escalate it; the recommendation fails visibly with a reconciliation event instead.
- [ ] While an action is executing, on the first attempt or any retry or re-drive, the operator status control is disabled with an explanation and the API rejects transitions with `CASE_RESERVED`.
- [ ] Double-clicking Approve produces exactly one external action.
- [ ] All tests above pass; `make check` green; CI green.

## Demo checkpoint

Scenes 4–7 (§32): open stalled A1024 → worker has flagged it → recommendation with evidence → operator approves → mock adapter confirms → timeline shows approval, action, and confirmed result. Appendix G's adapter-failure backup is demonstrable with one environment variable, and the retry visibly reuses the same action key.

## Risks and notes

- R6/R7 (duplicate side effect, unauthorised escalation) are addressed structurally here; both have dedicated tests, including the ambiguous-timeout retry path.
- Holding a DB lock across the adapter call would serialise all approvals behind a slow external system; the flow commits the approval first and calls the adapter outside the lock, which is why `EXECUTING` exists as a status. The cost of that choice is the recovery and reservation machinery above, which is deliberately bounded by one lease.
- `SUPERSEDED` is an addition to the PRD's `RecommendationStatus` enum, needed so a resolved stall does not leave a misleading `PENDING` recommendation in the queue. `INTERRUPTED` on `external_actions` and `ABANDONED` on idempotency keys are likewise additions, needed so an interrupted process leaves an honest record.
- Automatic re-drive is limited to one attempt so a persistently failing adapter surfaces to a human quickly rather than retrying in the background indefinitely.
