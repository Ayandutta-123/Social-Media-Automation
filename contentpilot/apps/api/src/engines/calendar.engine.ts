import { ContentEngine, ExecutionStatus } from '@contentpilot/shared';
import { prisma } from '../lib/prisma';
import { LLMService, buildSystemPrompt } from '../services/llm.service';
import { executionLogService } from '../services/execution-log.service';
import { assertGenerationActive } from '../services/generation-abort.service';
import { type CalendarEvent } from '../data/festival-calendar';
import { resolveFestivalEvent } from '../services/calendar-catalog.service';
import {
  defaultBrandCanvas,
  renderBrandCanvasSvg,
  saveRenderedSvg,
  isLayerDynamic,
  type BrandCanvas,
} from '../providers/templates/brand-renderer';
import { preferOriginalLogoUrl } from '../lib/store-upload';
import { generatePosterSpec } from '../services/poster-spec.service';
import { parseCarouselSlideCount } from '../lib/carousel-parse';
import { generateCarouselSlides } from '../services/carousel-generate.service';
import { formatForPlatforms } from '../providers/images/social-frame';

export type CustomCalendarPlanOpts = {
  id?: string;
  title: string;
  date: string;
  theme?: string;
  notes?: string;
  /** Exact uploaded day brief — preferred over notes for the LLM */
  detail?: string;
  /** poster | carousel | none */
  assetType?: 'poster' | 'carousel' | 'none' | string;
  carouselSlideCount?: number | null;
  hashtags?: string[];
};

export type CalendarGenerateOpts = {
  /** Built-in festival catalog id — omit when customPlan is set */
  eventId?: string;
  eventYear?: number;
  /** Uploaded / pasted month plan row */
  customPlan?: CustomCalendarPlanOpts;
  /** When set, after generation mark scheduled instead of pending_approval */
  scheduledAt?: string | Date | null;
  platforms?: Array<'instagram' | 'linkedin' | 'facebook' | 'twitter'>;
  /** If true with no schedule, publish immediately after generation */
  publishNow?: boolean;
  useBrandTemplate?: boolean;
  brandTemplateId?: string;
  /** Visual style preset id chosen on the calendar plan */
  visualStyleId?: string | null;
  /**
   * existing_template | ai (fal photo + SVG overlays) | ai_baked_layout (typography bake + logo stamp)
   */
  visualMode?: 'existing_template' | 'ai' | 'ai_baked_layout';
};

/**
 * A one-line "describe a visual" instruction produces mood-board mush. Force the
 * copy model to hand the image model real art direction instead.
 */
function imagePromptInstruction(subject: string, brandStyle?: string | null): string {
  return [
    `- imagePrompt: write a LONG, highly detailed photography brief for ONE finished ${brandStyle || 'professional'} full-bleed social background matching ${subject} — subject, setting, lighting, camera, materials, color grade, composition, mood; no logos or readable text.`,
    '  Prefer photoreal editorial photography of a place that could exist in the real world (conference floor, city street at dusk, meeting room, control-room interior, product close-up).',
    '  Name the concrete focal subject, the setting, the camera angle, the lighting, and a three-colour palette.',
    '  Pick a specific metaphor for this exact topic — never a generic robot, cyborg, glowing brain, circuit board, handshake, or neon HUD.',
    '  HARD BANS: no outdoor/rooftop server racks, no holographic wireframe buildings, no floating digital-twin overlays, no impossible physics tech props.',
    '  Keep the top ~20% and bottom ~15% visually calm (soft sky, wall, or bokeh) so a logo + headline + CTA can overlay cleanly.',
    '  Describe only what is visible. No logos, no signage, no readable words in the art (logo, headline and CTA are composited afterwards).',
  ].join('\n');
}

function formatEventBrief(event: CalendarEvent): string {
  return [
    `Event: ${event.name}`,
    `Type: ${event.category}`,
    `Region: ${event.region.toUpperCase()}`,
    `Date: ${event.date}`,
    `About: ${event.description}`,
    `Creative direction: ${event.promptHints}`,
    `Suggested hashtags to consider: ${event.hashtagHints.join(', ')}`,
  ].join('\n');
}

