/**
 * Canva-style designed templates for AI Assistant → "Pick an image format".
 *
 * Each entry pairs a drawn layout (providers/images/poster-designs.ts) with the copy contract the AI
 * must honour. The contract mirrors what the layout actually renders, so a template never receives
 * copy it has no slot for, and never lacks copy it needs.
 *
 * Research notes behind the designs (what real templates in each category do):
 *  - Countdown: one giant number or date is the hero; supporting text stays minimal.
 *  - Launch: one claim, a clear product moment, three scannable benefits or a single CTA.
 *  - Update / changelog: dated release label, 3 itemised changes, "what changed → what it unlocks".
 *  - Announcement: plain who/what headline, banner or ceremonial treatment, one next step.
 *  - Aesthetic: the photograph leads; tiny, airy type; polaroid / arch frames.
 *  - Meme: caption bars, top/bottom lettering, or a two-panel contrast.
 *  - Offer: oversized figure in a badge, short offer line, button-style CTA.
 *  - Insight: one short idea per card; quote card with attribution; numbered reasons.
 *  - Report: one headline statistic with context, then three findings.
 *  - Greeting: framed or ornamental layouts, warm serif/script type, generous space.
 *  - Carousel: a promise headline with a number, then swipe cues.
 */
import type { PosterLayoutId, PosterSpec } from '../providers/images/poster-frame';
import type { PosterBlockRule, PosterTemplate, PosterTemplateBlocks } from './poster-template-catalog';
import { designLayoutId } from '../providers/images/poster-designs';

const EMPTY: PosterTemplateBlocks = {
  eyebrow: 'omit',
  subhead: 'omit',
  pillars: 0,
  stat: 'omit',
  callout: 'omit',
  closing: 'omit',
  footer: 'omit',
};

type Def = {
  id: string;
  playId: string;
  label: string;
  tagline: string;
  blocks: Partial<PosterTemplateBlocks>;
  headlineWords: [number, number];
  copyRules: string[];
  artDirection: string;
  accentRole: PosterTemplate['accentRole'];
  sample: Partial<PosterSpec>;
};

function make(d: Def): PosterTemplate {
  return {
    id: d.id,
    playId: d.playId,
    label: d.label,
    tagline: d.tagline,
    layout: designLayoutId(d.id) as PosterLayoutId,
    blocks: { ...EMPTY, ...d.blocks },
    headlineWords: d.headlineWords,
    copyRules: d.copyRules,
    artDirection: d.artDirection,
    accentRole: d.accentRole,
    sample: d.sample,
    origin: 'builtin',
  };
}

const R = (v: PosterBlockRule) => v;

