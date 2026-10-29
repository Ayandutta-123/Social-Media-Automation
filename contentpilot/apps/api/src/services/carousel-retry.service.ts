import { prisma } from '../lib/prisma';
import { extractCarouselProgress } from '../lib/carousel-parse';

/**
 * Restart a carousel that stopped part-way. Finished slides and the wording are kept; only the
 * missing slides are made. The post goes back to "generating" and, when done, to Approvals.
 */
export async function retryCarousel(
  tenantId: string,
  contentId: string,
): Promise<{ contentId: string; missing: number; total: number }> {
  const content = await prisma.generatedContent.findFirst({
    where: { id: contentId, tenantId, deletedAt: null },
    select: { id: true, status: true, templateSlots: true },
  });
  if (!content) throw new Error('Post not found.');
  const progress = extractCarouselProgress(content.templateSlots);
  if (!progress) throw new Error('This post has no unfinished carousel to retry.');
  if (content.status === 'generating') throw new Error('This carousel is already being finished.');
  if (content.status !== 'failed') {
    throw new Error(`Only a failed carousel can be retried (this one is ${content.status}).`);
  }

  // Claim it, so a double tap cannot start two runs.
  const claimed = await prisma.generatedContent.updateMany({
    where: { id: contentId, tenantId, status: 'failed' },
    data: { status: 'generating', publishError: null },
  });
  if (!claimed.count) throw new Error('This carousel is already being finished.');

  await prisma.contentCalendarPlanEntry.updateMany({
    where: { contentId, plan: { tenantId } },
    data: { status: 'generating', errorMessage: null },
  });

  const { enqueueCarouselResume } = await import('../workers');
  await enqueueCarouselResume(contentId, tenantId);
  return { contentId, missing: progress.total - progress.slides.length, total: progress.total };
}
