"use client";

import {
  User,
  UserCredential,
  onIdTokenChanged,
  onAuthStateChanged,
  signInWithRedirect,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { getMe, syncUser } from "@/lib/api";
import { auth, googleProvider } from "@/lib/firebase";
import { logger } from "@/lib/logger";
import { AppUser } from "@/lib/types";

interface AuthContextValue {
  firebaseUser: User | null;
  profile: AppUser | null;
  loading: boolean;
  error: string | null;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const POPUP_TIMEOUT_MS = 15000;
const POPUP_FALLBACK_ERROR_CODES = new Set([
  "auth/popup-blocked",
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/operation-not-supported-in-this-environment",
]);

function getAuthErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function shouldFallbackToRedirect(error: unknown): boolean {
  if (error instanceof Error && error.message === "popup-timeout") {
    return true;
  }

  const code = getAuthErrorCode(error);
  return Boolean(code && POPUP_FALLBACK_ERROR_CODES.has(code));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshProfile = async () => {
    try {
      const me = await getMe();
      setProfile(me);
      setError(null);
      logger.info("auth", "Profile refreshed", { userId: me.id, role: me.role });
    } catch (err) {
      setProfile(null);
      setError(err instanceof Error ? err.message : "Failed to load profile");
      logger.error("auth", "Profile refresh failed", err);
    }
  };

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      setError("Firebase Auth is not initialized");
      logger.error("auth", "Firebase Auth is not initialized");
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (!user) {
        setProfile(null);
        setLoading(false);
        logger.info("auth", "User logged out");
        return;
      }

      logger.info("auth", "User logged in", { uid: user.uid, email: user.email });

      try {
        await refreshProfile();
      } finally {
        setLoading(false);
      }
    });

    const unsubscribeToken = onIdTokenChanged(auth, async (user) => {
      if (!user) {
        return;
      }

      try {
        await user.getIdToken();
        logger.info("auth", "Firebase token refreshed", { uid: user.uid });
      } catch (err) {
        logger.error("auth", "Token refresh failed", err);
      }
    });

    return () => {
      unsubscribe();
      unsubscribeToken();
    };
  }, []);

  const loginWithGoogle = async () => {
    if (!auth) {
      throw new Error("Firebase Auth is not initialized");
    }

    setError(null);

    let popupTimeoutId: number | undefined;
    let result: UserCredential;

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        popupTimeoutId = window.setTimeout(() => {
          reject(new Error("popup-timeout"));
        }, POPUP_TIMEOUT_MS);
      });

      result = await Promise.race([signInWithPopup(auth, googleProvider), timeoutPromise]);
    } catch (err) {
      if (shouldFallbackToRedirect(err)) {
        logger.warn("auth", "Popup login did not complete, falling back to redirect", {
          code: getAuthErrorCode(err),
          message: err instanceof Error ? err.message : "unknown",
        });
        await signInWithRedirect(auth, googleProvider);
        return;
      }

      throw err;
    } finally {
      if (popupTimeoutId) {
        window.clearTimeout(popupTimeoutId);
      }
    }

    const user = result.user;

    if (!user.email) {
      throw new Error("Google account email is required");
    }

    await syncUser({
      firebase_uid: user.uid,
      email: user.email,
      name: user.displayName || user.email.split("@")[0],
    });
    logger.info("auth", "User synchronized after login", { uid: user.uid });

    await refreshProfile();
  };

  const logout = async () => {
    if (!auth) {
      return;
    }

    await signOut(auth);
    setProfile(null);
    logger.info("auth", "Sign out completed");
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      profile,
      loading,
      error,
      loginWithGoogle,
      logout,
      refreshProfile,
    }),
    [firebaseUser, profile, loading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
