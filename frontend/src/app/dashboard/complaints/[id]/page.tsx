"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/services/api/client";
import { ComplaintDetail } from "@/types/complaint";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { CaseTimeline } from "@/components/timeline/CaseTimeline";
import { RecommendationCard } from "@/components/approvals/RecommendationCard";
import { RelatedCasePanel } from "@/components/recurrence/RelatedCasePanel";
import { AgentTrace } from "@/components/agent/AgentTrace";
import { formatDate } from "@/lib/formatting";
import { getActiveUser, setActiveUser } from "@/lib/auth";
import { useToast } from "@/components/ui/ToastProvider";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Clock,
  Shield,
  AlertTriangle,
  Plus,
  CheckCircle2,
  Camera,
  Activity,
  History,
  Upload,
  FileText,
  ExternalLink,
  AlertCircle,
  Copy,
  Check,
  Calendar,
  Layers,
  Sparkles,
} from "lucide-react";

export default function OperatorComplaintDetailPage() {
  const params = useParams();
  const complaintId = params?.id as string;
  const toast = useToast();

  const [complaint, setComplaint] = useState<ComplaintDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRole] = useState("OPERATOR");
  const [copiedId, setCopiedId] = useState(false);

  // Evidence state
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Transition state
  const [targetStatus, setTargetStatus] = useState("");
  const [transitionReason, setTransitionReason] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Commitment state
  const [commitmentDesc, setCommitmentDesc] = useState("");
  const [commitmentHours, setCommitmentHours] = useState("24");
  const [isAddingCommitment, setIsAddingCommitment] = useState(false);
  const [showCommitmentForm, setShowCommitmentForm] = useState(false);

  const loadCase = async () => {
    if (!complaintId) return;
    setLoading(true);
    const res = await api.getComplaint(complaintId);
    if (res.success && res.data) {
      setComplaint(res.data);
    } else {
      toast.error("Case Load Error", res.error?.message || "Could not retrieve case record");
    }
    setLoading(false);
  };

  useEffect(() => {
    const user = getActiveUser();
    if (user) setActiveRole(user.role);
    loadCase();
  }, [complaintId]);

  const handleCopyId = () => {
    if (!complaint) return;
    navigator.clipboard.writeText(complaint.id);
    setCopiedId(true);
    toast.info("Copied to Clipboard", `Case ID ${complaint.id} copied.`);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleStatusTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetStatus || !complaint) return;
    setIsUpdatingStatus(true);

    const res = await api.updateComplaintStatus(
      complaint.id,
      targetStatus,
      transitionReason,
      complaint.version
    );
    setIsUpdatingStatus(false);

    if (res.success) {
      toast.success(
        "State Transition Applied",
        `Case advanced from ${complaint.status} to ${targetStatus}.`
      );
      setTargetStatus("");
      setTransitionReason("");
      loadCase();
    } else {
      toast.error("Transition Failed", res.error?.message || "Failed to update state");
    }
  };

  const handleAddCommitment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commitmentDesc || !complaint) return;
    setIsAddingCommitment(true);

    const dueAt = new Date(Date.now() + parseInt(commitmentHours) * 3600 * 1000).toISOString();
    const res = await api.createCommitment(complaint.id, commitmentDesc, dueAt, "VISIT");
    setIsAddingCommitment(false);

    if (res.success) {
      toast.success("Commitment Registered", `Due in ${commitmentHours}h: "${commitmentDesc}"`);
      setCommitmentDesc("");
      setShowCommitmentForm(false);
      loadCase();
    } else {
      toast.error("Commitment Failed", res.error?.message || "Failed to record commitment");
    }
  };

  const handleFulfillCommitment = async (commitmentId: string) => {
    if (!complaint) return;
    const res = await api.fulfillCommitment(complaint.id, commitmentId);
    if (res.success) {
      toast.success("Commitment Fulfilled", "Operational promise marked as verified & completed.");
      loadCase();
    } else {
      toast.error("Action Failed", res.error?.message || "Failed to mark commitment fulfilled");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !complaint) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File Too Large", "Uploaded evidence must be under 10MB limit.");
      return;
    }
    setIsUploading(true);
    const res = await api.uploadEvidence(complaint.id, file);
    setIsUploading(false);

    if (res.success) {
      toast.success("Evidence Attached", `File "${file.name}" cryptographically linked to dossier.`);
      loadCase();
    } else {
      toast.error("Upload Failed", res.error?.message || "Failed to upload photo evidence");
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "2.5rem 1.5rem" }}>
        <div className="skeleton" style={{ height: 32, width: 200, marginBottom: "1.5rem" }} />
        <div className="skeleton" style={{ height: 180, marginBottom: "1.5rem" }} />
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem" }}>
          <div className="skeleton" style={{ height: 450 }} />
          <div className="skeleton" style={{ height: 450 }} />
        </div>
      </div>
    );
  }

  if (!complaint) {
    return (
      <div style={{ maxWidth: 640, margin: "4rem auto", padding: "2.5rem", textAlign: "center" }} className="glass-panel">
        <AlertCircle size={40} color="var(--accent-danger)" style={{ margin: "0 auto 1rem" }} />
        <h3 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>Case Not Found</h3>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", marginBottom: "1.5rem" }}>
          The requested complaint identifier does not match any record in the deterministic repository.
        </p>
        <Link href="/dashboard" className="btn btn-primary">
          Return to Command Center
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "2rem 1.5rem 3.5rem" }}>
      {/* Top Breadcrumb Trail */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
          <Link
            href="/dashboard"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              color: "var(--text-secondary)",
              textDecoration: "none",
            }}
          >
            <ArrowLeft size={14} /> Command Center
          </Link>
          <span>/</span>
          <span style={{ color: "var(--text-muted)" }}>Cases</span>
          <span>/</span>
          <span className="tabular-nums" style={{ color: "var(--text-primary)", fontWeight: 600 }}>
            #{complaint.id}
          </span>
        </div>

        <button
          type="button"
          onClick={handleCopyId}
          className="btn btn-secondary"
          style={{ fontSize: "0.75rem", padding: "0.3rem 0.65rem" }}
          title="Copy Case Identifier"
        >
          {copiedId ? <Check size={13} color="var(--accent-primary)" /> : <Copy size={13} />}
          <span className="tabular-nums">ID: {complaint.id}</span>
        </button>
      </div>

      {/* Citizen role banner if applicable */}
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
            <AlertTriangle size={20} style={{ flexShrink: 0 }} />
            <div>
              <strong>Read-Only Mode:</strong> Viewing as Citizen (Tariq). Switch to <strong>Operator (Fatima)</strong> to transition state or fulfill commitments.
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

      {/* Case Header Hero Dossier */}
      <div
        className="glass-panel"
        style={{
          padding: "1.75rem",
          marginBottom: "1.75rem",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "1rem",
            marginBottom: "1rem",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
              <span
                className="tabular-nums"
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  color: "var(--text-accent)",
                  background: "var(--bg-nested)",
                  padding: "0.15rem 0.5rem",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                Case #{complaint.id}
              </span>

              <StatusBadge status={complaint.status} />
              <PriorityBadge priority={complaint.priority} />

              {complaint.stalled && (
                <span
                  className="badge"
                  style={{
                    background: "rgba(239, 68, 68, 0.15)",
                    color: "var(--accent-danger)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    fontWeight: 700,
                  }}
                >
                  <AlertTriangle size={12} /> Stalled (&gt;72h without progress)
                </span>
              )}

              <span className="tabular-nums" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Version: v{complaint.version}
              </span>
            </div>

            <h1 style={{ fontSize: "1.65rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.5rem", lineHeight: 1.3 }}>
              {complaint.title}
            </h1>
          </div>

          {complaint.external_reference && (
            <div
              style={{
                background: "rgba(52, 211, 153, 0.12)",
                border: "1px solid rgba(52, 211, 153, 0.3)",
                borderRadius: "var(--radius-md)",
                padding: "0.55rem 0.9rem",
                fontSize: "0.82rem",
                color: "var(--accent-teal)",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <CheckCircle2 size={16} />
              <span>Civic External Ref: <strong>{complaint.external_reference}</strong></span>
            </div>
          )}
        </div>

        <p style={{ fontSize: "0.95rem", color: "var(--text-secondary)", lineHeight: 1.65, marginBottom: "1.5rem" }}>
          {complaint.description}
        </p>

        {/* Operational Attributes Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1rem",
            background: "var(--bg-nested)",
            border: "1px solid var(--border-subtle)",
            padding: "1.1rem",
            borderRadius: "var(--radius-md)",
          }}
        >
          <div>
            <div className="micro-label" style={{ marginBottom: "0.3rem" }}>Department & Agency:</div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--text-primary)", fontWeight: 600, fontSize: "0.88rem" }}>
              <Building2 size={15} color="#a78bfa" />
              {complaint.department?.name || complaint.category}
            </div>
          </div>

          <div>
            <div className="micro-label" style={{ marginBottom: "0.3rem" }}>Responsible Desk:</div>
            <div style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: "0.88rem" }}>
              {complaint.responsibility_name || "Unassigned Operations Desk"}
            </div>
          </div>

          <div>
            <div className="micro-label" style={{ marginBottom: "0.3rem" }}>Physical Location:</div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--text-primary)", fontWeight: 600, fontSize: "0.88rem" }}>
              <MapPin size={15} color="#38bdf8" />
              {complaint.location_text}
            </div>
          </div>

          <div>
            <div className="micro-label" style={{ marginBottom: "0.3rem" }}>Last Verified Progress:</div>
            <div className="tabular-nums" style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: "0.88rem" }}>
              {formatDate(complaint.last_progress_at)}
            </div>
          </div>
        </div>
      </div>

      {/* Main 2-Column Responsive Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "1.75rem", alignItems: "start" }}>
        {/* Left Column (Dossier & History) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
          {/* Case Evidence & Media */}
          <div className="glass-panel" style={{ padding: "1.5rem", borderRadius: "var(--radius-lg)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Camera size={18} color="var(--accent-primary)" />
                <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0 }}>
                  Case Evidence & Field Media ({complaint.evidence?.length || 0})
                </h3>
              </div>

              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                  id="operator-evidence-upload"
                  disabled={isUploading}
                />
                <label
                  htmlFor="operator-evidence-upload"
                  className="btn btn-secondary"
                  style={{
                    fontSize: "0.8rem",
                    padding: "0.4rem 0.85rem",
                    cursor: isUploading ? "not-allowed" : "pointer",
                  }}
                >
                  <Upload size={14} />
                  {isUploading ? "Uploading..." : "Attach Photo / Report"}
                </label>
              </div>
            </div>

            {complaint.evidence && complaint.evidence.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.85rem" }}>
                {complaint.evidence.map((ev) => (
                  <div
                    key={ev.id}
                    style={{
                      padding: "0.85rem 1rem",
                      background: "var(--bg-nested)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-md)",
                      fontSize: "0.82rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.75rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", overflow: "hidden" }}>
                      <FileText size={18} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                      <div style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                        <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{ev.filename}</div>
                        <div className="tabular-nums" style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                          {Math.round(ev.size_bytes / 1024)} KB • {ev.mime_type.split("/")[1]?.toUpperCase()}
                        </div>
                      </div>
                    </div>

                    <a
                      href={`/api/v1/evidence/${ev.storage_key}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary"
                      style={{
                        padding: "0.3rem 0.55rem",
                        fontSize: "0.75rem",
                        display: "flex",
                        alignItems: "center",
                      }}
                      title="Inspect evidence asset"
                    >
                      <ExternalLink size={13} />
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontStyle: "italic", padding: "0.75rem 0" }}>
                No media or photo evidence attached to this case dossier yet.
              </div>
            )}
          </div>

          {/* Append-Only Case Timeline */}
          <div className="glass-panel" style={{ padding: "1.5rem", borderRadius: "var(--radius-lg)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <History size={18} color="#38bdf8" />
                <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0 }}>
                  Append-Only Audit Timeline ({complaint.events?.length || 0})
                </h3>
              </div>
              <span className="badge" style={{ background: "rgba(56, 189, 248, 0.12)", color: "#38bdf8" }}>
                Cryptographic Anchor Enforced
              </span>
            </div>

            <CaseTimeline events={complaint.events} />
          </div>

          {/* Observable Agent Trace */}
          <AgentTrace complaintId={complaint.id} />
        </div>

        {/* Right Column (Operational Controls & Recommendations) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
          {/* Operational State Control Box */}
          <div className="glass-panel" style={{ padding: "1.5rem", borderRadius: "var(--radius-lg)" }}>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Activity size={17} color="var(--accent-primary)" />
              Operational State Control
            </h3>

            {/* Advance Case State */}
            <form onSubmit={handleStatusTransition} style={{ marginBottom: "1.25rem" }}>
              <div className="micro-label" style={{ marginBottom: "0.45rem" }}>Advance Case State:</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  className="input-field"
                  style={{ fontSize: "0.85rem", width: "100%" }}
                >
                  <option value="">Select target state...</option>
                  <option value="SUBMITTED">SUBMITTED (Registered to intake)</option>
                  <option value="ACKNOWLEDGED">ACKNOWLEDGED (Awaiting coordinator)</option>
                  <option value="ASSIGNED">ASSIGNED (Assigned to coordinator)</option>
                  <option value="IN_PROGRESS">IN_PROGRESS (Team dispatched)</option>
                  <option value="WAITING_FOR_CITIZEN">WAITING_FOR_CITIZEN (Info needed)</option>
                  <option value="RESOLVED">RESOLVED (Work verified)</option>
                  <option value="CLOSED">CLOSED (Case completed)</option>
                </select>

                <input
                  type="text"
                  placeholder="Reason / Transition note (optional)..."
                  value={transitionReason}
                  onChange={(e) => setTransitionReason(e.target.value)}
                  className="input-field"
                  style={{ fontSize: "0.85rem", width: "100%" }}
                />

                <button
                  type="submit"
                  disabled={!targetStatus || isUpdatingStatus}
                  className="btn btn-primary"
                  style={{ width: "100%", fontSize: "0.85rem", padding: "0.55rem" }}
                >
                  {isUpdatingStatus ? "Applying Transition..." : "Commit State Transition"}
                </button>
              </div>
            </form>

            {/* Commitments & SLA Section */}
            <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "1.1rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.85rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                  <Clock size={15} color="#fbbf24" />
                  <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>
                    Operational Commitments ({complaint.commitments?.length || 0})
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCommitmentForm(!showCommitmentForm)}
                  className="btn btn-secondary"
                  style={{ padding: "0.3rem 0.65rem", fontSize: "0.75rem" }}
                >
                  <Plus size={13} /> Add SLA Promise
                </button>
              </div>

              {showCommitmentForm && (
                <form
                  onSubmit={handleAddCommitment}
                  style={{
                    background: "var(--bg-nested)",
                    border: "1px solid var(--border-subtle)",
                    padding: "0.85rem",
                    borderRadius: "var(--radius-md)",
                    marginBottom: "0.85rem",
                  }}
                >
                  <input
                    type="text"
                    placeholder="E.g. Field team will inspect sewer line..."
                    value={commitmentDesc}
                    onChange={(e) => setCommitmentDesc(e.target.value)}
                    className="input-field"
                    style={{ fontSize: "0.82rem", marginBottom: "0.6rem", width: "100%" }}
                  />
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem" }}>
                      <span>Window:</span>
                      <select
                        value={commitmentHours}
                        onChange={(e) => setCommitmentHours(e.target.value)}
                        className="input-field"
                        style={{ width: "auto", padding: "0.25rem 0.5rem", fontSize: "0.78rem" }}
                      >
                        <option value="12">12 Hours</option>
                        <option value="24">24 Hours</option>
                        <option value="48">48 Hours</option>
                        <option value="72">72 Hours</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={isAddingCommitment || !commitmentDesc}
                      className="btn btn-primary"
                      style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem" }}
                    >
                      {isAddingCommitment ? "Recording..." : "Record Promise"}
                    </button>
                  </div>
                </form>
              )}

              {complaint.commitments && complaint.commitments.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {complaint.commitments.map((comm) => (
                    <div
                      key={comm.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.65rem 0.85rem",
                        background: "var(--bg-nested)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "0.82rem",
                        gap: "0.5rem",
                      }}
                    >
                      <div style={{ overflow: "hidden" }}>
                        <div style={{ fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {comm.description}
                        </div>
                        <div className="tabular-nums" style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                          Due: {formatDate(comm.due_at)}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexShrink: 0 }}>
                        <span
                          className="badge"
                          style={{
                            background:
                              comm.status === "MISSED"
                                ? "rgba(239, 68, 68, 0.15)"
                                : comm.status === "FULFILLED"
                                ? "rgba(16, 185, 129, 0.15)"
                                : "rgba(245, 158, 11, 0.15)",
                            color:
                              comm.status === "MISSED"
                                ? "var(--accent-danger)"
                                : comm.status === "FULFILLED"
                                ? "var(--accent-primary)"
                                : "var(--accent-warning)",
                            fontWeight: 700,
                            fontSize: "0.72rem",
                          }}
                        >
                          {comm.status}
                        </span>

                        {comm.status === "PENDING" && (
                          <button
                            type="button"
                            onClick={() => handleFulfillCommitment(comm.id)}
                            className="btn btn-secondary"
                            style={{ padding: "0.25rem 0.55rem", fontSize: "0.72rem" }}
                          >
                            Fulfill
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  No active promises or SLA commitments recorded yet.
                </div>
              )}
            </div>
          </div>

          {/* Active AI Recommendations */}
          <div>
            <div className="micro-label" style={{ marginBottom: "0.6rem", color: "var(--accent-danger)" }}>
              Grounded AI Recommendations
            </div>
            {complaint.recommendations && complaint.recommendations.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                {complaint.recommendations.map((rec) => (
                  <RecommendationCard key={rec.id} recommendation={rec} onActionComplete={loadCase} />
                ))}
              </div>
            ) : (
              <div className="glass-panel" style={{ padding: "1.25rem", fontSize: "0.82rem", color: "var(--text-muted)", borderRadius: "var(--radius-md)" }}>
                No active recommendations pending. Evaluator worker checks every operational interval.
              </div>
            )}
          </div>

          {/* Potential Recurrence Panel */}
          <RelatedCasePanel recurrences={complaint.potential_recurrences} />
        </div>
      </div>
    </div>
  );
}
