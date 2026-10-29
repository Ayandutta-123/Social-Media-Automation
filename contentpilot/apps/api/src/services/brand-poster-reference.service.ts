import { prisma } from '../lib/prisma';
import { BRAND_DNA_MARKER } from '../providers/images/social-frame';
import {
  analysisFromLegacyBrief,
  formatVisualAnalysisForPrompt,
  parseBrandVisualAnalysis,
  resolveReferenceDataUri,
  resolveReferencePublicUrl,
  type BrandVisualAnalysis,
} from './reference-style.service';

export const MAX_BRAND_POSTER_REFERENCES = 20;

export type PosterReferenceMode = 'off' | 'guide' | 'strong';

export function isPosterReferenceMode(value: unknown): value is PosterReferenceMode {
  return value === 'off' || value === 'guide' || value === 'strong';
}

type StoredReference = {
  imageUrl: string;
  label?: string | null;
  styleBrief: string;
  styleProfile?: unknown;
  varietyKey?: string | null;
};

function analysisOf(reference: StoredReference): BrandVisualAnalysis {
  if (reference.styleProfile && typeof reference.styleProfile === 'object') {
    return parseBrandVisualAnalysis(
      JSON.stringify(reference.styleProfile),
      reference.styleBrief,
    );
  }
  return analysisFromLegacyBrief(reference.styleBrief, reference.label || undefined);
}

function topRepeated(values: string[], minCount: number): string[] {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const v = raw.trim();
    if (!v) continue;
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= minCount)
    .sort((a, b) => b[1] - a[1])
    .map(([v]) => v)
    .slice(0, 6);
}

export function clusterPosterVarieties(references: StoredReference[]): Array<{
  key: string;
  label: string;
  members: StoredReference[];
  analysis: BrandVisualAnalysis;
}> {
  const groups = new Map<string, StoredReference[]>();
  for (const reference of references) {
    const analysis = analysisOf(reference);
    const key = analysis.varietyKey || 'brand-look';
    const list = groups.get(key) || [];
    list.push(reference);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([key, members]) => {
    const analysis = analysisOf(members[0]);
    return {
      key,
      label: analysis.varietyLabel || key,
      members,
      analysis,
    };
  });
}

export function aggregatePosterStyleBriefs(references: StoredReference[]): string {
  const usable = references.filter((r) => (r.styleBrief || r.styleProfile)?.toString().trim());
  if (!usable.length) return '';

  const analyses = usable.map(analysisOf);
  const clusters = clusterPosterVarieties(usable);
  const minShared = Math.max(2, Math.ceil(usable.length * 0.4));
  const sharedPalette = topRepeated(
    analyses.flatMap((a) => a.colorPalette.dominant),
    minShared,
  );
  const sharedKeep = topRepeated(
    analyses.flatMap((a) => a.doKeep),
    minShared,
  );

  const varietyBlocks = clusters.map((cluster, index) => {
    const sample = cluster.members.slice(0, 2).map((member, i) => {
      const a = analysisOf(member);
      return `  Example ${i + 1} (${member.label || 'poster'}): ${formatVisualAnalysisForPrompt(a)}`;
    });
    return [
      `VARIETY ${index + 1}: ${cluster.label} [${cluster.key}] — ${cluster.members.length} reference(s)`,
      ...sample,
    ].join('\n');
  });

  return [
    'BRAND VISUAL SYSTEM — multiple varieties. Pick EXACTLY ONE variety for this post. Do not average or blend them.',
    sharedPalette.length || sharedKeep.length
      ? `Shared DNA (only if it does not fight the chosen variety): palette ${
          sharedPalette.join(', ') || 'n/a'
        }. Keep: ${sharedKeep.join('; ') || 'medium + finish of the chosen variety'}.`
      : 'No dominant shared DNA — treat each variety as its own campaign family.',
    ...varietyBlocks,
    'Create an original composition for the current topic. Never copy old readable text, logos, or faces from the references.',
  ].join('\n');
}

export { BRAND_DNA_MARKER };

const STOP_WORDS = new Set(
  'the a an and or of for to in on with at by from as is are be this that it its your our their into over under about'.split(' '),
);

function wordsOf(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP_WORDS.has(w)),
  );
}

/** Pick the variety whose subject/mood best fits the post; ties (and no hint) fall back to a stable hash. */
function pickCluster<T extends { analysis: BrandVisualAnalysis; label: string }>(
  clusters: T[],
  seed: string,
  topicHint?: string,
): T {
  const fallback = clusters[stableIndex(seed, clusters.length)];
  if (!topicHint || clusters.length < 2) return fallback;
  const topic = wordsOf(topicHint);
  if (!topic.size) return fallback;
  let best = fallback;
  let bestScore = 0;
  let tie = false;
  for (const cluster of clusters) {
    const a = cluster.analysis;
    const vocab = wordsOf(`${cluster.label} ${a.subjectArchetype} ${a.mood} ${a.medium}`);
    let score = 0;
    for (const w of vocab) if (topic.has(w)) score += 1;
    if (score > bestScore) {
      best = cluster;
      bestScore = score;
      tie = false;
    } else if (score === bestScore && score > 0) {
      tie = true;
    }
  }
  return bestScore > 0 && !tie ? best : fallback;
}

