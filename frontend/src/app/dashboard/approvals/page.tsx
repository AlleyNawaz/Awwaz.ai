"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/services/api/client";
import { getActiveUser, setActiveUser } from "@/lib/auth";
import { Recommendation } from "@/types/recommendation";
import { RecommendationCard } from "@/components/approvals/RecommendationCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  ShieldAlert,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Clock,
  Sparkles,
  Layers,
  Send,
  RefreshCw,
} from "lucide-react";

export default function ApprovalsPage() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRole] = useState("OPERATOR");

  const loadRecommendations = async () => {
    const user = getActiveUser();
    if (user) setActiveRole(user.role);
    setLoading(true);
    const res = await api.getRecommendations({ status: "PENDING" });
    if (res.success && res.data) {
      setRecommendations(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRecommendations();
  }, []);

  const pendingCount = recommendations.length;
  const escalationCount = recommendations.filter((r) => r.type === "ESCALATE").length;

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "2.5rem 1.5rem" }}>
      {/* Operator Switcher Banner if in Citizen mode */}
      {activeRole === "CITIZEN" && (
        <div
          style={{
            padding: "0.85rem 1.15rem",
            background: "rgba(245, 158, 11, 0.12)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            borderRadius: "var(--radius-md)",
            marginBottom: "1.75rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.75rem",
            fontSize: "0.85rem",
            color: "var(--accent-warning)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <AlertTriangle size={20} style={{ flexShrink: 0 }} />
            <div>
              <strong>Officer Authority Required:</strong> You are currently viewing as Citizen (Tariq). Switch to <strong>Operator (Fatima)</strong> to review and authorize consequential department escalations.
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setActiveUser("OPERATOR");
              window.location.reload();
            }}
            className="btn btn-primary"
            style={{ padding: "0.35rem 0.85rem", fontSize: "0.8rem", whiteSpace: "nowrap" }}
          >
            <Shield size={14} /> Switch to Operator (Fatima)
          </button>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="Human-in-the-Loop Approvals"
        subtitle="In Awwaz, AI agent recommendations never bypass human authority. Review cited facts and groundings before authorizing external civic actions."
        badge={
          <span
            className="badge"
            style={{
              background: pendingCount > 0 ? "rgba(244, 63, 94, 0.15)" : "rgba(16, 185, 129, 0.15)",
              color: pendingCount > 0 ? "var(--accent-danger)" : "var(--accent-primary)",
              fontWeight: 700,
            }}
          >
            {pendingCount > 0 ? `${pendingCount} PENDING REVIEW` : "QUEUE NOMINAL"}
          </span>
        }
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Approvals Queue" },
        ]}
        actions={
          <button
            type="button"
            onClick={loadRecommendations}
            disabled={loading}
            className="btn btn-secondary"
            style={{ fontSize: "0.82rem", padding: "0.45rem 0.85rem" }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh Queue
          </button>
        }
      />

      {/* Metric Stat Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1.25rem",
          marginBottom: "2rem",
        }}
      >
        <StatCard
          label="Pending Review"
          value={pendingCount}
          subtitle="Awaiting officer decision"
          icon={<ShieldAlert size={20} />}
          accentColor="var(--accent-danger)"
          trend={pendingCount > 0 ? "Action required" : undefined}
          trendType={pendingCount > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Escalation Requests"
          value={escalationCount}
          subtitle="To external civic agencies"
          icon={<Send size={20} />}
          accentColor="#38bdf8"
        />
        <StatCard
          label="Grounding Verification"
          value="100%"
          subtitle="Strict citation mandatory"
          icon={<Sparkles size={20} />}
          accentColor="var(--accent-primary)"
        />
        <StatCard
          label="SLA Compliance"
          value="100%"
          subtitle="Zero automated leakages"
          icon={<Clock size={20} />}
          accentColor="var(--accent-teal)"
        />
      </div>

      {/* Content Section */}
      <div style={{ marginBottom: "1rem" }}>
        <div
          className="micro-label"
          style={{
            marginBottom: "0.75rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>Active Recommendations Queue ({recommendations.length})</span>
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
            Sequential Audit-Trail Enforced
          </span>
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="skeleton" style={{ height: 160, borderRadius: "var(--radius-lg)" }} />
            <div className="skeleton" style={{ height: 160, borderRadius: "var(--radius-lg)" }} />
          </div>
        ) : recommendations.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 size={32} />}
            title="All Operational Actions Authorized"
            description="There are currently no consequential AI recommendations awaiting human review. The civic coordination queue is operating nominally."
            action={
              <Link href="/dashboard" className="btn btn-primary">
                Return to Command Center
              </Link>
            }
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {recommendations.map((rec) => (
              <RecommendationCard
                key={rec.id}
                recommendation={rec}
                onActionComplete={loadRecommendations}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
