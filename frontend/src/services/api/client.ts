import { getActiveUser } from "@/lib/auth";
import { ComplaintSummary, ComplaintDetail } from "@/types/complaint";
import { Recommendation, DashboardSummary } from "@/types/recommendation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export async function fetchApi<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data: T; error?: { code: string; message: string } }> {
  const user = getActiveUser();
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // Attach demo session credentials so FastAPI resolves current user role seamlessly
  if (user) {
    headers.set("X-Demo-Role", user.role);
    headers.set("X-Demo-User-Id", user.user_id);
    headers.set("X-Demo-Email", user.email);
    headers.set("X-Demo-Name", user.name);
  }

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      data: null as any,
      error: {
        code: "NETWORK_ERROR",
        message: err.message || "Failed to communicate with Awwaz backend service.",
      },
    };
  }
}

export const api = {
  // Conversations
  async sendMessage(message: string, conversationId?: string) {
    return fetchApi("/conversations/messages", {
      method: "POST",
      body: JSON.stringify({ message, conversation_id: conversationId }),
    });
  },

  async getConversationMessages(conversationId: string) {
    return fetchApi(`/conversations/${conversationId}/messages`);
  },

  // Complaints
  async getComplaints(params: Record<string, any> = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        query.set(k, String(v));
      }
    });
    return fetchApi<ComplaintSummary[]>(`/complaints?${query.toString()}`);
  },

  async getComplaint(id: string) {
    return fetchApi<ComplaintDetail>(`/complaints/${id}`);
  },

  async updateComplaintStatus(id: string, targetStatus: string, reason?: string, expectedVersion?: number) {
    return fetchApi(`/complaints/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({
        target_status: targetStatus,
        reason,
        expected_version: expectedVersion,
      }),
    });
  },

  async getAgentTrace(complaintId: string) {
    return fetchApi(`/complaints/${complaintId}/agent-trace`);
  },

  async uploadEvidence(complaintId: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    return fetchApi(`/complaints/${complaintId}/evidence`, {
      method: "POST",
      body: formData,
    });
  },

  async createCommitment(complaintId: string, description: string, dueAt: string, commitmentType = "VISIT") {
    return fetchApi(`/complaints/${complaintId}/commitments`, {
      method: "POST",
      body: JSON.stringify({
        description,
        due_at: dueAt,
        commitment_type: commitmentType,
      }),
    });
  },

  async fulfillCommitment(complaintId: string, commitmentId: string) {
    return fetchApi(`/complaints/${complaintId}/commitments/${commitmentId}/fulfill`, {
      method: "POST",
    });
  },

  // Recommendations & Approvals
  async getRecommendations(params: Record<string, any> = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) query.set(k, String(v));
    });
    return fetchApi<Recommendation[]>(`/recommendations?${query.toString()}`);
  },

  async approveRecommendation(id: string, comment?: string, expectedVersion?: number) {
    const idempotencyKey = `web_app_${id}_${Date.now()}`;
    return fetchApi(`/recommendations/${id}/approve`, {
      method: "POST",
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ comment, expected_version: expectedVersion }),
    });
  },

  async rejectRecommendation(id: string, comment?: string) {
    return fetchApi(`/recommendations/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ comment }),
    });
  },

  // Dashboard
  async getDashboardSummary() {
    return fetchApi<DashboardSummary>("/dashboard/summary");
  },

  async getStalledCases() {
    return fetchApi<any[]>("/dashboard/stalled");
  },

  async runWorkers() {
    return fetchApi("/dashboard/workers/run", { method: "POST" });
  },

  // Admin
  async getAuditLogs(params: { action?: string; actor_type?: string; limit?: number } = {}) {
    const query = new URLSearchParams();
    if (params.action) query.set("action", params.action);
    if (params.actor_type) query.set("actor_type", params.actor_type);
    query.set("limit", String(params.limit || 50));
    return fetchApi<any[]>(`/admin/audit-logs?${query.toString()}`);
  },

  async verifyAuditLedger() {
    return fetchApi<{
      status: string;
      verified_records_count: number;
      genesis_root: string;
      ledger_head_hash: string;
      algorithm: string;
      tamper_evident: boolean;
    }>("/admin/audit-logs/verify");
  },

  async getDepartments() {
    return fetchApi<any[]>("/admin/departments");
  },

  async resetDemo() {
    return fetchApi("/admin/demo/reset", { method: "POST" });
  },
};
