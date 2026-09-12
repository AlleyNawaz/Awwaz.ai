import pytest
from datetime import datetime, timezone, timedelta
from app.repositories.models import ComplaintModel
from app.domain.complaints.entities import ComplaintStatus, ComplaintCategory
from app.domain.recurrence.service import RecurrenceService


def test_location_normalization():
    loc1 = RecurrenceService.normalize_location("Near ABC Chowk, Sector G-9, Islamabad")
    loc2 = RecurrenceService.normalize_location("ABC Chowk, Sector G-9")
    # Both should contain abc, chowk, g-9
    assert "abc" in loc1 and "chowk" in loc1 and "g-9" in loc1
    assert "abc" in loc2 and "chowk" in loc2 and "g-9" in loc2


@pytest.mark.asyncio
async def test_find_potential_recurrences(db_session):
    now = datetime.now(timezone.utc)

    # 1. Seed past streetlight complaint in F-7/2
    past_case = ComplaintModel(
        citizen_id="test_citizen_1",
        title="Old Streetlight Issue",
        description="Broken lamp",
        category=ComplaintCategory.ELECTRICAL_INFRASTRUCTURE,
        status=ComplaintStatus.RESOLVED,
        location_text="Street 14, Sector F-7/2, Islamabad",
        normalized_location=RecurrenceService.normalize_location("Street 14, Sector F-7/2, Islamabad"),
        created_at=now - timedelta(days=10),
    )
    db_session.add(past_case)
    await db_session.commit()

    # 2. Query recurrence for a new complaint with overlapping location
    recurrences = await RecurrenceService.find_potential_recurrences(
        session=db_session,
        category=ComplaintCategory.ELECTRICAL_INFRASTRUCTURE,
        location_text="Street 14, F-7/2 pole near corner",
    )
    assert len(recurrences) == 1
    assert recurrences[0]["id"] == past_case.id
    assert recurrences[0]["similarity_score"] >= 0.3

    # 3. Query recurrence for a different category or distinct location
    no_recurrence = await RecurrenceService.find_potential_recurrences(
        session=db_session,
        category=ComplaintCategory.WATER_DRAINAGE,
        location_text="Street 14, Sector F-7/2",
    )
    assert len(no_recurrence) == 0
