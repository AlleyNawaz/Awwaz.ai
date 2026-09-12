# Awwaz

**Existing systems collect complaints. Awwaz works on what happens next.**

Awwaz is an AI civic agent that turns natural-language complaints (English, Urdu, Roman Urdu) into persistent, auditable workflows and keeps working on the next required action: understanding, structuring, routing, tracking responsibility, detecting stalled cases, recommending follow-up or escalation, and executing approved actions through a replaceable civic-service adapter.

Awwaz is not a replacement for existing complaint portals. It is the operational layer around a complaint after submission.

## Documents

- [`Awwaz_Full_PRD.md`](Awwaz_Full_PRD.md) — full implementation-ready product requirements (hackathon MVP v1.0).
- [`docs/slices/README.md`](docs/slices/README.md) — the PRD broken into six implementation slices, with the decision log and acceptance mapping.

## Implementation slices

| # | Slice | Status |
|---|-------|--------|
| 1 | [Foundation](docs/slices/01-foundation.md) | Not started |
| 2 | [Complaint domain & operator surface](docs/slices/02-complaint-domain-and-operator-surface.md) | Not started |
| 3 | [Agent intake](docs/slices/03-agent-intake.md) | Not started |
| 4 | [Stall → Recommend → Approve → Act](docs/slices/04-stall-recommend-approve-act.md) | Not started |
| 5 | [Commitments, memory & recurrence](docs/slices/05-commitments-memory-recurrence.md) | Not started |
| 6 | [Evidence, notifications, hardening & demo](docs/slices/06-evidence-notifications-hardening-demo.md) | Not started |

## Stack (planned)

Next.js + TypeScript frontend, FastAPI + Python backend, PostgreSQL, a lightweight scheduled worker, Anthropic Claude for language understanding, and a mock civic-service adapter behind a replaceable interface. Setup instructions arrive with slice 1.
