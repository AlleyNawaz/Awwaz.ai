# Slice 5 — Commitments, Memory & Recurrence

Status: Not started
Size: M
Depends on: Slices 3 and 4
PRD coverage: F9 (commitment tracking), F16 (case memory), F17 (recurrence detection). Flows D, G. §12 commitments endpoints. §13 `commitments`. §14 `CommitmentStatus`, `LINK_RECURRING`. §20 "recurring issue with vague location". Appendix C (commitment model), Appendix F (A1024 commitment, A1027/A1011, A1028/A1024 links). US-06, US-08, US-09. Acceptance A7, A13.

## Goal

Make Awwaz remember. Operators record promised actions with due times; the worker marks them missed when the deadline passes without fulfilment and feeds that into recommendations. New cases are matched against prior cases by citizen, category, and normalised location so recurrence is visible on the dashboard and the agent can say "this looks related to A1024" in the chat.

## What this proves

"Memory and recurrence" (§33 item 9) and the Scene 8 close of the demo. It also completes the `ESCALATE` decision rule from slice 4 with real missed-commitment evidence, so A1024 produces the Appendix F `ESCALATE` recommendation without lowering the threshold.

## In scope

### Commitments (`backend/app/domain/commitments/`)

- `service.py`:
  - `create(db, actor, complaint_id, description, commitment_type, due_at)`: OPERATOR/ADMIN or AGENT (via tool, operator context only). `due_at` must be in the future and stored in UTC. Appends `COMMITMENT_CREATED` (progress event, since the department has engaged) and stores `source_event_id`. Audit.
  - `fulfil(db, actor, commitment_id, note)`: `PENDING|MISSED → FULFILLED`, `fulfilled_at=now`, appends `COMMITMENT_FULFILLED` (progress), stores `fulfillment_event_id`.
  - `cancel(db, actor, commitment_id, reason)`: `PENDING → CANCELLED` (authorised actor only), event, audit.
  - `evaluate(commitment, now)` pure function per Appendix C: `PENDING` before `due_at`; `MISSED` after `due_at` with no fulfilment; terminal states unchanged.
- Types: `VISIT`, `CALLBACK`, `INSPECTION`, `REPAIR`, `OTHER`.
- Worker `commitment_checker.py` (the hook left in slice 4): for each `PENDING` commitment with `due_at < now`: set `MISSED`, append `COMMITMENT_MISSED` (non-progress), create a recommendation `VERIFY_COMMITMENT` with `incident_key=COMMITMENT_MISSED:{commitment_id}`, `requires_approval=true`, evidence `{commitment_text, due_at, hours_overdue, no_fulfilment_event: true}` (Flow D step 6). The stall detector's evidence now includes `missed_commitments`, which flips its type rule to `ESCALATE`. Idempotent by key.
- `VERIFY_COMMITMENT` execution (slice 4 dispatcher extended): `adapter.request_follow_up` with the commitment text; on success `FOLLOW_UP_SENT`.

### Recurrence and memory (`backend/app/domain/recurrence/`)

- `service.py`:
  - `location_key(text) -> str|None`: lowercase; strip punctuation; collapse whitespace; drop a small configured stop-list of connectors in English and Roman Urdu (`near, ke pass, ke samne, opposite, behind, k pass`); return `None` if fewer than 2 meaningful tokens remain (a vague location must not produce a match — §20, A13). Stored on `complaints.location_key`.
  - `geo_cell(lat, lng) -> str|None`: `f"{round(lat,3)}:{round(lng,3)}"` (~100 m cell). Stored on `complaints.geo_cell`.
  - `find_related(db, complaint, window_days=RECURRENCE_WINDOW_DAYS (30)) -> list[RelatedCase]`, deterministic ranking, excluding the case itself:
    1. `RECURRENCE`: same category and (same `geo_cell` or same `location_key`) within the window. Score 1.0 for geo match, 0.9 for key match.
    2. `SAME_CITIZEN`: same citizen and category within the window, no location match. Score 0.5.
    3. `HISTORICAL`: same category and location match outside the window. Score 0.3 (shown as context, does not set `recurring`).
    Each result carries `evidence` (`matched_on: geo_cell|location_key|citizen`, `days_apart`, prior status and reference).
  - `link_on_create(db, complaint)`: called by `ComplaintService.create_complaint` after routing; writes `complaint_links`, sets `recurring=true` if any `RECURRENCE` match exists, appends `RECURRENCE_DETECTED` with the matched references, and creates a `LINK_RECURRING` recommendation (`requires_approval=false`, auto-`EXECUTED`, informational) so recurrence shows in the recommendation history without an approval step.
