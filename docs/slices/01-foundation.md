# Slice 1 — Foundation

Status: Not started
Size: L
Depends on: —
PRD coverage: §8 (architecture), §9 (frontend architecture), §11 (backend architecture), §12 (envelope, base path), §13 (`users`, `audit_logs`), §15 (auth & roles), §19 (canonical errors), §23 (request IDs, health), §26–27 (deployment shape, env vars), §30 (blueprint). US-10 (mechanism), US-11 (fail-safe shape).

## Goal

Stand up the monorepo skeleton so that both apps run against PostgreSQL, a demo user can log in as any of the three personas, every request carries a request ID, every error uses the PRD envelope, and every consequential action has an audit sink. No domain features yet.

## What this slice proves

Infrastructure claims from §36's "final architecture verdict": modular monolith, PostgreSQL as the source of truth, server-side authorisation, and auditability all have a concrete home before any feature is built on them.

## In scope

### Repository layout (PRD §30)

```text
awwaz/
├── README.md                 # replaces the blank README: what Awwaz is, how to run it, links to PRD + slices
├── .env.example              # placeholders only (PRD §27)
├── docker-compose.yml        # postgres:16 for local dev
├── Makefile                  # dev, check, test, seed, reset targets
├── .github/workflows/ci.yml
├── frontend/
├── backend/
├── database/
│   └── seed/                 # YAML config + seed fixtures (filled from slice 2)
└── docs/
    └── slices/
```

### Backend (`backend/`)

- `pyproject.toml` managed by `uv`: fastapi, uvicorn, sqlalchemy>=2, psycopg[binary], alembic, pydantic>=2, pydantic-settings, httpx; dev: pytest, pytest-cov, ruff, mypy.
- `app/main.py`: app factory, router mount at `/api/v1`, middleware order (request ID → logging → error handlers), CORS with credentials for `APP_BASE_URL`.
- `app/core/config.py`: `Settings` via pydantic-settings. Required: `DATABASE_URL`, `APP_BASE_URL`, `BACKEND_BASE_URL`, `AUTH_SECRET`. Flags: `AWWAZ_DEMO_MODE` (default `false`), `AWWAZ_ENV` (`dev|test|prod`).
- `app/core/logging.py`: JSON logs to stdout with `request_id`, `route`, `status`, `duration_ms`. Never logs cookie values, secrets, or full message bodies (§23 "do not log").
- `app/core/errors.py`: `AppError(code, http_status, message, details=None)` and subclasses for every code in §19. Global handlers convert `AppError`, `RequestValidationError` (→ `VALIDATION_ERROR`, 400), and unhandled exceptions (→ `INTERNAL_ERROR`, 500, stack trace server-side only) into the standard error envelope.
- `app/core/envelope.py`: `ok(data, request_id)` → `{"success": true, "data": ..., "meta": {"request_id": ...}}`.
- `app/core/request_id.py`: middleware that echoes an incoming `X-Request-ID` or generates `req_<ulid>`, stores it in a context var, and sets it on the response header.
- `app/core/security.py`: session cookie handling (`awwaz_session`, HttpOnly, SameSite=Lax, Secure when not dev), `current_actor()` dependency returning `Actor(id, role, name)`, `require_roles(*roles)` dependency (→ 403 `FORBIDDEN`), `optional_actor()` for public routes. Missing/expired/revoked session → 401 `UNAUTHORIZED`. Session tokens are random 32-byte URL-safe strings; only the SHA-256 hash is stored.
- `app/db/session.py`: engine + `SessionLocal` + `get_db()` dependency. `app/db/base.py`: declarative base, UUID + `timestamptz` column helpers.
- `alembic/` with `env.py` reading `DATABASE_URL`; revision `0001_foundation`: `users`, `sessions`, `audit_logs`.
- `app/domain/users/service.py`: `get_demo_users()`, `create_session(user)`, `revoke_session(token)`.
- `app/domain/audit/service.py`: `AuditService.record(db, *, actor, action, resource_type, resource_id, request_id, metadata, result)` appending to `audit_logs`. Used by login/logout now; by every consequential mutation in later slices (A10).
- `app/api/routes/health.py`: `GET /health` (process up), `GET /ready` (DB `SELECT 1`; 503 `EXTERNAL_SERVICE_UNAVAILABLE` if it fails).
- `app/api/routes/auth.py`:
  - `POST /api/v1/auth/demo-login` body `{"user_key": "hamza"|"sara"|"bilal"}` → sets cookie, returns actor. Only enabled when `AWWAZ_DEMO_MODE=true`; otherwise 404.
  - `GET /api/v1/auth/me` → current actor.
  - `POST /api/v1/auth/logout` → revokes session, clears cookie.
