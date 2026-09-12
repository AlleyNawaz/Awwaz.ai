"use client";

import { UserSession, UserRole } from "@/types/auth";

const SESSION_KEY = "awwaz_active_user";

export const DEFAULT_USERS: Record<UserRole, UserSession> = {
  CITIZEN: {
    user_id: "user_citizen_tariq",
    role: "CITIZEN",
    email: "tariq@awwaz.ai",
    name: "Tariq Mahmood",
  },
  OPERATOR: {
    user_id: "user_operator_fatima",
    role: "OPERATOR",
    email: "fatima@awwaz.ai",
    name: "Fatima Noor (Operations Coordinator)",
  },
  ADMIN: {
    user_id: "user_admin_bilal",
    role: "ADMIN",
    email: "bilal@awwaz.ai",
    name: "Bilal Khan (Municipal Administrator)",
  },
  SERVICE: {
    user_id: "service_worker",
    role: "SERVICE",
    email: "worker@awwaz.ai",
    name: "Awwaz Automated Background Engine",
  },
};

export function getActiveUser(): UserSession {
  if (typeof window === "undefined") {
    return DEFAULT_USERS.CITIZEN;
  }
  try {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // fallback
  }
  return DEFAULT_USERS.CITIZEN;
}

export function setActiveUser(role: UserRole): UserSession {
  const user = DEFAULT_USERS[role] || DEFAULT_USERS.CITIZEN;
  if (typeof window !== "undefined") {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }
  return user;
}
