import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.repositories.database import AsyncSessionLocal, init_db
from app.repositories.models import (
    UserModel,
    DepartmentModel,
    ComplaintModel,
    ComplaintEventModel,
    RecommendationModel,
    CommitmentModel,
    EvidenceModel,
    AuditLogModel,
    ConversationModel,
    MessageModel,
)
from app.domain.complaints.entities import (
    ComplaintStatus,
    Priority,
    ComplaintCategory,
    EventType,
    RecommendationType,
    RecommendationStatus,
    CommitmentStatus,
)
from app.domain.routing.mappings import DEFAULT_DEPARTMENTS
from app.domain.recurrence.service import RecurrenceService


async def seed_database(session: Optional[AsyncSession] = None) -> dict:
    should_close = False
    if session is None:
        await init_db()
        session = AsyncSessionLocal()
        should_close = True

    try:
        now = datetime.now(timezone.utc)

        # 1. Clear previous records cleanly to restore deterministic state
        demo_user_ids = ["user_citizen_tariq", "user_operator_fatima", "user_admin_bilal"]

        # Delete dependent rows first
        await session.execute(delete(EvidenceModel))
        await session.execute(delete(CommitmentModel))
        await session.execute(delete(RecommendationModel))
        await session.execute(delete(ComplaintEventModel))
        await session.execute(delete(ComplaintModel))
        await session.execute(delete(MessageModel))
        await session.execute(delete(ConversationModel))
        await session.execute(delete(UserModel).where(UserModel.id.in_(demo_user_ids)))
        await session.commit()

        # 2. Seed Users
        citizen = UserModel(
            id="user_citizen_tariq",
            name="Tariq Mahmood",
            email="tariq@awwaz.ai",
            role="CITIZEN",
        )
        operator = UserModel(
            id="user_operator_fatima",
            name="Fatima Noor",
            email="fatima@awwaz.ai",
            role="OPERATOR",
        )
        admin = UserModel(
            id="user_admin_bilal",
            name="Bilal Khan",
            email="bilal@awwaz.ai",
            role="ADMIN",
        )
        session.add_all([citizen, operator, admin])
        await session.commit()

        # 3. Seed Departments if missing
        dept_map = {}
        for cat, config in DEFAULT_DEPARTMENTS.items():
            res = await session.execute(select(DepartmentModel).where(DepartmentModel.category == cat))
            dept = res.scalar_one_or_none()
            if not dept:
                dept = DepartmentModel(
                    name=config["name"],
                    category=cat,
                    active=True,
                    escalation_target_id=config["escalation_target"],
                    responsibility_chain=config["responsibility_chain"],
                )
                session.add(dept)
                await session.flush()
            dept_map[cat] = dept

        await session.commit()

        # 4. Seed Deterministic Cases
        # Case A1011 (historical resolved garbage case for recurrence context)
        c1011 = ComplaintModel(
            id="A1011",
            citizen_id=citizen.id,
            department_id=dept_map[ComplaintCategory.SANITATION].id,
            title="Commercial dumpster overflow (Previous Month)",
            description="Garbage overflowing into market walkway.",
            category=ComplaintCategory.SANITATION,
            priority=Priority.MEDIUM,
            status=ComplaintStatus.RESOLVED,
            responsibility_type="DEPARTMENT_ROLE",
            responsibility_name="Sanitation Area Supervisor",
            location_text="Block B Commercial Market, Sector I-8, Islamabad",
            normalized_location=RecurrenceService.normalize_location("Block B Commercial Market, Sector I-8, Islamabad"),
            stalled=False,
            version=3,
            created_at=now - timedelta(days=28),
            last_progress_at=now - timedelta(days=26),
        )
        session.add(c1011)

        # Case A1024: Stalled broken streetlight (>72h idle, missed commitment, ESCALATE recommendation)
        time_72h_ago = now - timedelta(hours=73)
        c1024 = ComplaintModel(
            id="A1024",
            external_reference="CIVIC-81024",
            citizen_id=citizen.id,
            department_id=dept_map[ComplaintCategory.ELECTRICAL_INFRASTRUCTURE].id,
            title="Broken streetlight outside residence",
            description="Streetlight has been broken for two weeks causing serious security hazard at night.",
            category=ComplaintCategory.ELECTRICAL_INFRASTRUCTURE,
            priority=Priority.MEDIUM,
            status=ComplaintStatus.IN_PROGRESS,
            responsibility_type="DEPARTMENT_ROLE",
            responsibility_name="Street Lighting Coordinator",
            location_text="Street 14, Sector F-7/2, Islamabad",
            normalized_location=RecurrenceService.normalize_location("Street 14, Sector F-7/2, Islamabad"),
            stalled=True,
            version=2,
            created_at=time_72h_ago,
            last_progress_at=time_72h_ago,
        )
        session.add(c1024)
        await session.flush()

        # Timeline events for A1024
        session.add_all([
            ComplaintEventModel(
                complaint_id=c1024.id,
                event_type=EventType.COMPLAINT_CREATED,
                actor_type="CITIZEN",
                actor_id=citizen.id,
                payload={"title": c1024.title, "priority": "MEDIUM"},
                created_at=time_72h_ago,
            ),
            ComplaintEventModel(
                complaint_id=c1024.id,
                event_type=EventType.COMPLAINT_ASSIGNED,
                actor_type="SYSTEM",
                payload={"responsible_role": "Street Lighting Coordinator"},
                created_at=time_72h_ago + timedelta(minutes=10),
            ),
            ComplaintEventModel(
                complaint_id=c1024.id,
                event_type=EventType.STATUS_CHANGED,
                actor_type="OPERATOR",
                actor_id=operator.id,
                payload={"from_status": "ASSIGNED", "to_status": "IN_PROGRESS"},
                created_at=time_72h_ago + timedelta(minutes=30),
            ),
        ])

        # Missed commitment on A1024
        comm1024 = CommitmentModel(
            complaint_id=c1024.id,
            description="Electrical technician will inspect lighting circuit and replace lamp fixture",
            commitment_type="VISIT",
            due_at=now - timedelta(hours=24),  # Expired 24 hours ago!
            status=CommitmentStatus.MISSED,
            created_at=time_72h_ago + timedelta(hours=1),
        )
        session.add(comm1024)

        # Recommendation on A1024 (PENDING escalation approval)
        rec1024 = RecommendationModel(
            complaint_id=c1024.id,
            type=RecommendationType.ESCALATE,
            status=RecommendationStatus.PENDING,
            reason="Case has had zero progress for 72+ hours and technician visit commitment was missed.",
            evidence=[
                "Case assigned 73 hours ago with no progress updates recorded",
                "Technician visit commitment was due 24 hours ago and was not fulfilled",
                "Exceeds municipal 72-hour SLA threshold for Electrical Infrastructure",
                "Target escalation: Superintending Engineer (Street Infrastructure)",
            ],
            requires_approval=True,
            incident_key=f"stall:72h:{c1024.id}",
            created_at=now - timedelta(hours=1),
        )
        session.add(rec1024)

        # Case A1025: Sewage overflow (High priority, assigned 18h ago, active)
        time_18h_ago = now - timedelta(hours=18)
        c1025 = ComplaintModel(
            id="A1025",
            citizen_id=citizen.id,
            department_id=dept_map[ComplaintCategory.WATER_DRAINAGE].id,
            title="Major sewage overflow on service road",
            description="Sewer line overflowing across 100 meters of road causing foul odor and traffic block.",
            category=ComplaintCategory.WATER_DRAINAGE,
            priority=Priority.HIGH,
            status=ComplaintStatus.ASSIGNED,
            responsibility_type="DEPARTMENT_ROLE",
            responsibility_name="WASA Drainage Operations Coordinator",
            location_text="Near ABC Chowk, Sector G-9, Islamabad",
            normalized_location=RecurrenceService.normalize_location("Near ABC Chowk, Sector G-9, Islamabad"),
            stalled=False,
            version=1,
            created_at=time_18h_ago,
            last_progress_at=time_18h_ago,
        )
        session.add(c1025)
        await session.flush()

        session.add(ComplaintEventModel(
            complaint_id=c1025.id,
            event_type=EventType.COMPLAINT_CREATED,
            actor_type="CITIZEN",
            actor_id=citizen.id,
            payload={"title": c1025.title, "priority": "HIGH"},
            created_at=time_18h_ago,
        ))

        rec1025 = RecommendationModel(
            complaint_id=c1025.id,
            type=RecommendationType.FOLLOW_UP,
            status=RecommendationStatus.PENDING,
            reason="High priority sewage overflow requires suction vehicle confirmation within 24h.",
            evidence=[
                "Critical sanitation hazard classified as HIGH priority",
                "WASA Drainage Coordinator assigned 18 hours ago",
            ],
            requires_approval=True,
            incident_key=f"followup:18h:{c1025.id}",
            created_at=now - timedelta(hours=2),
        )
        session.add(rec1025)

        # Case A1026: Pothole near school (High priority, Acknowledged, with photo evidence)
        time_6h_ago = now - timedelta(hours=6)
        c1026 = ComplaintModel(
            id="A1026",
            citizen_id=citizen.id,
            department_id=dept_map[ComplaintCategory.ROADS].id,
            title="Deep crater-sized pothole in front of school",
            description="Severe pothole near primary school gate damaging vehicles and endangering pedestrians.",
            category=ComplaintCategory.ROADS,
            priority=Priority.HIGH,
            status=ComplaintStatus.ACKNOWLEDGED,
            responsibility_type="DEPARTMENT_ROLE",
            responsibility_name="Roads Maintenance Coordinator",
            location_text="Main Boulevard near Army Public School, Rawalpindi",
            normalized_location=RecurrenceService.normalize_location("Main Boulevard near Army Public School, Rawalpindi"),
            stalled=False,
            version=1,
            created_at=time_6h_ago,
            last_progress_at=time_6h_ago,
        )
        session.add(c1026)
        await session.flush()

        session.add(ComplaintEventModel(
            complaint_id=c1026.id,
            event_type=EventType.COMPLAINT_CREATED,
            actor_type="CITIZEN",
            actor_id=citizen.id,
            payload={"title": c1026.title, "priority": "HIGH"},
            created_at=time_6h_ago,
        ))

        # Simulated evidence file record for A1026
        ev1026 = EvidenceModel(
            complaint_id=c1026.id,
            storage_key="pothole_seed_photo.jpg",
            filename="pothole_school_gate.jpg",
            mime_type="image/jpeg",
            size_bytes=1048576,
            sha256="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            created_at=time_6h_ago,
        )
        session.add(ev1026)

        # Case A1027: Garbage accumulation (Resolved)
        time_3d_ago = now - timedelta(days=3)
        c1027 = ComplaintModel(
            id="A1027",
            citizen_id=citizen.id,
            department_id=dept_map[ComplaintCategory.SANITATION].id,
            title="Overflowing community garbage dumpster",
            description="Dumpster uncollected for 5 days attracting pests.",
            category=ComplaintCategory.SANITATION,
            priority=Priority.MEDIUM,
            status=ComplaintStatus.RESOLVED,
            responsibility_type="DEPARTMENT_ROLE",
            responsibility_name="Sanitation Area Supervisor",
            location_text="Block B Commercial Market, Sector I-8, Islamabad",
            normalized_location=RecurrenceService.normalize_location("Block B Commercial Market, Sector I-8, Islamabad"),
            stalled=False,
            version=3,
            created_at=time_3d_ago,
            last_progress_at=now - timedelta(hours=12),
        )
        session.add(c1027)

        # Case A1028: Repeated Streetlight Outage (Linked to A1024 - Recurrence Demo)
        time_2h_ago = now - timedelta(hours=2)
        c1028 = ComplaintModel(
            id="A1028",
            citizen_id=citizen.id,
            department_id=dept_map[ComplaintCategory.ELECTRICAL_INFRASTRUCTURE].id,
            title="Repeated streetlight outage on Street 14",
            description="Streetlight is dark again after previous outage on the same pole.",
            category=ComplaintCategory.ELECTRICAL_INFRASTRUCTURE,
            priority=Priority.MEDIUM,
            status=ComplaintStatus.REPORTED,
            responsibility_type="DEPARTMENT_ROLE",
            responsibility_name="Street Lighting Coordinator",
            location_text="Street 14, Sector F-7/2, Islamabad",
            normalized_location=RecurrenceService.normalize_location("Street 14, Sector F-7/2, Islamabad"),
            stalled=False,
            version=1,
            created_at=time_2h_ago,
            last_progress_at=time_2h_ago,
        )
        session.add(c1028)

        await session.commit()

        # Write seed audit log
        session.add(AuditLogModel(
            actor_id=admin.id,
            actor_type="ADMIN",
            action="RESET_DEMO_DATA",
            resource_type="SYSTEM",
            metadata_json={"cases_seeded": ["A1024", "A1025", "A1026", "A1027", "A1028"]},
        ))
        await session.commit()

        return {
            "users": 3,
            "departments": len(dept_map),
            "cases": ["A1024", "A1025", "A1026", "A1027", "A1028"],
            "stalled_case": "A1024",
            "missed_commitment_case": "A1024",
            "pending_approval_case": "A1024",
            "recurrence_pair": ["A1024", "A1028"],
        }
    finally:
        if should_close:
            await session.close()
