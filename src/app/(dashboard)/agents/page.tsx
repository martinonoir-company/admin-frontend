"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Megaphone,
  Search,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
} from "lucide-react";
import {
  agentsApi,
  AgentStatus,
  MarketingAgentView,
  formatNgn,
} from "@/lib/api";
import { SkeletonTable } from "@/components/Skeleton";
import { useToast } from "@/lib/toast-context";

const PAGE_SIZE = 20;

const STATUS_OPTIONS: AgentStatus[] = [
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "SUSPENDED",
];

const STATUS_STYLES: Record<AgentStatus, { className: string; icon: typeof CheckCircle2 }> = {
  PENDING_APPROVAL: {
    className: "bg-warning/15 text-warning border-warning/30",
    icon: Clock,
  },
  APPROVED: {
    className: "bg-success/15 text-success border-success/30",
    icon: CheckCircle2,
  },
  REJECTED: {
    className: "bg-danger/15 text-danger border-danger/30",
    icon: XCircle,
  },
  SUSPENDED: {
    className: "bg-ink-700 text-ink-300 border-ink-600",
    icon: Ban,
  },
};

const STATUS_LABEL: Record<AgentStatus, string> = {
  PENDING_APPROVAL: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  SUSPENDED: "Suspended",
};

export default function AgentsListPage() {
  const { error } = useToast();
  const [items, setItems] = useState<MarketingAgentView[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<AgentStatus | "">("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [globalRateBps, setGlobalRateBps] = useState<number | null>(null);
  const [globalRateInput, setGlobalRateInput] = useState("");
  const [savingGlobalRate, setSavingGlobalRate] = useState(false);

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const res = await agentsApi.list({
          page: p,
          limit: PAGE_SIZE,
          status: statusFilter || undefined,
          search: search || undefined,
        });
        setItems(res.data.items);
        setPage(res.data.page);
        setPages(res.data.pages);
        setTotal(res.data.total);
      } catch (err) {
        error(err instanceof Error ? err.message : "Could not load agents");
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, search, error],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  useEffect(() => {
    void agentsApi
      .getGlobalRate()
      .then((res) => {
        setGlobalRateBps(res.data.bps);
        setGlobalRateInput(String(res.data.bps / 100));
      })
      .catch(() => {});
  }, []);

  async function saveGlobalRate() {
    const pct = parseFloat(globalRateInput);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      error("Rate must be between 0 and 100%.");
      return;
    }
    setSavingGlobalRate(true);
    try {
      const res = await agentsApi.setGlobalRate(Math.round(pct * 100));
      setGlobalRateBps(res.data.bps);
    } catch (err) {
      error(err instanceof Error ? err.message : "Could not save rate");
    } finally {
      setSavingGlobalRate(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-100 flex items-center gap-2">
            <Megaphone size={22} className="text-primary-400" />
            Marketing Agents
          </h1>
          <p className="text-sm text-ink-400 mt-1">
            Approve agent signups, set commission rates, and process monthly
            payouts.
          </p>
        </div>

        <div className="bg-ink-900 border border-ink-700 rounded-lg px-4 py-3 flex items-center gap-3">
          <div>
            <p className="text-xs text-ink-400">Global commission</p>
            <p className="text-sm font-semibold text-ink-100">
              {globalRateBps === null
                ? "…"
                : `${(globalRateBps / 100).toFixed(2)}%`}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <input
              type="number"
              step="0.01"
              min={0}
              max={100}
              value={globalRateInput}
              onChange={(e) => setGlobalRateInput(e.target.value)}
              className="w-20 px-2 py-1.5 bg-ink-950 border border-ink-700 rounded text-sm text-white caret-white"
            />
            <span className="text-xs text-ink-500">%</span>
            <button
              onClick={saveGlobalRate}
              disabled={savingGlobalRate}
              className="ml-2 px-3 py-1.5 bg-primary-700 hover:bg-primary-600 text-white text-xs font-medium rounded disabled:opacity-40"
            >
              {savingGlobalRate ? "…" : "Save"}
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500"
          />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setSearch(searchInput.trim());
            }}
            placeholder="Search code, name, email"
            className="pl-9 pr-3 py-2 bg-ink-900 border border-ink-700 rounded-lg text-sm text-white caret-white placeholder:text-ink-500 w-64"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter((e.target.value as AgentStatus) || "")
          }
          className="admin-select w-44"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        {(statusFilter || search) && (
          <button
            onClick={() => {
              setStatusFilter("");
              setSearch("");
              setSearchInput("");
            }}
            className="text-xs text-ink-400 hover:text-ink-200 underline"
          >
            Clear
          </button>
        )}
        <span className="text-xs text-ink-500 ml-auto">{total} total</span>
      </div>

      {/* Table */}
      <div className="bg-ink-900 border border-ink-700 rounded-xl overflow-hidden">
        {loading ? (
          <SkeletonTable rows={6} cols={5} />
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-sm text-ink-400">
            No agents match the current filters.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-ink-950 border-b border-ink-700">
              <tr className="text-left text-xs text-ink-400 uppercase tracking-wider">
                <th className="px-4 py-3 font-medium">Agent</th>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Wallet</th>
                <th className="px-4 py-3 font-medium text-right">Lifetime earned</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {items.map((a) => {
                const S = STATUS_STYLES[a.status];
                const Icon = S.icon;
                return (
                  <tr
                    key={a.id}
                    className="border-b border-ink-800 last:border-0 hover:bg-ink-800/40 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="text-ink-100 font-medium">
                        {a.user?.firstName} {a.user?.lastName}
                      </div>
                      <div className="text-xs text-ink-400">
                        {a.user?.email}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-primary-300">
                      {a.code}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${S.className}`}
                      >
                        <Icon size={11} />
                        {STATUS_LABEL[a.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-ink-100 font-semibold">
                      {formatNgn(a.walletBalanceMinor)}
                    </td>
                    <td className="px-4 py-3 text-right text-ink-300">
                      {formatNgn(a.lifetimeEarnedMinor)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/agents/${a.id}`}
                        className="inline-flex items-center gap-1 text-primary-400 hover:text-primary-300 text-xs"
                      >
                        Open <ChevronRight size={12} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => load(page - 1)}
            disabled={page <= 1 || loading}
            className="px-3 py-1.5 bg-ink-900 border border-ink-700 rounded text-xs text-ink-300 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-ink-400">
            Page {page} of {pages}
          </span>
          <button
            onClick={() => load(page + 1)}
            disabled={page >= pages || loading}
            className="px-3 py-1.5 bg-ink-900 border border-ink-700 rounded text-xs text-ink-300 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
