"use client";

import { useEffect, useState, useCallback } from "react";
import {
  RefreshCw, Package, TrendingUp, TrendingDown, RotateCcw,
  Loader2, ArrowUpDown, History, X,
} from "lucide-react";
import {
  productsApi, inventoryApi, formatNgn,
  Product, StockLevel, StockMovement, CreateMovementDto,
} from "@/lib/api";
import { Modal } from "@/components/Modal";
import { SkeletonTable } from "@/components/Skeleton";
import { useToast } from "@/lib/toast-context";
import { format } from "date-fns";

// ── Types ────────────────────────────────────────────────────

interface VariantRow {
  variantId: string;
  variantSku: string;
  variantName: string;
  productName: string;
  productId: string;
  retailPriceNgn: string;
  stockLevel: StockLevel | null;
  loadingStock: boolean;
}

const MOVEMENT_KIND_LABELS: Record<string, string> = {
  RECEIPT: "Receipt (Restock)",
  ADJUSTMENT: "Adjustment (Correction)",
  SALE: "Sale",
  RETURN: "Return",
  RESERVATION: "Reservation",
  RELEASE: "Release",
  TRANSFER_OUT: "Transfer Out",
  TRANSFER_IN: "Transfer In",
};

const MOVEMENT_KIND_COLORS: Record<string, string> = {
  RECEIPT: "text-success",
  ADJUSTMENT: "text-warning",
  SALE: "text-danger",
  RETURN: "text-primary-400",
  RESERVATION: "text-ink-400",
  RELEASE: "text-ink-400",
  TRANSFER_OUT: "text-orange-400",
  TRANSFER_IN: "text-success",
};

function stockColor(onHand: number | undefined) {
  if (onHand === undefined) return "text-ink-500";
  if (onHand < 10) return "text-danger font-bold";
  if (onHand < 25) return "text-warning font-semibold";
  return "text-ink-200";
}

function stockBadge(onHand: number | undefined) {
  if (onHand === undefined) return null;
  if (onHand < 10) return <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-danger/10 text-danger">critical</span>;
  if (onHand < 25) return <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-warning/10 text-warning">low</span>;
  return null;
}

// ── Adjustment Modal ─────────────────────────────────────────

