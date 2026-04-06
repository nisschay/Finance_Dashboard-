import { UserRole } from "@/lib/types";

export const DEV_ROLE_EVENT = "dev-role-override-changed";

export function getDevRole(): string | null {
  if (process.env.NODE_ENV !== "development" || typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem("dev_role_override");
}

export function setDevRole(role: string) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem("dev_role_override", role);
}

export function isUserRole(role: string | null): role is UserRole {
  return role === "viewer" || role === "analyst" || role === "admin";
}
