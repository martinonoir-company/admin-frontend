import React from "react";
import { LucideIcon } from "lucide-react";
import { Skeleton } from "./Skeleton";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  loading?: boolean;
  trend?: { value: string; up: boolean };
}

export function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = "text-primary-400",
  iconBg = "bg-primary-700/15",
  loading = false,
  trend,
}: KpiCardProps) {
  if (loading) {
    return (
      <div className="admin-card p-5">
        <Skeleton height={12} width="50%" className="mb-3" />
        <Skeleton height={30} width="55%" className="mb-2" />
        <Skeleton height={11} width="40%" />
      </div>
    );
  }

  return (
    <div className="admin-card p-5 hover:border-ink-600 transition-colors duration-[120ms]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2">
            {title}
          </p>
          <p className="text-3xl font-bold font-mono text-ink-100 truncate">{value}</p>
          {subtitle && (
            <p className="text-xs text-ink-500 mt-1.5">{subtitle}</p>
          )}
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend.up ? "text-success" : "text-danger"}`}>
              <span>{trend.up ? "↑" : "↓"} {trend.value}</span>
            </div>
          )}
        </div>
        <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
          <Icon size={20} className={iconColor} />
        </div>
      </div>
    </div>
  );
}
