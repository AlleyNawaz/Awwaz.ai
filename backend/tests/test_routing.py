import pytest
from app.domain.complaints.entities import ComplaintCategory
from app.domain.routing.service import RoutingService
from app.domain.routing.mappings import DEFAULT_DEPARTMENTS


def test_keyword_resolution():
    # Water & Drainage
    cat1, conf1 = RoutingService.resolve_category_from_text("Gutter is overflowing with dirty sewage water")
    assert cat1 == ComplaintCategory.WATER_DRAINAGE
    assert conf1 > 0.7

    # Electrical
    cat2, conf2 = RoutingService.resolve_category_from_text("Streetlight is broken and pole wire is exposed")
    assert cat2 == ComplaintCategory.ELECTRICAL_INFRASTRUCTURE
    assert conf2 > 0.7

    # Roads
    cat3, conf3 = RoutingService.resolve_category_from_text("Large pothole on damaged broken road")
    assert cat3 == ComplaintCategory.ROADS
    assert conf3 > 0.7

    # Sanitation
    cat4, conf4 = RoutingService.resolve_category_from_text("Garbage trash is overflowing from the dustbin")
    assert cat4 == ComplaintCategory.SANITATION
    assert conf4 > 0.7


def test_department_assignment_rules():
    assignment = RoutingService.get_initial_assignment(ComplaintCategory.WATER_DRAINAGE)
    assert assignment["department_name"] == "Water & Sanitation Agency (WASA)"
    assert assignment["responsibility_name"] == "WASA Drainage Operations Coordinator"
    assert "Deputy Managing Director" in assignment["escalation_target"]

    elec_assign = RoutingService.get_initial_assignment(ComplaintCategory.ELECTRICAL_INFRASTRUCTURE)
    assert elec_assign["department_name"] == "Street Lighting & Electrical Infrastructure"
    assert elec_assign["responsibility_name"] == "Street Lighting Coordinator"


def test_all_six_categories_configured():
    categories = [
        ComplaintCategory.ROADS,
        ComplaintCategory.WATER_DRAINAGE,
        ComplaintCategory.SANITATION,
        ComplaintCategory.ELECTRICAL_INFRASTRUCTURE,
        ComplaintCategory.PUBLIC_SAFETY,
        ComplaintCategory.GENERAL_SERVICES,
    ]
    for cat in categories:
        config = RoutingService.get_department_config(cat)
        assert config is not None
        assert "name" in config
        assert "primary_role" in config
        assert "escalation_target" in config
        assert len(config["responsibility_chain"]) >= 2
