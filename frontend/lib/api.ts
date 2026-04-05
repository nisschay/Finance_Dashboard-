import { auth } from "@/lib/firebase";
import {
  AppUser,
  CategorySummary,
  CreateRecordPayload,
  DashboardSummary,
  GetRecordsParams,
  RecordItem,
  SyncUserPayload,
  TrendItem,
} from "@/lib/types";
import { logger } from "@/lib/logger";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function getBearerToken(): Promise<string> {
  if (!auth) {
    throw new ApiError("Firebase Auth is not initialized", 500);
  }

  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new ApiError("No authenticated Firebase user found", 401);
  }

  return currentUser.getIdToken();
}

function makeUrl(path: string): string {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
  }

  return `${API_BASE_URL.replace(/\/$/, "")}${path}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method || "GET").toUpperCase();
  const start = Date.now();
  logger.info("api", `Request started: ${method} ${path}`, {
    method,
    path,
    query: path.includes("?") ? path.split("?")[1] : undefined,
  });

  const token = await getBearerToken();
  const headers = new Headers(init?.headers ?? {});

  headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(makeUrl(path), {
    ...init,
    headers,
  });

  logger.info("api", `Request completed: ${method} ${path}`, {
    status: response.status,
    durationMs: Date.now() - start,
  });

  if (!response.ok) {
    let errorMessage = "API request failed";

    try {
      const errorBody = (await response.json()) as {
        detail?: string;
        error?: { message?: string };
      };
      if (errorBody.error?.message) {
        errorMessage = errorBody.error.message;
      } else if (errorBody.detail) {
        errorMessage = errorBody.detail;
      }
    } catch {
      errorMessage = response.statusText || errorMessage;
    }

    logger.error("api", `Request failed: ${method} ${path}`, {
      status: response.status,
      message: errorMessage,
      durationMs: Date.now() - start,
    });

    throw new ApiError(errorMessage, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function syncUser(payload: SyncUserPayload): Promise<void> {
  await request("/users/sync", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getMe(): Promise<AppUser> {
  return request<AppUser>("/users/me");
}

export async function getRecords(params: GetRecordsParams = {}): Promise<RecordItem[]> {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  });

  const qs = searchParams.toString();
  const path = qs ? `/records?${qs}` : "/records";

  return request<RecordItem[]>(path);
}

export async function createRecord(payload: CreateRecordPayload): Promise<RecordItem> {
  return request<RecordItem>("/records", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return request<DashboardSummary>("/dashboard/summary");
}

export async function getDashboardByCategory(): Promise<CategorySummary[]> {
  return request<CategorySummary[]>("/dashboard/by-category");
}

export async function getDashboardTrends(months = 6): Promise<TrendItem[]> {
  return request<TrendItem[]>(`/dashboard/trends?months=${months}`);
}

export async function getDashboardRecent(limit = 10): Promise<RecordItem[]> {
  return request<RecordItem[]>(`/dashboard/recent?limit=${limit}`);
}

export { ApiError };
