"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, RefreshCw } from "lucide-react";
import { ordersApi, formatNgn, Order } from "@/lib/api";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { useToast } from "@/lib/toast-context";

/**
 * Wholesale Orders — a dedicated view of orders with at least one wholesale
 * line. Mirrors the main orders page but pins the wholesale filter on. Rows
 * open the standard order detail page (/orders/[id]).
 */
const STATUS_TABS: { label: string; value: string }[] = [
  { label: "All", value: "" },
  { label: "Pending", value: "PENDING_PAYMENT" },
  { label: "Paid", value: "PAID" },
  { label: "Processing", value: "PROCESSING" },
  { label: "Shipped", value: "SHIPPED" },
  { label: "Delivered", value: "DELIVERED" },
  { label: "Cancelled", value: "CANCELLED" },
];

export default function WholesaleOrdersPage() {
  const router = useRouter();
  const { error } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ordersApi.list({
        page,
        limit: pageSize,
        status: statusFilter || undefined,
        wholesale: true,
        search: searchInput.trim() || undefined,
      });
      setOrders(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      error("Failed to load wholesale orders", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, searchInput, error]);

  useEffect(() => { load(); }, [load]);

  const columns: ColumnDef<Order, unknown>[] = [
    {
      id: "orderNumber",
      header: "Order #",
      cell: ({ row }) => (
        <span className="font-mono text-xs font-bold text-primary-400">{row.original.orderNumber}</span>
      ),
    },
    {
      id: "customer",
      header: "Customer",
      cell: ({ row }) => {
        const addr = row.original.shippingAddress;
        const user = row.original.user;
        const name = addr
          ? `${addr.firstName} ${addr.lastName}`
          : user
          ? `${user.firstName} ${user.lastName}`
          : "—";
        return (
          <div>
            <p className="text-sm text-ink-200 font-medium">{name}</p>
            {user?.email && <p className="text-xs text-ink-500">{user.email}</p>}
          </div>
        );
      },
    },
    {
      id: "wholesaleItems",
      header: "Wholesale items",
      cell: ({ row }) => {
        const ws = (row.original.items ?? []).filter((i) => i.isWholesale);
        const units = ws.reduce((s, i) => s + (i.quantity ?? 0), 0);
        return (
          <span className="text-xs text-ink-400">
            {ws.length} line{ws.length !== 1 ? "s" : ""} · {units} units
          </span>
        );
      },
    },
    {
      id: "total",
      header: "Total",
      cell: ({ row }) => (
        <span className="font-mono text-sm font-semibold text-ink-200">
          {formatNgn(row.original.grandTotal ?? "0")}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "createdAt",
      header: "Date",
      cell: ({ row }) => (
        <span className="text-xs text-ink-500 whitespace-nowrap">
          {format(new Date(row.original.createdAt), "d MMM yyyy, HH:mm")}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">Wholesale Orders</h1>
          <p className="text-sm text-ink-500 mt-0.5">{total.toLocaleString()} wholesale orders</p>
        </div>
        <button onClick={load} className="btn-ghost" title="Refresh">
          <RefreshCw size={15} />
        </button>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setStatusFilter(tab.value); setPage(1); }}
            className={`shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              statusFilter === tab.value
                ? "bg-primary-700 text-white"
                : "text-ink-400 hover:text-ink-100 hover:bg-ink-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="admin-card p-4">
        <form
          onSubmit={(e) => { e.preventDefault(); setPage(1); load(); }}
          className="flex items-center gap-2 max-w-sm"
        >
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 pointer-events-none" />
            <input
              type="search"
              placeholder="Search by order number…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="admin-input pl-9"
            />
          </div>
          <button type="submit" className="btn-secondary px-3 py-2">
            <Search size={14} />
          </button>
        </form>
      </div>

      <div className="admin-card overflow-hidden">
        <DataTable
          data={orders}
          columns={columns}
          loading={loading}
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          onRowClick={(row) => router.push(`/orders/${row.id}`)}
          emptyMessage="No wholesale orders found."
        />
      </div>
    </div>
  );
}
