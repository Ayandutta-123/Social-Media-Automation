import { prisma } from '../lib/prisma';
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

export function buildVarietyInstruction(
  references: StoredReference[],
  seed: string,
): {
  styleInstruction: string;
  varietyKey: string;
  members: StoredReference[];
} {
  const clusters = clusterPosterVarieties(references);
  if (!clusters.length) {
    return { styleInstruction: '', varietyKey: '', members: [] };
  }
  const picked = clusters[stableIndex(seed, clusters.length)];
  const primary = analysisOf(picked.members[stableIndex(seed + ':img', picked.members.length)]);
  const alt = picked.members
    .filter((_, i) => i !== stableIndex(seed + ':img', picked.members.length))
    .slice(0, 1)
    .map((m) => analysisOf(m));

  const styleInstruction = [
    `USE THIS VARIETY ONLY — ${picked.label} (${picked.key}). Do not mix in other brand looks from the library.`,
    formatVisualAnalysisForPrompt(primary),
    alt.length
      ? `Sibling in the same variety (same family, different angle — do not copy): ${alt[0].imagePromptBlock}`
      : '',
    'New subject for THIS post. Same medium, palette, lighting, camera language, finish. Leave room for a new headline.',
  ]
    .filter(Boolean)
    .join('\n');

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
  /** Fixed template plates must never be modified by learned style. */
  designSource?: 'template' | 'brand_template' | 'ai' | null;
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
    opts.designSource === 'template' ||
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

  const picked = buildVarietyInstruction(references, opts.seed);
  const strengthNote =
    mode === 'strong'
      ? 'STRONG — this must look like the next creative in the SAME variety (not a blend of the whole library).'
      : 'GUIDE — keep this variety recognizable, but allow a fresh composition.';
  const catalogNote =
    clusterPosterVarieties(references).length > 1
      ? `Library has ${clusterPosterVarieties(references).length} varieties; this post uses only “${picked.varietyKey}”.`
      : '';
  const styleInstruction = [picked.styleInstruction, catalogNote, `Match strength: ${strengthNote}`]
    .filter(Boolean)
    .join('\n');

  if (mode !== 'strong' || opts.hasExplicitReference) {
    return { mode, styleInstruction, referenceImageUrl: null };
  }

  const pool = picked.members.length ? picked.members : references;
  const selected = pool[stableIndex(opts.seed, pool.length)].imageUrl;
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
