"use client";

interface TopBarProps {
  title: string;
}

export default function TopBar({ title }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center bg-[var(--color-surface)]/80 backdrop-blur-md px-8">
      {/* Page Title */}
      <h2 className="text-[18px] font-semibold text-[var(--color-text-primary)] tracking-tight">
        {title}
      </h2>
    </header>
  );
}
