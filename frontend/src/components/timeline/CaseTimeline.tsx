"use client";

import React from "react";
import { TimelineEvent } from "@/types/complaint";
import { formatDate } from "@/lib/formatting";
import { CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck, Clock, FileText, Send, User } from "lucide-react";

interface CaseTimelineProps {
  events: TimelineEvent[];
}

export function CaseTimeline({ events }: CaseTimelineProps) {
  if (!events || events.length === 0) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
        No timeline events recorded yet.
      </div>
    );
  }

  const getEventIcon = (eventType: string) => {
    if (eventType.includes("SUCCEEDED") || eventType.includes("RESOLVED")) {
      return <CheckCircle2 size={15} color="#34d399" />;
    }
    if (eventType.includes("MISSED") || eventType.includes("FAILED") || eventType.includes("REJECTED")) {
      return <AlertTriangle size={15} color="#ef4444" />;
    }
    if (eventType.includes("APPROVAL")) {
      return <ShieldCheck size={15} color="#f59e0b" />;
    }
    if (eventType.includes("COMMITMENT")) {
      return <Clock size={15} color="#38bdf8" />;
    }
    return <FileText size={15} color="#94a3b8" />;
  };

  return (
    <div style={{ position: "relative", paddingLeft: "1.5rem" }}>
      {/* Vertical Timeline Rule */}
      <div style={{
        position: "absolute",
        left: 7,
        top: 8,
        bottom: 8,
        width: 2,
        background: "var(--border-subtle)",
      }} />

      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {events.map((event, idx) => (
          <div key={event.id || idx} style={{ position: "relative" }} className="animate-fade-in">
            {/* Timeline Dot */}
            <div style={{
              position: "absolute",
              left: -23,
              top: 4,
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "var(--bg-secondary)",
              border: "1.5px solid var(--accent-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 8px var(--accent-glow)",
            }}>
              {getEventIcon(event.event_type)}
            </div>

            {/* Event Content Card */}
            <div style={{
              background: "var(--bg-timeline-card)",
              border: "1px solid var(--border-timeline)",
              borderRadius: "var(--radius-md)",
              padding: "0.85rem 1.15rem",
              boxShadow: "var(--shadow-sm)",
              transition: "all 0.2s ease",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                <span style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--text-primary)" }}>
                  {event.event_type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>
                  {formatDate(event.created_at)}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.45rem" }}>
                <span style={{
                  fontSize: "0.7rem",
                  padding: "0.15rem 0.5rem",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--bg-nested-alt)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-secondary)",
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                }}>
                  {event.actor_type}
                </span>
              </div>

              {/* Payload summaries */}
              {event.payload && Object.keys(event.payload).length > 0 && (
                <div style={{
                  fontSize: "0.82rem",
                  color: "var(--text-secondary)",
                  lineHeight: 1.6,
                  background: "var(--bg-nested)",
                  border: "1px solid var(--border-subtle)",
                  padding: "0.55rem 0.8rem",
                  borderRadius: "var(--radius-sm)",
                  marginTop: "0.4rem",
                }}>
                  {event.payload.title && (
                    <div><strong style={{ color: "var(--text-primary)" }}>Title:</strong> {event.payload.title}</div>
                  )}
                  {event.payload.reason && (
                    <div><strong style={{ color: "var(--text-primary)" }}>Reason:</strong> {event.payload.reason}</div>
                  )}
                  {event.payload.responsible_role && (
                    <div><strong style={{ color: "var(--text-primary)" }}>Assigned To:</strong> {event.payload.responsible_role}</div>
                  )}
                  {event.payload.department && (
                    <div><strong style={{ color: "var(--text-primary)" }}>Department:</strong> {event.payload.department}</div>
                  )}
                  {event.payload.external_reference && (
                    <div style={{ color: "var(--accent-teal)", fontWeight: 700 }}>
                      External Reference: {event.payload.external_reference}
                    </div>
                  )}
                  {event.payload.from_status && (
                    <div>Status: {event.payload.from_status} → <strong style={{ color: "var(--text-primary)" }}>{event.payload.to_status}</strong></div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
