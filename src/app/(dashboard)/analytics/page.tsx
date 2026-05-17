"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";
import {
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  TrendingUp,
  Wallet,
  AlertTriangle,
  Clock,
  RefreshCw,
} from "lucide-react";
import {
  analyticsApi,
  formatNgn,
  formatUsd,
  type AnalyticsRange,
  type AnalyticsSummary,
} from "@/lib/api";
import { KpiCard } from "@/components/KpiCard";

// Brand palette — mirrors the dashboard so charts feel native to the admin.
const COLOR_PRIMARY = "#A78BFA";       // primary-400
const COLOR_GOLD    = "#C9A96E";       // accent (USD)
const COLOR_ORDERS  = "#34D399";       // emerald
const COLOR_GRID    = "#3F3F46";       // ink-700-ish
const COLOR_AXIS    = "#71717A";       // ink-500
const COLOR_TOOLTIP_BG = "#18181B";    // ink-900
const COLOR_TOOLTIP_BORDER = "#3F3F46";

const STATUS_COLORS: Record<string, string> = {
  PAID:             "#34D399",
  PROCESSING:       "#60A5FA",
  SHIPPED:          "#A78BFA",
  DELIVERED:        "#10B981",
  PENDING_PAYMENT:  "#FBBF24",
  CANCELLED:        "#F87171",
  REFUNDED:         "#FB923C",
  RETURN_REQUESTED: "#FCD34D",
  RETURN_APPROVED:  "#FCA5A5",
  RETURNED:         "#EF4444",
};

const CHANNEL_LABELS: Record<string, string> = {
  STOREFRONT: "Storefront",
  ADMIN:      "Admin / Manual",
  POS:        "POS / In-store",
};

const RANGE_LABELS: Record<AnalyticsRange, string> = {
  "7d":  "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "12m": "Last 12 months",
};

type Currency = "NGN" | "USD";

