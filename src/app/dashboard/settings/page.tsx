"use client";

import TopBar from "@/components/layout/TopBar";
import { Clock, CalendarDays, Globe, Info } from "lucide-react";

const TIMEZONE_LABELS: Record<string, string> = {
  "Asia/Kolkata": "Asia/Kolkata (IST)",
  "Asia/Dubai": "Asia/Dubai (GST)",
  "America/New_York": "America/New_York (EST)",
  "Europe/London": "Europe/London (GMT)",
};

const PUBLISHING_SCHEDULE = {
  timezone: "Asia/Kolkata",
  days: [
    { day: "Sunday", enabled: true, times: ["08:00"] },
    { day: "Tuesday", enabled: true, times: ["08:00"] },
    { day: "Thursday", enabled: true, times: ["08:00"] },
  ],
} as const;

function formatTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return time;

  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")} ${period}`;
}

export default function SchedulePage() {
  return (
    <div className="min-h-screen">
      <TopBar title="Schedule" />

      <div className="p-8">
        <div className="mb-8 animate-fade-in">
          <h2 className="text-[22px] font-bold text-[var(--color-text-primary)] tracking-tight">
            Publishing schedule
          </h2>
          <p className="text-[14px] text-[var(--color-text-muted)] mt-1.5">
            Your current content publishing days and times.
          </p>
        </div>

        {/* Timezone */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 mb-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <Globe className="h-5 w-5 text-blue-500 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-[12px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">
                Timezone
              </p>
              <p className="text-[14px] font-medium text-[var(--color-text-primary)]">
                {TIMEZONE_LABELS[PUBLISHING_SCHEDULE.timezone] ?? PUBLISHING_SCHEDULE.timezone}
              </p>
            </div>
          </div>
        </div>

        {/* Schedule days */}
        <div className="space-y-3 mb-6">
          {PUBLISHING_SCHEDULE.days.map((entry, index) => (
            <div
              key={entry.day}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 animate-fade-in"
              style={{ animationDelay: `${0.04 * index}s` }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                    <CalendarDays className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-[var(--color-text-primary)]">
                      {entry.day}
                    </p>
                    <span
                      className={`text-[12px] font-medium mt-0.5 ${
                        entry.enabled
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-[var(--color-text-muted)]"
                      }`}
                    >
                      {entry.enabled ? "Active" : "Paused"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  {entry.times.map((time) => (
                    <span
                      key={time}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-hover)] px-3 py-2 text-[13px] font-medium text-[var(--color-text-primary)]"
                    >
                      <Clock className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                      {formatTime(time)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hover)]/50 px-4 py-3.5 animate-fade-in">
          <Info className="h-4 w-4 text-[var(--color-text-muted)] shrink-0 mt-0.5" />
          <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed">
            This schedule is view only. Publishing days and times are configured in your n8n workflows.
          </p>
        </div>
      </div>
    </div>
  );
}
