"use client";

import { usePathname } from "next/navigation";

import Navbar from "@/components/Navbar";
import { useAuth } from "@/lib/auth-context";

export default function NavbarShell() {
  const pathname = usePathname();
  const { firebaseUser, profile, logout } = useAuth();

  if (pathname === "/login" || !firebaseUser) {
    return null;
  }

  const role = profile?.role ?? null;
  const email = profile?.email ?? firebaseUser.email ?? null;

  const onSignOut = async () => {
    await logout();
  };

  return <Navbar userRole={role} userEmail={email} onSignOut={onSignOut} />;
}
