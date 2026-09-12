"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/services/api/client";
import { getActiveUser, setActiveUser } from "@/lib/auth";
import { formatDate } from "@/lib/formatting";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/ToastProvider";
import {
  Settings,
  ShieldCheck,
  RefreshCw,
  Database,
  Terminal,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Search,
  Filter,
  Building2,
  Layers,
  KeyRound,
  ExternalLink,
} from "lucide-react";

export default function AdminPage() {
  const toast = useToast();

  const [departments, setDepartments] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [activeRole, setActiveRole] = useState("ADMIN");

  // Ledger verification state
  const [ledgerVerification, setLedgerVerification] = useState<any | null>(null);
  const [isVerifyingLedger, setIsVerifyingLedger] = useState(false);

  // Filters
  const [actionFilter, setActionFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");

  const verifyLedger = async () => {
    setIsVerifyingLedger(true);
    const res = await api.verifyAuditLedger();
    setIsVerifyingLedger(false);
    if (res.success && res.data) {
      setLedgerVerification(res.data);
      toast.success(
        "Cryptographic Chain Valid",
        `Verified ${res.data.verified_records_count} blocks anchored from genesis.`
      );
    } else {
      toast.error("Ledger Verification Failed", res.error?.message || "Hash mismatch");
    }
  };

  const loadAdminData = async () => {
    const user = getActiveUser();
    if (user) setActiveRole(user.role);
    setLoading(true);
    const [deptRes, auditRes] = await Promise.all([
      api.getDepartments(),
      api.getAuditLogs({
        action: actionFilter || undefined,
        actor_type: actorFilter || undefined,
        limit: 50,
      }),
    ]);

    if (deptRes.success && deptRes.data) {
      setDepartments(deptRes.data);
    }
    if (auditRes.success && auditRes.data) {
      setAuditLogs(auditRes.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAdminData();
    verifyLedger();
  }, [actionFilter, actorFilter]);

  const handleExecuteReset = async () => {
    setIsResetting(true);
    const res = await api.resetDemo();
    setIsResetting(false);
    setShowResetModal(false);

    if (res.success) {
      toast.success(
        "Baseline Restored",
        "Cases A1024-A1028 and cryptographic hash tree seeded deterministically."
      );
      loadAdminData();
      verifyLedger();
    } else {
      toast.error("Reset Failed", res.error?.message || "Could not restore baseline");
    }
  };

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "2.5rem 1.5rem 3.5rem" }}>
      {/* Role Switcher Banner */}
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
              <strong>Admin Authority Required:</strong> You are currently viewing as Citizen (Tariq). Switch to <strong>Admin (Bilal)</strong> to view audit logs, department routing, and ledger blocks.
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setActiveUser("ADMIN");
              window.location.reload();
            }}
            className="btn btn-primary"
            style={{ padding: "0.35rem 0.85rem", fontSize: "0.8rem", whiteSpace: "nowrap" }}
          >
            <ShieldCheck size={14} /> Switch to Admin (Bilal)
          </button>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="System Administration & Audit"
        subtitle="Cryptographic ledger integrity verification, civic department routing rules, and deterministic baseline management."
        badge={
          <span
            className="badge"
            style={{
              background: ledgerVerification?.status === "VALID" ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
              color: ledgerVerification?.status === "VALID" ? "var(--accent-primary)" : "var(--accent-warning)",
            }}
          >
            {ledgerVerification?.status === "VALID" ? "LEDGER TAMPER-PROOF" : "CHAIN VERIFYING"}
          </span>
        }
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Administration & Audit" },
        ]}
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <button
              type="button"
              onClick={verifyLedger}
              disabled={isVerifyingLedger}
              className="btn btn-secondary"
              style={{ fontSize: "0.82rem", padding: "0.45rem 0.85rem" }}
            >
              <RefreshCw size={14} className={isVerifyingLedger ? "animate-spin" : ""} />
              Re-Verify Chain
            </button>

            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              disabled={isResetting}
              className="btn btn-primary"
              style={{
                fontSize: "0.82rem",
                padding: "0.45rem 0.95rem",
                background: "linear-gradient(135deg, #f59e0b, #d97706)",
                border: "none",
              }}
            >
              <RefreshCw size={14} className={isResetting ? "animate-spin" : ""} />
              {isResetting ? "Resetting..." : "Reset Demo Baseline"}
            </button>
          </div>
        }
      />

      {/* Top Stat Metrics */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1.25rem",
          marginBottom: "2rem",
        }}
      >
        <StatCard
          label="Ledger Integrity"
          value={ledgerVerification?.status === "VALID" ? "SECURE" : "CHECKING"}
          subtitle="SHA-256 sequential hash chain"
          icon={<Lock size={20} />}
          accentColor="var(--accent-primary)"
        />
        <StatCard
          label="Verified Blocks"
          value={ledgerVerification?.verified_records_count ?? auditLogs.length}
          subtitle="Immutable event records"
          icon={<Layers size={20} />}
          accentColor="#38bdf8"
        />
        <StatCard
          label="Routing Departments"
          value={departments.length}
          subtitle="Active municipal jurisdictions"
          icon={<Building2 size={20} />}
          accentColor="#a78bfa"
        />
        <StatCard
          label="Security Protocol"
          value="STRICT"
          subtitle="RBAC & Human-in-the-loop"
          icon={<KeyRound size={20} />}
          accentColor="var(--accent-teal)"
        />
      </div>

      {/* Cryptographic Ledger Verification Hero Panel */}
      <div
        className="glass-panel"
        style={{
          padding: "1.5rem",
          marginBottom: "2rem",
          borderLeft: "4px solid var(--accent-primary)",
          borderRadius: "var(--radius-lg)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", marginBottom: "0.85rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Lock size={18} color="var(--accent-primary)" />
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
              Cryptographic Hash Ledger (PRD §16 Specification)
            </h3>
            <span
              className="badge"
              style={{
                background: "rgba(16, 185, 129, 0.15)",
                color: "var(--accent-primary)",
                fontWeight: 700,
                fontSize: "0.72rem",
              }}
            >
              {ledgerVerification?.status === "VALID" ? "CHAIN VALIDATED" : "INSPECTING"}
            </span>
          </div>

          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
            Algorithm: SHA-256 Canonical Block Hashing
          </span>
        </div>

        <p style={{ fontSize: "0.86rem", color: "var(--text-secondary)", lineHeight: 1.5, margin: "0 0 1.25rem 0" }}>
          Every administrative action, state transition, and commitment execution is hashed and linked sequentially. Any retroactive mutation breaks the genesis proof.
        </p>

        {ledgerVerification && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "1rem",
              background: "var(--bg-nested)",
              border: "1px solid var(--border-subtle)",
              padding: "1rem 1.2rem",
              borderRadius: "var(--radius-md)",
            }}
          >
            <div>
              <div className="micro-label" style={{ marginBottom: "0.25rem" }}>Verified Audit Depth:</div>
              <div className="tabular-nums" style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: "0.95rem" }}>
                {ledgerVerification.verified_records_count} Sequential Blocks
              </div>
            </div>

            <div>
              <div className="micro-label" style={{ marginBottom: "0.25rem" }}>Genesis Root:</div>
              <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-accent)", fontSize: "0.85rem", fontWeight: 600 }}>
                {ledgerVerification.genesis_root}
              </div>
            </div>

            <div style={{ gridColumn: "span 2" }}>
              <div className="micro-label" style={{ marginBottom: "0.25rem" }}>Chain Head Hash (SHA-256):</div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.76rem",
                  color: "#38bdf8",
                  wordBreak: "break-all",
                  background: "var(--bg-nested-alt)",
                  padding: "0.4rem 0.65rem",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                {ledgerVerification.ledger_head_hash}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Grid: Departments (Left) & Audit Trail (Right) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "2rem" }}>
        {/* Left: Department Routing Taxonomy */}
        <div>
          <div className="micro-label" style={{ marginBottom: "0.75rem" }}>
            Configured Civic Department Taxonomy ({departments.length})
          </div>

          <div className="glass-panel" style={{ padding: "1.35rem", borderRadius: "var(--radius-lg)" }}>
            {loading ? (
              <div className="skeleton" style={{ height: 220 }} />
            ) : departments.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No departments loaded.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                {departments.map((dept) => (
                  <div
                    key={dept.id}
                    style={{
                      background: "var(--bg-nested)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-md)",
                      padding: "0.85rem 1rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                      <span style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--text-primary)" }}>
                        {dept.name}
                      </span>
                      <span className="badge" style={{ background: "rgba(56, 189, 248, 0.12)", color: "#38bdf8", fontWeight: 600 }}>
                        {dept.category}
                      </span>
                    </div>

                    {dept.responsibility_chain && (
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.5rem" }}>
                        <div className="micro-label" style={{ marginBottom: "0.3rem" }}>Escalation Chain:</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                          {dept.responsibility_chain.map((link: any, i: number) => (
                            <span
                              key={i}
                              style={{
                                background: "var(--bg-nested-alt)",
                                border: "1px solid var(--border-subtle)",
                                padding: "0.2rem 0.5rem",
                                borderRadius: "var(--radius-sm)",
                                fontWeight: 500,
                              }}
                            >
                              L{link.level}: {link.role}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Tamper-Evident System Audit Trail */}
        <div>
          <div className="micro-label" style={{ marginBottom: "0.75rem" }}>
            Immutable System Audit Trail ({auditLogs.length})
          </div>

          <div className="glass-panel" style={{ padding: "1.35rem", borderRadius: "var(--radius-lg)" }}>
            {/* Filter controls */}
            <div style={{ display: "flex", gap: "0.6rem", marginBottom: "1rem", flexWrap: "wrap" }}>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="input-field"
                style={{ flex: "1 1 160px", fontSize: "0.8rem", padding: "0.35rem 0.65rem" }}
              >
                <option value="">All Actions</option>
                <option value="CREATE_COMPLAINT">CREATE_COMPLAINT</option>
                <option value="TRANSITION_IN_PROGRESS">TRANSITION_IN_PROGRESS</option>
                <option value="TRANSITION_RESOLVED">TRANSITION_RESOLVED</option>
                <option value="TRANSITION_CLOSED">TRANSITION_CLOSED</option>
                <option value="APPROVE_RECOMMENDATION">APPROVE_RECOMMENDATION</option>
                <option value="REJECT_RECOMMENDATION">REJECT_RECOMMENDATION</option>
                <option value="EVIDENCE_ATTACHED">EVIDENCE_ATTACHED</option>
                <option value="COMMITMENT_CREATED">COMMITMENT_CREATED</option>
                <option value="COMMITMENT_FULFILLED">COMMITMENT_FULFILLED</option>
              </select>

              <select
                value={actorFilter}
                onChange={(e) => setActorFilter(e.target.value)}
                className="input-field"
                style={{ width: "auto", minWidth: 120, fontSize: "0.8rem", padding: "0.35rem 0.65rem" }}
              >
                <option value="">All Actors</option>
                <option value="CITIZEN">Citizen</option>
                <option value="OPERATOR">Operator</option>
                <option value="ADMIN">Admin</option>
                <option value="SERVICE">Service</option>
                <option value="SYSTEM">System</option>
              </select>
            </div>

            {loading ? (
              <div className="skeleton" style={{ height: 220 }} />
            ) : auditLogs.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", padding: "2rem 0", textAlign: "center" }}>
                No audit records matching this filter criteria.
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.65rem",
                  maxHeight: "560px",
                  overflowY: "auto",
                  paddingRight: "0.4rem",
                }}
              >
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      background: "var(--bg-nested)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-md)",
                      padding: "0.75rem 0.95rem",
                      fontSize: "0.8rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                      <span style={{ fontWeight: 700, color: "var(--accent-primary)" }}>{log.action}</span>
                      <span className="tabular-nums" style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>
                        {formatDate(log.created_at)}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-secondary)", marginBottom: "0.35rem", fontSize: "0.76rem" }}>
                      <span>Actor: <strong>{log.actor_type}</strong></span>
                      <span>•</span>
                      <span>Resource: <strong>{log.resource_type}</strong></span>
                    </div>

                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "0.73rem",
                          color: "var(--text-secondary)",
                          background: "var(--bg-nested-alt)",
                          border: "1px solid var(--border-subtle)",
                          padding: "0.4rem 0.65rem",
                          borderRadius: "var(--radius-sm)",
                          wordBreak: "break-all",
                        }}
                      >
                        {JSON.stringify(log.metadata)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Styled Medium Confirmation Modal */}
      <ConfirmModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onConfirm={handleExecuteReset}
        title="Reset Deterministic Benchmark Baseline"
        description="This operation restores all civic cases to their initial benchmark state (Cases A1024 - A1028), resets SLA clocks, and recalibrates the SHA-256 cryptographic genesis chain."
        confirmText="Confirm & Restore Baseline"
        cancelText="Cancel"
        variant="warning"
        isLoading={isResetting}
        impactItems={[
          "Re-seeds core cases A1024–A1028 with full progression timelines",
          "Recalibrates SLA clocks and commitment timers",
          "Re-hashes cryptographic genesis chain and audit trail",
          "Purges transient evaluations and test complaints",
        ]}
      />
    </div>
  );
}
