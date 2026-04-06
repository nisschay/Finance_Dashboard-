"use client";

import { useEffect, useMemo, useState } from "react";

import { createRecord, updateRecord } from "@/lib/api";
import { FinancialRecord, RecordType, UserRole } from "@/lib/types";

interface AddRecordModalProps {
  isOpen: boolean;
  mode: "create" | "edit";
  userRole: UserRole | null;
  initialRecord?: FinancialRecord | null;
  onClose: () => void;
  onSaved: (record: FinancialRecord) => void;
}

interface RecordDraft {
  amount: string;
  type: RecordType | "";
  category: string;
  date: string;
  notes: string;
}

const EMPTY_DRAFT: RecordDraft = {
  amount: "",
  type: "",
  category: "",
  date: "",
  notes: "",
};

function toDraft(record: FinancialRecord | null | undefined): RecordDraft {
  if (!record) {
    return EMPTY_DRAFT;
  }

  return {
    amount: String(record.amount),
    type: record.type,
    category: record.category,
    date: record.date.slice(0, 10),
    notes: record.notes ?? "",
  };
}

export default function AddRecordModal({
  isOpen,
  mode,
  userRole,
  initialRecord,
  onClose,
  onSaved,
}: AddRecordModalProps) {
  const [draft, setDraft] = useState<RecordDraft>(EMPTY_DRAFT);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManageRecords = userRole === "analyst" || userRole === "admin";
  const inputClassName =
    "w-full rounded-md border border-[var(--border)] bg-[var(--bg-2)] px-2.5 py-1.5 text-sm text-[var(--text-1)] outline-none [color-scheme:dark] placeholder:text-[var(--text-3)] focus:border-[var(--green)] focus:shadow-[0_0_0_3px_rgba(29,158,117,0.2)]";

  useEffect(() => {
    if (!isOpen) {
      setDraft(EMPTY_DRAFT);
      setError(null);
      return;
    }

    setDraft(mode === "edit" ? toDraft(initialRecord) : EMPTY_DRAFT);
    setError(null);
  }, [isOpen, mode, initialRecord]);

  const title = useMemo(() => {
    return mode === "edit" ? "Edit record" : "Add record";
  }, [mode]);

  if (!isOpen || !canManageRecords) {
    return null;
  }

  const updateDraft = (patch: Partial<RecordDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const handleSave = async () => {
    const amount = Number(draft.amount);

    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !draft.type ||
      !draft.category.trim() ||
      !draft.date
    ) {
      setError("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        amount,
        type: draft.type,
        category: draft.category.trim(),
        date: draft.date,
        notes: draft.notes.trim() || undefined,
      };

      const saved =
        mode === "edit" && initialRecord
          ? await updateRecord(initialRecord.id, payload)
          : await createRecord(payload);

      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save record.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-1)] p-6">
        <h2 className="text-[18px] font-medium text-[var(--text-1)]">{title}</h2>

        <div className="mt-5 space-y-3.5">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[var(--text-2)]">Amount</label>
            <input
              type="number"
              placeholder="0.00"
              value={draft.amount}
              onChange={(event) => updateDraft({ amount: event.target.value })}
              className={inputClassName}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[var(--text-2)]">Type</label>
            <select
              value={draft.type}
              onChange={(event) => updateDraft({ type: event.target.value as RecordType | "" })}
              className={inputClassName}
            >
              <option value="">Select type</option>
              <option value="income">income</option>
              <option value="expense">expense</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[var(--text-2)]">Category</label>
            <input
              type="text"
              autoComplete="off"
              placeholder="e.g. Salary, Food, Housing"
              value={draft.category}
              onChange={(event) => updateDraft({ category: event.target.value })}
              className={inputClassName}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[var(--text-2)]">Date</label>
            <input
              type="date"
              value={draft.date}
              onChange={(event) => updateDraft({ date: event.target.value })}
              className={inputClassName}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[var(--text-2)]">Notes</label>
            <textarea
              rows={3}
              placeholder="Optional note"
              value={draft.notes}
              onChange={(event) => updateDraft({ notes: event.target.value })}
              className={inputClassName}
            />
          </div>

          {error ? <p className="text-sm text-[var(--red-text)]">{error}</p> : null}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-3.5 py-1.5 text-sm text-[var(--text-2)]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleSave()}
            className="rounded-lg bg-[#1D9E75] px-3.5 py-1.5 text-sm text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Saving..." : "Save record"}
          </button>
        </div>
      </div>
    </div>
  );
}
