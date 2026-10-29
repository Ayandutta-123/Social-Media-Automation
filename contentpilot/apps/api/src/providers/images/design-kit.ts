/**
 * Drawing kit for designed poster templates (Canva-style layouts).
 *
 * Every design in poster-designs.ts is a function of a DesignCtx that returns SVG. The kit supplies
 * the pieces designers reuse: fitted text, accent-phrase headlines, photo frames (rect / arch /
 * circle / polaroid), pills, badges, rules and brand marks. Colours come only from the palette.
 */
import { escapeXml, mixHex, luminance, type InsightPalette } from './social-frame';
import { iconSvg } from './poster-frame';
import type { PosterSpec } from './poster-frame';

export type DesignColors = InsightPalette & {
  /** Slightly lifted surface for cards. */
  soft: string;
  /** Hairlines and dividers. */
  line: string;
  /** True when the ground is a dark colour. */
  dark: boolean;
};

export type CleanSpec = {
  eyebrow: string;
  headline: string;
  accent: string;
  subhead: string;
  pillars: Array<{ icon: string; title: string; text: string }>;
  stat: string;
  statLabel: string;
  calloutTitle: string;
  calloutBody: string;
  closing: string;
  footer: string;
};

export type DesignCtx = {
  W: number;
  H: number;
  /** W / 1080 — lets absolute sizes scale across formats. */
  u: number;
  pad: number;
  c: DesignColors;
  headFont: string;
  bodyFont: string;
  artHref: string;
  logoHref: string;
  company: string;
  s: CleanSpec;
  slideLabel?: string | null;
  uid: string;
  defs: string[];
  /** Called for every photo slot a design draws (used to size the AI photo before generating it). */
  onPhoto?: (slot: { w: number; h: number; shape: PhotoShape }) => void;
};

export const SERIF = 'Playfair Display,Georgia,Times New Roman,serif';
export const MONO = 'Fira Code,Courier New,Courier,monospace';
export const SCRIPT = 'Dancing Script,Caveat,Georgia,cursive';
export const IMPACT = 'Impact,Anton,Haettenschweiler,Arial Black,sans-serif';

