"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/services/api/client";
import { DashboardSummary } from "@/types/recommendation";
import {
  MessageSquare,
  Shield,
  Settings,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Flame,
  Bot,
  Layers,
  Lock,
  Zap,
  Activity,
  ChevronRight,
  Send,
  FileCheck,
  Building2,
  MapPin,
  RefreshCw,
  Terminal,
} from "lucide-react";

export default function HomePage() {
  const [stats, setStats] = useState<DashboardSummary | null>(null);
  const [activeTab, setActiveTab] = useState<"INTAKE" | "STALL" | "APPROVAL" | "LEDGER">("INTAKE");

  useEffect(() => {
    async function loadStats() {
      const res = await api.getDashboardSummary();
      if (res.success && res.data) {
        setStats(res.data);
      }
    }
    loadStats();
  }, []);

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "3rem 1.5rem 5rem" }}>
      {/* Hero Section */}
      <div style={{ textAlign: "center", marginBottom: "4rem" }} className="animate-fade-in">
        {/* Release Pill Badge */}
        <div style={{ display: "inline-block", marginBottom: "1.5rem" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.35rem 0.95rem",
              borderRadius: "var(--radius-full)",
              background: "var(--bg-tertiary)",
              border: "1px solid var(--border-highlight)",
              color: "var(--text-accent)",
              fontSize: "0.8rem",
              fontWeight: 600,
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#10b981",
                boxShadow: "0 0 8px #10b981",
                animation: "pulseGlow 2s infinite",
              }}
            />
            <span>Awwaz Autonomous Operations Platform</span>
            <span style={{ color: "var(--text-muted)" }}>•</span>
            <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>v2.4 Live</span>
            <ChevronRight size={13} color="var(--text-muted)" />
          </div>
        </div>

        {/* Hero Title */}
        <h1
          style={{
            fontSize: "clamp(2.4rem, 5.5vw, 4.2rem)",
            lineHeight: 1.1,
            fontWeight: 800,
            marginBottom: "1.4rem",
            letterSpacing: "-0.035em",
            color: "var(--text-primary)",
          }}
        >
          Existing systems collect complaints.<br />
          <span
            style={{
              background: "var(--hero-accent-gradient)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Awwaz guarantees municipal action.
          </span>
        </h1>

        {/* Hero Subtitle */}
        <p
          style={{
            fontSize: "clamp(1rem, 2vw, 1.2rem)",
            color: "var(--text-secondary)",
            maxWidth: 780,
            margin: "0 auto 2.5rem",
            lineHeight: 1.6,
          }}
        >
          A stateful AI coordination engine that turns citizen messages in Urdu, Roman Urdu & English into deterministic, routed cases — enforcing SLA promises, autonomously catching stalls, and requiring human authorization for external actions.
        </p>

        {/* Action CTAs */}
        <div style={{ display: "flex", justifyContent: "center", gap: "1rem", flexWrap: "wrap", marginBottom: "3rem" }}>
          <Link
            href="/citizen"
            className="btn btn-primary"
            style={{
              padding: "0.85rem 1.85rem",
              fontSize: "0.95rem",
              fontWeight: 700,
              borderRadius: "var(--radius-md)",
              boxShadow: "0 4px 20px rgba(37, 99, 235, 0.35)",
            }}
          >
            <MessageSquare size={18} />
            Report an Issue (Citizen)
            <ArrowRight size={16} />
          </Link>

          <Link
            href="/dashboard"
            className="btn btn-secondary"
            style={{
              padding: "0.85rem 1.85rem",
              fontSize: "0.95rem",
              fontWeight: 600,
              borderRadius: "var(--radius-md)",
            }}
          >
            <Shield size={18} />
            Open Command Center (Operator)
          </Link>
        </div>

        {/* Live Performance Stats Strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "1.25rem",
            background: "var(--bg-nested)",
            border: "1px solid var(--border-subtle)",
            padding: "1.25rem 1.5rem",
            borderRadius: "var(--radius-lg)",
            maxWidth: 960,
            margin: "0 auto",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div>
            <div className="tabular-nums" style={{ fontSize: "1.65rem", fontWeight: 800, color: "var(--text-primary)" }}>
              &lt; 2.1s
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "0.2rem" }}>
              Intake Triage Velocity
            </div>
          </div>

          <div>
            <div className="tabular-nums" style={{ fontSize: "1.65rem", fontWeight: 800, color: "#10b981" }}>
              100%
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "0.2rem" }}>
              Grounded Facts (Zero Hallucinations)
            </div>
          </div>

          <div>
            <div className="tabular-nums" style={{ fontSize: "1.65rem", fontWeight: 800, color: "#f59e0b" }}>
              72h
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "0.2rem" }}>
              Autonomous Stall Sentinel
            </div>
          </div>

          <div>
            <div className="tabular-nums" style={{ fontSize: "1.65rem", fontWeight: 800, color: "#38bdf8" }}>
              SHA-256
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "0.2rem" }}>
              Cryptographic Audit Chain
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Live Architecture Showcase (Bento Showcase) */}
      <div
        className="glass-panel"
        style={{
          padding: "2rem",
          marginBottom: "4.5rem",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg)",
          border: "1px solid var(--border-highlight)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
          <div>
            <div className="micro-label" style={{ color: "var(--text-accent)", marginBottom: "0.25rem" }}>
              Interactive System Simulation
            </div>
            <h2 style={{ fontSize: "1.45rem", fontWeight: 800, margin: 0 }}>
              The 10-Step Autonomous Civic Loop in Action
            </h2>
          </div>

          {/* Tab Switchers */}
          <div className="segmented-control">
            <button
              onClick={() => setActiveTab("INTAKE")}
              className={`segmented-item ${activeTab === "INTAKE" ? "segmented-item-active" : ""}`}
            >
              1. Multilingual Intake
            </button>
            <button
              onClick={() => setActiveTab("STALL")}
              className={`segmented-item ${activeTab === "STALL" ? "segmented-item-active" : ""}`}
            >
              2. Stall Sentinel
            </button>
            <button
              onClick={() => setActiveTab("APPROVAL")}
              className={`segmented-item ${activeTab === "APPROVAL" ? "segmented-item-active" : ""}`}
            >
              3. Human Security Gateway
            </button>
            <button
              onClick={() => setActiveTab("LEDGER")}
              className={`segmented-item ${activeTab === "LEDGER" ? "segmented-item-active" : ""}`}
            >
              4. SHA-256 Ledger
            </button>
          </div>
        </div>

        {/* Tab 1: Multilingual Intake */}
        {activeTab === "INTAKE" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem" }} className="animate-fade-in">
            <div style={{ background: "var(--bg-nested)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "1.25rem" }}>
              <div className="micro-label" style={{ marginBottom: "0.6rem" }}>Raw Citizen Input (Roman Urdu / Voice Note):</div>
              <div style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                padding: "0.85rem 1rem",
                fontSize: "0.92rem",
                color: "var(--text-primary)",
                fontStyle: "italic",
                marginBottom: "0.75rem",
              }}>
                &ldquo;Bhai 3 din se G-9 markaz me gutter overflow ho raha hai aur ganda pani dukanon me ghus raha hai.&rdquo;
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                <span className="badge" style={{ background: "rgba(37, 99, 235, 0.1)", color: "#2563eb" }}>Roman Urdu NLP</span>
                <span>•</span>
                <span>Syntactic Intent Detected</span>
              </div>
            </div>

            <div style={{ background: "var(--bg-nested)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "1.25rem" }}>
              <div className="micro-label" style={{ marginBottom: "0.6rem" }}>Autonomous Extraction & Deterministic Routing:</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.82rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", background: "var(--bg-card)", padding: "0.5rem 0.75rem", borderRadius: "var(--radius-sm)" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Extracted Category:</span>
                  <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>WATER_DRAINAGE (WASA)</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", background: "var(--bg-card)", padding: "0.5rem 0.75rem", borderRadius: "var(--radius-sm)" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Normalized Location:</span>
                  <span style={{ fontWeight: 700, color: "#38bdf8" }}>Sector G-9 Markaz, Islamabad</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", background: "var(--bg-card)", padding: "0.5rem 0.75rem", borderRadius: "var(--radius-sm)" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Autonomous Case ID:</span>
                  <span className="tabular-nums" style={{ fontWeight: 700, color: "#10b981" }}>#A1024 (Version v1)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Stall Sentinel */}
        {activeTab === "STALL" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem" }} className="animate-fade-in">
            <div style={{ background: "var(--bg-nested)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "1.25rem" }}>
              <div className="micro-label" style={{ marginBottom: "0.6rem" }}>Background SLA Evaluator Engine:</div>
              <div style={{
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.25)",
                borderRadius: "var(--radius-md)",
                padding: "1rem",
                marginBottom: "0.75rem",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#ef4444", fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.3rem" }}>
                  <AlertTriangle size={17} />
                  Case #A1024 Stalled (&gt;72h Without Meaningful Progress)
                </div>
                <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
                  Last recorded event was 74.2 hours ago. Automatic stall detector triggered; evaluating department responsibility hierarchy.
                </p>
              </div>
            </div>

            <div style={{ background: "var(--bg-nested)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "1.25rem" }}>
              <div className="micro-label" style={{ marginBottom: "0.6rem" }}>Grounded Recommendation Synthesized:</div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-primary)", lineHeight: 1.5, marginBottom: "0.75rem" }}>
                <strong>Recommendation:</strong> Escalate case to Executive Engineer (WASA Drainage Ops) due to exceeding 72-hour SLA response window.
              </div>
              <div className="micro-label" style={{ marginBottom: "0.3rem", color: "var(--text-accent)" }}>Verified Citing Facts:</div>
              <ul style={{ paddingLeft: "1.2rem", margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                <li>Case created at 2026-09-09T10:00:00Z</li>
                <li>No state transition or commitment recorded in last 72 hours</li>
                <li>Severity: HIGH (Commercial zone contamination)</li>
              </ul>
            </div>
          </div>
        )}

        {/* Tab 3: Human Security Gateway */}
        {activeTab === "APPROVAL" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem" }} className="animate-fade-in">
            <div style={{ background: "var(--bg-nested)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "1.25rem" }}>
              <div className="micro-label" style={{ marginBottom: "0.6rem" }}>Human Authorization Security Boundary:</div>
              <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.55, marginBottom: "0.75rem" }}>
                Awwaz strictly enforces that AI recommendations <strong>never autonomously execute external department escalations</strong>. An authorized human operator must inspect citations and sign off.
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span className="badge" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981", fontWeight: 700 }}>
                  <CheckCircle2 size={13} /> Zero Autonomous Priv Escalation
                </span>
              </div>
            </div>

            <div style={{ background: "var(--bg-nested)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "1.25rem" }}>
              <div className="micro-label" style={{ marginBottom: "0.6rem" }}>Operator Execution Result:</div>
              <div style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                padding: "0.85rem",
                fontSize: "0.82rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.4rem",
              }}>
                <div style={{ color: "var(--text-secondary)" }}>Operator: <strong>Fatima (ID: op-441)</strong></div>
                <div style={{ color: "var(--text-secondary)" }}>Civic Adapter Action: <strong>DISPATCH_ESCALATION</strong></div>
                <div style={{ color: "#10b981", fontWeight: 700 }}>External Civic Reference: CIVIC-ESC-A1024-WASA</div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Immutable timeline event recorded with cryptographic signature.</div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: SHA-256 Ledger */}
        {activeTab === "LEDGER" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem" }} className="animate-fade-in">
            <div style={{ background: "var(--bg-nested)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "1.25rem" }}>
              <div className="micro-label" style={{ marginBottom: "0.6rem" }}>Cryptographic Proof (PRD §16):</div>
              <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.55, marginBottom: "0.75rem" }}>
                Every case update, citizen report, and approval is anchored into an immutable sequential SHA-256 block chain. Any unauthorized mutation breaks the chain root.
              </p>
              <div className="badge" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981", fontWeight: 700 }}>
                <Lock size={13} /> Chain Valid (Zero Tampering)
              </div>
            </div>

            <div style={{ background: "var(--bg-nested)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "1.25rem" }}>
              <div className="micro-label" style={{ marginBottom: "0.6rem" }}>Chain Head Block:</div>
              <div style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.76rem",
                color: "#38bdf8",
                background: "var(--bg-card)",
                padding: "0.65rem 0.85rem",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-subtle)",
                wordBreak: "break-all",
                marginBottom: "0.5rem",
              }}>
                7f8a9b2c3d4e5f6a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a
              </div>
              <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                Verified Depth: 18 Sequential Blocks anchored to Genesis
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3 Core Experience Portals (Bento Grid) */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: "1.75rem",
        marginBottom: "4rem",
      }}>
        {/* Citizen Portal */}
        <div className="glass-panel glass-panel-hover" style={{ padding: "2rem", borderRadius: "var(--radius-lg)" }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: "var(--radius-md)",
            background: "linear-gradient(135deg, #2563eb, #38bdf8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "1.25rem",
            boxShadow: "0 2px 10px rgba(37, 99, 235, 0.25)",
          }}>
            <MessageSquare size={22} color="#ffffff" />
          </div>

          <h3 style={{ fontSize: "1.25rem", fontWeight: 800, marginBottom: "0.5rem" }}>Citizen Experience</h3>
          <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "1.5rem", lineHeight: 1.6 }}>
            Zero registration hurdles. Speak or type naturally in Urdu, Roman Urdu, or English. Awwaz autonomously structures facts, links location data, and enforces municipal SLA promises.
          </p>

          <Link
            href="/citizen"
            style={{
              color: "var(--text-accent)",
              textDecoration: "none",
              fontSize: "0.88rem",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
            }}
          >
            Launch Citizen Intake <ArrowRight size={15} />
          </Link>
        </div>

        {/* Operator Command Center */}
        <div className="glass-panel glass-panel-hover" style={{ padding: "2rem", borderRadius: "var(--radius-lg)" }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: "var(--radius-md)",
            background: "linear-gradient(135deg, #7c3aed, #6366f1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "1.25rem",
            boxShadow: "0 2px 10px rgba(124, 58, 237, 0.25)",
          }}>
            <Shield size={22} color="#ffffff" />
          </div>

          <h3 style={{ fontSize: "1.25rem", fontWeight: 800, marginBottom: "0.5rem" }}>Command Center</h3>
          <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "1.5rem", lineHeight: 1.6 }}>
            High-density operational console prioritizing stalled cases and pending approvals. Inspect grounded citations, transition states, and dispatch field units with single-click authority.
          </p>

          <Link
            href="/dashboard"
            style={{
              color: "#7c3aed",
              textDecoration: "none",
              fontSize: "0.88rem",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
            }}
          >
            View Operator Queue <ArrowRight size={15} />
          </Link>
        </div>

        {/* Audit & Cryptographic Administration */}
        <div className="glass-panel glass-panel-hover" style={{ padding: "2rem", borderRadius: "var(--radius-lg)" }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: "var(--radius-md)",
            background: "linear-gradient(135deg, #f59e0b, #d97706)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "1.25rem",
            boxShadow: "0 2px 10px rgba(245, 158, 11, 0.25)",
          }}>
            <Settings size={22} color="#ffffff" />
          </div>

          <h3 style={{ fontSize: "1.25rem", fontWeight: 800, marginBottom: "0.5rem" }}>Auditable Administration</h3>
          <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "1.5rem", lineHeight: 1.6 }}>
            Tamper-evident audit trail recording every state transition, routing link, and external escalation. Manage civic department routing taxonomy and synchronize demo baselines.
          </p>

          <Link
            href="/admin"
            style={{
              color: "#d97706",
              textDecoration: "none",
              fontSize: "0.88rem",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
            }}
          >
            Inspect System Audit <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      {/* Live Operational Counters */}
      {stats && (
        <div className="glass-panel" style={{ padding: "1.75rem 2rem", borderRadius: "var(--radius-lg)" }}>
          <div className="micro-label" style={{ marginBottom: "1rem" }}>Current Operational State</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1.5rem" }}>
            <div>
              <div className="tabular-nums" style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--text-primary)" }}>{stats.open_cases}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Active Cases</div>
            </div>
            <div>
              <div className="tabular-nums" style={{ fontSize: "1.8rem", fontWeight: 800, color: "#f59e0b" }}>{stats.high_priority_cases}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>High & Critical</div>
            </div>
            <div>
              <div className="tabular-nums" style={{ fontSize: "1.8rem", fontWeight: 800, color: "#ef4444" }}>{stats.stalled_cases}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Stalled (&gt;72h)</div>
            </div>
            <div>
              <div className="tabular-nums" style={{ fontSize: "1.8rem", fontWeight: 800, color: "#f43f5e" }}>{stats.pending_approvals}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Pending Approvals</div>
            </div>
            <div>
              <div className="tabular-nums" style={{ fontSize: "1.8rem", fontWeight: 800, color: "#10b981" }}>{stats.resolved_today}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Resolved Recently</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
