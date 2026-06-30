"use client";

import Sidebar from "@/components/layout/Sidebar";
import { SidebarProvider, useSidebar } from "@/components/layout/SidebarContext";

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { collapsed, mobileOpen, closeMobile, isMobile } = useSidebar();

  const mainMarginLeft = isMobile ? 0 : collapsed ? 68 : 250;

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-surface-alt)]">
      {isMobile && mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={closeMobile}
        />
      )}

      <Sidebar />

      <main
        className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 transition-[margin-left] duration-300 ease-in-out"
        style={{ marginLeft: mainMarginLeft }}
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
