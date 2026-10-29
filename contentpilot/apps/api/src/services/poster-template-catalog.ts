/**
 * Poster templates — three designed layouts per playbook format.
 *
 * A template is a hard contract, not a hint: it fixes the render layout, which
 * copy blocks may exist, and how long each one is. The LLM is told the contract
 * in the prompt AND the result is clamped to it afterwards, so a chosen
 * template always produces the layout the user picked in the UI.
 *
 * Colours and fonts are never part of a template — those always come from the
 * Brand Kit in Settings, so the same template looks like each tenant's brand.
 */

import type { PosterLayoutId, PosterPillar, PosterSpec } from '../providers/images/poster-frame';
import { CONTENT_PLAYBOOK } from './content-playbook.service';
import { DESIGNED_TEMPLATES } from './poster-template-designs';

/** required = must be written, optional = write only if the brief supports it, omit = never render. */
export type PosterBlockRule = 'required' | 'optional' | 'omit';

export type PosterTemplateBlocks = {
  eyebrow: PosterBlockRule;
  subhead: PosterBlockRule;
  /** Exact number of icon pillars this layout renders. 0 = none. */
  pillars: 0 | 2 | 3;
  stat: PosterBlockRule;
  callout: PosterBlockRule;
  closing: PosterBlockRule;
  footer: PosterBlockRule;
};

export type PosterTemplate = {
  id: string;
  /** Playbook format this template belongs to (content-playbook.service). */
  playId: string;
  label: string;
  tagline: string;
  layout: PosterLayoutId;
  /**
   * When layout is uploaded_master, which engine fills the plate
   * (sale_circles / sale_split / uploaded_master composite).
   */
  fillLayout?: PosterLayoutId;
  blocks: PosterTemplateBlocks;
  /** Headline length budget, in words. */
  headlineWords: [number, number];
  /** Copy rules injected verbatim into the art-director prompt. */
  copyRules: string[];
  /** Hero art direction injected verbatim into the image prompt. */
  artDirection: string;
  /** Which block the accent colour should carry — drives the UI thumbnail. */
  accentRole: 'stat' | 'headline' | 'band' | 'rule';
  /** Exact uploaded master preview (picker shows this image). */
  previewUrl?: string;
  /** Same as preview for uploads — base plate for generation. */
  sourceImageUrl?: string;
  origin?: 'upload' | 'builtin';
  /** Sample copy used to render this template's preview in the picker. */
  sample?: Partial<PosterSpec>;
};

const EMPTY: PosterTemplateBlocks = {
  eyebrow: 'omit',
  subhead: 'omit',
  pillars: 0,
  stat: 'omit',
  callout: 'omit',
  closing: 'omit',
  footer: 'omit',
};

function blocks(overrides: Partial<PosterTemplateBlocks>): PosterTemplateBlocks {
  return { ...EMPTY, ...overrides };
}

/** Retail layouts with bespoke renderers (poster-offer-retail). Everything else is a drawn design. */
const RETAIL_TEMPLATES: PosterTemplate[] = [
  {
    id: 'offer_sale_circles',
    playId: 'offer',
    label: 'Circle cutouts',
    tagline: 'Exact Magnific layout — SALE lockup, mustard arc, circular photos, Brand Kit colours',
    layout: 'sale_circles',
    blocks: blocks({
      eyebrow: 'required',
      stat: 'required',
      subhead: 'required',
      closing: 'required',
      footer: 'required',
    }),
    headlineWords: [2, 5],
    copyRules: [
      'eyebrow is the kicker word only — SALE, DEAL, or OFFER — never a sentence.',
      'headline is a short product or collection name, 2-5 words max ("New Collections", "AI Video Studio"). Never a long sentence.',
      'statValue is the exact offer number from the brief ("25%", "₹999"). If the brief has no number, this template must not be used — say so instead of inventing one.',
      'statLabel is empty or a short bonus line ("Sale Bonus") — never repeat OFF.',
      'subhead is one short supporting sentence (max ~18 words) about what the offer applies to.',
      'closingLine is a short CTA of 1-3 words ("Shop Now", "Get Offer"). Never a full sentence.',
      'footerNote is the website or handle, no invented URL.',
      'No invented urgency, no fake original prices.',
    ],
    artDirection:
      'Retail fashion or product photography of people or items, bright even light, uncluttered background, no lettering, no logos, no price tags. Faces and products must crop cleanly inside a circle.',
    accentRole: 'stat',
  },
  {
    id: 'offer_sale_split',
    playId: 'offer',
    label: 'Split offer',
    tagline: 'Exact Magnific layout — type left, shopper photo right, framed in Brand Kit accent',
    layout: 'sale_split',
    blocks: blocks({
      eyebrow: 'optional',
      stat: 'required',
      callout: 'optional',
      closing: 'required',
      footer: 'required',
    }),
    headlineWords: [3, 8],
    copyRules: [
      'headline is the offer name with the deal word inside it ("Big Sale Offer"). headlineAccent is that deal word (Sale / Deal / Off).',
      'eyebrow is the brand tagline if the brief has one, else empty.',
      'statValue is the exact offer number from the brief ("75%"). If the brief has no number, this template must not be used.',
      'closingLine is the CTA ("Order Now").',
      'calloutBody is a real phone number only if the brief supplied one, else empty.',
      'footerNote is the website or handle from the brief or Brand Kit, never invented.',
      'Never state a discount percentage that is not in the brief.',
    ],
    artDirection:
      'Lifestyle shopper or product in a real store or studio, vertical crop, subject on the right third, soft retail lighting, no lettering, no logos, no price tags.',
    accentRole: 'headline',
  },
];

