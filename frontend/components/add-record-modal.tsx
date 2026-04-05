"use client";

import { FormEvent, useState } from "react";

import { createRecord } from "@/lib/api";
import { RecordItem, RecordType } from "@/lib/types";

interface AddRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (record: RecordItem) => void;
}

export default function AddRecordModal({
  isOpen,
  onClose,
  onCreated,
}: AddRecordModalProps) {
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<RecordType>("expense");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  const resetForm = () => {
    setAmount("");
    setType("expense");
    setCategory("");
    setDate("");
    setNotes("");
    setError(null);
  };

  const submitForm = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setError("Amount must be a valid non-negative number.");
      return;
    }

    if (!category.trim() || !date) {
      setError("Category and date are required.");
      return;
    }

    try {
      setSubmitting(true);
      const created = await createRecord({
        amount: parsedAmount,
        type,
        category: category.trim(),
        date,
        notes: notes.trim() || undefined,
      });

      onCreated(created);
      resetForm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create record");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Add Record</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-slate-600 hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        <form className="space-y-3" onSubmit={(event) => void submitForm(event)}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Amount</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Type</label>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as RecordType)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Category</label>
            <input
              type="text"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              rows={3}
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {submitting ? "Saving..." : "Save Record"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
