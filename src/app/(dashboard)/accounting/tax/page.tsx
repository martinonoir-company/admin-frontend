"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Landmark,
  Download,
  CornerDownRight,
  Receipt,
  Undo2,
} from "lucide-react";
import { accountingApi, VatReport } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import { DateRangeBar, ngnFromKobo, useDateRange } from "../_shared";

/**
 * VAT / Tax reporting tab.
 *
 * Three-section layout:
 *   1. Output VAT — VAT collected on sales (the 7.5% portion of gross
 *      revenue).
 *   2. Refunded VAT — VAT given back to customers on settled refunds.
 *      Reduces the period's VAT liability.
 *   3. Input VAT — VAT paid on expenses. Reduces liability. Zero in the
 *      MVP because expenses don't carry a VAT column yet; the row is
 *      surfaced so the column is visible when the capture is added.
 *
 * Net VAT payable = output VAT − refunded VAT − input VAT. That figure
 * is what gets remitted (or carried forward as a credit if negative).
 *
 * CSV export uses the same shape as the on-screen rows so a filing
 * prepared from the export reconciles directly against the dashboard.
 */
export default function TaxReportPage() {
  const toast = useToast();
  const { preset, range, set } = useDateRange("mtd");
  const [data, setData] = useState<VatReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await accountingApi.vatReport(range);
      setData(res.data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load VAT report");
    } finally {
      setLoading(false);
    }
  }, [range, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  function exportCsv() {
    if (!data) return;
    const taxPct = (data.salesTaxRate * 100).toFixed(2);
    const rows: string[][] = [
      ["VAT / Sales Tax Report"],
      ["Window", `${data.range.from} to ${data.range.to}`],
      [`Rate: ${taxPct}%`],
      [],
      ["Section", "Item", "Value (NGN)"],

      ["Output VAT", "Gross receipts (tax-inclusive)", toNaira(data.revenue.grossNgn)],
      ["Output VAT", "Net revenue", toNaira(data.revenue.netNgn)],
      ["Output VAT", `Output VAT collected (${taxPct}%)`, toNaira(data.revenue.vatNgn)],
      [],
      ["Refunded VAT", "Gross refunds (tax-inclusive)", toNaira(data.refunds.grossNgn)],
      ["Refunded VAT", "Net refunds", toNaira(data.refunds.netNgn)],
      [
        "Refunded VAT",
        `VAT refunded (${taxPct}%)`,
        `-${toNaira(data.refunds.vatNgn)}`,
      ],
      [],
      [
        "Input VAT",
        `On expenses (${data.inputVat.expensesCount} entries)`,
        `-${toNaira(data.inputVat.amountNgn)}`,
      ],
      [],
      ["", "Net VAT payable", toNaira(data.netVatPayableNgn)],
    ];
    const csv = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `martinonoir-vat-${data.range.from.slice(0, 10)}-to-${data.range.to.slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("VAT report exported.");
  }

  const taxPct = data ? (data.salesTaxRate * 100).toFixed(1) : "—";

  return (
    <div className="space-y-5 animate-fade-in">
      <DateRangeBar
        preset={preset}
        range={range}
        onChange={set}
        right={
          <button
            onClick={exportCsv}
            disabled={!data || loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-ink-800 hover:bg-ink-700 text-ink-100 text-sm rounded-lg border border-ink-700 disabled:opacity-40"
          >
            <Download size={13} />
            Export CSV
          </button>
        }
      />

      {/* Headline VAT payable */}
      <div className="relative bg-ink-900 border border-ink-700 rounded-2xl p-5 overflow-hidden">
        <div
          className="absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-10"
          style={{ background: "#22D3EE" }}
        />
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-ink-400 mb-2">
          <Landmark size={12} className="text-[#22D3EE]" />
          Net VAT payable for window
        </div>
        <div className="text-3xl font-bold text-ink-100">
          {loading ? "—" : ngnFromKobo(data?.netVatPayableNgn)}
        </div>
        <div
          className="mt-2 text-[11px] text-ink-500 leading-tight font-mono"
          title="Formula"
        >
          <span className="text-ink-600">ƒ</span> output VAT − VAT refunded − input VAT
        </div>
        <div className="mt-1.5 text-[11px] text-ink-500">
          Sales-tax rate <span className="font-mono text-ink-300">{taxPct}%</span>
        </div>
      </div>

      {/* Three buckets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Bucket
          title="Output VAT"
          subtitle="Collected on sales"
          icon={Receipt}
          accent="#C9A96E"
          rows={
            data
              ? [
                  {
                    label: "Gross receipts (tax-inclusive)",
                    value: data.revenue.grossNgn,
                    muted: true,
                    sub: `${data.revenue.ordersCount} paid orders`,
                  },
                  {
                    label: "Net revenue",
                    value: data.revenue.netNgn,
                    sub: "gross ÷ 1.075",
                  },
                  {
                    label: `Output VAT (${taxPct}%)`,
                    value: data.revenue.vatNgn,
                    bold: true,
                    sub: "gross − net",
                  },
                ]
              : []
          }
          loading={loading}
        />
        <Bucket
          title="Refunded VAT"
          subtitle="Returned to customers"
          icon={Undo2}
          accent="#F87171"
          rows={
            data
              ? [
                  {
                    label: "Gross refunds (tax-inclusive)",
                    value: data.refunds.grossNgn,
                    muted: true,
                    sub: `${data.refunds.requestsCount} refunds`,
                  },
                  {
                    label: "Net refunds",
                    value: data.refunds.netNgn,
                    sub: "gross ÷ 1.075",
                  },
                  {
                    label: `VAT refunded (${taxPct}%)`,
                    value: data.refunds.vatNgn,
                    bold: true,
                    sub: "reduces net VAT payable",
                  },
                ]
              : []
          }
          loading={loading}
        />
        <Bucket
          title="Input VAT"
          subtitle="Paid on business expenses"
          icon={CornerDownRight}
          accent="#A78BFA"
          rows={
            data
              ? [
                  {
                    label: `${data.inputVat.expensesCount} expense entries`,
                    value: data.inputVat.amountNgn,
                    bold: true,
                    sub:
                      data.inputVat.amountNgn === 0
                        ? "Input VAT capture not yet enabled."
                        : undefined,
                  },
                ]
              : []
          }
          loading={loading}
        />
      </div>

      {/* The reconciliation table */}
      <div className="bg-ink-900 border border-ink-700 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-ink-800">
          <h3 className="text-sm font-semibold text-ink-100">
            Net VAT payable — reconciliation
          </h3>
          <p className="text-[11px] text-ink-500 mt-0.5">
            Use these numbers directly on your filing. Net VAT and gross
            VAT-on-revenue match the figures on the Reports tab so the
            two reports cannot disagree.
          </p>
        </div>
        {!data ? (
          <p className="p-12 text-center text-sm text-ink-400">Loading…</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              <Row label="Output VAT collected" value={data.revenue.vatNgn} sign="+" />
              <Row
                label="Less: VAT refunded to customers"
                value={data.refunds.vatNgn}
                sign="-"
              />
              <Row
                label="Less: Input VAT (on expenses)"
                value={data.inputVat.amountNgn}
                sign="-"
              />
              <Row
                label="Net VAT payable"
                value={data.netVatPayableNgn}
                sign={data.netVatPayableNgn >= 0 ? "+" : "-"}
                bold
              />
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

interface BucketRow {
  label: string;
  value: number;
  sub?: string;
  bold?: boolean;
  muted?: boolean;
}

function Bucket({
  title,
  subtitle,
  icon: Icon,
  accent,
  rows,
  loading,
}: {
  title: string;
  subtitle: string;
  icon: typeof Receipt;
  accent: string;
  rows: BucketRow[];
  loading: boolean;
}) {
  return (
    <div className="relative bg-ink-900 border border-ink-700 rounded-xl overflow-hidden">
      <div
        className="absolute -right-6 -top-6 w-20 h-20 rounded-full opacity-10"
        style={{ background: accent }}
      />
      <div className="px-4 py-3 border-b border-ink-800">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink-400">
          <Icon size={11} style={{ color: accent }} />
          {title}
        </div>
        <div className="text-[10.5px] text-ink-500 mt-0.5">{subtitle}</div>
      </div>
      <div className="px-4 py-3 space-y-2">
        {loading ? (
          <p className="text-xs text-ink-500">—</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-ink-500">No data.</p>
        ) : (
          rows.map((r, i) => (
            <div key={i}>
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`text-[11px] ${r.muted ? "text-ink-500" : "text-ink-300"}`}
                >
                  {r.label}
                </span>
                <span
                  className={`font-mono ${r.bold ? "text-lg font-bold text-ink-100" : r.muted ? "text-sm text-ink-500" : "text-sm text-ink-200"}`}
                >
                  {ngnFromKobo(r.value)}
                </span>
              </div>
              {r.sub ? (
                <p className="text-[10px] text-ink-500 mt-0.5">{r.sub}</p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  sign,
  bold,
}: {
  label: string;
  value: number;
  sign: "+" | "-";
  bold?: boolean;
}) {
  const tone =
    sign === "-"
      ? "text-rose-400"
      : bold
        ? "text-ink-100"
        : "text-ink-300";
  return (
    <tr
      className={`border-b border-ink-800 last:border-0 ${
        bold ? "bg-ink-950/60" : ""
      }`}
    >
      <td
        className={`px-5 py-2.5 text-sm ${bold ? "font-semibold text-ink-100" : "text-ink-300"}`}
      >
        {label}
      </td>
      <td className={`px-5 py-2.5 text-right font-mono ${bold ? "text-xl font-bold" : "text-sm"} ${tone}`}>
        {sign === "-" ? "-" : ""}
        {ngnFromKobo(value)}
      </td>
    </tr>
  );
}

function toNaira(kobo: number): string {
  return (kobo / 100).toFixed(2);
}

function csvCell(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
