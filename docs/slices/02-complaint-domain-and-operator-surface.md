# Slice 2 — Complaint Domain & Operator Surface

Status: Not started
Size: L
Depends on: Slice 1
PRD coverage: F4 (creation), F5 (routing), F6 (lifecycle), F7 (timeline), F8 (responsibility), F18 (citizen case view), F19 (operator dashboard). Flows A (steps 12–15), C. §12 complaints/dashboard endpoints, §13 `complaints`, `complaint_events`, `departments`, §14 enums, Appendix A (categories), Appendix B (responsibility chain), Appendix F (seed dataset). US-03, US-04, US-10. Acceptance A4, A5, A10, A11, A14, A15.

## Goal

Build the deterministic core with no AI involved: a complaint can be created from structured input, is routed to a department from configuration, moves through an explicit state machine with optimistic versioning, emits an append-only timeline, and is visible to citizens (own cases) and operators (queue, dashboard, case detail). Seed the Appendix F demo dataset.

## What this proves

"AI interprets ambiguity; code owns truth" (§3 principle 2). Everything in this slice is testable without a model key. The judge-visible claims "persistent database state" and "deterministic state machine" (§33) are fully demonstrable after this slice.

## In scope

### Domain (`backend/app/domain/`)

- `complaints/entities.py`: enums from §14 — `ComplaintStatus`, `Priority`, `ComplaintCategory`, plus `ResponsibilityType` (`UNASSIGNED|DEPARTMENT|ROLE`), `EventType`, `ActorType`.
- `complaints/transitions.py`: the transition table below, `assert_transition(current, target)` raising `INVALID_STATE_TRANSITION` (409), and `allowed_targets(current, actor_role)`.
- `complaints/service.py`:
  - `create_complaint(db, actor, input) -> Complaint`: validates enums, assigns `reference` from sequence, routes via `RoutingService`, sets initial status `REPORTED` then auto-advances to `SUBMITTED` on successful routing (both events recorded), sets responsibility from department chain level 0, appends `COMPLAINT_CREATED` and `ROUTED` (or `REVIEW_REQUIRED`) events, records audit.
  - `transition_status(db, actor, complaint_id, target, reason, expected_version)`: role check (OPERATOR/ADMIN/SERVICE), load `FOR UPDATE`, version check (→ 409 `CONFLICT`), transition check, increments `version`, appends `STATUS_CHANGED`, audit.
  - `add_note(db, actor, complaint_id, text)`: operator note → `NOTE_ADDED` progress event (gives operators a way to record real progress, used by the stall demo).
  - `get_visible_case(db, actor, complaint_id)`: citizens see only their own; others' cases return 404 `NOT_FOUND` (not 403) so existence is not leaked (§20, A11). Operators/admins see all.
  - `list_complaints(db, actor, filters, page, page_size)`: filters from §12 (`status, priority, department_id, category, stalled`) plus `citizen_id` implied for citizens.
  - `assert_permission(actor, action, complaint)`.
- `complaints/policies.py`: who may do what per §15 matrix; `PROGRESS_EVENT_TYPES` (below).
- `routing/service.py` + `routing/mappings.py`: `route(category, confidence=None)` → `RoutingDecision(department, review_required, reason)`. `UNKNOWN` category or confidence below `ROUTING_MIN_CONFIDENCE` (default 0.6) → General Services desk with `review_required=true`. Reads `routing_rules` from DB; never from code constants.
- `events/service.py`: `append(db, complaint_id, event_type, actor, payload)`; events are insert-only (no update/delete paths exist in the repository).
- Case reference: Postgres sequence `complaint_reference_seq` starting at 1029 (so seeds occupy A1011, A1024–A1028 explicitly and live-created cases start at A1029).

### State machine (defined here; PRD does not enumerate it)

