"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  RefreshCw,
  Search,
  Undo2,
  XCircle,
} from "lucide-react";
import {
  refundsApi,
  RefundRequestView,
  RefundStatus,
  RefundMethod,
  PaymentChannel,
} from "@/lib/api";
import { Modal } from "@/components/Modal";
import { SkeletonTable } from "@/components/Skeleton";
import { useToast } from "@/lib/toast-context";
import { useAuth } from "@/lib/auth-context";
import { format } from "date-fns";

const PAGE_SIZE = 20;

const STATUS_STYLES: Record<RefundStatus, string> = {
  PENDING: "bg-warning/15 text-warning",
  APPROVED: "bg-primary-700/20 text-primary-300",
  PROCESSING: "bg-primary-700/20 text-primary-300",
  SUCCEEDED: "bg-success/15 text-success",
  COMPLETED_BY_STAFF: "bg-success/15 text-success",
  FAILED: "bg-danger/15 text-danger",
  REJECTED: "bg-ink-700 text-ink-400",
};

const STATUS_LABEL: Record<RefundStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  PROCESSING: "Processing",
  SUCCEEDED: "Refunded",
  COMPLETED_BY_STAFF: "Cash refund (staff)",
  FAILED: "Failed",
  REJECTED: "Rejected",
};

const METHOD_LABEL: Record<RefundMethod, string> = {
  PAYSTACK_REFUND: "Paystack refund (card)",
  PAYSTACK_TRANSFER: "Paystack transfer (bank)",
  CASH: "Cash from till",
};

const STATUS_OPTIONS: RefundStatus[] = [
  "PENDING",
  "APPROVED",
  "PROCESSING",
  "SUCCEEDED",
  "FAILED",
  "REJECTED",
  "COMPLETED_BY_STAFF",
];
const CHANNEL_OPTIONS: PaymentChannel[] = ["STOREFRONT", "MOBILE", "POS"];