function sortByPlay(list: PosterTemplate[]): PosterTemplate[] {
  const order = CONTENT_PLAYBOOK.map((p) => p.id);
  return list
    .map((t, i) => ({ t, i }))
    .sort((x, y) => {
      const a = order.indexOf(x.t.playId);
      const b = order.indexOf(y.t.playId);
      return (a < 0 ? 99 : a) - (b < 0 ? 99 : b) || x.i - y.i;
    })
    .map(({ t }) => t);
}

/** Three Canva-style layouts per playbook format (retail offers first, then drawn designs). */
export const POSTER_TEMPLATES: PosterTemplate[] = sortByPlay([...RETAIL_TEMPLATES, ...DESIGNED_TEMPLATES]);
export function templatesForPlay(playId?: string | null): PosterTemplate[] {
  if (!playId) return [];
  return POSTER_TEMPLATES.filter((t) => t.playId === playId);
}

export function getPosterTemplate(id?: string | null): PosterTemplate | undefined {
  if (!id) return undefined;
  return POSTER_TEMPLATES.find((t) => t.id === id);
}

/** Every playbook format must ship with exactly three layouts. */
export function assertThreeTemplatesPerPlay(): string[] {
  const missing: string[] = [];
  for (const play of CONTENT_PLAYBOOK) {
    const n = templatesForPlay(play.id).length;
    if (n !== 3) missing.push(`${play.id} has ${n} templates, expected 3`);
  }
  const unknown = [...new Set(POSTER_TEMPLATES.map((t) => t.playId))].filter(
    (id) => !CONTENT_PLAYBOOK.some((p) => p.id === id),
  );
  for (const id of unknown) missing.push(`${id} is in the catalog but not in the playbook`);
  return missing;
}

/** All templates grouped by play — powers the AI Assistant template picker. */
export function posterTemplatesByPlay(): Array<{ playId: string; templates: PosterTemplate[] }> {
  const order: string[] = [];
  for (const t of POSTER_TEMPLATES) if (!order.includes(t.playId)) order.push(t.playId);
  return order.map((playId) => ({ playId, templates: templatesForPlay(playId) }));
}

function ruleLine(name: string, rule: PosterBlockRule, spec: string): string {
  if (rule === 'omit') return `- "${name}": MUST be an empty string. This layout does not render it.`;
  if (rule === 'required') return `- "${name}": REQUIRED. ${spec}`;
  return `- "${name}": optional — only if the brief genuinely supports it, else empty string. ${spec}`;
}

/**
 * The template contract as prompt text. Paired with `applyTemplateContract`,
 * which enforces the same rules on the result whether or not the model complied.
 */
