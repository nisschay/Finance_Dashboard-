"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import AddRecordModal from "@/components/AddRecordModal";
import { deleteRecord, getRecords } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { FinancialRecord, RecordType, RecordsResponse, UserRole } from "@/lib/types";

const PAGE_LIMIT = 20;

const EMPTY_RESPONSE: RecordsResponse = {
  data: [],
  total: 0,
  page: 1,
  limit: PAGE_LIMIT,
};

const ROLE_COLORS: Record<UserRole, { bg: string; text: string }> = {
  viewer: { bg: "bg-[#E1F5EE]", text: "text-[#085041]" },
  analyst: { bg: "bg-[#E6F1FB]", text: "text-[#0C447C]" },
  admin: { bg: "bg-[#FAEEDA]", text: "text-[#633806]" },
};

const ROLE_MESSAGE: Record<UserRole, string> = {
  viewer: "You can view records but cannot create or edit them.",
  analyst: "You can create and edit records but not delete them.",
  admin: "You can create, edit, and delete any record.",
};

const TYPE_PILL_CLASS: Record<RecordType, string> = {
  income: "bg-[#E1F5EE] text-[#085041]",
  expense: "bg-[#FCEBEB] text-[#791F1F]",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function truncateNotes(value?: string, maxLength = 40) {
  if (!value) {
    return "-";
  }

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}...`;
}

function normalizeCategoryLabel(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export default function RecordsPage() {
  const router = useRouter();
  const { firebaseUser, profile, loading: authLoading } = useAuth();

  const [recordsResponse, setRecordsResponse] = useState<RecordsResponse>(EMPTY_RESPONSE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedType, setSelectedType] = useState<RecordType | "">("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);

  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FinancialRecord | null>(null);

  const role = profile?.role ?? "viewer";
  const roleColor = ROLE_COLORS[role];
  const canCreate = role === "analyst" || role === "admin";
  const canEdit = role === "analyst" || role === "admin";
  const canDelete = role === "admin";

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getRecords({
        type: selectedType || undefined,
        category: selectedCategory || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        page,
        limit: PAGE_LIMIT,
      });

      setRecordsResponse(response);
      setCategoryOptions((previous) => {
        const merged = new Map<string, string>();

        previous.forEach((category) => {
          const normalized = normalizeCategoryLabel(category);
          merged.set(normalized.toLowerCase(), normalized);
        });

        response.data.forEach((record) => {
          const normalized = normalizeCategoryLabel(record.category);
          merged.set(normalized.toLowerCase(), normalized);
        });

        return Array.from(merged.values()).sort((a, b) => a.localeCompare(b));
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load records.");
      setRecordsResponse(EMPTY_RESPONSE);
    } finally {
      setLoading(false);
    }
  }, [selectedType, selectedCategory, fromDate, toDate, page]);

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

    void loadRecords();
  }, [authLoading, firebaseUser, profile, router, loadRecords]);

  const showingStart = recordsResponse.total === 0 ? 0 : (page - 1) * PAGE_LIMIT + 1;
  const showingEnd =
    recordsResponse.total === 0 ? 0 : Math.min(page * PAGE_LIMIT, recordsResponse.total);

  const canGoPrevious = page > 1;
  const canGoNext = page * PAGE_LIMIT < recordsResponse.total;

  const emptyColSpan = canEdit ? 6 : 5;
  const controlClassName =
    "rounded-md border border-[var(--border)] bg-[var(--bg-2)] px-2.5 py-1.5 text-sm text-[var(--text-1)] outline-none [color-scheme:dark] focus:border-[var(--green)] focus:shadow-[0_0_0_3px_rgba(29,158,117,0.2)]";

  const visibleRows = useMemo(() => {
    return recordsResponse.data.map((record) => {
      const amountColor =
        record.type === "income" ? "text-[var(--green-text)]" : "text-[var(--red-text)]";

      return (
        <tr key={record.id} className="border-b border-[var(--border)] text-[13px] text-[var(--text-1)]">
          <td className="px-5 py-2.5">{record.date.slice(0, 10)}</td>
          <td className="px-5 py-2.5">{record.category}</td>
          <td className="px-5 py-2.5">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_PILL_CLASS[record.type]}`}>
              {record.type}
            </span>
          </td>
          <td className={`px-5 py-2.5 font-medium ${amountColor}`}>{formatCurrency(record.amount)}</td>
          <td className="max-w-[280px] px-5 py-2.5 text-[var(--text-2)]">{truncateNotes(record.notes)}</td>
          {canEdit ? (
            <td className="px-5 py-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingRecord(record);
                    setIsModalOpen(true);
                  }}
                  className="rounded-md border border-[var(--border)] bg-[var(--bg-2)] px-2 py-1 text-xs text-[var(--text-2)]"
                >
                  Edit
                </button>
                {canDelete ? (
                  <button
                    type="button"
                    onClick={() => {
                      const confirmed = window.confirm("Delete this record?");
                      if (!confirmed) {
                        return;
                      }

                      void (async () => {
                        try {
                          await deleteRecord(record.id);
                          await loadRecords();
                        } catch (err) {
                          setError(
                            err instanceof Error ? err.message : "Failed to delete the selected record.",
                          );
                        }
                      })();
                    }}
                    className="rounded-md border border-[var(--border)] bg-[var(--bg-2)] px-2 py-1 text-xs text-[var(--red-text)]"
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </td>
          ) : null}
        </tr>
      );
    });
  }, [recordsResponse.data, canEdit, canDelete, loadRecords]);

  if (authLoading || (firebaseUser && !profile && !error) || (!firebaseUser && !error)) {
    return <p className="text-sm text-[var(--text-2)]">Checking session...</p>;
  }

  return (
    <section className="space-y-4 text-[var(--text-1)]">
      <div className="flex items-center justify-between">
        <h1 className="text-[18px] font-medium text-[var(--text-1)]">Records</h1>
        <button
          type="button"
          disabled={!canCreate}
          onClick={() => {
            setEditingRecord(null);
            setIsModalOpen(true);
          }}
          className="rounded-lg bg-[#1D9E75] px-3.5 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Add record
        </button>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-3.5 py-2.5 text-sm text-[var(--text-2)]">
        {ROLE_MESSAGE[role]} <span className={`rounded px-1.5 py-0.5 text-xs ${roleColor.bg} ${roleColor.text}`}>{role}</span>
      </div>

      {loading ? <p className="text-sm text-[var(--text-2)]">Loading records...</p> : null}
      {error ? <p className="text-sm text-[var(--red-text)]">{error}</p> : null}

      <article className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-1)] shadow-none">
        <div className="flex flex-wrap gap-2 border-b border-[var(--border)] px-5 py-3">
          <select
            value={selectedType}
            onChange={(event) => {
              setSelectedType(event.target.value as RecordType | "");
              setPage(1);
            }}
            className={controlClassName}
          >
            <option value="">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>

          <select
            value={selectedCategory}
            onChange={(event) => {
              setSelectedCategory(event.target.value);
              setPage(1);
            }}
            className={controlClassName}
          >
            <option value="">All categories</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={fromDate}
            onChange={(event) => {
              setFromDate(event.target.value);
              setPage(1);
            }}
            className={controlClassName}
          />

          <input
            type="date"
            value={toDate}
            onChange={(event) => {
              setToDate(event.target.value);
              setPage(1);
            }}
            className={controlClassName}
          />

          <button
            type="button"
            onClick={() => {
              setSelectedType("");
              setSelectedCategory("");
              setFromDate("");
              setToDate("");
              setPage(1);
            }}
            className="px-1 text-sm text-[var(--green-text)]"
          >
            Clear filters
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[11px] font-medium uppercase tracking-wide text-[var(--text-2)]">
                <th className="px-5 py-2.5">Date</th>
                <th className="px-5 py-2.5">Category</th>
                <th className="px-5 py-2.5">Type</th>
                <th className="px-5 py-2.5">Amount</th>
                <th className="px-5 py-2.5">Notes</th>
                {canEdit ? <th className="px-5 py-2.5">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {recordsResponse.data.length === 0 ? (
                <tr>
                  <td colSpan={emptyColSpan} className="px-5 py-8 text-center text-[13px] text-[var(--text-2)]">
                    No records found for current filters.
                  </td>
                </tr>
              ) : (
                visibleRows
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-3 text-sm text-[var(--text-2)]">
          <p>
            Showing {showingStart}-{showingEnd} of {recordsResponse.total} records
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!canGoPrevious}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-3 py-1.5 text-sm text-[var(--text-2)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-3 py-1.5 text-sm text-[var(--text-2)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </article>

      <AddRecordModal
        isOpen={isModalOpen}
        mode={editingRecord ? "edit" : "create"}
        userRole={role}
        initialRecord={editingRecord}
        onClose={() => {
          setIsModalOpen(false);
          setEditingRecord(null);
        }}
        onSaved={() => {
          setIsModalOpen(false);
          setEditingRecord(null);
          void loadRecords();
        }}
      />
    </section>
  );
}
