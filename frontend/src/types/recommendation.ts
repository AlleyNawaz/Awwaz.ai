export type RecommendationType =
  | "REQUEST_INFORMATION"
  | "FOLLOW_UP"
  | "VERIFY_COMMITMENT"
  | "ESCALATE"
  | "LINK_RECURRING";

export type RecommendationStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "EXECUTING"
  | "EXECUTED"
  | "FAILED";

export interface Recommendation {
  id: string;
  complaint_id: string;
  complaint_title?: string | null;
  complaint_category?: string | null;
  complaint_status?: string | null;
  type: RecommendationType;
  status: RecommendationStatus;
  reason: string;
  evidence: string[];
  requires_approval: boolean;
  incident_key?: string | null;
  created_at: string;
}

export interface DashboardSummary {
  open_cases: number;
  high_priority_cases: number;
  stalled_cases: number;
  pending_approvals: number;
  resolved_today: number;
}
