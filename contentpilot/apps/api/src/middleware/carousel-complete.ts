import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma';
import { hasIncompleteCarousel } from '../lib/carousel-parse';

/**
 * Route guard: a carousel that stopped part-way (slides saved, others missing) must not be approved,
 * posted or re-drawn as if it were whole. It also answers 404 for posts of another company.
 */
export async function carouselCompleteGuard(request: FastifyRequest, reply: FastifyReply) {
  const id = (request.params as { id?: string }).id;
  if (!id) return;
  const row = await prisma.generatedContent.findFirst({
    where: { id, tenantId: request.session.tenantId!, deletedAt: null },
    select: { templateSlots: true },
  });
  if (!row) return reply.status(404).send({ success: false, error: 'Content not found' });
  if (hasIncompleteCarousel(row.templateSlots)) {
    return reply.status(409).send({
      success: false,
      code: 'CAROUSEL_INCOMPLETE',
      error: 'This carousel is missing slides. Use “Retry missing slides” first.',
    });
  }
}
