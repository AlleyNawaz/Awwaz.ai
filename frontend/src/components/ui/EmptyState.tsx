"use client";

import React from "react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon = <Inbox size={32} color="var(--text-muted)" />,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div
      style={{
        padding: "3.5rem 1.5rem",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
      className="animate-fade-in"
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "var(--radius-full)",
          background: "var(--bg-nested)",
          border: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "1rem",
        }}
      >
        {icon}
      </div>

      <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.35rem" }}>
        {title}
      </h3>

      <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", maxWidth: 420, lineHeight: 1.5, marginBottom: action ? "1.25rem" : 0 }}>
        {description}
      </p>

      {action && <div>{action}</div>}
    </div>
  );
}
