export type UserRole = "CITIZEN" | "OPERATOR" | "ADMIN" | "SERVICE";

export interface UserSession {
  user_id: string;
  role: UserRole;
  email: string;
  name: string;
}

export interface AuthState {
  user: UserSession | null;
  token: string | null;
}
