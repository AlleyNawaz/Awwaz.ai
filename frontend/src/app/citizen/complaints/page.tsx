"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/services/api/client";
import { ComplaintSummary } from "@/types/complaint";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { formatDate } from "@/lib/formatting";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  ListFilter,
  Plus,
  ArrowRight,
  MapPin,
  Building2,
  Search,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
} from "lucide-react";

export default function CitizenComplaintsPage() {
  const [complaints, setComplaints] = useState<ComplaintSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusTab, setStatusTab] = useState<"ALL" | "ACTIVE" | "RESOLVED">("ALL");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await api.getComplaints();
      if (res.success && res.data) {
        setComplaints(res.data);
      }
      setLoading(false);
    }
    load();
  }, []);

  const totalCount = complaints.length;
  const activeCount = complaints.filter(
    (c) => c.status !== "RESOLVED" && c.status !== "CLOSED"
  ).length;
  const resolvedCount = complaints.filter(
    (c) => c.status === "RESOLVED" || c.status === "CLOSED"
  ).length;

  const filteredComplaints = complaints.filter((c) => {
    if (statusTab === "ACTIVE" && (c.status === "RESOLVED" || c.status === "CLOSED")) return false;
    if (statusTab === "RESOLVED" && !(c.status === "RESOLVED" || c.status === "CLOSED")) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q) ||
      c.location.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "2.5rem 1.5rem 3.5rem" }}>
      {/* Page Header */}
      <PageHeader
        title="Citizen Complaints & Tracking"
        subtitle="Track the real-time lifecycle, SLA commitments, and field progress of your reported municipal problems."
        badge={
          <span
            className="badge"
            style={{
              background: activeCount > 0 ? "rgba(245, 158, 11, 0.15)" : "rgba(16, 185, 129, 0.15)",
              color: activeCount > 0 ? "var(--accent-warning)" : "var(--accent-primary)",
            }}
          >
            {activeCount > 0 ? `${activeCount} ACTIVE CASES` : "ALL CASES RESOLVED"}
          </span>
        }
        breadcrumbs={[
          { label: "Intake", href: "/citizen" },
          { label: "My Reported Cases" },
        ]}
        actions={
          <Link href="/citizen" className="btn btn-primary" style={{ fontSize: "0.85rem" }}>
            <Plus size={16} /> Report New Issue
          </Link>
        }
      />

      {/* Top Metrics Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1.25rem",
          marginBottom: "2rem",
        }}
      >
        <StatCard
          label="Total Reports"
          value={totalCount}
          subtitle="Lifetime civic submissions"
          icon={<Layers size={20} />}
          accentColor="var(--accent-primary)"
        />
        <StatCard
          label="Active In-Progress"
          value={activeCount}
          subtitle="Currently undergoing field work"
          icon={<Clock size={20} />}
          accentColor="#38bdf8"
        />
        <StatCard
          label="Resolved & Closed"
          value={resolvedCount}
          subtitle="Verified complete by citizens"
          icon={<CheckCircle2 size={20} />}
          accentColor="var(--accent-teal)"
        />
      </div>

      {/* Filter & Search Toolbar */}
      <div
        className="glass-panel"
        style={{
          padding: "0.85rem 1.15rem",
          marginBottom: "1.75rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.85rem",
          borderRadius: "var(--radius-lg)",
        }}
      >
        <div style={{ position: "relative", flex: "1 1 240px" }}>
          <Search
            size={16}
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
            }}
          />
          <input
            type="text"
            placeholder="Search by case ID, problem title, or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field"
            style={{ paddingLeft: "2.4rem", fontSize: "0.85rem", width: "100%" }}
          />
        </div>

        {/* Segmented Filter Control */}
        <div className="segmented-control">
          {(["ALL", "ACTIVE", "RESOLVED"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusTab(tab)}
              className={`segmented-item ${statusTab === tab ? "segmented-item-active" : ""}`}
            >
              {tab === "ALL"
                ? `All (${totalCount})`
                : tab === "ACTIVE"
                ? `Active (${activeCount})`
                : `Resolved (${resolvedCount})`}
            </button>
          ))}
        </div>
      </div>

      {/* List Container */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="skeleton" style={{ height: 110, borderRadius: "var(--radius-lg)" }} />
          <div className="skeleton" style={{ height: 110, borderRadius: "var(--radius-lg)" }} />
          <div className="skeleton" style={{ height: 110, borderRadius: "var(--radius-lg)" }} />
        </div>
      ) : filteredComplaints.length === 0 ? (
        <EmptyState
          icon={<ListFilter size={32} />}
          title="No Matching Complaints Found"
          description={
            complaints.length === 0
              ? "You have not submitted any civic complaints yet. Use the intake assistant to report any municipal issues."
              : "No cases match your search query or filter selection."
          }
          action={
            complaints.length === 0 ? (
              <Link href="/citizen" className="btn btn-primary">
                Report a Civic Issue Now
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {filteredComplaints.map((c) => (
            <Link
              key={c.id}
              href={`/citizen/complaints/${c.id}`}
              style={{ textDecoration: "none" }}
            >
              <div
                className="glass-panel glass-panel-hover"
                style={{
                  padding: "1.35rem",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "1rem",
                    marginBottom: "0.6rem",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                      <span
                        className="tabular-nums"
                        style={{
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          color: "var(--text-accent)",
                          background: "var(--bg-nested)",
                          padding: "0.15rem 0.45rem",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--border-subtle)",
                        }}
                      >
                        #{c.id}
                      </span>
                      <StatusBadge status={c.status} />
                      <PriorityBadge priority={c.priority} />
                    </div>

                    <h3
                      style={{
                        fontSize: "1.1rem",
                        fontWeight: 700,
                        color: "var(--text-primary)",
                        margin: 0,
                      }}
                    >
                      {c.title}
                    </h3>
                  </div>

                  <span
                    className="tabular-nums"
                    style={{ fontSize: "0.75rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}
                  >
                    {formatDate(c.created_at)}
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "1.25rem",
                    fontSize: "0.82rem",
                    color: "var(--text-secondary)",
                    marginTop: "0.85rem",
                    borderTop: "1px solid var(--border-subtle)",
                    paddingTop: "0.75rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <MapPin size={14} color="#38bdf8" />
                    <span>{c.location}</span>
                  </div>

                  {c.department && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      <Building2 size={14} color="#a78bfa" />
                      <span>{c.department}</span>
                    </div>
                  )}

                  <div
                    style={{
                      marginLeft: "auto",
                      color: "var(--text-accent)",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem",
                    }}
                  >
                    Track Progress <ArrowRight size={14} />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
