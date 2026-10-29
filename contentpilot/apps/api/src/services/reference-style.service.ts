import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { parseJsonObjectLenient } from '../lib/json';
import { resolveProviders } from './providers.service';
import { ProviderCreditError, buildProviderCreditAlert, isCreditFailureText, type CreditTool } from '../lib/provider-credits';

function throwVisionFailure(tool: CreditTool, label: string, status: number, errText: string): never {
  if (isCreditFailureText(`${errText} ${tool}`, status)) {
    throw new ProviderCreditError(buildProviderCreditAlert(tool, 'caption'));
  }
  throw new Error(`${label} (${status}): ${errText.slice(0, 240)}`);
}

/**
 * Load a brand-reference upload (or remote URL) as a data URI for vision / img2img.
 */
export async function resolveReferenceDataUri(urlOrPath: string): Promise<string> {
  if (!urlOrPath) throw new Error('No brand reference image');
  if (urlOrPath.startsWith('data:')) return urlOrPath;

  if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
    const res = await fetch(urlOrPath);
    if (!res.ok) throw new Error(`Could not fetch brand reference (${res.status})`);
    const buf = Buffer.from(await res.arrayBuffer());
    const ctype = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
    const mime = ctype.startsWith('image/') ? ctype : 'image/jpeg';
    return `data:${mime};base64,${buf.toString('base64')}`;
  }

  const cleaned = urlOrPath.replace(/^\/uploads\//, '');
  const full = path.resolve(config.UPLOAD_DIR, cleaned);
  if (!full.startsWith(path.resolve(config.UPLOAD_DIR)) || !fs.existsSync(full)) {
    throw new Error('Brand reference file not found');
  }
  const buf = fs.readFileSync(full);
  const ext = path.extname(full).toLowerCase();
  const mime =
    ext === '.png'
      ? 'image/png'
      : ext === '.webp'
        ? 'image/webp'
        : ext === '.gif'
          ? 'image/gif'
          : 'image/jpeg';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

/**
 * Absolute URL for providers that need a fetchable image (fal img2img).
 * Local uploads are served from API /uploads.
 */
export function resolveReferencePublicUrl(urlOrPath: string): string {
  if (!urlOrPath) return '';
  if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://') || urlOrPath.startsWith('data:')) {
    return urlOrPath;
  }
  const base = config.API_URL.replace(/\/$/, '');
  const pathPart = urlOrPath.startsWith('/') ? urlOrPath : `/${urlOrPath}`;
  return `${base}${pathPart}`;
}

const STYLE_ANALYSIS_PROMPT = `You are a senior brand art director. Parse this social/poster reference into STRICT JSON for an image model.

Return JSON ONLY (no markdown). Every field is required. Describe HOW IT LOOKS, never the specific product, person, headline, or logo to copy.

{
  "medium": "photoreal|cinematic-photo|editorial-photo|flat-illustration|3d-render|collage|vector|watercolor|line-art|mixed",
  "varietyKey": "kebab-case family id, e.g. cinematic-teal-product or warm-editorial-portrait",
  "varietyLabel": "short human name for this look, max 6 words",
  "subjectArchetype": "kind of scene only, e.g. workspace still-life / aerial city dusk / anonymous hands at laptop — not a brand name",
  "colorPalette": {
    "dominant": ["#hex or named hue"],
    "accents": ["..."],
    "background": "ground / negative-space colour",
    "contrast": "high|medium|low"
  },
  "lighting": "key light, direction, quality (hard/soft), time-of-day, practicals",
  "mood": "3-8 word emotional register",
  "composition": {
    "layout": "full-bleed|hero-left|hero-right|centered-hero|split|grid|typography-led|editorial-overlay",
    "camera": "lens feel, angle, distance",
    "depth": "shallow / deep / layered foreground",
    "negativeSpace": "where NEW headline/logo may sit"
  },
  "textureFinish": "grain, gloss, matte, paper, film, CGI polish",
  "typography": {
    "present": true,
    "placement": "where type sits if any",
    "weight": "thin|regular|bold|display|mixed|none",
    "leaveRoomFor": "where a NEW headline should live — do not copy words"
  },
  "logoTreatment": "corner badge / none in frame / integrated / unknown",
  "doKeep": ["5-8 invariants that MUST recur for this variety"],
  "doVary": ["what MAY change so posts in this family are not clones"],
  "doNotCopy": ["readable text, faces, logos, unique props from THIS frame"],
  "imagePromptBlock": "90-160 words of image-model art direction: medium, palette with hexes, lighting, camera, composition, finish, negative space. Imperative voice. No copied headline.",
  "narrativeBrief": "120-200 word human summary of the look"
}

Rules:
- varietyKey must be stable and reusable across similar posters (same medium + palette family + layout).
- If this is a photo, say photoreal/cinematic/editorial — never "illustration" unless it truly is.
- Hexes preferred for dominant/accent colours.
- Never instruct the model to paint existing headline words.`;

