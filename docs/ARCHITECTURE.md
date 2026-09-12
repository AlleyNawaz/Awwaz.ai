# Awwaz — Technical Architecture Specification

This document details the architectural principles, domain layers, state machines, security boundaries, and data models implemented in **Awwaz**.

---

## 1. Architectural Philosophy: The Modular Monolith

Per PRD Section 6, Awwaz avoids unnecessary microservices, distributed transactions, or service meshes in favor of a clean, well-bounded **Modular Monolith**:
- **Unified Domain Models**: High cohesion, low coupling within clear domain boundaries.
- **Synchronous Guarantees**: Transactional consistency with ACID SQLite/Postgres.
- **Asynchronous Isolation**: Deterministic background workers for SLA evaluations.
- **Adapter Layer**: Clean interfaces decoupling internal domain logic from external civic platforms, AI models, and storage providers.

---

## 2. Core Operational Loop

The system implements the 10-step lifecycle defined in the PRD:

```
┌─────────────┐
│ 1. Citizen  │ Natural language input (English, Urdu, Roman Urdu)
│   Message   │
└──────┬──────┘
       ▼
┌─────────────┐
│ 2. NLP      │ Structured extraction (category, severity, location, missing fields)
│ Interpreter │
└──────┬──────┘
       ▼
┌─────────────┐
│ 3. Missing  │
│ Information?│──► (Yes) ──► Clarification requested from citizen
└──────┬──────┘
       │ (No)
       ▼
┌─────────────┐
│ 4. Complaint│ Canonical case created in database
│  Creation   │
└──────┬──────┘
       ▼
┌─────────────┐
│ 5. Routing  │ Assigned to department (e.g. WASA, IESCO, Sanitation)
│   Engine    │
└──────┬──────┘
       ▼
┌─────────────┐
│ 6. Timeline │ Append-only event stream (COMPLAINT_CREATED, ROUTED, ASSIGNED)
│  Recording  │
└──────┬──────┘
       ▼
┌─────────────┐
│ 7. SLA &    │ Background worker checks idle threshold (>72h) & missed commitments
│ Stall Check │
└──────┬──────┘
       ▼
┌─────────────┐
│ 8. Grounded │ System synthesizes factual recommendation citing recorded timestamps
│  Recommend  │
└──────┬──────┘
       ▼
┌─────────────┐
│ 9. Human    │ Security boundary: Operator reviews evidence and explicitly authorizes
│  Approval   │
└──────┬──────┘
       ▼
┌─────────────┐
│ 10. External│ Pluggable adapter executes action; returns external reference
│   Action    │
└──────┬──────┘
       ▼
┌─────────────┐
│ 11. State & │ Case moves to ESCALATED/IN_PROGRESS; immutable audit log written;
│  Recurrence │ Subsequent complaints evaluated for recurring patterns
└─────────────┘
```

---

## 3. Strict 10-State Complaint Lifecycle

Awwaz strictly rejects unvalidated free-form statuses. State transitions are governed by an explicit state transition matrix with optimistic concurrency locking:

### Canonical States:
1. `REPORTED`: Initial intake received from citizen.
2. `SUBMITTED`: Formally registered into municipal processing queue.
3. `ACKNOWLEDGED`: Acknowledged by intake authority.
4. `ASSIGNED`: Assigned to responsible department coordinator.
5. `IN_PROGRESS`: Operational remediation actively underway.
6. `WAITING_FOR_CITIZEN`: Follow-up evidence or confirmation requested from citizen.
7. `RESOLVED`: Field remediation completed by department.
8. `CLOSED`: Case verified and closed.
9. `ESCALATION_PENDING`: Escalation recommendation approved; awaiting adapter execution.
10. `ESCALATED`: Formally escalated to higher supervisory tier.

### Legal State Transitions:
```
REPORTED          ──► SUBMITTED
SUBMITTED         ──► ACKNOWLEDGED, ASSIGNED
ACKNOWLEDGED      ──► ASSIGNED, IN_PROGRESS
ASSIGNED          ──► IN_PROGRESS, ESCALATION_PENDING
IN_PROGRESS       ──► WAITING_FOR_CITIZEN, RESOLVED, ESCALATION_PENDING
WAITING_FOR_CITIZEN──► IN_PROGRESS, RESOLVED
ESCALATION_PENDING──► ESCALATED, IN_PROGRESS
ESCALATED         ──► IN_PROGRESS, RESOLVED
RESOLVED          ──► CLOSED, IN_PROGRESS
CLOSED            ──► (Terminal)
```

