"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2, Clock, CheckCircle2, ArrowRight, Package } from "lucide-react";
import { ordersApi, formatNgn, Order, ORDER_TRANSITIONS, ORDER_STATUS_LABELS } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton, SkeletonCard } from "@/components/Skeleton";
import { Modal } from "@/components/Modal";
import { useToast } from "@/lib/toast-context";
import { format } from "date-fns";
import Link from "next/link";

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { success, error } = useToast();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusModal, setStatusModal] = useState(false);
  const [nextStatus, setNextStatus] = useState("");
  const [reason, setReason] = useState("");
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ordersApi.get(id);
      setOrder(res.data);
    } catch (err) {
      error("Failed to load order", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [id, error]);

  useEffect(() => { load(); }, [load]);

  async function handleStatusUpdate() {
    if (!nextStatus || !order) return;
    setUpdating(true);
    try {
      const res = await ordersApi.updateStatus(order.id, nextStatus, reason || undefined);
      setOrder(res.data);
      success("Status updated", `Order moved to ${ORDER_STATUS_LABELS[nextStatus]}`);
      setStatusModal(false);
      setNextStatus("");
      setReason("");
    } catch (err) {
      error("Failed to update status", err instanceof Error ? err.message : undefined);
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex items-center gap-3"><Skeleton width={36} height={36} /><Skeleton width={240} height={24} /></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5"><SkeletonCard lines={6} /></div>
          <SkeletonCard lines={4} />
        </div>
      </div>
    );
  }

  if (!order) return null;

  const validTransitions = ORDER_TRANSITIONS[order.status] ?? [];
  const subtotalVal = parseFloat(order.subtotal ?? "0");
  const discountVal = parseFloat(order.discountTotal ?? "0");
  const shippingVal = parseFloat(order.shippingTotal ?? "0");
  const taxVal = parseFloat(order.taxTotal ?? "0");
  const grandTotalVal = parseFloat(order.grandTotal ?? "0");

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/orders" className="btn-ghost p-2"><ArrowLeft size={16} /></Link>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-ink-100 font-mono">{order.orderNumber}</h1>
              <StatusBadge status={order.status} size="md" />
            </div>
            <p className="text-xs text-ink-500 mt-0.5">
              Placed {format(new Date(order.createdAt), "EEEE, d MMMM yyyy 'at' HH:mm")}
            </p>
          </div>
        </div>
        {validTransitions.length > 0 && (
          <button onClick={() => setStatusModal(true)} className="btn-primary">
            <ArrowRight size={14} /> Update Status
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left */}
        <div className="lg:col-span-2 space-y-5">
          {/* Items */}
          <div className="admin-card overflow-hidden">
            <div className="px-5 py-4 border-b border-ink-700">
              <h2 className="text-sm font-semibold text-ink-300">Order Items ({order.items.length})</h2>
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Line Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-ink-700 rounded flex items-center justify-center shrink-0">
                          <Package size={13} className="text-ink-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-ink-200 leading-tight">{item.productName}</p>
                          <p className="text-xs text-ink-500">{item.variantName}</p>
                          {item.options && Object.keys(item.options).length > 0 && (
                            <p className="text-[11px] text-ink-600">
                              {Object.entries(item.options).map(([k, v]) => `${k}: ${v}`).join(", ")}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="font-mono text-xs text-ink-500">{item.sku}</td>
                    <td className="text-ink-300 text-sm">{item.quantity}</td>
                    <td className="font-mono text-sm text-ink-300">
                      {formatNgn(parseFloat(item.unitPrice) * 100)}
                    </td>
                    <td className="font-mono text-sm font-semibold text-ink-200">
                      {formatNgn(parseFloat(item.lineTotal) * 100)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Totals */}
            <div className="px-5 py-4 border-t border-ink-700 space-y-2">
              <TotalRow label="Subtotal" value={formatNgn(subtotalVal * 100)} />
              {discountVal > 0 && <TotalRow label="Discount" value={`-${formatNgn(discountVal * 100)}`} className="text-success" />}
              <TotalRow label="Shipping" value={shippingVal > 0 ? formatNgn(shippingVal * 100) : "Free"} />
              {taxVal > 0 && <TotalRow label="Tax" value={formatNgn(taxVal * 100)} />}
              <div className="pt-2 border-t border-ink-700">
                <TotalRow label="Grand Total" value={formatNgn(grandTotalVal * 100)} bold />
              </div>
            </div>
          </div>

          {/* Status history */}
          <div className="admin-card p-5">
            <h2 className="text-sm font-semibold text-ink-300 mb-4">Status History</h2>
            {order.statusHistory?.length > 0 ? (
              <div className="space-y-3">
                {[...order.statusHistory].reverse().map((h, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary-700/20 border border-primary-700/30 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 size={12} className="text-primary-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {h.fromStatus && (
                          <>
                            <StatusBadge status={h.fromStatus} />
                            <ArrowRight size={12} className="text-ink-600" />
                          </>
                        )}
                        <StatusBadge status={h.toStatus} />
                      </div>
                      {h.reason && <p className="text-xs text-ink-500 mt-1 italic">&ldquo;{h.reason}&rdquo;</p>}
                      <p className="text-[11px] text-ink-600 mt-1 flex items-center gap-1">
                        <Clock size={10} />
                        {format(new Date(h.createdAt), "d MMM yyyy, HH:mm")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-600">No history</p>
            )}
          </div>
        </div>

        {/* Right */}
        <div className="space-y-4">
          {/* Order summary */}
          <div className="admin-card p-5 space-y-3">
            <h2 className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Summary</h2>
            <Row label="Order Number" value={order.orderNumber} mono />
            <Row label="Channel" value={order.channel?.toUpperCase()} />
            <Row label="Currency" value={order.currency} />
            <Row label="Status" value={<StatusBadge status={order.status} />} />
          </div>

          {/* Shipping address */}
          {order.shippingAddress && (
            <div className="admin-card p-5 space-y-2">
              <h2 className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-3">Ship To</h2>
              <p className="text-sm font-semibold text-ink-200">
                {order.shippingAddress.firstName} {order.shippingAddress.lastName}
              </p>
              <p className="text-xs text-ink-400 leading-relaxed">
                {order.shippingAddress.line1}
                {order.shippingAddress.line2 && `, ${order.shippingAddress.line2}`}
                <br />
                {order.shippingAddress.city}, {order.shippingAddress.state}
                {order.shippingAddress.postalCode && ` ${order.shippingAddress.postalCode}`}
                <br />
                {order.shippingAddress.country}
              </p>
              {order.shippingAddress.phone && (
                <p className="text-xs text-ink-500">{order.shippingAddress.phone}</p>
              )}
            </div>
          )}

          {/* Customer */}
          {order.user && (
            <div className="admin-card p-5 space-y-2">
              <h2 className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2">Customer</h2>
              <p className="text-sm font-semibold text-ink-200">{order.user.firstName} {order.user.lastName}</p>
              <p className="text-xs text-ink-500">{order.user.email}</p>
            </div>
          )}
        </div>
      </div>

      {/* Status update modal */}
      <Modal
        open={statusModal}
        onClose={() => { setStatusModal(false); setNextStatus(""); setReason(""); }}
        title="Update Order Status"
        footer={
          <>
            <button onClick={() => setStatusModal(false)} className="btn-secondary px-4">Cancel</button>
            <button onClick={handleStatusUpdate} disabled={!nextStatus || updating} className="btn-primary px-5">
              {updating ? <><Loader2 size={14} className="animate-spin" /> Updating…</> : "Confirm"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="text-xs text-ink-500 mb-3">
              Current status: <StatusBadge status={order.status} />
            </p>
            <label className="admin-label">New Status *</label>
            <div className="space-y-2">
              {validTransitions.map((s) => (
                <label key={s} className="flex items-center gap-3 p-3 rounded-lg border border-ink-600 cursor-pointer hover:border-primary-600 transition-colors">
                  <input
                    type="radio"
                    name="status"
                    value={s}
                    checked={nextStatus === s}
                    onChange={() => setNextStatus(s)}
                    className="accent-primary-600"
                  />
                  <StatusBadge status={s} size="md" />
                  <span className="text-xs text-ink-400">{ORDER_STATUS_LABELS[s]}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="admin-label">Reason (optional)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="admin-input resize-none"
              rows={3}
              placeholder="Add a note for this status change…"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

function TotalRow({ label, value, bold, className = "" }: { label: string; value: React.ReactNode; bold?: boolean; className?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={`text-xs ${bold ? "font-semibold text-ink-200" : "text-ink-500"}`}>{label}</span>
      <span className={`font-mono text-sm ${bold ? "font-bold text-ink-100" : "text-ink-300"} ${className}`}>{value}</span>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-ink-500">{label}</span>
      <span className={`text-xs text-ink-200 font-medium ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
