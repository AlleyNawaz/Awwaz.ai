export type ComplaintStatus =
  | "REPORTED"
  | "SUBMITTED"
  | "ACKNOWLEDGED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "WAITING_FOR_CITIZEN"
  | "ESCALATION_PENDING"
  | "ESCALATED"
  | "RESOLVED"
  | "CLOSED";

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ComplaintCategory =
  | "ROADS"
  | "WATER_DRAINAGE"
  | "SANITATION"
  | "ELECTRICAL_INFRASTRUCTURE"
  | "PUBLIC_SAFETY"
  | "GENERAL_SERVICES"
  | "UNKNOWN";

export interface DepartmentInfo {
  id: string;
  name: string;
  escalation_target?: string;
}

export interface ComplaintSummary {
  id: string;
  title: string;
  category: ComplaintCategory;
  priority: Priority;
  status: ComplaintStatus;
  stalled: boolean;
  location: string;
  responsibility: string | null;
  department: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  external_reference: string | null;
}

export interface TimelineEvent {
  id: string;
  event_type: string;
  actor_type: string;
  payload: Record<string, any>;
  created_at: string;
}

export interface Commitment {
  id: string;
  description: string;
  due_at: string;
  status: "PENDING" | "FULFILLED" | "MISSED" | "CANCELLED";
  commitment_type: string;
  fulfilled_at?: string | null;
}

export interface EvidenceItem {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  storage_key: string;
  created_at: string;
}

export interface RecurrenceMatch {
  id: string;
  external_reference?: string | null;
  title: string;
  status: string;
  created_at: string;
  location_text: string;
  similarity_score: number;
  match_reason: string;
}

export interface ComplaintDetail {
  id: string;
  title: string;
  description: string;
  category: ComplaintCategory;
  priority: Priority;
  status: ComplaintStatus;
  stalled: boolean;
  location_text: string;
  latitude?: number | null;
  longitude?: number | null;
  responsibility_type: string;
  responsibility_name: string | null;
  department: DepartmentInfo | null;
  external_reference: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  last_progress_at: string;
  events: TimelineEvent[];
  commitments: Commitment[];
  recommendations: any[];
  evidence: EvidenceItem[];
  potential_recurrences: RecurrenceMatch[];
}
