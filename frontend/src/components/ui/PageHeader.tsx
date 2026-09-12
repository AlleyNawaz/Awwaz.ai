"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  breadcrumbs?: BreadcrumbItem[];
  title: string;
  badge?: React.ReactNode;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({
  breadcrumbs = [],
  title,
  badge,
  subtitle,
  actions,
}: PageHeaderProps) {
  return (
    <div style={{ marginBottom: "1.75rem" }} className="animate-fade-in">
      {/* Breadcrumb Trail */}
      {breadcrumbs.length > 0 && (
        <nav
          aria-label="Breadcrumbs"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            fontSize: "0.78rem",
            color: "var(--text-muted)",
            marginBottom: "0.5rem",
          }}
        >
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <ChevronRight size={12} color="var(--text-muted)" />}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  style={{
                    color: "var(--text-secondary)",
                    textDecoration: "none",
                    fontWeight: 500,
                    transition: "color 0.15s ease",
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.color = "var(--text-accent)")}
                  onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
                >
                  {crumb.label}
                </Link>
              ) : (
                <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* Title & Actions Row */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div style={{ maxWidth: "700px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <h1 style={{ fontSize: "1.65rem", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-primary)" }}>
              {title}
            </h1>
            {badge}
          </div>
          {subtitle && (
            <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", marginTop: "0.3rem", lineHeight: 1.5 }}>
              {subtitle}
            </p>
          )}
        </div>

        {actions && <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>{actions}</div>}
      </div>
    </div>
  );
}
