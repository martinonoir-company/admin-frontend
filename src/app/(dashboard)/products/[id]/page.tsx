"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Edit2, Trash2, Loader2 } from "lucide-react";
import { productsApi, inventoryApi, formatNgn, formatUsd, Product, StockLevel } from "@/lib/api";
import { StatusBadge, BoolBadge } from "@/components/StatusBadge";
import { Skeleton, SkeletonCard } from "@/components/Skeleton";
import { useToast } from "@/lib/toast-context";
import { format } from "date-fns";
import Link from "next/link";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { success, error } = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [stockLevels, setStockLevels] = useState<Record<string, StockLevel>>({});
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await productsApi.get(id);
      setProduct(res.data);
      // Fetch stock levels for all variants
      const levels: Record<string, StockLevel> = {};
      await Promise.allSettled(
        res.data.variants.map(async (v) => {
          try {
            const sl = await inventoryApi.getLevel(v.id);
            levels[v.id] = sl.data;
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

  const totalStock = Object.values(stockLevels).reduce((s, l) => s + l.onHand, 0);
  const availableStock = Object.values(stockLevels).reduce((s, l) => s + (l.onHand - l.reserved), 0);

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
            <div className="px-5 py-4 border-b border-ink-700">
              <h2 className="text-sm font-semibold text-ink-300">Variants ({product.variants.length})</h2>
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
                  </tr>
                </thead>
                <tbody>
                  {product.variants.map((v) => {
                    const sl = stockLevels[v.id];
                    const avail = sl ? sl.onHand - sl.reserved : 0;
                    const isLow = sl && sl.onHand < 10;
                    return (
                      <tr key={v.id}>
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
    </div>
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
