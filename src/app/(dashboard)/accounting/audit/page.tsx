"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, Plus, Edit2, Trash2, RotateCcw, Download, User } from "lucide-react";
import {
  accountingApi,
  AccountingAuditEntry,
  AccountingAuditAction,
} from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import { DateRangeBar, useDateRange } from "../_shared";

const PAGE_SIZE = 30;

const ACTION_ICON: Record<AccountingAuditAction, typeof Plus> = {
  EXPENSE_CREATED: Plus,
  EXPENSE_UPDATED: Edit2,
  EXPENSE_DELETED: Trash2,
  EXPENSE_RESTORED: RotateCcw,
  REPORT_EXPORTED: Download,
};

const ACTION_TONE: Record<AccountingAuditAction, string> = {
  EXPENSE_CREATED: "text-emerald-400",
  EXPENSE_UPDATED: "text-amber-400",
  EXPENSE_DELETED: "text-rose-400",
  EXPENSE_RESTORED: "text-emerald-400",
  REPORT_EXPORTED: "text-primary-300",
};

const ACTION_LABEL: Record<AccountingAuditAction, string> = {
  EXPENSE_CREATED: "Expense created",
  EXPENSE_UPDATED: "Expense updated",
  EXPENSE_DELETED: "Expense deleted",
  EXPENSE_RESTORED: "Expense restored",
  REPORT_EXPORTED: "Report exported",
};

const ACTION_OPTIONS: AccountingAuditAction[] = [
  "EXPENSE_CREATED",
  "EXPENSE_UPDATED",
  "EXPENSE_DELETED",
  "EXPENSE_RESTORED",
  "REPORT_EXPORTED",
];

export default function AuditLogPage() {
  const toast = useToast();
  const { preset, range, set } = useDateRange("30d");
  const [actionFilter, setActionFilter] = useState<AccountingAuditAction | "">("");
  const [items, setItems] = useState<AccountingAuditEntry[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (p = 1) => {
      setLoading(true);
      try {
        const res = await accountingApi.listAudit({
          page: p,
          limit: PAGE_SIZE,
          from: range.from,
          to: range.to,
          action: actionFilter || undefined,
        });
        setItems(res.data.items);
        setPage(res.data.page);
        setPages(res.data.pages);
        setTotal(res.data.total);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not load audit log");
      } finally {
        setLoading(false);
      }
    },
    [range, actionFilter, toast],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  return (
    <div className="space-y-5 animate-fade-in">
      <DateRangeBar preset={preset} range={range} onChange={set} />

      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={actionFilter}
          onChange={(e) =>
            setActionFilter((e.target.value as AccountingAuditAction) || "")
          }
          className="admin-select w-56"
        >
          <option value="">All actions</option>
          {ACTION_OPTIONS.map((a) => (
            <option key={a} value={a}>
              {ACTION_LABEL[a]}
            </option>
          ))}
        </select>
        {actionFilter && (
          <button
            onClick={() => setActionFilter("")}
            className="text-xs text-ink-400 hover:text-ink-200 underline"
          >
            Clear
          </button>
        )}
        <span className="text-xs text-ink-500 ml-auto">
          {total} entries
        </span>
      </div>

      <div className="bg-ink-900 border border-ink-700 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-ink-800">
          <h3 className="text-sm font-semibold text-ink-100 inline-flex items-center gap-2">
            <ShieldCheck size={14} className="text-[#C9A96E]" /> Append-only
            audit trail
          </h3>
          <p className="text-[11px] text-ink-500 mt-0.5">
            Every mutating accounting action is written here. Append-only —
            rows are never edited or deleted.
          </p>
        </div>

        {loading ? (
          <p className="p-12 text-center text-sm text-ink-400">Loading…</p>
        ) : items.length === 0 ? (
          <p className="p-12 text-center text-sm text-ink-400">
            No audit entries in this window.
          </p>
        ) : (
          <ol className="divide-y divide-ink-800">
            {items.map((row) => {
              const Icon = ACTION_ICON[row.action];
              return (
                <li
                  key={row.id}
                  className="px-4 py-3 flex gap-3 hover:bg-ink-800/40 transition-colors"
                >
                  <div
                    className={`w-7 h-7 shrink-0 rounded-full bg-ink-800 flex items-center justify-center ${ACTION_TONE[row.action]}`}
                  >
                    <Icon size={13} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="text-sm text-ink-100 font-medium">
                        {ACTION_LABEL[row.action]}
                      </div>
                      <div className="text-[11px] text-ink-500 whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleString("en-NG", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </div>
                    </div>
                    <div className="text-[11px] text-ink-400 mt-0.5 inline-flex items-center gap-1">
                      <User size={10} />
                      {row.actorLabel}
                      {row.entityType ? (
                        <span className="text-ink-600">
                          · {row.entityType}
                          {row.entityId
                            ? ` #${row.entityId.slice(-6)}`
                            : ""}
                        </span>
                      ) : null}
                    </div>
                    {row.payload ? (
                      <pre className="mt-1.5 text-[10.5px] text-ink-400 bg-ink-950 border border-ink-800 rounded px-2 py-1.5 overflow-x-auto whitespace-pre-wrap break-words">
                        {JSON.stringify(row.payload, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
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
    </div>
  );
}