- `app/api/routes/admin.py`: `POST /api/v1/admin/demo/reset` — ADMIN only, `AWWAZ_DEMO_MODE=true` only (404 otherwise, per §12 "must be disabled in production"). Truncates domain tables and re-runs the seed. In slice 1 the seed contains users only.
- `app/seed.py`: `python -m app.seed` idempotent seed entrypoint (upserts by natural key). Slice 1: four users (Hamza/CITIZEN, Sara/OPERATOR, Bilal/ADMIN, awwaz-worker/SERVICE).
- `app/repositories/users.py`, `app/repositories/audit.py`: persistence only, no policy (§11).

### Frontend (`frontend/`)

- Next.js App Router, TypeScript strict, Tailwind, TanStack Query, zod. `pnpm` lockfile committed.
- `next.config.ts`: rewrite `/api/:path*` → `${BACKEND_BASE_URL}/api/:path*` (D4).
- `src/services/api/client.ts`: typed `apiFetch<T>()` that unwraps the envelope, throws `ApiError{code, message, status, requestId}`, always sends credentials, and forwards a client-generated `X-Request-ID`.
- `src/lib/errors.ts`: §19 status → UI message mapping (401 → redirect to `/login`, 403 → permission state, 404 → not-found state, 409 → "refresh to see the latest state", 429 → "please wait", 503 → "service unavailable", 500 → generic).
- `src/lib/auth/`: `useActor()` hook (TanStack Query on `/auth/me`), `RequireRole` wrapper rendering the permission state instead of children.
- `src/components/layout/`: `AppShell`, `Sidebar`, `TopBar` with role-aware navigation exactly per §10 (Citizen: Report, My Complaints. Operator: Overview, Cases, Approvals, Recurring Issues, Activity. Admin: Configuration, Users, Audit).
- `src/components/ui/`: `Button`, `Card`, `Badge`, `Skeleton`, `EmptyState`, `ErrorState`, `PermissionState` — the shared primitives every page contract (§9) needs.
- Pages (placeholders with real loading/empty/error/permission states, no data yet):
  - `/` citizen landing with the §10 headline, support text, and "Report a Problem" CTA.
  - `/login` demo role picker (three persona cards).
  - `/citizen`, `/citizen/complaints`, `/citizen/complaints/[id]`
  - `/dashboard`, `/dashboard/complaints`, `/dashboard/complaints/[id]`, `/dashboard/approvals`, `/dashboard/recurring`, `/dashboard/activity`
  - `/admin`
- Visual direction per §10: calm, operational, serious. A small design-token file (`src/lib/constants/tokens.ts` + Tailwind theme) for colours, radii, spacing so later slices stay consistent. Status colours are always paired with text (accessibility rule in §10).

### Tooling

- `Makefile`: `make dev` (compose up + backend + frontend), `make migrate`, `make seed`, `make reset`, `make check` (ruff, mypy, pytest, eslint, tsc, next build), `make test`.
- `.github/workflows/ci.yml`: backend job (Postgres service container, `uv sync`, ruff, mypy, pytest) and frontend job (`pnpm install --frozen-lockfile`, lint, tsc, build). This is the §26 "CI/CD minimum".
- `.env.example` listing every variable from §27 plus `AWWAZ_DEMO_MODE`, `AWWAZ_ENV`, `AWWAZ_LLM_MODE`, `LLM_MODEL`, `ANTHROPIC_API_KEY` with placeholder values.

