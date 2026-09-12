"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/services/api/client";
import { ComplaintSummary } from "@/types/complaint";
import { DashboardSummary } from "@/types/recommendation";
import { getActiveUser, setActiveUser } from "@/lib/auth";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/ToastProvider";
import { formatDate } from "@/lib/formatting";
import {
  Shield,
  Activity,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Search,
  ArrowRight,
  Flame,
  AlertTriangle,
  Copy,
  Clock,
  Layers,
  Inbox,
  Filter,
} from "lucide-react";

export default function DashboardPage() {
  const [complaints, setComplaints] = useState<ComplaintSummary[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningWorker, setRunningWorker] = useState(false);
  const [activeRole, setActiveRole] = useState("OPERATOR");
  const toast = useToast();

  // Filters
  const [statusTab, setStatusTab] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [onlyStalled, setOnlyStalled] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadData = async () => {
    const user = getActiveUser();
    if (user) setActiveRole(user.role);
    setLoading(true);
    const [compRes, sumRes] = await Promise.all([
      api.getComplaints({
        status: statusTab !== "ALL" ? statusTab : undefined,
        category: categoryFilter || undefined,
        stalled: onlyStalled ? true : undefined,
      }),
      api.getDashboardSummary(),
    ]);

    if (compRes.success && compRes.data) {
      setComplaints(compRes.data);
    }
    if (sumRes.success && sumRes.data) {
      setSummary(sumRes.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [statusTab, categoryFilter, onlyStalled]);

  const handleRunWorker = async () => {
    setRunningWorker(true);
    const res = await api.runWorkers();
    setRunningWorker(false);
    if (res.success && res.data) {
      toast.success(
        "Autonomous Worker Pass Complete",
        `Flagged ${res.data.stalled_cases_detected} stalled case(s), generated ${res.data.missed_commitments_detected} escalation recommendations.`
      );
      loadData();
    } else {
      toast.error("Worker Execution Failed", res.error?.message || "Could not evaluate SLA queues");
    }
  };

  const handleCopyId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast.info("Case ID Copied", `#${id} copied to clipboard`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredComplaints = complaints.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q) ||
      c.location.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ maxWidth: 1320, margin: "0 auto", padding: "2rem 1.5rem" }}>
      {/* Role Warning Banner if Citizen */}
      {activeRole === "CITIZEN" && (
        <div
          style={{
            padding: "0.85rem 1.15rem",
            background: "rgba(245, 158, 11, 0.12)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            borderRadius: "var(--radius-md)",
            marginBottom: "1.5rem",
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
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <div>
              <strong>Operator Authorization Needed:</strong> You are currently authenticated as Citizen. Switch to <strong>Operator (Fatima)</strong> to triage cases, record commitments, and evaluate SLA workers.
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
            <Shield size={14} /> Switch to Operator
          </button>
        </div>
      )}

      {/* Enterprise Page Header */}
      <PageHeader
        breadcrumbs={[
          { label: "Overview", href: "/" },
          { label: "Command Center" },
          { label: "Active Queue" },
        ]}
        title="Triage & Operations Queue"
        badge={
          <span
            className="badge badge-status-assigned"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-primary)", display: "inline-block" }} />
            SLA Worker Active
          </span>
        }
        subtitle="Real-time multi-department civic event stream, autonomous 72-hour stall detection, and human security authorization."
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <button
              onClick={handleRunWorker}
              disabled={runningWorker}
              className="btn btn-secondary"
              style={{ fontSize: "0.82rem" }}
              title="Trigger background stall detection worker pass"
            >
              <RefreshCw size={14} className={runningWorker ? "animate-spin" : ""} />
              {runningWorker ? "Evaluating SLAs..." : "Run SLA Worker"}
            </button>

            <Link
              href="/dashboard/approvals"
              className="btn btn-primary"
              style={{
                fontSize: "0.82rem",
                background: "linear-gradient(135deg, #e11d48, #be123c)",
                boxShadow: "0 2px 10px rgba(225, 29, 72, 0.3)",
              }}
            >
              <AlertCircle size={15} />
              Pending Approvals ({summary?.pending_approvals ?? 0})
            </Link>
          </div>
        }
      />

      {/* Stripe-style Metric Ribbon */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "1rem",
          marginBottom: "1.75rem",
        }}
      >
        <StatCard
          label="Active Cases"
          value={summary?.open_cases ?? "—"}
          icon={<Activity size={17} />}
          trend="Live Intake"
          trendType="neutral"
          subtitle="Across 6 municipal taxonomy sectors"
        />

        <StatCard
          label="High & Critical"
          value={summary?.high_priority_cases ?? "—"}
          icon={<Flame size={17} />}
          trend="Accelerated SLA"
          trendType="warning"
          subtitle="Direct escalation threshold: 24h"
          accentColor="var(--accent-warning)"
        />

        <StatCard
          label="Stalled Cases (>72h)"
          value={summary?.stalled_cases ?? "—"}
          icon={<AlertTriangle size={17} />}
          trend="Breached SLA"
          trendType="negative"
          subtitle="Autonomous supervisor alert triggered"
          accentColor="var(--accent-danger)"
        />

        <StatCard
          label="Pending Approvals"
          value={summary?.pending_approvals ?? "—"}
          icon={<Shield size={17} />}
          trend="Human Gate"
          trendType="warning"
          subtitle="Awaiting supervisor authorization"
          accentColor="#e11d48"
        />

        <StatCard
          label="Resolved Baseline"
          value={summary?.resolved_today ?? "—"}
          icon={<CheckCircle2 size={17} />}
          trend="Verified"
          trendType="positive"
          subtitle="Field team fulfillment confirmed"
          accentColor="var(--accent-primary)"
        />
      </div>

      {/* Faceted Filter Toolbar */}
      <div
        className="glass-panel"
        style={{
          padding: "0.85rem 1.15rem",
          marginBottom: "1.25rem",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
        }}
      >
        {/* Search input with keyboard hint */}
        <div style={{ position: "relative", flex: "1 1 260px", maxWidth: "380px" }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: 11, color: "var(--text-muted)" }} />
          <input
            type="text"
            placeholder="Filter by case ID, title, or area..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field"
            style={{
              paddingLeft: "2.2rem",
              paddingRight: "1rem",
              fontSize: "0.84rem",
              paddingTop: "0.5rem",
              paddingBottom: "0.5rem",
            }}
          />
        </div>

        {/* Segmented Status Tabs */}
        <div className="segmented-control">
          {[
            { id: "ALL", label: "All Cases" },
            { id: "ASSIGNED", label: "Assigned" },
            { id: "IN_PROGRESS", label: "In Progress" },
            { id: "ESCALATED", label: "Escalated" },
            { id: "RESOLVED", label: "Resolved" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusTab(tab.id)}
              className={`segmented-item ${statusTab === tab.id ? "segmented-item-active" : ""}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Category & Stalled Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="input-field"
            style={{ width: "auto", minWidth: 150, fontSize: "0.82rem", padding: "0.45rem 0.75rem" }}
          >
            <option value="">All Sectors</option>
            <option value="ROADS">Roads & Transport</option>
            <option value="WATER_DRAINAGE">Water & Drainage</option>
            <option value="SANITATION">Sanitation & Solid Waste</option>
            <option value="ELECTRICAL_INFRASTRUCTURE">Electrical & Lighting</option>
            <option value="PUBLIC_SAFETY">Public Safety Hazards</option>
          </select>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.45rem",
              fontSize: "0.82rem",
              color: onlyStalled ? "var(--accent-danger)" : "var(--text-secondary)",
              fontWeight: onlyStalled ? 700 : 500,
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={onlyStalled}
              onChange={(e) => setOnlyStalled(e.target.checked)}
              style={{ accentColor: "var(--accent-danger)", width: 14, height: 14 }}
            />
            <span>Stalled (&gt;72h) Only</span>
          </label>
        </div>
      </div>

      {/* Main Enterprise Data Table */}
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: "22%" }}>Case & Summary</th>
              <th style={{ width: "18%" }}>Sector & Area</th>
              <th style={{ width: "10%" }}>Priority</th>
              <th style={{ width: "14%" }}>Status</th>
              <th style={{ width: "16%" }}>Assigned Desk</th>
              <th style={{ width: "10%" }}>Created</th>
              <th style={{ width: "10%", textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: "3.5rem", textAlign: "center", color: "var(--text-muted)" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                    <RefreshCw size={20} className="animate-spin" color="var(--accent-primary)" />
                    <span style={{ fontSize: "0.85rem" }}>Synchronizing operational case stream...</span>
                  </div>
                </td>
              </tr>
            ) : filteredComplaints.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: "1rem" }}>
                  <EmptyState
                    icon={<Inbox size={32} color="var(--text-muted)" />}
                    title="No Cases Matching Criteria"
                    description="No operational cases match your active filter settings. Try adjusting the search query or status tab."
                    action={
                      <button
                        onClick={() => {
                          setStatusTab("ALL");
                          setCategoryFilter("");
                          setOnlyStalled(false);
                          setSearchQuery("");
                        }}
                        className="btn btn-secondary"
                        style={{ fontSize: "0.8rem", marginTop: "0.5rem" }}
                      >
                        Reset All Filters
                      </button>
                    }
                  />
                </td>
              </tr>
            ) : (
              filteredComplaints.map((c) => (
                <tr
                  key={c.id}
                  style={{
                    background: c.stalled ? "rgba(244, 63, 94, 0.04)" : undefined,
                    borderLeft: c.stalled ? "3px solid var(--accent-danger)" : undefined,
                  }}
                >
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <span
                        className="tabular-nums"
                        style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: "0.88rem" }}
                      >
                        #{c.id}
                      </span>

                      <button
                        onClick={(e) => handleCopyId(c.id, e)}
                        title="Copy Case ID"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: copiedId === c.id ? "var(--accent-primary)" : "var(--text-muted)",
                          cursor: "pointer",
                          padding: "0.15rem",
                          display: "inline-flex",
                          alignItems: "center",
                        }}
                      >
                        <Copy size={12} />
                      </button>

                      {c.stalled && (
                        <span
                          className="badge"
                          style={{
                            background: "rgba(244, 63, 94, 0.15)",
                            color: "var(--accent-danger)",
                            fontSize: "0.68rem",
                            padding: "0.1rem 0.4rem",
                            border: "1px solid rgba(244, 63, 94, 0.3)",
                          }}
                        >
                          <AlertTriangle size={10} /> STALLED
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        color: "var(--text-secondary)",
                        marginTop: "0.25rem",
                        maxWidth: 280,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        fontSize: "0.82rem",
                      }}
                      title={c.title}
                    >
                      {c.title}
                    </div>
                  </td>

                  <td>
                    <div style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                      {c.category.replace(/_/g, " ")}
                    </div>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: "0.15rem" }}>
                      {c.location}
                    </div>
                  </td>

                  <td>
                    <PriorityBadge priority={c.priority} />
                  </td>

                  <td>
                    <StatusBadge status={c.status} />
                  </td>

                  <td style={{ color: "var(--text-secondary)", fontSize: "0.82rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--border-highlight)" }} />
                      <span>{c.responsibility || "Unassigned Triage Desk"}</span>
                    </div>
                  </td>

                  <td className="tabular-nums" style={{ color: "var(--text-muted)", fontSize: "0.76rem" }}>
                    {formatDate(c.created_at)}
                  </td>

                  <td style={{ textAlign: "right" }}>
                    <Link
                      href={`/dashboard/complaints/${c.id}`}
                      className="btn btn-secondary"
                      style={{
                        padding: "0.35rem 0.75rem",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.3rem",
                      }}
                    >
                      Inspect
                      <ArrowRight size={12} />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer queue stats */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: "1rem",
          padding: "0 0.5rem",
          fontSize: "0.78rem",
          color: "var(--text-muted)",
        }}
      >
        <div>
          Showing <strong>{filteredComplaints.length}</strong> of <strong>{complaints.length}</strong> operational cases
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Clock size={13} />
          <span>Evaluation interval: 1h periodic / on-demand SLA worker</span>
        </div>
      </div>
    </div>
  );
}
