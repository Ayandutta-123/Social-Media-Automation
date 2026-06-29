"use client";

import Sidebar from "@/components/layout/Sidebar";
import { SidebarProvider, useSidebar } from "@/components/layout/SidebarContext";

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-surface-alt)]">
      <Sidebar />
      {/*
        Use inline style for the margin — Tailwind v4 purges dynamically
        constructed class names like `ml-[240px]` in template literals.
        Inline style is always safe and also gives us the smooth transition.
      */}
      <main
        className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 transition-[margin-left] duration-300 ease-in-out"
        style={{ marginLeft: collapsed ? "68px" : "250px" }}
      >
        {children}
      </main>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <DashboardShell>{children}</DashboardShell>
    </SidebarProvider>
  );
}
