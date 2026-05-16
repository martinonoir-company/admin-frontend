"use client";

import { useEffect, useState, useCallback } from "react";
import { CreditCard, RefreshCw, Search } from "lucide-react";
import {
  paymentsApi,
  Payment,
  PaymentStatus,
  PaymentChannel,
  PaymentProvider,
} from "@/lib/api";
import { Modal } from "@/components/Modal";
import { SkeletonTable } from "@/components/Skeleton";
import { useToast } from "@/lib/toast-context";
import { format } from "date-fns";

const PAGE_SIZE = 20;

const STATUS_STYLES: Record<PaymentStatus, string> = {
  SUCCEEDED: "bg-success/15 text-success",
  PENDING: "bg-warning/15 text-warning",
  PROCESSING: "bg-primary-700/20 text-primary-300",
  FAILED: "bg-danger/15 text-danger",
  CANCELLED: "bg-ink-700 text-ink-400",
  REFUNDED: "bg-[#FB923C]/15 text-[#FB923C]",
};

const STATUS_OPTIONS: PaymentStatus[] = [
  "PENDING",
  "PROCESSING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
];
const CHANNEL_OPTIONS: PaymentChannel[] = ["STOREFRONT", "MOBILE", "POS"];
const PROVIDER_OPTIONS: PaymentProvider[] = ["PAYSTACK", "MONIEPOINT", "CASH"];

function money(minor: number, currency: string): string {
  const sign = currency === "USD" ? "$" : "₦";
  return `${sign}${(Number(minor) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const CHANNEL_LABEL: Record<PaymentChannel, string> = {
  STOREFRONT: "Storefront",
  MOBILE: "Mobile App",
  POS: "POS",
};

const METHOD_LABEL: Record<string, string> = {
  CARD: "Card",
  CASH: "Cash",
  POS_TRANSFER: "POS Transfer",
  BANK_TRANSFER: "Bank Transfer",
};

export default function PaymentsPage() {
  const { error } = useToast();
  const [items, setItems] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<PaymentStatus | "">("");
  const [channelFilter, setChannelFilter] = useState<PaymentChannel | "">("");
  const [providerFilter, setProviderFilter] = useState<PaymentProvider | "">("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [detail, setDetail] = useState<Payment | null>(null);

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const res = await paymentsApi.list({
          page: p,
          limit: PAGE_SIZE,
          status: statusFilter || undefined,
          channel: channelFilter || undefined,
          provider: providerFilter || undefined,
          search: search || undefined,
        });
        setItems(res.data.items);
        setTotal(res.data.total);
        setPages(res.data.pages);
      } catch (err) {
        error(
          "Failed to load payments",
          err instanceof Error ? err.message : undefined,
        );
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, channelFilter, providerFilter, search, error],
  );

  useEffect(() => {
    load(page);
  }, [page, load]);

  // Re-query from page 1 whenever a filter changes.
  useEffect(() => {
    setPage(1);
  }, [statusFilter, channelFilter, providerFilter, search]);

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">Payments</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            {total} payment record{total === 1 ? "" : "s"} across all channels
          </p>
        </div>
        <button
          onClick={() => load(page)}
          className="btn-ghost"
          title="Refresh"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Filters */}
      <div className="admin-card p-4 flex flex-wrap items-center gap-3">
        <form onSubmit={applySearch} className="flex items-center gap-2 flex-1 min-w-[220px]">
          <div className="relative flex-1">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500"
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Order #, reference…"
              className="admin-input pl-9 w-full"
            />
          </div>
        </form>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as PaymentStatus | "")}
          className="admin-select w-auto"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value as PaymentChannel | "")}
          className="admin-select w-auto"
        >
          <option value="">All channels</option>
          {CHANNEL_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {CHANNEL_LABEL[c]}
            </option>
          ))}
        </select>
        <select
          value={providerFilter}
          onChange={(e) => setProviderFilter(e.target.value as PaymentProvider | "")}
          className="admin-select w-auto"
        >
          <option value="">All providers</option>
          {PROVIDER_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="admin-card overflow-hidden">
        {loading ? (
          <div className="p-4">
            <SkeletonTable rows={8} cols={7} />
          </div>
        ) : items.length === 0 ? (
          <div className="py-20 text-center">
            <CreditCard size={36} className="text-ink-700 mx-auto mb-3" />
            <p className="text-ink-500 text-sm">No payments found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Provider</th>
                  <th>Channel</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() => setDetail(p)}
                  >
                    <td>
                      <span className="font-mono text-xs font-semibold text-primary-400">
                        {p.orderNumber}
                      </span>
                    </td>
                    <td className="font-mono text-sm font-semibold text-ink-100">
                      {money(p.amount, p.currency)}
                    </td>
                    <td className="text-xs text-ink-300">
                      {METHOD_LABEL[p.method] ?? p.method}
                    </td>
                    <td className="text-xs text-ink-400">{p.provider}</td>
                    <td className="text-xs text-ink-400">
                      {CHANNEL_LABEL[p.channel]}
                    </td>
                    <td>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_STYLES[p.status]}`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="text-[11px] text-ink-500 whitespace-nowrap">
                      {format(new Date(p.createdAt), "d MMM yyyy, HH:mm")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-ink-500">
            Page {page} of {pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page >= pages}
            className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {/* Detail drawer */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `Payment — ${detail.orderNumber}` : "Payment"}
        size="lg"
      >
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xl font-bold text-ink-100">
                {money(detail.amount, detail.currency)}
              </span>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[detail.status]}`}
              >
                {detail.status}
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <DetailRow label="Order" value={detail.orderNumber} mono />
              <DetailRow
                label="Method"
                value={METHOD_LABEL[detail.method] ?? detail.method}
              />
              <DetailRow label="Provider" value={detail.provider} />
              <DetailRow label="Channel" value={CHANNEL_LABEL[detail.channel]} />
              <DetailRow
                label="Merchant Reference"
                value={detail.merchantReference}
                mono
              />
              <DetailRow
                label="Provider Reference"
                value={detail.providerReference ?? "—"}
                mono
              />
              {detail.terminalSerial && (
                <DetailRow label="Terminal" value={detail.terminalSerial} mono />
              )}
              <DetailRow
                label="Created"
                value={format(new Date(detail.createdAt), "d MMM yyyy, HH:mm:ss")}
              />
              <DetailRow
                label="Paid At"
                value={
                  detail.paidAt
                    ? format(new Date(detail.paidAt), "d MMM yyyy, HH:mm:ss")
                    : "—"
                }
              />
            </dl>

            {detail.gatewayResponse && (
              <div className="rounded-lg bg-ink-700/40 border border-ink-700 p-3">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wide mb-1">
                  Gateway Response
                </p>
                <p className="text-sm text-ink-200">{detail.gatewayResponse}</p>
              </div>
            )}
            {detail.failureReason && (
              <div className="rounded-lg bg-danger/10 border border-danger/30 p-3">
                <p className="text-[11px] font-semibold text-danger uppercase tracking-wide mb-1">
                  Failure Reason
                </p>
                <p className="text-sm text-danger">{detail.failureReason}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[11px] font-semibold text-ink-500 uppercase tracking-wide">
        {label}
      </dt>
      <dd
        className={`text-ink-200 mt-0.5 break-all ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
