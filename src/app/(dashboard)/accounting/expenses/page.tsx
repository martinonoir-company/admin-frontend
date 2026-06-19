"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Receipt,
  Filter,
  RotateCcw,
} from "lucide-react";
import {
  accountingApi,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
  ExpenseCategory,
  ExpenseView,
} from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import { useAuth } from "@/lib/auth-context";
import { Modal } from "@/components/Modal";
import { DateRangeBar, ngnFromKobo, useDateRange } from "../_shared";

const PAGE_SIZE = 20;

export default function ExpensesPage() {
  const toast = useToast();
  const { user } = useAuth();
  const canManage =
    user?.role === "SUPER_ADMIN" || user?.role === "COMPANY_SUPER_ADMIN";

  const { preset, range, set } = useDateRange("30d");
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | "">("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);

  const [items, setItems] = useState<ExpenseView[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseView | null>(null);

  const load = useCallback(
    async (p = 1) => {
      setLoading(true);
      try {
        const res = await accountingApi.listExpenses({
          page: p,
          limit: PAGE_SIZE,
          from: range.from,
          to: range.to,
          category: categoryFilter || undefined,
          search: search || undefined,
          includeDeleted,
        });
        setItems(res.data.items);
        setPage(res.data.page);
        setPages(res.data.pages);
        setTotal(res.data.total);
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not load expenses",
        );
      } finally {
        setLoading(false);
      }
    },
    [range, categoryFilter, search, includeDeleted, toast],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  async function handleDelete(row: ExpenseView) {
    if (!confirm(`Delete "${row.title}"? It will be soft-deleted (retained in the audit trail).`))
      return;
    try {
      await accountingApi.deleteExpense(row.id);
      toast.success("Expense deleted.");
      void load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function handleRestore(row: ExpenseView) {
    try {
      await accountingApi.restoreExpense(row.id);
      toast.success("Expense restored.");
      void load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Restore failed");
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <DateRangeBar
        preset={preset}
        range={range}
        onChange={set}
        right={
          canManage ? (
            <button
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#C9A96E] hover:bg-[#b89859] text-ink-950 text-sm font-semibold rounded-lg"
            >
              <Plus size={14} />
              New expense
            </button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search
            size={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-500"
          />
          <input
            type="text"
            placeholder="Title, vendor, ref"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput.trim())}
            className="pl-8 pr-3 py-1.5 bg-ink-900 border border-ink-700 rounded-lg text-sm text-white caret-white placeholder:text-ink-500 w-60"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) =>
            setCategoryFilter((e.target.value as ExpenseCategory) || "")
          }
          className="admin-select w-48"
        >
          <option value="">All categories</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {EXPENSE_CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-1.5 text-xs text-ink-400 px-2">
          <input
            type="checkbox"
            checked={includeDeleted}
            onChange={(e) => setIncludeDeleted(e.target.checked)}
            className="accent-[#C9A96E]"
          />
          Include deleted
        </label>
        {(search || categoryFilter || includeDeleted) && (
          <button
            onClick={() => {
              setSearch("");
              setSearchInput("");
              setCategoryFilter("");
              setIncludeDeleted(false);
            }}
            className="text-xs text-ink-400 hover:text-ink-200 underline"
          >
            <Filter size={11} className="inline mr-1" /> Clear filters
          </button>
        )}
        <span className="text-xs text-ink-500 ml-auto">{total} entries</span>
      </div>

      <div className="bg-ink-900 border border-ink-700 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-ink-400">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-sm text-ink-400">
            <Receipt size={28} className="mx-auto mb-2 text-ink-600" />
            No expenses in this window.
            {canManage && (
              <p className="mt-1 text-xs">
                Click <strong className="text-[#C9A96E]">New expense</strong> to record one.
              </p>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-ink-950 border-b border-ink-700">
              <tr className="text-left text-[11px] text-ink-400 uppercase tracking-wider">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Vendor / Ref</th>
                <th className="px-4 py-3">Incurred</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const isDeleted = !!row.deletedAt;
                return (
                  <tr
                    key={row.id}
                    className={`border-b border-ink-800 last:border-0 hover:bg-ink-800/40 transition-colors ${
                      isDeleted ? "opacity-50" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink-100">
                        {row.title}
                      </div>
                      {row.notes ? (
                        <div className="text-[11px] text-ink-500 truncate max-w-xs">
                          {row.notes}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-ink-800 text-ink-300">
                        {EXPENSE_CATEGORY_LABEL[row.category]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-400">
                      {row.vendor ?? "—"}
                      {row.referenceNumber ? (
                        <div className="font-mono text-[10px] text-ink-500">
                          {row.referenceNumber}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-400 whitespace-nowrap">
                      {new Date(row.incurredAt).toLocaleDateString("en-NG", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-ink-100">
                      {ngnFromKobo(row.amountMinor)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canManage && !isDeleted && (
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => setEditing(row)}
                            className="p-1.5 rounded text-ink-400 hover:text-ink-100 hover:bg-ink-800"
                            aria-label="Edit"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(row)}
                            className="p-1.5 rounded text-ink-400 hover:text-rose-400 hover:bg-ink-800"
                            aria-label="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                      {canManage && isDeleted && (
                        <button
                          onClick={() => handleRestore(row)}
                          className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:underline"
                        >
                          <RotateCcw size={11} /> Restore
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => load(page - 1)}
            disabled={page <= 1 || loading}
            className="px-3 py-1.5 bg-ink-900 border border-ink-700 rounded text-xs text-ink-300 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-ink-400">
            Page {page} of {pages}
          </span>
          <button
            onClick={() => load(page + 1)}
            disabled={page >= pages || loading}
            className="px-3 py-1.5 bg-ink-900 border border-ink-700 rounded text-xs text-ink-300 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {(createOpen || editing) && (
        <ExpenseFormModal
          existing={editing}
          onClose={() => {
            setCreateOpen(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreateOpen(false);
            setEditing(null);
            void load(page);
          }}
        />
      )}
    </div>
  );
}

// ── Create / edit ──

function ExpenseFormModal({
  existing,
  onClose,
  onSaved,
}: {
  existing: ExpenseView | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [title, setTitle] = useState(existing?.title ?? "");
  const [category, setCategory] = useState<ExpenseCategory>(
    existing?.category ?? "OPERATIONS",
  );
  const [amount, setAmount] = useState(
    existing ? (existing.amountMinor / 100).toString() : "",
  );
  const [incurredAt, setIncurredAt] = useState(
    existing
      ? existing.incurredAt.slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [vendor, setVendor] = useState(existing?.vendor ?? "");
  const [refNo, setRefNo] = useState(existing?.referenceNumber ?? "");
  const [saving, setSaving] = useState(false);

  async function submit() {
    const t = title.trim();
    if (!t) {
      toast.error("Title is required.");
      return;
    }
    const naira = parseFloat(amount);
    if (!Number.isFinite(naira) || naira <= 0) {
      toast.error("Amount must be a positive number of naira.");
      return;
    }
    const amountMinor = Math.round(naira * 100);
    setSaving(true);
    try {
      if (existing) {
        await accountingApi.updateExpense(existing.id, {
          title: t,
          category,
          amountMinor,
          incurredAt,
          notes: notes.trim() || null,
          vendor: vendor.trim() || null,
          referenceNumber: refNo.trim() || null,
        });
        toast.success("Expense updated.");
      } else {
        await accountingApi.createExpense({
          title: t,
          category,
          amountMinor,
          incurredAt,
          notes: notes.trim() || undefined,
          vendor: vendor.trim() || undefined,
          referenceNumber: refNo.trim() || undefined,
        });
        toast.success("Expense recorded.");
      }
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={existing ? "Edit expense" : "Record an expense"}
      size="lg"
    >
      <div className="space-y-3">
        <Field label="Title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Diesel — November"
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className={inputClass}
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {EXPENSE_CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Amount (₦)">
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className={`${inputClass} font-mono`}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Incurred on">
            <input
              type="date"
              value={incurredAt}
              onChange={(e) => setIncurredAt(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Vendor (optional)">
            <input
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="e.g. AT&T Logistics"
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Receipt / invoice number (optional)">
          <input
            value={refNo}
            onChange={(e) => setRefNo(e.target.value)}
            placeholder="e.g. INV-2026-031"
            className={inputClass}
          />
        </Field>

        <Field label="Notes (optional)">
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${inputClass} resize-none`}
          />
        </Field>
      </div>

      <div className="flex justify-end gap-2 mt-5">
        <button
          onClick={onClose}
          className="px-3 py-1.5 bg-ink-800 hover:bg-ink-700 text-ink-200 text-sm rounded"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={saving}
          className="px-4 py-1.5 bg-[#C9A96E] hover:bg-[#b89859] text-ink-950 text-sm font-semibold rounded disabled:opacity-40"
        >
          {saving ? "Saving…" : existing ? "Save changes" : "Record expense"}
        </button>
      </div>
    </Modal>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[11px] text-ink-400 mb-1 uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full px-3 py-2 bg-ink-950 border border-ink-700 rounded text-sm text-white caret-white placeholder:text-ink-500 focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40 focus:border-[#C9A96E]";