export type BrandVisualAnalysis = {
  medium: string;
  varietyKey: string;
  varietyLabel: string;
  subjectArchetype: string;
  colorPalette: {
    dominant: string[];
    accents: string[];
    background: string;
    contrast: 'high' | 'medium' | 'low';
  };
  lighting: string;
  mood: string;
  composition: {
    layout: string;
    camera: string;
    depth: string;
    negativeSpace: string;
  };
  textureFinish: string;
  typography: {
    present: boolean;
    placement: string;
    weight: string;
    leaveRoomFor: string;
  };
  logoTreatment: string;
  doKeep: string[];
  doVary: string[];
  doNotCopy: string[];
  imagePromptBlock: string;
  narrativeBrief: string;
};

function asStringList(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) return fallback;
  return value.map((v) => String(v).trim()).filter(Boolean).slice(0, 12);
}

function slugVariety(raw: string): string {
  const s = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return s || 'brand-look';
}

export function parseBrandVisualAnalysis(
  raw: string,
  fallbackNarrative = '',
): BrandVisualAnalysis {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = parseJsonObjectLenient(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]) as Record<string, unknown>;
      } catch {
        parsed = {};
      }
    }
  }

  const palette = (
    parsed.colorPalette && typeof parsed.colorPalette === 'object' ? parsed.colorPalette : {}
  ) as Record<string, unknown>;
  const composition = (
    parsed.composition && typeof parsed.composition === 'object' ? parsed.composition : {}
  ) as Record<string, unknown>;
  const typography = (
    parsed.typography && typeof parsed.typography === 'object' ? parsed.typography : {}
  ) as Record<string, unknown>;
  const contrastRaw = String(palette.contrast || 'medium').toLowerCase();
  const contrast = (['high', 'medium', 'low'].includes(contrastRaw)
    ? contrastRaw
    : 'medium') as BrandVisualAnalysis['colorPalette']['contrast'];

  const medium = String(parsed.medium || 'photoreal').trim() || 'photoreal';
  const layout = String(composition.layout || 'full-bleed').trim() || 'full-bleed';
  const varietyKey = slugVariety(String(parsed.varietyKey || `${medium}-${layout}`));
  const narrative = String(parsed.narrativeBrief || parsed.imagePromptBlock || fallbackNarrative || raw)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1800);
  const imagePromptBlock = String(parsed.imagePromptBlock || narrative)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1600);

  return {
    medium,
    varietyKey,
    varietyLabel: String(parsed.varietyLabel || varietyKey.replace(/-/g, ' ')).slice(0, 80),
    subjectArchetype: String(parsed.subjectArchetype || 'brand scene').slice(0, 180),
    colorPalette: {
      dominant: asStringList(palette.dominant, ['brand primary']),
      accents: asStringList(palette.accents),
      background: String(palette.background || 'dark ground').slice(0, 80),
      contrast,
    },
    lighting: String(parsed.lighting || 'soft editorial key light').slice(0, 280),
    mood: String(parsed.mood || 'premium, restrained').slice(0, 120),
    composition: {
      layout,
      camera: String(composition.camera || 'eye-level medium').slice(0, 180),
      depth: String(composition.depth || 'layered').slice(0, 120),
      negativeSpace: String(composition.negativeSpace || 'calm lower third for type').slice(0, 180),
    },
    textureFinish: String(parsed.textureFinish || 'clean matte').slice(0, 180),
    typography: {
      present: Boolean(typography.present),
      placement: String(typography.placement || 'none in frame').slice(0, 160),
      weight: String(typography.weight || 'none').slice(0, 40),
      leaveRoomFor: String(typography.leaveRoomFor || 'leave a quiet band for a new headline').slice(
        0,
        180,
      ),
    },
    logoTreatment: String(parsed.logoTreatment || 'unknown').slice(0, 120),
    doKeep: asStringList(parsed.doKeep, ['Keep medium, palette, lighting, and finish']),
    doVary: asStringList(parsed.doVary, ['New subject and camera angle']),
    doNotCopy: asStringList(parsed.doNotCopy, ['Do not copy readable text or logos']),
    imagePromptBlock,
    narrativeBrief: narrative,
  };
}

