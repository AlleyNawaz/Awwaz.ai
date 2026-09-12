from typing import Dict, Any, List
from app.domain.complaints.entities import ComplaintCategory

# Configurable civic routing taxonomy and synthetic responsibility models
DEFAULT_DEPARTMENTS: Dict[str, Dict[str, Any]] = {
    ComplaintCategory.ROADS: {
        "name": "Roads & Transportation Authority",
        "category": ComplaintCategory.ROADS,
        "primary_role": "Roads Maintenance Coordinator",
        "field_unit": "Roads Field Repair Squad",
        "escalation_target": "Executive Engineer (Highways & Infrastructure)",
        "keywords": [
            "pothole", "road", "sadak", "gaddha", "tuta", "broken road",
            "damaged road", "blocked road", "pavement", "footpath", "crater"
        ],
        "responsibility_chain": [
            {"level": 1, "role": "Roads Maintenance Coordinator", "action": "Case Intake & Triage"},
            {"level": 2, "role": "Roads Field Repair Squad", "action": "On-Site Patching & Repair"},
            {"level": 3, "role": "Executive Engineer (Highways & Infrastructure)", "action": "Administrative Escalation Desk"},
        ],
    },
    ComplaintCategory.WATER_DRAINAGE: {
        "name": "Water & Sanitation Agency (WASA)",
        "category": ComplaintCategory.WATER_DRAINAGE,
        "primary_role": "WASA Drainage Operations Coordinator",
        "field_unit": "Drainage Rapid Response Unit",
        "escalation_target": "Deputy Managing Director (Operations WASA)",
        "keywords": [
            "sewage", "gutter", "drainage", "overflow", "leak", "ganda pani",
            "paani", "sewer", "standing water", "naala", "pipeline", "water supply"
        ],
        "responsibility_chain": [
            {"level": 1, "role": "WASA Drainage Operations Coordinator", "action": "Desiltation Dispatch"},
            {"level": 2, "role": "Drainage Rapid Response Unit", "action": "Vacuum Suction & Clearance"},
            {"level": 3, "role": "Deputy Managing Director (Operations WASA)", "action": "Zonal Escalation Office"},
        ],
    },
    ComplaintCategory.SANITATION: {
        "name": "Sanitation & Solid Waste Management",
        "category": ComplaintCategory.SANITATION,
        "primary_role": "Sanitation Area Supervisor",
        "field_unit": "Waste Collection Squad",
        "escalation_target": "Director of Solid Waste Management",
        "keywords": [
            "garbage", "kachra", "kooda", "dustbin", "collection", "trash",
            "overflowing bin", "dump", "safai", "debris", "filth"
        ],
        "responsibility_chain": [
            {"level": 1, "role": "Sanitation Area Supervisor", "action": "Route Assignment"},
            {"level": 2, "role": "Waste Collection Squad", "action": "Compactor Truck Dispatch"},
            {"level": 3, "role": "Director of Solid Waste Management", "action": "Municipal Oversight Desk"},
        ],
    },
    ComplaintCategory.ELECTRICAL_INFRASTRUCTURE: {
        "name": "Street Lighting & Electrical Infrastructure",
        "category": ComplaintCategory.ELECTRICAL_INFRASTRUCTURE,
        "primary_role": "Street Lighting Coordinator",
        "field_unit": "Electrical Maintenance Unit",
        "escalation_target": "Superintending Engineer (Street Infrastructure)",
        "keywords": [
            "streetlight", "street light", "batti", "khamba", "wiring", "power",
            "exposed wire", "pole", "light band", "bulb", "dark street", "transformer"
        ],
        "responsibility_chain": [
            {"level": 1, "role": "Street Lighting Coordinator", "action": "Circuit Diagnostics"},
            {"level": 2, "role": "Electrical Maintenance Unit", "action": "Bulb/Wiring Replacement"},
            {"level": 3, "role": "Superintending Engineer (Street Infrastructure)", "action": "Senior Escalation Desk"},
        ],
    },
    ComplaintCategory.PUBLIC_SAFETY: {
        "name": "Public Safety & Civil Protection",
        "category": ComplaintCategory.PUBLIC_SAFETY,
        "primary_role": "Public Hazard Coordinator",
        "field_unit": "Rapid Safety Wardens",
        "escalation_target": "Municipal Safety Director",
        "keywords": [
            "hazard", "unsafe", "collapse", "danger", "khatra", "obstruction",
            "falling tree", "open manhole", "live wire", "structural damage"
        ],
        "responsibility_chain": [
            {"level": 1, "role": "Public Hazard Coordinator", "action": "Hazard Assessment"},
            {"level": 2, "role": "Rapid Safety Wardens", "action": "Cordon & Temporary Containment"},
            {"level": 3, "role": "Municipal Safety Director", "action": "Emergency Response Office"},
        ],
    },
    ComplaintCategory.GENERAL_SERVICES: {
        "name": "General Municipal Services",
        "category": ComplaintCategory.GENERAL_SERVICES,
        "primary_role": "Municipal Services Coordinator",
        "field_unit": "General Inspection Team",
        "escalation_target": "Additional Deputy Commissioner (General)",
        "keywords": [
            "park", "bench", "signboard", "encroachment", "graffiti", "other",
            "complaint", "masla", "issue", "civic"
        ],
        "responsibility_chain": [
            {"level": 1, "role": "Municipal Services Coordinator", "action": "General Triage"},
            {"level": 2, "role": "General Inspection Team", "action": "Field Verification"},
            {"level": 3, "role": "Additional Deputy Commissioner (General)", "action": "Administrative Office"},
        ],
    },
}