export function templateContractPrompt(t: PosterTemplate): string {
  const b = t.blocks;
  const lines = [
    `TEMPLATE LOCK — "${t.label}" (${t.id}). The user picked this template. Follow it exactly; do not redesign it.`,
    `Layout: ${t.layout}. ${t.tagline}.`,
    '',
    'BLOCK CONTRACT — every key below must appear in your JSON with exactly this treatment:',
    ruleLine('eyebrow', b.eyebrow, '2-4 words, no punctuation.'),
    `- "headline": REQUIRED, ${t.headlineWords[0]}-${t.headlineWords[1]} words.`,
    '- "headlineAccent": REQUIRED, an exact substring of headline (2-4 words or a number) to paint in the brand accent colour.',
    ruleLine('subhead', b.subhead, 'One sentence, max 22 words.'),
    b.pillars === 0
      ? '- "pillars": MUST be an empty array. This layout renders no pillars.'
      : `- "pillars": REQUIRED, exactly ${b.pillars} items, each { icon, title (2-4 words), text (12-24 words of new substance) }. No pillar may restate the headline.`,
    ruleLine('statValue', b.stat, 'Short metric only: "62%", "#2", "3 DAYS", "₹999".'),
    ruleLine('statLabel', b.stat, '4-8 words explaining the metric.'),
    ruleLine('calloutTitle', b.callout, '3-6 words.'),
    ruleLine('calloutBody', b.callout, 'One sentence, max 22 words.'),
    ruleLine('closingLine', b.closing, 'Punchy 3-12 word takeaway or CTA.'),
    ruleLine('footerNote', b.footer, 'One sober line, max 20 words.'),
    '',
    'TEMPLATE COPY RULES:',
    ...t.copyRules.map((r) => `- ${r}`),
    '',
    `TEMPLATE ART DIRECTION (fold into artPrompt): ${t.artDirection}`,
  ];
  return lines.filter((l) => l !== undefined).join('\n');
}

/** Short version for the caption/intent pass, which does not write the poster. */
export function templateCaptionHint(t: PosterTemplate): string {
  return [
    `The visual will be rendered with the "${t.label}" template (${t.tagline}).`,
    t.blocks.pillars
      ? `It shows ${t.blocks.pillars} short supporting points, so the caption should not repeat them verbatim.`
      : 'It carries very little on-image copy, so the caption must carry the message.',
    t.blocks.stat === 'required'
      ? 'It requires a real number from the brief — if the user gave none, ask instead of generating.'
      : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function clamp(value: string | undefined, rule: PosterBlockRule): string {
  if (rule === 'omit') return '';
  return (value || '').trim();
}

function clampWordCount(text: string, max: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= max) return words.join(' ');
  return words.slice(0, max).join(' ');
}

const PAD_ICONS = ['bolt', 'shield', 'spark'] as const;

/** Keep the layout geometry even if the model returned too few pillars. */
function enforcePillars(
  pillars: PosterPillar[] | undefined,
  count: 0 | 2 | 3,
  spec: PosterSpec,
): PosterPillar[] {
  if (count === 0) return [];
  const kept = (pillars || [])
    .filter((p) => (p.title || '').trim() || (p.text || '').trim())
    .slice(0, count);
  if (kept.length >= count) return kept;

  const seeds = [spec.subhead, spec.calloutBody, spec.calloutTitle, spec.closingLine, spec.headline]
    .map((s) => (s || '').trim())
    .filter(Boolean);
  const used = new Set(kept.map((p) => p.title.trim().toLowerCase()));

  while (kept.length < count) {
    const i = kept.length;
    const source = seeds.find((s) => !used.has(s.split(/\s+/).slice(0, 3).join(' ').toLowerCase())) || seeds[0] || spec.headline;
    const words = source.split(/\s+/).filter(Boolean);
    const title = words.slice(0, 3).join(' ') || `Point ${i + 1}`;
    used.add(title.toLowerCase());
    kept.push({
      icon: PAD_ICONS[i] || 'spark',
      title,
      text: words.length > 3 ? words.slice(3, 22).join(' ') : source,
    });
  }
  return kept;
}

/**
 * Hard enforcement: strip blocks the template does not render and force the
 * exact pillar count, so a chosen template always renders as designed even when
 * the model returns extra or missing fields.
 */
export function applyTemplateContract(spec: PosterSpec, t: PosterTemplate): PosterSpec {
  const b = t.blocks;
  const headline = clampWordCount(spec.headline || '', t.headlineWords[1]);
  const accent = (spec.headlineAccent || '').trim();
  const statValue = clamp(spec.statValue, b.stat);

  return {
    ...spec,
    headline,
    headlineAccent:
      accent && headline.toLowerCase().includes(accent.toLowerCase()) ? accent : spec.headlineAccent,
    eyebrow: clamp(spec.eyebrow, b.eyebrow),
    subhead: clamp(spec.subhead, b.subhead),
    pillars: enforcePillars(spec.pillars, b.pillars, spec),
    statValue,
    // A stat label without a value renders as an orphan line.
    statLabel: statValue ? clamp(spec.statLabel, b.stat) : '',
    calloutTitle: clamp(spec.calloutTitle, b.callout),
    calloutBody: clamp(spec.calloutBody, b.callout),
    closingLine: clamp(spec.closingLine, b.closing),
    footerNote: clamp(spec.footerNote, b.footer),
  };
}

/** True when the template needs a hard number the brief did not supply. */
export function templateNeedsStat(t: PosterTemplate): boolean {
  return t.blocks.stat === 'required';
}
