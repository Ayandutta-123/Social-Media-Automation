'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AuthGuard } from '@/components/auth-guard';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Image as ImageIcon,
  Layers,
  Repeat2,
  X,
} from 'lucide-react';
import { InlineNotice, Skeleton, Spinner } from '@/components/ui';
import { Tip } from '@/components/tooltip';
import {
  PlatformBadge,
  PlatformBadgeList,
  PlatformIcon,
  formatPlatformLabel,
} from '@/components/platform-badge';

type PostLink = {
  platform: string;
  url: string | null;
  platformPostId: string | null;
  accountName: string | null;
};

type PublishedPost = {
  id: string;
  engine: string;
  imageUrl: string | null;
  /** Every slide when the post is a carousel (empty for single-image posts). */
  slides?: string[];
  publishedAt: string | null;
  platforms: string[];
  links: PostLink[];
  caption: {
    headline: string;
    body: string;
    hashtags: string[];
    callToAction?: string | null;
  };
  captions: Array<{
    platform: string;
    headline: string;
    body: string;
    hashtags: string[];
    callToAction?: string | null;
  }>;
};

interface DashboardData {
  published: number;
  publishedContent: PublishedPost[];
  connectedPlatforms?: Array<{ platform: string; accountName: string | null }>;
}

function mediaUrl(url?: string | null): string {
  if (!url) return '';
  if (/^(https?:|data:)/.test(url)) return url;
  const [pathPart, query] = url.split('?');
  const encoded = pathPart
    .split('/')
    .map((segment) => {
      if (!segment) return '';
      try {
        return encodeURIComponent(decodeURIComponent(segment));
      } catch {
        return encodeURIComponent(segment);
      }
    })
    .join('/');
  return query ? `${encoded}?${query}` : encoded;
}

function formatPublishedStamp(iso: string): {
  weekday: string;
  date: string;
  time: string;
} {
  const d = new Date(iso);
  return {
    weekday: d.toLocaleDateString(undefined, { weekday: 'long' }),
    date: d.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
    time: d.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }),
  };
}

function PublishedStamp({ publishedAt }: { publishedAt: string | null }) {
  if (!publishedAt) {
    return (
      <span className="shrink-0 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
        Published
      </span>
    );
  }
  const stamp = formatPublishedStamp(publishedAt);
  return (
    <div
      className="inline-flex shrink-0 items-center gap-2.5 rounded-xl border border-brand-500/30 bg-brand-500/10 px-3 py-2 text-brand-800 dark:text-brand-200"
      title={`Published ${stamp.weekday}, ${stamp.date} at ${stamp.time}`}
    >
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm shadow-brand-600/25">
        <CalendarDays size={15} />
      </span>
      <div className="min-w-0 leading-tight">
        <p className="text-[11px] font-bold uppercase tracking-wide">{stamp.weekday}</p>
        <p className="text-sm font-semibold tabular-nums">{stamp.date}</p>
        <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-brand-700/90 dark:text-brand-300">
          <Clock size={11} />
          {stamp.time}
        </p>
      </div>
    </div>
  );
}

/** Buttons that open the live post on each network it went out to. */
function PostLinks({ links }: { links: PostLink[] }) {
  if (!links?.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {links.map((link) => {
        const label = formatPlatformLabel(link.platform);
        if (link.url) {
          return (
            <a
              key={link.platform}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              title={
                link.accountName
                  ? `Open this post on ${label} (${link.accountName})`
                  : `Open this post on ${label}`
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1.5 text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-500/40 hover:text-brand-600 hover:shadow-sm"
            >
              <PlatformIcon platform={link.platform} size={14} />
              <span>View on {label}</span>
              <ExternalLink size={12} className="opacity-60" />
            </a>
          );
        }
        return (
          <span
            key={link.platform}
            title={
              link.platformPostId
                ? `${label} did not return a public link for this post (id ${link.platformPostId}).`
                : `${label} did not return a public link for this post.`
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[hsl(var(--border))] px-2.5 py-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))]"
          >
            <PlatformIcon platform={link.platform} size={14} />
            <span>{label} · no link</span>
          </span>
        );
      })}
    </div>
  );
}