- `complaint_links`: bidirectional by convention (one row per pair, `complaint_id < related_complaint_id` ordering enforced) with `relation_type`, `score`, `evidence JSONB`.

### Agent updates (`backend/app/agent/`)

- `find_related_cases` becomes real: returns the citizen's visible related cases (recurrence + same citizen) with references, statuses, and days apart. The tool result is what the model cites; the guard from slice 3 ensures any reference in the reply exists in a tool result.
- `context.py` adds the citizen's last 5 case references and statuses so status queries ("mera streetlight case kya hua?") can be answered via `get_current_case`/`get_case_timeline`.
- New tool `record_commitment` (LOW_RISK_WRITE, `allowed_actor_types=[OPERATOR, ADMIN]`): available only in the operator "extract commitment from note" action, never in citizen chat. An operator types a note such as "Technician will visit tomorrow at 10"; the model extracts `description`, `commitment_type`, and `due_at` (resolved against the current UTC time supplied in context); the operator confirms in the UI before it is saved. AI extracts; code owns the timestamp and status (Appendix C). This is P1; if it slips, the manual commitment form remains the primary path.
- Prompt: add "when related cases exist, mention the most relevant prior reference and its current status in one sentence" (Scene 8 behaviour).

### Persistence (revision `0005_memory`)

```text
commitments        id UUID PK, complaint_id FK, source_event_id FK complaint_events, description TEXT, commitment_type,
                   due_at TIMESTAMPTZ, status (PENDING|FULFILLED|MISSED|CANCELLED), fulfilled_at NULL,
                   fulfillment_event_id FK NULL, created_by FK users NULL, created_at, updated_at
                   index (status, due_at), (complaint_id)
complaint_links    id UUID PK, complaint_id FK, related_complaint_id FK, relation_type (RECURRENCE|SAME_CITIZEN|HISTORICAL|DUPLICATE),
                   score NUMERIC, evidence JSONB, created_at
                   UNIQUE (complaint_id, related_complaint_id)
complaints         + location_key VARCHAR NULL (index), + geo_cell VARCHAR NULL (index)
```

Backfill in the migration: compute `location_key`/`geo_cell` for existing rows.

### Seed extensions (`database/seed/`)

- A1024: commitment `VISIT` "Technician will visit within 24 hours", created 48 h ago, due 24 h ago, status `MISSED` (the checker would also derive it; seeding it directly keeps `make reset` deterministic).
- A1028 shares A1024's `location_text` ("Street 7, near the park gate") → `RECURRENCE` link, `recurring=true`, `RECURRENCE_DETECTED` event.
- A1027 ↔ A1011: `HISTORICAL` link (same location key, 40 days apart).

