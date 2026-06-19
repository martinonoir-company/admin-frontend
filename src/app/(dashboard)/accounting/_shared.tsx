"use client";

import { useMemo, useState } from "react";
import { CalendarRange, ChevronDown } from "lucide-react";

/** Server returns minor units (kobo). Always convert through here. */
export function ngnFromKobo(kobo: number | string | undefined | null): string {
  if (kobo === null || kobo === undefined) return "—";
  const n = typeof kobo === "string" ? Number(kobo) : kobo;
  if (!Number.isFinite(n)) return "—";
  const naira = n / 100;
  return `₦${naira.toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

/** With kobo precision, useful for "0.50 kobo" cases in detail screens. */
export function ngnFromKoboPrecise(
  kobo: number | string | undefined | null,
): string {
  if (kobo === null || kobo === undefined) return "—";
  const n = typeof kobo === "string" ? Number(kobo) : kobo;
  if (!Number.isFinite(n)) return "—";
  const naira = n / 100;
  return `₦${naira.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** A signed delta with arrow + colour. Used on dashboard KPI cards. */
export function deltaPct(
  current: number,
  previous: number,
): { label: string; tone: "up" | "down" | "flat" } {
  if (!previous && !current) return { label: "—", tone: "flat" };
  if (!previous) return { label: "+∞%", tone: "up" };
  const d = ((current - previous) / Math.abs(previous)) * 100;
  if (!Number.isFinite(d)) return { label: "—", tone: "flat" };
  const sign = d > 0 ? "+" : "";
  const tone = d > 0 ? "up" : d < 0 ? "down" : "flat";
  return { label: `${sign}${d.toFixed(1)}%`, tone };
}

export type RangePreset = "today" | "7d" | "30d" | "mtd" | "qtd" | "ytd" | "custom";

function rangeFor(preset: RangePreset, custom: { from: string; to: string }): {
  from: string;
  to: string;
} {
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const start = (d: Date) => d.toISOString().slice(0, 10);
  switch (preset) {
    case "today":
      return { from: todayIso, to: todayIso };
    case "7d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      return { from: start(d), to: todayIso };
    }
    case "30d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      return { from: start(d), to: todayIso };
    }
    case "mtd": {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: start(d), to: todayIso };
    }
    case "qtd": {
      const q = Math.floor(now.getMonth() / 3) * 3;
      const d = new Date(now.getFullYear(), q, 1);
      return { from: start(d), to: todayIso };
    }
    case "ytd": {
      const d = new Date(now.getFullYear(), 0, 1);
      return { from: start(d), to: todayIso };
    }
    case "custom":
      return custom;
  }
}

const PRESET_LABEL: Record<RangePreset, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  mtd: "Month to date",
  qtd: "Quarter to date",
  ytd: "Year to date",
  custom: "Custom range",
};

interface DateRangeBarProps {
  range: { from: string; to: string };
  preset: RangePreset;
  onChange: (next: {
    preset: RangePreset;
    range: { from: string; to: string };
  }) => void;
  /** Optional trailing slot for export buttons etc. */
  right?: React.ReactNode;
}

export function DateRangeBar({
  range,
  preset,
  onChange,
  right,
}: DateRangeBarProps) {
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(range.from);
  const [customTo, setCustomTo] = useState(range.to);

  function pick(next: RangePreset) {
    onChange({
      preset: next,
      range:
        next === "custom"
          ? { from: customFrom, to: customTo }
          : rangeFor(next, { from: customFrom, to: customTo }),
    });
    setOpen(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 justify-between">
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 px-3 py-2 bg-ink-900 border border-ink-700 rounded-lg text-sm text-ink-100 hover:bg-ink-800"
        >
          <CalendarRange size={14} className="text-[#C9A96E]" />
          <span className="font-medium">{PRESET_LABEL[preset]}</span>
          <span className="text-xs text-ink-400">
            {range.from} → {range.to}
          </span>
          <ChevronDown size={12} className="text-ink-500" />
        </button>
        {open && (
          <div className="absolute z-20 mt-2 left-0 w-72 bg-ink-900 border border-ink-700 rounded-lg shadow-2xl p-2">
            <div className="grid grid-cols-2 gap-1">
              {(
                ["today", "7d", "30d", "mtd", "qtd", "ytd"] as RangePreset[]
              ).map((p) => (
                <button
                  key={p}
                  onClick={() => pick(p)}
                  className={`text-left px-2.5 py-1.5 rounded text-xs hover:bg-ink-800 ${
                    preset === p ? "bg-ink-800 text-ink-100" : "text-ink-300"
                  }`}
                >
                  {PRESET_LABEL[p]}
                </button>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-ink-700">
              <p className="text-[10px] uppercase tracking-wider text-ink-500 mb-1.5">
                Custom range
              </p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="px-2 py-1.5 bg-ink-950 border border-ink-700 rounded text-xs text-white caret-white"
                />
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="px-2 py-1.5 bg-ink-950 border border-ink-700 rounded text-xs text-white caret-white"
                />
              </div>
              <button
                onClick={() => pick("custom")}
                className="w-full mt-2 px-3 py-1.5 bg-[#C9A96E] hover:bg-[#b89859] text-ink-950 text-xs font-semibold rounded"
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>
      {right ? <div>{right}</div> : null}
    </div>
  );
}

/** Hook to keep range + preset together, persists to URL hash so refreshes preserve state. */
export function useDateRange(defaultPreset: RangePreset = "30d") {
  const initialRange = useMemo(
    () => rangeFor(defaultPreset, { from: "", to: "" }),
    [defaultPreset],
  );
  const [preset, setPreset] = useState<RangePreset>(defaultPreset);
  const [range, setRange] = useState(initialRange);
  return {
    preset,
    range,
    set: ({
      preset: p,
      range: r,
    }: {
      preset: RangePreset;
      range: { from: string; to: string };
    }) => {
      setPreset(p);
      setRange(r);
    },
  };
}
