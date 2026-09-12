"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Recommendation } from "@/types/recommendation";
import { formatDate } from "@/lib/formatting";
import {
  ArrowUpRight,
  CheckCircle2,
  ShieldAlert,
  XCircle,
  Clock,
  Check,
  AlertTriangle,
  X,
  FileCheck,
} from "lucide-react";
import { api } from "@/services/api/client";
import { useToast } from "@/components/ui/ToastProvider";

interface RecommendationCardProps {
  recommendation: Recommendation;
  onActionComplete?: () => void;
}

export function RecommendationCard({ recommendation, onActionComplete }: RecommendationCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"APPROVE" | "REJECT">("APPROVE");
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const toast = useToast();
  const isPending = recommendation.status === "PENDING";

  const openModal = (mode: "APPROVE" | "REJECT") => {
    setModalMode(mode);
    setComment("");
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleApprove = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    const res = await api.approveRecommendation(recommendation.id, comment);
    setIsSubmitting(false);

    if (res.success) {
      setIsModalOpen(false);
      toast.success(
        "Consequential Action Authorized",
        `Case #${recommendation.complaint_id || ""} escalation dispatched to civic adapter.`
      );
      if (onActionComplete) onActionComplete();
    } else {
      const err = res.error?.message || "Failed to execute approval";
      setErrorMsg(err);
      toast.error("Authorization Failed", err);
    }
  };

  const handleReject = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    const res = await api.rejectRecommendation(
      recommendation.id,
      comment || "Rejected by authorized operator"
    );
    setIsSubmitting(false);

    if (res.success) {
      setIsModalOpen(false);
      toast.info(
        "Recommendation Rejected",
        `Case #${recommendation.complaint_id || ""} escalation dismissed by operator.`
      );
      if (onActionComplete) onActionComplete();
    } else {
      const err = res.error?.message || "Failed to reject recommendation";
      setErrorMsg(err);
      toast.error("Rejection Failed", err);
    }
  };

  return (
    <>
      <div
        className="glass-panel"
        style={{
          padding: "1.4rem",
          position: "relative",
          border: isPending
            ? "1px solid var(--border-subtle)"
            : "1px solid rgba(16, 185, 129, 0.25)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-sm)",
          transition: "border-color 0.2s ease, box-shadow 0.2s ease",
        }}
      >
        {/* Card Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "1rem",
            marginBottom: "0.85rem",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
              <span
                className="badge"
                style={{
                  background: isPending ? "rgba(244, 63, 94, 0.12)" : "rgba(16, 185, 129, 0.12)",
                  color: isPending ? "var(--accent-danger)" : "var(--accent-primary)",
                  border: isPending
                    ? "1px solid rgba(244, 63, 94, 0.25)"
                    : "1px solid rgba(16, 185, 129, 0.25)",
                  fontWeight: 700,
                  fontSize: "0.72rem",
                  letterSpacing: "0.03em",
                }}
              >
                <ShieldAlert size={12} />
                {recommendation.type.replace(/_/g, " ")}
              </span>

              <span
                style={{
                  fontSize: "0.72rem",
                  color: isPending ? "var(--accent-warning)" : "var(--text-muted)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {recommendation.status}
              </span>
            </div>

            {recommendation.complaint_id && (
              <Link
                href={`/dashboard/complaints/${recommendation.complaint_id}`}
                style={{
                  fontSize: "0.92rem",
                  color: "var(--text-accent)",
                  textDecoration: "none",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.3rem",
                }}
              >
                Case #{recommendation.complaint_id}: {recommendation.complaint_title || "Civic Case Dossier"}
                <ArrowUpRight size={14} />
              </Link>
            )}
          </div>

          <span
            className="tabular-nums"
            style={{
              fontSize: "0.74rem",
              color: "var(--text-muted)",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
            }}
          >
            <Clock size={12} />
            {formatDate(recommendation.created_at)}
          </span>
        </div>

        {/* Reason / Narrative */}
        <p
          style={{
            fontSize: "0.92rem",
            color: "var(--text-primary)",
            marginBottom: "0.85rem",
            lineHeight: 1.55,
          }}
        >
          {recommendation.reason}
        </p>

        {/* Evidence List */}
        {recommendation.evidence && recommendation.evidence.length > 0 && (
          <div
            style={{
              background: "var(--bg-nested)",
              border: "1px solid var(--border-subtle)",
              padding: "0.85rem 1rem",
              borderRadius: "var(--radius-md)",
              marginBottom: "1.1rem",
            }}
          >
            <div
              className="micro-label"
              style={{
                marginBottom: "0.45rem",
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                color: "var(--text-accent)",
              }}
            >
              <FileCheck size={13} />
              Grounded Evidence & Verified Facts:
            </div>
            <ul
              style={{
                paddingLeft: "0.2rem",
                margin: 0,
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: "0.35rem",
              }}
            >
              {recommendation.evidence.map((ev, i) => (
                <li
                  key={i}
                  style={{
                    fontSize: "0.82rem",
                    color: "var(--text-secondary)",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.45rem",
                    lineHeight: 1.45,
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: "var(--accent-primary)",
                      marginTop: "0.45rem",
                      flexShrink: 0,
                    }}
                  />
                  <span>{ev}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions Bar */}
        {isPending ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => openModal("APPROVE")}
              className="btn btn-primary"
              style={{
                padding: "0.48rem 1rem",
                fontSize: "0.82rem",
                fontWeight: 600,
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <Check size={14} />
              Review & Authorize Action
            </button>

            <button
              type="button"
              onClick={() => openModal("REJECT")}
              className="btn btn-secondary"
              style={{
                padding: "0.48rem 0.9rem",
                fontSize: "0.82rem",
                color: "var(--accent-danger)",
              }}
            >
              <XCircle size={14} />
              Reject
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.45rem",
              fontSize: "0.8rem",
              color: recommendation.status === "APPROVED" || recommendation.status === "EXECUTED"
                ? "var(--accent-primary)"
                : "var(--text-muted)",
              fontWeight: 600,
              padding: "0.4rem 0.75rem",
              background: "var(--bg-nested)",
              borderRadius: "var(--radius-sm)",
              width: "fit-content",
            }}
          >
            <CheckCircle2 size={14} /> Action status: {recommendation.status}
          </div>
        )}
      </div>

      {/* Styled Medium Modal for Approval / Rejection */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(10, 15, 29, 0.65)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmitting) setIsModalOpen(false);
          }}
        >
          <div
            className="modal-content"
            style={{
              background: "var(--bg-card-elevated)",
              border: "1px solid var(--border-highlight)",
              borderRadius: "var(--radius-lg)",
              padding: "1.75rem",
              maxWidth: "540px",
              width: "100%",
              boxShadow: "var(--shadow-lg)",
              position: "relative",
            }}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => !isSubmitting && setIsModalOpen(false)}
              disabled={isSubmitting}
              style={{
                position: "absolute",
                top: "1.25rem",
                right: "1.25rem",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--text-muted)",
                padding: "0.35rem",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <X size={18} />
            </button>

            {/* Modal Title */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", marginBottom: "0.6rem" }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "var(--radius-md)",
                  background: modalMode === "APPROVE" ? "rgba(16, 185, 129, 0.15)" : "rgba(244, 63, 94, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: modalMode === "APPROVE" ? "var(--accent-primary)" : "var(--accent-danger)",
                }}
              >
                {modalMode === "APPROVE" ? <ShieldAlert size={20} /> : <AlertTriangle size={20} />}
              </div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                {modalMode === "APPROVE"
                  ? "Authorize Consequential Civic Action"
                  : "Reject AI Recommendation"}
              </h3>
            </div>

            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--text-secondary)",
                marginBottom: "1rem",
                lineHeight: 1.5,
              }}
            >
              {modalMode === "APPROVE"
                ? "Awwaz requires explicit human authorization for external department escalations. Approving this invokes the Civic Service Adapter and records an auditable timeline block."
                : "Rejecting this recommendation prevents automatic escalation. A reason note will be recorded to the immutable ledger."}
            </p>

            {/* Recommendation summary card */}
            <div
              style={{
                background: "var(--bg-nested)",
                border: "1px solid var(--border-subtle)",
                padding: "0.85rem 1rem",
                borderRadius: "var(--radius-md)",
                marginBottom: "1rem",
                fontSize: "0.82rem",
              }}
            >
              <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.25rem" }}>
                Target Action:
              </div>
              <div style={{ color: "var(--text-secondary)", lineHeight: 1.45 }}>
                {recommendation.reason}
              </div>
            </div>

            {/* Note Input */}
            <div style={{ marginBottom: "1.25rem" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  color: "var(--text-secondary)",
                  marginBottom: "0.35rem",
                  fontWeight: 600,
                }}
              >
                {modalMode === "APPROVE"
                  ? "Operator Verification Note (Optional):"
                  : "Reason for Rejection (Required):"}
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={
                  modalMode === "APPROVE"
                    ? "Verified on-site conditions match SLA threshold; approved for field unit dispatch..."
                    : "Duplicate case / field team already on route..."
                }
                className="input-field"
                rows={3}
                style={{ resize: "none", width: "100%", fontSize: "0.85rem" }}
              />
            </div>

            {errorMsg && (
              <div
                style={{
                  color: "var(--accent-danger)",
                  fontSize: "0.8rem",
                  marginBottom: "1rem",
                  padding: "0.6rem 0.85rem",
                  background: "rgba(244, 63, 94, 0.12)",
                  border: "1px solid rgba(244, 63, 94, 0.3)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                {errorMsg}
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
                className="btn btn-secondary"
                style={{ fontSize: "0.82rem", padding: "0.45rem 0.95rem" }}
              >
                Cancel
              </button>

              {modalMode === "APPROVE" ? (
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isSubmitting}
                  className="btn btn-primary"
                  style={{ fontSize: "0.82rem", padding: "0.45rem 1rem" }}
                >
                  {isSubmitting ? "Executing Escalation..." : "Confirm & Execute Escalation"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={isSubmitting}
                  className="btn btn-danger"
                  style={{ fontSize: "0.82rem", padding: "0.45rem 1rem" }}
                >
                  {isSubmitting ? "Rejecting..." : "Confirm Rejection"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
