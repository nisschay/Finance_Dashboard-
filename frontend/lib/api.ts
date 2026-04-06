import { auth } from "@/lib/firebase";
import {
  CategorySummary,
  CreateRecordPayload,
  DashboardSummary,
  FinancialRecord,
  GetRecordsParams,
  RecordsResponse,
  SyncUserPayload,
  TrendItem,
  UpdateRecordPayload,
  User,
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

type UnknownObject = Record<string, unknown>;

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

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toStringValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function normalizeRole(role: unknown): User["role"] {
  return role === "admin" || role === "analyst" ? role : "viewer";
}

function normalizeStatus(status: unknown): User["status"] {
  return status === "inactive" ? "inactive" : "active";
}

function normalizeUser(payload: UnknownObject): User {
  return {
    id: toStringValue(payload.id),
    firebase_uid: toStringValue(payload.firebase_uid),
    email: toStringValue(payload.email),
    name: toStringValue(payload.name),
    role: normalizeRole(payload.role),
    status: normalizeStatus(payload.status),
  };
}

function normalizeRecord(payload: UnknownObject): FinancialRecord {
  const notesValue = payload.notes;

  return {
    id: toStringValue(payload.id),
    user_id: toStringValue(payload.user_id),
    amount: toNumber(payload.amount),
    type: payload.type === "income" ? "income" : "expense",
    category: toStringValue(payload.category),
    date: toStringValue(payload.date).slice(0, 10),
    notes: notesValue ? toStringValue(notesValue) : undefined,
    created_at: toStringValue(payload.created_at),
  };
}

function normalizeSummary(payload: UnknownObject): DashboardSummary {
  return {
    total_income: toNumber(payload.total_income),
    total_expenses: toNumber(payload.total_expenses),
    net_balance: toNumber(payload.net_balance),
    total_records: toNumber(payload.total_records),
  };
}

function normalizeCategorySummary(payload: UnknownObject): CategorySummary {
  return {
    category: toStringValue(payload.category),
    total_income: toNumber(payload.total_income),
    total_expenses: toNumber(payload.total_expenses ?? payload.total_expense),
  };
}

function normalizeTrend(payload: UnknownObject): TrendItem {
  const totalIncome = toNumber(payload.total_income);
  const totalExpenses = toNumber(payload.total_expenses ?? payload.total_expense);

  return {
    month: toStringValue(payload.month),
    total_income: totalIncome,
    total_expenses: totalExpenses,
    net: toNumber(payload.net ?? totalIncome - totalExpenses),
  };
}

function buildRecordsPath(params: GetRecordsParams): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  });

  const qs = searchParams.toString();
  return qs ? `/records/?${qs}` : "/records/";
}

function isRecordsEnvelope(payload: unknown): payload is {
  data: unknown[];
  total?: number;
  page?: number;
  limit?: number;
} {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "data" in payload &&
    Array.isArray((payload as { data?: unknown }).data)
  );
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

export async function getMe(): Promise<User> {
  const response = await request<UnknownObject>("/users/me");
  return normalizeUser(response);
}

async function countRecords(filters: Omit<GetRecordsParams, "page" | "limit">): Promise<number> {
  const maxPages = 200;
  const countLimit = 100;
  let total = 0;

  for (let page = 1; page <= maxPages; page += 1) {
    const rawPage = await request<unknown>(
      buildRecordsPath({
        ...filters,
        page,
        limit: countLimit,
      }),
    );

    const pageRows = Array.isArray(rawPage)
      ? rawPage
      : isRecordsEnvelope(rawPage)
        ? rawPage.data
        : [];

    total += pageRows.length;

    if (pageRows.length < countLimit) {
      break;
    }
  }

  return total;
}

export async function getRecords(params: GetRecordsParams = {}): Promise<RecordsResponse> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const path = buildRecordsPath({ ...params, page, limit });
  const raw = await request<unknown>(path);

  if (isRecordsEnvelope(raw)) {
    return {
      data: raw.data.map((item) => normalizeRecord(item as UnknownObject)),
      total: toNumber(raw.total),
      page: toNumber(raw.page) || page,
      limit: toNumber(raw.limit) || limit,
    };
  }

  if (Array.isArray(raw)) {
    const data = raw.map((item) => normalizeRecord(item as UnknownObject));
    const total = await countRecords({
      type: params.type,
      category: params.category,
      from_date: params.from_date,
      to_date: params.to_date,
    });

    return {
      data,
      total,
      page,
      limit,
    };
  }

  return {
    data: [],
    total: 0,
    page,
    limit,
  };
}

export async function createRecord(payload: CreateRecordPayload): Promise<FinancialRecord> {
  const response = await request<UnknownObject>("/records/", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return normalizeRecord(response);
}

export async function updateRecord(
  recordId: string,
  payload: UpdateRecordPayload,
): Promise<FinancialRecord> {
  const response = await request<UnknownObject>(`/records/${recordId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return normalizeRecord(response);
}

export async function deleteRecord(recordId: string): Promise<void> {
  await request<void>(`/records/${recordId}`, {
    method: "DELETE",
  });
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const response = await request<UnknownObject>("/dashboard/summary");
  return normalizeSummary(response);
}

export async function getDashboardByCategory(): Promise<CategorySummary[]> {
  const response = await request<unknown>("/dashboard/by-category");
  if (!Array.isArray(response)) {
    return [];
  }

  return response.map((item) => normalizeCategorySummary(item as UnknownObject));
}

export async function getDashboardTrends(months = 6): Promise<TrendItem[]> {
  const response = await request<unknown>(`/dashboard/trends?months=${months}`);
  if (!Array.isArray(response)) {
    return [];
  }

  return response.map((item) => normalizeTrend(item as UnknownObject));
}

export async function getDashboardRecent(limit = 10): Promise<FinancialRecord[]> {
  const response = await request<unknown>(`/dashboard/recent?limit=${limit}`);
  if (!Array.isArray(response)) {
    return [];
  }

  return response.map((item) => normalizeRecord(item as UnknownObject));
}

export { ApiError };