### API

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/v1/complaints/{id}/commitments` | OPERATOR, ADMIN | §12 body |
| GET | `/api/v1/complaints/{id}/commitments` | owner, OPERATOR, ADMIN | citizen sees description, due, status only |
| POST | `/api/v1/complaints/{id}/commitments/{cid}/fulfil` | OPERATOR, ADMIN | `{note}` |
| POST | `/api/v1/complaints/{id}/commitments/{cid}/cancel` | OPERATOR, ADMIN | `{reason}` |
| POST | `/api/v1/complaints/{id}/commitments/extract` | OPERATOR, ADMIN | `{text}` → proposed commitment (not saved) via the agent tool; 503 `AI_UNAVAILABLE` on failure |
| GET | `/api/v1/complaints/{id}/related` | owner, OPERATOR, ADMIN | ranked related cases with evidence |
| GET | `/api/v1/dashboard/recurring` | OPERATOR, ADMIN | cases with `recurring=true`, grouped by location key + category |

`GET /complaints/{id}` now fills `commitments` and `related_cases`. Dashboard summary `recurring` counter and queue tier 3 (missed commitments) go live.

### Frontend

- Case detail (operator): Commitments section — list with status chips (`MISSED` highlighted with icon + text), create form (description, type, due date/time in local time converted to UTC on submit), fulfil/cancel actions, optional "Extract from note" button that proposes fields for confirmation.
- Case detail (citizen): commitments shown read-only in citizen-safe wording ("The department said a technician would visit by 13 Sep, 10:00. This has not been confirmed yet.").
- `RelatedCasePanel` on both case views: reference, title, status, relation label, "matched on location" / "same reporter" explanation, days apart.
- `/dashboard/recurring`: grouped list (location + category → cases), recurrence badge, link to each case.
- Chat: when the agent's reply cites a related case, render a compact related-case card under the message (built from the `related_cases` array in the response, not parsed from text).
- Recurrence indicator on `ComplaintCard` and in the dashboard queue.

## Out of scope (deferred)

Geospatial clustering, map, image similarity (future, §3). Evidence (6).

## Key rules and invariants

- Timestamps: `due_at` stored in UTC; the UI converts from and to local time (§20).
- A `MISSED` commitment is derived deterministically from `due_at` and the absence of a fulfilment event; the model never sets commitment status.
- Recurrence never claims the same location without a `geo_cell` or a non-vague `location_key` match (§20, A13).
- Related-case references in chat come from tool results; the slice 3 guard still strips anything else.

## Tests

Unit:
- `evaluate`: before due → `PENDING`; after due without fulfilment → `MISSED`; `FULFILLED`/`CANCELLED` unchanged.
- `location_key`: "Near ABC Chowk" and "abc chowk k pass" → same key; "yahan" / "near my house" → `None`; punctuation and case are normalised.
- `geo_cell`: points 50 m apart share a cell; 500 m apart do not (at the demo latitude).
- `find_related` ranking: geo > key > same citizen; window boundary (29 vs 31 days); excludes self; vague location yields only same-citizen matches.

Integration:
- A7 / Flow D: commitment due 1 h ago, checker runs → `MISSED`, `COMMITMENT_MISSED` event, one `VERIFY_COMMITMENT` recommendation; second run → no duplicate. Stall detector on the same case now yields `ESCALATE`.
- Fulfil after missed → `FULFILLED`, progress event, `last_progress_at` updated, `stalled` cleared on the next tick.
- A13 / Flow G: create a streetlight case with A1024's location within 30 days → `RECURRENCE` link, `recurring=true`, `RECURRENCE_DETECTED` event, `LINK_RECURRING` recommendation auto-executed; the same with "streetlight kharab hai" and no location → no recurrence claim.
- US-08 (fixture): "Streetlight phir band hai" with location "Street 7 near the park gate" → `find_related_cases` returns A1024; the reply cites A1024 and its current status; response `related_cases` contains A1024.
- Citizen cannot create/fulfil/cancel commitments → 403; citizen commitment DTO omits operator identity.
- `extract` endpoint: fixture returns fields → response is a proposal only, nothing persisted; AI failure → 503 and no commitment.

## Definition of done

- [ ] After `make reset` and one worker tick, A1024 shows a `MISSED` commitment and an `ESCALATE` recommendation whose evidence lists the commitment.
- [ ] Sara can add a commitment to A1025 with a due time, see it `PENDING`, and (with a past due time in a test run) see it turn `MISSED` on the next tick.
- [ ] A1028 shows the recurrence badge and A1024 in its related panel; `/dashboard/recurring` groups them.
- [ ] In chat, "Streetlight phir band hai" plus the Street 7 location produces a reply that names A1024 and shows the related-case card (Scene 8).
- [ ] All tests above pass; `make check` green; CI green.

## Demo checkpoint

Scene 8 (§32) works, and Scenes 5–6 now show the stronger `ESCALATE` recommendation with missed-commitment evidence. The full §32 script is demonstrable end to end.

## Risks and notes

- Roman Urdu location normalisation is heuristic. The stop-list is configuration (`database/seed/recurrence_stopwords.yaml`), and the rule errs toward "no claim" rather than a false match.
- `record_commitment` via AI is P1; the manual form is the acceptance path. If the AI extraction slips, note it in the slice status rather than blocking slice 6.
