"use client";

import { Menu } from "lucide-react";
import { useSidebar } from "./SidebarContext";

interface TopBarProps {
  title: string;
}

export default function TopBar({ title }: TopBarProps) {
  const { openMobile } = useSidebar();

  return (
    <header className="sticky top-0 z-30 flex h-14 sm:h-16 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/90 backdrop-blur-md px-4 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={openMobile}
        aria-label="Open menu"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <h2 className="min-w-0 flex-1 truncate text-[16px] sm:text-[18px] font-semibold text-[var(--color-text-primary)] tracking-tight">
        {title}
      </h2>
    </header>
  );
}