function formatCustomPlanBrief(plan: CustomCalendarPlanOpts, company: string): string {
  const detail = (plan.detail || plan.notes || '').trim();
  const assetType = String(plan.assetType || 'poster').toLowerCase();
  const assetLabel =
    assetType === 'none'
      ? 'No image — caption / text post only'
      : assetType === 'carousel'
        ? `Carousel${plan.carouselSlideCount ? ` (${plan.carouselSlideCount} slides)` : ''}`
        : 'Static poster (single image)';

  return [
    `Content calendar idea (uploaded plan for ${company})`,
    `Title / topic: ${plan.title}`,
    `Planned publish date: ${plan.date}`,
    plan.theme ? `Theme / pillar: ${plan.theme}` : '',
    `Asset type: ${assetLabel}`,
    plan.hashtags?.length ? `Suggested hashtags: ${plan.hashtags.join(', ')}` : '',
    detail
      ? [
          '',
          'AUTHORITATIVE DAY DETAIL (from the uploaded calendar — do NOT invent facts, claims, CTAs, or angles outside this block):',
          '<<<',
          detail,
          '>>>',
        ].join('\n')
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export class CalendarEngine {
  async generate(tenantId: string, contentId: string, opts: CalendarGenerateOpts): Promise<void> {
    const start = Date.now();
    await assertGenerationActive(contentId);

    const brandSettings = await prisma.brandSettings.findUnique({ where: { tenantId } });
    const llm = await LLMService.forTenant(tenantId);
    const company = brandSettings?.companyName || 'our brand';

    const custom = opts.customPlan?.title?.trim()
      ? {
          id: opts.customPlan.id || `custom-${contentId}`,
          title: opts.customPlan.title.trim(),
          date: opts.customPlan.date,
          theme: opts.customPlan.theme || '',
          notes: opts.customPlan.notes || '',
          detail: opts.customPlan.detail || opts.customPlan.notes || '',
          assetType: (opts.customPlan.assetType || 'poster') as string,
          carouselSlideCount: opts.customPlan.carouselSlideCount ?? null,
          hashtags: opts.customPlan.hashtags || [],
        }
      : null;

    // Link the plan entry to this draft right away (the scheduler only does it after queuing), so image
    // generation can find the plan's style pictures even on the very first run.
    if (custom && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(custom.id)) {
      await prisma.contentCalendarPlanEntry
        .updateMany({ where: { id: custom.id, plan: { tenantId } }, data: { contentId } })
        .catch(() => undefined);
    }

    const event = !custom && opts.eventId ? await resolveFestivalEvent(opts.eventId, opts.eventYear) : null;
    if (!custom && !event) {
      throw new Error(
        opts.eventId
          ? `Unknown calendar event: ${opts.eventId}`
          : 'Calendar generation requires a festival event or custom plan entry',
      );
    }

    const eventName = custom?.title || event!.name;
    const eventDate = custom?.date || event!.date;
    const hashtagHints = custom?.hashtags?.length
      ? custom.hashtags
      : event?.hashtagHints || [];

    await executionLogService.log({
      tenantId,
      contentId,
      workflowStep: 'calendar:start',
      engine: ContentEngine.CALENDAR,
      message: custom
        ? `Custom plan · ${eventName} (${eventDate}) · ${company}`
        : `${eventName} (${eventDate}) · ${event!.region}`,
    });

    const useBrand = Boolean(opts.useBrandTemplate && opts.brandTemplateId);
    const assetType = String(custom?.assetType || 'poster').toLowerCase();
    const noImage = assetType === 'none';
    const carouselHint = custom
      ? assetType === 'carousel'
        ? custom.carouselSlideCount && custom.carouselSlideCount >= 2
          ? custom.carouselSlideCount
          : parseCarouselSlideCount(custom.title, custom.theme, custom.detail, custom.notes) || 3
        : assetType === 'none'
          ? null
          : parseCarouselSlideCount(custom.title, custom.theme, custom.detail, custom.notes)
      : null;
    // Carousel needs N Full AI slides — Brand Studio plates are single-frame.
    // No-image entries skip Brand Studio art entirely.
    const brandTemplate =
      useBrand && !carouselHint && !noImage
        ? await prisma.brandTemplate.findFirst({
            where: {
              id: opts.brandTemplateId!,
              tenantId,
              deletedAt: null,
              isActive: true,
            },
          })
        : null;

    const dynamicSlots = brandTemplate
      ? ((brandTemplate.canvas as BrandCanvas | null)?.layers || [])
          .filter((l) => isLayerDynamic(l) && l.type === 'text')
          .map((l) => l.slot || l.id)
      : [];

    const brief = custom
      ? formatCustomPlanBrief(custom, company)
      : formatEventBrief(event!);

    const post = await llm.generatePost({
      systemPrompt: buildSystemPrompt(
        brandSettings ?? {
          brandVoice: '',
          imageStyle: '',
          hashtagStrategy: '',
          contentGuidelines: '',
          targetAudience: '',
        },
      ),
      userPrompt: custom
        ? `Create a professional social media post from this brand content-calendar plan.

STRICT RULES:
- Write ONLY for company "${company}" using the brand voice, audience, and guidelines from the system prompt.
- This is content-calendar type content (planned theme/topic for the month) — not a random meme or competitor riff.
- Stay faithful to the AUTHORITATIVE DAY DETAIL in the brief; do not invent unrelated campaigns, metrics, or CTAs.
- Asset type for this row: ${
            noImage
              ? 'NO IMAGE — write caption/headline only. imagePrompt may be a short placeholder; no visual will be generated.'
              : carouselHint
                ? `CAROUSEL with ${carouselHint} slides. Write one strong feed caption that works across the carousel (hook on slide 1, payoff in the caption).`
                : 'STATIC POSTER — one finished feed image plus caption.'
          }

${brief}

Requirements:
- Sound like a thoughtful B2B brand post for ${company} — not a generic template.
- Write the body primarily for LinkedIn: professional, 2–4 short paragraphs, clear CTA.
- Headline max ~100 chars. Hashtags: 4–8 tags as plain words WITHOUT # prefixes.
- Instagram will be adapted automatically into a shorter punchier variant.
${
  noImage
    ? '- imagePrompt: write a one-line note "text-only post — no image".'
    : imagePromptInstruction('the calendar idea', brandSettings?.imageStyle)
}${
            brandTemplate
              ? `\nAlso prepare short copy for brand template slots: ${dynamicSlots.join(', ') || 'headline, body'}.`
              : ''
          }`
        : `Create a professional social media post for a cultural / national calendar moment.

Brand: ${company}
${brief}

Requirements:
- Sound like a thoughtful brand greeting or thought-leadership nod — not a generic template.
- Respect the culture and region; avoid stereotypes and over-commercial hard sell.
- Write the body primarily for LinkedIn: professional, 2–4 short paragraphs, clear CTA.
- Headline max ~100 chars. Hashtags: 4–8 tags as plain words WITHOUT # prefixes (e.g. "APIEconomy" not "#APIEconomy"). Include some suggested tags when they fit.
- Instagram will be adapted automatically into a shorter punchier variant — do not stuff the body with Instagram slang.
${imagePromptInstruction('the occasion', brandSettings?.imageStyle)}${
            brandTemplate
              ? `\nAlso prepare short copy for brand template slots: ${dynamicSlots.join(', ') || 'headline, body'}.`
              : ''
          }`,
    });

    let slots: Record<string, string> = {
      headline: post.headline,
      subtext: post.callToAction || post.body.slice(0, 120),
      body: post.body.slice(0, 200),
    };

    if (brandTemplate && dynamicSlots.length) {
      try {
        const slotJson = await llm.generateRawJson({
          systemPrompt: 'Return JSON only. Fill each key with short on-brand copy for a social graphic.',
          userPrompt: `Event: ${eventName}\nHeadline: ${post.headline}\nBody: ${post.body}\nFill these slots: ${JSON.stringify(dynamicSlots)}`,
        });
        for (const [k, v] of Object.entries(slotJson)) {
          if (typeof v === 'string') slots[k] = v;
          else if (v != null) slots[k] = JSON.stringify(v);
        }
        if (!slots.headline) slots.headline = post.headline;
      } catch {
        // keep defaults
      }
    }

    const platforms = (opts.platforms || []) as ('instagram' | 'linkedin' | 'facebook' | 'twitter')[];
    const scheduledAt = opts.scheduledAt ? new Date(opts.scheduledAt) : null;
    const wantSchedule = Boolean(scheduledAt && !Number.isNaN(scheduledAt.getTime()));

    const sourceReference = custom
      ? [
          `calendar:custom:${custom.id}`,
          `date:${custom.date}`,
          `company:${company}`,
          custom.title,
          custom.theme || '',
          custom.notes || '',
        ]
          .filter(Boolean)
          .join('\n')
      : [
          `calendar:${event!.id}`,
          `region:${event!.region}`,
          `date:${event!.date}`,
          event!.name,
          event!.description,
        ].join('\n');

    let imageUrl: string | null = null;
    await assertGenerationActive(contentId);
    if (brandTemplate) {
      await executionLogService.log({
        tenantId,
        contentId,
        workflowStep: 'calendar:brand_template',
        engine: ContentEngine.CALENDAR,
        message: `AI art + brand template ${brandTemplate.name}`,
      });

      const prompt =
        post.imagePrompt?.trim() ||
        `Photorealistic editorial photo for: ${post.headline}. ${eventName}. ${post.body.slice(0, 160)}`;

      try {
        const { renderBrandTemplateWithAiArt } = await import('../services/content-template.service');
        const rendered = await renderBrandTemplateWithAiArt({
          tenantId,
          contentId,
          brandTemplateId: brandTemplate.id,
          slots,
          imagePrompt: prompt,
          prefix: 'calendar',
        });
        imageUrl = rendered.imageUrl;
        slots = rendered.slots;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await executionLogService.log({
          tenantId,
          contentId,
          workflowStep: 'calendar:brand_template_fallback',
          engine: ContentEngine.CALENDAR,
          message: msg,
        });
        const canvas = (
          brandTemplate.canvas && typeof brandTemplate.canvas === 'object'
            ? structuredClone(brandTemplate.canvas)
            : defaultBrandCanvas({
                companyName: brandSettings?.companyName || undefined,
                backgroundUrl: brandTemplate.backgroundUrl || undefined,
              })
        ) as BrandCanvas;
        if (brandTemplate.backgroundUrl) {
          canvas.background = { type: 'image', value: brandTemplate.backgroundUrl };
        }
        const svg = await renderBrandCanvasSvg(canvas, slots);
        const saved = await saveRenderedSvg(tenantId, svg, 'calendar');
        imageUrl = saved.publicUrl;
      }
    }

    const { buildPlatformCaptionsFromIntent, normalizeHashtags } = await import(
      '../services/platform-captions'
    );
    const hashtags = normalizeHashtags(
      post.hashtags?.length ? post.hashtags : hashtagHints.slice(0, 6),
    );
    const platformCaptions = buildPlatformCaptionsFromIntent({}, {
      headline: post.headline,
      body: post.body,
      hashtags,
      callToAction: post.callToAction ?? null,
    });

    await prisma.generatedContent.update({
      where: { id: contentId },
      data: {
        headline: post.headline,
        body: post.body,
        hashtags,
        callToAction: post.callToAction,
        platformCaptions,
        imagePrompt: post.imagePrompt,
        sourceReference,
        targetPlatforms: platforms,
        scheduledAt: wantSchedule ? scheduledAt : null,
        // Stay generating until image is ready so Approvals opens complete
        status: 'generating',
        brandTemplateId: brandTemplate?.id ?? null,
        ...(brandTemplate ? { templateSlots: slots } : {}),
        ...(imageUrl ? { imageUrl } : {}),
      },
    });

    if (!brandTemplate && !noImage) {
      // Full AI (no Brand Studio plate): either overlay path OR fal baked poster.
      const isB2c = String(brandSettings?.brandType || 'b2b').toLowerCase() === 'b2c';
      const { attachGeneratedImage } = await import('../services/image-attach.service');
      const carouselCount = carouselHint;

      const playId = isB2c ? 'b2c_feed' : 'full_ai_feed';
      const source = custom ? 'content_calendar_plan' : 'festival_calendar';
      const visualStyleId =
        opts.visualStyleId || (isB2c ? 'cinematic_photo' : 'professional_photo');
      const logoUrl =
        preferOriginalLogoUrl(brandSettings?.logoUrl) || brandSettings?.logoUrl || null;
      const baked = opts.visualMode === 'ai_baked_layout';

      if (baked && !(carouselCount && carouselCount >= 2)) {
        await executionLogService.log({
          tenantId,
          contentId,
          workflowStep: 'calendar:baked_poster',
          engine: ContentEngine.CALENDAR,
          message: 'AI painted poster (typography model + real logo stamp)',
        });
        const { attachBakedPosterForContent } = await import('../services/baked-poster.service');
        const result = await attachBakedPosterForContent({
          tenantId,
          contentId,
          companyName: company,
          headline: post.headline,
          body: post.body,
          callToAction: post.callToAction,
          topic: eventName,
          visualStyleId,
          brandImageStyle: brandSettings?.imageStyle,
          playId: 'announcement',
        });
        if (result) {
          const existing = await prisma.generatedContent.findUnique({
            where: { id: contentId },
            select: { templateSlots: true },
          });
          const prev =
            existing?.templateSlots &&
            typeof existing.templateSlots === 'object' &&
            !Array.isArray(existing.templateSlots)
              ? (existing.templateSlots as Record<string, unknown>)
              : {};
          await prisma.generatedContent.update({
            where: { id: contentId },
            data: {
              templateSlots: {
                ...prev,
                playId,
                source,
                creativeMode: 'ai_baked_layout',
                bakeBrief: result.bakeBrief as unknown as Record<string, unknown>,
                visualStyleId,
              } as object,
            },
          });
        }
      } else {
      const baseAttach = {
        brandImageStyle: brandSettings?.imageStyle,
        companyName: brandSettings?.companyName,
        logoUrl,
        creativeType: 'social' as const,
        format: formatForPlatforms(platforms),
        overlay: { overlaysEnabled: true },
        visualStyleId,
        posterQuality: true,
        throwOnError: true,
      };

      if (carouselCount && carouselCount >= 2) {
        await generateCarouselSlides({
          tenantId,
          contentId,
          platforms,
          slideCount: carouselCount,
          company,
          brief,
          post: {
            headline: post.headline,
            body: post.body,
            imagePrompt: post.imagePrompt,
            callToAction: post.callToAction,
          },
          brandImageStyle: brandSettings?.imageStyle,
          companyName: brandSettings?.companyName,
          logoUrl: brandSettings?.logoUrl,
          brandType: brandSettings?.brandType,
          playId,
          source,
          visualStyleId,
          engine: ContentEngine.CALENDAR,
          workflowStep: 'calendar:carousel',
        });
      } else {
        // Designed poster: pick a varied layout (not always hero_right), then
        // write copy that matches that geometry.
        const { pickSinglePosterLayout, LAYOUT_LABELS } = await import('../services/poster-layout-pick');
        const posterLayout = pickSinglePosterLayout(
          `${contentId}:${eventName}:${playId}:${post.headline}`,
        );
        const posterSpec = await generatePosterSpec({
          tenantId,
          topic: eventName,
          brief,
          headline: post.headline,
          body: post.body,
          callToAction: post.callToAction,
          layout: posterLayout,
        });

        await prisma.generatedContent.update({
          where: { id: contentId },
          data: {
            templateSlots: {
              playId,
              source,
              creativeMode: 'ai',
              posterSpec: posterSpec as unknown as Record<string, unknown>,
              posterLayout,
              layoutLabel: LAYOUT_LABELS[posterLayout],
              prompts: {
                image: posterSpec.artPrompt || post.imagePrompt,
                layout: posterLayout,
                layoutLabel: LAYOUT_LABELS[posterLayout],
              },
            } as object,
          },
        });

        await attachGeneratedImage(
          tenantId,
          contentId,
          posterSpec.artPrompt || post.imagePrompt,
          {
            ...baseAttach,
            creativeType: 'poster' as const,
            posterSpec,
            posterLayout,
            negativePrompt: posterSpec.artNegativePrompt,
            headerText: post.headline,
            footerCta: post.callToAction || null,
            contentBrief: `${post.headline} — ${post.body.slice(0, 220)}`.slice(0, 420),
          },
        );
      }
      }
    } else if (noImage) {
      await executionLogService.log({
        tenantId,
        contentId,
        workflowStep: 'calendar:no_image',
        engine: ContentEngine.CALENDAR,
        message: 'Asset type = no image — caption only (skipped poster/carousel art)',
      });
    }

    if (wantSchedule) {
      await prisma.generatedContent.update({
        where: { id: contentId },
        data: { status: 'scheduled', scheduledAt },
      });
    } else if (opts.publishNow && platforms.length) {
      await prisma.generatedContent.update({
        where: { id: contentId },
        data: { status: 'approved', targetPlatforms: platforms },
      });
      const { enqueuePublishing } = await import('../workers');
      await enqueuePublishing(contentId, tenantId, platforms);
    } else {
      await prisma.generatedContent.update({
        where: { id: contentId },
        data: { status: 'pending_approval' },
      });
    }

    if (wantSchedule && platforms.length) {
      const { enqueuePublishing } = await import('../workers');
      await enqueuePublishing(contentId, tenantId, platforms, {
        runAt: scheduledAt!,
      });
    }

    await executionLogService.log({
      tenantId,
      contentId,
      workflowStep: 'calendar:complete',
      engine: ContentEngine.CALENDAR,
      status: ExecutionStatus.SUCCESS,
      durationMs: Date.now() - start,
      message: wantSchedule
        ? `Scheduled for ${scheduledAt!.toISOString()}`
        : opts.publishNow
          ? 'Publishing now'
          : 'Ready for approval',
    });
  }
}