## Out of scope (deferred)

Complaints, routing, events (slice 2). Chat and LLM (slice 3). Worker, adapter, recommendations (slice 4). Rate limiting, uploads, notifications (slice 6).

## Data model added (revision `0001_foundation`)

```text
users            id UUID PK, name, email UNIQUE NULL, role (CITIZEN|OPERATOR|ADMIN|SERVICE), demo_key UNIQUE NULL, created_at, updated_at
sessions         id UUID PK, user_id FK users, token_hash UNIQUE, expires_at, created_at, revoked_at NULL
audit_logs       id UUID PK, actor_id NULL, actor_type (USER|AGENT|WORKER|SYSTEM), action, resource_type, resource_id NULL,
                 request_id, result (SUCCESS|FAILURE), metadata JSONB, created_at
                 index (resource_type, resource_id), index (created_at)
```

## API surface added

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | none | process liveness |
| GET | `/ready` | none | DB check, 503 on failure |
| POST | `/api/v1/auth/demo-login` | none | demo mode only |
| GET | `/api/v1/auth/me` | any | |
| POST | `/api/v1/auth/logout` | any | audited |
| POST | `/api/v1/admin/demo/reset` | ADMIN | demo mode only, audited |

## Key rules and invariants

- Backend enforces authorisation independently of UI controls (F-common "Permissions"). `require_roles` is the only way a route declares access; there are no unguarded mutation routes.
- Every response, success or error, carries `meta.request_id` / `error.request_id`.
- `AWWAZ_DEMO_MODE=false` makes demo-login and demo-reset return 404, not 403, so their existence is not advertised in production.
- Session expiry (default 12 h) is enforced server-side; the cookie's `Max-Age` is a convenience only.

## Tests (must be added in this slice)

Backend (`backend/tests/`), running against a throwaway Postgres database created by a session fixture:
- envelope: success and error shapes match §12 exactly; `request_id` present in both.
- request ID: incoming `X-Request-ID` is echoed; missing one is generated.
- auth: no cookie → 401 `UNAUTHORIZED`; wrong role on an ADMIN route → 403 `FORBIDDEN`; revoked session → 401; expired session → 401.
- demo gating: with `AWWAZ_DEMO_MODE=false`, demo-login and demo-reset return 404.
- audit: login writes one `audit_logs` row with actor, action, request_id, result.
- ready: `/ready` returns 503 with `EXTERNAL_SERVICE_UNAVAILABLE` when the DB check raises (monkeypatched).

Frontend:
- `tsc --noEmit` and `eslint` clean; `next build` succeeds.
- Unit test for `apiFetch` envelope unwrapping and `ApiError` mapping (vitest).

## Definition of done

- [ ] `make dev` starts Postgres, backend, and frontend; `/health` and `/ready` return 200.
- [ ] `make migrate && make seed` creates the schema and four demo users; re-running seed is a no-op.
- [ ] Logging in as each persona via `/login` shows the correct role-specific navigation; logging out returns to `/login`.
- [ ] Every placeholder page renders explicit loading, empty, error, and permission states (verified by visiting as the wrong role).
- [ ] All tests above pass; CI workflow is green on the branch.
- [ ] `README.md` explains setup in under a minute of reading and links to the PRD and slice docs.
- [ ] No secrets in the repo; `.env.example` contains placeholders only.

## Demo checkpoint

Internal only: log in as Sara, see the operator shell with empty states; `curl -i /ready` shows the request ID header. Nothing citizen-facing to show yet beyond the landing page.

## Risks and notes

- Cookie + rewrite behaviour differs between `next dev` and a split production deployment. Both paths (rewrite and CORS-with-credentials) are configured now so the deployment slice does not have to revisit auth.
- Keep the UI primitive set small. Later slices add components; this slice only establishes the shell, tokens, and state components.
