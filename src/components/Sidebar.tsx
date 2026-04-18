"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  Tag,
  ClipboardList,
  Warehouse,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",  href: "/dashboard",  icon: LayoutDashboard },
  { label: "Products",   href: "/products",   icon: ShoppingBag },
  { label: "Categories", href: "/categories", icon: Tag },
  { label: "Orders",     href: "/orders",     icon: ClipboardList },
  { label: "Inventory",  href: "/inventory",  icon: Warehouse },
  { label: "Staff",      href: "/staff",       icon: Users },
  { label: "Settings",   href: "/settings",   icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <aside
      className={`
        fixed top-0 left-0 h-full bg-ink-800 border-r border-ink-700 z-40
        flex flex-col sidebar-transition overflow-hidden
        ${collapsed ? "w-16" : "w-[260px]"}
      `}
    >
      {/* Logo */}
      <div className={`flex items-center h-16 border-b border-ink-700 shrink-0 ${collapsed ? "justify-center px-0" : "px-5"}`}>
        {collapsed ? (
          <div className="w-8 h-8 bg-primary-700 rounded-md flex items-center justify-center">
            <span className="text-white font-bold text-xs">MN</span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary-700 rounded-md flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-xs">MN</span>
            </div>
            <div>
              <p className="text-sm font-bold text-ink-100 leading-tight">MARTINONOIR</p>
              <p className="text-[10px] text-ink-500 tracking-widest uppercase">Admin</p>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`
                flex items-center gap-3 mx-2 my-0.5 rounded-md transition-all duration-[120ms]
                ${collapsed ? "px-3 py-3 justify-center" : "px-3 py-2.5"}
                ${active
                  ? "bg-primary-700/15 text-primary-400 border border-primary-700/20"
                  : "text-ink-400 hover:text-ink-100 hover:bg-ink-700"
                }
              `}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && (
                <span className="text-sm font-medium">{item.label}</span>
              )}
              {active && !collapsed && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-500" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-ink-700 py-3 shrink-0">
        {/* User */}
        {!collapsed && user && (
          <div className="px-4 py-2 mb-1">
            <p className="text-xs font-semibold text-ink-200 truncate">{user.firstName} {user.lastName}</p>
            <p className="text-[11px] text-ink-500 truncate">{user.email}</p>
          </div>
        )}
        {/* Logout */}
        <button
          onClick={handleLogout}
          title={collapsed ? "Logout" : undefined}
          className={`
            flex items-center gap-3 mx-2 rounded-md text-ink-400 hover:text-danger hover:bg-danger/8
            transition-all duration-[120ms] w-[calc(100%-16px)]
            ${collapsed ? "px-3 py-3 justify-center" : "px-3 py-2.5"}
          `}
        >
          <LogOut size={16} className="shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Log out</span>}
        </button>
      </div>

      {/* Toggle button */}
      <button
        onClick={onToggle}
        className={`
          absolute top-1/2 -translate-y-1/2 -right-3 w-6 h-6
          bg-ink-700 border border-ink-600 rounded-full
          flex items-center justify-center text-ink-400 hover:text-ink-100
          hover:bg-ink-600 transition-colors duration-[120ms] shadow-md z-50
        `}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  );
}
