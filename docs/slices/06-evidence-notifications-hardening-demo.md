# Slice 6 — Evidence, Notifications, Hardening & Demo

Status: Not started
Size: M
Depends on: Slice 5
PRD coverage: F15 (evidence upload), F21 (notifications), F22 (admin configuration, read-only). §10 accessibility, §12 evidence/rate limits, §13 `evidence`, §16 (file upload, rate limits, dependency safety), §19 error mapping audit, §21 performance targets, §23 metrics, §25 (security tests, E2E critical path, demo regression), §26 (deployment order), §32 (demo script), Appendix G (backup plan), Appendix I (final checklist). Acceptance: re-verification of A1–A15 via E2E.

## Goal

Close the remaining P1 features (evidence, notifications), apply the security controls the PRD lists but earlier slices deferred (rate limits, upload validation, security test matrix), audit every page's states and accessibility, and make the demo repeatable: a reset script, an end-to-end test that walks the exact §32 path, a runbook with the backup plan, and deployment notes.

## What this proves

"Safe failure behaviour" (§33 item 8) across every boundary, and that the demo can be run cold from a fresh database in a fixed number of steps. The Appendix I checklist is completed here.

## In scope

### Evidence (F15)

- `integrations/storage/interface.py`: `StorageService` with `put(key, stream, mime) -> StoredObject`, `open(key) -> stream`, `delete(key)`, `exists(key)`. `local.py`: `LocalDiskStorage` rooted at `STORAGE_LOCAL_PATH` (default `backend/var/evidence`, git-ignored). S3-compatible implementation is a documented follow-up using the same interface (D6). `factory.py` selects by `STORAGE_BACKEND=local|s3`.
- `domain/evidence/service.py`: `attach(db, actor, complaint_id, upload)`: owner or OPERATOR/ADMIN; validation before any persistence (§20 "too large"): MIME allow-list `image/jpeg, image/png, image/webp` verified by magic bytes as well as declared type; size ≤ `EVIDENCE_MAX_BYTES` (default 5 MiB); ≤ `EVIDENCE_MAX_PER_CASE` (default 5); server-generated storage key `evidence/{complaint_id}/{uuid}.{ext}` (never the client filename); SHA-256 recorded; `EVIDENCE_ADDED` event (non-progress); audit. `get(db, actor, evidence_id)` enforces the same visibility as the case (A11 for files).
- API: `POST /api/v1/complaints/{id}/evidence` (multipart, field `file`), `GET /api/v1/evidence/{id}` (streams the object with `Content-Disposition: inline`, correct MIME, `Cache-Control: private`). Errors: `VALIDATION_ERROR` for type/size/count, `STORAGE_FAILURE` (503) if the backend write fails, with no `evidence` row written.
- Frontend: `EvidenceUploader` in the chat composer attachment action and on both case views (citizen: own case only; operator: any). Client-side pre-checks for size/type mirror the server rules but the server remains authoritative. Evidence section on case detail with thumbnails and alt text derived from the case title (§10 accessibility).
- Seed: A1026 gets one generated placeholder PNG (drawn at seed time with Pillow, no binary committed).

### Notifications (F21)

- `notifications` table and `NotificationService.notify(db, user_id, type, title, body, complaint_id)`. Triggers: complaint created (citizen), status changed (citizen), recommendation created (all operators), external action confirmed/failed (approving operator + citizen in citizen-safe wording), commitment missed (operators). In-app only (§18).
- API: `GET /api/v1/notifications` (own, newest first, `unread_only`), `POST /api/v1/notifications/{id}/read`, `POST /api/v1/notifications/read-all`.
- Frontend: bell in `TopBar` with unread count (polling via TanStack Query every 30 s), dropdown list, links to the case. Screen-reader announcement (`aria-live=polite`) when a new notification arrives.

### Rate limiting (D12, §12, §16)

- `core/ratelimit.py`: in-memory token bucket keyed by actor ID (or client IP for anonymous routes), pluggable store interface so Redis can replace it later. Applied as dependencies: chat messages 20/min per user, evidence upload 10/min per user, approval/reject/retry 30/min per operator, demo-login 10/min per IP, admin routes 10/min per actor. Exceeding → 429 `RATE_LIMITED` with `Retry-After`. Frontend maps 429 to the §19 wait message.

