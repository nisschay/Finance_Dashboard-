"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import BarChart from "@/components/BarChart";
import CategoryTable from "@/components/CategoryTable";
import DonutChart from "@/components/DonutChart";
import MetricCard from "@/components/MetricCard";
import {
  getDashboardByCategory,
  getDashboardRecent,
  getDashboardSummary,
  getDashboardTrends,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { getCategoryColor } from "@/lib/categoryColors";
import { CategorySummary, DashboardSummary, FinancialRecord, TrendItem, UserRole } from "@/lib/types";

type DashboardTab = "overview" | "category-analysis" | "trends";
type DashboardFetchKey = "summary" | "recent" | "byCategory" | "trends";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) {
    return "0.0%";
  }

  return `${value.toFixed(1)}%`;
}

function monthLabel(rawMonth: string): string {
  const parsed = new Date(`${rawMonth}-01T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return rawMonth;
  }

  return parsed.toLocaleString("en-US", { month: "long" });
}

function dateLabel(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function LoadingSkeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-[var(--bg-2)] ${className}`} />;
}

function EmptyStateIllustration() {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <svg viewBox="0 0 220 120" className="h-[96px] w-[180px]" aria-hidden="true">
        <rect x="10" y="64" width="200" height="46" rx="10" fill="var(--bg-2)" />
        <rect x="22" y="74" width="26" height="26" rx="6" fill="var(--green-dim)" />
        <rect x="56" y="74" width="68" height="10" rx="4" fill="var(--bg-3)" />
        <rect x="56" y="90" width="45" height="8" rx="4" fill="var(--bg-3)" />
        <circle cx="167" cy="87" r="14" fill="var(--blue-dim)" />
        <circle cx="167" cy="87" r="7" fill="var(--blue)" />
        <rect x="28" y="22" width="42" height="36" rx="7" fill="var(--red-dim)" />
        <rect x="80" y="10" width="52" height="48" rx="7" fill="var(--green-dim)" />
        <rect x="142" y="30" width="42" height="28" rx="7" fill="var(--amber-dim)" />
      </svg>

      <p className="text-sm text-[var(--text-2)]">
        No records yet. Add your first record to see insights.
      </p>

      <Link
        href="/records"
        className="rounded-lg bg-[var(--green)] px-3.5 py-1.5 text-sm font-medium text-white"
      >
        Add record
      </Link>
    </div>
  );
}

const TAB_ITEMS: Array<{ id: DashboardTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "category-analysis", label: "Category analysis" },
  { id: "trends", label: "Trends" },
];

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

const EMPTY_ERRORS: Record<DashboardFetchKey, string | null> = {
  summary: null,
  recent: null,
  byCategory: null,
  trends: null,
};

