/**
 * Helpers that keep generated copy tied to what the source actually says:
 * readable article text, clean social-profile extraction, and a numeric-claim check.
 */

const FETCH_MS = 15_000;
const UA = 'Mozilla/5.0 (compatible; ContentPilot/1.0; +https://contentpilot.local; source-check)';

// ── Social profile links ────────────────────────────────────────────────────

const RESERVED: Record<'instagram' | 'facebook' | 'twitter', Set<string>> = {
  instagram: new Set(['p', 'reel', 'reels', 'explore', 'stories', 'accounts', 'tv', 'share', 'about', 'directory', 'legal']),
  facebook: new Set([
    'sharer', 'sharer.php', 'share.php', 'share', 'dialog', 'plugins', 'tr', 'groups', 'pages', 'watch',
    'events', 'login', 'policy', 'privacy', 'help', 'marketplace', 'gaming', 'profile.php', 'permalink.php',
  ]),
  twitter: new Set([
    'intent', 'share', 'home', 'i', 'search', 'hashtag', 'explore', 'settings', 'login', 'tos', 'privacy',
    'widgets.js', 'about', 'messages', 'notifications',
  ]),
};

export type SocialLinks = Partial<Record<'instagram' | 'linkedin' | 'facebook' | 'twitter', string>>;

function firstValid(text: string, re: RegExp, reserved?: Set<string>): string | null {
  const global = new RegExp(re.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = global.exec(text))) {
    const slug = (m[1] || '').replace(/[?#].*$/, '').replace(/\/+$/, '');
    if (!slug || slug.length < 2) continue;
    if (reserved?.has(slug.toLowerCase())) continue;
    return slug;
  }
  return null;
}

/**
 * Pull the company's own social profile URLs out of HTML or text.
 * Skips share/intent/post links and personal LinkedIn profiles (only /company/ and /school/ count).
 */
export function extractSocialLinks(text: string): SocialLinks {
  const out: SocialLinks = {};
  const ig = firstValid(text, /https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9._]+)/, RESERVED.instagram);
  if (ig) out.instagram = `https://instagram.com/${ig}`;
  const fb = firstValid(text, /https?:\/\/(?:www\.|m\.)?facebook\.com\/([A-Za-z0-9.\-]+)/, RESERVED.facebook);
  if (fb) out.facebook = `https://facebook.com/${fb}`;
  const li = firstValid(text, /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:company|school)\/([A-Za-z0-9._%\-]+)/);
  if (li) out.linkedin = `https://www.linkedin.com/company/${li}`;
  const tw = firstValid(text, /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/([A-Za-z0-9_]+)/, RESERVED.twitter);
  if (tw) out.twitter = `https://x.com/${tw}`;
  return out;
}

/** True when a profile slug plausibly belongs to a company with this name. */
export function slugMatchesName(slug: string, name: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const a = norm(slug.split('/').filter(Boolean).pop() || slug);
  const b = norm(name);
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  // First word of a multi-word name ("Acme Robotics" → "acme") is a common handle.
  const first = norm(name.split(/\s+/)[0] || '');
  return first.length >= 4 && a.includes(first);
}

// ── Page text ───────────────────────────────────────────────────────────────

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/gi, ' ');
}

