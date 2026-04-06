export type UserRole = "viewer" | "analyst" | "admin";
export type UserStatus = "active" | "inactive";
export type RecordType = "income" | "expense";

export interface User {
  id: string;
  firebase_uid: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
}

export interface SyncUserPayload {
  firebase_uid: string;
  email: string;
  name: string;
}

export interface FinancialRecord {
  id: string;
  user_id: string;
  amount: number;
  type: RecordType;
  category: string;
  date: string;
  notes?: string;
  created_at: string;
}

export interface CreateRecordPayload {
  amount: number;
  type: RecordType;
  category: string;
  date: string;
  notes?: string;
}

export interface UpdateRecordPayload {
  amount?: number;
  type?: RecordType;
  category?: string;
  date?: string;
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
  total_income: number;
  total_expenses: number;
  total_records: number;
  net_balance: number;
}

export interface RecordsResponse {
  data: FinancialRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface CategorySummary {
  category: string;
  total_income: number;
  total_expenses: number;
}

export interface TrendItem {
  month: string;
  total_income: number;
  total_expenses: number;
  net: number;
}

export type AppUser = User;
export type RecordItem = FinancialRecord;
