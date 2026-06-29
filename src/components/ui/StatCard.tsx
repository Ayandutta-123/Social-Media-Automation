"use client";

import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  subLabel: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  icon?: React.ElementType;
  iconColorClass?: string;
  iconBgClass?: string;
  className?: string;
}

export default function StatCard({
  label,
  value,
  subLabel,
  trend,
  trendValue,
  icon: Icon,
  iconColorClass = "text-blue-500 dark:text-blue-400",
  iconBgClass = "bg-blue-50 dark:bg-blue-500/10",
  className = "",
}: StatCardProps) {
  return (
    <div
      className={`group relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 pt-8 pb-6 transition-all duration-300 hover:shadow-lg hover:shadow-[var(--color-shadow)] hover:border-[var(--color-border-hover)] hover:-translate-y-0.5 ${className}`}
    >
      {/* Subtle gradient glow on hover */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/[0.02] to-purple-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      <div className="flex flex-col items-center justify-center text-center">
        <div className="flex items-center gap-2 mb-4">
          {Icon && (
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${iconBgClass} ${iconColorClass}`}>
              <Icon className="w-4 h-4" />
            </div>
          )}
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
            {label}
          </p>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <p className="text-[32px] font-extrabold text-[var(--color-text-primary)] leading-none tracking-tight">
            {value}
          </p>
          {trend && trendValue && (
            <span
              className={`inline-flex items-center gap-1 text-[12px] font-semibold px-2 py-0.5 rounded-full ${trend === "up"
                  ? "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/40"
                  : "text-red-500 bg-red-50 dark:text-red-400 dark:bg-red-950/40"
                }`}
            >
              {trend === "up" ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {trendValue}
            </span>
          )}
        </div>
      </div>
      <p className="relative text-[12px] text-[var(--color-text-muted)] mt-4 font-medium text-center">
        {subLabel}
      </p>
    </div>
  );
}
