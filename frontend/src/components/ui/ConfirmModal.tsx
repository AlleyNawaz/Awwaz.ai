"use client";

import React, { useEffect } from "react";
import { RotateCcw, AlertTriangle, X, ShieldAlert } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "warning" | "danger" | "primary";
  isLoading?: boolean;
  impactItems?: string[];
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "warning",
  isLoading = false,
  impactItems = [],
}: ConfirmModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isLoading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case "danger":
        return {
          icon: <AlertTriangle size={22} color="var(--accent-danger)" />,
          iconBg: "rgba(244, 63, 94, 0.15)",
          iconBorder: "rgba(244, 63, 94, 0.3)",
          btnClass: "btn btn-danger",
        };
      case "primary":
        return {
          icon: <RotateCcw size={22} color="var(--accent-primary)" />,
          iconBg: "var(--border-subtle)",
          iconBorder: "var(--border-highlight)",
          btnClass: "btn btn-primary",
        };
      case "warning":
      default:
        return {
          icon: <ShieldAlert size={22} color="var(--accent-warning)" />,
          iconBg: "rgba(245, 158, 11, 0.15)",
          iconBorder: "rgba(245, 158, 11, 0.3)",
          btnClass: "btn btn-primary",
        };
    }
  };

  const vStyle = getVariantStyles();

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="glass-panel modal-animate"
        style={{
          width: "100%",
          maxWidth: "480px",
          background: "var(--bg-card-elevated)",
          border: "1px solid var(--border-highlight)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg), 0 0 32px var(--accent-glow)",
          padding: "1.75rem",
          position: "relative",
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isLoading}
          style={{
            position: "absolute",
            top: "1.25rem",
            right: "1.25rem",
            background: "transparent",
            border: "none",
            color: "var(--text-muted)",
            cursor: isLoading ? "not-allowed" : "pointer",
            padding: "0.25rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "var(--radius-sm)",
            transition: "all 0.15s ease",
          }}
          aria-label="Close dialog"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem", marginBottom: "1.25rem" }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "var(--radius-md)",
              background: vStyle.iconBg,
              border: `1px solid ${vStyle.iconBorder}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {vStyle.icon}
          </div>

          <div style={{ paddingRight: "1.5rem" }}>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.35rem" }}>
              {title}
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              {description}
            </p>
          </div>
        </div>

        {/* Impact List */}
        {impactItems.length > 0 && (
          <div
            style={{
              background: "var(--bg-nested)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              padding: "0.85rem 1rem",
              marginBottom: "1.5rem",
            }}
          >
            <div className="micro-label" style={{ marginBottom: "0.45rem" }}>
              Scope & System Impact:
            </div>
            <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {impactItems.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.75rem" }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="btn btn-secondary"
            style={{ padding: "0.55rem 1.15rem", fontSize: "0.85rem" }}
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={vStyle.btnClass}
            style={{
              padding: "0.55rem 1.25rem",
              fontSize: "0.85rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            {isLoading && <RotateCcw size={14} className="animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
