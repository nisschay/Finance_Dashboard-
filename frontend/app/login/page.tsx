"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { firebaseUser, loading, error, loginWithGoogle } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && firebaseUser) {
      router.replace("/dashboard");
    }
  }, [firebaseUser, loading, router]);

  const onSignIn = async () => {
    setSubmitting(true);
    setLocalError(null);

    try {
      await loginWithGoogle();
      router.replace("/dashboard");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto mt-20 max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">Sign in to continue</h1>
      <p className="mt-2 text-sm text-slate-600">
        Use your Google account. After login, your profile is synced with the backend.
      </p>

      <button
        type="button"
        onClick={() => void onSignIn()}
        disabled={submitting || loading}
        className="mt-6 w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {submitting ? "Signing in..." : "Continue with Google"}
      </button>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {localError ? <p className="mt-3 text-sm text-red-600">{localError}</p> : null}
    </section>
  );
}
