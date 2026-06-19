"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Wallet,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Send,
  Ban,
  Save,
  Banknote,
  ReceiptText,
} from "lucide-react";
import {
  agentsApi,
  AgentDashboardView,
  AgentAttributionStatus,
  AgentPayoutStatus,
  formatNgn,
} from "@/lib/api";
import { Modal } from "@/components/Modal";
import { useToast } from "@/lib/toast-context";

const ATTR_STATUS_STYLES: Record<AgentAttributionStatus, string> = {
  PENDING: "bg-warning/15 text-warning",
  EARNED: "bg-primary-700/20 text-primary-300",
  REVERSED: "bg-danger/15 text-danger",
  PAID: "bg-success/15 text-success",
};

const PAYOUT_STATUS_STYLES: Record<AgentPayoutStatus, string> = {
  PENDING: "bg-warning/15 text-warning",
  PROCESSING: "bg-primary-700/20 text-primary-300",
  SUCCEEDED: "bg-success/15 text-success",
  FAILED: "bg-danger/15 text-danger",
};

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { success, error } = useToast();
  const [data, setData] = useState<AgentDashboardView | null>(null);
  const [loading, setLoading] = useState(true);
  const [rateInput, setRateInput] = useState("");
  const [savingRate, setSavingRate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [payoutOpen, setPayoutOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await agentsApi.get(id);
      setData(res.data);
      const bps = res.data.agent.commissionRateBps;
      setRateInput(bps === null || bps === undefined ? "" : String(bps / 100));
    } catch (err) {
      error(err instanceof Error ? err.message : "Could not load agent");
    } finally {
      setLoading(false);
    }
  }, [id, error]);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve() {
    setBusy(true);
    try {
      await agentsApi.approve(id);
      success("Agent approved.");
      await load();
    } catch (err) {
      error(err instanceof Error ? err.message : "Could not approve");
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    setBusy(true);
    try {
      await agentsApi.reject(id, rejectReason.trim() || undefined);
      success("Agent rejected.");
      setRejectOpen(false);
      setRejectReason("");
      await load();
    } catch (err) {
      error(err instanceof Error ? err.message : "Could not reject");
    } finally {
      setBusy(false);
    }
  }

  async function suspend() {
    if (
      !confirm(
        "Suspend this agent? They will not be able to log in or earn new commission until reinstated. Existing wallet balance is unchanged.",
      )
    )
      return;
    setBusy(true);
    try {
      await agentsApi.suspend(id);
      success("Agent suspended.");
      await load();
    } catch (err) {
      error(err instanceof Error ? err.message : "Could not suspend");
    } finally {
      setBusy(false);
    }
  }

  async function saveRate() {
    if (!rateInput.trim()) {
      // Clear override (revert to global)
      setSavingRate(true);
      try {
        await agentsApi.setCommission(id, null);
        success("Reverted to the global commission rate.");
        await load();
      } catch (err) {
        error(err instanceof Error ? err.message : "Could not save");
      } finally {
        setSavingRate(false);
      }
      return;
    }
    const pct = parseFloat(rateInput);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      error("Rate must be 0–100%.");
      return;
    }
    setSavingRate(true);
    try {
      await agentsApi.setCommission(id, Math.round(pct * 100));
      success("Commission rate saved.");
      await load();
    } catch (err) {
      error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSavingRate(false);
    }
  }

  async function runPayout() {
    setBusy(true);
    try {
      const res = await agentsApi.payout(id);
      success(
        `Payout of ${formatNgn(res.data.amountMinor)} initiated for ${res.data.attributionCount} order${res.data.attributionCount === 1 ? "" : "s"}.`,
      );
      setPayoutOpen(false);
      await load();
    } catch (err) {
      error(err instanceof Error ? err.message : "Could not initiate payout");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !data) {
    return (
      <div className="p-12 text-center text-ink-400 text-sm">Loading…</div>
    );
  }

  const a = data.agent;
  const isPending = a.status === "PENDING_APPROVAL";
  const isApproved = a.status === "APPROVED";
  const isRejected = a.status === "REJECTED";
  const isSuspended = a.status === "SUSPENDED";

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push("/agents")}
        className="text-xs text-ink-400 hover:text-ink-200 inline-flex items-center gap-1"
      >
        <ArrowLeft size={12} /> Back to agents
      </button>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">
            {a.user?.firstName} {a.user?.lastName}
          </h1>
          <p className="text-sm text-ink-400 mt-1">
            <span className="font-mono text-primary-300">{a.code}</span>
            {" · "}
            {a.user?.email}
            {a.user?.phone ? ` · ${a.user.phone}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {isPending && (
            <>
              <button
                onClick={approve}
                disabled={busy}
                className="px-3 py-1.5 bg-success hover:bg-success/80 text-white text-sm font-medium rounded inline-flex items-center gap-1 disabled:opacity-40"
              >
                <CheckCircle2 size={14} /> Approve
              </button>
              <button
                onClick={() => setRejectOpen(true)}
                disabled={busy}
                className="px-3 py-1.5 bg-danger hover:bg-danger/80 text-white text-sm font-medium rounded inline-flex items-center gap-1 disabled:opacity-40"
              >
                <XCircle size={14} /> Reject
              </button>
            </>
          )}
          {isApproved && (
            <>
              <button
                onClick={() => setPayoutOpen(true)}
                disabled={busy || Number(a.walletBalanceMinor) <= 0}
                title={
                  Number(a.walletBalanceMinor) <= 0
                    ? "No earned commission to pay out"
                    : ""
                }
                className="px-3 py-1.5 bg-primary-700 hover:bg-primary-600 text-white text-sm font-medium rounded inline-flex items-center gap-1 disabled:opacity-40"
              >
                <Send size={14} /> Pay out
              </button>
              <button
                onClick={suspend}
                disabled={busy}
                className="px-3 py-1.5 bg-ink-800 hover:bg-ink-700 text-ink-200 text-sm font-medium rounded inline-flex items-center gap-1"
              >
                <Ban size={14} /> Suspend
              </button>
            </>
          )}
        </div>
      </div>

      {/* Status banner */}
      {isRejected && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 text-sm text-danger">
          Application was rejected
          {a.decisionReason ? ` — ${a.decisionReason}` : ""}.
        </div>
      )}
      {isSuspended && (
        <div className="bg-ink-800 border border-ink-700 rounded-lg p-4 text-sm text-ink-300">
          Account is suspended
          {a.decisionReason ? ` — ${a.decisionReason}` : ""}.
        </div>
      )}

      {/* Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Wallet balance"
          value={formatNgn(data.totals.walletBalanceMinor)}
          icon={Wallet}
          sub="Owed and unpaid"
        />
        <KpiCard
          label="Lifetime earned"
          value={formatNgn(data.totals.lifetimeEarnedMinor)}
          icon={TrendingUp}
          sub={`${data.totals.ordersCount} order${data.totals.ordersCount === 1 ? "" : "s"}`}
        />
        <KpiCard
          label="Lifetime paid"
          value={formatNgn(data.totals.lifetimePaidMinor)}
          icon={Banknote}
          sub="Already disbursed"
        />
      </div>

      {/* Bank + commission */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-ink-900 border border-ink-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-ink-100 mb-3">
            Bank account
          </h3>
          <dl className="text-sm space-y-1.5">
            <Row label="Account name" value={a.bankAccountName} />
            <Row label="Account number" value={a.bankAccountNumber} />
            <Row label="Bank code" value={a.bankCode} />
          </dl>
        </div>

        <div className="bg-ink-900 border border-ink-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-ink-100 mb-3">
            Commission rate
          </h3>
          <p className="text-xs text-ink-400 mb-2">
            Leave blank to use the global rate. Override only when this agent
            has a special arrangement.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.01"
              min={0}
              max={100}
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
              placeholder="—"
              className="w-24 px-3 py-2 bg-ink-950 border border-ink-700 rounded text-sm text-white caret-white"
            />
            <span className="text-xs text-ink-500">%</span>
            <button
              onClick={saveRate}
              disabled={savingRate}
              className="ml-auto px-3 py-2 bg-primary-700 hover:bg-primary-600 text-white text-xs font-medium rounded inline-flex items-center gap-1"
            >
              <Save size={12} /> {savingRate ? "…" : "Save"}
            </button>
          </div>
        </div>
      </div>

      {/* Attributions */}
      <div className="bg-ink-900 border border-ink-700 rounded-xl">
        <div className="px-5 py-3 border-b border-ink-700 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink-100 flex items-center gap-2">
            <ReceiptText size={14} /> Recent attributions
          </h3>
          <span className="text-xs text-ink-500">
            {data.recentAttributions.length} shown
          </span>
        </div>
        {data.recentAttributions.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-400">
            No attributions yet — once an order with this agent&apos;s code is
            paid, it will appear here.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-ink-950 border-b border-ink-700">
              <tr className="text-left text-xs text-ink-400 uppercase tracking-wider">
                <th className="px-4 py-2 font-medium">Order</th>
                <th className="px-4 py-2 font-medium">Channel</th>
                <th className="px-4 py-2 font-medium text-right">Order total</th>
                <th className="px-4 py-2 font-medium text-right">Rate</th>
                <th className="px-4 py-2 font-medium text-right">Commission</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Earned</th>
              </tr>
            </thead>
            <tbody>
              {data.recentAttributions.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-ink-800 last:border-0"
                >
                  <td className="px-4 py-2 text-ink-100 font-mono text-xs">
                    {row.orderNumber}
                  </td>
                  <td className="px-4 py-2 text-ink-400 text-xs">
                    {row.channel}
                  </td>
                  <td className="px-4 py-2 text-right text-ink-300">
                    {formatNgn(row.orderTotalMinor)}
                  </td>
                  <td className="px-4 py-2 text-right text-ink-400 text-xs">
                    {(row.commissionRateBps / 100).toFixed(2)}%
                  </td>
                  <td className="px-4 py-2 text-right text-ink-100 font-semibold">
                    {formatNgn(row.commissionMinor)}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${ATTR_STATUS_STYLES[row.status]}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-ink-400 text-xs">
                    {row.earnedAt
                      ? new Date(row.earnedAt).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Payouts */}
      <div className="bg-ink-900 border border-ink-700 rounded-xl">
        <div className="px-5 py-3 border-b border-ink-700">
          <h3 className="text-sm font-semibold text-ink-100">Payout history</h3>
        </div>
        {data.recentPayouts.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-400">
            No payouts yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-ink-950 border-b border-ink-700">
              <tr className="text-left text-xs text-ink-400 uppercase tracking-wider">
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium text-right">Amount</th>
                <th className="px-4 py-2 font-medium text-right">Orders</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Provider ref</th>
              </tr>
            </thead>
            <tbody>
              {data.recentPayouts.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-ink-800 last:border-0"
                >
                  <td className="px-4 py-2 text-ink-300 text-xs">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right text-ink-100 font-semibold">
                    {formatNgn(row.amountMinor)}
                  </td>
                  <td className="px-4 py-2 text-right text-ink-300">
                    {row.attributionCount}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${PAYOUT_STATUS_STYLES[row.status]}`}
                    >
                      {row.status}
                    </span>
                    {row.failureReason ? (
                      <p className="text-[10px] text-danger mt-1">
                        {row.failureReason}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-ink-500 text-xs font-mono">
                    {row.providerReference ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Reject modal */}
      {rejectOpen && (
        <Modal
          open={rejectOpen}
          onClose={() => setRejectOpen(false)}
          title="Reject this agent?"
        >
          <p className="text-sm text-ink-300">
            Rejection is final — the account will be permanently disabled.
          </p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            placeholder="Reason (optional)"
            className="w-full mt-3 px-3 py-2 bg-ink-950 border border-ink-700 rounded text-sm text-white caret-white"
          />
          <div className="flex gap-2 justify-end mt-4">
            <button
              onClick={() => setRejectOpen(false)}
              className="px-3 py-1.5 bg-ink-800 hover:bg-ink-700 text-ink-200 text-sm rounded"
            >
              Cancel
            </button>
            <button
              onClick={reject}
              disabled={busy}
              className="px-3 py-1.5 bg-danger hover:bg-danger/80 text-white text-sm font-medium rounded disabled:opacity-40"
            >
              Reject agent
            </button>
          </div>
        </Modal>
      )}

      {/* Payout confirm modal */}
      {payoutOpen && (
        <Modal
          open={payoutOpen}
          onClose={() => setPayoutOpen(false)}
          title="Confirm payout"
        >
          <p className="text-sm text-ink-300">
            Disburse <strong className="text-ink-100">
              {formatNgn(a.walletBalanceMinor)}
            </strong>{" "}
            via Paystack transfer to:
          </p>
          <div className="bg-ink-950 border border-ink-700 rounded p-3 mt-3 text-sm">
            <div className="text-ink-100 font-semibold">
              {a.bankAccountName}
            </div>
            <div className="text-ink-400 text-xs mt-0.5">
              {a.bankAccountNumber} · Bank code {a.bankCode}
            </div>
          </div>
          <p className="text-xs text-ink-500 mt-3">
            All EARNED attributions will be marked PAID and the agent&apos;s
            wallet debited.
          </p>
          <div className="flex gap-2 justify-end mt-4">
            <button
              onClick={() => setPayoutOpen(false)}
              className="px-3 py-1.5 bg-ink-800 hover:bg-ink-700 text-ink-200 text-sm rounded"
            >
              Cancel
            </button>
            <button
              onClick={runPayout}
              disabled={busy}
              className="px-3 py-1.5 bg-primary-700 hover:bg-primary-600 text-white text-sm font-medium rounded disabled:opacity-40"
            >
              {busy ? "Sending…" : "Send payout"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-400 text-xs">{label}</dt>
      <dd className="text-ink-100 text-xs font-mono">{value}</dd>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  value: string;
  icon: typeof Wallet;
  sub?: string;
}) {
  return (
    <div className="bg-ink-900 border border-ink-700 rounded-xl p-4">
      <div className="flex items-center gap-2 text-xs text-ink-400 mb-2">
        <Icon size={14} /> {label}
      </div>
      <p className="text-2xl font-bold text-ink-100">{value}</p>
      {sub ? <p className="text-xs text-ink-500 mt-1">{sub}</p> : null}
    </div>
  );
}
