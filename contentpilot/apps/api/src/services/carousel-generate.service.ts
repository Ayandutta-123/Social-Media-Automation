import { ContentEngine } from '@contentpilot/shared';
import { formatForPlatforms, SOCIAL_IMAGE_FORMATS, type SocialImageFormat } from '../providers/images/social-frame';
import { prisma } from '../lib/prisma';
import { LLMService } from './llm.service';
import { executionLogService } from './execution-log.service';
import { assertGenerationActive, isGenerationAbortedError } from './generation-abort.service';
import { preferOriginalLogoUrl } from '../lib/store-upload';
import { posterSpecFromJson, POSTER_ART_NEGATIVE } from './poster-spec.service';
import { POSTER_ICON_IDS, type PosterLayoutId, type PosterSpec } from '../providers/images/poster-frame';
import {
  clampSlideCount,
  extractCarouselProgress,
  type CarouselProgress,
  type CarouselSlide,
} from '../lib/carousel-parse';
import { toProviderCreditError } from '../lib/provider-credits';
import {
  buildBrandContactChips,
  formatBrandContactLine,
  type BrandContactLinks,
} from '../lib/brand-contacts';
import {
  layoutPhotoComposition,
  layoutCopyDirection,
  layoutPillarBudget,
  pickCarouselLayouts,
  finalizeArtPrompt,
  LAYOUT_LABELS,
  carouselSlideRole,
  carouselArtPrefix,
  applyCarouselCopyContract,
} from './poster-layout-pick';

export type CarouselPostCopy = {
  headline: string;
  body: string;
  imagePrompt?: string | null;
  callToAction?: string | null;
};

export type GenerateCarouselSlidesInput = {
  tenantId: string;
  contentId: string;
  slideCount: number;
  company: string;
  brief: string;
  post: CarouselPostCopy;
  brandImageStyle?: string | null;
  companyName?: string | null;
  logoUrl?: string | null;
  brandType?: string | null;
  playId: string;
  source: string;
  visualStyleId?: string | null;
  engine?: ContentEngine;
  workflowStep?: string;
  /** Persist cover + templateSlots onto GeneratedContent (default true). */
  persist?: boolean;
  /**
   * Optional per-slide hero image URLs (exact uploads). When set for a slide index,
   * that art is used instead of generating a new photo — poster type still frames it.
   */
  heroImageUrls?: Array<string | null | undefined>;
  /** Brand kit contacts for the last-slide CTA strip (only filled fields are shown). */
  contacts?: BrandContactLinks | null;
  /** Canvas for every slide. Defaults from `platforms`, else 4:5 (native on Instagram, Facebook, LinkedIn). */
  format?: SocialImageFormat;
  /** Target networks — used to pick the native size when `format` is not given. */
  platforms?: readonly string[];
};

export type GenerateCarouselSlidesResult = {
  slideCount: number;
  slides: CarouselSlide[];
  coverImageUrl: string;
  coverRawImageUrl: string | null;
  coverImagePrompt: string;
  templateSlots: Record<string, unknown>;
};

/**
 * @deprecated Prefer per-slide layouts from pickCarouselLayouts(). Kept as a
 * fallback id for older callers that still import a constant.
 */
export const CAROUSEL_POSTER_LAYOUT = 'hero_right' as const;

/** Plain-English reason for an image-service failure (the raw text is kept as "technical detail"). */
export function describeImageFailure(raw: string): string {
  // The app wraps provider errors in long advice ("Add a fal.ai API key…"); judge the actual last attempt first.
  const core = /last high-end attempt[^:]*failed:\s*([\s\S]*)$/i.exec(raw)?.[1] || '';
  return (core && classifyImageFailure(core)) || classifyImageFailure(raw) || 'the image service returned an error';
}

function classifyImageFailure(text: string): string | null {
  const t = text.toLowerCase();
  // Setup problems first: they are the ones the user can fix.
  if (/api key|unauthori[sz]ed|forbidden|\b40[13]\b|not configured|add a .{0,24}key|no .{0,20}key/.test(t)) {
    return 'the image service is not set up (missing or rejected key)';
  }
  if (/nsfw|safety|policy|moderation|content.?filter|blocked|flagged/.test(t)) {
    return 'the image service refused the picture (content filter)';
  }
  if (/429|rate.?limit|too many requests|busy|overload|capacity|\b50[234]\b|unavailable/.test(t)) {
    return 'the image service was busy';
  }
  if (/timeout|timed out|etimedout|econnreset|socket hang up|network|fetch failed/.test(t)) {
    return 'the image service timed out';
  }
  if (/failed to generate|returned nothing|no image/.test(t)) {
    return 'the image service returned no picture';
  }
  return null;
}

