"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  getDashboardByCategory,
  getDashboardRecent,
  getDashboardSummary,
  getDashboardTrends,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { logger } from "@/lib/logger";
import { CategorySummary, DashboardSummary, RecordItem, TrendItem } from "@/lib/types";

function asCurrency(value: string | number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export default function DashboardPage() {
  const router = useRouter();
  const { firebaseUser, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [recent, setRecent] = useState<RecordItem[]>([]);
  const [trends, setTrends] = useState<TrendItem[]>([]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      logger.info("dashboard", "Loading dashboard data");
      const [summaryData, categoryData, recentData, trendData] = await Promise.all([
        getDashboardSummary(),
        getDashboardByCategory(),
        getDashboardRecent(10),
        getDashboardTrends(6),
      ]);

      setSummary(summaryData);
      setCategories(categoryData);
      setRecent(recentData);
      setTrends(trendData);
      logger.info("dashboard", "Dashboard data loaded", {
        categories: categoryData.length,
        recent: recentData.length,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
      logger.error("dashboard", "Failed to load dashboard", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !firebaseUser) {
      router.replace("/login");
      return;
    }

    if (firebaseUser) {
      void loadDashboard();
    }
  }, [authLoading, firebaseUser, router]);

  const cards = useMemo(
    () => [
      {
        label: "Total Income",
        value: asCurrency(summary?.total_income ?? 0),
        tone: "text-emerald-700",
      },
      {
        label: "Total Expenses",
        value: asCurrency(summary?.total_expenses ?? 0),
        tone: "text-rose-700",
      },
      {
        label: "Net Balance",
        value: asCurrency(summary?.net_balance ?? 0),
        tone: "text-sky-700",
      },
    ],
    [summary],
  );

  if (authLoading || (!firebaseUser && !error)) {
    return <p className="text-sm text-slate-600">Checking session...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <button
          type="button"
          onClick={() => void loadDashboard()}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
        >
          Refresh
        </button>
      </div>

      {loading ? <p className="text-sm text-slate-600">Loading dashboard...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <article key={card.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className={`mt-2 text-xl font-semibold ${card.tone}`}>{card.value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Recent Activity</h2>
          <ul className="space-y-2 text-sm">
            {recent.length === 0 ? <li className="text-slate-500">No recent records.</li> : null}
            {recent.map((item) => (
              <li key={item.id} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                <div>
                  <p className="font-medium text-slate-800">{item.category}</p>
                  <p className="text-xs text-slate-500">{item.date}</p>
                </div>
                <p className={item.type === "income" ? "text-emerald-700" : "text-rose-700"}>
                  {asCurrency(item.amount)}
                </p>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Category Breakdown</h2>
          <ul className="space-y-2 text-sm">
            {categories.length === 0 ? <li className="text-slate-500">No category data yet.</li> : null}
            {categories.map((row) => (
              <li key={row.category} className="rounded-md bg-slate-50 px-3 py-2">
                <p className="font-medium text-slate-800">{row.category}</p>
                <div className="mt-1 flex items-center gap-4 text-xs text-slate-600">
                  <span>Income: {asCurrency(row.total_income)}</span>
                  <span>Expense: {asCurrency(row.total_expense)}</span>
                  <span className="font-medium">Net: {asCurrency(row.net)}</span>
                </div>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Monthly Trends</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="pb-2">Month</th>
                <th className="pb-2">Income</th>
                <th className="pb-2">Expenses</th>
                <th className="pb-2">Net</th>
              </tr>
            </thead>
            <tbody>
              {trends.length === 0 ? (
                <tr>
                  <td className="py-2 text-slate-500" colSpan={4}>
                    No trend data available.
                  </td>
                </tr>
              ) : null}
              {trends.map((item) => (
                <tr key={item.month} className="border-t border-slate-100">
                  <td className="py-2 font-medium">{item.month}</td>
                  <td className="py-2">{asCurrency(item.total_income)}</td>
                  <td className="py-2">{asCurrency(item.total_expenses)}</td>
                  <td className="py-2">{asCurrency(item.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