function AdjustmentModal({
  row,
  onClose,
  onDone,
}: {
  row: VariantRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const { success, error } = useToast();
  const [kind, setKind] = useState<"RECEIPT" | "ADJUSTMENT">("RECEIPT");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [qtyError, setQtyError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qty = parseInt(quantity, 10);
    if (!quantity || isNaN(qty) || qty === 0) {
      setQtyError("Enter a non-zero quantity");
      return;
    }
    setQtyError("");
    setSaving(true);
    try {
      const dto: CreateMovementDto = {
        variantId: row.variantId,
        kind,
        quantity: qty,
        reason: reason.trim() || undefined,
      };
      await inventoryApi.createMovement(dto);
      success(
        "Stock adjusted",
        `${row.variantSku} — ${qty > 0 ? "+" : ""}${qty} units (${MOVEMENT_KIND_LABELS[kind]})`
      );
      onDone();
    } catch (err) {
      error("Failed to adjust stock", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Stock Adjustment"
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary px-4">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary px-5">
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : "Apply"}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Variant info */}
        <div className="p-3 rounded-lg bg-ink-700/50 border border-ink-600 space-y-1">
          <p className="text-xs font-semibold text-ink-200">{row.productName}</p>
          <p className="text-xs text-ink-400">{row.variantName}</p>
          <p className="font-mono text-[11px] text-ink-500">{row.variantSku}</p>
          {row.stockLevel && (
            <p className="text-xs text-ink-500 pt-1 border-t border-ink-600 mt-2">
              Current stock: <span className={`font-semibold ${stockColor(row.stockLevel.onHand)}`}>{row.stockLevel.onHand}</span>
              {" "}on hand, <span className="font-semibold text-ink-300">{row.stockLevel.onHand - row.stockLevel.reserved}</span> available
            </p>
          )}
        </div>

        {/* Movement kind */}
        <div>
          <label className="admin-label">Movement Type *</label>
          <div className="space-y-2">
            {(["RECEIPT", "ADJUSTMENT"] as const).map((k) => (
              <label key={k} className="flex items-start gap-3 p-3 rounded-lg border border-ink-600 cursor-pointer hover:border-primary-600 transition-colors">
                <input
                  type="radio"
                  name="kind"
                  value={k}
                  checked={kind === k}
                  onChange={() => setKind(k)}
                  className="accent-primary-600 mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium text-ink-200">{k === "RECEIPT" ? "Receipt" : "Adjustment"}</p>
                  <p className="text-xs text-ink-500">
                    {k === "RECEIPT"
                      ? "Add stock — use for incoming inventory, restocking"
                      : "Correct stock — use for damage, loss, or counting errors (use negative for reduction)"}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Quantity */}
        <div>
          <label className="admin-label">
            Quantity *{kind === "ADJUSTMENT" && <span className="text-ink-600 ml-1">(negative to remove)</span>}
          </label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="admin-input"
            placeholder={kind === "RECEIPT" ? "e.g. 50" : "e.g. -5 or 10"}
          />
          {qtyError && <p className="text-xs text-danger mt-1">{qtyError}</p>}
        </div>

        {/* Reason */}
        <div>
          <label className="admin-label">Reason (optional)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="admin-input resize-none"
            rows={2}
            placeholder="e.g. Supplier shipment PO-441, damaged in transit…"
          />
        </div>
      </form>
    </Modal>
  );
}

// ── Movement History Panel ───────────────────────────────────

function MovementHistory({ row, onClose }: { row: VariantRow; onClose: () => void }) {
  const { error } = useToast();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await inventoryApi.getMovements(row.variantId, 50);
        setMovements(res.data);
      } catch (err) {
        error("Failed to load movements", err instanceof Error ? err.message : undefined);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [row.variantId, error]);

  return (
    <Modal
      open
      onClose={onClose}
      title={`Movement History — ${row.variantSku}`}
      size="lg"
    >
      <div className="space-y-3">
        <div className="p-3 rounded-lg bg-ink-700/40 border border-ink-700">
          <p className="text-xs font-semibold text-ink-300">{row.productName} · {row.variantName}</p>
        </div>

        {loading ? (
          <SkeletonTable rows={5} cols={4} />
        ) : movements.length === 0 ? (
          <div className="py-12 text-center">
            <History size={32} className="text-ink-700 mx-auto mb-2" />
            <p className="text-sm text-ink-500">No movements recorded</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Qty</th>
                  <th>Reason</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <span className={`text-xs font-semibold ${MOVEMENT_KIND_COLORS[m.kind] ?? "text-ink-400"}`}>
                        {MOVEMENT_KIND_LABELS[m.kind] ?? m.kind}
                      </span>
                    </td>
                    <td>
                      <span className={`font-mono text-sm font-bold ${m.quantity > 0 ? "text-success" : "text-danger"}`}>
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                      </span>
                    </td>
                    <td className="text-xs text-ink-500 max-w-[200px] truncate">
                      {m.reason || <span className="text-ink-700">—</span>}
                    </td>
                    <td className="text-xs text-ink-500 whitespace-nowrap">
                      {format(new Date(m.createdAt), "d MMM yyyy, HH:mm")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Main Page ────────────────────────────────────────────────

export default function InventoryPage() {
  const { error } = useToast();
  const [rows, setRows] = useState<VariantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filterLow, setFilterLow] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<VariantRow | null>(null);
  const [historyTarget, setHistoryTarget] = useState<VariantRow | null>(null);
  const [sortField, setSortField] = useState<"sku" | "onHand" | "available">("onHand");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const loadInventory = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      // Fetch all products (up to 200)
      const res = await productsApi.list({ limit: 200, isActive: undefined });
      const products: Product[] = res.data.items;

      const allRows: VariantRow[] = [];
      for (const product of products) {
        for (const variant of product.variants) {
          allRows.push({
            variantId: variant.id,
            variantSku: variant.sku,
            variantName: variant.name,
            productName: product.name,
            productId: product.id,
            retailPriceNgn: variant.retailPriceNgn,
            stockLevel: null,
            loadingStock: true,
          });
        }
      }
      setRows(allRows);

      // Fetch stock levels in parallel (batched)
      const BATCH = 10;
      for (let i = 0; i < allRows.length; i += BATCH) {
        const batch = allRows.slice(i, i + BATCH);
        const results = await Promise.allSettled(
          batch.map((row) => inventoryApi.getLevel(row.variantId))
        );
        setRows((prev) => {
          const next = [...prev];
          batch.forEach((row, j) => {
            const idx = next.findIndex((r) => r.variantId === row.variantId);
            if (idx === -1) return;
            const result = results[j];
            next[idx] = {
              ...next[idx],
              stockLevel: result.status === "fulfilled" ? result.value.data : null,
              loadingStock: false,
            };
          });
          return next;
        });
      }
    } catch (err) {
      error("Failed to load inventory", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [error]);

  useEffect(() => { loadInventory(); }, [loadInventory]);

  function toggleSort(field: typeof sortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  }

  // Filtered + sorted rows
  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      r.variantSku.toLowerCase().includes(q) ||
      r.variantName.toLowerCase().includes(q) ||
      r.productName.toLowerCase().includes(q);
    const matchLow = !filterLow || (r.stockLevel ? r.stockLevel.onHand < 25 : false);
    return matchSearch && matchLow;
  });

  const sorted = [...filtered].sort((a, b) => {
    let av: number, bv: number;
    if (sortField === "sku") {
      return sortDir === "asc"
        ? a.variantSku.localeCompare(b.variantSku)
        : b.variantSku.localeCompare(a.variantSku);
    }
    if (sortField === "onHand") {
      av = a.stockLevel?.onHand ?? -1;
      bv = b.stockLevel?.onHand ?? -1;
    } else {
      av = a.stockLevel ? a.stockLevel.onHand - a.stockLevel.reserved : -1;
      bv = b.stockLevel ? b.stockLevel.onHand - b.stockLevel.reserved : -1;
    }
    return sortDir === "asc" ? av - bv : bv - av;
  });

  // Stats
  const totalVariants = rows.length;
  const criticalCount = rows.filter((r) => r.stockLevel && r.stockLevel.onHand < 10).length;
  const lowCount = rows.filter((r) => r.stockLevel && r.stockLevel.onHand >= 10 && r.stockLevel.onHand < 25).length;
  const totalUnits = rows.reduce((s, r) => s + (r.stockLevel?.onHand ?? 0), 0);

  function SortIcon({ field }: { field: typeof sortField }) {
    if (sortField !== field) return <ArrowUpDown size={12} className="text-ink-600 ml-1" />;
    return sortDir === "asc"
      ? <TrendingUp size={12} className="text-primary-400 ml-1" />
      : <TrendingDown size={12} className="text-primary-400 ml-1" />;
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">Inventory</h1>
          <p className="text-sm text-ink-500 mt-0.5">{totalVariants} variants tracked</p>
        </div>
        <button
          onClick={() => loadInventory(true)}
          disabled={refreshing}
          className="btn-ghost"
          title="Refresh"
        >
          <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="admin-card p-4 space-y-1">
          <p className="text-xs text-ink-500">Total Variants</p>
          <p className="text-2xl font-bold font-mono text-ink-100">{totalVariants}</p>
        </div>
        <div className="admin-card p-4 space-y-1">
          <p className="text-xs text-ink-500">Total Units</p>
          <p className="text-2xl font-bold font-mono text-ink-100">{totalUnits.toLocaleString()}</p>
        </div>
        <div className="admin-card p-4 space-y-1">
          <p className="text-xs text-ink-500">Low Stock</p>
          <p className={`text-2xl font-bold font-mono ${lowCount > 0 ? "text-warning" : "text-ink-100"}`}>{lowCount}</p>
          <p className="text-[11px] text-ink-600">10–24 units</p>
        </div>
        <div className="admin-card p-4 space-y-1">
          <p className="text-xs text-ink-500">Critical Stock</p>
          <p className={`text-2xl font-bold font-mono ${criticalCount > 0 ? "text-danger" : "text-ink-100"}`}>{criticalCount}</p>
          <p className="text-[11px] text-ink-600">&lt;10 units</p>
        </div>
      </div>

      {/* Filters */}
      <div className="admin-card p-4 flex items-center gap-3 flex-wrap">
        <input
          type="search"
          placeholder="Search SKU, variant, or product…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="admin-input max-w-xs"
        />
        <button
          onClick={() => setFilterLow((v) => !v)}
          className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
            filterLow
              ? "bg-warning/10 border-warning/40 text-warning"
              : "border-ink-600 text-ink-400 hover:border-ink-500 hover:text-ink-200"
          }`}
        >
          {filterLow ? <X size={12} className="inline mr-1" /> : null}
          Low stock only
        </button>
        {(search || filterLow) && (
          <span className="text-xs text-ink-500">{sorted.length} result{sorted.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Table */}
      <div className="admin-card overflow-hidden">
        {loading ? (
          <div className="p-4"><SkeletonTable rows={8} cols={7} /></div>
        ) : sorted.length === 0 ? (
          <div className="py-20 text-center">
            <Package size={36} className="text-ink-700 mx-auto mb-3" />
            <p className="text-sm text-ink-500">No variants found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Product / Variant</th>
                  <th>
                    <button onClick={() => toggleSort("sku")} className="flex items-center">
                      SKU <SortIcon field="sku" />
                    </button>
                  </th>
                  <th>Price</th>
                  <th>
                    <button onClick={() => toggleSort("onHand")} className="flex items-center">
                      On Hand <SortIcon field="onHand" />
                    </button>
                  </th>
                  <th>Reserved</th>
                  <th>
                    <button onClick={() => toggleSort("available")} className="flex items-center">
                      Available <SortIcon field="available" />
                    </button>
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => {
                  const available = row.stockLevel
                    ? row.stockLevel.onHand - row.stockLevel.reserved
                    : null;
                  return (
                    <tr key={row.variantId}>
                      <td>
                        <div>
                          <p className="text-xs font-semibold text-ink-300 leading-tight">{row.productName}</p>
                          <p className="text-[11px] text-ink-500 mt-0.5">{row.variantName}</p>
                        </div>
                      </td>
                      <td className="font-mono text-xs text-ink-400">{row.variantSku}</td>
                      <td className="font-mono text-xs text-ink-400">{formatNgn(row.retailPriceNgn)}</td>
                      <td>
                        {row.loadingStock ? (
                          <span className="text-xs text-ink-600 animate-pulse">…</span>
                        ) : row.stockLevel ? (
                          <span className={`font-mono text-sm ${stockColor(row.stockLevel.onHand)}`}>
                            {row.stockLevel.onHand}
                            {stockBadge(row.stockLevel.onHand)}
                          </span>
                        ) : (
                          <span className="text-xs text-ink-600">—</span>
                        )}
                      </td>
                      <td className="font-mono text-xs text-ink-500">
                        {row.stockLevel ? row.stockLevel.reserved : "—"}
                      </td>
                      <td>
                        {available !== null ? (
                          <span className={`font-mono text-sm ${stockColor(available)}`}>{available}</span>
                        ) : (
                          <span className="text-xs text-ink-600">—</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setAdjustTarget(row)}
                            className="btn-ghost p-1.5 text-ink-400 hover:text-primary-400"
                            title="Adjust stock"
                          >
                            <RotateCcw size={13} />
                          </button>
                          <button
                            onClick={() => setHistoryTarget(row)}
                            className="btn-ghost p-1.5 text-ink-400 hover:text-primary-400"
                            title="View movements"
                          >
                            <History size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Adjustment modal */}
      {adjustTarget && (
        <AdjustmentModal
          row={adjustTarget}
          onClose={() => setAdjustTarget(null)}
          onDone={() => {
            setAdjustTarget(null);
            loadInventory(true);
          }}
        />
      )}

      {/* History modal */}
      {historyTarget && (
        <MovementHistory
          row={historyTarget}
          onClose={() => setHistoryTarget(null)}
        />
      )}
    </div>
  );
}