```text
REPORTED            → SUBMITTED, ACKNOWLEDGED, WAITING_FOR_CITIZEN, CLOSED
SUBMITTED           → ACKNOWLEDGED, ASSIGNED, WAITING_FOR_CITIZEN, CLOSED
ACKNOWLEDGED        → ASSIGNED, WAITING_FOR_CITIZEN, ESCALATION_PENDING, CLOSED
ASSIGNED            → IN_PROGRESS, WAITING_FOR_CITIZEN, ESCALATION_PENDING, RESOLVED, CLOSED
IN_PROGRESS         → WAITING_FOR_CITIZEN, ESCALATION_PENDING, RESOLVED, CLOSED
WAITING_FOR_CITIZEN → ACKNOWLEDGED, ASSIGNED, IN_PROGRESS, CLOSED
ESCALATION_PENDING  → ESCALATED, ASSIGNED, IN_PROGRESS, CLOSED
ESCALATED           → IN_PROGRESS, RESOLVED, CLOSED
RESOLVED            → CLOSED, IN_PROGRESS            (IN_PROGRESS = reopen)
CLOSED              → (terminal)
```

Actor rules: citizens never call the transition endpoint. `ESCALATION_PENDING → ESCALATED` is reserved for the escalation service (slice 4) and rejected for direct operator calls. `WAITING_FOR_CITIZEN → *` may also be triggered by the agent's `add_missing_information` tool (slice 3) acting as `ActorType.AGENT`.

### Event types and progress semantics

```text
COMPLAINT_CREATED, ROUTED, REVIEW_REQUIRED, STATUS_CHANGED, ASSIGNED, NOTE_ADDED,
INFORMATION_ADDED, COMMITMENT_CREATED, COMMITMENT_FULFILLED, COMMITMENT_MISSED,
STALL_DETECTED, RECOMMENDATION_CREATED, RECOMMENDATION_APPROVED, RECOMMENDATION_REJECTED,
EXTERNAL_ACTION_REQUESTED, EXTERNAL_ACTION_CONFIRMED, EXTERNAL_ACTION_FAILED,
FOLLOW_UP_SENT, RECURRENCE_DETECTED, EVIDENCE_ADDED
```

