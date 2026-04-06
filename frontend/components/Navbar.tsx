"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { UserRole } from "@/lib/types";

interface NavbarProps {
  userRole: UserRole | null;
  userEmail: string | null;
  onSignOut: () => void | Promise<void>;
}

const NAV_LINKS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Records", href: "/records" },
];

const ROLE_PILL_STYLE: Record<UserRole, string> = {
  viewer: "bg-[#E1F5EE] text-[#085041]",
  analyst: "bg-[#E6F1FB] text-[#0C447C]",
  admin: "bg-[#FAEEDA] text-[#633806]",
};

export default function Navbar({ userRole, userEmail, onSignOut }: NavbarProps) {
  const pathname = usePathname();

  return (
    <header className="h-[56px] border-b border-[var(--border)] bg-[var(--bg-1)]">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[6px] bg-[#1D9E75]">
              <svg viewBox="0 0 24 24" className="h-[14px] w-[14px]" fill="none" aria-hidden="true">
                <path
                  d="M3 16L8 11L12 15L21 6"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M17 6H21V10"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="text-[14px] font-medium text-[var(--text-1)]">Finance Dashboard</span>
          </Link>

          <nav className="flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const isActive = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`inline-flex h-[56px] items-center border-b-2 px-3 text-sm ${
                    isActive
                      ? "border-[var(--green)] font-medium text-[var(--text-1)]"
                      : "border-transparent text-[var(--text-2)]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {userRole ? (
            <span className={`rounded px-1.5 py-0.5 text-[11px] ${ROLE_PILL_STYLE[userRole]}`}>
              {userRole}
            </span>
          ) : null}
          {userEmail ? <span className="hidden text-xs text-[var(--text-2)] md:inline">{userEmail}</span> : null}

          <button
            type="button"
            onClick={() => void onSignOut()}
            className="rounded-md border border-[var(--border)] bg-transparent px-3 py-1 text-xs text-[var(--text-2)]"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