/** A carousel stopped at one slide. Earlier slides are already saved on the post. */
export class CarouselSlideError extends Error {
  readonly slide: number;
  readonly total: number;
  readonly saved: number;
  readonly technical: string;

  constructor(slide: number, total: number, saved: number, cause: unknown) {
    const technical = (cause instanceof Error ? cause.message : String(cause)).replace(/\s+/g, ' ').trim();
    const summary = `Slide ${slide} of ${total} failed — ${describeImageFailure(technical)}. ${saved} of ${total} slide${saved === 1 ? ' is' : 's are'} saved; Retry continues from slide ${slide}.`;
    super(`${summary}\nTechnical detail: ${technical.slice(0, 300)}`);
    this.name = 'CarouselSlideError';
    this.slide = slide;
    this.total = total;
    this.saved = saved;
    this.technical = technical;
  }
}

type PlannedSlide = {
  headline: string;
  imagePrompt: string;
  spec: PosterSpec;
  layout: PosterLayoutId;
};

type CarouselPlan = {
  slideCount: number;
  planned: PlannedSlide[];
  layouts: PosterLayoutId[];
  postFormat: SocialImageFormat;
};

function slotsObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

/** Write the progress record onto the post (keeps every other template slot as it is). */
async function saveProgress(contentId: string, progress: CarouselProgress): Promise<void> {
  const row = await prisma.generatedContent.findUnique({ where: { id: contentId }, select: { templateSlots: true } });
  await prisma.generatedContent.update({
    where: { id: contentId },
    data: {
      templateSlots: { ...slotsObject(row?.templateSlots), carouselProgress: progress } as object,
      // The first finished slide doubles as the thumbnail while the rest is pending.
      ...(progress.slides[0] ? { imageUrl: progress.slides[0].imageUrl } : {}),
    },
  });
}

/**
 * Outline N designed-poster slides via LLM, render each with a VARIED layout
 * (not always hero_right), and store cover + templateSlots.carousel.
 */
export async function generateCarouselSlides(
  input: GenerateCarouselSlidesInput,
): Promise<GenerateCarouselSlidesResult> {
  const plan = await buildCarouselPlan(input);
  if (input.persist !== false) {
    // Save the plan before the first picture, so a failure part-way can be retried without redoing the words.
    const { tenantId: _t, contentId: _c, ...resume } = input;
    void _t;
    void _c;
    await saveProgress(input.contentId, {
      total: plan.slideCount,
      slides: [],
      planned: plan.planned as unknown as CarouselProgress['planned'],
      layouts: plan.layouts,
      format: plan.postFormat,
      resume: JSON.parse(JSON.stringify(resume)) as Record<string, unknown>,
    });
  }
  return renderCarouselSlides(input, plan, []);
}

/** Continue a carousel that stopped part-way: keeps finished slides and the same wording. */
export async function resumeCarouselSlides(
  tenantId: string,
  contentId: string,
): Promise<GenerateCarouselSlidesResult> {
  const row = await prisma.generatedContent.findFirst({
    where: { id: contentId, tenantId, deletedAt: null },
    select: { templateSlots: true },
  });
  const progress = extractCarouselProgress(row?.templateSlots);
  if (!progress) throw new Error('This post has no unfinished carousel to continue.');
  const input = { ...(progress.resume as unknown as GenerateCarouselSlidesInput), tenantId, contentId };
  const plan: CarouselPlan = {
    slideCount: progress.total,
    planned: progress.planned as unknown as PlannedSlide[],
    layouts: progress.layouts as PosterLayoutId[],
    postFormat: (progress.format as SocialImageFormat) || formatForPlatforms(input.platforms || []),
  };
  await executionLogService.log({
    tenantId,
    contentId,
    workflowStep: input.workflowStep || 'carousel:slides',
    engine: input.engine || ContentEngine.CALENDAR,
    message: `Continuing carousel from slide ${progress.slides.length + 1} of ${progress.total} (${progress.slides.length} already saved)`,
  });
  return renderCarouselSlides(input, plan, progress.slides, progress.failure?.attempts ?? 0);
}

