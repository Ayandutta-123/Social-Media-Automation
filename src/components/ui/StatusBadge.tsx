"use client";

import { ContentStatus } from "@/types";

interface StatusBadgeProps {
  status: ContentStatus;
  size?: "sm" | "md";
}

const statusConfig: Record<
  ContentStatus,
  { bg: string; text: string; dot: string }
> = {
  Draft: {
    bg: "bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800",
    text: "text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  Approved: {
    bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800",
    text: "text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  Published: {
    bg: "bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800",
    text: "text-blue-700 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  Rejected: {
    bg: "bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800",
    text: "text-red-700 dark:text-red-400",
    dot: "bg-red-500",
  },
};

export default function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full border font-medium
        ${config.bg} ${config.text}
        ${size === "sm" ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-[12px]"}
      `}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {status}
    </span>
  );
}
