from typing import Dict, List, Set
from app.domain.complaints.entities import ComplaintStatus
from app.core.errors import InvalidStateTransitionException

# Authoritative transition rules
ALLOWED_TRANSITIONS: Dict[str, Set[str]] = {
    ComplaintStatus.REPORTED: {
        ComplaintStatus.SUBMITTED,
    },
    ComplaintStatus.SUBMITTED: {
        ComplaintStatus.ACKNOWLEDGED,
        ComplaintStatus.ASSIGNED,
    },
    ComplaintStatus.ACKNOWLEDGED: {
        ComplaintStatus.ASSIGNED,
    },
    ComplaintStatus.ASSIGNED: {
        ComplaintStatus.IN_PROGRESS,
        ComplaintStatus.ESCALATION_PENDING,
    },
    ComplaintStatus.IN_PROGRESS: {
        ComplaintStatus.WAITING_FOR_CITIZEN,
        ComplaintStatus.RESOLVED,
        ComplaintStatus.ESCALATION_PENDING,
    },
    ComplaintStatus.WAITING_FOR_CITIZEN: {
        ComplaintStatus.IN_PROGRESS,
        ComplaintStatus.RESOLVED,
    },
    ComplaintStatus.ESCALATION_PENDING: {
        ComplaintStatus.ESCALATED,
        ComplaintStatus.IN_PROGRESS,
    },
    ComplaintStatus.ESCALATED: {
        ComplaintStatus.IN_PROGRESS,
        ComplaintStatus.RESOLVED,
    },
    ComplaintStatus.RESOLVED: {
        ComplaintStatus.CLOSED,
        ComplaintStatus.IN_PROGRESS,  # Reopened if recurring or incomplete
    },
    ComplaintStatus.CLOSED: set(),  # Terminal state
}


def can_transition(current_status: str, target_status: str) -> bool:
    """Check whether a transition between statuses is legally permitted."""
    allowed = ALLOWED_TRANSITIONS.get(current_status, set())
    return target_status in allowed


def validate_transition(current_status: str, target_status: str) -> None:
    """Raise InvalidStateTransitionException if transition is disallowed."""
    if not can_transition(current_status, target_status):
        raise InvalidStateTransitionException(
            current_state=current_status,
            target_state=target_status,
        )
