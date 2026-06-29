"use client";

import { ContentItem } from "@/types";
import StatusBadge from "@/components/ui/StatusBadge";
import { FileText, ChevronRight, Calendar, Clock } from "lucide-react";
import { FaInstagram, FaLinkedin, FaTwitter, FaYoutube, FaFacebook, FaTiktok } from "react-icons/fa";

interface PostListItemProps {
  post: ContentItem;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onPostNow?: (id: string) => void;
  onView?: (id: string) => void;
}

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
  const platforms = platformString.split("+").map(p => p.trim());

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
      {platforms.map(platform => (
        <span
          key={platform}
          className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)] bg-[var(--color-chip-bg)] border border-[var(--color-chip-border)] px-2 py-0.5 rounded-full font-medium"
        >
          {getIcon(platform)}
          {platform}
        </span>
      ))}
    </div>
  );
}

export default function PostListItem({
  post,
  onView,
}: PostListItemProps) {
  const createdLabel = formatPostDate(post.createdAt);

  return (
    <div
      onClick={() => onView?.(post.id)}
      className="group relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 transition-all duration-300 hover:shadow-lg hover:shadow-[var(--color-shadow)] hover:border-[var(--color-border-hover)] cursor-pointer hover:-translate-y-1"
    >
      {/* Top row: thumbnail + content + chevron */}
      <div className="flex items-start gap-5">
        {/* Thumbnail */}
        {post.imageUrl ? (
          <div className="flex-shrink-0 h-20 w-20 rounded-xl overflow-hidden bg-[var(--color-surface-hover)] ring-1 ring-[var(--color-border)] transition-transform duration-300 group-hover:scale-105">
            <img src={post.imageUrl} alt="" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="flex-shrink-0 h-20 w-20 rounded-xl bg-gradient-to-br from-[var(--color-surface-hover)] to-[var(--color-border)] flex items-center justify-center ring-1 ring-[var(--color-border)]">
            <FileText className="h-8 w-8 text-[var(--color-text-muted)]" />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0 py-0.5">
          {/* Title — up to 2 lines */}
          <h3 className="text-[16px] font-semibold text-[var(--color-text-primary)] leading-snug line-clamp-2 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors duration-200">
            {post.title}
          </h3>

          {/* Body preview — max 2 lines to reduce clutter but show more info */}
          <p className="text-[14px] text-[var(--color-text-secondary)] mt-2 line-clamp-2 leading-relaxed">
            {post.body}
          </p>

          {/* Metadata row */}
          <div className="flex flex-wrap items-center gap-4 mt-4">
            <StatusBadge status={post.status} />

            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1 text-[12px] text-[var(--color-text-muted)] font-medium">
                <Calendar className="h-3 w-3" />
                {post.scheduledDay}
              </span>

              {createdLabel && (
                <span className="inline-flex items-center gap-1 text-[12px] text-[var(--color-text-muted)]">
                  <Clock className="h-3 w-3" />
                  Added {createdLabel}
                </span>
              )}
            </div>

            {renderPlatformChips(post.platform)}
          </div>
        </div>

        {/* Chevron indicator */}
        <div className="flex-shrink-0 flex items-center self-center">
          <ChevronRight className="h-5 w-5 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0.5" />
        </div>
      </div>
    </div>
  );
}
