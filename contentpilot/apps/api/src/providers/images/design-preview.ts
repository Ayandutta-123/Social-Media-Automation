/**
 * Preview rendering for designed templates: sample copy + a placeholder scene in the brand palette.
 * The placeholder is only for the picker thumbnail — real posts use the AI / uploaded photo.
 */
import type { PosterSpec } from './poster-frame';
import type { InsightPalette } from './social-frame';
import { mixHex } from './social-frame';
import { renderDesignSvg } from './poster-designs';

/** Soft abstract "photograph" — sky, sun, layered hills and bokeh — tinted from the palette. */
export function sampleArtDataUri(p: InsightPalette, seed = 1): string {
  const sky1 = mixHex(p.accent, p.ground, 0.55);
  const sky2 = mixHex(p.ground, p.ink, 0.25);
  const hill1 = mixHex(p.ground, p.accent, 0.35);
  const hill2 = mixHex(p.ground, '#000000', 0.35);
  const hill3 = mixHex(p.ground, '#000000', 0.6);
  const sx = 520 + ((seed * 137) % 300) - 150;
  let bokeh = '';
  for (let i = 0; i < 9; i++) {
    const x = (i * 211 + seed * 73) % 1080;
    const y = 120 + ((i * 127 + seed * 31) % 420);
    bokeh += `<circle cx="${x}" cy="${y}" r="${24 + ((i * 17) % 40)}" fill="${p.ink}" opacity="0.08"/>`;
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky2}"/><stop offset="0.65" stop-color="${sky1}"/><stop offset="1" stop-color="${p.accent}"/></linearGradient>` +
    `<radialGradient id="s"><stop offset="0" stop-color="#fff" stop-opacity="0.95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>` +
    `<rect width="1080" height="1080" fill="url(#g)"/>` +
    `<circle cx="${sx}" cy="560" r="260" fill="url(#s)" opacity="0.7"/><circle cx="${sx}" cy="560" r="92" fill="#fff" opacity="0.9"/>` +
    bokeh +
    `<path d="M0 700 Q 250 560 520 680 T 1080 640 V1080 H0Z" fill="${hill1}"/>` +
    `<path d="M0 800 Q 300 690 620 790 T 1080 760 V1080 H0Z" fill="${hill2}"/>` +
    `<path d="M0 930 Q 360 850 720 930 T 1080 900 V1080 H0Z" fill="${hill3}"/>` +
    `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

export function renderTemplatePreviewSvg(opts: {
  templateId: string;
  sample: Partial<PosterSpec>;
  palette: InsightPalette;
  headingFont: string;
  bodyFont: string;
  companyName?: string | null;
  logoHref?: string;
  width?: number;
  height?: number;
  artHref?: string;
}): string {
  const spec: PosterSpec = { headline: opts.sample.headline || 'Your headline here', ...opts.sample };
  return renderDesignSvg({
    templateId: opts.templateId,
    width: opts.width ?? 1080,
    height: opts.height ?? 1080,
    artHref: opts.artHref || sampleArtDataUri(opts.palette, opts.templateId.length),
    logoHref: opts.logoHref,
    companyName: opts.companyName || 'Your Brand',
    headingFont: opts.headingFont,
    bodyFont: opts.bodyFont,
    spec,
    palette: opts.palette,
  });
}
