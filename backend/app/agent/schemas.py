from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime, timezone


class ExtractionResult(BaseModel):
    intent: str = Field(..., description="E.g. CREATE_COMPLAINT, INQUIRE_STATUS, PROVIDE_LOCATION, GENERAL_CHAT")
    category: str = Field(..., description="Civic category enum")
    title: str = Field(..., description="Concise case title")
    description: str = Field(..., description="Detailed issue description")
    location_text: Optional[str] = Field(None, description="Reported location or nearby landmark")
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    priority: str = Field("MEDIUM", description="LOW, MEDIUM, HIGH, CRITICAL")
    missing_fields: List[str] = Field(default_factory=list, description="List of missing required fields, e.g. location")
    confidence: float = Field(..., ge=0.0, le=1.0)


class AgentTraceStep(BaseModel):
    step: int
    action: str
    tool_name: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class AgentResponse(BaseModel):
    reply_text: str
    intent: str
    category: Optional[str] = None
    clarification_required: bool = False
    missing_fields: List[str] = Field(default_factory=list)
    complaint_id: Optional[str] = None
    complaint_title: Optional[str] = None
    department_name: Optional[str] = None
    trace: List[AgentTraceStep] = Field(default_factory=list)