export default function AnalyticsPage() {
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const [currency, setCurrency] = useState<Currency>("NGN");
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (r: AnalyticsRange, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await analyticsApi.summary(r);
      setData(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(range);
  }, [range, load]);

  // ── Trend chart data: pick the active currency, format dates for axis ──
  const trendData = useMemo(() => {
    if (!data) return [];
    return data.trend.map((p) => ({
      date: p.date,
      label: formatBucketLabel(p.date, range),
      revenue: currency === "NGN" ? p.ngn : p.usd,
      orders: p.orders,
    }));
  }, [data, currency, range]);

  const customerTrendData = useMemo(() => {
    if (!data) return [];
    return data.customerTrend.map((p) => ({
      date: p.date,
      label: formatBucketLabel(p.date, range),
      count: p.count,
    }));
  }, [data, range]);

  const statusData = useMemo(() => {
    if (!data) return [];
    return data.statusBreakdown.map((s) => ({
      name: prettyStatus(s.status),
      value: s.count,
      color: STATUS_COLORS[s.status] ?? COLOR_PRIMARY,
    }));
  }, [data]);

  const channelData = useMemo(() => {
    if (!data) return [];
    return data.channelBreakdown.map((c) => ({
      channel: CHANNEL_LABELS[c.channel] ?? c.channel,
      orders: c.count,
      revenue: currency === "NGN" ? c.revenueNgn : c.revenueUsd,
    }));
  }, [data, currency]);

  const fmtMoney = currency === "NGN" ? formatNgn : formatUsd;
  const revenue = data?.kpis.revenue[currency === "NGN" ? "ngn" : "usd"] ?? 0;
  const revenuePrev = data?.kpis.revenuePrev[currency === "NGN" ? "ngn" : "usd"] ?? 0;
  const aov = data?.kpis.avgOrderValue[currency === "NGN" ? "ngn" : "usd"] ?? 0;
  const revenueDelta = percentDelta(revenue, revenuePrev);
  const ordersDelta = percentDelta(data?.kpis.orders ?? 0, data?.kpis.ordersPrev ?? 0);
  const customersDelta = percentDelta(data?.kpis.newCustomers ?? 0, data?.kpis.newCustomersPrev ?? 0);
  // Realised gross profit is NGN-only (cost price is recorded in NGN only).
  const profitNgn = data?.kpis.profitNgn ?? 0;
  const profitDelta = percentDelta(profitNgn, data?.kpis.profitNgnPrev ?? 0);
  const profitItemsCosted = data?.kpis.profitItemsCosted ?? 0;
  const profitItemsTotal = data?.kpis.profitItemsTotal ?? 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">Analytics</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            {data
              ? `${RANGE_LABELS[range]} · updated ${format(parseISO(data.generatedAt), "d MMM, HH:mm")}`
              : RANGE_LABELS[range]}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Currency toggle */}
          <div className="inline-flex rounded-md border border-ink-700 bg-ink-800 p-0.5">
            {(["NGN", "USD"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                  currency === c
                    ? "bg-primary-700/20 text-primary-300"
                    : "text-ink-400 hover:text-ink-200"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          {/* Range picker */}
          <div className="inline-flex rounded-md border border-ink-700 bg-ink-800 p-0.5">
            {(Object.keys(RANGE_LABELS) as AnalyticsRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                  range === r
                    ? "bg-primary-700/20 text-primary-300"
                    : "text-ink-400 hover:text-ink-200"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <button
            onClick={() => load(range, true)}
            disabled={refreshing}
            title="Refresh"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-ink-700 bg-ink-800 text-xs font-semibold text-ink-300 hover:text-ink-100 hover:border-ink-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="admin-card border-danger/30 bg-danger/5 px-4 py-3">
          <p className="text-sm text-danger">Couldn&apos;t load analytics: {error}</p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title={`Revenue (${currency})`}
          value={fmtMoney(revenue)}
          subtitle={revenueDelta != null ? deltaSubtitle(revenueDelta, "vs prev period") : "From paid orders"}
          icon={DollarSign}
          iconColor="text-[#C9A96E]"
          iconBg="bg-[#C9A96E]/10"
          loading={loading}
          trend={
            revenueDelta != null
              ? { value: `${Math.abs(revenueDelta).toFixed(1)}%`, up: revenueDelta >= 0 }
              : undefined
          }
        />
        <KpiCard
          title="Orders"
          value={data?.kpis.orders ?? "—"}
          subtitle={ordersDelta != null ? deltaSubtitle(ordersDelta, "vs prev period") : "Paid + fulfilling"}
          icon={ShoppingCart}
          iconColor="text-primary-400"
          iconBg="bg-primary-700/15"
          loading={loading}
          trend={
            ordersDelta != null
              ? { value: `${Math.abs(ordersDelta).toFixed(1)}%`, up: ordersDelta >= 0 }
              : undefined
          }
        />
        <KpiCard
          title="Avg Order Value"
          value={fmtMoney(aov)}
          subtitle="Per paid order"
          icon={TrendingUp}
          iconColor="text-primary-300"
          iconBg="bg-primary-600/15"
          loading={loading}
        />
        <KpiCard
          title="Gross Profit (NGN)"
          value={formatNgn(profitNgn)}
          subtitle={
            profitItemsTotal > 0 && profitItemsCosted < profitItemsTotal
              ? `Selling − cost on sold items · cost set on ${profitItemsCosted}/${profitItemsTotal}`
              : "Selling price − cost price, on sold items"
          }
          icon={Wallet}
          iconColor="text-[#34D399]"
          iconBg="bg-[#34D399]/10"
          loading={loading}
          trend={
            profitDelta != null
              ? { value: `${Math.abs(profitDelta).toFixed(1)}%`, up: profitDelta >= 0 }
              : undefined
          }
        />
        <KpiCard
          title="New Customers"
          value={data?.kpis.newCustomers ?? "—"}
          subtitle={customersDelta != null ? deltaSubtitle(customersDelta, "vs prev period") : "Sign-ups in window"}
          icon={Users}
          iconColor="text-[#34D399]"
          iconBg="bg-[#34D399]/10"
          loading={loading}
          trend={
            customersDelta != null
              ? { value: `${Math.abs(customersDelta).toFixed(1)}%`, up: customersDelta >= 0 }
              : undefined
          }
        />
        <KpiCard
          title="Active Products"
          value={data?.kpis.totalProducts ?? "—"}
          subtitle="In catalogue"
          icon={Package}
          iconColor="text-primary-300"
          iconBg="bg-primary-600/15"
          loading={loading}
        />
        <KpiCard
          title="Pending Orders"
          value={data?.kpis.pendingOrders ?? "—"}
          subtitle="Awaiting fulfilment"
          icon={Clock}
          iconColor="text-[#FBBF24]"
          iconBg="bg-[#FBBF24]/10"
          loading={loading}
        />
        <KpiCard
          title="Low Stock"
          value={data?.kpis.lowStockCount ?? "—"}
          subtitle="Variants ≤ 10 units"
          icon={AlertTriangle}
          iconColor={data && data.kpis.lowStockCount > 0 ? "text-warning" : "text-ink-400"}
          iconBg={data && data.kpis.lowStockCount > 0 ? "bg-warning/10" : "bg-ink-700/30"}
          loading={loading}
        />
        <KpiCard
          title="USD Revenue"
          value={formatUsd(data?.kpis.revenue.usd ?? 0)}
          subtitle="From paid USD orders"
          icon={DollarSign}
          iconColor="text-[#60A5FA]"
          iconBg="bg-[#60A5FA]/10"
          loading={loading}
        />
      </div>

      {/* Revenue trend (full width) */}
      <ChartCard title="Revenue trend" subtitle={`${currency} from paid orders, by ${range === "12m" ? "month" : "day"}`}>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLOR_GOLD} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={COLOR_GOLD} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={COLOR_GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                stroke={COLOR_AXIS}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={20}
              />
              <YAxis
                stroke={COLOR_AXIS}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => compactMoney(v, currency)}
                width={64}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={tooltipLabelStyle}
                formatter={(v) => [fmtMoney(toNumber(v)), "Revenue"]}
              />
              <Area type="monotone" dataKey="revenue" stroke={COLOR_GOLD} strokeWidth={2} fill="url(#revGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Two-column: order count trend + customer signups */}
      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard title="Order volume" subtitle={`Paid orders by ${range === "12m" ? "month" : "day"}`}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid stroke={COLOR_GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke={COLOR_AXIS}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={20}
                />
                <YAxis
                  stroke={COLOR_AXIS}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={32}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  formatter={(v) => [toNumber(v), "Orders"]}
                  cursor={{ fill: "rgba(167,139,250,0.08)" }}
                />
                <Bar dataKey="orders" fill={COLOR_ORDERS} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="New customers" subtitle={`Sign-ups by ${range === "12m" ? "month" : "day"}`}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={customerTrendData} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid stroke={COLOR_GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke={COLOR_AXIS}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={20}
                />
                <YAxis
                  stroke={COLOR_AXIS}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={32}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  formatter={(v) => [toNumber(v), "New customers"]}
                />
                <Line type="monotone" dataKey="count" stroke={COLOR_PRIMARY} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Three-column: top products / status pie / channels */}
      <div className="grid lg:grid-cols-3 gap-4">
        <ChartCard
          className="lg:col-span-2"
          title="Top selling products"
          subtitle="By units sold in window"
        >
          {loading ? (
            <div className="h-64 flex items-center justify-center text-ink-500 text-sm">Loading…</div>
          ) : !data?.topProducts.length ? (
            <div className="h-64 flex items-center justify-center text-ink-500 text-sm">No sales in this period</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th className="text-right">Units</th>
                    <th className="text-right">Revenue ({currency})</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topProducts.map((p) => (
                    <tr key={p.sku}>
                      <td className="text-ink-200 font-medium">{p.productName}</td>
                      <td>
                        <span className="font-mono text-xs text-ink-500">{p.sku}</span>
                      </td>
                      <td className="text-right">
                        <span className="font-mono font-semibold text-ink-100">{p.unitsSold}</span>
                      </td>
                      <td className="text-right">
                        <span className="font-mono text-ink-300">
                          {fmtMoney(currency === "NGN" ? p.revenueNgn : p.revenueUsd)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Order status mix" subtitle="All orders in window">
          {loading ? (
            <div className="h-64 flex items-center justify-center text-ink-500 text-sm">Loading…</div>
          ) : !statusData.length ? (
            <div className="h-64 flex items-center justify-center text-ink-500 text-sm">No orders</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                  >
                    {statusData.map((s) => (
                      <Cell key={s.name} fill={s.color} stroke={COLOR_TOOLTIP_BG} strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={tooltipLabelStyle}
                    formatter={(v, n) => [toNumber(v), String(n)]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    wrapperStyle={{ fontSize: 11, color: COLOR_AXIS }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Channel breakdown */}
      <ChartCard title="Sales channel breakdown" subtitle="Orders + revenue by channel">
        {loading ? (
          <div className="h-56 flex items-center justify-center text-ink-500 text-sm">Loading…</div>
        ) : !channelData.length ? (
          <div className="h-56 flex items-center justify-center text-ink-500 text-sm">No sales in this period</div>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelData} layout="vertical" margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid stroke={COLOR_GRID} strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  stroke={COLOR_AXIS}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="channel"
                  stroke={COLOR_AXIS}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  width={110}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  formatter={(v, name) => {
                    const n = toNumber(v);
                    if (name === "revenue") return [fmtMoney(n), `Revenue (${currency})`];
                    return [n, "Orders"];
                  }}
                  cursor={{ fill: "rgba(167,139,250,0.08)" }}
                />
                <Bar dataKey="orders" fill={COLOR_PRIMARY} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────

function ChartCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`admin-card p-5 ${className}`}>
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-ink-100">{title}</h2>
        {subtitle && <p className="text-xs text-ink-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

const tooltipStyle: React.CSSProperties = {
  backgroundColor: COLOR_TOOLTIP_BG,
  border: `1px solid ${COLOR_TOOLTIP_BORDER}`,
  borderRadius: 6,
  fontSize: 12,
  color: "#E4E4E7",
};
const tooltipLabelStyle: React.CSSProperties = { color: "#A1A1AA", fontSize: 11, fontWeight: 600 };

function formatBucketLabel(iso: string, range: AnalyticsRange): string {
  const d = parseISO(iso);
  if (range === "12m") return format(d, "MMM");
  if (range === "90d") return format(d, "d MMM");
  return format(d, "d MMM");
}

/**
 * Compact tick labels for the Y axis. Money is stored in minor units
 * (kobo/cents), so we divide by 100 before applying the suffix.
 */
function compactMoney(minorUnits: number, currency: Currency): string {
  const major = minorUnits / 100;
  const sign = currency === "NGN" ? "₦" : "$";
  if (Math.abs(major) >= 1_000_000) return `${sign}${(major / 1_000_000).toFixed(1)}M`;
  if (Math.abs(major) >= 1_000) return `${sign}${(major / 1_000).toFixed(1)}k`;
  return `${sign}${Math.round(major)}`;
}

function percentDelta(curr: number, prev: number): number | null {
  if (prev === 0) {
    if (curr === 0) return 0;
    return null; // can't compute % growth from zero
  }
  return ((curr - prev) / prev) * 100;
}

function deltaSubtitle(delta: number, suffix: string): string {
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}% ${suffix}`;
}

function prettyStatus(s: string): string {
  return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Recharts' tooltip formatter is typed as `ValueType` (string | number | array). */
function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  if (Array.isArray(v) && v.length) return toNumber(v[0]);
  return 0;
}