### Security hardening (§16, §25 "Security tests")

- Test matrix added to `backend/tests/security/`:
  - IDOR: every citizen-visible resource (complaint, timeline, commitments, related, evidence, conversation, trace) for another citizen's case → 404; operator routes as CITIZEN → 403.
  - Unauthorised approval: CITIZEN and AGENT/SERVICE actors → 403; no session → 401.
  - Malicious upload: `.png` extension with HTML bytes → rejected; SVG → rejected; correct PNG → accepted.
  - Oversized upload: 5 MiB + 1 byte → 400 before any storage write (assert storage mock untouched).
  - Rate limit: 21st chat message in a minute → 429.
  - Prompt injection: slice 3 test re-run in this matrix; plus an injection that asks the agent to read another citizen's case by reference → `get_current_case` returns not-found for that actor.
  - Duplicate action: slice 4 idempotency test re-run in this matrix.
- Response hardening: security headers middleware (`X-Content-Type-Options`, `Referrer-Policy`, `Content-Security-Policy` for the API responses, frame denial); user and model text is only ever rendered as text in React (no `dangerouslySetInnerHTML` anywhere; lint rule enforces it).
- Logging audit: grep-based test that no logger call includes `content=`, `cookie`, `authorization`, or `ANTHROPIC_API_KEY`; the LLM client logs token counts and latency only.
- Dependency audit: `pip-audit` and `pnpm audit --prod` run in CI as a non-blocking job with output attached (§16 "if tooling is available").

### Admin, read-only (F22, P2)

- `/admin` → Configuration: departments with escalation chains, routing rules with thresholds, global thresholds (`STALL_THRESHOLD_HOURS`, `RECURRENCE_WINDOW_DAYS`, `AGENT_MIN_CONFIDENCE`), current adapter and LLM mode (never the key). `/admin/users`: seeded users and roles. `/admin/audit`: paginated audit log with filters (actor, action, resource). Backing endpoints: `GET /api/v1/admin/config`, `GET /api/v1/admin/users`, `GET /api/v1/admin/audit` (ADMIN only). No write endpoints in MVP; the doc states this explicitly on the page.

### Polish and page-contract audit (§9, §10, §21)

- Walk every route as each persona and record loading / empty / error / permission / success states in `docs/page-states.md` (a table; any missing state is fixed in this slice).
- Accessibility pass: semantic headings per page, keyboard path through chat → case → approval dialog, visible focus rings, labelled controls, alt text, status conveyed by icon + text + colour, `aria-live` regions for mutation success/failure toasts, dialog focus trap and Escape to close.
- Responsive check at 375 px and 1280 px for citizen chat, case list, dashboard, approvals.
- Performance sanity: list endpoints paginated (already), dashboard summary and queue fetched independently (§21), agent context size logged per run, no duplicate identical requests on page load (React Query keys reviewed).

### Observability (§23)

- `GET /metrics` (ADMIN or SERVICE): JSON counters for the §23 list (`complaints_created`, `complaints_routed`, `complaints_stalled`, `commitments_created`, `commitments_missed`, `recommendations_created/approved/rejected`, `external_actions_succeeded/failed`, `ai_errors`, `average_case_age_hours`), computed from the database so they survive restarts.
- `/ready` extended to check the storage path is writable.

### Demo and deployment (§25, §26, §32, Appendix G)

