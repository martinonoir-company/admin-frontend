"use client";

import React, { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronRight, Settings, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const ROUTE_LABELS: Record<string, string> = {
  "/dashboard":  "Dashboard",
  "/products":   "Products",
  "/categories": "Categories",
  "/orders":     "Orders",
  "/inventory":  "Inventory",
  "/staff":      "Staff",
  "/settings":   "Settings",
};

interface TopBarProps {
  sidebarWidth: number;
}

export function TopBar({ sidebarWidth }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [showUser, setShowUser] = useState(false);

  // Breadcrumb
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((seg, i) => {
    const path = "/" + segments.slice(0, i + 1).join("/");
    const label = ROUTE_LABELS[path] ?? (seg.length === 26 ? "Detail" : seg.charAt(0).toUpperCase() + seg.slice(1));
    return { label, path, isLast: i === segments.length - 1 };
  });

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <header
      className="fixed top-0 right-0 h-16 bg-ink-800 border-b border-ink-700 z-30 flex items-center px-5 gap-4"
      style={{ left: sidebarWidth }}
    >
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 flex-1 min-w-0" aria-label="Breadcrumb">
        <span className="text-xs text-ink-500">Admin</span>
        {crumbs.map((crumb) => (
          <React.Fragment key={crumb.path}>
            <ChevronRight size={12} className="text-ink-600 shrink-0" />
            {crumb.isLast ? (
              <span className="text-xs font-semibold text-ink-200 truncate">{crumb.label}</span>
            ) : (
              <button
                onClick={() => router.push(crumb.path)}
                className="text-xs text-ink-500 hover:text-ink-200 transition-colors truncate"
              >
                {crumb.label}
              </button>
            )}
          </React.Fragment>
        ))}
      </nav>

      {/* Right actions */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Notifications (decorative) */}
        <button className="relative p-2 text-ink-400 hover:text-ink-100 hover:bg-ink-700 rounded-md transition-colors">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-danger rounded-full" />
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setShowUser(!showUser)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-ink-700 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-primary-700/30 border border-primary-700/40 flex items-center justify-center">
              <span className="text-xs font-bold text-primary-400">
                {user ? `${user.firstName[0]}${user.lastName[0]}` : "?"}
              </span>
            </div>
            {user && (
              <div className="text-left hidden sm:block">
                <p className="text-xs font-semibold text-ink-200 leading-tight">{user.firstName} {user.lastName}</p>
                <p className="text-[10px] text-ink-500 leading-tight">{user.role?.replace("_", " ")}</p>
              </div>
            )}
          </button>

          {showUser && (
            <div
              className="absolute right-0 top-full mt-1 w-48 bg-ink-800 border border-ink-600 rounded-lg shadow-xl z-50 py-1 animate-scale-in"
              onMouseLeave={() => setShowUser(false)}
            >
              <div className="px-3 py-2 border-b border-ink-700 mb-1">
                <p className="text-xs font-semibold text-ink-200">{user?.firstName} {user?.lastName}</p>
                <p className="text-[11px] text-ink-500 truncate">{user?.email}</p>
              </div>
              <button
                onClick={() => { router.push("/settings"); setShowUser(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-ink-400 hover:text-ink-100 hover:bg-ink-700 transition-colors"
              >
                <Settings size={14} /> Settings
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-danger hover:bg-danger/8 transition-colors"
              >
                <LogOut size={14} /> Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
