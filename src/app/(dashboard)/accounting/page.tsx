"use client";

import { useCallback, useEffect, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Receipt,
  Megaphone,
  Undo2,
  PiggyBank,
  Coins,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
} from "recharts";
import {
  accountingApi,
  AccountingDashboard,
  EXPENSE_CATEGORY_LABEL,
} from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import {
  DateRangeBar,
  deltaPct,
  ngnFromKobo,
  useDateRange,
} from "./_shared";

/**
 * Accounting overview. KPI strip on top, revenue / expense charts in
 * the middle, top agents + expense-by-category at the bottom.
 *
 * Net profit is the headline number per the brief — computed server-side
 * (grossProfit − refunds − commissions − expenses).
 */
export default function AccountingOverview() {
  const toast = useToast();
  const { preset, range, set } = useDateRange("30d");
  const [data, setData] = useState<AccountingDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await accountingApi.dashboard(range);
      setData(res.data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load dashboard");
    } finally {
      setLoading(false);
    }
  }, [range, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const cur = data?.current;
  const prev = data?.previous;

  return (
    <div className="space-y-5 animate-fade-in">
      <DateRangeBar preset={preset} range={range} onChange={set} />

      {/* KPI strip — every figure is NET OF VAT (post-7.5%). The card's
          formula line explains how it's computed so a reviewer can audit
          each number without digging through code. */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi
          label="Net revenue"
          icon={DollarSign}
          accent="#C9A96E"
          value={ngnFromKobo(cur?.netRevenueNgn)}
          delta={deltaPct(cur?.netRevenueNgn ?? 0, prev?.netRevenueNgn ?? 0)}
          formula="gross receipts ÷ 1.075"
          loading={loading}
        />
        <Kpi
          label="Net gross profit"
          icon={Coins}
          accent="#4ADE80"
          value={ngnFromKobo(cur?.grossProfit.netGrossProfitNgn)}
          delta={deltaPct(
            cur?.grossProfit.netGrossProfitNgn ?? 0,
            prev?.grossProfit.netGrossProfitNgn ?? 0,
          )}
          sub={
            cur
              ? `${cur.grossProfit.itemsCosted}/${cur.grossProfit.itemsTotal} items costed`
              : ""
          }
          formula="net revenue − cost of goods sold"
          loading={loading}
        />
        <Kpi
          label="Net refunds"
          icon={Undo2}
          accent="#F87171"
          value={ngnFromKobo(cur?.refunds.netAmountNgn)}
          delta={deltaPct(
            cur?.refunds.netAmountNgn ?? 0,
            prev?.refunds.netAmountNgn ?? 0,
          )}
          sub={cur ? `${cur.refunds.requestsCount} refunds` : ""}
          formula="settled refunds ÷ 1.075"
          inverse
          loading={loading}
        />
        <Kpi
          label="Agent commissions"
          icon={Megaphone}
          accent="#A78BFA"
          value={ngnFromKobo(cur?.commissions.amountNgn)}
          delta={deltaPct(
            cur?.commissions.amountNgn ?? 0,
            prev?.commissions.amountNgn ?? 0,
          )}
          sub={cur ? `${cur.commissions.ordersCount} orders` : ""}
          formula="Σ floor(orderTotal × bps ÷ 10 000)"
          inverse
          loading={loading}
        />
        <Kpi
          label="Expenses"
          icon={Receipt}
          accent="#FB923C"
          value={ngnFromKobo(cur?.expenses.amountNgn)}
          delta={deltaPct(
            cur?.expenses.amountNgn ?? 0,
            prev?.expenses.amountNgn ?? 0,
          )}
          sub={cur ? `${cur.expenses.count} entries` : ""}
          formula="Σ recorded expenses (VAT-exclusive)"
          inverse
          loading={loading}
        />
        <Kpi
          label="Net profit"
          icon={PiggyBank}
          accent="#22D3EE"
          value={ngnFromKobo(cur?.netProfitNgn)}
          delta={deltaPct(cur?.netProfitNgn ?? 0, prev?.netProfitNgn ?? 0)}
          formula="net gross profit − net refunds − commissions − expenses"
          headline
          loading={loading}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader title="Revenue" subtitle="Daily, NGN" />
          <div className="h-64 px-4 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.revenueSeries ?? []}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C9A96E" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#C9A96E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis
                  dataKey="date"
                  stroke="#666"
                  fontSize={10}
                  tickFormatter={(d) => fmtShortDate(d)}
                />
                <YAxis
                  stroke="#666"
                  fontSize={10}
                  tickFormatter={(v) => formatAxisKobo(v)}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0F0F0F",
                    border: "1px solid #333",
                    borderRadius: 8,
                  }}
                  labelStyle={{ color: "#9AA5B1", fontSize: 11 }}
                  formatter={(v) => [ngnFromKobo(Number(v ?? 0)), "Revenue"]}
                />
                <Area
                  type="monotone"
                  dataKey="amountNgn"
                  stroke="#C9A96E"
                  strokeWidth={2}
                  fill="url(#revFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Expenses" subtitle="Daily, NGN" />
          <div className="h-64 px-4 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.expenseSeries ?? []}>
                <defs>
                  <linearGradient id="expFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FB923C" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#FB923C" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis
                  dataKey="date"
                  stroke="#666"
                  fontSize={10}
                  tickFormatter={(d) => fmtShortDate(d)}
                />
                <YAxis
                  stroke="#666"
                  fontSize={10}
                  tickFormatter={(v) => formatAxisKobo(v)}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0F0F0F",
                    border: "1px solid #333",
                    borderRadius: 8,
                  }}
                  labelStyle={{ color: "#9AA5B1", fontSize: 11 }}
                  formatter={(v) => [ngnFromKobo(Number(v ?? 0)), "Expenses"]}
                />
                <Area
                  type="monotone"
                  dataKey="amountNgn"
                  stroke="#FB923C"
                  strokeWidth={2}
                  fill="url(#expFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Bottom: top agents + category breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader
            title="Top marketing agents"
            subtitle={`By commission in window · ${data?.topAgents.length ?? 0} agents`}
          />
          <div className="px-4 pb-4">
            {data && data.topAgents.length === 0 ? (
              <p className="text-sm text-ink-500 py-6 text-center">
                No agent commissions in this window.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase text-ink-500 tracking-wider">
                    <th className="text-left py-2">Agent</th>
                    <th className="text-right py-2">Orders</th>
                    <th className="text-right py-2">Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.topAgents ?? []).map((a) => (
                    <tr
                      key={a.agentId}
                      className="border-t border-ink-800"
                    >
                      <td className="py-2">
                        <div className="text-ink-100">{a.name}</div>
                        <div className="text-[10px] font-mono text-ink-500">
                          {a.code}
                        </div>
                      </td>
                      <td className="text-right text-ink-300">
                        {a.ordersCount}
                      </td>
                      <td className="text-right text-ink-100 font-semibold">
                        {ngnFromKobo(a.commissionNgn)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Expenses by category" subtitle="Window total" />
          <div className="h-64 px-4 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={(cur?.expenses.byCategory ?? []).map((b) => ({
                  ...b,
                  label: EXPENSE_CATEGORY_LABEL[b.category],
                }))}
                layout="vertical"
                margin={{ left: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis
                  type="number"
                  stroke="#666"
                  fontSize={10}
                  tickFormatter={(v) => formatAxisKobo(v)}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  stroke="#666"
                  fontSize={10}
                  width={120}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0F0F0F",
                    border: "1px solid #333",
                    borderRadius: 8,
                  }}
                  formatter={(v) => [ngnFromKobo(Number(v ?? 0)), "Total"]}
                  cursor={{ fill: "#1f2937" }}
                />
                <Bar dataKey="amountNgn" radius={[0, 6, 6, 0]}>
                  {(cur?.expenses.byCategory ?? []).map((_, i) => (
                    <Cell key={i} fill={pickPalette(i)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Pieces ──

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-ink-900 border border-ink-700 rounded-2xl overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
}

function CardHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="px-4 py-3 border-b border-ink-800">
      <h3 className="text-sm font-semibold text-ink-100">{title}</h3>
      {subtitle ? (
        <p className="text-xs text-ink-500 mt-0.5">{subtitle}</p>
      ) : null}
    </div>
  );
}

interface KpiProps {
  label: string;
  icon: typeof DollarSign;
  accent: string;
  value: string;
  delta?: { label: string; tone: "up" | "down" | "flat" };
  sub?: string;
  /** Short formula explaining how the figure is computed. Required for audit. */
  formula?: string;
  /** Reverse the delta semantics — for expense/refund cards where up is bad. */
  inverse?: boolean;
  /** Larger emphasis for the net-profit card. */
  headline?: boolean;
  loading?: boolean;
}

function Kpi({
  label,
  icon: Icon,
  accent,
  value,
  delta,
  sub,
  formula,
  inverse = false,
  headline = false,
  loading = false,
}: KpiProps) {
  const goodIsUp = !inverse;
  const tone = delta
    ? delta.tone === "flat"
      ? "flat"
      : (delta.tone === "up") === goodIsUp
        ? "good"
        : "bad"
    : "flat";
  const ArrowIcon =
    delta?.tone === "up"
      ? TrendingUp
      : delta?.tone === "down"
        ? TrendingDown
        : Minus;
  const deltaColor =
    tone === "good"
      ? "text-emerald-400"
      : tone === "bad"
        ? "text-rose-400"
        : "text-ink-500";
  return (
    <div
      className={`relative bg-ink-900 border border-ink-700 rounded-xl p-3.5 overflow-hidden ${
        headline ? "ring-1 ring-[#22D3EE]/30" : ""
      }`}
    >
      <div
        className="absolute -right-6 -top-6 w-20 h-20 rounded-full opacity-10"
        style={{ background: accent }}
      />
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink-400">
          <Icon size={11} style={{ color: accent }} />
          {label}
        </div>
      </div>
      <div
        className={`font-bold text-ink-100 ${
          headline ? "text-2xl" : "text-lg"
        } ${loading ? "opacity-40" : ""}`}
      >
        {loading ? "—" : value}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px]">
        <span className={`inline-flex items-center gap-1 ${deltaColor}`}>
          <ArrowIcon size={10} />
          {delta?.label ?? "—"} vs prev
        </span>
        {sub ? <span className="text-ink-500">{sub}</span> : null}
      </div>
      {formula ? (
        <div
          className="mt-2 pt-1.5 border-t border-ink-800 text-[10px] text-ink-500 leading-tight"
          title={`Formula: ${formula}`}
        >
          <span className="text-ink-600">ƒ</span>{" "}
          <span className="font-mono">{formula}</span>
        </div>
      ) : null}
    </div>
  );
}

function fmtShortDate(d: string): string {
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

function formatAxisKobo(kobo: number): string {
  const n = Math.abs(kobo) / 100;
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}k`;
  return `₦${n.toFixed(0)}`;
}

const PALETTE = [
  "#C9A96E",
  "#A78BFA",
  "#22D3EE",
  "#4ADE80",
  "#FB923C",
  "#F87171",
  "#60A5FA",
  "#F472B6",
  "#FCD34D",
  "#A3E635",
  "#94A3B8",
];

function pickPalette(i: number): string {
  return PALETTE[i % PALETTE.length] ?? "#C9A96E";
}
