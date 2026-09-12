"use client";

import React from "react";
import { STATUS_CONFIG } from "@/lib/constants";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || {
    label: status.replace(/_/g, " "),
    color: "var(--text-secondary)",
    bg: "var(--bg-tertiary)",
    border: "var(--border-subtle)",
  };

  const isPulse = status === "IN_PROGRESS" || status === "ESCALATION_PENDING";
  const statusClass = `badge-status-${status.toLowerCase()}`;

  return (
    <span
      className={`badge ${statusClass} ${className}`}
      style={{
        borderWidth: 1,
        borderStyle: "solid",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          backgroundColor: "currentColor",
          display: "inline-block",
          boxShadow: isPulse ? "0 0 6px currentColor" : "none",
        }}
      />
      {config.label}
    </span>
  );
}
