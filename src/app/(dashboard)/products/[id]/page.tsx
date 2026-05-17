"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Edit2, Trash2, Loader2, Plus, X, Power } from "lucide-react";
import {
  productsApi,
  inventoryApi,
  formatNgn,
  formatUsd,
  Product,
  StockLevel,
  AddVariantDto,
  UpdateVariantDto,
} from "@/lib/api";
import { StatusBadge, BoolBadge } from "@/components/StatusBadge";
import { Skeleton, SkeletonCard } from "@/components/Skeleton";
import { MediaGallery } from "@/components/MediaGallery";
import { Modal } from "@/components/Modal";
import { useToast } from "@/lib/toast-context";
import { format } from "date-fns";
import Link from "next/link";

// Helper: variant rows store prices as MINOR units (kobo/cents) on the
// server, but the form works in MAJOR units. Bridge functions go through
// /100 and *100. Hold them at the top so the editor + parent page share
// the same number formatting.
function minorToMajor(minor: string | number | undefined | null): string {
  if (minor === undefined || minor === null || minor === "") return "";
  const n = typeof minor === "string" ? parseInt(minor, 10) : minor;
  if (isNaN(n)) return "";
  return (n / 100).toString();
}
function majorToMinor(major: string): number | undefined {
  if (!major || !major.trim()) return undefined;
  const n = Number(major);
  if (isNaN(n) || n < 0) return undefined;
  return Math.round(n * 100);
}

/** Flat sales-tax rate the server adds to selling prices on variant create. */
const SALES_TAX_RATE = 0.075;

/**
 * Preview the tax-inclusive price for an entered selling price.
 * Returns "" when the input is empty/invalid so no hint is shown.
 */
