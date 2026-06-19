"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Megaphone, ExternalLink, TrendingUp, Banknote, Wallet } from "lucide-react";
import {
  accountingApi,
  agentsApi,
  AccountingDashboard,
  MarketingAgentView,
} from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import { DateRangeBar, ngnFromKobo, useDateRange } from "../_shared";

/**
 * Accounting view of agent commissions: the same data the dedicated
 * /agents module shows, but framed as accounting line-items in the
 * selected date window. No duplicate workflow (approve/payout lives on
 * /agents); this page is read-only reporting.
 */
export default function CommissionsPage() {
  const toast = useToast();
  const { preset, range, set } = useDateRange("30d");
  const [dash, setDash] = useState<AccountingDashboard | null>(null);
  const [agents, setAgents] = useState<MarketingAgentView[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, a] = await Promise.all([
        accountingApi.dashboard(range),
        agentsApi.list({ limit: 100 }),
      ]);
      setDash(d.data);
      setAgents(a.data.items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load commissions");
    } finally {
      setLoading(false);
    }
  }, [range, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const cur = dash?.current;

  return (
    <div className="space-y-5 animate-fade-in">
      <DateRangeBar preset={preset} range={range} onChange={set} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          label="Commission earned"
          value={ngnFromKobo(cur?.commissions.amountNgn)}
          sub={cur ? `${cur.commissions.ordersCount} orders` : ""}
          icon={TrendingUp}
          accent="#A78BFA"
        />
        <StatCard
          label="Payouts disbursed"
          value={ngnFromKobo(cur?.payoutsDisbursed.amountNgn)}
          sub={cur ? `${cur.payoutsDisbursed.payoutsCount} payouts` : ""}
          icon={Banknote}
          accent="#4ADE80"
        />
        <StatCard
          label="Wallet liability"
          value={ngnFromKobo(
            agents.reduce(
              (s, a) =>
                a.status === "APPROVED" ? s + Number(a.walletBalanceMinor) : s,
              0,
            ),
          )}
          sub="Across approved agents"
          icon={Wallet}
          accent="#C9A96E"
        />
      </div>

      <div className="bg-ink-900 border border-ink-700 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-ink-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink-100 inline-flex items-center gap-2">
            <Megaphone size={14} /> Top agents in window
          </h3>
          <Link
            href="/agents"
            className="text-xs text-[#C9A96E] hover:underline inline-flex items-center gap-1"
          >
            Manage agents <ExternalLink size={11} />
          </Link>
        </div>
        {loading ? (
          <p className="p-10 text-center text-sm text-ink-400">Loading…</p>
        ) : !dash || dash.topAgents.length === 0 ? (
          <p className="p-10 text-center text-sm text-ink-400">
            No commission earned in this window.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-ink-950 border-b border-ink-700">
              <tr className="text-left text-[11px] text-ink-400 uppercase tracking-wider">
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3 text-right">Referred orders</th>
                <th className="px-4 py-3 text-right">Commission</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {dash.topAgents.map((a) => (
                <tr
                  key={a.agentId}
                  className="border-b border-ink-800 last:border-0 hover:bg-ink-800/40 transition-colors"
                >
                  <td className="px-4 py-3 text-ink-100 font-medium">
                    {a.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[#C9A96E]">
                    {a.code}
                  </td>
                  <td className="px-4 py-3 text-right text-ink-300">
                    {a.ordersCount}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-ink-100">
                    {ngnFromKobo(a.commissionNgn)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/agents/${a.agentId}`}
                      className="text-xs text-ink-400 hover:text-ink-100"
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-ink-900 border border-ink-700 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-ink-800">
          <h3 className="text-sm font-semibold text-ink-100">
            All approved agents
          </h3>
          <p className="text-[11px] text-ink-500 mt-0.5">
            Snapshot of wallet + lifetime balances. Approve, suspend or pay
            out from the dedicated agents page.
          </p>
        </div>
        {loading ? (
          <p className="p-10 text-center text-sm text-ink-400">Loading…</p>
        ) : agents.filter((a) => a.status === "APPROVED").length === 0 ? (
          <p className="p-10 text-center text-sm text-ink-400">
            No approved agents yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-ink-950 border-b border-ink-700">
              <tr className="text-left text-[11px] text-ink-400 uppercase tracking-wider">
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3 text-right">Wallet</th>
                <th className="px-4 py-3 text-right">Lifetime earned</th>
                <th className="px-4 py-3 text-right">Lifetime paid</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {agents
                .filter((a) => a.status === "APPROVED")
                .sort(
                  (a, b) =>
                    Number(b.walletBalanceMinor) - Number(a.walletBalanceMinor),
                )
                .map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-ink-800 last:border-0 hover:bg-ink-800/40"
                  >
                    <td className="px-4 py-3 text-ink-100">
                      {a.user?.firstName} {a.user?.lastName}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#C9A96E]">
                      {a.code}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-ink-100">
                      {ngnFromKobo(a.walletBalanceMinor)}
                    </td>
                    <td className="px-4 py-3 text-right text-ink-300">
                      {ngnFromKobo(a.lifetimeEarnedMinor)}
                    </td>
                    <td className="px-4 py-3 text-right text-ink-300">
                      {ngnFromKobo(a.lifetimePaidMinor)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/agents/${a.id}`}
                        className="text-xs text-ink-400 hover:text-ink-100"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof Megaphone;
  accent: string;
}) {
  return (
    <div className="relative bg-ink-900 border border-ink-700 rounded-xl p-4 overflow-hidden">
      <div
        className="absolute -right-6 -top-6 w-20 h-20 rounded-full opacity-10"
        style={{ background: accent }}
      />
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink-400 mb-2">
        <Icon size={11} style={{ color: accent }} />
        {label}
      </div>
      <div className="text-xl font-bold text-ink-100">{value}</div>
      {sub ? <div className="text-[11px] text-ink-500 mt-1">{sub}</div> : null}
    </div>
  );
}
