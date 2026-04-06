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
        const merged = new Set(previous);
        response.data.forEach((record) => merged.add(record.category));
        return Array.from(merged).sort((a, b) => a.localeCompare(b));
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load records.");
      setRecordsResponse(EMPTY_RESPONSE);
    } finally {
      setLoading(false);
    }
  }, [selectedType, selectedCategory, fromDate, toDate, page]);

  useEffect(() => {
    if (!authLoading && !firebaseUser) {
      router.replace("/login");
      return;
    }

    if (firebaseUser) {
      void loadRecords();
    }
  }, [authLoading, firebaseUser, router, loadRecords]);

  const showingStart = recordsResponse.total === 0 ? 0 : (page - 1) * PAGE_LIMIT + 1;
  const showingEnd =
    recordsResponse.total === 0 ? 0 : Math.min(page * PAGE_LIMIT, recordsResponse.total);

  const canGoPrevious = page > 1;
  const canGoNext = page * PAGE_LIMIT < recordsResponse.total;

  const emptyColSpan = canEdit ? 6 : 5;

  const visibleRows = useMemo(() => {
    return recordsResponse.data.map((record) => {
      const amountColor = record.type === "income" ? "text-[#0F6E56]" : "text-[#A32D2D]";

      return (
        <tr key={record.id} className="border-b border-gray-100 text-[13px] text-gray-700">
          <td className="px-5 py-2.5">{record.date.slice(0, 10)}</td>
          <td className="px-5 py-2.5">{record.category}</td>
          <td className="px-5 py-2.5">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_PILL_CLASS[record.type]}`}>
              {record.type}
            </span>
          </td>
          <td className={`px-5 py-2.5 font-medium ${amountColor}`}>{formatCurrency(record.amount)}</td>
          <td className="max-w-[280px] px-5 py-2.5 text-gray-500">{truncateNotes(record.notes)}</td>
          {canEdit ? (
            <td className="px-5 py-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingRecord(record);
                    setIsModalOpen(true);
                  }}
                  className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500"
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
                    className="rounded-md border border-gray-200 px-2 py-1 text-xs text-red-500"
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

  if (authLoading || (!firebaseUser && !error)) {
    return <p className="text-sm text-gray-400">Checking session...</p>;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[18px] font-medium text-gray-900">Records</h1>
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

      <div className="rounded-lg border border-gray-100 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-500">
        {ROLE_MESSAGE[role]} <span className={`rounded px-1.5 py-0.5 text-xs ${roleColor.bg} ${roleColor.text}`}>{role}</span>
      </div>

      {loading ? <p className="text-sm text-gray-400">Loading records...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <article className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-none">
        <div className="flex flex-wrap gap-2 border-b border-gray-100 px-5 py-3">
          <select
            value={selectedType}
            onChange={(event) => {
              setSelectedType(event.target.value as RecordType | "");
              setPage(1);
            }}
            className="rounded-md border border-gray-200 px-2.5 py-1.5 text-sm"
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
            className="rounded-md border border-gray-200 px-2.5 py-1.5 text-sm"
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
            className="rounded-md border border-gray-200 px-2.5 py-1.5 text-sm"
          />

          <input
            type="date"
            value={toDate}
            onChange={(event) => {
              setToDate(event.target.value);
              setPage(1);
            }}
            className="rounded-md border border-gray-200 px-2.5 py-1.5 text-sm"
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
            className="px-1 text-sm text-[#1D9E75]"
          >
            Clear filters
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-100 text-left text-[11px] font-medium uppercase tracking-wide text-gray-400">
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
                  <td colSpan={emptyColSpan} className="px-5 py-8 text-center text-[13px] text-gray-400">
                    No records found for current filters.
                  </td>
                </tr>
              ) : (
                visibleRows
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 text-sm text-gray-400">
          <p>
            Showing {showingStart}-{showingEnd} of {recordsResponse.total} records
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!canGoPrevious}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-500 disabled:cursor-not-allowed disabled:opacity-40"
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