export function formatVisualAnalysisForPrompt(analysis: BrandVisualAnalysis): string {
  return [
    `VARIETY: ${analysis.varietyLabel} (${analysis.varietyKey})`,
    `Medium: ${analysis.medium}. Archetype: ${analysis.subjectArchetype}. Mood: ${analysis.mood}.`,
    `Palette: dominant ${analysis.colorPalette.dominant.join(', ')}; accents ${
      analysis.colorPalette.accents.join(', ') || 'none'
    }; ground ${analysis.colorPalette.background}; contrast ${analysis.colorPalette.contrast}.`,
    `Lighting: ${analysis.lighting}`,
    `Camera / layout: ${analysis.composition.camera}; ${analysis.composition.layout}; depth ${analysis.composition.depth}. Negative space: ${analysis.composition.negativeSpace}.`,
    `Finish: ${analysis.textureFinish}. Logo: ${analysis.logoTreatment}. Type: ${analysis.typography.leaveRoomFor}.`,
    `KEEP: ${analysis.doKeep.join('; ')}`,
    `MAY VARY: ${analysis.doVary.join('; ')}`,
    `DO NOT COPY: ${analysis.doNotCopy.join('; ')}`,
    analysis.imagePromptBlock,
  ].join('\n');
}

export function analysisFromLegacyBrief(brief: string, label?: string): BrandVisualAnalysis {
  return parseBrandVisualAnalysis(
    JSON.stringify({
      medium: 'photoreal',
      varietyKey: slugVariety(label || 'legacy-look'),
      varietyLabel: label || 'Approved look',
      imagePromptBlock: brief,
      narrativeBrief: brief,
    }),
    brief,
  );
}

/**
 * Structured vision parse of a brand/social reference (JSON art-direction card).
 */
export async function analyzeBrandReferenceImage(
  tenantId: string,
  referenceImageUrl: string,
): Promise<BrandVisualAnalysis> {
  // A refusal or truncated reply must not be stored as "style" — it would feed junk into every post.
  let lastRaw = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    lastRaw = await visionRawForReference(tenantId, referenceImageUrl);
    if (looksLikeVisualAnalysis(lastRaw)) return parseBrandVisualAnalysis(lastRaw);
  }
  throw new Error(
    `The model could not read this image as a poster style (${lastRaw.replace(/\s+/g, ' ').slice(0, 90) || 'empty reply'}). Try a clearer image.`,
  );
}

async function visionRawForReference(tenantId: string, referenceImageUrl: string): Promise<string> {
  const providers = await resolveProviders(tenantId);
  const dataUri = await resolveReferenceDataUri(referenceImageUrl);
  let raw = '';

  if (providers.llmProvider === 'claude' && providers.claudeApiKey) {
    raw = await visionTextClaude(
      providers.claudeApiKey,
      providers.llmModel,
      dataUri,
      STYLE_ANALYSIS_PROMPT,
      providers.claudeWorkspaceId,
      1600,
    );
  } else if (providers.openaiApiKey) {
    raw = await visionTextOpenAI(providers.openaiApiKey, dataUri, STYLE_ANALYSIS_PROMPT, 1600);
  } else if (providers.claudeApiKey) {
    raw = await visionTextClaude(
      providers.claudeApiKey,
      providers.llmModel || 'claude-sonnet-4-20250514',
      dataUri,
      STYLE_ANALYSIS_PROMPT,
      providers.claudeWorkspaceId,
      1600,
    );
  } else {
    throw new Error('No LLM API key available to analyze the brand reference image.');
  }

  return raw;
}