- `scripts/demo_reset.sh`: resets the database, reseeds, runs one worker tick, prints the reference table and the persona login hints. `make demo` wraps it.
- `frontend/e2e/demo-path.spec.ts` (Playwright, Chromium, fixture LLM mode, mock adapter): logs in as Hamza → sends the Roman Urdu message → answers the location → asserts the case card → opens the trace → logs in as Sara → opens A1024 → sees stalled + recommendation → approves → asserts `ESCALATED` and the confirmed external reference in the timeline → logs back in as Hamza → sends "Streetlight phir band hai" with the location → asserts the related-case card names A1024. Runs in CI against the compose stack. This is the §25 "E2E critical path" and the "demo regression".
- `docs/demo-runbook.md`: Scenes 1–8 with the exact text to type, the expected screen after each step, timing notes, the environment toggles (`AWWAZ_LLM_MODE`, `CIVIC_MOCK_MODE`, `STALL_THRESHOLD_HOURS`), and the Appendix G backup decision tree (model fails → fixture; adapter fails → show the failed state truthfully; DB fails → static snapshot and say so; network fails → local build).
- `docs/deployment.md`: §26 order (database → backend → `/ready` → seed → frontend → E2E), env var table from §27 with the D1 rename, split-deployment CORS notes, and a "do not enable in production" list (`AWWAZ_DEMO_MODE`, `run-worker`, `demo/reset`).
- `README.md` final pass: positioning statements from §36, architecture diagram from §8, quick start, runbook link.

## Out of scope

Real S3 wiring (interface ready), email/SMS/WhatsApp, map, Urdu script UI, voice, public transparency view, multi-tenancy (§3 future list).

## Persistence (revision `0006_evidence_notifications`)

```text
evidence          id UUID PK, complaint_id FK, storage_key TEXT UNIQUE, original_name VARCHAR, mime_type, size_bytes INT,
                  sha256 VARCHAR, uploaded_by FK users, created_at
                  index (complaint_id)
notifications     id UUID PK, user_id FK users, type, title, body TEXT, complaint_id FK NULL, read_at NULL, created_at
                  index (user_id, read_at, created_at)
```

## Key rules and invariants

- Upload validation happens entirely before any storage or database write; a rejected upload leaves no trace except an audit `EVIDENCE_REJECTED` row.
- Evidence visibility equals case visibility. There is no unauthenticated download URL.
- Rate limits are enforced server-side; the UI's disabled states are conveniences.
- The E2E test uses fixture mode so CI never needs a model key, and the trace visibly says so.

## Tests

- Evidence: valid PNG/JPEG/WebP accepted with correct SHA-256 and storage key format; declared `image/png` with non-PNG bytes rejected; 6th file rejected; citizen uploading to another citizen's case → 404; operator download of any case works; storage failure → 503 `STORAGE_FAILURE` and no row.
- Notifications: each trigger creates the expected rows for the expected users; citizen wording never includes operator names; read/unread transitions; a user cannot read another user's notifications.
- Rate limit: bucket refill timing; 429 body and `Retry-After`; limits keyed per actor, not global.
- Security matrix (listed above) passes in full.
- Metrics: counters match seeded data after reset + one tick.
- Playwright E2E demo path passes locally and in CI.
- Existing slice tests remain green (no regressions from the rate limiter or headers).

## Definition of done

- [ ] `make demo` from an empty database produces a system where the runbook can be followed verbatim, Scenes 1–8, in under five minutes.
- [ ] Playwright demo-path test is green locally and in CI.
- [ ] Security matrix green; `pip-audit`/`pnpm audit` results reviewed and either clean or documented.
- [ ] `docs/page-states.md` has every route × persona with all five states verified.
- [ ] Keyboard-only walkthrough of chat → case → approval works; screen reader announces mutation results.
- [ ] Bell shows notifications for the citizen after a status change and for the operator after a recommendation.
- [ ] Evidence upload works from chat and case detail; invalid files show the actionable error.
- [ ] `/admin` shows configuration, users, and audit log read-only.
- [ ] Appendix I checklist fully ticked in `docs/slices/README.md`.
- [ ] `make check` green; CI green.

## Demo checkpoint

The complete §32 script, plus every Appendix G backup path, is rehearsed and documented. Definition of done from §35 is met: a judge can send a complaint, watch Awwaz interpret it, see a case created and routed, inspect the timeline, observe a stalled case, see a recommendation, approve an action, see the simulated external confirmation, see the audit trail, and see memory in a second interaction.

## Risks and notes

- R5 (demo network failure) and R11 (deployment issue) are addressed by the fixture mode, the local compose stack, and deploying before this slice ends so the E2E test runs against the deployed target at least once (§25 "demo regression").
- Keep this slice honest about what is read-only (admin) and what is simulated (adapter, fixture) in the UI itself, per R9 (overclaiming).