export default function DashboardPage() {
  const router = useRouter();
  const { firebaseUser, profile, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [errors, setErrors] = useState<Record<DashboardFetchKey, string | null>>(EMPTY_ERRORS);
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [recent, setRecent] = useState<FinancialRecord[]>([]);
  const [trends, setTrends] = useState<TrendItem[]>([]);

  const role = profile?.role ?? "viewer";
  const roleColor = ROLE_COLORS[role];

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);

    const wrap = async <T,>(
      key: DashboardFetchKey,
      request: Promise<T>,
      fallback: T,
    ): Promise<{ key: DashboardFetchKey; data: T; error: string | null }> => {
      try {
        const data = await request;
        return { key, data, error: null };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load this section.";
        return { key, data: fallback, error: message };
      }
    };

    const [summaryResult, recentResult, byCategoryResult, trendsResult] = await Promise.all([
      wrap("summary", getDashboardSummary(), EMPTY_SUMMARY),
      wrap("recent", getDashboardRecent(10), [] as FinancialRecord[]),
      wrap("byCategory", getDashboardByCategory(), [] as CategorySummary[]),
      wrap("trends", getDashboardTrends(6), [] as TrendItem[]),
    ]);

    setSummary(summaryResult.data);
    setRecent(recentResult.data);
    setCategories(byCategoryResult.data);
    setTrends(trendsResult.data);

    setErrors({
      summary: summaryResult.error,
      recent: recentResult.error,
      byCategory: byCategoryResult.error,
      trends: trendsResult.error,
    });

    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!firebaseUser) {
      router.replace("/login");
      return;
    }

    if (!profile) {
      return;
    }

    void loadDashboard();
  }, [authLoading, firebaseUser, profile, router, loadDashboard]);

  const incomeRatio = useMemo(() => {
    const denominator = summary.total_income + summary.total_expenses;
    if (denominator <= 0) {
      return 0;
    }

    return (summary.total_income / denominator) * 100;
  }, [summary.total_income, summary.total_expenses]);

  const savingsRate = useMemo(() => {
    if (summary.total_income <= 0) {
      return 0;
    }

    return (summary.net_balance / summary.total_income) * 100;
  }, [summary.net_balance, summary.total_income]);

  const savingsColor = useMemo(() => {
    if (savingsRate > 50) {
      return "green" as const;
    }

    if (savingsRate >= 20) {
      return "amber" as const;
    }

    return "red" as const;
  }, [savingsRate]);

  const latestTrend = trends[trends.length - 1] ?? null;
  const previousTrend = trends[trends.length - 2] ?? null;

  const monthOverMonth = useMemo(() => {
    if (!latestTrend || !previousTrend || previousTrend.net === 0) {
      return null;
    }

    const change = ((latestTrend.net - previousTrend.net) / Math.abs(previousTrend.net)) * 100;
    return {
      direction: change >= 0 ? "up" : "down",
      value: Math.abs(change),
    };
  }, [latestTrend, previousTrend]);

  const trendBarData = useMemo(
    () =>
      trends.map((item) => ({
        month: item.month,
        income: item.total_income,
        expenses: item.total_expenses,
      })),
    [trends],
  );

  const netTrendData = useMemo(
    () => trends.map((item) => ({ month: item.month, value: item.net })),
    [trends],
  );

  const hasTrendValues = useMemo(
    () => trends.some((item) => item.total_income > 0 || item.total_expenses > 0 || item.net !== 0),
    [trends],
  );

  const expenseSegments = useMemo(
    () =>
      categories
        .filter((item) => item.total_expenses > 0)
        .sort((a, b) => b.total_expenses - a.total_expenses)
        .map((item) => ({
          label: item.category,
          value: item.total_expenses,
          color: getCategoryColor(item.category),
        })),
    [categories],
  );

  const incomeSources = useMemo(
    () =>
      categories
        .filter((item) => item.total_income > 0)
        .sort((a, b) => b.total_income - a.total_income),
    [categories],
  );

  const topIncomeCategory = useMemo(
    () =>
      categories
        .filter((item) => item.total_income > 0)
        .sort((a, b) => b.total_income - a.total_income)[0] ?? null,
    [categories],
  );

  const topExpenseCategory = useMemo(
    () =>
      categories
        .filter((item) => item.total_expenses > 0)
        .sort((a, b) => b.total_expenses - a.total_expenses)[0] ?? null,
    [categories],
  );

  const largestTransaction = useMemo(() => {
    if (recent.length === 0) {
      return null;
    }

    return recent.reduce((largest, current) =>
      Math.abs(current.amount) > Math.abs(largest.amount) ? current : largest,
    );
  }, [recent]);

  const hasAnyData =
    summary.total_records > 0 || recent.length > 0 || categories.length > 0 || hasTrendValues;

  const totalIncomeCategories = incomeSources.length;
  const totalExpenseCategories = categories.filter((item) => item.total_expenses > 0).length;
  const incomeGrandTotal = incomeSources.reduce((sum, item) => sum + item.total_income, 0);
  const totalIncomeAmount = categories.reduce((sum, item) => sum + item.total_income, 0);
  const totalExpenseAmount = categories.reduce((sum, item) => sum + item.total_expenses, 0);

  const topIncomeShare =
    topIncomeCategory && totalIncomeAmount > 0
      ? (topIncomeCategory.total_income / totalIncomeAmount) * 100
      : 0;
  const topExpenseShare =
    topExpenseCategory && totalExpenseAmount > 0
      ? (topExpenseCategory.total_expenses / totalExpenseAmount) * 100
      : 0;

  const isPageBooting = authLoading || (firebaseUser && !profile);

  const thisMonthSubtext = latestTrend ? `${monthLabel(latestTrend.month)} net` : "No monthly data";

  const thisMonthFooter = monthOverMonth ? (
    <span
      className={`text-xs ${
        monthOverMonth.direction === "up" ? "text-[var(--green-text)]" : "text-[var(--red-text)]"
      }`}
    >
      {monthOverMonth.direction === "up" ? "↑" : "↓"} {formatPercent(monthOverMonth.value)} vs last month
    </span>
  ) : (
    <span className="text-xs text-[var(--text-2)]">Waiting for month-over-month baseline</span>
  );

  const cardClassName = "rounded-xl border border-[var(--border)] bg-[var(--bg-1)] p-4";

  if (isPageBooting) {
    return <p className="text-sm text-[var(--text-2)]">Checking session...</p>;
  }

  if (!firebaseUser) {
    return null;
  }

  const renderInlineError = (message: string | null) =>
    message ? <p className="mb-3 text-sm text-[var(--red-text)]">{message}</p> : null;

  const renderOverview = () => (
    <div className="space-y-4">
      <section className="grid gap-3 lg:grid-cols-4">
        {isLoading ? (
          <>
            <LoadingSkeleton className="h-[118px]" />
            <LoadingSkeleton className="h-[118px]" />
            <LoadingSkeleton className="h-[118px]" />
            <LoadingSkeleton className="h-[118px]" />
          </>
        ) : errors.summary ? (
          <article className="rounded-xl border border-[var(--border)] bg-[var(--bg-1)] p-4 lg:col-span-4">
            {renderInlineError(errors.summary)}
            <p className="text-sm text-[var(--text-2)]">Summary metrics are temporarily unavailable.</p>
          </article>
        ) : (
          <>
            <MetricCard
              label="Total income"
              value={formatCurrency(summary.total_income)}
              subtext={`${summary.total_records} records total`}
              valueColor="green"
            />
            <MetricCard
              label="Total expenses"
              value={formatCurrency(summary.total_expenses)}
              subtext={`across ${categories.length} categories`}
              valueColor="red"
            />
            <MetricCard
              label="Net balance"
              value={formatCurrency(summary.net_balance)}
              subtext={`${formatPercent(incomeRatio)} income ratio`}
              valueColor="blue"
            />
            <MetricCard
              label="This month"
              value={formatCurrency(latestTrend?.net ?? 0)}
              subtext={thisMonthSubtext}
              valueColor="amber"
              footer={thisMonthFooter}
            />
          </>
        )}
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        {isLoading ? (
          <>
            <LoadingSkeleton className="h-[100px]" />
            <LoadingSkeleton className="h-[100px]" />
          </>
        ) : (
          <MetricCard
            label="Savings rate"
            value={formatPercent(savingsRate)}
            subtext="net_balance / total_income"
            valueColor={savingsColor}
          />
        )}
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        <article className={cardClassName}>
          <h2 className="mb-3 text-[13px] font-medium text-[var(--text-1)]">Monthly income vs expenses</h2>
          {renderInlineError(errors.trends)}
          {isLoading ? (
            <LoadingSkeleton className="h-[170px]" />
          ) : !hasTrendValues ? (
            hasAnyData ? (
              <p className="py-8 text-center text-sm text-[var(--text-2)]">No monthly trend data available.</p>
            ) : (
              <EmptyStateIllustration />
            )
          ) : (
            <>
              <BarChart data={trendBarData} mode="grouped" maxHeight={120} />
              <div className="mt-3 flex items-center gap-5 text-xs text-[var(--text-2)]">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[var(--green)]" />
                  Income
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[var(--red)]" />
                  Expenses
                </span>
              </div>
            </>
          )}
        </article>

        <article className={cardClassName}>
          <h2 className="mb-3 text-[13px] font-medium text-[var(--text-1)]">Expense breakdown</h2>
          {renderInlineError(errors.byCategory)}
          {isLoading ? (
            <LoadingSkeleton className="h-[170px]" />
          ) : expenseSegments.length === 0 ? (
            hasAnyData ? (
              <p className="py-8 text-center text-sm text-[var(--text-2)]">No expense category data yet.</p>
            ) : (
              <EmptyStateIllustration />
            )
          ) : (
            <DonutChart segments={expenseSegments} />
          )}
        </article>
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        <article className={cardClassName}>
          <h2 className="mb-3 text-[13px] font-medium text-[var(--text-1)]">Recent activity</h2>
          {renderInlineError(errors.recent)}
          {isLoading ? (
            <div className="space-y-2">
              <LoadingSkeleton className="h-10" />
              <LoadingSkeleton className="h-10" />
              <LoadingSkeleton className="h-10" />
            </div>
          ) : recent.length === 0 ? (
            hasAnyData ? (
              <p className="py-8 text-center text-sm text-[var(--text-2)]">No recent records yet.</p>
            ) : (
              <EmptyStateIllustration />
            )
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {recent.slice(0, 10).map((item) => {
                const amountColor =
                  item.type === "income" ? "text-[var(--green-text)]" : "text-[var(--red-text)]";
                return (
                  <li key={item.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm text-[var(--text-1)]">{item.category}</p>
                      <p className="text-xs text-[var(--text-2)]">{dateLabel(item.date)}</p>
                    </div>
                    <p className={`text-sm font-medium ${amountColor}`}>
                      {item.type === "income" ? "+" : "-"}
                      {formatCurrency(item.amount)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </article>

        <article className={cardClassName}>
          <h2 className="mb-3 text-[13px] font-medium text-[var(--text-1)]">Income sources</h2>
          {renderInlineError(errors.byCategory)}
          {isLoading ? (
            <div className="space-y-2">
              <LoadingSkeleton className="h-10" />
              <LoadingSkeleton className="h-10" />
              <LoadingSkeleton className="h-10" />
            </div>
          ) : incomeSources.length === 0 ? (
            hasAnyData ? (
              <p className="py-8 text-center text-sm text-[var(--text-2)]">No income source categories yet.</p>
            ) : (
              <EmptyStateIllustration />
            )
          ) : (
            <>
              <ul className="divide-y divide-[var(--border)]">
                {incomeSources.map((item) => (
                  <li key={item.category} className="flex items-center justify-between py-2.5">
                    <span className="inline-flex items-center gap-2 text-sm text-[var(--text-1)]">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: getCategoryColor(item.category) }}
                      />
                      {item.category}
                    </span>
                    <span className="text-sm font-medium text-[var(--green-text)]">
                      {formatCurrency(item.total_income)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2 text-xs text-[var(--text-2)]">
                {totalIncomeCategories} income categories · {formatCurrency(incomeGrandTotal)} grand total
              </div>
            </>
          )}
        </article>
      </section>

      <article className={`${cardClassName} border-dashed`}>
        <h2 className="mb-2 text-[13px] font-medium text-[var(--text-1)]">Largest transaction</h2>
        {errors.recent ? <p className="text-sm text-[var(--red-text)]">{errors.recent}</p> : null}
        {isLoading ? (
          <LoadingSkeleton className="h-12" />
        ) : largestTransaction ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-[var(--text-1)]">{largestTransaction.category}</span>
            <span className="text-[var(--text-2)]">·</span>
            <span className="font-medium text-[var(--blue-text)]">
              {formatCurrency(largestTransaction.amount)}
            </span>
            <span className="text-[var(--text-2)]">· {largestTransaction.date}</span>
            <span
              className={`rounded px-1.5 py-0.5 text-[11px] ${
                largestTransaction.type === "income"
                  ? "bg-[var(--green-dim)] text-[var(--green-text)]"
                  : "bg-[var(--red-dim)] text-[var(--red-text)]"
              }`}
            >
              {largestTransaction.type}
            </span>
          </div>
        ) : (
          <p className="text-sm text-[var(--text-2)]">No transactions available yet.</p>
        )}
      </article>
    </div>
  );

  const renderCategoryAnalysis = () => (
    <div className="space-y-4">
      <section className="grid gap-3 lg:grid-cols-3">
        <article className={cardClassName}>
          <p className="text-[11px] uppercase tracking-wide text-[var(--text-2)]">Top income category</p>
          {renderInlineError(errors.byCategory)}
          {isLoading ? (
            <LoadingSkeleton className="h-12" />
          ) : (
            <>
              <p className="mt-1 text-lg font-medium text-[var(--text-1)]">{topIncomeCategory?.category ?? "-"}</p>
              <p className="text-sm text-[var(--green-text)]">
                {topIncomeCategory
                  ? `${formatCurrency(topIncomeCategory.total_income)} · ${formatPercent(topIncomeShare)} of total income`
                  : "No income categories yet."}
              </p>
            </>
          )}
        </article>

        <article className={cardClassName}>
          <p className="text-[11px] uppercase tracking-wide text-[var(--text-2)]">Top expense category</p>
          {renderInlineError(errors.byCategory)}
          {isLoading ? (
            <LoadingSkeleton className="h-12" />
          ) : (
            <>
              <p className="mt-1 text-lg font-medium text-[var(--text-1)]">{topExpenseCategory?.category ?? "-"}</p>
              <p className="text-sm text-[var(--red-text)]">
                {topExpenseCategory
                  ? `${formatCurrency(topExpenseCategory.total_expenses)} · ${formatPercent(topExpenseShare)} of total expenses`
                  : "No expense categories yet."}
              </p>
            </>
          )}
        </article>

        <article className={cardClassName}>
          <p className="text-[11px] uppercase tracking-wide text-[var(--text-2)]">Category count</p>
          {isLoading ? (
            <LoadingSkeleton className="h-12" />
          ) : (
            <>
              <p className="mt-1 text-lg font-medium text-[var(--text-1)]">{categories.length}</p>
              <p className="text-sm text-[var(--text-2)]">
                {totalExpenseCategories} expense · {totalIncomeCategories} income
              </p>
            </>
          )}
        </article>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-[var(--text-1)]">Category-wise breakdown</h2>
        {renderInlineError(errors.byCategory)}
        {isLoading ? (
          <LoadingSkeleton className="h-[280px]" />
        ) : categories.length === 0 ? (
          hasAnyData ? (
            <div className={cardClassName}>
              <p className="py-8 text-center text-sm text-[var(--text-2)]">No category breakdown data yet.</p>
            </div>
          ) : (
            <div className={cardClassName}>
              <EmptyStateIllustration />
            </div>
          )
        ) : (
          <CategoryTable categories={categories} />
        )}
      </section>
    </div>
  );

  const renderTrends = () => (
    <div className="space-y-4">
      <article className={cardClassName}>
        <h2 className="mb-3 text-[13px] font-medium text-[var(--text-1)]">Net balance trend</h2>
        {renderInlineError(errors.trends)}
        {isLoading ? (
          <LoadingSkeleton className="h-[180px]" />
        ) : !hasTrendValues ? (
          hasAnyData ? (
            <p className="py-8 text-center text-sm text-[var(--text-2)]">No net trend data available.</p>
          ) : (
            <EmptyStateIllustration />
          )
        ) : (
          <BarChart
            data={netTrendData}
            mode="single"
            singleColor="var(--blue)"
            showValueLabels
            maxHeight={130}
          />
        )}
      </article>

      <article className={cardClassName}>
        <h2 className="mb-3 text-[13px] font-medium text-[var(--text-1)]">Monthly breakdown</h2>
        {renderInlineError(errors.trends)}
        {isLoading ? (
          <LoadingSkeleton className="h-[220px]" />
        ) : trends.length === 0 ? (
          hasAnyData ? (
            <p className="py-8 text-center text-sm text-[var(--text-2)]">No monthly breakdown available.</p>
          ) : (
            <EmptyStateIllustration />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wide text-[var(--text-2)]">
                  <th className="px-3 py-2">Month</th>
                  <th className="px-3 py-2">Income</th>
                  <th className="px-3 py-2">Expenses</th>
                  <th className="px-3 py-2">Net</th>
                </tr>
              </thead>
              <tbody>
                {trends.map((item, index) => {
                  const isMostRecent = index === trends.length - 1;
                  return (
                    <tr
                      key={item.month}
                      className={`border-b border-[var(--border)] text-sm ${isMostRecent ? "bg-[var(--bg-2)]" : ""}`}
                    >
                      <td className={`px-3 py-2 text-[var(--text-2)] ${isMostRecent ? "rounded-l-md" : ""}`}>
                        {item.month}
                      </td>
                      <td className="px-3 py-2 text-[var(--green-text)]">{formatCurrency(item.total_income)}</td>
                      <td className="px-3 py-2 text-[var(--red-text)]">{formatCurrency(item.total_expenses)}</td>
                      <td className={`px-3 py-2 text-[var(--blue-text)] ${isMostRecent ? "rounded-r-md" : ""}`}>
                        {formatCurrency(item.net)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </div>
  );

  return (
    <section className="space-y-4 text-[var(--text-1)]">
      <div className="flex items-center justify-between">
        <h1 className="text-[18px] font-medium text-[var(--text-1)]">Dashboard</h1>
        <button
          type="button"
          onClick={() => void loadDashboard()}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg-1)] px-3.5 py-1.5 text-sm text-[var(--text-2)]"
        >
          Refresh
        </button>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-3.5 py-2.5 text-sm text-[var(--text-2)]">
        <span className={`mr-1 rounded px-1.5 py-0.5 text-xs ${roleColor.bg} ${roleColor.text}`}>{role}</span>
        {ROLE_MESSAGE[role]}
      </div>

      <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--bg-2)] p-1">
        {TAB_ITEMS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                isActive
                  ? "border border-[var(--border)] bg-[var(--bg-3)] text-[var(--text-1)]"
                  : "border border-transparent bg-transparent text-[var(--text-2)]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "overview" ? renderOverview() : null}
      {activeTab === "category-analysis" ? renderCategoryAnalysis() : null}
      {activeTab === "trends" ? renderTrends() : null}
    </section>
  );
}
