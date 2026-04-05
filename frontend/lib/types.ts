export type UserRole = "viewer" | "analyst" | "admin";
export type UserStatus = "active" | "inactive";
export type RecordType = "income" | "expense";

export interface AppUser {
  id: number;
  email: string;
  role: UserRole;
  status: UserStatus;
}

export interface SyncUserPayload {
  firebase_uid: string;
  email: string;
  name: string;
}

export interface RecordItem {
  id: number;
  user_id: number;
  amount: string;
  type: RecordType;
  category: string;
  date: string;
  notes: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateRecordPayload {
  amount: number;
  type: RecordType;
  category: string;
  date: string;
  notes?: string;
}

export interface GetRecordsParams {
  type?: RecordType;
  category?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
}

export interface DashboardSummary {
  total_income: string;
  total_expenses: string;
  net_balance: string;
  total_records: number;
}

export interface CategorySummary {
  category: string;
  total_income: string;
  total_expense: string;
  net: string;
}

export interface TrendItem {
  month: string;
  total_income: string;
  total_expenses: string;
  net: string;
}
