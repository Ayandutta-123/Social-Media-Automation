import fs from 'fs/promises';
import path from 'path';
import type { Prisma } from '@prisma/client';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { storeOriginalImage } from '../lib/store-upload';
import { analyzeBrandReferenceImage } from './reference-style.service';
import { isPosterReferenceMode, type PosterReferenceMode } from './brand-poster-reference.service';

/** Style pictures a user attaches to one calendar plan ("make my posters look like these"). */
export const MAX_PLAN_REFERENCES = 10;
/** Pictures uploaded but never saved with a plan are removed after this long. */
const STAGED_TTL_MS = 24 * 60 * 60 * 1000;

const PUBLIC_FIELDS = {
  id: true,
  imageUrl: true,
  label: true,
  varietyKey: true,
  planId: true,
  createdAt: true,
} as const;

async function unlinkIfUnused(imageUrl: string): Promise<void> {
  if (!imageUrl.startsWith('/uploads/')) return;
  // A multi-month workbook copies the rows, not the file — keep it while any active row still uses it.
  const stillUsed = await prisma.brandPosterReference.count({ where: { imageUrl, isActive: true } });
  if (stillUsed > 0) return;
  const root = path.resolve(config.UPLOAD_DIR);
  const absolute = path.resolve(root, imageUrl.replace(/^\/uploads\//, ''));
  if (absolute.startsWith(root)) await fs.unlink(absolute).catch(() => undefined);
}

export async function purgeStalePlanReferences(tenantId: string): Promise<void> {
  const stale = await prisma.brandPosterReference.findMany({
    where: {
      tenantId,
      scope: 'plan',
      planId: null,
      isActive: true,
      createdAt: { lt: new Date(Date.now() - STAGED_TTL_MS) },
    },
    select: { id: true, imageUrl: true },
  });
  if (!stale.length) return;
  await prisma.brandPosterReference.updateMany({
    where: { id: { in: stale.map((r) => r.id) } },
    data: { isActive: false },
  });
  for (const row of stale) await unlinkIfUnused(row.imageUrl);
}

/** planId null = pictures uploaded for a calendar that is not saved yet. */
export async function listPlanReferences(tenantId: string, planId: string | null) {
  await purgeStalePlanReferences(tenantId).catch(() => undefined);
  return prisma.brandPosterReference.findMany({
    where: { tenantId, scope: 'plan', planId, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: PUBLIC_FIELDS,
  });
}

async function assertPlanOwned(tenantId: string, planId: string) {
  const plan = await prisma.contentCalendarPlan.findFirst({
    where: { id: planId, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!plan) throw new Error('Saved calendar not found.');
}

export async function addPlanReference(opts: {
  tenantId: string;
  planId: string | null;
  buffer: Buffer;
  filename: string;
  mimetype: string;
}) {
  if (opts.planId) await assertPlanOwned(opts.tenantId, opts.planId);
  const count = await prisma.brandPosterReference.count({
    where: { tenantId: opts.tenantId, scope: 'plan', planId: opts.planId, isActive: true },
  });
  if (count >= MAX_PLAN_REFERENCES) {
    throw new Error(`You can attach up to ${MAX_PLAN_REFERENCES} style pictures to one calendar.`);
  }

  const stored = await storeOriginalImage({
    tenantId: opts.tenantId,
    subdir: 'plan-references',
    buffer: opts.buffer,
    originalFilename: opts.filename || 'style.png',
    mimetype: opts.mimetype,
    logLabel: 'plan-reference',
  });
  try {
    const analysis = await analyzeBrandReferenceImage(opts.tenantId, stored.publicUrl);
    return await prisma.brandPosterReference.create({
      data: {
        tenantId: opts.tenantId,
        scope: 'plan',
        planId: opts.planId,
        imageUrl: stored.publicUrl,
        label: (opts.filename || `Style ${count + 1}`).slice(0, 160),
        styleBrief: analysis.narrativeBrief || analysis.imagePromptBlock,
        styleProfile: analysis as unknown as Prisma.InputJsonValue,
        varietyKey: analysis.varietyKey,
        width: stored.width,
        height: stored.height,
      },
      select: PUBLIC_FIELDS,
    });
  } catch (error) {
    await fs.unlink(stored.absolutePath).catch(() => undefined);
    throw error;
  }
}

export async function removePlanReference(tenantId: string, id: string): Promise<boolean> {
  const row = await prisma.brandPosterReference.findFirst({
    where: { id, tenantId, scope: 'plan', isActive: true },
    select: { id: true, imageUrl: true, planId: true },
  });
  if (!row) return false;
  await prisma.brandPosterReference.update({ where: { id }, data: { isActive: false } });
  await unlinkIfUnused(row.imageUrl);
  // A plan with no pictures left cannot follow any.
  if (row.planId) {
    const left = await prisma.brandPosterReference.count({
      where: { tenantId, scope: 'plan', planId: row.planId, isActive: true },
    });
    if (!left) {
      await prisma.contentCalendarPlan.updateMany({
        where: { id: row.planId, tenantId },
        data: { referenceMode: 'off' },
      });
    }
  }
  return true;
}

export async function setPlanReferenceMode(tenantId: string, planId: string, mode: PosterReferenceMode) {
  await assertPlanOwned(tenantId, planId);
  if (!isPosterReferenceMode(mode)) throw new Error('Unknown reference mode.');
  if (mode !== 'off') {
    const count = await prisma.brandPosterReference.count({
      where: { tenantId, scope: 'plan', planId, isActive: true },
    });
    if (!count) throw new Error('Add at least one style picture first.');
  }
  await prisma.contentCalendarPlan.update({ where: { id: planId }, data: { referenceMode: mode } });
  return { planId, referenceMode: mode };
}

/**
 * Called when a calendar is saved: the pictures uploaded beforehand join the new plan(s).
 * The first plan takes the rows; further plans (a workbook that spans several months) get copies
 * that point at the same files.
 */
export async function attachStagedReferences(opts: {
  tenantId: string;
  planIds: string[];
  referenceIds: string[];
  mode: PosterReferenceMode;
}): Promise<number> {
  if (!opts.planIds.length || !opts.referenceIds.length) return 0;
  const staged = await prisma.brandPosterReference.findMany({
    where: {
      id: { in: opts.referenceIds },
      tenantId: opts.tenantId,
      scope: 'plan',
      planId: null,
      isActive: true,
    },
  });
  if (!staged.length) return 0;

  const [firstPlan, ...otherPlans] = opts.planIds;
  await prisma.brandPosterReference.updateMany({
    where: { id: { in: staged.map((r) => r.id) } },
    data: { planId: firstPlan },
  });
  for (const planId of otherPlans) {
    await prisma.brandPosterReference.createMany({
      data: staged.map((r) => ({
        tenantId: r.tenantId,
        scope: 'plan',
        planId,
        imageUrl: r.imageUrl,
        label: r.label,
        styleBrief: r.styleBrief,
        styleProfile: (r.styleProfile ?? undefined) as Prisma.InputJsonValue | undefined,
        varietyKey: r.varietyKey,
        width: r.width,
        height: r.height,
      })),
    });
  }
  await prisma.contentCalendarPlan.updateMany({
    where: { id: { in: opts.planIds }, tenantId: opts.tenantId },
    data: { referenceMode: opts.mode },
  });
  return staged.length;
}

/** Reference pictures for a set of saved plans, grouped by plan (used by the saved-calendars list). */
export async function referencesByPlan(tenantId: string, planIds: string[]) {
  if (!planIds.length) return new Map<string, Array<{ id: string; imageUrl: string; label: string; varietyKey: string }>>();
  const rows = await prisma.brandPosterReference.findMany({
    where: { tenantId, scope: 'plan', planId: { in: planIds }, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, imageUrl: true, label: true, varietyKey: true, planId: true },
  });
  const map = new Map<string, Array<{ id: string; imageUrl: string; label: string; varietyKey: string }>>();
  for (const row of rows) {
    if (!row.planId) continue;
    const list = map.get(row.planId) || [];
    list.push({ id: row.id, imageUrl: row.imageUrl, label: row.label, varietyKey: row.varietyKey });
    map.set(row.planId, list);
  }
  return map;
}
