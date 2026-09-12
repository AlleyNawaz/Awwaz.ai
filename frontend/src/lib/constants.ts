export const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  REPORTED: { label: "Reported", color: "#94a3b8", bg: "rgba(148, 163, 184, 0.15)", border: "rgba(148, 163, 184, 0.3)" },
  SUBMITTED: { label: "Submitted", color: "#60a5fa", bg: "rgba(96, 165, 250, 0.15)", border: "rgba(96, 165, 250, 0.3)" },
  ACKNOWLEDGED: { label: "Acknowledged", color: "#38bdf8", bg: "rgba(56, 189, 248, 0.15)", border: "rgba(56, 189, 248, 0.3)" },
  ASSIGNED: { label: "Assigned", color: "#a78bfa", bg: "rgba(167, 139, 250, 0.15)", border: "rgba(167, 139, 250, 0.3)" },
  IN_PROGRESS: { label: "In Progress", color: "#fbbf24", bg: "rgba(251, 191, 36, 0.15)", border: "rgba(251, 191, 36, 0.3)" },
  WAITING_FOR_CITIZEN: { label: "Waiting Citizen", color: "#f97316", bg: "rgba(249, 115, 22, 0.15)", border: "rgba(249, 115, 22, 0.3)" },
  ESCALATION_PENDING: { label: "Escalation Pending", color: "#f43f5e", bg: "rgba(244, 63, 94, 0.18)", border: "rgba(244, 63, 94, 0.4)" },
  ESCALATED: { label: "Escalated", color: "#ef4444", bg: "rgba(239, 68, 68, 0.2)", border: "rgba(239, 68, 68, 0.45)" },
  RESOLVED: { label: "Resolved", color: "#34d399", bg: "rgba(52, 211, 153, 0.15)", border: "rgba(52, 211, 153, 0.3)" },
  CLOSED: { label: "Closed", color: "#64748b", bg: "rgba(100, 116, 139, 0.15)", border: "rgba(100, 116, 139, 0.3)" },
};

export const PRIORITY_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  LOW: { label: "Low", color: "#94a3b8", bg: "rgba(148, 163, 184, 0.12)" },
  MEDIUM: { label: "Medium", color: "#38bdf8", bg: "rgba(56, 189, 248, 0.12)" },
  HIGH: { label: "High", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)" },
  CRITICAL: { label: "Critical", color: "#ef4444", bg: "rgba(239, 68, 68, 0.2)" },
};

export const CATEGORY_LABELS: Record<string, string> = {
  ROADS: "Roads & Transportation",
  WATER_DRAINAGE: "Water & Drainage (WASA)",
  SANITATION: "Sanitation & Solid Waste",
  ELECTRICAL_INFRASTRUCTURE: "Street Lighting & Electrical",
  PUBLIC_SAFETY: "Public Safety & Hazards",
  GENERAL_SERVICES: "General Municipal Services",
  UNKNOWN: "Unclassified Issue",
};
