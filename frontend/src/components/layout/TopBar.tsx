"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getActiveUser, setActiveUser } from "@/lib/auth";
import { UserRole, UserSession } from "@/types/auth";
import { api } from "@/services/api/client";
import { useTheme } from "@/lib/theme";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/ToastProvider";
import {
  Shield,
  User,
  Settings,
  RefreshCw,
  Activity,
  AlertCircle,
  Sun,
  Moon,
  Sparkles,
} from "lucide-react";

export function TopBar() {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();

  useEffect(() => {
    setCurrentUser(getActiveUser());
  }, []);

  const handleRoleSwitch = (role: UserRole) => {
    const user = setActiveUser(role);
    setCurrentUser(user);
    toast.info(`Switched role to ${role}`, "Interface permissions updated");
    window.location.reload();
  };

  const handleExecuteReset = async () => {
    setIsResetting(true);
    const res = await api.resetDemo();
    setIsResetting(false);
    setShowResetModal(false);
    if (res.success) {
      toast.success("Benchmark Baseline Restored", "Cases A1024 - A1028 and genesis ledger synchronized");
      setTimeout(() => window.location.reload(), 600);
    } else {
      toast.error("Reset Failed", res.error?.message || "Unknown error restoring baseline");
    }
  };

  const role = currentUser?.role || "CITIZEN";

  return (
    <header style={{
      borderBottom: "1px solid var(--border-subtle)",
      background: "var(--bg-header)",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      position: "sticky",
      top: 0,
      zIndex: 40,
      transition: "background-color 0.25s ease, border-color 0.25s ease",
    }}>
      <div style={{
        maxWidth: 1300,
        margin: "0 auto",
        padding: "0.75rem 1.5rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
      }}>
        {/* Brand & Tagline */}
        <div style={{ display: "flex", alignItems: "center", gap: "1.75rem" }}>
          <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "0.65rem" }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: "var(--radius-md)",
              background: "linear-gradient(135deg, #2563eb, #7c3aed)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 10px rgba(37, 99, 235, 0.3)",
              transition: "box-shadow 0.25s ease",
            }}>
              <Activity size={19} color="#ffffff" />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
              <div style={{ fontWeight: 800, fontSize: "1.2rem", letterSpacing: "-0.03em", color: "var(--text-primary)" }}>
                Awwaz<span style={{ color: "#2563eb" }}>.ai</span>
              </div>
              <span
                style={{
                  fontSize: "0.68rem",
                  padding: "0.15rem 0.45rem",
                  borderRadius: "var(--radius-full)",
                  background: "rgba(37, 99, 235, 0.1)",
                  color: "#2563eb",
                  fontWeight: 700,
                  border: "1px solid rgba(37, 99, 235, 0.2)",
                  letterSpacing: "0.03em",
                }}
              >
                v2.4
              </span>
            </div>
          </Link>

          {/* Nav Links */}
          <nav style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <Link
              href="/citizen"
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: "var(--radius-md)",
                fontSize: "0.85rem",
                textDecoration: "none",
                color: pathname.startsWith("/citizen") ? "var(--text-accent)" : "var(--text-secondary)",
                background: pathname.startsWith("/citizen") ? "var(--border-subtle)" : "transparent",
                fontWeight: pathname.startsWith("/citizen") ? 600 : 500,
                transition: "all 0.15s ease",
              }}
            >
              Citizen Portal
            </Link>

            <Link
              href="/dashboard"
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: "var(--radius-md)",
                fontSize: "0.85rem",
                textDecoration: "none",
                color: pathname === "/dashboard" || pathname.startsWith("/dashboard/complaints") ? "var(--text-accent)" : "var(--text-secondary)",
                background: pathname === "/dashboard" || pathname.startsWith("/dashboard/complaints") ? "var(--border-subtle)" : "transparent",
                fontWeight: pathname === "/dashboard" || pathname.startsWith("/dashboard/complaints") ? 600 : 500,
                transition: "all 0.15s ease",
              }}
            >
              Command Center
            </Link>

            <Link
              href="/dashboard/approvals"
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: "var(--radius-md)",
                fontSize: "0.85rem",
                textDecoration: "none",
                color: pathname.startsWith("/dashboard/approvals") ? "var(--accent-danger)" : "var(--text-secondary)",
                background: pathname.startsWith("/dashboard/approvals") ? "rgba(244, 63, 94, 0.14)" : "transparent",
                fontWeight: pathname.startsWith("/dashboard/approvals") ? 600 : 500,
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                transition: "all 0.15s ease",
              }}
            >
              <AlertCircle size={15} />
              Approvals
            </Link>

            <Link
              href="/admin"
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: "var(--radius-md)",
                fontSize: "0.85rem",
                textDecoration: "none",
                color: pathname.startsWith("/admin") ? "var(--text-accent)" : "var(--text-secondary)",
                background: pathname.startsWith("/admin") ? "var(--border-subtle)" : "transparent",
                fontWeight: pathname.startsWith("/admin") ? 600 : 500,
                transition: "all 0.15s ease",
              }}
            >
              Audit & Config
            </Link>
          </nav>
        </div>

        {/* Actions: Theme Toggle, Reset Demo, Role Selector */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
          {/* Theme Toggle (Light / Dark) */}
          <button
            onClick={toggleTheme}
            className="theme-toggle-btn"
            title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
            aria-label="Toggle Theme"
          >
            {theme === "dark" ? (
              <Sun size={15} style={{ color: "var(--accent-warning)" }} />
            ) : (
              <Moon size={15} style={{ color: "var(--accent-primary)" }} />
            )}
          </button>

          {/* Quick Demo Reset Button */}
          <button
            onClick={() => setShowResetModal(true)}
            disabled={isResetting}
            title="Reset Deterministic Demo Data (A1024 - A1028)"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.35rem 0.75rem",
              background: "var(--bg-tertiary)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              color: "var(--text-secondary)",
              fontSize: "0.78rem",
              fontWeight: 500,
              cursor: isResetting ? "not-allowed" : "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <RefreshCw size={13} className={isResetting ? "animate-spin" : ""} />
            <span>Reset Demo</span>
          </button>

          {/* Role Switcher (Linear / macOS Segmented Control) */}
          <div className="segmented-control">
            <button
              onClick={() => handleRoleSwitch("CITIZEN")}
              className={`segmented-item ${role === "CITIZEN" ? "segmented-item-active" : ""}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.3rem",
              }}
            >
              <User size={12} />
              Citizen
            </button>

            <button
              onClick={() => handleRoleSwitch("OPERATOR")}
              className={`segmented-item ${role === "OPERATOR" ? "segmented-item-active" : ""}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.3rem",
              }}
            >
              <Shield size={12} />
              Operator
            </button>

            <button
              onClick={() => handleRoleSwitch("ADMIN")}
              className={`segmented-item ${role === "ADMIN" ? "segmented-item-active" : ""}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.3rem",
              }}
            >
              <Settings size={12} />
              Admin
            </button>
          </div>
        </div>
      </div>

      {/* Styled Confirmation Modal (Medium Popup) */}
      <ConfirmModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onConfirm={handleExecuteReset}
        title="Reset Demo Dataset"
        description="This will reset all civic operational data to the pristine initial deterministic baseline. All case progression and audit timelines will be synchronized."
        confirmText="Confirm & Reset Baseline"
        cancelText="Cancel"
        variant="warning"
        isLoading={isResetting}
        impactItems={[
          "Re-seeds core cases A1024–A1028 (Streetlight, Potholes, WASA, Waste, Unassigned)",
          "Restores SLA deadlines, commitments, and officer assignments",
          "Re-hashes the tamper-evident cryptographic SHA-256 genesis ledger",
          "Cleans up transient test submissions from active session",
        ]}
      />
    </header>
  );
}
