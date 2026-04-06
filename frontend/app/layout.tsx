import type { Metadata } from "next";

import NavbarShell from "@/components/navbar-shell";
import Providers from "@/components/providers";

import "./globals.css";

export const metadata: Metadata = {
  title: "Finance Dashboard",
  description: "Finance dashboard frontend",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark">
      <body className="bg-[var(--bg-0)] text-[var(--text-1)]">
        <Providers>
          <NavbarShell />
          <main className="mx-auto w-full max-w-6xl px-4 py-5">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
