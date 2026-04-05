"use client";

import { ReactNode } from "react";

import RouteChangeLogger from "@/components/route-change-logger";
import { AuthProvider } from "@/lib/auth-context";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <RouteChangeLogger />
      {children}
    </AuthProvider>
  );
}
