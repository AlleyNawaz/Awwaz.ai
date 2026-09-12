from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
from pydantic import BaseModel


class SubmitCaseInput(BaseModel):
    complaint_id: str
    category: str
    title: str
    description: str
    location_text: str
    priority: str
    department_name: Optional[str] = None


class SubmitCaseResult(BaseModel):
    success: bool
    external_reference: Optional[str] = None
    received_at: Optional[str] = None
    message: str
    error_code: Optional[str] = None


class EscalateCaseInput(BaseModel):
    complaint_id: str
    external_reference: Optional[str] = None
    target_role: str
    reason: str
    evidence: list
    idempotency_key: str


class EscalateCaseResult(BaseModel):
    success: bool
    external_reference: Optional[str] = None
    escalation_tier: Optional[str] = None
    received_at: Optional[str] = None
    message: str
    error_code: Optional[str] = None


class FollowUpInput(BaseModel):
    complaint_id: str
    external_reference: Optional[str] = None
    instructions: str


class FollowUpResult(BaseModel):
    success: bool
    external_reference: Optional[str] = None
    received_at: Optional[str] = None
    message: str
    error_code: Optional[str] = None


class CivicServiceAdapter(ABC):
    @abstractmethod
    async def submit_case(self, data: SubmitCaseInput) -> SubmitCaseResult:
        pass

    @abstractmethod
    async def request_follow_up(self, data: FollowUpInput) -> FollowUpResult:
        pass

    @abstractmethod
    async def escalate_case(self, data: EscalateCaseInput) -> EscalateCaseResult:
        pass
