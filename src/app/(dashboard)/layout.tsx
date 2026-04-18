"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-ink-900 flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-primary-500" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const sidebarWidth = collapsed ? 64 : 260;

  return (
    <div className="min-h-screen bg-ink-900">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <TopBar sidebarWidth={sidebarWidth} />
      <main
        className="transition-all duration-[220ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ marginLeft: sidebarWidth, paddingTop: 64 }}
      >
        <div className="p-6 min-h-[calc(100vh-64px)]">
          {children}
        </div>
      </main>
    </div>
  );
}