/** True when the vision reply really is an art-direction card (not a refusal or cut-off JSON). */
export function looksLikeVisualAnalysis(raw: string): boolean {
  try {
    const obj = parseJsonObjectLenient(raw) as Record<string, unknown>;
    const block = String(obj.imagePromptBlock || obj.narrativeBrief || '');
    return block.trim().length >= 40 && typeof obj.medium === 'string' && obj.medium.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Use vision so the image model can follow the brand reference.
 * Returns the image-model prompt block (structured parse, then narrative fallback).
 */
export async function describeBrandReferenceStyle(
  tenantId: string,
  referenceImageUrl: string,
): Promise<string> {
  const analysis = await analyzeBrandReferenceImage(tenantId, referenceImageUrl);
  return analysis.imagePromptBlock || analysis.narrativeBrief;
}

/** Build the locked prompt: same visual style as reference, new subject from chat. */
export function buildReferenceLockedImagePrompt(opts: {
  chatSubject: string;
  styleBrief: string;
  companyName?: string | null;
  brandImageStyle?: string | null;
}): string {
  const company = opts.companyName?.trim() || 'the brand';
  return [
    `Create a NEW social media poster for ${company}.`,
    `SUBJECT / MESSAGE (from the chat — customize THIS, do not copy the reference scene): ${opts.chatSubject}`,
    `STYLE LOCK (mandatory — use this variety's parsed art direction, not a generic look): ${opts.styleBrief}`,
    opts.brandImageStyle ? `Additional brand image style notes: ${opts.brandImageStyle}` : '',
    'Keep the same medium, palette, lighting, camera language, and finish as the locked variety.',
    'Change only the subject/content — next post in the SAME variety, not a blend of other looks.',
    'Do not copy readable text, logos, or watermarks from the reference.',
    'Agency-quality finished LinkedIn/Instagram creative, full-bleed.',
  ]
    .filter(Boolean)
    .join(' ');
}

const MEME_STRUCTURE_PROMPT = `You analyze a viral meme image for STRUCTURE only (not to copy copyrighted art or celebrity faces).

Return JSON ONLY:
{
  "layout": "split_v" | "split_h" | "impact" | "stacked",
  "panelCount": 1-4,
  "captionStyle": "short description of how text sits (top/bottom Impact bars, panel labels, etc.)",
  "structureNotes": "how the joke is paced across panels — setup vs punchline",
  "visualRecipe": "ORIGINAL recreation recipe: composition, panel split, color energy, silhouette/object metaphors — NO celebrity likeness, NO readable text to paint",
  "suggestedFormatId": "expectation_vs_reality|reject_approve|expanding_brain|distracted_choice|this_is_fine|waiting|trade_offer|one_does_not_simply|other"
}`;

export type MemeStructureBrief = {
  layout: 'split_v' | 'split_h' | 'impact' | 'stacked';
  panelCount: number;
  captionStyle: string;
  structureNotes: string;
  visualRecipe: string;
  suggestedFormatId?: string;
};

/** Vision: extract meme layout + caption structure from a scraped meme image. */
export async function describeMemeReferenceStructure(
  tenantId: string,
  referenceImageUrl: string,
): Promise<MemeStructureBrief> {
  const providers = await resolveProviders(tenantId);
  const dataUri = await resolveReferenceDataUri(referenceImageUrl);
  let raw = '';

  if (providers.llmProvider === 'claude' && providers.claudeApiKey) {
    raw = await visionTextClaude(
      providers.claudeApiKey,
      providers.llmModel,
      dataUri,
      MEME_STRUCTURE_PROMPT,
      providers.claudeWorkspaceId,
    );
  } else if (providers.openaiApiKey) {
    raw = await visionTextOpenAI(providers.openaiApiKey, dataUri, MEME_STRUCTURE_PROMPT);
  } else if (providers.claudeApiKey) {
    raw = await visionTextClaude(
      providers.claudeApiKey,
      providers.llmModel || 'claude-sonnet-4-20250514',
      dataUri,
      MEME_STRUCTURE_PROMPT,
      providers.claudeWorkspaceId,
    );
  } else {
    throw new Error('No LLM API key available to analyze the meme reference image.');
  }

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const parsed = jsonMatch ? (JSON.parse(jsonMatch[0]) as Record<string, unknown>) : {};
  const layoutRaw = String(parsed.layout || 'impact');
  const layout = (['split_v', 'split_h', 'impact', 'stacked'].includes(layoutRaw)
    ? layoutRaw
    : 'impact') as MemeStructureBrief['layout'];

  return {
    layout,
    panelCount: Math.min(4, Math.max(1, Number(parsed.panelCount) || 2)),
    captionStyle: String(parsed.captionStyle || 'Classic top/bottom meme captions'),
    structureNotes: String(parsed.structureNotes || 'Setup then punchline'),
    visualRecipe: String(
      parsed.visualRecipe ||
        'Recreate the same panel layout and comic energy with original anonymous silhouettes — no celebrity faces, no readable text in art',
    ),
    suggestedFormatId:
      typeof parsed.suggestedFormatId === 'string' ? parsed.suggestedFormatId : undefined,
  };
}

async function visionTextOpenAI(
  apiKey: string,
  dataUri: string,
  prompt: string,
  maxTokens = 700,
): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      max_tokens: maxTokens,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUri, detail: 'high' } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    throwVisionFailure('openai', 'Vision structure analysis failed', res.status, await res.text());
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Vision structure analysis returned empty');
  return text;
}

async function visionTextClaude(
  apiKey: string,
  model: string,
  dataUri: string,
  prompt: string,
  workspaceId?: string,
  maxTokens = 700,
): Promise<string> {
  const m = dataUri.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!m) throw new Error('Invalid reference data URI for vision analysis');
  const mediaType = m[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
      ...(workspaceId ? { 'anthropic-workspace-id': workspaceId } : {}),
    },
    body: JSON.stringify({
      model: model.includes('claude') ? model : 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: m[2] },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    throwVisionFailure('claude', 'Vision structure analysis failed', res.status, await res.text());
  }
  const data = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = data.content?.find((c) => c.type === 'text')?.text?.trim();
  if (!text) throw new Error('Vision structure analysis returned empty');
  return text;
}