export const DESIGNED_TEMPLATES: PosterTemplate[] = [
  // ─────────────────────────────────────────────────────────────── countdown
  make({
    id: 'countdown_ticker',
    playId: 'countdown',
    label: 'Ticker',
    tagline: 'Clock-face ring around a giant day count, full-bleed photo',
    blocks: { stat: R('required'), closing: R('required') },
    headlineWords: [3, 8],
    copyRules: [
      'statValue is the countdown itself: "3 DAYS", "48 HRS", "T-5". Max 8 characters. Use only a date or number from the brief — never invent one.',
      'statLabel names what is being counted down to, max 4 words ("until launch").',
      'headline is the event or product name in plain words, 3-8 words.',
      'closingLine is a soft CTA of 2-4 words ("Save your seat"). No fake scarcity.',
    ],
    artDirection:
      'One dramatic, uncluttered scene with a dark calm centre so the clock ring and numerals stay readable: venue, stage, product in silhouette or skyline at dusk. Single light source, deep negative space, no text.',
    accentRole: 'stat',
    sample: { headline: 'Product launch goes live', headlineAccent: 'goes live', statValue: '3 DAYS', statLabel: 'until launch', closingLine: 'Save your seat' },
  }),
  make({
    id: 'countdown_datecard',
    playId: 'countdown',
    label: 'Date card',
    tagline: 'Photo card above a tear-off calendar block with the date',
    blocks: { eyebrow: R('required'), subhead: R('required'), stat: R('required'), closing: R('optional') },
    headlineWords: [4, 9],
    copyRules: [
      'statValue is the exact date or day count from the brief, written very short ("12 MAR", "T-5"). Max 7 characters.',
      'statLabel is the weekday or time ("THURSDAY", "10 AM IST"), max 3 words.',
      'eyebrow names the event type in caps, 1-3 words ("LIVE WEBINAR").',
      'subhead says what happens on that date in one concrete sentence.',
      'Do not promise features or pricing the brief did not state.',
    ],
    artDirection:
      'Editorial event or product photography that reads well as a wide rounded card: clean horizon, subject slightly off-centre, natural light, no signage or text.',
    accentRole: 'band',
    sample: { eyebrow: 'Live webinar', headline: 'Build faster with our new platform', headlineAccent: 'new platform', subhead: 'A 30-minute walkthrough with the team and live Q&A.', statValue: '12 MAR', statLabel: 'Thursday · 10 AM', closingLine: 'Register free' },
  }),
  make({
    id: 'countdown_agenda',
    playId: 'countdown',
    label: 'Agenda',
    tagline: 'Date tag, round photo and a three-step "what is coming" timeline',
    blocks: { eyebrow: R('required'), subhead: R('required'), pillars: 3, closing: R('optional') },
    headlineWords: [4, 10],
    copyRules: [
      'eyebrow carries the date or day count ("12 MARCH", "5 DAYS TO GO").',
      'The three pillars are what the audience gets on the day, in order — one concrete item each, never restating the headline.',
      'Every pillar must come from the brief. If it supports only two real items, narrow the third from the same facts instead of inventing.',
      'closingLine is the next step, 2-4 words ("Reserve a spot").',
    ],
    artDirection:
      'Square-friendly hero image that crops cleanly into a circle: a single subject or object in warm light, simple background, no text.',
    accentRole: 'rule',
    sample: {
      eyebrow: '12 March', headline: 'Everything arrives this Thursday', headlineAccent: 'this Thursday', subhead: 'Three things to look forward to.', closingLine: 'Reserve a spot',
      pillars: [
        { icon: 'rocket', title: 'Live demo', text: 'See the release running on real data.' },
        { icon: 'users', title: 'Team Q&A', text: 'Ask the builders anything, live.' },
        { icon: 'bolt', title: 'Early access', text: 'Attendees get first access on the day.' },
      ],
    },
  }),

  // ─────────────────────────────────────────────────────────────── launch
  make({
    id: 'launch_feature_hero',
    playId: 'launch',
    label: 'Feature hero',
    tagline: 'Framed hero photo with a NEW burst and three feature cards',
    blocks: { eyebrow: R('required'), subhead: R('required'), pillars: 3 },
    headlineWords: [4, 10],
    copyRules: [
      'eyebrow is the product or release name, 1-3 words.',
      'Each pillar is one real capability that shipped, written as a benefit: title 2-3 words, text under 16 words.',
      'Never invent features, integrations or availability dates that are not in the brief.',
    ],
    artDirection:
      'Hero product or interface moment photographed in context, lit like a launch film still, tall-ish crop with the subject centred. No readable UI text, no device mockup frames (the layout draws the frame).',
    accentRole: 'headline',
    sample: {
      eyebrow: 'Meet Pulse', headline: 'Real-time insight, built in', headlineAccent: 'built in', subhead: 'See what changed across every site the moment it happens.',
      pillars: [
        { icon: 'bolt', title: 'Instant alerts', text: 'Know within seconds when a reading drifts.' },
        { icon: 'chart', title: 'Clear trends', text: 'One view of every device, every day.' },
        { icon: 'shield', title: 'Secure by default', text: 'Encrypted from sensor to dashboard.' },
      ],
    },
  }),
  make({
    id: 'launch_spotlight',
    playId: 'launch',
    label: 'Spotlight',
    tagline: 'One centred claim under a spotlight cone, with a CTA button',
    blocks: { eyebrow: R('required'), subhead: R('required'), closing: R('required') },
    headlineWords: [3, 9],
    copyRules: [
      'One claim only. If the brief lists several features, pick the strongest and drop the rest.',
      'eyebrow is a short tag such as "NEW", "NOW LIVE", or the product name, 1-3 words.',
      'subhead is a single supporting sentence, max 18 words.',
      'closingLine is the CTA button text, 2-4 words.',
    ],
    artDirection:
      'Single hero subject, centred composition, dramatic rim lighting against a deep background. Nothing in the middle third that competes with centred type.',
    accentRole: 'headline',
    sample: { eyebrow: 'Now live', headline: 'Meet the faster way to ship', headlineAccent: 'faster way', subhead: 'Everything your team needs, in one place.', closingLine: 'Try it today' },
  }),
  make({
    id: 'launch_dossier',
    playId: 'launch',
    label: 'Dossier',
    tagline: 'Magazine spread: arch photo, big headline, why-it-matters card',
    blocks: { eyebrow: R('required'), subhead: R('required'), stat: R('optional'), callout: R('required') },
    headlineWords: [4, 11],
    copyRules: [
      'calloutTitle (3-6 words) + calloutBody (one sentence, max 20 words) carry the "why it matters" argument, not a feature list.',
      'Only fill statValue when the brief contains a real number. Leave it empty otherwise — never invent a metric.',
      'eyebrow is the release or category name.',
    ],
    artDirection:
      'Tall editorial photograph of the product in real use, natural light, documentary feel. Subject fills a tall arch-shaped window, vertical crop.',
    accentRole: 'rule',
    sample: { eyebrow: 'Release 3.0', headline: 'A calmer way to run operations', headlineAccent: 'calmer way', subhead: 'We rebuilt the workflow around how teams actually work.', statValue: '2x', statLabel: 'faster setup', calloutTitle: 'Why it matters', calloutBody: 'Less time configuring, more time acting on what the data shows.' },
  }),

  // ─────────────────────────────────────────────────────────────── update
  make({
    id: 'update_changelog',
    playId: 'update',
    label: 'Changelog',
    tagline: 'Release tag, headline and three shipped changes as a clean list',
    blocks: { eyebrow: R('required'), subhead: R('optional'), pillars: 3, footer: R('optional') },
    headlineWords: [3, 9],
    copyRules: [
      'Exactly three pillars, each a real change from the brief, phrased as "what changed → what it unlocks". title 2-4 words, text under 16 words.',
      'eyebrow is the release label ("RELEASE 2.4", "MARCH UPDATE").',
      'footerNote may point to the docs or changelog only if the brief mentions one.',
      'Never pad with invented changes.',
    ],
    artDirection:
      'Abstract but believable scene suggesting progress or craft — workshop detail, layered materials, studio light. Square crop that works as a rounded thumbnail, no text.',
    accentRole: 'rule',
    sample: {
      eyebrow: 'Release 2.4', headline: "What's new this month", headlineAccent: 'new', subhead: 'Three updates our users asked for.', footerNote: 'Full changelog on our website',
      pillars: [
        { icon: 'bolt', title: 'Faster sync', text: 'Dashboards now refresh in under two seconds.' },
        { icon: 'lock', title: 'Role controls', text: 'Give each teammate exactly the access they need.' },
        { icon: 'chart', title: 'Export to CSV', text: 'Take any report into your own tools.' },
      ],
    },
  }),
  make({
    id: 'update_ledger',
    playId: 'update',
    label: 'Ledger',
    tagline: 'Terminal-style change ledger beside a tall photo column',
    blocks: { eyebrow: R('required'), pillars: 3, footer: R('optional') },
    headlineWords: [3, 8],
    copyRules: [
      'Three pillars, terse and technical. title = the area changed (1-3 words), text = the concrete change (under 14 words).',
      'eyebrow is the version or release name, 1-3 words (rendered as a command line).',
      'footerNote can point to docs only if the brief mentions them.',
    ],
    artDirection:
      'Quiet macro detail — machined surface, layered paper, structured grid of real objects. Tall vertical crop, calm tones, no text.',
    accentRole: 'rule',
    sample: {
      eyebrow: 'v2.4.0', headline: 'Shipped this sprint', headlineAccent: 'Shipped',
      pillars: [
        { icon: 'bolt', title: 'Added: webhooks', text: 'Push events to any endpoint you control.' },
        { icon: 'layers', title: 'Improved: search', text: 'Results appear as you type, across all projects.' },
        { icon: 'shield', title: 'Fixed: sessions', text: 'Sign-ins now persist across devices.' },
      ],
    },
  }),
  make({
    id: 'update_headline',
    playId: 'update',
    label: 'Headline card',
    tagline: "WHAT'S NEW ribbon, offset photo card and one big statement",
    blocks: { eyebrow: R('required'), subhead: R('required'), closing: R('optional') },
    headlineWords: [4, 11],
    copyRules: [
      'Use this for ONE change only. Name it in the headline and explain the impact in the subhead.',
      'eyebrow is the ribbon label, 1-3 words ("NEW", "JUST SHIPPED").',
      'closingLine is 2-4 words and reads as a link ("Read the notes").',
      'No bullet lists, no feature roll-ups.',
    ],
    artDirection:
      'Clean product-in-context photo, portrait-leaning crop with the subject in the middle, soft natural light, uncluttered background, no text.',
    accentRole: 'band',
    sample: { eyebrow: 'Just shipped', headline: 'Dashboards that update live', headlineAccent: 'update live', subhead: 'No more refreshing — numbers move the moment your data does.', closingLine: 'Read the notes' },
  }),

  // ─────────────────────────────────────────────────────────────── announcement
  make({
    id: 'announce_banner',
    playId: 'announcement',
    label: 'Banner',
    tagline: 'Accent news band, wide photo and an overlapping statement card',
    blocks: { eyebrow: R('required'), subhead: R('required'), closing: R('required') },
    headlineWords: [5, 12],
    copyRules: [
      'Headline states the news plainly — who, what. No teasing.',
      'eyebrow is the news type in 1-3 words ("PARTNERSHIP", "WE ARE HIRING").',
      'subhead gives the one reason it matters to the reader (max 18 words).',
      'closingLine is the next step, 2-4 words ("Read more", "Apply now").',
    ],
    artDirection:
      'Confident corporate-editorial scene: real people or a real place, natural light, documentary framing. Wide landscape crop, strong composition, no signage or logos.',
    accentRole: 'band',
    sample: { eyebrow: 'Partnership', headline: 'We are joining forces with Atlas Labs', headlineAccent: 'Atlas Labs', subhead: 'Together we will bring smarter monitoring to more teams.', closingLine: 'Read more' },
  }),
  make({
    id: 'announce_stage',
    playId: 'announcement',
    label: 'Stage',
    tagline: 'Full-bleed photo, double frame and a ceremonial centred headline',
    blocks: { eyebrow: R('required'), subhead: R('required'), closing: R('optional') },
    headlineWords: [3, 9],
    copyRules: [
      'Short and ceremonial. The headline is the announcement itself.',
      'eyebrow is 1-3 words in caps ("PLEASED TO ANNOUNCE").',
      'closingLine, if used, is a date or place, max 4 words.',
      'Never dramatise beyond the facts in the brief.',
    ],
    artDirection:
      'Cinematic wide scene with a calm centre — venue interior, skyline, or open workspace. Deep background, one light direction, no text.',
    accentRole: 'headline',
    sample: { eyebrow: 'Pleased to announce', headline: 'Our new headquarters opens', headlineAccent: 'new headquarters', subhead: 'A home for the team, our customers and what comes next.', closingLine: 'Bengaluru · April' },
  }),
  make({
    id: 'announce_brief',
    playId: 'announcement',
    label: 'Brief',
    tagline: 'NEWS tag, statement beside a round photo, context quote strip',
    blocks: { eyebrow: R('required'), subhead: R('required'), callout: R('required'), footer: R('optional') },
    headlineWords: [5, 12],
    copyRules: [
      'eyebrow is the tag, 1-2 words ("NEWS", "MILESTONE").',
      'calloutTitle (3-6 words) + calloutBody (one sentence) give the background or quote-style context for the news.',
      'footerNote can hold the date or a source line only if the brief supplies one.',
    ],
    artDirection:
      'Editorial photograph of the subject of the news — place, team, or object — warm natural light, subject centred so it crops cleanly into a circle, no text.',
    accentRole: 'headline',
    sample: { eyebrow: 'Milestone', headline: 'One thousand teams now rely on us', headlineAccent: 'One thousand teams', subhead: 'Thank you to every customer who helped us get here.', calloutTitle: 'What comes next', calloutBody: 'More integrations and faster insight for every team.', footerNote: 'Company news · March' },
  }),

  // ─────────────────────────────────────────────────────────────── aesthetic
  make({
    id: 'aesthetic_whisper',
    playId: 'aesthetic',
    label: 'Whisper',
    tagline: 'Almost no type — a few airy words over the photograph',
    blocks: { closing: R('optional') },
    headlineWords: [2, 6],
    copyRules: [
      'Headline is 2-6 words of mood, not a sales line.',
      'Write no subhead, no stat, no pillars — the caption carries the message.',
      'closingLine, if used, is a single quiet phrase of 2-4 words, lowercase.',
    ],
    artDirection:
      'Magazine-quality lifestyle photograph: soft directional daylight, film grain, muted palette, generous empty space in the lower third. The image is the post.',
    accentRole: 'headline',
    sample: { headline: 'slow mornings, better days', closingLine: 'made with care' },
  }),
  make({
    id: 'aesthetic_frame',
    playId: 'aesthetic',
    label: 'Polaroid',
    tagline: 'Taped polaroid on a soft ground with a handwritten caption',
    blocks: { subhead: R('optional'), closing: R('optional') },
    headlineWords: [2, 6],
    copyRules: [
      'headline is a short handwritten-style caption, 2-6 words.',
      'subhead, if used, is one gentle sentence (max 14 words) of mood.',
      'closingLine, if used, is 1-3 words.',
    ],
    artDirection:
      'Candid lifestyle photograph with a slightly nostalgic film feel: natural light, soft colour, a single subject, square crop, no text.',
    accentRole: 'headline',
    sample: { headline: 'golden hour, always', subhead: 'Small moments worth keeping.', closingLine: 'xo' },
  }),
  make({
    id: 'aesthetic_band',
    playId: 'aesthetic',
    label: 'Arch',
    tagline: 'Arch window photo, wide-spaced label and a soft sun',
    blocks: { eyebrow: R('optional'), subhead: R('optional'), closing: R('optional') },
    headlineWords: [3, 8],
    copyRules: [
      'headline is a calm, lowercase-friendly line of 3-8 words.',
      'eyebrow, if used, is a 1-3 word label.',
      'subhead, if used, is one short sentence (max 16 words).',
      'closingLine, if used, is 2-4 words in a soft voice.',
    ],
    artDirection:
      'Tall vertical lifestyle or interior photograph with a calm palette, plants or soft textiles, window light. Subject in the centre, no text.',
    accentRole: 'rule',
    sample: { eyebrow: 'Slow living', headline: 'Make room for what feels good', headlineAccent: 'feels good', subhead: 'A quieter way to start the week.', closingLine: 'be kind to yourself' },
  }),

  // ─────────────────────────────────────────────────────────────── meme
  make({
    id: 'meme_setup_punch',
    playId: 'meme',
    label: 'Setup / punch',
    tagline: 'Caption bar above, photo, punchline bar below',
    blocks: { subhead: R('required') },
    headlineWords: [4, 14],
    copyRules: [
      'headline is the SETUP (relatable situation, max 14 words).',
      'subhead is the PUNCHLINE (max 14 words) — it must land on its own after reading the setup.',
      'Brand-safe humour only: no politics, no mocking customers or people. Never invent facts or stats.',
    ],
    artDirection:
      'Expressive reaction-style photograph that fits the joke: a person or object with a clear emotion or situation, wide landscape crop, plain background, no text.',
    accentRole: 'band',
    sample: { headline: 'Me explaining the update to my team', subhead: 'They: "wait, it works now?"' },
  }),
  make({
    id: 'meme_caption_band',
    playId: 'meme',
    label: 'Classic caption',
    tagline: 'Bold top and bottom lettering over a full-bleed photo',
    blocks: { subhead: R('required') },
    headlineWords: [2, 8],
    copyRules: [
      'headline is the TOP line, max 8 words, written to be read in capitals.',
      'subhead is the BOTTOM line, max 8 words. Together they form one joke.',
      'Brand-safe humour only. Never invent facts or stats.',
    ],
    artDirection:
      'Full-frame photograph with a clear subject in the middle third and calm areas at the top and bottom edges for lettering, no text.',
    accentRole: 'headline',
    sample: { headline: 'when the deploy goes smoothly', subhead: 'and nothing is on fire' },
  }),
  make({
    id: 'meme_split_takes',
    playId: 'meme',
    label: 'Two takes',
    tagline: 'Rejected vs preferred take, each beside its own photo crop',
    blocks: { pillars: 2 },
    headlineWords: [3, 9],
    copyRules: [
      'headline is a short setup that frames the contrast ("How we handle Mondays").',
      'Exactly two pillars: the FIRST is the rejected / old take, the SECOND the preferred / new take.',
      'Each pillar title is a 1-2 word label ("BEFORE", "AFTER"), text is the take in under 14 words. Make the contrast obvious and brand-safe.',
    ],
    artDirection:
      'Wide photograph with an obvious subject on the left and another idea on the right, so both crops read. Expressive, plain background, no text.',
    accentRole: 'band',
    sample: {
      headline: 'How we handle Mondays', headlineAccent: 'Mondays',
      pillars: [
        { icon: 'clock', title: 'Before', text: 'Chasing updates across five tools and three chats.' },
        { icon: 'check', title: 'After', text: 'One dashboard, one source of truth, zero chasing.' },
      ],
    },
  }),

  // ─────────────────────────────────────────────────────────────── offer
  make({
    id: 'offer_stage',
    playId: 'offer',
    label: 'Badge burst',
    tagline: 'Sticker burst with the deal, tilted product photo, button CTA',
    blocks: { stat: R('required'), closing: R('required'), footer: R('optional') },
    headlineWords: [2, 6],
    copyRules: [
      'statValue is the exact offer figure from the brief ("25%", "₹999"). Max 6 characters. If the brief has none, say so instead of inventing one.',
      'statLabel is "OFF", "FLAT", or a 2-word qualifier. Never repeat the number.',
      'headline is what the offer applies to, 2-6 words ("Annual plans").',
      'closingLine is the CTA button text, 2-3 words ("Shop now", "Claim offer").',
      'footerNote holds terms or the code only if the brief gave them. No invented urgency or fake original prices.',
    ],
    artDirection:
      'A single hero product or lifestyle subject against a clean, bright background, centred, studio lighting, crisp edges, no text or price tags.',
    accentRole: 'stat',
    sample: { headline: 'Annual plans', headlineAccent: 'plans', statValue: '25%', statLabel: 'OFF', closingLine: 'Claim offer', footerNote: 'Use code SAVE25 · ends Friday' },
  }),

  // ─────────────────────────────────────────────────────────────── insight (thought_leadership)
  make({
    id: 'insight_quote',
    playId: 'thought_leadership',
    label: 'Quote',
    tagline: 'Giant quote mark, serif statement and attribution with avatar',
    blocks: { eyebrow: R('required'), subhead: R('optional') },
    headlineWords: [8, 22],
    copyRules: [
      'headline is ONE strong sentence (the quote or insight), 8-22 words, specific and quotable — no filler.',
      'eyebrow is who is speaking: a name or role from the brief or brand, 2-4 words.',
      'subhead, if used, is their title or company, max 8 words.',
      'Do not invent a quote attributed to a real person who is not named in the brief.',
    ],
    artDirection:
      'A portrait-style or detail photograph that crops into a small circle (person at work, hands, workspace), soft light, no text.',
    accentRole: 'headline',
    sample: { eyebrow: 'Priya Nair', headline: 'Great data is only useful once someone trusts it enough to act on it.', headlineAccent: 'trusts it', subhead: 'Head of Operations' },
  }),
  make({
    id: 'insight_three_reasons',
    playId: 'thought_leadership',
    label: 'Three reasons',
    tagline: 'Big 01 · 02 · 03 numerals, one reason each, round photo',
    blocks: { eyebrow: R('optional'), pillars: 3, closing: R('optional') },
    headlineWords: [5, 11],
    copyRules: [
      'headline frames the question or claim ("Why most dashboards fail").',
      'Exactly three pillars, one reason each: title 2-4 words, text under 18 words of new substance. None may restate the headline.',
      'closingLine, if used, is a one-line takeaway of 3-8 words.',
    ],
    artDirection:
      'A calm, symbolic photograph that crops into a circle: a single object or scene that hints at the topic, soft light, no text.',
    accentRole: 'rule',
    sample: {
      eyebrow: 'Insight', headline: 'Why most dashboards go unused', headlineAccent: 'go unused', closingLine: 'Fix the habit first.',
      pillars: [
        { icon: 'search', title: 'Too many numbers', text: 'People cannot tell which metric to act on.' },
        { icon: 'clock', title: 'Arrives too late', text: 'By the time it updates, the decision has been made.' },
        { icon: 'users', title: 'No owner', text: 'Nobody is responsible for what the data says.' },
      ],
    },
  }),
  make({
    id: 'insight_column',
    playId: 'thought_leadership',
    label: 'Column',
    tagline: 'Essay column with a pull-quote beside a framed tall photo',
    blocks: { eyebrow: R('required'), subhead: R('required'), callout: R('required') },
    headlineWords: [5, 12],
    copyRules: [
      'eyebrow is the theme in 1-3 words.',
      'subhead sets up the argument in one or two short sentences (max 26 words).',
      'calloutTitle is a 3-6 word pull-quote lead; calloutBody finishes the thought in one sentence (max 22 words).',
    ],
    artDirection:
      'Tall editorial photograph (portrait crop) of a real working scene or detail, natural light, calm negative space, no text.',
    accentRole: 'rule',
    sample: { eyebrow: 'Perspective', headline: 'Trust is built in the small details', headlineAccent: 'small details', subhead: 'The teams that win are rarely the loudest. They are the most consistent.', calloutTitle: 'Consistency compounds', calloutBody: 'Every reliable day adds to the confidence customers place in you.' },
  }),

  // ─────────────────────────────────────────────────────────────── report (insight_report)
  make({
    id: 'report_dossier',
    playId: 'insight_report',
    label: 'Dossier',
    tagline: 'Giant headline statistic with a photo, then three findings',
    blocks: { eyebrow: R('required'), stat: R('required'), pillars: 3, footer: R('optional') },
    headlineWords: [4, 11],
    copyRules: [
      'statValue is ONE real number or ranking from the brief ("62%", "#2", "$4.2B"). Max 6 characters. If the brief has none, say so — never invent a statistic.',
      'statLabel explains the stat in under 10 words.',
      'eyebrow is the report type or year ("INDUSTRY REPORT 2026"), 2-4 words.',
      'Three pillars are findings drawn only from the brief: title 2-3 words, text under 16 words.',
      'footerNote is the source of the data if the brief names one — never invent a source.',
    ],
    artDirection:
      'Editorial photograph related to the report subject (city, workplace, industry scene), landscape-leaning crop, calm tones, no charts, no text.',
    accentRole: 'stat',
    sample: {
      eyebrow: 'Industry report 2026', headline: 'Adoption is accelerating across the region', headlineAccent: 'accelerating', statValue: '62%', statLabel: 'of teams plan to expand this year', footerNote: 'Source: annual industry survey',
      pillars: [
        { icon: 'chart', title: 'Spending up', text: 'Budgets grew in most surveyed sectors.' },
        { icon: 'users', title: 'Talent gap', text: 'Hiring remains the biggest constraint.' },
        { icon: 'globe', title: 'New markets', text: 'Cross-border demand is rising.' },
      ],
    },
  }),
  make({
    id: 'report_topline',
    playId: 'insight_report',
    label: 'Topline',
    tagline: 'Accent headline band over a photo, stat and ranked findings',
    blocks: { eyebrow: R('required'), stat: R('required'), pillars: 3, footer: R('optional') },
    headlineWords: [4, 10],
    copyRules: [
      'statValue is ONE real number from the brief, max 6 characters; statLabel explains it in under 10 words.',
      'headline states the main finding in plain words.',
      'Three pillars are supporting findings from the brief: title 2-3 words, text under 14 words.',
      'footerNote is the data source only if the brief names one.',
    ],
    artDirection:
      'Photograph of the report subject with a quiet right-hand side (it fades into a colour band), moody editorial light, no text, no charts.',
    accentRole: 'band',
    sample: {
      eyebrow: 'Market pulse', headline: 'Demand for smart infrastructure keeps climbing', headlineAccent: 'keeps climbing', statValue: '#2', statLabel: 'ranked globally for adoption',
      pillars: [
        { icon: 'check', title: 'Public sector leads', text: 'Cities are the earliest adopters.' },
        { icon: 'check', title: 'Utilities follow', text: 'Metering projects are scaling fast.' },
        { icon: 'check', title: 'Costs falling', text: 'Sensors are cheaper than a year ago.' },
      ],
    },
  }),
  make({
    id: 'report_column',
    playId: 'insight_report',
    label: 'Stat column',
    tagline: 'Accent column owns the number; findings read down the right',
    blocks: { eyebrow: R('required'), subhead: R('required'), stat: R('required'), pillars: 3, footer: R('optional') },
    headlineWords: [4, 10],
    copyRules: [
      'statValue is ONE real number from the brief, max 5 characters; statLabel explains it in under 9 words.',
      'subhead adds context in one sentence (max 20 words).',
      'Three pillars are findings: title 2-3 words, text under 14 words. Use brief facts only.',
      'footerNote is the source only if the brief names one.',
    ],
    artDirection:
      'A square-crop photograph that works inside a small circle: a single clear subject (person, building or object), simple background, no text.',
    accentRole: 'stat',
    sample: {
      eyebrow: 'Key finding', headline: 'Reliable data is the new advantage', headlineAccent: 'new advantage', subhead: 'Teams with trusted data decide faster.', statValue: '3x', statLabel: 'faster decisions reported',
      pillars: [
        { icon: 'target', title: 'Clear ownership', text: 'Every metric has one accountable owner.' },
        { icon: 'clock', title: 'Fresh data', text: 'Updates land in minutes, not days.' },
        { icon: 'shield', title: 'Trusted source', text: 'One definition used by every team.' },
      ],
    },
  }),

  // ─────────────────────────────────────────────────────────────── festival (greeting)
  make({
    id: 'festival_stage',
    playId: 'festival',
    label: 'Ornate',
    tagline: 'Full-bleed photo, ornamental double frame, serif festival wish',
    blocks: { eyebrow: R('optional'), subhead: R('required'), closing: R('optional') },
    headlineWords: [2, 7],
    copyRules: [
      'headline is the greeting itself ("Happy Diwali", "Eid Mubarak", "Warm wishes this season") — 2-7 words.',
      'eyebrow, if used, is the festival or occasion name in 1-3 words.',
      'subhead is one warm sentence from the brand, max 22 words. No sales language.',
      'closingLine, if used, is a short sign-off in 2-4 words ("With love, Team Hyper").',
      'Be respectful and accurate about the occasion; do not invent traditions.',
    ],
    artDirection:
      'Warm, celebratory scene appropriate to the occasion (lamps, lights, table, gathering) with a soft glowing centre and calm space for centred type, no text.',
    accentRole: 'headline',
    sample: { eyebrow: 'Festival of lights', headline: 'Happy Diwali', headlineAccent: 'Diwali', subhead: 'May your home glow with joy, warmth and new beginnings.', closingLine: 'With love, from all of us' },
  }),
  make({
    id: 'festival_card',
    playId: 'festival',
    label: 'Greeting card',
    tagline: 'Paper card on a colour field, arch photo, centred greeting',
    blocks: { eyebrow: R('optional'), subhead: R('required'), closing: R('optional') },
    headlineWords: [2, 6],
    copyRules: [
      'headline is the greeting itself, 2-6 words.',
      'eyebrow, if used, is the occasion in 1-3 words.',
      'subhead is one warm sentence, max 20 words.',
      'closingLine, if used, is a short sign-off in 2-4 words.',
    ],
    artDirection:
      'Warm, simple festive subject centred and tall (arch crop): lamp, flowers, lanterns or a table setting, soft glow, calm background, no text.',
    accentRole: 'band',
    sample: { eyebrow: 'Season’s greetings', headline: 'Warm wishes to you', headlineAccent: 'Warm wishes', subhead: 'Wishing you and your family a season of peace and joy.', closingLine: 'Team Hyper' },
  }),
  make({
    id: 'festival_editorial',
    playId: 'festival',
    label: 'Festive split',
    tagline: 'Colour block with stacked wish and confetti, photo across a wavy edge',
    blocks: { eyebrow: R('optional'), subhead: R('optional'), closing: R('optional') },
    headlineWords: [2, 6],
    copyRules: [
      'headline is the greeting, 2-6 words, written to stack over 2-4 lines.',
      'eyebrow, if used, is the occasion in 1-3 words.',
      'subhead, if used, is one short warm sentence (max 18 words).',
      'closingLine, if used, is a 2-3 word sign-off or invitation.',
    ],
    artDirection:
      'Vertical celebratory photograph with colourful festive details (lights, sweets, flowers, faces smiling), subject right of centre, no text.',
    accentRole: 'band',
    sample: { eyebrow: 'Celebrate', headline: 'Happy Holi to you', headlineAccent: 'Holi', subhead: 'May your day be full of colour and laughter.', closingLine: 'Enjoy the day' },
  }),

  // ─────────────────────────────────────────────────────────────── carousel
  make({
    id: 'carousel_numbered',
    playId: 'carousel_tips',
    label: 'Numbered',
    tagline: 'Giant number + promise headline, round-cornered photo, swipe cue',
    blocks: { eyebrow: R('required'), subhead: R('optional'), stat: R('optional'), closing: R('optional') },
    headlineWords: [4, 10],
    copyRules: [
      'headline is an outcome-led promise a stranger would swipe for ("tips to cut reporting time in half").',
      'statValue is the number of tips or steps promised ("5"), digits only, max 2 characters. Leave empty if there is no number.',
      'eyebrow is the series or topic label, 1-3 words ("OPERATIONS").',
      'subhead, if used, is one line that sets expectation, max 14 words.',
      'closingLine is the swipe cue in 1-2 words ("Swipe").',
    ],
    artDirection:
      'Landscape-friendly photograph that works in a rounded wide card: workspace or detail related to the tips, bright and clean, no text.',
    accentRole: 'stat',
    sample: { eyebrow: 'Operations', headline: 'tips to cut reporting time in half', headlineAccent: 'in half', statValue: '5', subhead: 'Simple habits that save hours every week.', closingLine: 'Swipe' },
  }),
  make({
    id: 'carousel_bold',
    playId: 'carousel_tips',
    label: 'Bold',
    tagline: 'Poster-weight headline on a colour field with a round photo',
    blocks: { eyebrow: R('optional'), subhead: R('optional'), closing: R('optional') },
    headlineWords: [3, 9],
    copyRules: [
      'headline is a punchy, bold claim of 3-9 words that makes the viewer swipe.',
      'eyebrow, if used, is a 1-3 word topic tag.',
      'subhead, if used, is one short line, max 12 words.',
      'closingLine, if used, is 1-3 words ("Swipe to learn").',
    ],
    artDirection:
      'Simple square photograph that crops into a circle: one clear subject, bright and friendly, plain background, no text.',
    accentRole: 'band',
    sample: { eyebrow: 'Quick guide', headline: 'Stop guessing. Start measuring.', headlineAccent: 'Start measuring', subhead: 'A short guide to getting data you can trust.', closingLine: 'Swipe to learn' },
  }),
  make({
    id: 'carousel_column',
    playId: 'carousel_tips',
    label: 'Checklist',
    tagline: 'Promise headline above three tip cards with tick boxes',
    blocks: { eyebrow: R('optional'), pillars: 3, closing: R('optional') },
    headlineWords: [4, 10],
    copyRules: [
      'headline is the promise for this slide set ("A simple checklist for cleaner data").',
      'Exactly three pillars, each one actionable tip: title 2-4 words, text under 16 words of new substance.',
      'eyebrow, if used, is a 1-3 word label. closingLine, if used, is a 1-2 word cue ("Next").',
      'Keep the same pillar rhythm across every slide in the set.',
    ],
    artDirection:
      'Small, simple photograph that crops into a circle: a single clear subject related to the topic, bright and uncluttered, no text.',
    accentRole: 'rule',
    sample: {
      eyebrow: 'Checklist', headline: 'A simple checklist for cleaner data', headlineAccent: 'cleaner data', closingLine: 'Next',
      pillars: [
        { icon: 'check', title: 'Name every metric', text: 'Give each number one clear, shared definition.' },
        { icon: 'clock', title: 'Check freshness', text: 'Note when each source last updated.' },
        { icon: 'users', title: 'Assign an owner', text: 'One person is accountable for each dataset.' },
      ],
    },
  }),
];
