"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { UserRole } from "@/lib/types";

interface NavbarProps {
  userRole: UserRole | null;
  userEmail: string | null;
  onSignOut: () => void | Promise<void>;
  onRoleChange?: (newRole: UserRole) => void;
}

const NAV_LINKS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Records", href: "/records" },
];

export default function Navbar({ userRole, userEmail, onSignOut, onRoleChange }: NavbarProps) {
  const pathname = usePathname();
  const [selectedRole, setSelectedRole] = useState<UserRole>(userRole ?? "viewer");

  useEffect(() => {
    if (userRole) {
      setSelectedRole(userRole);
    }
  }, [userRole]);

  const showRoleSwitcher =
    process.env.NODE_ENV === "development" && Boolean(onRoleChange) && Boolean(userRole);

  return (
    <header className="h-[52px] border-b border-gray-100 bg-white">
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
            <span className="text-[14px] font-medium text-gray-900">Finance Dashboard</span>
          </Link>

          <nav className="flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const isActive = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`inline-flex h-[52px] items-center border-b-2 px-3 text-sm ${
                    isActive
                      ? "border-[#1D9E75] font-medium text-gray-900"
                      : "border-transparent text-gray-400"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {userEmail ? <span className="hidden text-xs text-gray-400 md:inline">{userEmail}</span> : null}

          {showRoleSwitcher ? (
            <select
              value={selectedRole}
              onChange={(event) => {
                const role = event.target.value as UserRole;
                setSelectedRole(role);
                onRoleChange?.(role);
              }}
              className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600"
            >
              <option value="viewer">Role: viewer</option>
              <option value="analyst">Role: analyst</option>
              <option value="admin">Role: admin</option>
            </select>
          ) : null}

          <button
            type="button"
            onClick={() => void onSignOut()}
            className="rounded-md border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