function taxInclusivePreview(entered: string): string {
  const n = parseFloat(entered);
  if (!Number.isFinite(n) || n <= 0) return "";
  return (n * (1 + SALES_TAX_RATE)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { success, error } = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [stockLevels, setStockLevels] = useState<Record<string, StockLevel>>({});
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  // Variant editor state — null when no modal is open; "new" for add,
  // or the variant id for an edit-in-place.
  const [editingVariant, setEditingVariant] = useState<string | "new" | null>(
    null,
  );
  /** Variant id currently being deactivated / reactivated (for spinner). */
  const [togglingVariant, setTogglingVariant] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await productsApi.get(id);
      setProduct(res.data);
      // Fetch stock levels for all variants. The API returns null when
      // no stock-level row exists yet for that variant (the common case
      // immediately after a product is created), so we skip those
      // instead of storing null in the map.
      const levels: Record<string, StockLevel> = {};
      await Promise.allSettled(
        res.data.variants.map(async (v) => {
          try {
            const sl = await inventoryApi.getLevel(v.id);
            if (sl.data) {
              levels[v.id] = sl.data;
            }
          } catch { /* no stock data */ }
        })
      );
      setStockLevels(levels);
    } catch (err) {
      error("Failed to load product", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [id, error]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete() {
    if (!product) return;
    if (!confirm(`Delete "${product.name}"? This action can be undone.`)) return;
    setDeleting(true);
    try {
      await productsApi.delete(id);
      success("Product deleted", `"${product.name}" has been removed.`);
      router.push("/products");
    } catch (err) {
      error("Failed to delete product", err instanceof Error ? err.message : undefined);
      setDeleting(false);
    }
  }

  /**
   * Flip a variant's active state.
   *  - Deactivate → POST DELETE /products/:p/variants/:v (server treats
   *    delete as deactivate). 409 LAST_ACTIVE_VARIANT comes back if it's
   *    the only active variant on the product — we surface that as a
   *    toast instead of treating it as a generic failure.
   *  - Reactivate → PATCH /products/:p/variants/:v with { isActive: true }.
   */
  async function handleToggleVariantActive(
    variantId: string,
    nextActive: boolean,
  ) {
    if (!product) return;
    setTogglingVariant(variantId);
    try {
      if (nextActive) {
        await productsApi.updateVariant(id, variantId, { isActive: true });
        success("Variant reactivated", "Now visible on storefront and POS.");
      } else {
        await productsApi.deactivateVariant(id, variantId);
        success("Variant deactivated", "Hidden from storefront and POS.");
      }
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : undefined;
      if (msg && /last active|LAST_ACTIVE_VARIANT/i.test(msg)) {
        error(
          "Can't deactivate the last variant",
          "Activate another variant first, or deactivate the whole product.",
        );
      } else {
        error("Failed to update variant", msg);
      }
    } finally {
      setTogglingVariant(null);
    }
  }

  /** Called by the editor modal after a successful add/save. */
  async function handleVariantSaved() {
    setEditingVariant(null);
    await load();
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <Skeleton width={36} height={36} />
          <div className="space-y-2"><Skeleton width={200} height={24} /><Skeleton width={120} height={14} /></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5"><SkeletonCard lines={6} /><SkeletonCard lines={4} /></div>
          <div className="space-y-5"><SkeletonCard lines={3} /><SkeletonCard lines={3} /></div>
        </div>
      </div>
    );
  }

  if (!product) return null;

  // Defensive: filter falsy values before reducing. A variant with no
  // stock-level row contributes 0, not a NaN/null-deref.
  const stockRows = Object.values(stockLevels).filter(
    (l): l is StockLevel => l != null,
  );
  const totalStock = stockRows.reduce((s, l) => s + (l.onHand ?? 0), 0);
  const availableStock = stockRows.reduce(
    (s, l) => s + ((l.onHand ?? 0) - (l.reserved ?? 0)),
    0,
  );

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/products" className="btn-ghost p-2">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-ink-100">{product.name}</h1>
              <BoolBadge value={product.isActive} />
              {product.isFeatured && <StatusBadge status="featured" label="Featured" />}
            </div>
            <p className="text-xs text-ink-500 mt-0.5 font-mono">{product.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/products/${id}/edit`} className="btn-secondary">
            <Edit2 size={14} /> Edit
          </Link>
          <button onClick={handleDelete} disabled={deleting} className="btn-danger">
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main */}
        <div className="lg:col-span-2 space-y-5">
          {/* Media */}
          <MediaGallery productId={id} initialMedia={product.media ?? []} />

          {/* Description */}
          <div className="admin-card p-5">
            <h2 className="text-sm font-semibold text-ink-300 mb-3">Description</h2>
            <p className="text-sm text-ink-400 leading-relaxed">{product.description || "—"}</p>
            {product.shortDescription && (
              <div className="mt-3 pt-3 border-t border-ink-700">
                <p className="text-xs font-semibold text-ink-500 mb-1 uppercase tracking-wider">Short Description</p>
                <p className="text-sm text-ink-400">{product.shortDescription}</p>
              </div>
            )}
          </div>

          {/* Variants */}
          <div className="admin-card overflow-hidden">
            <div className="px-5 py-4 border-b border-ink-700 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-ink-300">
                Variants ({product.variants.length})
              </h2>
              <button
                onClick={() => setEditingVariant("new")}
                className="btn-primary px-3 py-1.5 text-xs"
              >
                <Plus size={14} className="inline mr-1" /> Add variant
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>SKU</th>
                    <th>Retail (NGN)</th>
                    <th>Retail (USD)</th>
                    <th>Wholesale (NGN)</th>
                    <th>On Hand</th>
                    <th>Available</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {product.variants.map((v) => {
                    const sl = stockLevels[v.id];
                    const avail = sl ? sl.onHand - sl.reserved : 0;
                    const isLow = sl && sl.onHand < 10;
                    const toggling = togglingVariant === v.id;
                    return (
                      <tr key={v.id} className={v.isActive ? "" : "opacity-60"}>
                        <td className="font-medium text-ink-200">{v.name}</td>
                        <td className="font-mono text-xs text-ink-400">{v.sku}</td>
                        <td className="font-mono text-sm text-ink-200">{formatNgn(v.retailPriceNgn)}</td>
                        <td className="font-mono text-sm text-ink-400">{formatUsd(v.retailPriceUsd)}</td>
                        <td className="font-mono text-sm text-ink-400">{formatNgn(v.wholesalePriceNgn)}</td>
                        <td>
                          <span className={`font-mono text-sm font-semibold ${isLow ? "text-warning" : "text-ink-200"}`}>
                            {sl?.onHand ?? "—"}
                          </span>
                          {isLow && <span className="ml-1.5 text-[10px] text-warning">(low)</span>}
                        </td>
                        <td className="font-mono text-sm text-ink-400">{sl ? avail : "—"}</td>
                        <td><BoolBadge value={v.isActive} /></td>
                        <td className="text-right whitespace-nowrap">
                          <button
                            onClick={() => setEditingVariant(v.id)}
                            className="btn-ghost px-2 py-1 text-xs"
                            title="Edit variant"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() =>
                              handleToggleVariantActive(v.id, !v.isActive)
                            }
                            disabled={toggling}
                            className="btn-ghost px-2 py-1 text-xs ml-1"
                            title={v.isActive ? "Deactivate" : "Reactivate"}
                          >
                            {toggling ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Power size={13} className={v.isActive ? "text-warning" : "text-success"} />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Summary */}
          <div className="admin-card p-5 space-y-3">
            <h2 className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Details</h2>
            <div className="space-y-2.5">
              <Row label="Category" value={product.category?.name ?? "Uncategorised"} />
              <Row label="Variants" value={product.variants.length} />
              <Row label="Total Stock" value={totalStock} />
              <Row label="Available" value={availableStock} />
              {product.tags?.length > 0 && (
                <div>
                  <p className="text-xs text-ink-500 mb-1.5">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {product.tags.map((t) => (
                      <span key={t} className="px-2 py-0.5 bg-ink-700 rounded-full text-[11px] text-ink-300">{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Dates */}
          <div className="admin-card p-5 space-y-3">
            <h2 className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Timestamps</h2>
            <Row label="Created" value={format(new Date(product.createdAt), "d MMM yyyy, HH:mm")} />
            <Row label="Updated" value={format(new Date(product.updatedAt), "d MMM yyyy, HH:mm")} />
          </div>

          {/* SEO */}
          {(product.metaTitle || product.metaDescription) && (
            <div className="admin-card p-5 space-y-3">
              <h2 className="text-xs font-semibold text-ink-400 uppercase tracking-wider">SEO</h2>
              {product.metaTitle && <Row label="Meta Title" value={product.metaTitle} />}
              {product.metaDescription && (
                <div>
                  <p className="text-xs text-ink-500 mb-1">Meta Description</p>
                  <p className="text-xs text-ink-300 leading-relaxed">{product.metaDescription}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Variant editor modal (add or edit) */}
      {editingVariant && (
        <VariantEditorModal
          productId={id}
          variant={
            editingVariant === "new"
              ? null
              : product.variants.find((v) => v.id === editingVariant) ?? null
          }
          onClose={() => setEditingVariant(null)}
          onSaved={handleVariantSaved}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// VariantEditorModal — add a new variant OR edit an existing one
// ─────────────────────────────────────────────────────────────

interface VariantFormState {
  name: string;
  sku: string;
  retailPriceNgn: string;
  retailPriceUsd: string;
  wholesalePriceNgn: string;
  wholesalePriceUsd: string;
  compareAtPriceNgn: string;
  compareAtPriceUsd: string;
  costPriceNgn: string;
  weightKg: string;
  barcode: string;
  isActive: boolean;
  trackInventory: boolean;
  options: { key: string; value: string }[];
}

function emptyForm(): VariantFormState {
  return {
    name: "",
    sku: "",
    retailPriceNgn: "",
    retailPriceUsd: "",
    wholesalePriceNgn: "",
    wholesalePriceUsd: "",
    compareAtPriceNgn: "",
    compareAtPriceUsd: "",
    costPriceNgn: "",
    weightKg: "",
    barcode: "",
    isActive: true,
    trackInventory: true,
    options: [],
  };
}

function VariantEditorModal({
  productId,
  variant,
  onClose,
  onSaved,
}: {
  productId: string;
  variant: Product["variants"][number] | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { success, error } = useToast();
  const isNew = variant === null;
  const [form, setForm] = useState<VariantFormState>(() =>
    variant
      ? {
          name: variant.name ?? "",
          sku: variant.sku ?? "",
          retailPriceNgn: minorToMajor(variant.retailPriceNgn),
          retailPriceUsd: minorToMajor(variant.retailPriceUsd),
          wholesalePriceNgn: minorToMajor(variant.wholesalePriceNgn),
          wholesalePriceUsd: minorToMajor(variant.wholesalePriceUsd),
          compareAtPriceNgn: minorToMajor(variant.compareAtPriceNgn),
          compareAtPriceUsd: minorToMajor(variant.compareAtPriceUsd),
          costPriceNgn: minorToMajor(variant.costPriceNgn),
          weightKg: variant.weightKg?.toString() ?? "",
          barcode: variant.barcode ?? "",
          isActive: variant.isActive,
          trackInventory: variant.trackInventory,
          options: variant.options
            ? Object.entries(variant.options).map(([key, value]) => ({ key, value }))
            : [],
        }
      : emptyForm(),
  );
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function setField<K extends keyof VariantFormState>(
    key: K,
    val: VariantFormState[K],
  ) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function setOption(i: number, key: "key" | "value", val: string) {
    setForm((f) => ({
      ...f,
      options: f.options.map((o, idx) => (idx === i ? { ...o, [key]: val } : o)),
    }));
  }

  function addOption() {
    setForm((f) => ({ ...f, options: [...f.options, { key: "", value: "" }] }));
  }

  function removeOption(i: number) {
    setForm((f) => ({ ...f, options: f.options.filter((_, idx) => idx !== i) }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Variant name is required";
    const r1 = Number(form.retailPriceNgn);
    if (!form.retailPriceNgn || isNaN(r1) || r1 <= 0)
      e.retailPriceNgn = "Valid retail NGN price required";
    const r2 = Number(form.retailPriceUsd);
    if (!form.retailPriceUsd || isNaN(r2) || r2 <= 0)
      e.retailPriceUsd = "Valid retail USD price required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);

    // Build the options map, dropping rows where key or value is blank.
    const options: Record<string, string> = {};
    for (const o of form.options) {
      if (o.key.trim() && o.value.trim()) {
        options[o.key.trim()] = o.value.trim();
      }
    }

    try {
      if (isNew) {
        const dto: AddVariantDto = {
          name: form.name.trim(),
          // Send undefined when blank so the server auto-generates the SKU.
          sku: form.sku.trim() || undefined,
          retailPriceNgn: majorToMinor(form.retailPriceNgn)!,
          retailPriceUsd: majorToMinor(form.retailPriceUsd)!,
          wholesalePriceNgn: majorToMinor(form.wholesalePriceNgn),
          wholesalePriceUsd: majorToMinor(form.wholesalePriceUsd),
          compareAtPriceNgn: majorToMinor(form.compareAtPriceNgn),
          compareAtPriceUsd: majorToMinor(form.compareAtPriceUsd),
          costPriceNgn: majorToMinor(form.costPriceNgn),
          weightKg: form.weightKg ? Number(form.weightKg) : undefined,
          barcode: form.barcode.trim() || undefined,
          isActive: form.isActive,
          trackInventory: form.trackInventory,
          options: Object.keys(options).length > 0 ? options : undefined,
        };
        await productsApi.addVariant(productId, dto);
        success("Variant added", "The new variant is live on this product.");
      } else if (variant) {
        const dto: UpdateVariantDto = {
          name: form.name.trim(),
          sku: form.sku.trim() || undefined,
          retailPriceNgn: majorToMinor(form.retailPriceNgn),
          retailPriceUsd: majorToMinor(form.retailPriceUsd),
          wholesalePriceNgn: majorToMinor(form.wholesalePriceNgn),
          wholesalePriceUsd: majorToMinor(form.wholesalePriceUsd),
          compareAtPriceNgn: majorToMinor(form.compareAtPriceNgn),
          compareAtPriceUsd: majorToMinor(form.compareAtPriceUsd),
          costPriceNgn: majorToMinor(form.costPriceNgn),
          weightKg: form.weightKg ? Number(form.weightKg) : undefined,
          barcode: form.barcode.trim() || undefined,
          isActive: form.isActive,
          trackInventory: form.trackInventory,
          options: Object.keys(options).length > 0 ? options : undefined,
        };
        await productsApi.updateVariant(productId, variant.id, dto);
        success("Variant updated", "Changes saved.");
      }
      onSaved();
    } catch (err) {
      error(
        isNew ? "Failed to add variant" : "Failed to update variant",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? "Add Variant" : `Edit Variant — ${variant?.name ?? ""}`}
      size="xl"
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button
            type="submit"
            form="variant-form"
            disabled={saving}
            className="btn-primary"
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Saving…
              </>
            ) : isNew ? (
              "Create variant"
            ) : (
              "Save changes"
            )}
          </button>
        </>
      }
    >
      <form id="variant-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="admin-label">Variant name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              className="admin-input"
              placeholder="e.g. Classic Black, Medium"
            />
            {errors.name && (
              <p className="text-xs text-danger mt-1">{errors.name}</p>
            )}
          </div>
          <div>
            <label className="admin-label">SKU</label>
            <input
              type="text"
              value={form.sku}
              onChange={(e) => setField("sku", e.target.value)}
              className="admin-input font-mono"
              placeholder={isNew ? "Auto-generate" : ""}
            />
            <p className="text-xs text-ink-500 mt-1">
              {isNew
                ? "Leave blank for an auto-generated SKU."
                : "Editing the SKU is allowed but rare."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="admin-label">Retail price NGN *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.retailPriceNgn}
              onChange={(e) => setField("retailPriceNgn", e.target.value)}
              className="admin-input"
            />
            {errors.retailPriceNgn && (
              <p className="text-xs text-danger mt-1">{errors.retailPriceNgn}</p>
            )}
            {isNew && taxInclusivePreview(form.retailPriceNgn) && (
              <p className="text-xs text-primary-400 mt-1">
                Customer pays ₦{taxInclusivePreview(form.retailPriceNgn)} (incl. 7.5% tax)
              </p>
            )}
          </div>
          <div>
            <label className="admin-label">Retail price USD *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.retailPriceUsd}
              onChange={(e) => setField("retailPriceUsd", e.target.value)}
              className="admin-input"
            />
            {errors.retailPriceUsd && (
              <p className="text-xs text-danger mt-1">{errors.retailPriceUsd}</p>
            )}
            {isNew && taxInclusivePreview(form.retailPriceUsd) && (
              <p className="text-xs text-primary-400 mt-1">
                Customer pays ${taxInclusivePreview(form.retailPriceUsd)} (incl. 7.5% tax)
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="admin-label">Wholesale price NGN</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.wholesalePriceNgn}
              onChange={(e) => setField("wholesalePriceNgn", e.target.value)}
              className="admin-input"
              placeholder="Defaults to retail"
            />
            {isNew && taxInclusivePreview(form.wholesalePriceNgn) && (
              <p className="text-xs text-primary-400 mt-1">
                Stored as ₦{taxInclusivePreview(form.wholesalePriceNgn)} (incl. 7.5% tax)
              </p>
            )}
          </div>
          <div>
            <label className="admin-label">Wholesale price USD</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.wholesalePriceUsd}
              onChange={(e) => setField("wholesalePriceUsd", e.target.value)}
              className="admin-input"
              placeholder="Defaults to retail"
            />
            {isNew && taxInclusivePreview(form.wholesalePriceUsd) && (
              <p className="text-xs text-primary-400 mt-1">
                Stored as ${taxInclusivePreview(form.wholesalePriceUsd)} (incl. 7.5% tax)
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="admin-label">Compare-at NGN</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.compareAtPriceNgn}
              onChange={(e) => setField("compareAtPriceNgn", e.target.value)}
              className="admin-input"
              placeholder="(optional)"
            />
          </div>
          <div>
            <label className="admin-label">Compare-at USD</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.compareAtPriceUsd}
              onChange={(e) => setField("compareAtPriceUsd", e.target.value)}
              className="admin-input"
              placeholder="(optional)"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="admin-label">Cost price NGN</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.costPriceNgn}
              onChange={(e) => setField("costPriceNgn", e.target.value)}
              className="admin-input"
              placeholder="(optional)"
            />
          </div>
          <div>
            <label className="admin-label">Weight (kg)</label>
            <input
              type="number"
              min="0"
              step="0.001"
              value={form.weightKg}
              onChange={(e) => setField("weightKg", e.target.value)}
              className="admin-input"
              placeholder="(optional)"
            />
          </div>
          <div>
            <label className="admin-label">Barcode</label>
            <input
              type="text"
              value={form.barcode}
              onChange={(e) => setField("barcode", e.target.value)}
              className="admin-input font-mono"
              placeholder="(optional)"
            />
          </div>
        </div>

        {/* Options (size, color, etc.) */}
        <fieldset className="border border-ink-700 rounded-md p-3 space-y-2">
          <legend className="text-xs font-semibold text-ink-300 px-1">
            Options (size, colour, etc.)
          </legend>
          {form.options.length === 0 ? (
            <p className="text-xs text-ink-500">
              No options set. Add one for variant traits like Size or Colour.
            </p>
          ) : (
            form.options.map((o, i) => (
              <div key={i} className="grid grid-cols-[1fr,1fr,auto] gap-2">
                <input
                  type="text"
                  value={o.key}
                  onChange={(e) => setOption(i, "key", e.target.value)}
                  className="admin-input"
                  placeholder="Key (e.g. Size)"
                />
                <input
                  type="text"
                  value={o.value}
                  onChange={(e) => setOption(i, "value", e.target.value)}
                  className="admin-input"
                  placeholder="Value (e.g. Medium)"
                />
                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  className="btn-ghost px-2"
                  title="Remove option"
                >
                  <X size={14} />
                </button>
              </div>
            ))
          )}
          <button
            type="button"
            onClick={addOption}
            className="btn-ghost text-xs"
          >
            <Plus size={12} className="inline mr-1" /> Add option
          </button>
        </fieldset>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-ink-200 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setField("isActive", e.target.checked)}
              className="h-4 w-4 accent-primary-500"
            />
            Active
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-200 cursor-pointer">
            <input
              type="checkbox"
              checked={form.trackInventory}
              onChange={(e) => setField("trackInventory", e.target.checked)}
              className="h-4 w-4 accent-primary-500"
            />
            Track inventory
          </label>
        </div>
      </form>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-ink-500">{label}</span>
      <span className="text-xs text-ink-200 font-medium text-right">{value}</span>
    </div>
  );
}
