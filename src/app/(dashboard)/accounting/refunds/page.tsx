"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Undo2 } from "lucide-react";
import {
  accountingApi,
  refundsApi,
  AccountingDashboard,
  RefundRequestView,
  RefundStatus,
} from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import { DateRangeBar, ngnFromKobo, useDateRange } from "../_shared";

/**
 * Accounting view of refunds: stats, then a list filtered to settled
 * states (the ones that hit the books). The dedicated /refunds page
 * stays the place where approvals happen — this view is read-only and
 * shows the line items in the selected window.
 */
const SETTLED_STATUSES: RefundStatus[] = ["SUCCEEDED", "COMPLETED_BY_STAFF"];

const STATUS_LABEL: Record<RefundStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  PROCESSING: "Processing",
  SUCCEEDED: "Succeeded",
  FAILED: "Failed",
  REJECTED: "Rejected",
  COMPLETED_BY_STAFF: "Cash (till)",
};

const STATUS_STYLE: Record<RefundStatus, string> = {
  PENDING: "bg-warning/15 text-warning",
  APPROVED: "bg-primary-700/20 text-primary-300",
  PROCESSING: "bg-primary-700/20 text-primary-300",
  SUCCEEDED: "bg-success/15 text-success",
  FAILED: "bg-danger/15 text-danger",
  REJECTED: "bg-ink-700 text-ink-400",
  COMPLETED_BY_STAFF: "bg-success/15 text-success",
};

export default function RefundsAccountingPage() {
  const toast = useToast();
  const { preset, range, set } = useDateRange("30d");
  const [dash, setDash] = useState<AccountingDashboard | null>(null);
  const [items, setItems] = useState<RefundRequestView[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, r] = await Promise.all([
        accountingApi.dashboard(range),
        refundsApi.list({ limit: 100 }),
      ]);
      setDash(d.data);
      // Filter client-side to the date window since /refunds doesn't
      // take a date filter today. We only show settled rows; the
      // /refunds page is where everything else lives.
      const from = new Date(range.from);
      const to = new Date(range.to);
      to.setHours(23, 59, 59, 999);
      const inWindow = r.data.items.filter((row) => {
        if (!SETTLED_STATUSES.includes(row.status)) return false;
        const d = new Date(row.createdAt);
        return d >= from && d <= to;
      });
      setItems(inWindow);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load refunds");
    } finally {
      setLoading(false);
    }
  }, [range, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const cur = dash?.current;

  return (
    <div className="space-y-5 animate-fade-in">
      <DateRangeBar preset={preset} range={range} onChange={set} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          label="Refunded"
          value={ngnFromKobo(cur?.refunds.amountNgn)}
          sub={cur ? `${cur.refunds.requestsCount} refunds` : ""}
        />
        <StatCard
          label="Units returned"
          value={cur ? cur.refunds.itemsCount.toLocaleString() : "—"}
          sub="Physical items"
        />
        <StatCard
          label="As % of revenue"
          value={
            cur && cur.revenueNgn > 0
              ? `${((cur.refunds.amountNgn / cur.revenueNgn) * 100).toFixed(1)}%`
              : "—"
          }
          sub="Refund rate"
        />
      </div>

      <div className="bg-ink-900 border border-ink-700 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-ink-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink-100 inline-flex items-center gap-2">
            <Undo2 size={14} /> Settled refunds in window
          </h3>
          <Link
            href="/refunds"
            className="text-xs text-[#C9A96E] hover:underline inline-flex items-center gap-1"
          >
            Open refund queue <ExternalLink size={11} />
          </Link>
        </div>
        {loading ? (
          <p className="p-10 text-center text-sm text-ink-400">Loading…</p>
        ) : items.length === 0 ? (
          <p className="p-10 text-center text-sm text-ink-400">
            No settled refunds in this window.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-ink-950 border-b border-ink-700">
              <tr className="text-left text-[11px] text-ink-400 uppercase tracking-wider">
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Items</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Refunded at</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-ink-800 last:border-0 hover:bg-ink-800/40"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/orders/${row.orderId}`}
                      className="font-mono text-xs text-[#C9A96E] hover:underline"
                    >
                      {row.order?.orderNumber ?? row.orderId.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-400">
                    {row.channel}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-400">
                    {row.method}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_STYLE[row.status]}`}
                    >
                      {STATUS_LABEL[row.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-ink-300">
                    {row.itemsCount}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-ink-100">
                    {ngnFromKobo(row.amount)}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-400 whitespace-nowrap">
                    {row.refundedAt
                      ? new Date(row.refundedAt).toLocaleString("en-NG", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-ink-900 border border-ink-700 rounded-xl p-4">
      <div className="text-[11px] uppercase tracking-wider text-ink-400 mb-1">
        {label}
      </div>
      <div className="text-xl font-bold text-ink-100">{value}</div>
      {sub ? <div className="text-[11px] text-ink-500 mt-1">{sub}</div> : null}
    </div>
  );
}