Any attempt to execute an invalid transition (e.g., `REPORTED` directly to `RESOLVED`, or `CLOSED` to `ESCALATED`) immediately triggers a `400 InvalidStateTransitionException` and is logged to the audit repository.

---

## 4. Human-in-the-Loop Security Boundary

```
  ┌─────────────────────────────────────────────────────────────┐
  │                      SECURITY BOUNDARY                      │
  │                                                             │
  │   [AI Recommendation Engine]                                │
  │   - Proposes action (e.g. ESCALATE, NOTICE)                 │
  │   - Cites factual evidence from database                    │
  │   - CANNOT mutate case status directly                      │
  │   - CANNOT execute external tools directly                  │
  │                             │                               │
  │                             ▼                               │
  │   [Database Recommendation Record] (status = PENDING)       │
  │                             │                               │
  │                             ▼                               │
  │   [Human Operator Authentication & Authorization Check]     │
  │   - Role validation (OPERATOR or ADMIN)                     │
  │   - Optimistic lock verification (expected_version check)   │
  │   - Idempotency key validation                              │
  │                             │                               │
  │             ┌───────────────┴───────────────┐               │
  │             ▼                               ▼               │
  │       [REJECTED]                       [APPROVED]           │
  │      Audit logged                   civic_adapter.execute() │
  │                                             │               │
  │                                             ▼               │
  │                                   [External Confirmed?]     │
  │                                     ├── Yes: Update status  │
  │                                     └── No:  Preserve state │
  └─────────────────────────────────────────────────────────────┘
```

---

## 5. Civic Service Adapter Contract

The external civic integration is abstracted behind the `CivicServiceAdapter` interface:

```typescript
interface CivicServiceAdapter {
  submitCase(input: SubmitCaseInput): Promise<SubmitCaseResult>;
  requestFollowUp(input: FollowUpInput): Promise<FollowUpResult>;
  escalateCase(input: EscalateCaseInput): Promise<EscalateResult>;
}
```

### Truthful UI Execution Guarantee:
- If the adapter returns `success: false` or times out, the case status **is not modified**.
- A `ComplaintEventModel(event_type="EXTERNAL_ACTION_FAILED")` is appended to the case timeline.
- The UI surfaces the error with actionable retry controls, strictly upholding PRD Rule 9: *Never display 'Escalated successfully' unless confirmed by the underlying adapter.*

---

## 6. Database Relational Entities

Awwaz enforces transactional data integrity across 11 core entities in SQLAlchemy:

1. **`users`**: System actors with strict RBAC roles (`CITIZEN`, `OPERATOR`, `ADMIN`, `SERVICE`).
2. **`conversations`**: Natural language intake sessions linked to citizens.
3. **`messages`**: Chronological messages within a conversation with role tags.
4. **`complaints`**: Authoritative complaint record with optimistic `version` field, location, category, and responsibility chain.
5. **`complaint_events`**: Append-only audit timeline of all case milestones.
6. **`departments`**: Municipal routing definitions, SLAs, and escalation targets.
7. **`recommendations`**: Factually grounded AI/Worker proposals pending operator review.
8. **`approvals`**: Cryptographically verifiable operator approval records with external references.
9. **`commitments`**: Formal promises (e.g. technician visit) with due dates in UTC.
10. **`evidence`**: Authenticated media records with SHA256 checksums and MIME validation.
11. **`audit_logs`**: Immutable security audit trail recording actor, IP, request ID, and changes.

---

## 7. Recurrence & Neighborhood Memory

When a new complaint is filed:
1. The location string is tokenized and stripped of civic noise (e.g. `street`, `near`, `chowk`, `sector`).
2. A database query retrieves active or resolved complaints in the same category within a 30-day window.
3. Overlapping civic location tokens are scored.
4. If a match is detected, the case links to the parent issue and labels it as a **Potential Recurrence** without overwriting historical records.
