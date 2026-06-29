"use client";

import { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import TopBar from "@/components/layout/TopBar";
import StatCard from "@/components/ui/StatCard";
import PostListItem from "@/components/modules/PostListItem";
import { dashboardStats, mockContentItems } from "@/lib/mock-data";
import { ContentItem, ContentStatus } from "@/types";
import { Filter, X, BarChart2, Edit3, CheckCircle, CalendarClock, Calendar, Clock } from "lucide-react";
import { FaInstagram, FaLinkedin, FaTwitter, FaYoutube, FaFacebook, FaTiktok } from "react-icons/fa";
import StatusBadge from "@/components/ui/StatusBadge";

const filterOptions: (ContentStatus | "All")[] = [
  "All",
  "Draft",
  "Approved",
  "Published",
  "Rejected",
];

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function formatPostDate(dateStr?: string): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function renderPlatformChips(platformString: string) {
  const platforms = platformString.split("+").map((p) => p.trim());

  const getIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes("instagram")) return <FaInstagram className="h-3 w-3 text-pink-500" />;
    if (lower.includes("linkedin")) return <FaLinkedin className="h-3 w-3 text-blue-500" />;
    if (lower.includes("twitter")) return <FaTwitter className="h-3 w-3 text-sky-400" />;
    if (lower.includes("youtube")) return <FaYoutube className="h-3 w-3 text-red-500" />;
    if (lower.includes("facebook")) return <FaFacebook className="h-3 w-3 text-blue-600" />;
    if (lower.includes("tiktok")) return <FaTiktok className="h-3 w-3 text-slate-800 dark:text-slate-200" />;
    return null;
  };

  return (
    <div className="flex items-center gap-1.5">
      {platforms.map((platform) => (
        <span
          key={platform}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border border-[var(--color-border)] bg-[var(--color-surface-hover)] text-black dark:text-white capitalize"
        >
          {getIcon(platform)}
          {platform}
        </span>
      ))}
    </div>
  );
}

