"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import AddRecordModal from "@/components/add-record-modal";
import { getDashboardByCategory, getRecords } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { RecordItem, RecordType } from "@/lib/types";

function asCurrency(value: string | number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export default function RecordsPage() {
  const router = useRouter();
  const { firebaseUser, profile, loading: authLoading } = useAuth();
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [selectedType, setSelectedType] = useState<RecordType | "">("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);

  const canCreate = profile?.role === "analyst" || profile?.role === "admin";

  const loadRecords = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getRecords({
        type: selectedType || undefined,
        category: selectedCategory || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        page: 1,
        limit: 20,
      });

      setRecords(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load records");
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
      void loadRecords();
    }
  }, [authLoading, firebaseUser, router]);

  useEffect(() => {
    if (firebaseUser) {
      void loadRecords();
    }
  }, [selectedType, selectedCategory, fromDate, toDate]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const categories = await getDashboardByCategory();
        setCategoryOptions(categories.map((item) => item.category));
      } catch {
        setCategoryOptions([]);
      }
    };

    if (firebaseUser) {
      void loadCategories();
    }
  }, [firebaseUser]);

  const tableRows = useMemo(() => {
    return records.map((record) => (
      <tr key={record.id} className="border-t border-slate-100 text-sm">
        <td className="px-3 py-2">{record.date}</td>
        <td className="px-3 py-2">{record.category}</td>
        <td className="px-3 py-2">
          <span
            className={record.type === "income" ? "text-emerald-700" : "text-rose-700"}
          >
            {record.type}
          </span>
        </td>
        <td className="px-3 py-2">{asCurrency(record.amount)}</td>
        <td className="px-3 py-2 text-slate-600">{record.notes || "-"}</td>
      </tr>
    ));
  }, [records]);

  if (authLoading || (!firebaseUser && !error)) {
    return <p className="text-sm text-slate-600">Checking session...</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Records</h1>
        <button
          type="button"
          disabled={!canCreate}
          onClick={() => setIsModalOpen(true)}
          className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Add Record
        </button>
      </div>

      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-5">
        <select
          value={selectedType}
          onChange={(event) => setSelectedType(event.target.value as RecordType | "")}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All Types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>

        <select
          value={selectedCategory}
          onChange={(event) => setSelectedCategory(event.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All Categories</option>
          {categoryOptions.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={fromDate}
          onChange={(event) => setFromDate(event.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />

        <input
          type="date"
          value={toDate}
          onChange={(event) => setToDate(event.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />

        <button
          type="button"
          onClick={() => {
            setSelectedType("");
            setSelectedCategory("");
            setFromDate("");
            setToDate("");
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Clear Filters
        </button>
      </section>

      {loading ? <p className="text-sm text-slate-600">Loading records...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!canCreate ? (
        <p className="text-sm text-amber-700">
          Your role can view records but cannot create new ones.
        </p>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">
                  No records found for current filters.
                </td>
              </tr>
            ) : (
              tableRows
            )}
          </tbody>
        </table>
      </div>

      <AddRecordModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={(record) => {
          setRecords((prev) => [record, ...prev]);
        }}
      />
    </div>
  );
}
