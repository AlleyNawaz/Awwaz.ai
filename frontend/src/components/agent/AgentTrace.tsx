"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/services/api/client";
import { formatDate } from "@/lib/formatting";
import { Bot, Terminal, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";

interface AgentTraceProps {
  complaintId: string;
}

export function AgentTrace({ complaintId }: AgentTraceProps) {
  const [steps, setSteps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    async function loadTrace() {
      setLoading(true);
      const res = await api.getAgentTrace(complaintId);
      if (res.success && res.data) {
        setSteps(res.data);
      }
      setLoading(false);
    }
    if (complaintId) {
      loadTrace();
    }
  }, [complaintId]);

  return (
    <div className="glass-panel" style={{ overflow: "hidden" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%",
          padding: "0.85rem 1.15rem",
          background: "transparent",
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          color: "var(--text-primary)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Terminal size={17} color="#38bdf8" />
          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Observable Agent Activity Trace</span>
          <span className="badge" style={{ background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8" }}>
            {steps.length} Steps
          </span>
        </div>

        {isOpen ? <ChevronDown size={17} color="var(--text-muted)" /> : <ChevronRight size={17} color="var(--text-muted)" />}
      </button>

      {isOpen && (
        <div style={{ padding: "0 1.15rem 1.15rem", borderTop: "1px solid var(--border-subtle)", paddingTop: "0.75rem" }}>
          {loading ? (
            <div style={{ padding: "1rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.8rem" }}>
              Loading operational trace...
            </div>
          ) : steps.length === 0 ? (
            <div style={{ padding: "1rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.8rem" }}>
              No trace events recorded.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {steps.map((step, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "var(--bg-nested)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)",
                    padding: "0.65rem 0.85rem",
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.8rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                      <span style={{ color: "var(--accent-teal)", fontWeight: 700 }}>#{step.step || idx + 1}</span>
                      <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{step.action}</span>
                    </div>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>
                      {formatDate(step.timestamp)}
                    </span>
                  </div>

                  {step.details && Object.keys(step.details).length > 0 && (
                    <div style={{
                      color: "var(--text-secondary)",
                      fontSize: "0.74rem",
                      marginTop: "0.3rem",
                      background: "var(--bg-nested-alt)",
                      padding: "0.35rem 0.6rem",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border-subtle)",
                    }}>
                      {JSON.stringify(step.details)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
