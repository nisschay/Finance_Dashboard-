"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/lib/auth-context";

export default function Navbar() {
  const pathname = usePathname();
  const { firebaseUser, profile, logout } = useAuth();

  if (pathname === "/login") {
    return null;
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-lg font-semibold text-slate-900">
            Finance Dashboard
          </Link>
          {firebaseUser ? (
            <nav className="flex items-center gap-3 text-sm text-slate-600">
              <Link href="/dashboard" className="hover:text-slate-900">
                Dashboard
              </Link>
              <Link href="/records" className="hover:text-slate-900">
                Records
              </Link>
            </nav>
          ) : null}
        </div>

        <div className="flex items-center gap-3 text-sm">
          {profile ? (
            <span className="rounded-full bg-brand-50 px-3 py-1 font-medium text-brand-700">
              Role: {profile.role}
            </span>
          ) : null}

          {firebaseUser ? (
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
            >
              Sign Out
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