function clean(s: string | undefined | null, max: number): string {
  return (s || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function cleanSpec(spec: PosterSpec): CleanSpec {
  return {
    eyebrow: clean(spec.eyebrow, 48),
    headline: clean(spec.headline, 150) || 'Brand update',
    accent: clean(spec.headlineAccent, 40),
    subhead: clean(spec.subhead, 200),
    pillars: (spec.pillars || [])
      .map((p) => ({
        icon: String(p.icon || 'spark'),
        title: clean(p.title, 32),
        text: clean(p.text, 110),
      }))
      .filter((p) => p.title || p.text)
      .slice(0, 3),
    stat: clean(spec.statValue, 12),
    statLabel: clean(spec.statLabel, 60),
    calloutTitle: clean(spec.calloutTitle, 60),
    calloutBody: clean(spec.calloutBody, 220),
    closing: clean(spec.closingLine, 60),
    footer: clean(spec.footerNote, 120),
  };
}

export function designColors(p: InsightPalette): DesignColors {
  return {
    ...p,
    soft: mixHex(p.ground, p.ink, 0.07),
    line: mixHex(p.ground, p.ink, 0.22),
    dark: luminance(p.ground) < 0.45,
  };
}

// ── text ──────────────────────────────────────────────────────────────────────

function wrapWords(text: string, maxChars: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxChars || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Keep the same line count but even out line lengths, so a headline never ends on a lone word. */
function balance(src: string, lines: string[], maxChars: number): string[] {
  if (lines.length < 2) return lines;
  let best = lines;
  for (let m = maxChars - 1; m >= 4; m--) {
    const next = wrapWords(src, m);
    if (next.length !== lines.length || next.some((l) => l.length > m)) break;
    best = next;
  }
  return best;
}

export type FitOpts = {
  w: number;
  h: number;
  max: number;
  min?: number;
  weight?: number;
  lh?: number;
  maxLines: number;
  upper?: boolean;
  ls?: number;
  /** Width factor override (mono ≈ 0.6, condensed ≈ 0.42). */
  cw?: number;
};

export type Fitted = { lines: string[]; size: number; lh: number; h: number };

/** Largest font size at which the text wraps inside the box. Never overflows: shrinks, then truncates. */
export function fit(text: string, o: FitOpts): Fitted {
  const weight = o.weight ?? 800;
  const lh = o.lh ?? 1.12;
  const min = o.min ?? Math.max(12, Math.round(o.max * 0.45));
  const base = o.cw ?? (weight >= 900 ? 0.68 : weight >= 700 ? 0.6 : weight >= 500 ? 0.54 : 0.5);
  const src = o.upper ? text.toUpperCase() : text;
  let size = Math.round(o.max);
  for (; size >= min; size -= 2) {
    const cw = size * base * (o.upper ? 1.1 : 1) + (o.ls ?? 0);
    const maxChars = Math.max(3, Math.floor(o.w / cw));
    const lines = wrapWords(src, maxChars);
    // A single long word wider than the box must shrink the type, not spill over it.
    if (lines.length <= o.maxLines && lines.length * size * lh <= o.h + 0.5 && lines.every((l) => l.length <= maxChars)) {
      return { lines: balance(src, lines, maxChars), size, lh, h: lines.length * size * lh };
    }
  }
  size = min;
  const cw = size * base * (o.upper ? 1.1 : 1) + (o.ls ?? 0);
  let lines = wrapWords(src, Math.max(3, Math.floor(o.w / cw)));
  if (lines.length > o.maxLines) {
    lines = lines.slice(0, o.maxLines);
    const last = lines[o.maxLines - 1] ?? '';
    lines[o.maxLines - 1] = last.replace(/[\s.,;:]+$/, '') + '…';
  }
  return { lines, size, lh, h: lines.length * size * lh };
}

export type TextStyle = {
  size: number;
  weight?: number;
  fill: string;
  anchor?: 'start' | 'middle' | 'end';
  lh?: number;
  font?: string;
  ls?: number;
  italic?: boolean;
  opacity?: number;
  /** Outline (meme / poster lettering). */
  stroke?: string;
  strokeW?: number;
  /** Shrink the type so a single line never exceeds this width. */
  maxW?: number;
  /** Phrase to paint in `accentFill`. */
  accent?: string;
  accentFill?: string;
};

/** Draw pre-wrapped lines; y is the TOP of the block. Returns svg. */
export function textBlock(lines: string[], x: number, y: number, st: TextStyle): string {
  const lh = st.lh ?? 1.12;
  const anchor = st.anchor ? ` text-anchor="${st.anchor}"` : '';
  const phrase = (st.accent || '').trim().toLowerCase();
  return lines
    .map((line, i) => {
      const by = Math.round(y + st.size * 0.86 + i * st.size * lh);
      const attrs =
        `x="${Math.round(x)}" y="${by}"${anchor} xml:space="preserve" font-family="${escapeXml(st.font || '')}" ` +
        `font-size="${st.size}" font-weight="${st.weight ?? 700}" fill="${st.fill}"` +
        (st.ls ? ` letter-spacing="${st.ls}"` : '') +
        (st.italic ? ' font-style="italic"' : '') +
        (st.opacity != null ? ` opacity="${st.opacity}"` : '') +
        (st.stroke && st.strokeW
          ? ` stroke="${st.stroke}" stroke-width="${st.strokeW}" stroke-linejoin="round" paint-order="stroke"`
          : '');
      const at = phrase ? line.toLowerCase().indexOf(phrase) : -1;
      if (at < 0 || !st.accentFill) return `<text ${attrs}>${escapeXml(line)}</text>`;
      const before = line.slice(0, at);
      const hit = line.slice(at, at + phrase.length);
      const after = line.slice(at + phrase.length);
      return `<text ${attrs}>${before ? `<tspan>${escapeXml(before)}</tspan>` : ''}<tspan fill="${st.accentFill}">${escapeXml(hit)}</tspan>${after ? `<tspan>${escapeXml(after)}</tspan>` : ''}</text>`;
    })
    .join('');
}

// ── shapes ────────────────────────────────────────────────────────────────────

export function rect(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  o: { r?: number; opacity?: number; stroke?: string; sw?: number; dash?: string } = {},
): string {
  return `<rect x="${Math.round(x)}" y="${Math.round(y)}" width="${Math.round(w)}" height="${Math.round(h)}"${
    o.r ? ` rx="${Math.round(o.r)}"` : ''
  } fill="${fill}"${o.opacity != null ? ` opacity="${o.opacity}"` : ''}${
    o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw ?? 2}"` : ''
  }${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}/>`;
}

export function circle(cx: number, cy: number, r: number, fill: string, o: { opacity?: number; stroke?: string; sw?: number } = {}): string {
  return `<circle cx="${Math.round(cx)}" cy="${Math.round(cy)}" r="${Math.round(r)}" fill="${fill}"${
    o.opacity != null ? ` opacity="${o.opacity}"` : ''
  }${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw ?? 2}"` : ''}/>`;
}

export function line(x1: number, y1: number, x2: number, y2: number, stroke: string, sw = 2, o: { opacity?: number; dash?: string } = {}): string {
  return `<line x1="${Math.round(x1)}" y1="${Math.round(y1)}" x2="${Math.round(x2)}" y2="${Math.round(y2)}" stroke="${stroke}" stroke-width="${sw}"${
    o.opacity != null ? ` opacity="${o.opacity}"` : ''
  }${o.dash ? ` stroke-dasharray="${o.dash}"` : ''} stroke-linecap="round"/>`;
}

/** Star-burst badge outline (sale / new stickers). */
export function burstPath(cx: number, cy: number, rOuter: number, rInner: number, points: number): string {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = (Math.PI * i) / points - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

/** Arch (rounded-top) path. */
export function archPath(x: number, y: number, w: number, h: number): string {
  const r = w / 2;
  return `M${x},${y + h} L${x},${y + r} A${r},${r} 0 0 1 ${x + w},${y + r} L${x + w},${y + h} Z`;
}

export function roundedPath(x: number, y: number, w: number, h: number, tl: number, tr: number, br: number, bl: number): string {
  return (
    `M${x + tl},${y} H${x + w - tr} Q${x + w},${y} ${x + w},${y + tr} V${y + h - br} Q${x + w},${y + h} ${x + w - br},${y + h} ` +
    `H${x + bl} Q${x},${y + h} ${x},${y + h - bl} V${y + tl} Q${x},${y} ${x + tl},${y} Z`
  );
}

// ── context-bound helpers ─────────────────────────────────────────────────────

export type PhotoShape = 'rect' | 'round' | 'circle' | 'arch' | 'topround';

export function makeKit(ctx: DesignCtx) {
  const { c, u } = ctx;
  let n = 0;
  const id = (p: string) => `${ctx.uid}_${p}${n++}`;

  /** Photo inside a shape, with a light brand grade. Returns svg. */
  function photo(
    x: number,
    y: number,
    w: number,
    h: number,
    shape: PhotoShape = 'rect',
    o: { r?: number; grade?: number; stroke?: string; sw?: number; focusX?: number; focusY?: number } = {},
  ): string {
    ctx.onPhoto?.({ w, h, shape });
    const cid = id('clip');
    const r = o.r ?? 28 * u;
    let clip: string;
    if (shape === 'circle') clip = `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${Math.min(w, h) / 2}"/>`;
    else if (shape === 'arch') clip = `<path d="${archPath(x, y, w, h)}"/>`;
    else if (shape === 'topround') clip = `<path d="${roundedPath(x, y, w, h, r, r, 0, 0)}"/>`;
    else clip = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${shape === 'round' ? r : 0}"/>`;
    ctx.defs.push(`<clipPath id="${cid}">${clip}</clipPath>`);
    const grade = o.grade ?? 1;
    const fx = o.focusX ?? 0.5;
    const align = fx < 0.34 ? 'xMin' : fx > 0.66 ? 'xMax' : 'xMid';
    const fy = o.focusY ?? 0.5;
    const alignY = fy < 0.34 ? 'YMin' : fy > 0.66 ? 'YMax' : 'YMid';
    const stroke =
      o.stroke && o.sw
        ? clip.replace('/>', ` fill="none" stroke="${o.stroke}" stroke-width="${o.sw}"/>`)
        : '';
    return (
      `<g clip-path="url(#${cid})">` +
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c.panel}"/>` +
      `<image href="${ctx.artHref}" xlink:href="${ctx.artHref}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="${align}${alignY} slice"/>` +
      (grade > 0
        ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c.ground}" opacity="${(0.1 * grade).toFixed(2)}"/>` +
          `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c.accent}" opacity="${(0.08 * grade).toFixed(2)}"/>`
        : '') +
      `</g>${stroke}`
    );
  }

  /** Full-bleed photo with a ground veil (for text-over-image designs). */
  function fullPhoto(veil = 0.55, o: { bottomHeavy?: boolean; focusX?: number } = {}): string {
    const gid = id('veil');
    ctx.defs.push(
      `<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0%" stop-color="${c.ground}" stop-opacity="${(veil * (o.bottomHeavy ? 0.25 : 0.9)).toFixed(2)}"/>` +
        `<stop offset="45%" stop-color="${c.ground}" stop-opacity="${(veil * (o.bottomHeavy ? 0.1 : 0.7)).toFixed(2)}"/>` +
        `<stop offset="100%" stop-color="${c.ground}" stop-opacity="${Math.min(0.96, veil * (o.bottomHeavy ? 1.55 : 1.1)).toFixed(2)}"/>` +
        `</linearGradient>`,
    );
    return photo(0, 0, ctx.W, ctx.H, 'rect', { grade: 1.2, focusX: o.focusX }) + `<rect width="${ctx.W}" height="${ctx.H}" fill="url(#${gid})"/>`;
  }

  /** Single-line label that shrinks to stay inside the canvas (or `maxW`). */
  function one(lines: string[], x: number, y: number, st: TextStyle): string {
    const anchor = st.anchor || 'start';
    const room =
      st.maxW ??
      (anchor === 'middle' ? 2 * Math.min(x, ctx.W - x) - ctx.pad * 0.6 : anchor === 'end' ? x - ctx.pad * 0.6 : ctx.W - ctx.pad * 0.6 - x);
    const longest = Math.max(1, ...lines.map((l) => l.length));
    const per = (st.weight ?? 700) >= 800 ? 0.62 : 0.56;
    const est = (size: number) => longest * (size * per + (st.ls ?? 0));
    let size = st.size;
    while (size > Math.max(11, st.size * 0.5) && est(size) > room) size -= 1;
    return textBlock(lines, x, y, { ...st, size });
  }

  /** Pill with text. Returns { svg, w, h }. */
  function pill(
    x: number,
    y: number,
    text: string,
    o: { fill: string; color: string; size?: number; weight?: number; ls?: number; anchor?: 'start' | 'middle' | 'end'; stroke?: string; padX?: number; upper?: boolean; arrow?: boolean } = { fill: c.accent, color: c.onAccent },
  ): { svg: string; w: number; h: number } {
    let size = o.size ?? Math.round(24 * u);
    const label = o.upper ? text.toUpperCase() : text;
    const maxPillW = ctx.W - ctx.pad * 2.6;
    const widthAt = (sz: number) => label.length * sz * (o.upper ? 0.66 : 0.58) + (o.ls ?? 0) * label.length + sz * 1.9 + (o.arrow ? sz * 1.3 : 0);
    while (size > 11 && widthAt(size) > Math.min(maxPillW, ctx.W * 0.62)) size -= 1;
    const textW = label.length * size * (o.upper ? 0.66 : 0.58) + (o.ls ?? 0) * label.length;
    const padX = o.padX ?? size * 0.95;
    const w = Math.round(textW + padX * 2 + (o.arrow ? size * 1.3 : 0));
    const h = Math.round(size * 2.1);
    const left = o.anchor === 'middle' ? x - w / 2 : o.anchor === 'end' ? x - w : x;
    const body =
      rect(left, y, w, h, o.fill, { r: h / 2, stroke: o.stroke, sw: 2 }) +
      textBlock([label], left + padX, y + (h - size) / 2 - size * 0.02, {
        size,
        weight: o.weight ?? 800,
        fill: o.color,
        font: ctx.headFont,
        ls: o.ls,
      }) +
      (o.arrow
        ? `<path d="M${left + w - padX - size * 0.9} ${y + h / 2} h${size * 0.8} m-${size * 0.3} -${size * 0.3} l${size * 0.3} ${size * 0.3} l-${size * 0.3} ${size * 0.3}" fill="none" stroke="${o.color}" stroke-width="${Math.max(2, size * 0.1)}" stroke-linecap="round" stroke-linejoin="round"/>`
        : '');
    return { svg: body, w, h };
  }

  /** Brand mark: logo image when available, else the company name in letter-spaced caps. */
  function brand(x: number, y: number, o: { anchor?: 'start' | 'middle' | 'end'; color?: string; height?: number } = {}): string {
    const h = o.height ?? Math.round(54 * u);
    const w = Math.round(h * 3.4);
    if (ctx.logoHref) {
      const left = o.anchor === 'middle' ? x - w / 2 : o.anchor === 'end' ? x - w : x;
      const par = o.anchor === 'middle' ? 'xMidYMid' : o.anchor === 'end' ? 'xMaxYMid' : 'xMinYMid';
      return `<image href="${ctx.logoHref}" xlink:href="${ctx.logoHref}" x="${Math.round(left)}" y="${Math.round(y)}" width="${w}" height="${h}" preserveAspectRatio="${par} meet"/>`;
    }
    return textBlock([(ctx.company || 'Brand').toUpperCase()], x, y + h * 0.18, {
      size: Math.round(h * 0.4),
      weight: 800,
      fill: o.color ?? c.ink,
      font: ctx.headFont,
      ls: 3,
      anchor: o.anchor,
    });
  }

  function icon(name: string, x: number, y: number, size: number, stroke: string): string {
    return iconSvg(name, x, y, size, stroke);
  }

  function slideBadge(): string {
    if (!ctx.slideLabel) return '';
    const p = pill(ctx.W - ctx.pad, ctx.pad, ctx.slideLabel, { fill: c.accent, color: c.onAccent, size: Math.round(18 * u), anchor: 'end', ls: 1 });
    return p.svg;
  }

  /** Headline with accent phrase; returns svg + occupied height. */
  function headline(
    x: number,
    y: number,
    o: FitOpts & { fill?: string; accentFill?: string; anchor?: 'start' | 'middle' | 'end'; font?: string; italic?: boolean; stroke?: string; strokeW?: number },
  ): { svg: string; h: number; size: number } {
    const f = fit(ctx.s.headline, o);
    return {
      svg: textBlock(f.lines, x, y, {
        size: f.size,
        weight: o.weight ?? 800,
        fill: o.fill ?? c.ink,
        anchor: o.anchor,
        lh: f.lh,
        font: o.font ?? ctx.headFont,
        ls: o.ls,
        italic: o.italic,
        accent: ctx.s.accent,
        accentFill: o.accentFill ?? c.accent,
        stroke: o.stroke,
        strokeW: o.strokeW,
      }),
      h: f.h,
      size: f.size,
    };
  }

  /** Plain paragraph fitted to a box. */
  function para(
    text: string,
    x: number,
    y: number,
    o: FitOpts & { fill?: string; anchor?: 'start' | 'middle' | 'end'; font?: string; italic?: boolean },
  ): { svg: string; h: number; size: number } {
    if (!text) return { svg: '', h: 0, size: 0 };
    const f = fit(text, { weight: 500, lh: 1.32, ...o });
    return {
      svg: textBlock(f.lines, x, y, {
        size: f.size,
        weight: o.weight ?? 500,
        fill: o.fill ?? c.muted,
        anchor: o.anchor,
        lh: f.lh,
        font: o.font ?? ctx.bodyFont,
        ls: o.ls,
        italic: o.italic,
      }),
      h: f.h,
      size: f.size,
    };
  }

  return { photo, fullPhoto, pill, brand, icon, slideBadge, headline, para, one, id };
}

export type Kit = ReturnType<typeof makeKit>;
export type DesignFn = (ctx: DesignCtx, k: Kit) => string;