function FormattedPostContent({ content, platform }: { content: string; platform: 'instagram' | 'linkedin' | 'default' }) {
  const paragraphs = content.split('\n');

  const highlightHashtags = (str: string) => {
    const parts = str.split(/(#\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('#')) {
        return (
          <span key={i} className="text-black dark:text-white font-bold hover:underline cursor-pointer">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="space-y-3 text-[14.5px] text-[var(--color-text-primary)] leading-relaxed">
      {paragraphs.map((para, i) => {
        if (!para.trim()) return <div key={i} className="h-0.5" />;
        return <p key={i}>{highlightHashtags(para)}</p>;
      })}
    </div>
  );
}

export default function DashboardPage() {
  // Use SWR to poll the Notion API route every 10 seconds.
  // We use the mock data as fallback until the real API connects.
  const { data: posts = [], isLoading } = useSWR<ContentItem[]>("/api/notion", fetcher, {
    refreshInterval: 10000,
    fallbackData: mockContentItems,
  });

  const [filter, setFilter] = useState<ContentStatus | "All">("All");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<ContentItem | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  const filteredPosts =
    filter === "All" ? posts : posts.filter((p) => p.status === filter);

  // Note: These manual action handlers (Approve, Reject, PostNow) 
  // were removed from the UI per previous request, but if kept, 
  // they should trigger a Next.js Server Action to update Notion 
  // via the Notion API, rather than mutating local state.
  const handleApprove = (id: string) => {
    console.log("Approve requested for", id);
  };

  const handleReject = (id: string) => {
    console.log("Reject requested for", id);
  };

  const handlePostNow = (id: string) => {
    console.log("Post Now requested for", id);
  };

  const handleView = (id: string) => {
    const post = posts.find((p) => p.id === id);
    if (post) setSelectedPost(post);
  };

  const handleGeneratePost = () => {
    // TODO: Trigger n8n webhook
    console.log("Generate post triggered");
  };

  useEffect(() => {
    if (!selectedPost) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedPost(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedPost]);

  // Close filter dropdown when clicking outside
  useEffect(() => {
    if (!filterOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setFilterOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [filterOpen]);

  return (
    <div className="min-h-screen min-w-0">
      <TopBar title="Content calendar" />

      <div className="p-8 min-w-0">
        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total posts"
            value={dashboardStats.totalPosts}
            subLabel={dashboardStats.totalPostsSubLabel}
            trend="up"
            trendValue="+12%"
            icon={BarChart2}
            iconBgClass="bg-blue-50 dark:bg-blue-500/10"
            iconColorClass="text-blue-500 dark:text-blue-400"
            className="animate-fade-in stagger-1"
          />
          <StatCard
            label="Drafts"
            value={dashboardStats.drafts}
            subLabel={dashboardStats.draftsSubLabel}
            icon={Edit3}
            iconBgClass="bg-amber-50 dark:bg-amber-500/10"
            iconColorClass="text-amber-500 dark:text-amber-400"
            className="animate-fade-in stagger-2"
          />
          <StatCard
            label="Published"
            value={dashboardStats.published}
            subLabel={dashboardStats.publishedSubLabel}
            trend="up"
            trendValue="+8%"
            icon={CheckCircle}
            iconBgClass="bg-emerald-50 dark:bg-emerald-500/10"
            iconColorClass="text-emerald-500 dark:text-emerald-400"
            className="animate-fade-in stagger-3"
          />
          <StatCard
            label="Next post"
            value={dashboardStats.nextPost}
            subLabel={dashboardStats.nextPostSubLabel}
            icon={CalendarClock}
            iconBgClass="bg-purple-50 dark:bg-purple-500/10"
            iconColorClass="text-purple-500 dark:text-purple-400"
            className="animate-fade-in stagger-4"
          />
        </div>

        {/* Recent Posts Section */}
        <div className="animate-fade-in" style={{ animationDelay: "0.25s" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[18px] font-bold text-[var(--color-text-primary)] tracking-tight">
              Recent posts
            </h3>

            {/* Filter Dropdown */}
            <div className="relative" ref={filterRef}>
              <button
                onClick={() => setFilterOpen(!filterOpen)}
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-[13px] font-medium text-[var(--color-text-primary)] transition-all hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-border-hover)]"
              >
                <Filter className="h-3.5 w-3.5" />
                {filter}
                <svg
                  className={`h-3.5 w-3.5 transition-transform ${filterOpen ? "rotate-180" : ""
                    }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {filterOpen && (
                <div className="absolute right-0 mt-1.5 w-40 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-1.5 shadow-lg shadow-[var(--color-shadow)] z-50 animate-fade-in">
                  {filterOptions.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => {
                        setFilter(opt);
                        setFilterOpen(false);
                      }}
                      className={`
                        w-full text-left px-3.5 py-2 text-[13px] transition-colors
                        ${filter === opt
                          ? "bg-blue-50 text-blue-700 font-medium dark:bg-blue-950/40 dark:text-blue-400"
                          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
                        }
                      `}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Posts List */}
          <div className="flex flex-col gap-5">
            {isLoading && posts.length === 0 ? (
              <div className="flex justify-center p-8 text-[13px] text-[var(--color-text-muted)]">
                Loading Notion calendar...
              </div>
            ) : filteredPosts.length > 0 ? (
              filteredPosts.map((post, index) => (
                <div
                  key={post.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${0.05 * index}s` }}
                >
                  <PostListItem
                    post={post}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onPostNow={handlePostNow}
                    onView={handleView}
                  />
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)]">
                <div className="h-12 w-12 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center mb-3">
                  <Filter className="h-5 w-5 text-[var(--color-text-muted)]" />
                </div>
                <p className="text-[14px] font-medium text-[var(--color-text-primary)]">
                  No posts found
                </p>
                <p className="text-[13px] text-[var(--color-text-muted)] mt-1">
                  No content matches the &quot;{filter}&quot; filter.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Post Detail Modal */}
      {selectedPost && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="post-detail-title"
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setSelectedPost(null)}
          />
          <div className="relative w-full max-w-3xl max-h-[85vh] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl animate-fade-in overflow-hidden flex flex-col">
            {/* Header */}
            <div className="relative shrink-0 flex flex-col">
              {/* Title Header */}
              <div className="px-8 pt-8 pb-4 border-b border-[var(--color-border)] flex items-start justify-between">
                <h3 className="text-[24px] font-extrabold text-black dark:text-white">Title</h3>
                <button
                  onClick={() => setSelectedPost(null)}
                  className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-[var(--color-surface-hover)] transition-colors flex-shrink-0"
                >
                  <X className="h-4 w-4 text-[var(--color-text-muted)]" />
                </button>
              </div>

              {/* Title Content */}
              <div className="px-8 py-5 border-b border-[var(--color-border)]">
                <h2
                  id="post-detail-title"
                  className="text-[14.5px] text-black dark:text-white font-normal leading-relaxed break-words"
                >
                  {selectedPost.title}
                </h2>
              </div>

              {/* Metadata */}
              <div className="px-8 py-5 border-b border-[var(--color-border)]">
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge status={selectedPost.status} size="md" />

                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 text-[12px] text-black dark:text-white font-medium">
                      <Calendar className="h-3 w-3" />
                      {selectedPost.scheduledDay}
                    </span>

                    {formatPostDate(selectedPost.createdAt) && (
                      <span className="inline-flex items-center gap-1 text-[12px] text-black dark:text-white font-medium">
                        <Clock className="h-3 w-3" />
                        Added {formatPostDate(selectedPost.createdAt)}
                      </span>
                    )}
                  </div>

                  {renderPlatformChips(selectedPost.platform)}
                </div>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Image */}
              {selectedPost.imageUrl && (
                <div className="flex justify-center rounded-xl overflow-hidden border border-[var(--color-border)] bg-black/5 dark:bg-black/20 p-2">
                  <img
                    src={selectedPost.imageUrl}
                    alt="Post image"
                    className="max-w-full max-h-[400px] object-contain rounded-lg"
                  />
                </div>
              )}

              {/* Instagram Caption */}
              {selectedPost.instagramCaption && (
                <div className="rounded-xl border border-pink-200 bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-950/30 dark:to-purple-950/30 dark:border-pink-900/50 p-5">
                  <div className="flex items-center gap-2 mb-4 border-b border-pink-200/50 dark:border-pink-900/30 pb-3">
                    <FaInstagram className="h-4 w-4 text-pink-500" />
                    <h3 className="text-[14px] font-semibold text-pink-700 dark:text-pink-400">Instagram Caption</h3>
                  </div>
                  <FormattedPostContent content={selectedPost.instagramCaption} platform="instagram" />
                </div>
              )}

              {/* LinkedIn Post */}
              {selectedPost.linkedinPost && (
                <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 dark:border-blue-900/50 p-5">
                  <div className="flex items-center gap-2 mb-4 border-b border-blue-200/50 dark:border-blue-900/30 pb-3">
                    <FaLinkedin className="h-4 w-4 text-blue-600" />
                    <h3 className="text-[14px] font-semibold text-blue-700 dark:text-blue-400">LinkedIn Post</h3>
                  </div>
                  <FormattedPostContent content={selectedPost.linkedinPost} platform="linkedin" />
                </div>
              )}

              {/* Fallback if neither platform text exists */}
              {!selectedPost.instagramCaption && !selectedPost.linkedinPost && selectedPost.body && (
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hover)] p-5">
                  <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)] mb-4 border-b border-[var(--color-border)] pb-3">Post Content</h3>
                  <FormattedPostContent content={selectedPost.body} platform="default" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