/** Swipeable media: every slide of a carousel (snap-scroll, arrows, dots, counter) or the single image. */
function PostMedia({ images, alt }: { images: string[]; alt: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const count = images.length;

  const go = useCallback(
    (to: number) => {
      const el = track.current;
      if (!el) return;
      const next = Math.max(0, Math.min(count - 1, to));
      el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
    },
    [count],
  );

  if (!count) {
    return (
      <div className="flex aspect-[4/5] max-h-[560px] w-full items-center justify-center bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
        <ImageIcon size={28} />
      </div>
    );
  }

  return (
    <div
      className="group relative bg-[hsl(var(--muted))]"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(index + 1);
        if (e.key === 'ArrowLeft') go(index - 1);
      }}
    >
      <div
        ref={track}
        tabIndex={count > 1 ? 0 : -1}
        aria-label={count > 1 ? `Carousel, ${count} slides. Swipe or use arrow keys.` : undefined}
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((src, i) => (
          <div key={`${src}-${i}`} className="flex w-full shrink-0 snap-center items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mediaUrl(src)}
              alt={count > 1 ? `${alt} — slide ${i + 1} of ${count}` : alt}
              loading={i === 0 ? 'eager' : 'lazy'}
              draggable={false}
              className="block h-auto max-h-[560px] w-full object-contain"
            />
          </div>
        ))}
      </div>

      {count > 1 && (
        <>
          <span className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-bold tabular-nums text-white backdrop-blur">
            <Layers size={11} />
            {index + 1}/{count}
          </span>
          {index > 0 && (
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Previous slide"
              className="absolute left-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-md transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          {index < count - 1 && (
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Next slide"
              className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-md transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100"
            >
              <ChevronRight size={18} />
            </button>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-2.5 flex justify-center gap-1.5">
            {images.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? 'w-4 bg-brand-600' : 'w-1.5 bg-black/30 dark:bg-white/50'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Pick channels and post the same creative + caption again. */
function RepublishDialog({
  post,
  connected,
  onClose,
  onDone,
}: {
  post: PublishedPost;
  connected: Array<{ platform: string; accountName: string | null }>;
  onClose: () => void;
  onDone: (platforms: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>(() =>
    post.platforms.filter((p) => connected.some((c) => c.platform === p)),
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setBusy(true);
    setErr('');
    try {
      await api(`/content/${post.id}/republish`, { method: 'POST', body: { platforms: selected } });
      onDone(selected);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not republish. Try again.');
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Republish post"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-[hsl(var(--card))] p-5 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold">Republish this post</h3>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
              Posts the same {post.slides && post.slides.length > 1 ? `${post.slides.length}-slide carousel` : 'creative'} and
              caption again. Channels you already posted to will get a second copy.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 hover:bg-[hsl(var(--muted))]">
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {connected.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[hsl(var(--border))] p-3 text-sm text-[hsl(var(--muted-foreground))]">
              No connected channels. Connect one in Settings first.
            </p>
          ) : (
            connected.map((c) => (
              <label
                key={c.platform}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                  selected.includes(c.platform)
                    ? 'border-brand-500/60 bg-brand-500/10'
                    : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]'
                }`}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[hsl(var(--primary))]"
                  checked={selected.includes(c.platform)}
                  onChange={(e) =>
                    setSelected((prev) =>
                      e.target.checked ? [...new Set([...prev, c.platform])] : prev.filter((x) => x !== c.platform),
                    )
                  }
                />
                <PlatformBadge platform={c.platform} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm text-[hsl(var(--muted-foreground))]">
                  {c.accountName || ''}
                </span>
                {post.platforms.includes(c.platform) && (
                  <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                    Already posted
                  </span>
                )}
              </label>
            ))
          )}
        </div>

        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="btn-sector-outline !min-h-[44px] !px-4 text-sm">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || selected.length === 0}
            onClick={submit}
            className="btn-sector inline-flex !min-h-[44px] items-center justify-center gap-2 !px-4 text-sm disabled:opacity-50"
          >
            {busy ? <Spinner size={14} /> : <Repeat2 size={15} />}
            Republish to {selected.length || 0} channel{selected.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, companies } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [republishing, setRepublishing] = useState<PublishedPost | null>(null);
  /** post id → publishedAt before the republish, so we can tell when the new one lands */
  const [pending, setPending] = useState<Record<string, string | null>>({});
  const [notice, setNotice] = useState('');

  const load = useCallback(
    () =>
      api<{ data: DashboardData }>('/dashboard/stats')
        .then((res) => {
          setData(res.data);
          return res.data;
        })
        .catch(() => {
          setError('Could not load published posts. Refresh in a few seconds.');
          return null;
        }),
    [],
  );

  useEffect(() => {
    setData(null);
    void load();
  }, [user?.tenantId, load]);

  // While a republish is running the post leaves the list (status "publishing"); poll until it is back.
  useEffect(() => {
    const ids = Object.keys(pending);
    if (!ids.length) return;
    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      const fresh = await load();
      if (fresh) {
        const done = ids.filter((id) => {
          const row = fresh.publishedContent.find((p) => p.id === id);
          return row && row.publishedAt !== pending[id];
        });
        if (done.length) {
          setPending((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !done.includes(id))));
          setNotice('Republished. The new links are shown on the post.');
        }
      }
      if (tries >= 30) {
        clearInterval(timer);
        setPending({});
        setNotice('Republish is taking longer than usual. Check Approvals or Logs for the result.');
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [pending, load]);

  return (
    <AuthGuard>
      <div className="page-container animate-page-enter">
        <header className="page-header">
          <div>
            <p className="panel-kicker mb-1">Live content</p>
            <h1 className="page-title">Published posts</h1>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
              What was posted for{' '}
              <span className="font-medium text-[hsl(var(--foreground))]">
                {user?.companyName || user?.tenantName || 'this company'}
              </span>
              , where it went, and the exact caption used.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3">
              <CheckCircle2 className="text-emerald-600" size={20} />
              <div>
                {data ? (
                  <p className="text-xl font-bold leading-none">{data.published}</p>
                ) : (
                  <Skeleton className="h-6 w-10" />
                )}
                <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
                  Total published
                </p>
              </div>
            </div>
          </div>
        </header>

        <section className="panel overflow-hidden animate-fade-in">
          <div className="panel-body !p-0">
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5">
              <div className="flex min-w-0 items-start gap-3 sm:items-center">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-md shadow-brand-600/25 transition-transform duration-300 hover:scale-105">
                  <Building2 size={20} />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                    Active brand
                  </p>
                  <p className="truncate text-lg font-bold tracking-tight text-[hsl(var(--foreground))] sm:text-xl">
                    {user?.companyName || user?.tenantName || 'Company'}
                  </p>
                  <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                    {(companies.length || 1) === 1
                      ? 'Published posts below are for this company.'
                      : `${companies.length} companies · posts below are for this brand only.`}
                  </p>
                </div>
              </div>

              <div className="flex w-full flex-col gap-2 sm:w-auto sm:shrink-0 sm:flex-row">
                <Link
                  href="/choose-company"
                  className="btn-sector-outline inline-flex w-full items-center justify-center gap-2 !min-h-[44px] !px-4 text-sm transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] sm:w-auto"
                >
                  Switch company
                </Link>
                <Link
                  href="/settings"
                  className="btn-sector inline-flex w-full items-center justify-center gap-2 !min-h-[44px] !px-4 text-sm transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] sm:w-auto"
                >
                  Brand settings
                </Link>
              </div>
            </div>
          </div>
        </section>

        {error && <InlineNotice kind="error">{error}</InlineNotice>}
        {Object.keys(pending).length > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-brand-500/30 bg-brand-500/10 px-4 py-3 text-sm font-medium text-brand-800 dark:text-brand-200">
            <Spinner size={14} />
            Republishing {Object.keys(pending).length} post{Object.keys(pending).length === 1 ? '' : 's'}… it will reappear here when done.
          </div>
        )}
        {notice && !Object.keys(pending).length && <InlineNotice kind="success">{notice}</InlineNotice>}

        {!data ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {[1, 2, 3, 4].map((item) => (
              <Skeleton key={item} className="h-80 w-full rounded-2xl" />
            ))}
          </div>
        ) : data.publishedContent.length === 0 ? (
          <div className="card flex min-h-64 flex-col items-center justify-center text-center">
            <CheckCircle2 size={34} className="mb-3 text-[hsl(var(--muted-foreground))]" />
            <p className="font-medium">No published posts yet</p>
            <p className="mt-1 max-w-sm text-sm text-[hsl(var(--muted-foreground))]">
              Once a post is approved and successfully published, it will appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {data.publishedContent.map((post) => (
              <article
                key={post.id}
                className="card !p-0 overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex flex-col gap-3 border-b border-[hsl(var(--border))] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    <PlatformBadgeList platforms={post.platforms} size="sm" />
                  </div>
                  <PublishedStamp publishedAt={post.publishedAt} />
                </div>

                <PostMedia
                  images={post.slides && post.slides.length > 1 ? post.slides : post.imageUrl ? [post.imageUrl] : []}
                  alt={post.caption.headline || 'Published creative'}
                />

                <div className="space-y-4 p-4">
                  <PostLinks links={post.links} />
                  <div className="flex flex-wrap items-center gap-2">
                    <Tip label="Post this creative and caption again">
                      <button
                        type="button"
                        onClick={() => {
                          setNotice('');
                          setRepublishing(post);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-brand-700"
                      >
                        <Repeat2 size={14} />
                        Republish
                      </button>
                    </Tip>
                    {post.slides && post.slides.length > 1 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
                        <Layers size={12} />
                        Carousel · {post.slides.length} slides
                      </span>
                    )}
                  </div>

                  {(post.captions?.length
                    ? post.captions
                    : [{ platform: post.platforms[0] || '', ...post.caption }]
                  ).map((caption) => (
                    <section key={caption.platform} className="space-y-2">
                      <p className="panel-kicker flex items-center gap-1.5">
                        {caption.platform ? (
                          <>
                            <PlatformBadge platform={caption.platform} size="sm" />
                            <span>caption</span>
                          </>
                        ) : (
                          'Caption'
                        )}
                      </p>
                      {caption.headline && (
                        <h2 className="font-semibold leading-snug">{caption.headline}</h2>
                      )}
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-[hsl(var(--foreground))]">
                        {caption.body}
                      </p>
                      {caption.callToAction && (
                        <p className="text-sm font-medium text-brand-600">
                          {caption.callToAction}
                        </p>
                      )}
                      {caption.hashtags.length > 0 && (
                        <p className="text-xs leading-relaxed text-brand-600">
                          {caption.hashtags
                            .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`))
                            .join(' ')}
                        </p>
                      )}
                    </section>
                  ))}

                  <p className="border-t border-[hsl(var(--border))] pt-3 text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                    {post.engine.replace(/_/g, ' ')}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      {republishing && (
        <RepublishDialog
          post={republishing}
          connected={data?.connectedPlatforms || []}
          onClose={() => setRepublishing(null)}
          onDone={() => {
            setPending((prev) => ({ ...prev, [republishing.id]: republishing.publishedAt }));
            setRepublishing(null);
            void load();
          }}
        />
      )}
    </AuthGuard>
  );
}
