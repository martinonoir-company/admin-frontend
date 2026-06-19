"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import {
  LayoutDashboard,
  Receipt,
  Megaphone,
  Undo2,
  FileBarChart2,
  ShieldCheck,
} from "lucide-react";

const SUBNAV = [
  { href: "/accounting", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/accounting/expenses", label: "Expenses", icon: Receipt },
  { href: "/accounting/commissions", label: "Agent Commissions", icon: Megaphone },
  { href: "/accounting/refunds", label: "Refunds", icon: Undo2 },
  { href: "/accounting/reports", label: "Reports", icon: FileBarChart2 },
  { href: "/accounting/audit", label: "Audit Log", icon: ShieldCheck },
];

/**
 * Accounting layout: page-wide background, sub-navigation, content slot.
 * Sticks the sub-nav under the topbar so it stays accessible while
 * scrolling long expense / report tables.
 */
export default function AccountingLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-5">
      <div className="sticky top-0 z-10 -mx-4 px-4 py-3 bg-ink-950/95 backdrop-blur supports-[backdrop-filter]:bg-ink-950/80 border-b border-ink-800">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {SUBNAV.map((item) => {
            const Icon = item.icon;
            const active = item.exact
              ? pathname === item.href
              : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-150 whitespace-nowrap ${
                  active
                    ? "bg-[#C9A96E] text-ink-950"
                    : "text-ink-400 hover:text-ink-100 hover:bg-ink-800"
                }`}
              >
                <Icon size={13} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}
