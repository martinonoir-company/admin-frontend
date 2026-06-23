"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Ticket,
  RefreshCw,
  Power,
  Search,
  Zap,
} from "lucide-react";
import {
  couponsApi,
  Coupon,
  CreateCouponDto,
  DiscountType,
  CouponStatus,
  CouponChannel,
  productsApi,
  Product,
} from "@/lib/api";
import { Modal } from "@/components/Modal";
import { SkeletonTable } from "@/components/Skeleton";
import { useToast } from "@/lib/toast-context";
import { format } from "date-fns";

const PAGE_SIZE = 20;

const CHANNELS: { value: CouponChannel; label: string }[] = [
  { value: "STOREFRONT", label: "Storefront (Web)" },
  { value: "MOBILE", label: "Storefront App" },
  { value: "POS", label: "POS" },
];

const STATUS_STYLES: Record<CouponStatus, string> = {
  ACTIVE: "bg-success/15 text-success",
  EXPIRED: "bg-ink-700 text-ink-400",
  DISABLED: "bg-danger/15 text-danger",
};

/** minor units (kobo/cents) -> major-unit string for form input */
function toMajor(minor: number): string {
  return minor ? String(minor / 100) : "";
}
/** major-unit form input -> minor units */
function toMinor(major: string): number {
  const n = parseFloat(major);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
/** ISO datetime -> value for <input type="datetime-local"> */
function toLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  // datetime-local wants YYYY-MM-DDTHH:mm in local time
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Create / Edit form ───────────────────────────────────────

function CouponForm({
  initial,
  onSubmit,
  loading,
  onCancel,
}: {
  initial?: Coupon;
  onSubmit: (dto: CreateCouponDto) => Promise<void>;
  loading: boolean;
  onCancel: () => void;
}) {
  const isEdit = !!initial;

  const [code, setCode] = useState(initial?.code ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [discountType, setDiscountType] = useState<DiscountType>(
    initial?.discountType ?? "PERCENTAGE",
  );
  // For PERCENTAGE the value is a whole percent; for FIXED_AMOUNT it's money.
  const [percentValue, setPercentValue] = useState(
    initial && initial.discountType === "PERCENTAGE"
      ? String(initial.discountValue)
      : "",
  );
  const [amountValue, setAmountValue] = useState(
    initial && initial.discountType === "FIXED_AMOUNT"
      ? toMajor(initial.discountValue)
      : "",
  );
  const [currency, setCurrency] = useState(initial?.currency ?? "NGN");
  const [minimumOrderAmount, setMinimumOrderAmount] = useState(
    toMajor(initial?.minimumOrderAmount ?? 0),
  );
  const [maximumDiscount, setMaximumDiscount] = useState(
    toMajor(initial?.maximumDiscount ?? 0),
  );
  const [usageLimit, setUsageLimit] = useState(
    String(initial?.usageLimit ?? 0),
  );
  const [usageLimitPerCustomer, setUsageLimitPerCustomer] = useState(
    String(initial?.usageLimitPerCustomer ?? 1),
  );
  const [status, setStatus] = useState<CouponStatus>(
    initial?.status ?? "ACTIVE",
  );
  const [startsAt, setStartsAt] = useState(toLocalInput(initial?.startsAt));
  const [expiresAt, setExpiresAt] = useState(toLocalInput(initial?.expiresAt));
  const [channels, setChannels] = useState<CouponChannel[]>(
    initial?.applicableChannels ?? [],
  );
  // Variant-scoping + auto-apply (rescue-discount workflow). Auto-apply
  // is only meaningful when at least one variant is targeted — the form
  // enforces that as a validation rule before submit.
  const [autoApply, setAutoApply] = useState<boolean>(
    initial?.autoApply ?? false,
  );
  const [variantIds, setVariantIds] = useState<string[]>(
    initial?.applicableVariantIds ?? [],
  );
  const [variantPickerOpen, setVariantPickerOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function toggleChannel(c: CouponChannel) {
    setChannels((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};

    if (!isEdit && !code.trim()) errs.code = "Code is required";
    if (!isEdit && code.trim().length < 3)
      errs.code = "Code must be at least 3 characters";

    if (discountType === "PERCENTAGE") {
      const p = Number(percentValue);
      if (!percentValue || isNaN(p) || p <= 0 || p > 100)
        errs.value = "Enter a percentage between 1 and 100";
    } else if (discountType === "FIXED_AMOUNT") {
      const a = Number(amountValue);
      if (!amountValue || isNaN(a) || a <= 0)
        errs.value = "Enter a positive amount";
    }

    if (startsAt && expiresAt && new Date(startsAt) >= new Date(expiresAt)) {
      errs.expiresAt = "Expiry must be after the start date";
    }

    // Auto-apply requires at least one variant; otherwise the server's
    // findAutoApplyCandidates filter (jsonb_array_length > 0) would
    // make it inert, and an admin can mistakenly think it's working.
    if (autoApply && variantIds.length === 0) {
      errs.variants =
        "Pick at least one variant — auto-apply requires variant scoping.";
    }

    setErrors(errs);
    if (Object.keys(errs).length) return;

    const discountValue =
      discountType === "PERCENTAGE"
        ? Math.round(Number(percentValue))
        : toMinor(amountValue);

    const dto: CreateCouponDto = {
      code: code.trim().toUpperCase(),
      description: description.trim() || undefined,
      discountType,
      discountValue,
      currency:
        discountType === "FIXED_AMOUNT" ? currency : undefined,
      minimumOrderAmount: toMinor(minimumOrderAmount),
      maximumDiscount:
        discountType === "PERCENTAGE" ? toMinor(maximumDiscount) : 0,
      usageLimit: parseInt(usageLimit, 10) || 0,
      usageLimitPerCustomer: parseInt(usageLimitPerCustomer, 10) || 0,
      status,
      startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      applicableChannels: channels,
      applicableVariantIds: variantIds,
      autoApply,
    };

    await onSubmit(dto);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Code */}
      <div>
        <label className="admin-label">Promotion Code *</label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          disabled={isEdit}
          className="admin-input font-mono uppercase disabled:opacity-60"
          placeholder="e.g. WELCOME15"
        />
        {isEdit && (
          <p className="text-[11px] text-ink-600 mt-1">
            The code cannot be changed after creation.
          </p>
        )}
        {errors.code && <p className="text-xs text-danger mt-1">{errors.code}</p>}
      </div>

      {/* Description */}
      <div>
        <label className="admin-label">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="admin-input"
          placeholder="e.g. 15% off for new customers"
        />
      </div>

      {/* Promotion type */}
      <div>
        <label className="admin-label">Promotion Type *</label>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { v: "PERCENTAGE", t: "Coupon", d: "% off the subtotal" },
              { v: "FIXED_AMOUNT", t: "Discount", d: "Fixed amount off" },
            ] as const
          ).map((opt) => (
            <label
              key={opt.v}
              className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                discountType === opt.v
                  ? "border-primary-600 bg-primary-700/10"
                  : "border-ink-600 hover:border-ink-500"
              }`}
            >
              <input
                type="radio"
                name="discountType"
                value={opt.v}
                checked={discountType === opt.v}
                onChange={() => setDiscountType(opt.v)}
                className="accent-primary-600 mt-0.5"
              />
              <div>
                <p className="text-sm font-medium text-ink-200">{opt.t}</p>
                <p className="text-[11px] text-ink-500">{opt.d}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Value — percentage vs amount */}
      {discountType === "PERCENTAGE" ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="admin-label">Percentage Off *</label>
            <input
              type="number"
              value={percentValue}
              onChange={(e) => setPercentValue(e.target.value)}
              className="admin-input"
              placeholder="e.g. 15"
              min={1}
              max={100}
            />
          </div>
          <div>
            <label className="admin-label">Max Discount Cap</label>
            <input
              type="number"
              value={maximumDiscount}
              onChange={(e) => setMaximumDiscount(e.target.value)}
              className="admin-input"
              placeholder="0 = no cap"
              min={0}
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="admin-label">Amount Off *</label>
            <input
              type="number"
              value={amountValue}
              onChange={(e) => setAmountValue(e.target.value)}
              className="admin-input"
              placeholder="e.g. 5000"
              min={0}
            />
          </div>
          <div>
            <label className="admin-label">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="admin-select"
            >
              <option value="NGN">NGN (₦)</option>
              <option value="USD">USD ($)</option>
            </select>
          </div>
        </div>
      )}
      {errors.value && <p className="text-xs text-danger -mt-2">{errors.value}</p>}

      {/* Minimum order */}
      <div>
        <label className="admin-label">Minimum Order Amount</label>
        <input
          type="number"
          value={minimumOrderAmount}
          onChange={(e) => setMinimumOrderAmount(e.target.value)}
          className="admin-input"
          placeholder="0 = no minimum"
          min={0}
        />
      </div>

      {/* Usage limits */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="admin-label">Total Uses</label>
          <input
            type="number"
            value={usageLimit}
            onChange={(e) => setUsageLimit(e.target.value)}
            className="admin-input"
            placeholder="0 = unlimited"
            min={0}
          />
        </div>
        <div>
          <label className="admin-label">Uses Per Customer</label>
          <input
            type="number"
            value={usageLimitPerCustomer}
            onChange={(e) => setUsageLimitPerCustomer(e.target.value)}
            className="admin-input"
            placeholder="0 = unlimited"
            min={0}
          />
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="admin-label">Starts At</label>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="admin-input"
          />
        </div>
        <div>
          <label className="admin-label">Expires At</label>
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="admin-input"
          />
          {errors.expiresAt && (
            <p className="text-xs text-danger mt-1">{errors.expiresAt}</p>
          )}
        </div>
      </div>

      {/* Channels */}
      <div>
        <label className="admin-label">Applicable Channels</label>
        <div className="space-y-2">
          {CHANNELS.map((c) => (
            <label
              key={c.value}
              className="flex items-center gap-2.5 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={channels.includes(c.value)}
                onChange={() => toggleChannel(c.value)}
                className="w-4 h-4 rounded accent-primary-600"
              />
              <span className="text-sm text-ink-300">{c.label}</span>
            </label>
          ))}
        </div>
        <p className="text-[11px] text-ink-600 mt-1.5">
          Leave all unchecked to allow the promotion on every channel.
        </p>
      </div>

      {/* Variant scoping + auto-apply (rescue discounts) */}
      <div className="rounded-lg border border-ink-700 bg-ink-900/40 p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <label className="admin-label flex items-center gap-1.5">
              <Zap size={12} className="text-[#C9A96E]" /> Variant Scope &
              Auto-apply
            </label>
            <p className="text-[11px] text-ink-500 mt-0.5">
              Limit this promotion to specific product variants. When
              auto-apply is on, the discount is silently attached the
              moment the customer adds a covered variant — no code typed.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={autoApply}
              onChange={(e) => setAutoApply(e.target.checked)}
              className="w-4 h-4 rounded accent-primary-600"
            />
            <span className="text-ink-200">Auto-apply</span>
          </label>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-ink-400">
            {variantIds.length === 0
              ? "No variants picked yet"
              : `${variantIds.length} variant${variantIds.length === 1 ? "" : "s"} selected`}
          </p>
          <button
            type="button"
            onClick={() => setVariantPickerOpen(true)}
            className="btn-secondary px-3 py-1.5 text-xs"
          >
            <Search size={12} /> Pick variants
          </button>
        </div>
        {errors.variants && (
          <p className="text-xs text-danger">{errors.variants}</p>
        )}
      </div>

      {/* Status */}
      <div>
        <label className="admin-label">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as CouponStatus)}
          className="admin-select"
        >
          <option value="ACTIVE">Active</option>
          <option value="DISABLED">Disabled</option>
        </select>
      </div>

      {variantPickerOpen && (
        <VariantPickerModal
          selected={variantIds}
          onCancel={() => setVariantPickerOpen(false)}
          onApply={(next) => {
            setVariantIds(next);
            setVariantPickerOpen(false);
          }}
        />
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary px-4">
          Cancel
        </button>
        <button type="submit" disabled={loading} className="btn-primary px-5">
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Saving…
            </>
          ) : (
            "Save"
          )}
        </button>
      </div>
    </form>
  );
}

// ── Page ─────────────────────────────────────────────────────

export default function PromotionsPage() {
  const { success, error } = useToast();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Coupon | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const res = await couponsApi.list({ page: p, limit: PAGE_SIZE });
        setCoupons(res.data.items);
        setTotal(res.data.total);
        setPages(res.data.pages);
      } catch (err) {
        error(
          "Failed to load promotions",
          err instanceof Error ? err.message : undefined,
        );
      } finally {
        setLoading(false);
      }
    },
    [error],
  );

  useEffect(() => {
    load(page);
  }, [page, load]);

  function openCreate() {
    setEditTarget(null);
    setModalOpen(true);
  }
  function openEdit(c: Coupon) {
    setEditTarget(c);
    setModalOpen(true);
  }
  function closeModal() {
    setModalOpen(false);
    setEditTarget(null);
  }

  async function handleSave(dto: CreateCouponDto) {
    setSaving(true);
    try {
      if (editTarget) {
        // The update DTO is stricter than create: `code` is immutable
        // and the server rejects it (forbidNonWhitelisted). Strip it
        // before sending so an edit doesn't 400 on "code should not
        // exist".
        const { code: _code, ...updateDto } = dto;
        void _code;
        await couponsApi.update(editTarget.id, updateDto);
        success("Promotion updated");
      } else {
        await couponsApi.create(dto);
        success("Promotion created");
      }
      closeModal();
      load(page);
    } catch (err) {
      error(
        "Failed to save promotion",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(c: Coupon) {
    const next: CouponStatus = c.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    setBusyId(c.id);
    try {
      await couponsApi.setStatus(c.id, next);
      success(next === "ACTIVE" ? "Promotion activated" : "Promotion disabled");
      load(page);
    } catch (err) {
      error("Failed to update status", err instanceof Error ? err.message : undefined);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(c: Coupon) {
    if (!confirm(`Delete promotion "${c.code}"? This cannot be undone.`)) return;
    setBusyId(c.id);
    try {
      await couponsApi.delete(c.id);
      success("Promotion deleted");
      // If we just removed the last row on a page, step back.
      const nextPage = coupons.length === 1 && page > 1 ? page - 1 : page;
      setPage(nextPage);
      load(nextPage);
    } catch (err) {
      error("Failed to delete promotion", err instanceof Error ? err.message : undefined);
    } finally {
      setBusyId(null);
    }
  }

  function discountLabel(c: Coupon): string {
    if (c.discountType === "PERCENTAGE") return `${c.discountValue}% off`;
    if (c.discountType === "FREE_SHIPPING") return "Free shipping";
    const sign = c.currency === "USD" ? "$" : "₦";
    return `${sign}${(c.discountValue / 100).toLocaleString()} off`;
  }

  function channelLabel(c: Coupon): string {
    if (!c.applicableChannels || c.applicableChannels.length === 0)
      return "All channels";
    return c.applicableChannels
      .map((ch) =>
        ch === "STOREFRONT" ? "Web" : ch === "MOBILE" ? "App" : "POS",
      )
      .join(", ");
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">Promotions</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            {total} promotion{total === 1 ? "" : "s"} — coupons &amp; discounts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load(page)}
            className="btn-ghost"
            title="Refresh"
          >
            <RefreshCw size={15} />
          </button>
          <button onClick={openCreate} className="btn-primary">
            <Plus size={15} /> New Promotion
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="admin-card overflow-hidden">
        {loading ? (
          <div className="p-4">
            <SkeletonTable rows={6} cols={7} />
          </div>
        ) : coupons.length === 0 ? (
          <div className="py-20 text-center">
            <Ticket size={36} className="text-ink-700 mx-auto mb-3" />
            <p className="text-ink-500 text-sm">No promotions yet</p>
            <button onClick={openCreate} className="btn-primary mt-4">
              Create first promotion
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Discount</th>
                  <th>Channels</th>
                  <th>Usage</th>
                  <th>Window</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span className="font-mono text-xs font-semibold text-primary-400">
                        {c.code}
                      </span>
                      {c.description && (
                        <p className="text-[11px] text-ink-500 mt-0.5 max-w-[200px] truncate">
                          {c.description}
                        </p>
                      )}
                    </td>
                    <td className="text-sm text-ink-200">{discountLabel(c)}</td>
                    <td className="text-xs text-ink-400">{channelLabel(c)}</td>
                    <td className="text-xs text-ink-400 font-mono">
                      {c.timesUsed}
                      {c.usageLimit > 0 ? ` / ${c.usageLimit}` : ""}
                    </td>
                    <td className="text-[11px] text-ink-500 whitespace-nowrap">
                      {c.expiresAt
                        ? `until ${format(new Date(c.expiresAt), "d MMM yyyy")}`
                        : "no expiry"}
                    </td>
                    <td>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_STYLES[c.status]}`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleStatus(c)}
                          disabled={busyId === c.id || c.status === "EXPIRED"}
                          className="btn-ghost p-1.5"
                          title={
                            c.status === "ACTIVE" ? "Disable" : "Activate"
                          }
                        >
                          {busyId === c.id ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Power
                              size={13}
                              className={
                                c.status === "ACTIVE"
                                  ? "text-success"
                                  : "text-ink-500"
                              }
                            />
                          )}
                        </button>
                        <button
                          onClick={() => openEdit(c)}
                          className="btn-ghost p-1.5"
                          title="Edit"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(c)}
                          disabled={busyId === c.id}
                          className="btn-ghost p-1.5 text-ink-500 hover:text-danger"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
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

      {/* Create / Edit modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editTarget ? `Edit: ${editTarget.code}` : "New Promotion"}
        size="lg"
      >
        <CouponForm
          initial={editTarget ?? undefined}
          onSubmit={handleSave}
          loading={saving}
          onCancel={closeModal}
        />
      </Modal>
    </div>
  );
}

/**
 * Variant multi-picker. Lists every active product and its variants;
 * admin checks the variants this coupon should cover.
 *
 * Loads up to 200 products once on open. Search filters by product
 * name + variant SKU client-side for snappy UX.
 */
function VariantPickerModal({
  selected,
  onApply,
  onCancel,
}: {
  selected: string[];
  onApply: (ids: string[]) => void;
  onCancel: () => void;
}) {
  const { error } = useToast();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set(selected));
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    productsApi
      .list({ page: 1, limit: 200 })
      .then((res) => {
        if (!cancelled) setProducts(res.data.items);
      })
      .catch((e) => {
        error(
          "Could not load products",
          e instanceof Error ? e.message : undefined,
        );
      });
    return () => {
      cancelled = true;
    };
  }, [error]);

  function toggle(variantId: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(variantId)) next.delete(variantId);
      else next.add(variantId);
      return next;
    });
  }

  const filtered = (products ?? []).filter((p) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    if (p.name.toLowerCase().includes(q)) return true;
    return p.variants?.some(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.sku.toLowerCase().includes(q),
    );
  });

  return (
    <Modal
      open
      onClose={onCancel}
      title="Pick variants to scope the promotion"
      size="xl"
      footer={
        <>
          <button onClick={onCancel} className="btn-ghost">
            Cancel
          </button>
          <button
            onClick={() => onApply(Array.from(picked))}
            className="btn-primary"
          >
            Apply ({picked.size} selected)
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="relative">
          <Search
            size={12}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product, variant name, or SKU"
            className="admin-input pl-9"
          />
        </div>
        {!products ? (
          <p className="text-sm text-ink-400 py-8 text-center">
            <Loader2 className="inline animate-spin" size={14} /> Loading…
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-ink-400 py-8 text-center">
            No products match.
          </p>
        ) : (
          <div className="max-h-96 overflow-y-auto space-y-3">
            {filtered.map((p) => (
              <div
                key={p.id}
                className="border border-ink-700 rounded-lg overflow-hidden"
              >
                <div className="px-3 py-2 bg-ink-900/40 text-sm text-ink-200 font-medium">
                  {p.name}
                </div>
                <div className="divide-y divide-ink-800">
                  {(p.variants ?? []).map((v) => (
                    <label
                      key={v.id}
                      className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-ink-800/40 cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={picked.has(v.id)}
                          onChange={() => toggle(v.id)}
                          className="w-4 h-4 rounded accent-primary-600"
                        />
                        <div>
                          <div className="text-sm text-ink-100">{v.name}</div>
                          <div className="text-[11px] text-ink-500 font-mono">
                            {v.sku}
                          </div>
                        </div>
                      </div>
                      <div className="text-[11px] text-ink-500">
                        {v.isActive ? "active" : "inactive"}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
