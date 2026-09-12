"use client";

import React from "react";
import Link from "next/link";
import { RecurrenceMatch } from "@/types/complaint";
import { History, ArrowUpRight, AlertCircle } from "lucide-react";

interface RelatedCasePanelProps {
  recurrences: RecurrenceMatch[];
}

export function RelatedCasePanel({ recurrences }: RelatedCasePanelProps) {
  if (!recurrences || recurrences.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: "1.25rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
        No historical recurrence detected in this location window.
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ padding: "1.25rem", borderLeft: "3px solid #f59e0b" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <History size={17} color="var(--accent-warning)" />
        <h4 style={{ fontSize: "0.95rem", color: "var(--text-primary)", fontWeight: 700 }}>
          Potential Recurrence & Case Memory
        </h4>
        <span className="badge" style={{ background: "rgba(245, 158, 11, 0.15)", color: "var(--accent-warning)" }}>
          {recurrences.length} Related
        </span>
      </div>

      <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: "0.85rem", lineHeight: 1.5 }}>
        Awwaz identified previous complaints in this category within the same geographic area:
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {recurrences.map((match) => (
          <div
            key={match.id}
            style={{
              background: "var(--bg-nested)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              padding: "0.75rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
              <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-primary)" }}>
                {match.title}
              </span>

              <Link
                href={`/dashboard/complaints/${match.id}`}
                style={{
                  color: "var(--text-accent)",
                  fontSize: "0.75rem",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.2rem",
                  fontWeight: 600,
                }}
              >
                Case #{match.id} <ArrowUpRight size={12} />
              </Link>
            </div>

            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
              Location: {match.location_text}
            </div>

            <div style={{ fontSize: "0.74rem", color: "#fbbf24" }}>
              • {match.match_reason} (Match Score: {Math.round(match.similarity_score * 100)}%)
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
