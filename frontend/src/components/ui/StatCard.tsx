"use client";

import React from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  trendType?: "positive" | "negative" | "warning" | "neutral";
  subtitle?: string;
  onClick?: () => void;
  accentColor?: string;
}

export function StatCard({
  label,
  value,
  icon,
  trend,
  trendType = "neutral",
  subtitle,
  onClick,
  accentColor,
}: StatCardProps) {
  const getTrendStyle = () => {
    switch (trendType) {
      case "positive":
        return {
          bg: "rgba(16, 185, 129, 0.14)",
          color: "var(--accent-primary)",
          border: "rgba(16, 185, 129, 0.3)",
        };
      case "negative":
        return {
          bg: "rgba(244, 63, 94, 0.14)",
          color: "var(--accent-danger)",
          border: "rgba(244, 63, 94, 0.3)",
        };
      case "warning":
        return {
          bg: "rgba(245, 158, 11, 0.14)",
          color: "var(--accent-warning)",
          border: "rgba(245, 158, 11, 0.3)",
        };
      case "neutral":
      default:
        return {
          bg: "var(--bg-tertiary)",
          color: "var(--text-muted)",
          border: "var(--border-subtle)",
        };
    }
  };

  const tStyle = getTrendStyle();

  return (
    <div
      className="stat-card"
      onClick={onClick}
      style={{
        cursor: onClick ? "pointer" : "default",
        borderLeft: accentColor ? `3px solid ${accentColor}` : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.85rem" }}>
        <span className="micro-label" style={{ fontSize: "0.72rem" }}>{label}</span>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "var(--radius-md)",
            background: "var(--bg-tertiary)",
            border: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: accentColor || "var(--accent-primary)",
          }}
        >
          {icon}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: "0.6rem" }}>
        <div
          className="tabular-nums"
          style={{
            fontSize: "1.9rem",
            fontWeight: 800,
            color: "var(--text-primary)",
            letterSpacing: "-0.03em",
            lineHeight: 1,
          }}
        >
          {value}
        </div>

        {trend && (
          <span
            style={{
              fontSize: "0.7rem",
              fontWeight: 700,
              padding: "0.15rem 0.45rem",
              borderRadius: "var(--radius-sm)",
              background: tStyle.bg,
              color: tStyle.color,
              border: `1px solid ${tStyle.border}`,
            }}
          >
            {trend}
          </span>
        )}
      </div>

      {subtitle && (
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}
