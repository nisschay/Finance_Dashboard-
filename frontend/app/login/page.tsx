"use client";

import {
  GoogleAuthProvider,
  User,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth-context";
import { auth } from "@/lib/firebase";

type AuthTab = "signin" | "create";
type LoadingAction = "signin" | "create" | "google" | "reset" | null;

function mapAuthError(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";

  switch (code) {
    case "auth/user-not-found":
      return "No account found with this email.";
    case "auth/wrong-password":
      return "Incorrect password. Please try again.";
    case "auth/invalid-credential":
      return "Invalid email or password. Use Forgot password to reset it.";
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/weak-password":
      return "Password must be at least 8 characters.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/popup-closed-by-user":
      return "Sign-in window was closed. Please try again.";
    case "auth/unauthorized-domain":
      return "Domain not authorized in Firebase Console.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

function getApiBaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!value) {
    throw new Error("API is not configured. Please set NEXT_PUBLIC_API_BASE_URL.");
  }

  return value.replace(/\/$/, "");
}

async function syncUserAfterAuth(user: User, name: string): Promise<void> {
  const token = await user.getIdToken();

  if (!user.email) {
    throw new Error("Authenticated user email is missing.");
  }

  const response = await fetch(`${getApiBaseUrl()}/users/sync`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      firebase_uid: user.uid,
      email: user.email,
      name,
    }),
  });

  if (!response.ok) {
    let message = "Could not sync user profile.";

    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) {
        message = payload.detail;
      }
    } catch {
      // Keep default sync failure message.
    }

    throw new Error(message);
  }
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 18 18" className="h-[18px] w-[18px]" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2045c0-.6382-.0573-1.2518-.1636-1.8409H9v3.4818h4.8436c-.2086 1.125-.8432 2.0782-1.7973 2.715v2.2577h2.9086c1.7027-1.5682 2.6851-3.8818 2.6851-6.6136z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.4673-.8068 5.9564-2.1818l-2.9086-2.2577c-.8068.5409-1.8409.8591-3.0478.8591-2.3441 0-4.3282-1.5845-5.0364-3.7136H.9573v2.3318A8.9996 8.9996 0 009 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.9636 10.706V8.3742H.9573A8.9996 8.9996 0 000 9c0 1.4495.3477 2.8218.9573 4.0382l3.0063-2.3323z"
      />
      <path
        fill="#EA4335"
        d="M9 3.5795c1.3214 0 2.5077.4541 3.44 1.3459l2.58-2.58C13.4636.891 11.4264 0 9 0A8.9996 8.9996 0 00.9573 4.9618l3.0063 2.3324C4.6718 5.1645 6.6559 3.5795 9 3.5795z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { firebaseUser, loading: authLoading } = useAuth();

  const [tab, setTab] = useState<AuthTab>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);

  useEffect(() => {
    if (!authLoading && firebaseUser) {
      router.push("/dashboard");
    }
  }, [authLoading, firebaseUser, router]);

  const isBusy = loadingAction !== null;

  const validateSignIn = () => {
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return false;
    }

    return true;
  };

  const validateCreate = () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return false;
    }

    if (password.trim().length < 8) {
      setError("Password must be at least 8 characters.");
      return false;
    }

    return true;
  };

  const onSignInClick = async () => {
    if (!auth) {
      setError("Authentication is not initialized.");
      return;
    }

    setError("");
    if (!validateSignIn()) {
      return;
    }

    setLoadingAction("signin");

    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      const fallbackName = result.user.displayName ?? result.user.email?.split("@")[0] ?? "User";
      await syncUserAfterAuth(result.user, fallbackName);
      router.push("/dashboard");
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setLoadingAction(null);
    }
  };

  const onCreateAccountClick = async () => {
    if (!auth) {
      setError("Authentication is not initialized.");
      return;
    }

    setError("");
    if (!validateCreate()) {
      return;
    }

    setLoadingAction("create");

    try {
      const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const fallbackName = name.trim() || result.user.email?.split("@")[0] || "User";
      await syncUserAfterAuth(result.user, fallbackName);
      router.push("/dashboard");
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setLoadingAction(null);
    }
  };

  const onGoogleClick = async () => {
    if (!auth) {
      setError("Authentication is not initialized.");
      return;
    }

    setError("");
    setLoadingAction("google");

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const fallbackName =
        result.user.displayName ??
        (name.trim() || result.user.email?.split("@")[0] || "User");
      await syncUserAfterAuth(result.user, fallbackName);
      router.push("/dashboard");
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setLoadingAction(null);
    }
  };

  const onForgotPasswordClick = async () => {
    if (!auth) {
      setError("Authentication is not initialized.");
      return;
    }

    if (!email.trim()) {
      setError("Enter your email first, then click Forgot password.");
      return;
    }

    setError("");
    setLoadingAction("reset");

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setError("Password reset email sent. Check your inbox and spam folder.");
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <section className="mx-auto flex min-h-[calc(100vh-120px)] max-w-6xl items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px] rounded-[16px] border border-gray-200 bg-white p-8" style={{ borderWidth: "0.5px" }}>
        <div className="flex items-center gap-2">
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
          <span className="text-[15px] font-medium text-gray-900">Finance Dashboard</span>
        </div>

        <div className="mt-5 rounded-xl bg-gray-100 p-1">
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => {
                setTab("signin");
                setError("");
              }}
              className={`h-[34px] rounded-lg text-sm ${
                tab === "signin"
                  ? "border border-gray-200 bg-white text-gray-900"
                  : "border border-transparent bg-transparent text-gray-500"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("create");
                setError("");
              }}
              className={`h-[34px] rounded-lg text-sm ${
                tab === "create"
                  ? "border border-gray-200 bg-white text-gray-900"
                  : "border border-transparent bg-transparent text-gray-500"
              }`}
            >
              Create account
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="mt-4 space-y-3">
          {tab === "create" ? (
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Full name"
              className="h-[38px] w-full rounded-md border border-gray-200 px-3 text-sm text-gray-800 outline-none focus:border-[#1D9E75] focus:shadow-[0_0_0_3px_rgba(29,158,117,0.12)]"
              style={{ borderWidth: "0.5px" }}
            />
          ) : null}

          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            className="h-[38px] w-full rounded-md border border-gray-200 px-3 text-sm text-gray-800 outline-none focus:border-[#1D9E75] focus:shadow-[0_0_0_3px_rgba(29,158,117,0.12)]"
            style={{ borderWidth: "0.5px" }}
          />

          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            className="h-[38px] w-full rounded-md border border-gray-200 px-3 text-sm text-gray-800 outline-none focus:border-[#1D9E75] focus:shadow-[0_0_0_3px_rgba(29,158,117,0.12)]"
            style={{ borderWidth: "0.5px" }}
          />

          {tab === "signin" ? (
            <div className="flex justify-end">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void onForgotPasswordClick()}
                className="text-sm text-[#1D9E75] hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingAction === "reset" ? "Sending reset email..." : "Forgot password?"}
              </button>
            </div>
          ) : null}

          {tab === "signin" ? (
            <button
              type="button"
              onClick={() => void onSignInClick()}
              disabled={isBusy}
              className="h-[38px] w-full rounded-md bg-[#1D9E75] text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingAction === "signin" ? "Signing in..." : "Sign in"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void onCreateAccountClick()}
              disabled={isBusy}
              className="h-[38px] w-full rounded-md bg-[#1D9E75] text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingAction === "create" ? "Creating account..." : "Create account"}
            </button>
          )}

          <div className="flex items-center gap-2 py-1">
            <span className="h-px flex-1 bg-gray-200" />
            <span className="text-xs uppercase tracking-wide text-gray-400">or</span>
            <span className="h-px flex-1 bg-gray-200" />
          </div>

          <button
            type="button"
            onClick={() => void onGoogleClick()}
            disabled={isBusy}
            className="flex h-[38px] w-full items-center justify-center gap-2 rounded-md border border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ borderWidth: "0.5px" }}
          >
            <GoogleLogo />
            <span>{loadingAction === "google" ? "Connecting..." : "Continue with Google"}</span>
          </button>
        </div>
      </div>

      <p className="absolute bottom-6 left-0 right-0 text-center text-xs text-gray-400">
        Secure access for your finance workspace.
      </p>
    </section>
  );
}
