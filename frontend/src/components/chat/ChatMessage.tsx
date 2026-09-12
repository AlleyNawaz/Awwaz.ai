"use client";

import React from "react";
import Link from "next/link";
import { Bot, User, CheckCircle2, MapPin, ArrowRight } from "lucide-react";
import { formatRelativeTime } from "@/lib/formatting";

interface ChatMessageProps {
  senderType: "CITIZEN" | "AGENT" | "SYSTEM";
  content: string;
  createdAt?: string;
  complaintId?: string;
}

export function ChatMessage({ senderType, content, createdAt, complaintId }: ChatMessageProps) {
  const isCitizen = senderType === "CITIZEN";

  return (
    <div
      className="animate-fade-in"
      style={{
        display: "flex",
        justifyContent: isCitizen ? "flex-end" : "flex-start",
        gap: "0.75rem",
        marginBottom: "1.25rem",
      }}
    >
      {!isCitizen && (
        <div style={{
          width: 32,
          height: 32,
          borderRadius: "var(--radius-full)",
          background: "linear-gradient(135deg, var(--accent-primary), var(--accent-teal))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: 2,
          boxShadow: "0 2px 8px var(--accent-glow)",
        }}>
          <Bot size={18} color="#ffffff" />
        </div>
      )}

      <div style={{ maxWidth: "80%" }}>
        <div
          style={{
            padding: "0.85rem 1.15rem",
            borderRadius: "var(--radius-lg)",
            borderBottomRightRadius: isCitizen ? "var(--radius-sm)" : "var(--radius-lg)",
            borderBottomLeftRadius: isCitizen ? "var(--radius-lg)" : "var(--radius-sm)",
            background: isCitizen
              ? "linear-gradient(135deg, var(--accent-primary), var(--accent-primary-hover))"
              : "var(--bg-card-elevated)",
            color: isCitizen ? "#ffffff" : "var(--text-primary)",
            border: isCitizen ? "1px solid rgba(255,255,255,0.15)" : "1px solid var(--border-subtle)",
            boxShadow: isCitizen ? "var(--shadow-md)" : "var(--shadow-sm)",
            whiteSpace: "pre-wrap",
            fontSize: "0.92rem",
            lineHeight: 1.6,
          }}
        >
          {content}

          {complaintId && (
            <div style={{
              marginTop: "0.85rem",
              paddingTop: "0.75rem",
              borderTop: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-accent)", fontWeight: 700 }}>
                Case ID: {complaintId}
              </span>
              <Link
                href={`/citizen/complaints/${complaintId}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  fontSize: "0.78rem",
                  color: isCitizen ? "#ffffff" : "var(--accent-primary)",
                  textDecoration: "none",
                  fontWeight: 700,
                }}
              >
                Track Live Timeline <ArrowRight size={13} />
              </Link>
            </div>
          )}
        </div>

        {createdAt && (
          <div style={{
            fontSize: "0.68rem",
            color: "var(--text-muted)",
            marginTop: "0.25rem",
            textAlign: isCitizen ? "right" : "left",
          }}>
            {formatRelativeTime(createdAt)}
          </div>
        )}
      </div>

      {isCitizen && (
        <div style={{
          width: 32,
          height: 32,
          borderRadius: "var(--radius-full)",
          background: "var(--bg-tertiary)",
          border: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: 2,
        }}>
          <User size={16} color="var(--text-secondary)" />
        </div>
      )}
    </div>
  );
}
