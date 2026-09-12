"use client";

import React from "react";
import { PRIORITY_CONFIG } from "@/lib/constants";

interface PriorityBadgeProps {
  priority: string;
  className?: string;
}

export function PriorityBadge({ priority, className = "" }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority] || {
    label: priority,
    color: "var(--text-secondary)",
    bg: "var(--bg-tertiary)",
  };

  const priorityClass = `badge-priority-${priority.toLowerCase()}`;

  return (
    <span
      className={`badge ${priorityClass} ${className}`}
    >
      {config.label}
    </span>
  );
}
