import React from "react";
import { ORDER_STATUS_LABELS } from "@/lib/api";

const STATUS_STYLES: Record<string, string> = {
  // Order statuses
  PENDING_PAYMENT: "bg-warning/10 text-warning border-warning/20",
  PAID:            "bg-success/10 text-success border-success/20",
  PROCESSING:      "bg-primary-500/10 text-primary-400 border-primary-500/20",
  SHIPPED:         "bg-primary-700/15 text-primary-300 border-primary-700/30",
  DELIVERED:       "bg-success/15 text-success border-success/30",
  COMPLETED:       "bg-success/20 text-success border-success/40",
  CANCELLED:       "bg-danger/10 text-danger border-danger/20",
  REFUNDED:        "bg-ink-600/30 text-ink-300 border-ink-500/30",
  // Boolean
  active:          "bg-success/10 text-success border-success/20",
  inactive:        "bg-ink-600/30 text-ink-400 border-ink-500/30",
  featured:        "bg-[#C9A96E]/10 text-[#C9A96E] border-[#C9A96E]/20",
  // Generic
  yes:             "bg-success/10 text-success border-success/20",
  no:              "bg-ink-600/30 text-ink-400 border-ink-500/30",
};

interface StatusBadgeProps {
  status: string;
  label?: string;
  size?: "sm" | "md";
}

export function StatusBadge({ status, label, size = "sm" }: StatusBadgeProps) {
  const key = status.toUpperCase();
  const style = STATUS_STYLES[key] ?? STATUS_STYLES[status] ?? "bg-ink-600/30 text-ink-300 border-ink-500/30";
  const displayLabel = label ?? ORDER_STATUS_LABELS[key] ?? status;

  return (
    <span
      className={`
        inline-flex items-center font-semibold border rounded-full
        ${size === "sm" ? "text-[10px] px-2 py-0.5 tracking-wide uppercase" : "text-xs px-3 py-1"}
        ${style}
      `}
    >
      {displayLabel}
    </span>
  );
}

export function BoolBadge({ value, trueLabel = "Active", falseLabel = "Inactive" }: {
  value: boolean;
  trueLabel?: string;
  falseLabel?: string;
}) {
  return (
    <StatusBadge
      status={value ? "active" : "inactive"}
      label={value ? trueLabel : falseLabel}
    />
  );
}
