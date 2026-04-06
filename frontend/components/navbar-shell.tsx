"use client";

import { usePathname } from "next/navigation";

import Navbar from "@/components/Navbar";
import { useAuth } from "@/lib/auth-context";
import { logger } from "@/lib/logger";
import { DEV_ROLE_EVENT, setDevRole } from "@/lib/roleOverride";
import { UserRole } from "@/lib/types";

export default function NavbarShell() {
  const pathname = usePathname();
  const { firebaseUser, profile, logout, refreshProfile } = useAuth();

  if (pathname === "/login" || !firebaseUser) {
    return null;
  }

  const role = profile?.role ?? null;
  const email = profile?.email ?? firebaseUser.email ?? null;

  const onRoleChange = async (newRole: UserRole) => {
    setDevRole(newRole);
    await refreshProfile();
    window.dispatchEvent(new Event(DEV_ROLE_EVENT));
    logger.info("auth", "Development role override changed", { newRole });
  };

  const onSignOut = async () => {
    await logout();
  };

  return (
    <Navbar
      userRole={role}
      userEmail={email}
      onSignOut={onSignOut}
      onRoleChange={onRoleChange}
    />
  );
}
