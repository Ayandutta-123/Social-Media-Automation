import type { GeneratedPost } from '@contentpilot/shared';
import type { LLMService } from './llm.service';
import { findUngroundedClaims, longestSharedRun, postClaimText } from '../lib/source-grounding';

export type GroundingResult = {
  post: GeneratedPost;
  /** Numeric claims still not found in any source after the revision pass. */
  ungrounded: string[];
  /** Claims found on the first draft (before revision). */
  initiallyUngrounded: string[];
};

/**
 * Check a drafted post against its source text. Any figure the sources do not contain is a
 * hallucination risk, so ask the model to rewrite without it (one pass) and re-check.
 */
export async function enforceGrounding(opts: {
  llm: LLMService;
  systemPrompt: string;
  post: GeneratedPost;
  /** Authoritative text the post may draw numbers and facts from. */
  sources: string[];
  /** Short description of the sources for the revision prompt. */
  sourceLabel: string;
  /** Text the post must NOT copy (e.g. a competitor's caption). Runs of 8+ identical words trigger a rewrite. */
  forbidVerbatimFrom?: string;
}): Promise<GroundingResult> {
  const { llm, systemPrompt, sources, sourceLabel } = opts;
  let post = opts.post;

  const initiallyUngrounded = findUngroundedClaims(postClaimText(post), ...sources);
  const copied =
    opts.forbidVerbatimFrom && longestSharedRun(postClaimText(post), opts.forbidVerbatimFrom) >= 8;
  if (!initiallyUngrounded.length && !copied) return { post, ungrounded: [], initiallyUngrounded };

  try {
    const revised = await llm.generatePost({
      systemPrompt,
      userPrompt: `Rewrite this social post so every factual claim is supported by the ${sourceLabel} below.

${
        initiallyUngrounded.length
          ? `The draft contains figures that do NOT appear in the sources: ${initiallyUngrounded.join(', ')}.
Remove those figures (or replace them with a qualitative statement). Do not invent replacements.`
          : ''
      }${
        copied
          ? `\nThe draft copies long phrases word-for-word from another brand's post. Rewrite it completely in our own words.`
          : ''
      }
Keep the same angle, brand voice, hashtags and image direction. Output the full post JSON.

DRAFT
Headline: ${post.headline}
Body: ${post.body}
CTA: ${post.callToAction || ''}
Hashtags: ${post.hashtags.join(', ')}
Image prompt: ${post.imagePrompt || ''}

${sourceLabel.toUpperCase()} (the only allowed source of facts):
${sources.join('\n\n').slice(0, 9000)}`,
    });
    post = {
      ...revised,
      imagePrompt: revised.imagePrompt || post.imagePrompt,
      sourceAttribution: revised.sourceAttribution || post.sourceAttribution,
    };
  } catch {
    // keep the draft; the caller will force human review
  }

  return {
    post,
    ungrounded: [
      ...findUngroundedClaims(postClaimText(post), ...sources),
      ...(opts.forbidVerbatimFrom && longestSharedRun(postClaimText(post), opts.forbidVerbatimFrom) >= 8
        ? ['copied-wording']
        : []),
    ],
    initiallyUngrounded: copied ? [...initiallyUngrounded, 'copied-wording'] : initiallyUngrounded,
  };
}