/** The words and layouts for every slide (one AI call). */
async function buildCarouselPlan(input: GenerateCarouselSlidesInput): Promise<CarouselPlan> {
  const slideCount = clampSlideCount(input.slideCount);
  const llm = await LLMService.forTenant(input.tenantId);
  const { attachGeneratedImage } = await import('./image-attach.service');
  const { brandPosterFrame } = await import('../providers/images/poster-frame');

  const engine = input.engine || ContentEngine.CALENDAR;
  const workflowStep = input.workflowStep || 'carousel:slides';
  const isB2c = String(input.brandType || 'b2b').toLowerCase() === 'b2c';
  const visualStyleId =
    input.visualStyleId || (isB2c ? 'cinematic_photo' : 'professional_photo');
  const logoUrl = preferOriginalLogoUrl(input.logoUrl) || input.logoUrl || null;

  const contacts = input.contacts || {};
  const contactChips = buildBrandContactChips(contacts);
  const contactLine = formatBrandContactLine(contacts);

  const layouts = pickCarouselLayouts(
    slideCount,
    `${input.contentId}:${input.playId}:${input.brief.slice(0, 80)}`,
  );

  await executionLogService.log({
    tenantId: input.tenantId,
    contentId: input.contentId,
    workflowStep,
    engine,
    message: `Generating ${slideCount}-slide carousel (layouts: ${layouts.join(' → ')})`,
  });

  const layoutBrief = layouts
    .map((layout, i) => {
      const role = carouselSlideRole(i, layouts.length);
      const roleLine =
        role === 'cover'
          ? 'COVER: eyebrow + headline + one short subhead ONLY. No pillars, no stat, no callout, no closing card.'
          : role === 'close'
            ? 'CLOSE: CTA closingLine only. No pillars, no stat, no callout.'
            : `PROOF: ${layoutCopyDirection(layout)} Max pillars: ${layoutPillarBudget(layout, { isFirst: false, isLast: false })}.`;
      return `Slide ${i + 1} (${role}): layoutId="${layout}" (${LAYOUT_LABELS[layout] || layout}) — COPY: ${roleLine} PHOTO (never as layout jargon): ${carouselArtPrefix(role)} ${layoutPhotoComposition(layout)}`;
    })
    .join('\n');

  const outline = await llm.generateRawJson({
    systemPrompt: `Return JSON only. Art-direct a ${slideCount}-slide Instagram/LinkedIn carousel that looks like a real brand studio sequence (cover → proof → CTA), not three copies of one brochure.

CRITICAL: Each slide has TWO separate fields:
- Copy blocks (eyebrow, headline, pillars…) → SVG layout engine uses layoutId
- imagePrompt → PHOTO ONLY. NEVER mention typography, type columns, "negative space for text", left/right for type, layout names, or "bleeds in".

Shape: { "slides": [ {
  "layout": "exact layout id assigned below",
  "eyebrow": "2-4 word label or empty",
  "headline": "5-9 words",
  "headlineAccent": "EXACT substring of headline (2-4 words or a number)",
  "subhead": "one sentence, max 14 words — or empty",
  "pillars": [ { "icon": "allowed icon id", "title": "2-3 words", "text": "8-14 words MAX" } ],
  "statValue": "short metric — omit on cover and close; only if in the brief",
  "statLabel": "4-8 words",
  "calloutTitle": "empty on cover and close",
  "calloutBody": "empty on cover and close",
  "closingLine": "6-12 word CTA on LAST slide only; empty elsewhere",
  "imagePrompt": "2-3 sentences PHOTO ONLY: subject, setting, camera, darker light, brand-coloured grade",
  "artNegativePrompt": "comma separated bans"
} ] }

PER-SLIDE CONTRACT:
${layoutBrief}

Story rules:
- Cover = one bold claim. Sparse. Metrics belong on a later proof slide.
- Middle = one proof point. Vary camera angle. Never exceed max pillars.
- LAST = CTA only.
- Never invent stats/customers not in the brief.
- Premium feed — airy, thumbnail-legible, not a stacked PDF.
Allowed icons: ${POSTER_ICON_IDS.join(', ')}.
Every artNegativePrompt must include: ${POSTER_ART_NEGATIVE}`,
    userPrompt: `Brand: ${input.company}
Carousel topic (stay faithful):
${input.brief}

Feed caption headline: ${input.post.headline}
Feed caption body (context): ${input.post.body.slice(0, 500)}
Base visual direction: ${input.post.imagePrompt || 'professional brand photography'}
Desired closing CTA: ${input.post.callToAction || 'soft professional CTA'}
${contactLine ? `Brand contacts available for the LAST slide only (do not invent others): ${contactLine}` : 'No brand contacts configured — last slide closingLine only.'}

Produce ${slideCount} slides. imagePrompt = photography only; layout id is separate.`,
  });

  const rawSlides = Array.isArray(outline.slides) ? outline.slides : [];
  const planned: Array<{
    headline: string;
    imagePrompt: string;
    spec: PosterSpec;
    layout: PosterLayoutId;
  }> = [];

  for (let i = 0; i < slideCount; i++) {
    const layout = layouts[i] || 'hero_right';
    const role = carouselSlideRole(i, slideCount);
    const row =
      rawSlides[i] && typeof rawSlides[i] === 'object' && !Array.isArray(rawSlides[i])
        ? (rawSlides[i] as Record<string, unknown>)
        : {};
    const isLast = role === 'close';
    const isFirst = role === 'cover';
    const maxPillars = layoutPillarBudget(layout, { isFirst, isLast });
    const fallbackHeadline =
      i === 0 ? input.post.headline : `${input.post.headline} · ${i + 1}`;
    const fallbackArt = finalizeArtPrompt(
      `${carouselArtPrefix(role)} ${input.post.imagePrompt || input.post.headline}. Distinct composition from other slides. Photoreal editorial, no text in frame.`,
      layout,
    );

    if (isLast || maxPillars === 0) {
      delete row.pillars;
    } else if (Array.isArray(row.pillars) && row.pillars.length > maxPillars) {
      row.pillars = row.pillars.slice(0, maxPillars);
    }

    if (isFirst) {
      delete row.statValue;
      delete row.statLabel;
      delete row.calloutTitle;
      delete row.calloutBody;
      delete row.closingLine;
      delete row.pillars;
    }

    // Centre-stage / split-band: drop dense cards so type stays readable
    if (layout === 'center_stage' || layout === 'split_band') {
      if (!isLast) {
        delete row.calloutTitle;
        delete row.calloutBody;
      }
      if (maxPillars === 0) delete row.pillars;
    }

    let spec = posterSpecFromJson(
      { ...row, artPrompt: row.artPrompt ?? row.imagePrompt },
      {
        headline: fallbackHeadline,
        subhead: input.post.body.split(/(?<=[.!?])\s+/)[0]?.slice(0, 140) || '',
        closingLine: isLast
          ? input.post.callToAction || 'See what we can build together.'
          : '',
        artPrompt: fallbackArt,
      },
    );
    spec = applyCarouselCopyContract(spec, role, layout);
    spec.artPrompt = finalizeArtPrompt(
      `${carouselArtPrefix(role)} ${spec.artPrompt || fallbackArt}`,
      layout,
    );
    if (isLast && contactLine) {
      spec.footerNote = contactLine;
    }

    planned.push({
      headline: spec.headline,
      imagePrompt: spec.artPrompt || fallbackArt,
      spec,
      layout,
    });
  }

  const postFormat: SocialImageFormat = input.format || formatForPlatforms(input.platforms);
  return { slideCount, planned, layouts, postFormat };
}

