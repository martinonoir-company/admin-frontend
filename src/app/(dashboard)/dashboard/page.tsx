"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  DollarSign,
  ShoppingCart,
  Package,
  AlertTriangle,
  ArrowRight,
  Plus,
} from "lucide-react";
import { productsApi, ordersApi, inventoryApi, formatNgn, Order } from "@/lib/api";
import { KpiCard } from "@/components/KpiCard";
import { StatusBadge } from "@/components/StatusBadge";
import { SkeletonTable } from "@/components/Skeleton";
import { format } from "date-fns";
import Link from "next/link";

interface DashboardData {
  totalRevenue: number;
  ordersToday: number;
  totalOrders: number;
  productsCount: number;
  lowStockCount: number;
  recentOrders: Order[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch in parallel
      const [ordersRes, productsRes] = await Promise.all([
        ordersApi.list({ limit: 50, page: 1 }),
        productsApi.list({ limit: 100, page: 1 }),
      ]);

      const allOrders = ordersRes.data.items;
      const totalOrders = ordersRes.data.total;
      const products = productsRes.data.items;
      const totalProducts = productsRes.data.total;

      // Revenue: sum grandTotal of completed/delivered/paid orders
      const revenueOrders = allOrders.filter((o) =>
        ["COMPLETED", "DELIVERED", "SHIPPED", "PAID", "PROCESSING"].includes(o.status)
      );
      const totalRevenue = revenueOrders.reduce(
        (sum, o) => sum + parseFloat(o.grandTotal ?? "0"),
        0
      );

      // Orders today
      const today = new Date().toDateString();
      const ordersToday = allOrders.filter(
        (o) => new Date(o.createdAt).toDateString() === today
      ).length;

      // Low stock: fetch all variant stock levels
      const allVariants = products.flatMap((p) =>
        p.variants.map((v) => ({ ...v, productName: p.name }))
      );
      let lowStockCount = 0;
      // Sample up to 20 variants to avoid too many parallel requests
      const sample = allVariants.slice(0, 20);
      const levels = await Promise.allSettled(
        sample.map((v) => inventoryApi.getLevel(v.id))
      );
      levels.forEach((r) => {
        if (r.status === "fulfilled" && r.value.data.onHand < 10) lowStockCount++;
      });

      const recentOrders = allOrders.slice(0, 10);

      setData({ totalRevenue, ordersToday, totalOrders, productsCount: totalProducts, lowStockCount, recentOrders });
    } catch {
      // Use partial data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const kpiLoading = loading;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">Dashboard</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            {new Date().toLocaleDateString("en-NG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/products/new" className="btn-primary">
            <Plus size={15} />
            Add Product
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Revenue"
          value={data ? formatNgn(data.totalRevenue * 100) : "—"}
          subtitle="From paid orders"
          icon={DollarSign}
          iconColor="text-[#C9A96E]"
          iconBg="bg-[#C9A96E]/10"
          loading={kpiLoading}
        />
        <KpiCard
          title="Orders Today"
          value={data?.ordersToday ?? "—"}
          subtitle={`${data?.totalOrders ?? "—"} total orders`}
          icon={ShoppingCart}
          iconColor="text-primary-400"
          iconBg="bg-primary-700/15"
          loading={kpiLoading}
        />
        <KpiCard
          title="Products"
          value={data?.productsCount ?? "—"}
          subtitle="In catalogue"
          icon={Package}
          iconColor="text-primary-300"
          iconBg="bg-primary-600/15"
          loading={kpiLoading}
        />
        <KpiCard
          title="Low Stock"
          value={data?.lowStockCount ?? "—"}
          subtitle="Variants below 10 units"
          icon={AlertTriangle}
          iconColor={data && data.lowStockCount > 0 ? "text-warning" : "text-ink-400"}
          iconBg={data && data.lowStockCount > 0 ? "bg-warning/10" : "bg-ink-700/30"}
          loading={kpiLoading}
        />
      </div>

      {/* Recent Orders */}
      <div className="admin-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-700">
          <div>
            <h2 className="text-sm font-semibold text-ink-100">Recent Orders</h2>
            <p className="text-xs text-ink-500 mt-0.5">Latest 10 orders</p>
          </div>
          <Link
            href="/orders"
            className="flex items-center gap-1.5 text-xs text-primary-400 hover:text-primary-300 transition-colors font-medium"
          >
            View all <ArrowRight size={12} />
          </Link>
        </div>

        {loading ? (
          <div className="p-4">
            <SkeletonTable rows={5} cols={6} />
          </div>
        ) : !data?.recentOrders?.length ? (
          <div className="py-16 text-center text-ink-500 text-sm">No orders yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/orders/${order.id}`)}
                  >
                    <td>
                      <span className="font-mono text-xs font-semibold text-primary-400">
                        {order.orderNumber}
                      </span>
                    </td>
                    <td className="text-ink-300 text-xs">
                      {order.shippingAddress
                        ? `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`
                        : order.user
                        ? `${order.user.firstName} ${order.user.lastName}`
                        : "—"}
                    </td>
                    <td className="text-ink-400 text-xs">{order.items?.length ?? 0} items</td>
                    <td>
                      <span className="font-mono text-sm font-semibold text-ink-200">
                        {formatNgn(parseFloat(order.grandTotal ?? "0") * 100)}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="text-ink-500 text-xs whitespace-nowrap">
                      {format(new Date(order.createdAt), "d MMM yyyy")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/products/new"
          className="admin-card p-5 flex items-center gap-4 hover:border-ink-600 transition-colors group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-lg bg-primary-700/15 flex items-center justify-center shrink-0 group-hover:bg-primary-700/25 transition-colors">
            <Plus size={18} className="text-primary-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink-200">Add Product</p>
            <p className="text-xs text-ink-500 mt-0.5">Create a new product listing</p>
          </div>
          <ArrowRight size={16} className="text-ink-600 ml-auto group-hover:text-primary-400 transition-colors" />
        </Link>
        <Link
          href="/orders"
          className="admin-card p-5 flex items-center gap-4 hover:border-ink-600 transition-colors group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-lg bg-[#C9A96E]/10 flex items-center justify-center shrink-0 group-hover:bg-[#C9A96E]/20 transition-colors">
            <ShoppingCart size={18} className="text-[#C9A96E]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink-200">View All Orders</p>
            <p className="text-xs text-ink-500 mt-0.5">Manage and process orders</p>
          </div>
          <ArrowRight size={16} className="text-ink-600 ml-auto group-hover:text-[#C9A96E] transition-colors" />
        </Link>
      </div>
    </div>
  );
}
