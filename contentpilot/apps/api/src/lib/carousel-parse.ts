/** Instagram allows 2–10 carousel items. */
export const CAROUSEL_MIN_SLIDES = 2;
export const CAROUSEL_MAX_SLIDES = 10;

export type CarouselSlide = {
  index: number;
  headline: string;
  imagePrompt: string;
  imageUrl: string;
  rawImageUrl?: string | null;
  /** Designed-poster layout brief for this slide (rendered by brandPosterFrame). */
  posterSpec?: Record<string, unknown> | null;
  /** Geometry used when framing this slide (varied per slide — not always hero_right). */
  posterLayout?: string | null;
};

/** What a carousel that stopped part-way keeps, so a retry can continue instead of starting over. */
export type CarouselProgress = {
  /** Slides the finished carousel will have. */
  total: number;
  /** Slides already made, in order. */
  slides: CarouselSlide[];
  /** The plan for every slide (wording, art prompt, layout) — reused so a retry keeps the same words. */
  planned: Array<{
    headline: string;
    imagePrompt: string;
    layout: string;
    spec: Record<string, unknown>;
  }>;
  layouts: string[];
  contacts?: unknown;
  format?: string;
  /** Inputs needed to carry on (brand, style, platforms, …). */
  resume: Record<string, unknown>;
  /** Present once a slide failed. */
  failure?: { slide: number; message: string; at: string; attempts: number };
};

export type CarouselPayload = {
  slideCount: number;
  slides: CarouselSlide[];
  /** Canvas every slide was rendered at (platform-native); older carousels are 1:1. */
  format?: 'instagram_square' | 'instagram_portrait' | 'linkedin' | 'story';
};

/**
 * Detect carousel + slide count from calendar theme / format / notes / title.
 * Only returns a count when the text clearly asks for a carousel (or multi-slide / multi-page post).
 */
export function parseCarouselSlideCount(...parts: Array<string | null | undefined>): number | null {
  const text = parts
    .map((p) => (p || '').trim())
    .filter(Boolean)
    .join(' · ');
  if (!text) return null;

  const lower = text.toLowerCase();
  // Ignore explicit negatives like "no carousel" / "not a carousel"
  const cleaned = lower
    .replace(/\bno\s+carousel\b/g, ' ')
    .replace(/\bno\s+carousal\b/g, ' ')
    .replace(/\bnot\s+a\s+carousel\b/g, ' ')
    .replace(/\bwithout\s+carousel\b/g, ' ');

  const wantsCarousel =
    /\bcarousel\b/.test(cleaned) ||
    /\bcarousal\b/.test(cleaned) || // common misspelling
    /\bmulti[\s-]?slide\b/.test(cleaned) ||
    /\bmulti[\s-]?page\b/.test(cleaned) ||
    /\bslide\s*deck\b/.test(cleaned);

  if (!wantsCarousel) return null;

  const patterns: RegExp[] = [
    /\b(?:carousel|carousal)\b[^0-9]{0,24}(\d{1,2})\s*(?:slides?|pages?|cards?|images?)?\b/i,
    /\b(\d{1,2})\s*[-\s]?(?:slides?|pages?|cards?)\s+(?:carousel|carousal)\b/i,
    /\b(\d{1,2})\s*[-\s]?slide\s+(?:carousel|carousal)\b/i,
    /\b(?:carousel|carousal)\s*[·\-–—,:/(]*\s*(\d{1,2})\b/i,
    /\b(?:slides?|pages?)\s*[:=]\s*(\d{1,2})\b/i,
    /\((\d{1,2})\s*(?:slides?|pages?)\)/i,
  ];

  for (const re of patterns) {
    const m = cleaned.match(re);
    if (m?.[1]) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n >= 1) return clampSlideCount(n);
    }
  }

  // "carousel" mentioned without a number → default 3
  return 3;
}

export function clampSlideCount(n: number): number {
  return Math.min(CAROUSEL_MAX_SLIDES, Math.max(CAROUSEL_MIN_SLIDES, Math.round(n)));
}

export function extractCarouselPayload(templateSlots: unknown): CarouselPayload | null {
  if (!templateSlots || typeof templateSlots !== 'object' || Array.isArray(templateSlots)) {
    return null;
  }
  const raw = (templateSlots as Record<string, unknown>).carousel;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const slidesRaw = obj.slides;
  if (!Array.isArray(slidesRaw) || !slidesRaw.length) return null;

  const slides: CarouselSlide[] = [];
  for (let i = 0; i < slidesRaw.length; i++) {
    const s = slidesRaw[i];
    if (!s || typeof s !== 'object' || Array.isArray(s)) continue;
    const row = s as Record<string, unknown>;
    const imageUrl = typeof row.imageUrl === 'string' ? row.imageUrl : '';
    if (!imageUrl) continue;
    slides.push({
      index: typeof row.index === 'number' ? row.index : i + 1,
      headline: typeof row.headline === 'string' ? row.headline : `Slide ${i + 1}`,
      imagePrompt: typeof row.imagePrompt === 'string' ? row.imagePrompt : '',
      imageUrl,
      rawImageUrl: typeof row.rawImageUrl === 'string' ? row.rawImageUrl : null,
      posterSpec:
        row.posterSpec && typeof row.posterSpec === 'object' && !Array.isArray(row.posterSpec)
          ? (row.posterSpec as Record<string, unknown>)
          : null,
      posterLayout: typeof row.posterLayout === 'string' ? row.posterLayout : null,
    });
  }
  if (!slides.length) return null;
  const fmt = obj.format;
  return {
    format:
      fmt === 'instagram_portrait' || fmt === 'linkedin' || fmt === 'story' || fmt === 'instagram_square'
        ? fmt
        : undefined,
    slideCount:
      typeof obj.slideCount === 'number' && obj.slideCount >= 1
        ? clampSlideCount(obj.slideCount)
        : slides.length,
    slides,
  };
}

/** Merge string slot edits without dropping nested meta (carousel, insightReport, …). */
export function mergeTemplateSlots(
  existing: unknown,
  stringSlots: Record<string, string>,
): Record<string, unknown> {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  for (const [k, v] of Object.entries(stringSlots)) {
    if (k === 'carousel' || k === 'insightReport' || k === 'newsletterEdition' || k === 'posterSpec' || k === 'posterLayout') continue;
    base[k] = v;
  }
  return base;
}

/** The unfinished-carousel record, if this post stopped part-way. */
export function extractCarouselProgress(templateSlots: unknown): CarouselProgress | null {
  if (!templateSlots || typeof templateSlots !== 'object' || Array.isArray(templateSlots)) return null;
  const raw = (templateSlots as Record<string, unknown>).carouselProgress;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const p = raw as Partial<CarouselProgress>;
  if (!Array.isArray(p.planned) || !Array.isArray(p.slides) || typeof p.total !== 'number') return null;
  return p as CarouselProgress;
}

/** True while a carousel is missing slides — it must not be approved, posted or edited as if it were whole. */
export function hasIncompleteCarousel(templateSlots: unknown): boolean {
  return extractCarouselProgress(templateSlots) !== null;
}
