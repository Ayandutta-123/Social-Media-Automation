"use client";

import { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import TopBar from "@/components/layout/TopBar";
import StatCard from "@/components/ui/StatCard";
import { mockCompetitors } from "@/lib/mock-data";
import { Competitor, CompetitorPlatform } from "@/types";
import { triggerCompetitorScrape } from "@/app/actions/n8n";
import { addCompetitor, deleteCompetitor, toggleCompetitorStatus } from "@/app/actions/db";
import {
  Plus,
  Camera,
  Briefcase,
  MoreHorizontal,
  RefreshCw,
  Pause,
  Play,
  Trash2,
  ExternalLink,
  X,
  Users,
  Activity,
  FileText,
} from "lucide-react";

// Lucide v0.400+ removed brand icons (Instagram, Linkedin).
// We use Camera (Instagram) and Briefcase (LinkedIn) as visual stand-ins.
const PlatformIcon = ({
  platform,
  className,
}: {
  platform: string;
  className?: string;
}) =>
  platform === "Instagram" ? (
    <Camera className={className ?? "h-4 w-4 text-pink-500"} />
  ) : (
    <Briefcase className={className ?? "h-4 w-4 text-blue-600"} />
  );

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function CompetitorsPage() {
  const { data: competitors = [], isLoading, mutate } = useSWR<Competitor[]>("/api/postgres/competitors", fetcher, {
    refreshInterval: 10000,
    fallbackData: mockCompetitors,
  });

  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showAddModal) {
        setShowAddModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showAddModal]);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [newCompetitor, setNewCompetitor] = useState({
    name: "",
    instagramHandle: "",
    linkedinUrl: "",
  });
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    if (openMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenu]);

  // Filter out competitors that are currently being deleted so they don't flash back
  const visibleCompetitors = competitors.filter((c) => !deletingIds.has(c.id));
  const activeCount = visibleCompetitors.filter((c) => c.status === "Active").length;
  const totalTracked = visibleCompetitors.reduce((sum, c) => sum + c.postsTracked, 0);

  const handleAdd = async () => {
    if (!newCompetitor.name) return;
    if (!newCompetitor.instagramHandle && !newCompetitor.linkedinUrl) return;

    setShowAddModal(false);

    const platformsToAdd: { platform: CompetitorPlatform; url: string }[] = [];
    if (newCompetitor.instagramHandle) {
      platformsToAdd.push({ platform: "Instagram", url: newCompetitor.instagramHandle });
    }
    if (newCompetitor.linkedinUrl) {
      platformsToAdd.push({ platform: "LinkedIn", url: newCompetitor.linkedinUrl });
    }

    setNewCompetitor({ name: "", instagramHandle: "", linkedinUrl: "" });

    const payloadForN8n: any = {
      companyName: newCompetitor.name,
    };

    for (const p of platformsToAdd) {
      const tempId = String(Date.now() + Math.random());
      const comp: Competitor = {
        id: tempId,
        name: newCompetitor.name,
        platform: p.platform,
        handleOrUrl: p.url,
        status: "Active",
        postsTracked: 0,
      };

      // Optimistic UI update
      mutate((current = []) => [...current, comp], false);

      // 1. Insert into Postgres
      const dbResult = await addCompetitor(comp.name, comp.platform, comp.handleOrUrl);

      if (!dbResult.success) {
        console.error(`Failed to add ${p.platform} competitor to DB:`, dbResult.error);
        mutate(); // Revert
        continue;
      }

      const realId = dbResult.id;

      // Update optimistic UI with real ID
      mutate((current = []) => current.map(c => c.id === tempId ? { ...c, id: realId } : c), false);

      if (comp.platform === "Instagram") {
        payloadForN8n.instagramId = realId;
        payloadForN8n.instagramUrl = comp.handleOrUrl.trim();
      } else if (comp.platform === "LinkedIn") {
        payloadForN8n.linkedinId = realId;
        payloadForN8n.linkedinUrl = comp.handleOrUrl.trim();
      }
    }

    if (payloadForN8n.instagramId || payloadForN8n.linkedinId) {
      // 2. Trigger n8n webhook with a single combined payload
      triggerCompetitorScrape(payloadForN8n).catch(err => {
        console.error("Failed to trigger n8n webhook:", err);
      });
    }
  };

  // DB Integrated status toggles and deletes
  const toggleStatus = async (id: string) => {
    const comp = competitors.find(c => c.id === id);
    if (!comp) return;

    // Optimistic
    mutate(
      competitors.map((c) =>
        c.id === id ? { ...c, status: c.status === "Active" ? "Paused" : "Active" } : c
      ),
      false
    );
    setOpenMenu(null);

    // DB Update
    const result = await toggleCompetitorStatus(id, comp.status);
    mutate(); // Always refresh to sync with DB
  };

  const removeCompetitor = async (id: string) => {
    // 1. Mark as deleting so SWR refreshes won't flash it back
    setDeletingIds((prev) => new Set(prev).add(id));
    setOpenMenu(null);

    // 2. Delete from DB
    try {
      const result = await deleteCompetitor(id);
      console.log("Delete result for", id, ":", result);
    } catch (error) {
      console.error("Failed to delete competitor:", error);
    }

    // 3. Revalidate from DB, then remove from deletingIds
    await mutate();
    setDeletingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const toExternalUrl = (platform: string, handleOrUrl: string) => {
    const value = handleOrUrl.trim();
    if (!value) return "#";
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith("//")) return `https:${value}`;

    if (platform === "Instagram") {
      const handle = value.replace(/^@/, "");
      return `https://www.instagram.com/${handle}`;
    }

    if (platform === "LinkedIn") {
      return `https://${value.replace(/^\/+/, "")}`;
    }

    return `https://${value.replace(/^\/+/, "")}`;
  };

  return (
    <div className="min-h-screen">
      <TopBar title="Competitors" />

      <div className="p-4 sm:p-6 lg:p-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 sm:mb-12">
          <StatCard
            label="Total competitors"
            value={visibleCompetitors.length}
            subLabel="Across all platforms"
            icon={Users}
            iconBgClass="bg-blue-50 dark:bg-blue-500/10"
            iconColorClass="text-blue-500 dark:text-blue-400"
            className="animate-fade-in stagger-1"
          />
          <StatCard
            label="Active tracking"
            value={activeCount}
            subLabel="Being monitored"
            icon={Activity}
            iconBgClass="bg-emerald-50 dark:bg-emerald-500/10"
            iconColorClass="text-emerald-500 dark:text-emerald-400"
            className="animate-fade-in stagger-2"
          />
          <StatCard
            label="Posts tracked"
            value={totalTracked}
            subLabel="Total posts analyzed"
            icon={FileText}
            iconBgClass="bg-purple-50 dark:bg-purple-500/10"
            iconColorClass="text-purple-500 dark:text-purple-400"
            className="animate-fade-in stagger-3"
          />
        </div>

        {/* Header + Add Button */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <h3 className="text-[16px] font-semibold text-[var(--color-text-primary)]">
            Tracked competitors
          </h3>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-[13px] font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] focus:border-blue-300 focus:ring-2 focus:ring-blue-100 outline-none transition-all shadow-sm active:scale-[0.98]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add competitor
          </button>
        </div>

        {/* Competitors Table */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-x-auto animate-fade-in">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-table-header)]">
                <th className="text-left px-5 py-3 text-[12px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  Competitor
                </th>
                <th className="text-left px-5 py-3 text-[12px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  Platform
                </th>
                <th className="text-left px-5 py-3 text-[12px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  Handle / URL
                </th>
                <th className="text-left px-5 py-3 text-[12px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-5 py-3 text-[12px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  Last scraped
                </th>
                <th className="text-left px-5 py-3 text-[12px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  Posts
                </th>
                <th className="text-right px-5 py-3 text-[12px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && visibleCompetitors.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-[13px] text-[var(--color-text-muted)]">
                    Loading competitors...
                  </td>
                </tr>
              ) : visibleCompetitors.length > 0 ? (
                visibleCompetitors.map((comp, index) => (
                  <tr
                    key={comp.id}
                    className="border-b border-[var(--color-border-light)] hover:bg-[var(--color-table-header)] transition-colors animate-fade-in"
                    style={{ animationDelay: `${0.04 * index}s` }}
                  >
                    <td className="px-5 py-5">
                      <p className="text-[13.5px] font-semibold text-[var(--color-text-primary)]">
                        {comp.name}
                      </p>
                    </td>
                    <td className="px-5 py-5">
                      <span className="inline-flex items-center gap-1.5 text-[13px] text-[var(--color-text-secondary)]">
                        <PlatformIcon platform={comp.platform} />
                        {comp.platform}
                      </span>
                    </td>
                    <td className="px-5 py-5">
                      <a
                        href={toExternalUrl(comp.platform, comp.handleOrUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[13px] text-blue-600 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {comp.handleOrUrl}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </td>
                    <td className="px-5 py-5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${comp.status === "Active"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400"
                          : "bg-[var(--color-chip-bg)] border-[var(--color-chip-border)] text-[var(--color-text-secondary)]"
                          }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${comp.status === "Active"
                            ? "bg-emerald-500"
                            : "bg-[var(--color-text-muted)]"
                            }`}
                        />
                        {comp.status}
                      </span>
                    </td>
                    <td className="px-5 py-5 text-[13px] text-[var(--color-text-secondary)]">
                      {formatDate(comp.lastScraped)}
                    </td>
                    <td className="px-5 py-5 text-[13px] font-medium text-[var(--color-text-primary)]">
                      {comp.postsTracked}
                    </td>
                    <td className="px-5 py-5 text-right relative">
                      <div ref={openMenu === comp.id ? menuRef : undefined}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenu(openMenu === comp.id ? null : comp.id);
                          }}
                          className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] transition-colors"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {openMenu === comp.id && (
                          <div className="absolute right-5 bottom-full mb-1 w-44 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-1.5 shadow-lg z-50 animate-fade-in">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeCompetitor(comp.id);
                              }}
                              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-red-600 hover:bg-red-50 transition-colors rounded-lg"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-[13px] text-[var(--color-text-muted)]">
                    No competitors found. Add one to start tracking.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Competitor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowAddModal(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[16px] font-semibold text-[var(--color-text-primary)]">
                Add competitor
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-[var(--color-surface-hover)] transition-colors"
              >
                <X className="h-4 w-4 text-[var(--color-text-muted)]" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5">
                  Company name
                </label>
                <input
                  type="text"
                  value={newCompetitor.name}
                  onChange={(e) =>
                    setNewCompetitor((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="e.g. SmartCityTech"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-blue-300 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5 flex items-center gap-2">
                  <PlatformIcon platform="Instagram" className="h-4 w-4" />
                  Instagram handle
                </label>
                <input
                  type="text"
                  value={newCompetitor.instagramHandle}
                  onChange={(e) =>
                    setNewCompetitor((prev) => ({
                      ...prev,
                      instagramHandle: e.target.value,
                    }))
                  }
                  placeholder="@username (Optional)"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-blue-300 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5 flex items-center gap-2">
                  <PlatformIcon platform="LinkedIn" className="h-4 w-4" />
                  LinkedIn URL
                </label>
                <input
                  type="text"
                  value={newCompetitor.linkedinUrl}
                  onChange={(e) =>
                    setNewCompetitor((prev) => ({
                      ...prev,
                      linkedinUrl: e.target.value,
                    }))
                  }
                  placeholder="linkedin.com/company/... (Optional)"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-blue-300 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 rounded-lg border border-[var(--color-border)] px-4 py-2.5 text-[13px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-[13px] font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] focus:border-blue-300 focus:ring-2 focus:ring-blue-100 outline-none transition-all shadow-sm active:scale-[0.98]"
              >
                Add competitor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
