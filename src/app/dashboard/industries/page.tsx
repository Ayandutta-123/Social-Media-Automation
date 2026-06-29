"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import TopBar from "@/components/layout/TopBar";
import StatCard from "@/components/ui/StatCard";
import { mockIndustries } from "@/lib/mock-data";
import { triggerTrendResearch } from "@/app/actions/n8n";
import { addIndustry, deleteIndustry, toggleIndustryStatus } from "@/app/actions/db";
import {
  GripVertical,
  Power,
  BarChart3,
  Clock,
  Plus,
  Trash2,
  X,
  Building2,
  Activity,
  FileText,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function IndustriesPage() {
  const { data: industries = [], isLoading, mutate } = useSWR("/api/postgres/industries", fetcher, {
    refreshInterval: 10000,
    fallbackData: mockIndustries,
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showAddModal) {
        setShowAddModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showAddModal]);

  const activeCount = industries.filter((i: any) => i.isActive).length;
  const totalGenerated = industries.reduce(
    (sum: number, i: any) => sum + i.postsGenerated,
    0
  );

  const toggleActive = async (id: string) => {
    const industry = industries.find((i: any) => i.id === id);
    if (!industry) return;

    // Optimistic
    mutate(
      industries.map((i: any) => (i.id === id ? { ...i, isActive: !i.isActive } : i)),
      false
    );

    // DB Update
    const result = await toggleIndustryStatus(id, industry.isActive);
    if (!result.success) mutate(); // Revert on failure
  };

  const removeIndustry = async (id: string) => {
    // Optimistic
    mutate(industries.filter((i: any) => i.id !== id), false);

    // DB Update
    const result = await deleteIndustry(id);
    if (!result.success) mutate(); // Revert on failure
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const name = newName.trim();

    // Optimistic Update with a temporary ID
    const tempId = String(Date.now());
    mutate([
      ...industries,
      {
        id: tempId,
        name: name,
        isActive: true,
        rotationOrder: industries.length + 1,
        postsGenerated: 0,
      },
    ], false);

    setNewName("");
    setShowAddModal(false);

    // 1. Insert into Postgres
    const dbResult = await addIndustry(name);

    if (!dbResult.success) {
      console.error("Failed to add industry to DB:", dbResult.error);
      mutate(); // Revert optimistic update
      return;
    }

    const realId = dbResult.id;

    // Update optimistic UI with real DB ID
    mutate([
      ...industries,
      {
        id: realId,
        name: name,
        isActive: true,
        rotationOrder: industries.length + 1,
        postsGenerated: 0,
      },
    ], false);

    // 2. Trigger n8n webhook with the new Postgres ID
    const result = await triggerTrendResearch(realId);
    if (!result.success) {
      console.error("Failed to trigger n8n webhook for trend research:", result.error);
      // We don't revert the DB insert here, as the industry was successfully added to the filing cabinet,
      // n8n just failed to do an immediate one-off research run.
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="min-h-screen">
      <TopBar title="Industries" />

      <div className="p-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatCard
            label="Total industries"
            value={industries.length}
            subLabel="In rotation pool"
            icon={Building2}
            iconBgClass="bg-blue-50 dark:bg-blue-500/10"
            iconColorClass="text-blue-500 dark:text-blue-400"
            className="animate-fade-in stagger-1"
          />
          <StatCard
            label="Active industries"
            value={activeCount}
            subLabel="Currently in rotation"
            icon={Activity}
            iconBgClass="bg-emerald-50 dark:bg-emerald-500/10"
            iconColorClass="text-emerald-500 dark:text-emerald-400"
            className="animate-fade-in stagger-2"
          />
          <StatCard
            label="Posts generated"
            value={totalGenerated}
            subLabel="Across all industries"
            icon={FileText}
            iconBgClass="bg-purple-50 dark:bg-purple-500/10"
            iconColorClass="text-purple-500 dark:text-purple-400"
            className="animate-fade-in stagger-3"
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16px] font-semibold text-[var(--color-text-primary)]">
            Industry rotation
          </h3>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-[13px] font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] focus:border-blue-300 focus:ring-2 focus:ring-blue-100 outline-none transition-all shadow-sm active:scale-[0.98]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add industry
          </button>
        </div>

        {/* Industries List */}
        <div className="space-y-2 animate-fade-in">
          {isLoading && industries.length === 0 ? (
            <div className="flex justify-center p-8 text-[13px] text-[var(--color-text-muted)]">
              Loading industries...
            </div>
          ) : industries.length > 0 ? (
            industries.map((industry: any, index: number) => (
              <div
                key={industry.id}
                draggable
                onDragStart={(e) => {
                  setDraggedIdx(index);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", index.toString());
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedIdx === null || draggedIdx === index) return;
                  const newIndustries = [...industries];
                  const [removed] = newIndustries.splice(draggedIdx, 1);
                  newIndustries.splice(index, 0, removed);

                  const updatedIndustries = newIndustries.map((ind, i) => ({
                    ...ind,
                    rotationOrder: i + 1
                  }));

                  mutate(updatedIndustries, false);
                  setDraggedIdx(null);
                }}
                onDragEnd={() => setDraggedIdx(null)}
                className={`flex items-center gap-4 rounded-xl border bg-[var(--color-surface)] p-4 transition-all duration-200 hover:shadow-md animate-fade-in ${draggedIdx === index ? "opacity-40" : ""
                  } ${industry.isActive
                    ? "border-[var(--color-border)] hover:border-[var(--color-border-hover)]"
                    : "border-[var(--color-border)] opacity-60"
                  }`}
                style={{ animationDelay: `${0.04 * index}s` }}
              >
                {/* Drag Handle */}
                <div className="cursor-grab text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]">
                  <GripVertical className="h-4 w-4" />
                </div>



                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-[var(--color-text-primary)]">
                    {industry.name}
                  </p>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="inline-flex items-center gap-1 text-[12px] text-[var(--color-text-muted)]">
                      <BarChart3 className="h-3 w-3" />
                      {industry.postsGenerated} posts
                    </span>
                    <span className="inline-flex items-center gap-1 text-[12px] text-[var(--color-text-muted)]">
                      <Clock className="h-3 w-3" />
                      Last: {formatDate(industry.lastUsed)}
                    </span>
                  </div>
                </div>

                {/* Toggle */}
                <button
                  onClick={() => toggleActive(industry.id)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${industry.isActive ? "bg-emerald-500" : "bg-[var(--color-border-hover)]"
                    }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-[var(--color-surface)] shadow-sm transition-transform ${industry.isActive ? "translate-x-6" : "translate-x-1"
                      }`}
                  />
                </button>

                {/* Status */}
                <span
                  className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${industry.isActive ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--color-text-muted)]"
                    }`}
                >
                  <Power className="h-3.5 w-3.5" />
                  {industry.isActive ? "Active" : "Paused"}
                </span>

                {/* Delete Button */}
                <button
                  onClick={() => removeIndustry(industry.id)}
                  className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          ) : (
            <div className="flex justify-center p-8 text-[13px] text-[var(--color-text-muted)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl">
              No industries found. Add one to start tracking trends.
            </div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowAddModal(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[16px] font-semibold text-[var(--color-text-primary)]">
                Add industry
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-[var(--color-surface-hover)] transition-colors"
              >
                <X className="h-4 w-4 text-[var(--color-text-muted)]" />
              </button>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5">
                Industry name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Healthcare IoT"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-blue-300 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
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
                Add industry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
