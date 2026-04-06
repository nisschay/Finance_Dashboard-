"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getDashboardByCategory,
  getDashboardRecent,
  getDashboardSummary,
  getDashboardTrends,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { CategorySummary, DashboardSummary, FinancialRecord, TrendItem, UserRole } from "@/lib/types";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

const ROLE_COLORS: Record<UserRole, { bg: string; text: string }> = {
  viewer: { bg: "bg-[#E1F5EE]", text: "text-[#085041]" },
  analyst: { bg: "bg-[#E6F1FB]", text: "text-[#0C447C]" },
  admin: { bg: "bg-[#FAEEDA]", text: "text-[#633806]" },
};

const ROLE_MESSAGE: Record<UserRole, string> = {
  viewer: "You can view dashboard data. Analysts and admins can manage records.",
  analyst: "You can view data and create or edit records.",
  admin: "You have full access including user management and deletion.",
};

const EMPTY_SUMMARY: DashboardSummary = {
  total_income: 0,
  total_expenses: 0,
  net_balance: 0,
  total_records: 0,
};

export default function DashboardPage() {
  const router = useRouter();
  const { firebaseUser, profile, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [recent, setRecent] = useState<FinancialRecord[]>([]);
  const [trends, setTrends] = useState<TrendItem[]>([]);

  const role = profile?.role ?? "viewer";
  const roleColor = ROLE_COLORS[role];

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [summaryResult, recentResult, categoryResult, trendsResult] = await Promise.allSettled([
      getDashboardSummary(),
      getDashboardRecent(10),
      getDashboardByCategory(),
      getDashboardTrends(6),
    ]);

    if (summaryResult.status === "fulfilled") {
      setSummary(summaryResult.value);
    } else {
      setSummary(EMPTY_SUMMARY);
    }

    setRecent(recentResult.status === "fulfilled" ? recentResult.value : []);
    setCategories(categoryResult.status === "fulfilled" ? categoryResult.value : []);
    setTrends(trendsResult.status === "fulfilled" ? trendsResult.value : []);

    const failedCalls = [summaryResult, recentResult, categoryResult, trendsResult].filter(
      (result) => result.status === "rejected",
    ).length;

    if (failedCalls > 0) {
      setError("Some dashboard data could not be loaded with your current permissions.");
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading && !firebaseUser) {
      router.replace("/login");
      return;
    }

    if (firebaseUser) {
      void loadDashboard();
    }
  }, [authLoading, firebaseUser, router, loadDashboard]);

  const categoryRows = useMemo(() => {
    return categories.map((item) => ({
      category: item.category,
      total: item.total_income - item.total_expenses,
    }));
  }, [categories]);

  if (authLoading || (!firebaseUser && !error)) {
    return <p className="text-sm text-gray-400">Checking session...</p>;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[18px] font-medium text-gray-900">Dashboard</h1>
        <button
          type="button"
          onClick={() => void loadDashboard()}
          className="rounded-lg border border-gray-200 bg-white px-3.5 py-1.5 text-sm text-gray-500"
        >
          Refresh
        </button>
      </div>

      <div className="rounded-lg border border-gray-100 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-500">
        <span className={`mr-1 rounded px-1.5 py-0.5 text-xs ${roleColor.bg} ${roleColor.text}`}>{role}</span>
        {ROLE_MESSAGE[role]}
      </div>

      {loading ? <p className="text-sm text-gray-400">Loading dashboard...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-3 md:grid-cols-3">
        <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-none">
          <p className="text-[12px] text-gray-400">Total Income</p>
          <p className="mt-1.5 text-[22px] font-medium text-[#0F6E56]">
            {formatCurrency(summary.total_income)}
          </p>
        </article>

        <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-none">
          <p className="text-[12px] text-gray-400">Total Expenses</p>
          <p className="mt-1.5 text-[22px] font-medium text-[#A32D2D]">
            {formatCurrency(summary.total_expenses)}
          </p>
        </article>

        <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-none">
          <p className="text-[12px] text-gray-400">Net Balance</p>
          <p className="mt-1.5 text-[22px] font-medium text-[#185FA5]">
            {formatCurrency(summary.net_balance)}
          </p>
        </article>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-none">
          <h2 className="mb-3 text-[13px] font-medium text-gray-900">Recent activity</h2>
          {recent.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-gray-400">No recent records.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recent.map((item) => {
                const amountText = `${item.type === "income" ? "+" : "-"}${formatCurrency(
                  item.amount,
                )}`;
                const amountColor = item.type === "income" ? "text-[#0F6E56]" : "text-[#A32D2D]";

                return (
                  <li key={item.id} className="flex items-center justify-between py-2 text-[13px]">
                    <span className="text-gray-700">{item.category}</span>
                    <span className={`font-medium ${amountColor}`}>{amountText}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </article>

        <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-none">
          <h2 className="mb-3 text-[13px] font-medium text-gray-900">Category breakdown</h2>
          {categoryRows.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-gray-400">No category data yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {categoryRows.map((row) => (
                <li key={row.category} className="flex items-center justify-between py-2 text-[13px]">
                  <span className="text-gray-700">{row.category}</span>
                  <span className="font-medium text-gray-700">{formatCurrency(row.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>

      <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-none">
        <h2 className="mb-3 text-[13px] font-medium text-gray-900">Monthly trends</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-100 text-left text-[11px] font-medium uppercase tracking-wide text-gray-400">
                <th className="px-2 py-2">Month</th>
                <th className="px-2 py-2">Income</th>
                <th className="px-2 py-2">Expenses</th>
                <th className="px-2 py-2">Net</th>
              </tr>
            </thead>
            <tbody>
              {trends.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-2 py-6 text-center text-[13px] text-gray-400">
                    No trend data available.
                  </td>
                </tr>
              ) : (
                trends.map((item) => (
                  <tr key={item.month} className="border-b border-gray-100 text-[13px]">
                    <td className="px-2 py-2 text-gray-400">{item.month}</td>
                    <td className="px-2 py-2 text-[#0F6E56]">{formatCurrency(item.total_income)}</td>
                    <td className="px-2 py-2 text-[#A32D2D]">{formatCurrency(item.total_expenses)}</td>
                    <td className="px-2 py-2 text-[#185FA5]">{formatCurrency(item.net)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
