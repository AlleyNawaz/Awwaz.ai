import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Text,
    Boolean,
    Integer,
    Float,
    DateTime,
    ForeignKey,
    JSON,
    Index,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from app.repositories.database import Base


def utcnow():
    return datetime.now(timezone.utc)


def to_utc(dt: datetime) -> datetime:
    if dt is None:
        return datetime.now(timezone.utc)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def generate_uuid():
    return str(uuid.uuid4())


class UserModel(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    role = Column(String(30), nullable=False, default="CITIZEN", index=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    complaints = relationship("ComplaintModel", back_populates="citizen")
    conversations = relationship("ConversationModel", back_populates="citizen")


class DepartmentModel(Base):
    __tablename__ = "departments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), unique=True, nullable=False)
    category = Column(String(50), nullable=False, index=True)
    active = Column(Boolean, default=True, nullable=False)
    escalation_target_id = Column(String(36), nullable=True)
    responsibility_chain = Column(JSON, default=list, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    complaints = relationship("ComplaintModel", back_populates="department")


class ConversationModel(Base):
    __tablename__ = "conversations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    citizen_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    metadata_json = Column("metadata", JSON, default=dict, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    citizen = relationship("UserModel", back_populates="conversations")
    messages = relationship("MessageModel", back_populates="conversation", order_by="MessageModel.created_at")


class MessageModel(Base):
    __tablename__ = "messages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    conversation_id = Column(String(36), ForeignKey("conversations.id"), nullable=False, index=True)
    sender_type = Column(String(20), nullable=False)  # CITIZEN, AGENT, SYSTEM
    content = Column(Text, nullable=False)
    metadata_json = Column("metadata", JSON, default=dict, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)

    conversation = relationship("ConversationModel", back_populates="messages")


class ComplaintModel(Base):
    __tablename__ = "complaints"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    external_reference = Column(String(50), nullable=True, index=True)
    citizen_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    department_id = Column(String(36), ForeignKey("departments.id"), nullable=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(50), nullable=False, index=True)
    priority = Column(String(20), nullable=False, default="MEDIUM", index=True)
    status = Column(String(30), nullable=False, default="REPORTED", index=True)
    responsibility_type = Column(String(50), nullable=False, default="DEPARTMENT")
    responsibility_name = Column(String(100), nullable=True)
    location_text = Column(Text, nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    normalized_location = Column(String(100), nullable=True, index=True)
    stalled = Column(Boolean, default=False, nullable=False, index=True)
    version = Column(Integer, default=1, nullable=False)
    last_progress_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    citizen = relationship("UserModel", back_populates="complaints")
    department = relationship("DepartmentModel", back_populates="complaints")
    events = relationship("ComplaintEventModel", back_populates="complaint", order_by="ComplaintEventModel.created_at")
    recommendations = relationship("RecommendationModel", back_populates="complaint")
    commitments = relationship("CommitmentModel", back_populates="complaint")
    evidence_items = relationship("EvidenceModel", back_populates="complaint")

    __table_args__ = (
        Index("ix_complaints_status_priority", "status", "priority"),
        Index("ix_complaints_category_location", "category", "normalized_location"),
    )


class ComplaintEventModel(Base):
    __tablename__ = "complaint_events"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    complaint_id = Column(String(36), ForeignKey("complaints.id"), nullable=False, index=True)
    event_type = Column(String(50), nullable=False, index=True)
    actor_type = Column(String(20), nullable=False)  # CITIZEN, OPERATOR, ADMIN, AGENT, SYSTEM
    actor_id = Column(String(36), nullable=True)
    payload = Column(JSON, default=dict, nullable=False)
    request_id = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)

    complaint = relationship("ComplaintModel", back_populates="events")

    __table_args__ = (
        Index("ix_events_complaint_created", "complaint_id", "created_at"),
    )


class RecommendationModel(Base):
    __tablename__ = "recommendations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    complaint_id = Column(String(36), ForeignKey("complaints.id"), nullable=False, index=True)
    type = Column(String(50), nullable=False, index=True)  # ESCALATE, FOLLOW_UP, VERIFY_COMMITMENT, etc.
    status = Column(String(30), nullable=False, default="PENDING", index=True)  # PENDING, APPROVED, REJECTED, EXECUTED, FAILED
    reason = Column(Text, nullable=False)
    evidence = Column(JSON, default=list, nullable=False)
    requires_approval = Column(Boolean, default=True, nullable=False)
    incident_key = Column(String(100), nullable=True, index=True)  # To avoid duplicate recommendations
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    complaint = relationship("ComplaintModel", back_populates="recommendations")
    approvals = relationship("ApprovalModel", back_populates="recommendation")


class ApprovalModel(Base):
    __tablename__ = "approvals"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    recommendation_id = Column(String(36), ForeignKey("recommendations.id"), nullable=False, index=True)
    approver_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    decision = Column(String(20), nullable=False)  # APPROVED, REJECTED
    reason = Column(Text, nullable=True)
    idempotency_key = Column(String(100), nullable=True, index=True)
    external_reference = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    recommendation = relationship("RecommendationModel", back_populates="approvals")
    approver = relationship("UserModel")


class CommitmentModel(Base):
    __tablename__ = "commitments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    complaint_id = Column(String(36), ForeignKey("complaints.id"), nullable=False, index=True)
    source_event_id = Column(String(36), nullable=True)
    description = Column(Text, nullable=False)
    commitment_type = Column(String(30), nullable=False, default="VISIT")  # VISIT, CALL, INSPECTION, REPAIR
    due_at = Column(DateTime(timezone=True), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="PENDING", index=True)  # PENDING, FULFILLED, MISSED, CANCELLED
    fulfilled_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    complaint = relationship("ComplaintModel", back_populates="commitments")


class EvidenceModel(Base):
    __tablename__ = "evidence"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    complaint_id = Column(String(36), ForeignKey("complaints.id"), nullable=False, index=True)
    storage_key = Column(Text, nullable=False)
    filename = Column(String(255), nullable=False)
    mime_type = Column(String(50), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    sha256 = Column(String(64), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    complaint = relationship("ComplaintModel", back_populates="evidence_items")


class AuditLogModel(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    actor_id = Column(String(36), nullable=True, index=True)
    actor_type = Column(String(30), nullable=False, index=True)  # CITIZEN, OPERATOR, ADMIN, SERVICE, AGENT
    action = Column(String(100), nullable=False, index=True)
    resource_type = Column(String(50), nullable=False, index=True)
    resource_id = Column(String(36), nullable=True, index=True)
    request_id = Column(String(50), nullable=True)
    metadata_json = Column("metadata", JSON, default=dict, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)