/** Draw the slides one by one, saving after each, starting after `done`. */
async function renderCarouselSlides(
  input: GenerateCarouselSlidesInput,
  plan: CarouselPlan,
  done: CarouselSlide[],
  priorAttempts = 0,
): Promise<GenerateCarouselSlidesResult> {
  const { planned, layouts, postFormat } = plan;
  const { attachGeneratedImage } = await import('./image-attach.service');
  const { brandPosterFrame } = await import('../providers/images/poster-frame');
  const engine = input.engine || ContentEngine.CALENDAR;
  const isB2c = String(input.brandType || 'b2b').toLowerCase() === 'b2c';
  const visualStyleId =
    input.visualStyleId || (isB2c ? 'cinematic_photo' : 'professional_photo');
  const logoUrl = preferOriginalLogoUrl(input.logoUrl) || input.logoUrl || null;
  const contactChips = buildBrandContactChips(input.contacts || {});
  const format = SOCIAL_IMAGE_FORMATS[postFormat];

  const baseAttach = {
    brandImageStyle: input.brandImageStyle,
    companyName: input.companyName || input.company,
    logoUrl,
    creativeType: 'poster' as const,
    format: postFormat,
    overlay: { overlaysEnabled: true },
    visualStyleId,
    posterQuality: true,
    throwOnError: true,
  };

  const slides: CarouselSlide[] = [...done];
  const progressBase = {
    total: planned.length,
    planned: planned as unknown as CarouselProgress['planned'],
    layouts: layouts as string[],
    contacts: contactChips,
    format: postFormat,
    resume: (() => {
      const { tenantId: _t, contentId: _c, ...rest } = input;
      void _t;
      void _c;
      return JSON.parse(JSON.stringify(rest)) as Record<string, unknown>;
    })(),
  };
  for (let i = slides.length; i < planned.length; i++) {
    await assertGenerationActive(input.contentId);
    try {
    const slide = planned[i]!;
    const isLast = i === planned.length - 1;
    const exactHero = (input.heroImageUrls?.[i] || '').trim();

    let imageUrl = '';
    let rawImageUrl: string | null = null;

    if (exactHero) {
      const framed = await brandPosterFrame({
        tenantId: input.tenantId,
        imageUrl: exactHero,
        spec: slide.spec,
        companyName: input.companyName || input.company,
        logoUrl,
        brandImageStyle: input.brandImageStyle,
        layout: slide.layout,
        slideLabel: `${i + 1} / ${planned.length}`,
        contactChips: isLast ? contactChips : null,
        width: format.width,
        height: format.height,
      });
      imageUrl = framed.publicUrl;
      rawImageUrl = exactHero;
    } else {
      const attached = await attachGeneratedImage(
        input.tenantId,
        input.contentId,
        slide.imagePrompt,
        {
          ...baseAttach,
          posterSpec: slide.spec,
          posterLayout: slide.layout,
          slideLabel: `${i + 1} / ${planned.length}`,
          contactChips: isLast ? contactChips : null,
          negativePrompt: slide.spec.artNegativePrompt,
          contentBrief: `${slide.headline} — ${input.post.body.slice(0, 180)}`.slice(0, 420),
          savePrompt: false,
          skipPersist: true,
          // Same look for the whole carousel, a different reference picture per slide.
          dnaImageSeed: `${input.contentId}:${i}`,
        },
      );
      if (!attached?.imageUrl) {
        throw new Error(`Carousel slide ${i + 1} failed to generate`);
      }
      imageUrl = attached.imageUrl;
      rawImageUrl = attached.rawImageUrl || null;
    }

    slides.push({
      index: i + 1,
      headline: slide.headline,
      imagePrompt: slide.imagePrompt,
      imageUrl,
      rawImageUrl,
      posterSpec: slide.spec as unknown as Record<string, unknown>,
      posterLayout: slide.layout,
    });
    // Save every finished slide at once: a later failure must not throw this one away.
    if (input.persist !== false) {
      await saveProgress(input.contentId, { ...progressBase, slides: [...slides] });
    }
    } catch (error) {
      // A stop requested by the user is not a failure of the slide.
      if (isGenerationAbortedError(error)) throw error;
      const saved = slides.length;
      const technical = error instanceof Error ? error.message : String(error);
      if (input.persist !== false) {
        await saveProgress(input.contentId, {
          ...progressBase,
          slides: [...slides],
          failure: { slide: i + 1, message: technical.slice(0, 500), at: new Date().toISOString(), attempts: priorAttempts + 1 },
        }).catch(() => undefined);
      }
      await executionLogService.log({
        tenantId: input.tenantId,
        contentId: input.contentId,
        workflowStep: input.workflowStep || 'carousel:slides',
        engine,
        message: `Slide ${i + 1} of ${planned.length} failed (${saved} saved): ${technical.slice(0, 300)}`,
      });
      // Out-of-credit errors keep their own "Add money" alert; everything else gets the slide summary.
      if (toProviderCreditError(error, undefined, 'image')) throw error;
      throw new CarouselSlideError(i + 1, planned.length, saved, error);
    }
  }

  const cover = slides[0]!;
  const templateSlots: Record<string, unknown> = {
    playId: input.playId,
    source: input.source,
    format: 'carousel',
    posterSpec: planned[0]?.spec as unknown as Record<string, unknown>,
    posterLayout: planned[0]?.layout,
    layoutLabel: planned[0]?.layout ? LAYOUT_LABELS[planned[0].layout] : undefined,
    /** Separated prompts: art = photo model; layout = compositor id */
    prompts: {
      image: cover.imagePrompt,
      layout: planned[0]?.layout,
      layoutLabel: planned[0]?.layout ? LAYOUT_LABELS[planned[0].layout] : undefined,
    },
    carousel: {
      slideCount: slides.length,
      format: postFormat,
      slides,
      contacts: contactChips,
      layouts,
    },
  };

  if (input.persist !== false) {
    await prisma.generatedContent.update({
      where: { id: input.contentId },
      data: {
        imageUrl: cover.imageUrl,
        rawImageUrl: cover.rawImageUrl || null,
        imagePrompt: cover.imagePrompt,
        templateSlots: templateSlots as object,
      },
    });
  }

  return {
    slideCount: slides.length,
    slides,
    coverImageUrl: cover.imageUrl,
    coverRawImageUrl: cover.rawImageUrl || null,
    coverImagePrompt: cover.imagePrompt,
    templateSlots,
  };
}
