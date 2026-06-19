"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileBarChart2 } from "lucide-react";
import {
  accountingApi,
  EXPENSE_CATEGORY_LABEL,
  PnlSnapshot,
} from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import { DateRangeBar, ngnFromKobo, useDateRange } from "../_shared";

/**
 * Custom P&L statement. The numbers come straight from the same
 * server function the dashboard uses — no client-side recomputation, so
 * there's only ever one definition of net profit.
 *
 * Export emits a CSV of the P&L sections + an audit-log entry.
 */
export default function ReportsPage() {
  const toast = useToast();
  const { preset, range, set } = useDateRange("mtd");
  const [data, setData] = useState<PnlSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await accountingApi.pnl(range);
      setData(res.data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load report");
    } finally {
      setLoading(false);
    }
  }, [range, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function exportCsv() {
    if (!data) return;
    setExporting(true);
    try {
      // Server-side audit log + same payload back.
      await accountingApi.exportPnl(range);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Server export audit failed",
      );
      setExporting(false);
      return;
    }
    try {
      const rows: string[][] = [
        ["Profit & Loss"],
        ["Window", `${data.range.from} to ${data.range.to}`],
        [],
        ["Section", "Item", "Value (NGN)"],
        ["Revenue", "Recognised revenue", toNaira(data.revenueNgn)],
        [
          "Gross profit",
          `Profit (cost coverage ${data.grossProfit.itemsCosted}/${data.grossProfit.itemsTotal})`,
          toNaira(data.grossProfit.profitNgn),
        ],
        [
          "Refunds",
          `${data.refunds.requestsCount} refunds · ${data.refunds.itemsCount} items`,
          `-${toNaira(data.refunds.amountNgn)}`,
        ],
        [
          "Agent commissions",
          `${data.commissions.ordersCount} referred orders`,
          `-${toNaira(data.commissions.amountNgn)}`,
        ],
        ...data.expenses.byCategory.map((b) => [
          "Expenses",
          `${EXPENSE_CATEGORY_LABEL[b.category]} (${b.count} entries)`,
          `-${toNaira(b.amountNgn)}`,
        ]),
        [
          "Expenses",
          `Total (${data.expenses.count} entries)`,
          `-${toNaira(data.expenses.amountNgn)}`,
        ],
        ["", "Net profit", toNaira(data.netProfitNgn)],
        [],
        [
          "Memo: payouts disbursed",
          `${data.payoutsDisbursed.payoutsCount} payouts`,
          toNaira(data.payoutsDisbursed.amountNgn),
        ],
      ];
      const csv = rows
        .map((r) => r.map(csvCell).join(","))
        .join("\r\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `martinonoir-pnl-${data.range.from.slice(0, 10)}-to-${data.range.to.slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Report exported.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <DateRangeBar
        preset={preset}
        range={range}
        onChange={set}
        right={
          <button
            onClick={exportCsv}
            disabled={!data || exporting}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-ink-800 hover:bg-ink-700 text-ink-100 text-sm rounded-lg border border-ink-700 disabled:opacity-40"
          >
            <Download size={13} />
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        }
      />

      <div className="bg-ink-900 border border-ink-700 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-ink-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-ink-100 inline-flex items-center gap-2">
              <FileBarChart2 size={14} /> Profit &amp; Loss
            </h3>
            {data ? (
              <p className="text-[11px] text-ink-500 mt-0.5 font-mono">
                {data.range.from.slice(0, 10)} → {data.range.to.slice(0, 10)}
              </p>
            ) : null}
          </div>
        </div>
        {loading || !data ? (
          <p className="p-12 text-center text-sm text-ink-400">Loading…</p>
        ) : (
          <div className="px-5 py-4 space-y-1.5 max-w-2xl">
            <PnlRow label="Recognised revenue" value={data.revenueNgn} />
            <PnlRow
              label={`Gross profit · ${data.grossProfit.itemsCosted}/${data.grossProfit.itemsTotal} items with cost`}
              value={data.grossProfit.profitNgn}
              tone="good"
            />
            <Spacer />
            <PnlRow
              label={`Refunds · ${data.refunds.requestsCount} refunds, ${data.refunds.itemsCount} items`}
              value={-data.refunds.amountNgn}
              tone="bad"
            />
            <PnlRow
              label={`Agent commissions · ${data.commissions.ordersCount} orders`}
              value={-data.commissions.amountNgn}
              tone="bad"
            />
            <Spacer />
            <div className="text-[10px] uppercase tracking-wider text-ink-500 pt-2">
              Expenses
            </div>
            {data.expenses.byCategory.length === 0 ? (
              <p className="text-xs text-ink-500 italic">
                No expenses recorded in this window.
              </p>
            ) : (
              data.expenses.byCategory.map((b) => (
                <PnlRow
                  key={b.category}
                  label={`${EXPENSE_CATEGORY_LABEL[b.category]} · ${b.count}`}
                  value={-b.amountNgn}
                  tone="bad"
                  muted
                />
              ))
            )}
            <PnlRow
              label={`Expenses total · ${data.expenses.count} entries`}
              value={-data.expenses.amountNgn}
              tone="bad"
            />
            <Spacer />
            <PnlRow
              label="Net profit"
              value={data.netProfitNgn}
              tone={data.netProfitNgn >= 0 ? "good" : "bad"}
              headline
            />
            <Spacer />
            <div className="text-[10px] uppercase tracking-wider text-ink-500 pt-3">
              Memo
            </div>
            <PnlRow
              label={`Agent payouts disbursed · ${data.payoutsDisbursed.payoutsCount}`}
              value={data.payoutsDisbursed.amountNgn}
              muted
            />
          </div>
        )}
      </div>
    </div>
  );
}

function PnlRow({
  label,
  value,
  tone,
  headline,
  muted,
}: {
  label: string;
  value: number;
  tone?: "good" | "bad";
  headline?: boolean;
  muted?: boolean;
}) {
  const color =
    tone === "good"
      ? "text-emerald-400"
      : tone === "bad"
        ? "text-rose-400"
        : muted
          ? "text-ink-500"
          : "text-ink-100";
  const labelColor = muted ? "text-ink-500" : "text-ink-300";
  return (
    <div
      className={`flex items-center justify-between gap-4 py-${headline ? "3" : "1.5"} ${
        headline
          ? "border-t border-ink-700 pt-3"
          : ""
      }`}
    >
      <div
        className={`text-sm ${labelColor} ${
          headline ? "font-semibold text-ink-100" : ""
        }`}
      >
        {label}
      </div>
      <div
        className={`font-mono ${headline ? "text-xl font-bold" : "text-sm"} ${color}`}
      >
        {ngnFromKobo(value)}
      </div>
    </div>
  );
}

function Spacer() {
  return <div className="h-1" />;
}

function toNaira(kobo: number): string {
  return (kobo / 100).toFixed(2);
}

function csvCell(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