function money(minor: number, currency: string): string {
  const sign = currency === "USD" ? "$" : "₦";
  return `${sign}${(Number(minor) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function RefundsPage() {
  const { user } = useAuth();
  const { success, error } = useToast();
  const [items, setItems] = useState<RefundRequestView[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<RefundStatus | "">("");
  const [channelFilter, setChannelFilter] = useState<PaymentChannel | "">("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [detail, setDetail] = useState<RefundRequestView | null>(null);
  const [acting, setActing] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  /**
   * Editable refund amount (in naira, what the user types). Pre-filled
   * from the request's existing amount when the drawer opens, so the
   * super admin can reduce it before approving — e.g. to keep shipping.
   */
  const [editAmount, setEditAmount] = useState<string>("");
  useEffect(() => {
    if (detail) setEditAmount((detail.amount / 100).toString());
  }, [detail]);

  // Role gate — only super admins should see this page; the sidebar
  // already hides it, but a direct URL hit must also bounce.
  const isSuperAdmin =
    user?.role === "SUPER_ADMIN" || user?.role === "COMPANY_SUPER_ADMIN";

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const res = await refundsApi.list({
          page: p,
          limit: PAGE_SIZE,
          status: statusFilter || undefined,
          channel: channelFilter || undefined,
          search: search || undefined,
        });
        setItems(res.data.items);
        setTotal(res.data.total);
        setPages(res.data.pages);
        setPage(res.data.page);
      } catch (err) {
        error(
          "Could not load refunds",
          err instanceof Error ? err.message : "",
        );
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, channelFilter, search, error],
  );

  useEffect(() => {
    if (!isSuperAdmin) return;
    void load(1);
  }, [load, isSuperAdmin]);

  // Refresh the detail row after an action so the UI reflects the new
  // status without a full list reload.
  const refreshDetail = useCallback(async (id: string) => {
    try {
      const res = await refundsApi.get(id);
      setDetail(res.data);
      setItems((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...res.data } : r)),
      );
    } catch {
      /* keep existing */
    }
  }, []);

  const handleApprove = useCallback(async () => {
    if (!detail) return;
    // Convert the edited naira amount → minor units only if it changed.
    // When unchanged we send nothing so the server keeps the original.
    const editedMajor = parseFloat(editAmount.replace(/,/g, ""));
    const orderTotal = detail.order?.grandTotal ?? 0;
    let amountOverride: number | undefined;
    if (Number.isFinite(editedMajor) && editedMajor > 0) {
      const minor = Math.round(editedMajor * 100);
      if (minor !== detail.amount) {
        if (orderTotal > 0 && minor > orderTotal) {
          error(
            "Amount too high",
            `Cannot refund more than the order total (₦${(orderTotal / 100).toLocaleString()}).`,
          );
          return;
        }
        amountOverride = minor;
      }
    } else {
      error("Enter a valid amount", "");
      return;
    }
    setActing(true);
    try {
      await refundsApi.approve(detail.id, amountOverride);
      success(
        "Refund approved",
        amountOverride
          ? "Adjusted amount sent to the provider for processing."
          : "The provider call is now processing.",
      );
      await refreshDetail(detail.id);
    } catch (err) {
      error(
        "Could not approve refund",
        err instanceof Error ? err.message : "",
      );
    } finally {
      setActing(false);
    }
  }, [detail, editAmount, success, error, refreshDetail]);

  const handleReject = useCallback(async () => {
    if (!detail) return;
    setActing(true);
    try {
      await refundsApi.reject(detail.id, rejectReason || undefined);
      success("Refund rejected", "The customer will not be paid back.");
      setShowReject(false);
      setRejectReason("");
      await refreshDetail(detail.id);
    } catch (err) {
      error(
        "Could not reject refund",
        err instanceof Error ? err.message : "",
      );
    } finally {
      setActing(false);
    }
  }, [detail, rejectReason, success, error, refreshDetail]);

  const handleRetry = useCallback(async () => {
    if (!detail) return;
    setActing(true);
    try {
      await refundsApi.retry(detail.id);
      success("Retrying refund", "Provider call re-sent.");
      await refreshDetail(detail.id);
    } catch (err) {
      error("Retry failed", err instanceof Error ? err.message : "");
    } finally {
      setActing(false);
    }
  }, [detail, success, error, refreshDetail]);

  if (!isSuperAdmin) {
    return (
      <div className="p-8">
        <div className="rounded-xl border border-ink-700 bg-ink-900 p-8 text-center">
          <h1 className="text-lg font-semibold text-white">
            Refunds — access denied
          </h1>
          <p className="text-ink-400 mt-2 text-sm">
            Only super admins can view and process refunds.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
            <Undo2 size={20} className="text-primary-300" />
            Refunds
          </h1>
          <p className="text-ink-400 text-sm mt-1">
            {total} request{total === 1 ? "" : "s"} — process refunds raised by
            store returns and online cancellations.
          </p>
        </div>
        <button
          onClick={() => load(page)}
          className="rounded-lg bg-ink-800 hover:bg-ink-700 text-white text-sm px-3 py-2 inline-flex items-center gap-2"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500"
          />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setSearch(searchInput.trim());
            }}
            placeholder="Order number…"
            className="w-64 pl-8 pr-3 py-2 bg-ink-900 border border-ink-700 rounded-lg text-sm text-white placeholder:text-ink-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as RefundStatus | "")
          }
          className="px-3 py-2 bg-ink-900 border border-ink-700 rounded-lg text-sm text-white"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          value={channelFilter}
          onChange={(e) =>
            setChannelFilter(e.target.value as PaymentChannel | "")
          }
          className="px-3 py-2 bg-ink-900 border border-ink-700 rounded-lg text-sm text-white"
        >
          <option value="">All channels</option>
          {CHANNEL_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {(statusFilter || channelFilter || search) && (
          <button
            onClick={() => {
              setStatusFilter("");
              setChannelFilter("");
              setSearch("");
              setSearchInput("");
            }}
            className="text-xs text-ink-400 hover:text-white"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-ink-700 bg-ink-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-800 text-ink-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3">Created</th>
                <th className="text-left px-4 py-3">Order</th>
                <th className="text-left px-4 py-3">Channel</th>
                <th className="text-left px-4 py-3">Method</th>
                <th className="text-right px-4 py-3">Amount</th>
                <th className="text-right px-4 py-3">Items</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-4">
                    <SkeletonTable rows={5} />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-10 text-ink-500 text-sm"
                  >
                    No refund requests.
                  </td>
                </tr>
              ) : (
                items.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setDetail(r)}
                    className="hover:bg-ink-800 cursor-pointer"
                  >
                    <td className="px-4 py-3 text-ink-300 whitespace-nowrap">
                      {format(new Date(r.createdAt), "yyyy-MM-dd HH:mm")}
                    </td>
                    <td className="px-4 py-3 text-white font-mono text-xs">
                      {r.order?.orderNumber ?? r.orderId.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-ink-300">{r.channel}</td>
                    <td className="px-4 py-3 text-ink-300">
                      {METHOD_LABEL[r.method]}
                    </td>
                    <td className="px-4 py-3 text-right text-white font-semibold">
                      {money(r.amount, r.currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-ink-300">
                      {r.itemsCount}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          STATUS_STYLES[r.status]
                        }`}
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pager */}
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-ink-800 px-4 py-3 text-xs text-ink-400">
            <span>
              Page {page} of {pages} · {total} request
              {total === 1 ? "" : "s"}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => load(page - 1)}
                className="px-3 py-1 rounded bg-ink-800 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= pages}
                onClick={() => load(page + 1)}
                className="px-3 py-1 rounded bg-ink-800 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      <Modal
        open={!!detail}
        onClose={() => {
          if (acting) return;
          setDetail(null);
          setShowReject(false);
          setRejectReason("");
        }}
        title={
          detail
            ? `Refund · ${detail.order?.orderNumber ?? detail.orderId.slice(0, 8)}`
            : ""
        }
        size="lg"
      >
        {detail && (
          <div className="space-y-5 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Amount"
                value={money(detail.amount, detail.currency)}
                bold
              />
              <Field label="Items returned" value={String(detail.itemsCount)} />
              <Field
                label="Status"
                value={
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      STATUS_STYLES[detail.status]
                    }`}
                  >
                    {STATUS_LABEL[detail.status]}
                  </span>
                }
              />
              <Field label="Method" value={METHOD_LABEL[detail.method]} />
              <Field label="Channel" value={detail.channel} />
              <Field
                label="Created"
                value={format(new Date(detail.createdAt), "yyyy-MM-dd HH:mm")}
              />
            </div>

            {/* Editable amount — only relevant while the request is pending.
                Set the figure that will actually be sent to Paystack /
                paid out. Useful for partial refunds or deducting logistics. */}
            {detail.status === "PENDING" && (
              <div className="rounded-lg border border-primary-700/40 bg-primary-700/10 p-3 space-y-2">
                <label className="text-xs uppercase tracking-wider text-primary-300">
                  Amount to refund (₦)
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-ink-400">₦</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min={0}
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="flex-1 px-3 py-2 bg-ink-950 border border-ink-700 rounded text-base font-semibold text-white"
                  />
                </div>
                <p className="text-[11px] text-ink-400">
                  Requested:{" "}
                  <span className="text-ink-200">
                    {money(detail.amount, detail.currency)}
                  </span>
                  {detail.order?.grandTotal
                    ? ` · Order total: ${money(detail.order.grandTotal, detail.order.currency)}`
                    : ""}
                </p>
              </div>
            )}

            {detail.order && (
              <div className="rounded-lg border border-ink-700 p-3">
                <div className="text-ink-400 text-xs uppercase tracking-wider mb-2">
                  Original order
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field
                    label="Order #"
                    value={
                      <span className="font-mono">
                        {detail.order.orderNumber}
                      </span>
                    }
                  />
                  <Field label="Status" value={detail.order.status} />
                  <Field
                    label="Order total"
                    value={money(
                      detail.order.grandTotal,
                      detail.order.currency,
                    )}
                  />
                  {detail.order.user && (
                    <Field
                      label="Customer"
                      value={
                        [
                          detail.order.user.firstName,
                          detail.order.user.lastName,
                        ]
                          .filter(Boolean)
                          .join(" ") || "—"
                      }
                    />
                  )}
                </div>
              </div>
            )}

            {detail.originalPayment && (
              <div className="rounded-lg border border-ink-700 p-3">
                <div className="text-ink-400 text-xs uppercase tracking-wider mb-2">
                  Original payment
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field
                    label="Provider"
                    value={detail.originalPayment.provider}
                  />
                  <Field label="Method" value={detail.originalPayment.method} />
                  <Field
                    label="Provider ref"
                    value={
                      <span className="font-mono text-xs">
                        {detail.originalPayment.providerReference ?? "—"}
                      </span>
                    }
                  />
                  <Field
                    label="Paid at"
                    value={
                      detail.originalPayment.paidAt
                        ? format(
                            new Date(detail.originalPayment.paidAt),
                            "yyyy-MM-dd HH:mm",
                          )
                        : "—"
                    }
                  />
                </div>
              </div>
            )}

            {detail.method === "PAYSTACK_TRANSFER" && (
              <div className="rounded-lg border border-ink-700 p-3">
                <div className="text-ink-400 text-xs uppercase tracking-wider mb-2">
                  Bank details (verified at POS)
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field
                    label="Account name"
                    value={detail.bankAccountName ?? "—"}
                  />
                  <Field
                    label="Account #"
                    value={detail.bankAccountNumber ?? "—"}
                  />
                  <Field label="Bank code" value={detail.bankCode ?? "—"} />
                </div>
              </div>
            )}

            <div>
              <div className="text-ink-400 text-xs uppercase tracking-wider mb-2">
                Items
              </div>
              <div className="rounded-lg border border-ink-700 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-ink-800 text-ink-400">
                    <tr>
                      <th className="text-left px-3 py-2">Product</th>
                      <th className="text-left px-3 py-2">SKU</th>
                      <th className="text-right px-3 py-2">Qty</th>
                      <th className="text-right px-3 py-2">Unit</th>
                      <th className="text-right px-3 py-2">Line</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-800">
                    {detail.items?.map((i) => (
                      <tr key={i.id}>
                        <td className="px-3 py-2 text-white">
                          {i.productName}
                          {i.variantName && (
                            <span className="text-ink-500 ml-1">
                              · {i.variantName}
                            </span>
                          )}
                          {i.reasonNote && (
                            <div className="text-ink-500 text-[10px] mt-0.5">
                              {i.reasonCode ?? "Return"} — {i.reasonNote}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-ink-400">
                          {i.sku}
                        </td>
                        <td className="px-3 py-2 text-right">{i.quantity}</td>
                        <td className="px-3 py-2 text-right text-ink-300">
                          {money(i.unitPrice, detail.currency)}
                        </td>
                        <td className="px-3 py-2 text-right text-white font-semibold">
                          {money(i.lineTotal, detail.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {detail.failureReason && (
              <div className="rounded-lg bg-danger/10 border border-danger/30 p-3 text-danger text-xs">
                Provider error: {detail.failureReason}
              </div>
            )}
            {detail.decisionReason && detail.status === "REJECTED" && (
              <div className="rounded-lg bg-ink-800 p-3 text-ink-300 text-xs">
                Rejected: {detail.decisionReason}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t border-ink-800">
              {detail.status === "PENDING" && (
                <>
                  <button
                    disabled={acting}
                    onClick={handleApprove}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-success/20 text-success hover:bg-success/30 text-sm font-semibold disabled:opacity-50"
                  >
                    <CheckCircle2 size={14} />
                    Approve &amp; process
                  </button>
                  <button
                    disabled={acting}
                    onClick={() => setShowReject(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-800 text-ink-200 hover:bg-ink-700 text-sm font-semibold disabled:opacity-50"
                  >
                    <XCircle size={14} />
                    Reject
                  </button>
                </>
              )}
              {detail.status === "FAILED" && (
                <button
                  disabled={acting}
                  onClick={handleRetry}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-warning/20 text-warning hover:bg-warning/30 text-sm font-semibold disabled:opacity-50"
                >
                  <RefreshCw size={14} />
                  Retry provider call
                </button>
              )}
            </div>

            {/* Reject reason input */}
            {showReject && (
              <div className="rounded-lg border border-ink-700 p-3 space-y-2">
                <label className="text-xs text-ink-400">
                  Reason for rejecting (optional, shown in audit log)
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-ink-950 border border-ink-700 rounded text-sm text-white"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    disabled={acting}
                    onClick={() => {
                      setShowReject(false);
                      setRejectReason("");
                    }}
                    className="px-3 py-1.5 rounded bg-ink-800 text-ink-300 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={acting}
                    onClick={handleReject}
                    className="px-3 py-1.5 rounded bg-danger/30 text-danger text-xs font-semibold"
                  >
                    Confirm reject
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function Field({
  label,
  value,
  bold,
}: {
  label: string;
  value: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <div>
      <div className="text-ink-500 text-[10px] uppercase tracking-wider">
        {label}
      </div>
      <div
        className={`text-sm ${bold ? "text-white font-bold" : "text-ink-200"}`}
      >
        {value}
      </div>
    </div>
  );
}
