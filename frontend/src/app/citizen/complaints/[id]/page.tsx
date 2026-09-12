"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/services/api/client";
import { ComplaintDetail } from "@/types/complaint";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { CaseTimeline } from "@/components/timeline/CaseTimeline";
import { formatDate } from "@/lib/formatting";
import { useToast } from "@/components/ui/ToastProvider";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Clock,
  Camera,
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
} from "lucide-react";

export default function CitizenComplaintDetailPage() {
  const params = useParams();
  const complaintId = params?.id as string;
  const toast = useToast();

  const [complaint, setComplaint] = useState<ComplaintDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(false);

  // Evidence upload state
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadCase = async () => {
    if (!complaintId) return;
    setLoading(true);
    const res = await api.getComplaint(complaintId);
    if (res.success && res.data) {
      setComplaint(res.data);
    } else {
      toast.error("Case Not Found", res.error?.message || "Failed to load complaint.");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCase();
  }, [complaintId]);

  const handleCopyId = () => {
    if (!complaint) return;
    navigator.clipboard.writeText(complaint.id);
    setCopiedId(true);
    toast.info("Copied Case ID", `Tracking ID ${complaint.id} copied.`);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !complaint) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File Limit Exceeded", "File size exceeds 10 MB limit.");
      return;
    }

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Invalid Format", "Only JPG, PNG, and WebP images are permitted.");
      return;
    }

    setIsUploading(true);
    const res = await api.uploadEvidence(complaint.id, file);
    setIsUploading(false);

    if (res.success) {
      toast.success("Photo Attached", `Evidence '${file.name}' added to case dossier.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadCase();
    } else {
      toast.error("Upload Failed", res.error?.message || "Failed to upload evidence.");
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "2.5rem 1.5rem" }}>
        <div className="skeleton" style={{ height: 32, width: 220, marginBottom: "1.5rem" }} />
        <div className="skeleton" style={{ height: 180, marginBottom: "1.5rem" }} />
        <div className="skeleton" style={{ height: 360 }} />
      </div>
    );
  }

  if (!complaint) {
    return (
      <div style={{ maxWidth: 640, margin: "4rem auto", padding: "2.5rem", textAlign: "center" }} className="glass-panel">
        <AlertCircle size={40} color="var(--accent-danger)" style={{ margin: "0 auto 1rem" }} />
        <h3 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>Complaint Dossier Not Found</h3>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", marginBottom: "1.5rem" }}>
          Unable to locate a complaint with identifier #{complaintId}.
        </p>
        <Link href="/citizen/complaints" className="btn btn-primary">
          Back to My Complaints
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "2.5rem 1.5rem 3.5rem" }}>
      {/* Top Nav Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
        <Link
          href="/citizen/complaints"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            color: "var(--text-secondary)",
            textDecoration: "none",
            fontSize: "0.85rem",
            fontWeight: 500,
          }}
        >
          <ArrowLeft size={16} /> Back to My Complaints
        </Link>

        <button
          type="button"
          onClick={handleCopyId}
          className="btn btn-secondary"
          style={{ fontSize: "0.75rem", padding: "0.3rem 0.65rem" }}
        >
          {copiedId ? <Check size={13} color="var(--accent-primary)" /> : <Copy size={13} />}
          <span className="tabular-nums">Copy ID: {complaint.id}</span>
        </button>
      </div>

      {/* Case Header Card */}
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
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.45rem" }}>
              <span
                className="tabular-nums"
                style={{
                  fontSize: "0.82rem",
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
            </div>

            <h1
              style={{
                fontSize: "1.6rem",
                fontWeight: 700,
                color: "var(--text-primary)",
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              {complaint.title}
            </h1>
          </div>

          {complaint.external_reference && (
            <div
              style={{
                background: "rgba(52, 211, 153, 0.12)",
                border: "1px solid rgba(52, 211, 153, 0.3)",
                borderRadius: "var(--radius-md)",
                padding: "0.5rem 0.85rem",
                fontSize: "0.82rem",
                color: "var(--accent-teal)",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <CheckCircle2 size={15} />
              Civic External Ref: <strong>{complaint.external_reference}</strong>
            </div>
          )}
        </div>

        <p style={{ fontSize: "0.95rem", color: "var(--text-secondary)", lineHeight: 1.65, marginBottom: "1.5rem" }}>
          {complaint.description}
        </p>

        {/* Metadata Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
            background: "var(--bg-nested)",
            padding: "1.1rem",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div>
            <div className="micro-label" style={{ marginBottom: "0.3rem" }}>Location:</div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "var(--text-primary)", fontWeight: 600, fontSize: "0.88rem" }}>
              <MapPin size={15} color="#38bdf8" />
              {complaint.location_text}
            </div>
          </div>

          <div>
            <div className="micro-label" style={{ marginBottom: "0.3rem" }}>Assigned Department:</div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "var(--text-primary)", fontWeight: 600, fontSize: "0.88rem" }}>
              <Building2 size={15} color="#a78bfa" />
              {complaint.department?.name || "General Civic Services"}
            </div>
          </div>

          <div>
            <div className="micro-label" style={{ marginBottom: "0.3rem" }}>Responsible Desk:</div>
            <div style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: "0.88rem" }}>
              {complaint.responsibility_name || "Department Triage Desk"}
            </div>
          </div>

          <div>
            <div className="micro-label" style={{ marginBottom: "0.3rem" }}>Submitted On:</div>
            <div className="tabular-nums" style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: "0.88rem" }}>
              {formatDate(complaint.created_at)}
            </div>
          </div>
        </div>
      </div>

      {/* Evidence Panel & Upload */}
      <div
        className="glass-panel"
        style={{
          padding: "1.5rem",
          marginBottom: "1.75rem",
          borderRadius: "var(--radius-lg)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
            <Camera size={18} color="var(--accent-primary)" />
            <h4 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0 }}>
              Photo Evidence ({complaint.evidence?.length || 0}/3)
            </h4>
          </div>

          <div>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileUpload}
              style={{ display: "none" }}
              id="citizen-evidence-upload"
              disabled={isUploading || (complaint.evidence?.length || 0) >= 3}
            />
            <label
              htmlFor="citizen-evidence-upload"
              className="btn btn-secondary"
              style={{
                fontSize: "0.8rem",
                padding: "0.4rem 0.85rem",
                cursor: isUploading || (complaint.evidence?.length || 0) >= 3 ? "not-allowed" : "pointer",
                opacity: (complaint.evidence?.length || 0) >= 3 ? 0.6 : 1,
              }}
            >
              <Upload size={14} />
              {isUploading ? "Uploading..." : "Attach Photo Evidence"}
            </label>
          </div>
        </div>

        {complaint.evidence && complaint.evidence.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.85rem" }}>
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
                <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", overflow: "hidden" }}>
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
                    display: "flex",
                    alignItems: "center",
                  }}
                  title="Open evidence file"
                >
                  <ExternalLink size={13} />
                </a>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontStyle: "italic" }}>
            No media evidence attached yet. You can attach up to 3 photos (JPG, PNG, WebP) to support verification.
          </div>
        )}
      </div>

      {/* Transparent Case Timeline */}
      <div
        className="glass-panel"
        style={{
          padding: "1.75rem",
          borderRadius: "var(--radius-lg)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
          <div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "0.45rem" }}>
              <Clock size={18} color="var(--accent-primary)" />
              Transparent Case Timeline
            </h3>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
              Verifiable log of every status transition and operational milestone.
            </p>
          </div>
          <span className="badge" style={{ background: "rgba(16, 185, 129, 0.12)", color: "var(--accent-primary)" }}>
            <ShieldCheck size={13} />
            Append-Only
          </span>
        </div>

        <CaseTimeline events={complaint.events} />
      </div>
    </div>
  );
}