`PROGRESS_EVENT_TYPES` (what counts as the responsible party making progress, consumed by slice 4's stall detector):
`STATUS_CHANGED` (except to `WAITING_FOR_CITIZEN`, which is waiting on the citizen), `ASSIGNED`, `NOTE_ADDED`, `COMMITMENT_CREATED`, `COMMITMENT_FULFILLED`, `EXTERNAL_ACTION_CONFIRMED`, `FOLLOW_UP_SENT`.
Explicitly not progress: `STALL_DETECTED`, `RECOMMENDATION_*`, `EVIDENCE_ADDED` (citizen action), `INFORMATION_ADDED` (citizen action), `RECURRENCE_DETECTED`, `COMMITMENT_MISSED`.

### Configuration (`database/seed/`)

- `departments.yaml`: Roads & Works; Water & Drainage; Sanitation; Electrical & Street Lighting; Public Safety; General Services Desk. Each has `code`, `name`, `active`, and `escalation_chain` (Appendix B generic roles, e.g. `["Field Team", "Department Coordinator", "Supervisor"]`).
- `routing_rules.yaml`: category → department code, with Appendix A keyword hints stored alongside (for the agent's `get_department_rules` tool in slice 3, never for code-side matching). `UNKNOWN` → General Services Desk, `review_required: true`.
- `complaints.yaml`: Appendix F dataset with relative timestamps (`created_offset_hours`, event offsets). A1011 added as the historical resolved sanitation case that A1027 references. A1024's commitment and A1028's recurrence link are seeded in slice 5 when those tables exist; the slice 2 seed leaves hooks (`seed_commitments()`, `seed_links()`) as no-ops.

### API (`backend/app/api/routes/`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/v1/complaints` | CITIZEN, OPERATOR, ADMIN | §12 body; operators may pass `citizen_id` (manual intake, Flow H) |
| GET | `/api/v1/complaints` | any | filters + `page`, `page_size` (max 100); citizens auto-scoped to own |
| GET | `/api/v1/complaints/{id}` | owner or OPERATOR/ADMIN | summary, `allowed_transitions`, `timeline`, and empty-but-present `recommendations`, `commitments`, `evidence`, `related_cases` arrays so the shape is stable for later slices |
| PATCH | `/api/v1/complaints/{id}/status` | OPERATOR, ADMIN | `{target_status, reason, expected_version}` |
| POST | `/api/v1/complaints/{id}/notes` | OPERATOR, ADMIN | `{text}` → `NOTE_ADDED` |
| GET | `/api/v1/dashboard/summary` | OPERATOR, ADMIN | counters: open, stalled, pending_approval, high_priority, recurring (zeros for not-yet-built features) |
| GET | `/api/v1/dashboard/queue` | OPERATOR, ADMIN | ordered per §10: pending approval → stalled/high priority → missed commitments → recently updated |
| GET | `/api/v1/config/categories` | any | categories + display labels + department names, for chips and forms |

DTOs live in `app/api/schemas/` and are distinct from domain entities and DB models (§14 "internal model separation").

### Frontend

- Citizen: `/citizen/complaints` (ComplaintCard list with StatusBadge/PriorityBadge, empty state "You have not reported anything yet"), `/citizen/complaints/[id]` (header, summary, read-only `CaseTimeline`, citizen-safe wording, no operator controls). `/citizen` keeps a temporary "Report with a form" path (`/citizen/report`) until chat lands in slice 3; it stays afterwards as the Flow H fallback.
- Operator: `/dashboard` (five `MetricCard`s + queue), `/dashboard/complaints` (`FilterBar` bound to URL search params, `DataTable` with pagination), `/dashboard/complaints/[id]` (header → summary → timeline → recommendations placeholder → evidence placeholder → related placeholder, per §10 layout), status transition control that only offers `allowed_transitions` from the server and requires a reason, add-note form, `/dashboard/complaints/new` manual intake form.
- Components added: `ComplaintCard`, `StatusBadge`, `PriorityBadge`, `Timeline`/`CaseTimeline`, `MetricCard`, `FilterBar`, `DataTable`.
- All mutations: disable the submit control while in flight, send `expected_version`, invalidate the case + list + summary queries on success, and on 409 show the §19 "refresh to see the latest state" message with a one-click refetch.

## Out of scope (deferred)

LLM anything (3). `stalled` is a column but nothing sets it (4). Recommendations, approvals (4). Commitments, related cases, recurrence (5). Evidence, notifications (6).

## Data model added (revision `0002_complaints`)

```text
departments          id UUID PK, code UNIQUE, name UNIQUE, active BOOL, escalation_chain JSONB, created_at, updated_at
routing_rules        id UUID PK, category UNIQUE, department_id FK, review_required BOOL, keyword_hints JSONB,
                     stall_threshold_hours INT NULL, active BOOL
complaints           id UUID PK, reference VARCHAR UNIQUE, external_reference NULL, citizen_id FK users, department_id FK NULL,
                     title, description TEXT, category, priority, status, review_required BOOL,
                     responsibility_type, responsibility_name NULL, responsibility_level INT DEFAULT 0,
                     location_text TEXT NULL, latitude NUMERIC NULL, longitude NUMERIC NULL,
                     stalled BOOL DEFAULT false, recurring BOOL DEFAULT false, version INT DEFAULT 1,
                     last_progress_at TIMESTAMPTZ, created_at, updated_at
complaint_events     id UUID PK, complaint_id FK, event_type, actor_type, actor_id NULL, payload JSONB, created_at
sequence complaint_reference_seq START 1029
indexes              complaints(status), (priority), (department_id), (category), (stalled), (created_at), (citizen_id);
                     complaint_events(complaint_id, created_at)
```

`last_progress_at` is maintained by `EventService.append` when the event type is in `PROGRESS_EVENT_TYPES`; it is denormalised so the stall detector (slice 4) and the queue ordering do not scan events.

## Seed dataset (relative to now)

| Ref | Title | Category | Priority | Status | Notes |
|---|---|---|---|---|---|
| A1011 | Garbage pile behind market | SANITATION | MEDIUM | RESOLVED | 40 days old; referenced by A1027 |
| A1024 | Broken streetlight, Street 7 | ELECTRICAL_INFRASTRUCTURE | MEDIUM | IN_PROGRESS | assigned and last progress 72 h ago |
| A1025 | Sewage overflow near ABC Chowk | WATER_DRAINAGE | HIGH | ASSIGNED | last progress 18 h ago |
| A1026 | Pothole near school gate | ROADS | HIGH | ACKNOWLEDGED | evidence added in slice 6 |
| A1027 | Garbage accumulation behind market | SANITATION | MEDIUM | RESOLVED | related to A1011 (link in slice 5) |
| A1028 | Streetlight out again, Street 7 | ELECTRICAL_INFRASTRUCTURE | MEDIUM | REPORTED | same location as A1024 (link in slice 5) |

All are owned by Hamza. Each has a realistic back-dated event history (created → routed → acknowledged → assigned → ...).

## Tests

Unit:
- Every row of the transition table: each listed target passes; a sample of illegal pairs (`CLOSED→IN_PROGRESS` per A5, `REPORTED→RESOLVED`, `ESCALATION_PENDING→ESCALATED` by an operator) is rejected with `INVALID_STATE_TRANSITION`.
- Routing: each category maps to its configured department; `UNKNOWN` and low confidence set `review_required`; missing rule raises a clear config error rather than guessing.
- `PROGRESS_EVENT_TYPES` updates `last_progress_at`; non-progress events do not.
- Reference generation is monotonic and unique under concurrent inserts.

API:
- A4: `ASSIGNED → IN_PROGRESS` by Sara succeeds, appends exactly one `STATUS_CHANGED`, increments `version`.
- A5: `CLOSED → IN_PROGRESS` returns 409 `INVALID_STATE_TRANSITION`.
- Version conflict: stale `expected_version` returns 409 `CONFLICT`; state unchanged.
- A11: Hamza reading another citizen's case gets 404; listing returns only his cases.
- Citizen calling PATCH status → 403.
- A14: after a transition, GET returns the same status/version as the PATCH response.
- A15: with an empty database, `/dashboard/summary` returns zeros and `/dashboard/queue` returns an empty list (UI shows the meaningful empty state).
- Pagination bounds (`page_size` > 100 rejected), filters combine correctly.
- Seed: running twice yields the same six complaints, no duplicates.

## Definition of done

- [ ] `make reset` produces the six seeded cases with correct statuses and back-dated timelines.
- [ ] Sara can open the dashboard, see counters and the ordered queue, open A1025, move it `ASSIGNED → IN_PROGRESS` with a reason, and see the new timeline entry after refresh.
- [ ] Hamza sees only his complaints; opening another citizen's URL shows the not-found state.
- [ ] Manual intake form (`/dashboard/complaints/new` and `/citizen/report`) creates a routed case with two initial events.
- [ ] All tests above pass; `make check` green; CI green.
- [ ] No route contains business policy; all policy lives in `domain/`.

## Demo checkpoint

Scene 4 (§32) is now possible: open pre-seeded A1024 and show a case that has been assigned with no progress for 72 hours, with its full timeline and responsibility ("Field Team, Electrical & Street Lighting"). Scenes 1–3 still require slice 3.

## Risks and notes

- The transition table is a product decision. It is written down here so it can be reviewed before code; changing it later is a one-file change plus tests.
- Keep DTOs citizen-safe: the citizen case view omits internal fields (`review_required`, `responsibility_level`, operator note author IDs).