/** One compact block (~700 chars): enough to steer the model, short enough to survive prompt limits. */
function compactDna(a: BrandVisualAnalysis): string {
  return [
    `${a.varietyLabel}: ${a.medium}, ${a.mood}.`,
    `Palette: ${a.colorPalette.dominant.slice(0, 3).join(', ')}${
      a.colorPalette.accents.length ? `; accents ${a.colorPalette.accents.slice(0, 2).join(', ')}` : ''
    }; ground ${a.colorPalette.background}; ${a.colorPalette.contrast} contrast.`,
    `Light: ${a.lighting}.`,
    `Camera: ${a.composition.camera}; ${a.composition.layout}; depth ${a.composition.depth}.`,
    `Finish: ${a.textureFinish}.`,
    `Keep: ${a.doKeep.slice(0, 4).join('; ')}.`,
  ]
    .join(' ')
    .replace(/\s+/g, ' ')
    .slice(0, 760);
}

export function buildVarietyInstruction(
  references: StoredReference[],
  seed: string,
  opts: { topicHint?: string; imageSeed?: string } = {},
): {
  styleInstruction: string;
  varietyKey: string;
  members: StoredReference[];
} {
  const clusters = clusterPosterVarieties(references);
  if (!clusters.length) {
    return { styleInstruction: '', varietyKey: '', members: [] };
  }
  const picked = pickCluster(clusters, seed, opts.topicHint);
  const imageSeed = opts.imageSeed || seed;
  const primary = analysisOf(picked.members[stableIndex(`${imageSeed}:img`, picked.members.length)]);

  const styleInstruction = [
    `${BRAND_DNA_MARKER} — use this look only (${picked.key}); do not mix in other looks.`,
    compactDna(primary),
    'New subject for THIS post. Never reproduce readable text, logos or faces from the references.',
  ].join(' ');

  return { styleInstruction, varietyKey: picked.key, members: picked.members };
}

export async function refreshPosterVisualProfile(tenantId: string): Promise<string> {
  const references = await prisma.brandPosterReference.findMany({
    where: { tenantId, isActive: true },
    select: { label: true, styleBrief: true, styleProfile: true, varietyKey: true, imageUrl: true },
    orderBy: { createdAt: 'desc' },
    take: MAX_BRAND_POSTER_REFERENCES,
  });
  const profile = aggregatePosterStyleBriefs(references);
  await prisma.brandSettings.update({
    where: { tenantId },
    data: { posterVisualProfile: profile },
  });
  return profile;
}

function stableIndex(seed: string, length: number): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % Math.max(1, length);
}

export async function resolvePosterVisualGuidance(opts: {
  tenantId: string;
  seed: string;
  /** Exact story/competitor/meme/user reference must remain authoritative. */
  hasExplicitReference?: boolean;
  /**
   * Brand Studio plates are fixed and never touched by learned style. ContentPilot layouts ('template')
   * keep their drawn design, but the photo inside them still follows the look (text guidance only).
   */
  designSource?: 'template' | 'brand_template' | 'ai' | null;
  /** The post's scene / topic — used to pick the variety that fits it. */
  topicHint?: string;
  /** Picks the reference image inside the variety; carousels pass a per-slide seed so slides differ. */
  imageSeed?: string;
}): Promise<{
  mode: PosterReferenceMode;
  styleInstruction: string;
  referenceImageUrl: string | null;
  referenceStrength?: number;
}> {
  const settings = await prisma.brandSettings.findUnique({
    where: { tenantId: opts.tenantId },
    select: { posterReferenceMode: true, posterVisualProfile: true },
  });
  const mode = isPosterReferenceMode(settings?.posterReferenceMode)
    ? settings.posterReferenceMode
    : 'off';
  if (
    mode === 'off' ||
    opts.hasExplicitReference ||
    opts.designSource === 'brand_template'
  ) {
    return { mode, styleInstruction: '', referenceImageUrl: null };
  }

  const references = await prisma.brandPosterReference.findMany({
    where: { tenantId: opts.tenantId, isActive: true },
    select: {
      imageUrl: true,
      label: true,
      styleBrief: true,
      styleProfile: true,
      varietyKey: true,
    },
    orderBy: { createdAt: 'asc' },
    take: MAX_BRAND_POSTER_REFERENCES,
  });

  if (!references.length) {
    return { mode, styleInstruction: '', referenceImageUrl: null };
  }

  const picked = buildVarietyInstruction(references, opts.seed, {
    topicHint: opts.topicHint,
    imageSeed: opts.imageSeed,
  });
  const strengthNote =
    mode === 'strong'
      ? 'Match closely: it should read as the next creative in this same look.'
      : 'Keep the look recognisable, but allow a fresh composition.';
  const styleInstruction = `${picked.styleInstruction} ${strengthNote}`;

  // Image-to-image from a whole poster only suits a full AI poster, not the photo slot of a drawn layout.
  if (mode !== 'strong' || opts.designSource === 'template') {
    return { mode, styleInstruction, referenceImageUrl: null };
  }

  const pool = picked.members.length ? picked.members : references;
  const selected = pool[stableIndex(`${opts.imageSeed || opts.seed}:img`, pool.length)].imageUrl;
  const publicUrl = resolveReferencePublicUrl(selected);
  const referenceImageUrl = /localhost|127\.0\.0\.1/.test(publicUrl)
    ? await resolveReferenceDataUri(selected).catch(() => null)
    : publicUrl;
  return {
    mode,
    styleInstruction,
    referenceImageUrl,
    referenceStrength: referenceImageUrl ? 0.72 : undefined,
  };
}