/** Readable body text: prefers <article>/<main>, drops nav/footer/aside/scripts. */
export function htmlToArticleText(html: string): string {
  let h = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  const pick = (tag: string): string | null => {
    const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
    let best: string | null = null;
    let m: RegExpExecArray | null;
    while ((m = re.exec(h))) {
      if (!best || m[1].length > best.length) best = m[1];
    }
    return best && best.length > 400 ? best : null;
  };
  h = pick('article') || pick('main') || h;

  h = h
    .replace(/<(nav|header|footer|aside|form|button|iframe)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  return decodeEntities(h)
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    // Drop one-word menu/cookie fragments; keep real sentences and short headings.
    .filter((l) => l.length > 25 || /^[A-Z0-9]/.test(l) && l.split(' ').length >= 3)
    .join('\n')
    .trim();
}

function meta(html: string, ...names: string[]): string | null {
  for (const n of names) {
    const a = new RegExp(`<meta[^>]+(?:property|name)=["']${n}["'][^>]+content=["']([^"']*)["']`, 'i').exec(html);
    const b = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${n}["']`, 'i').exec(html);
    const v = (a?.[1] || b?.[1] || '').trim();
    if (v) return decodeEntities(v);
  }
  return null;
}

export type FetchedPage = {
  url: string;
  title: string | null;
  description: string | null;
  publishedAt: string | null;
  siteName: string | null;
  html: string;
  text: string;
};

async function fetchRaw(url: string, accept = 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8'): Promise<Response | null> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_MS);
  try {
    return await fetch(url, { signal: ac.signal, redirect: 'follow', headers: { 'User-Agent': UA, Accept: accept } });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Fetch a public page and return its readable text plus basic metadata. Falls back to a render reader for JS-only pages. */
export async function fetchPage(url: string, maxChars = 7000): Promise<FetchedPage | null> {
  if (!/^https?:\/\//i.test(url) || /localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]/i.test(url)) return null;
  const res = await fetchRaw(url);
  let html = '';
  let finalUrl = url;
  if (res?.ok) {
    const ctype = (res.headers.get('content-type') || '').toLowerCase();
    if (!ctype || ctype.includes('html') || ctype.includes('xml') || ctype.includes('text/plain')) {
      html = await res.text();
      finalUrl = res.url || url;
    }
  }

  let text = html ? htmlToArticleText(html) : '';
  if (text.length < 400) {
    const reader = await fetchRaw(`https://r.jina.ai/${url}`, 'text/plain');
    if (reader?.ok) {
      const rendered = (await reader.text()).trim();
      if (rendered.length > text.length) text = rendered;
    }
  }
  if (!html && !text) return null;

  return {
    url: finalUrl,
    title: meta(html, 'og:title', 'twitter:title') || /<title[^>]*>([^<]+)<\/title>/i.exec(html)?.[1]?.trim() || null,
    description: meta(html, 'og:description', 'description', 'twitter:description'),
    publishedAt: meta(html, 'article:published_time', 'og:article:published_time', 'datePublished', 'pubdate'),
    siteName: meta(html, 'og:site_name'),
    html,
    text: text.slice(0, maxChars),
  };
}

// ── Numeric-claim grounding ─────────────────────────────────────────────────

const CLAIM_RE = /(?:[$€£₹]\s?)?\d[\d,]*(?:\.\d+)?\s?(?:%|percent\b|x\b|k\b|m\b|bn\b|b\b|million\b|billion\b|trillion\b|crore\b|lakh\b)?/gi;

/** Numbers that read as factual claims: money, %, multipliers, years, or values above 10. */
export function extractNumericClaims(text: string): string[] {
  const out = new Set<string>();
  const cleaned = text.replace(/#[A-Za-z0-9_]+/g, ' '); // hashtags like #5G are not claims
  for (const m of cleaned.matchAll(CLAIM_RE)) {
    const raw = m[0].trim();
    const core = raw.replace(/[^\d.]/g, '').replace(/\.$/, '');
    if (!core) continue;
    const hasUnit = /[%$€£₹]|percent|x$|k$|m$|bn$|b$|million|billion|trillion|crore|lakh/i.test(raw);
    const value = Number(core);
    if (hasUnit || value > 10) out.add(core);
  }
  return [...out];
}

/** Every number written in the sources, as comparable strings ("1,200" → "1200", "3.0" → "3"). */
function numbersIn(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const core = m[0].replace(/,/g, '').replace(/\.$/, '');
    out.add(core);
    const n = Number(core);
    if (Number.isFinite(n)) out.add(String(n));
  }
  return out;
}

/** Numeric claims present in `generated` that appear (as whole numbers) in none of the `sources`. */
export function findUngroundedClaims(generated: string, ...sources: string[]): string[] {
  const known = numbersIn(sources.join('\n'));
  return extractNumericClaims(generated).filter((core) => {
    const n = Number(core);
    return !(known.has(core) || (Number.isFinite(n) && known.has(String(n))));
  });
}

/** Single string of everything user-visible in a generated post (hashtags excluded). */
export function postClaimText(post: { headline?: string; body?: string; callToAction?: string | null }): string {
  return [post.headline, post.body, post.callToAction].filter(Boolean).join('\n');
}

/** Longest run of identical consecutive words shared by `a` and `b` (case/punctuation-insensitive), capped at `cap`. */
export function longestSharedRun(a: string, b: string, cap = 12): number {
  const words = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  const A = words(a);
  const B = words(b);
  if (!A.length || !B.length) return 0;
  const index = new Map<string, number[]>();
  B.forEach((w, i) => index.set(w, [...(index.get(w) || []), i]));
  let best = 0;
  for (let i = 0; i < A.length && best < cap; i++) {
    for (const j of index.get(A[i]) || []) {
      let k = 0;
      while (i + k < A.length && j + k < B.length && A[i + k] === B[j + k] && k < cap) k++;
      if (k > best) best = k;
    }
  }
  return best;
}
