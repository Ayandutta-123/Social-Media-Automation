/**
 * Designed poster templates — the Canva-style layouts behind AI Assistant "Pick an image format".
 *
 * One function per template id. Each draws a complete, distinct composition (frames, badges,
 * numerals, timelines…) from the same brand palette, then the AI fills the copy slots and the
 * hero photo. Layout is the template; colours and fonts are always the tenant's Brand Kit.
 */
import fs from 'fs';
import path from 'path';
import { config } from '../../config';
import type { PosterSpec } from './poster-frame';
import {
  IMPACT,
  MONO,
  SCRIPT,
  SERIF,
  archPath,
  burstPath,
  circle,
  cleanSpec,
  designColors,
  fit,
  line,
  makeKit,
  rect,
  textBlock,
  type DesignCtx,
  type DesignFn,
} from './design-kit';
import type { InsightPalette } from './social-frame';

export const DESIGN_LAYOUT_PREFIX = 'design_';

export function isDesignLayout(layout?: string | null): boolean {
  return Boolean(layout && layout.startsWith(DESIGN_LAYOUT_PREFIX));
}

export function designLayoutId(templateId: string): string {
  return `${DESIGN_LAYOUT_PREFIX}${templateId}`;
}

export function templateIdFromLayout(layout: string): string {
  return layout.slice(DESIGN_LAYOUT_PREFIX.length);
}

const bg = (ctx: DesignCtx, fill = ctx.c.ground) => rect(0, 0, ctx.W, ctx.H, fill);

/** Evenly spaced soft dots — confetti / texture. Deterministic so previews are stable. */
function dots(ctx: DesignCtx, x: number, y: number, w: number, h: number, fill: string, count: number, opacity = 0.25): string {
  let out = '';
  for (let i = 0; i < count; i++) {
    const px = x + ((i * 97) % 101) / 101 * w;
    const py = y + ((i * 53 + 17) % 103) / 103 * h;
    out += circle(px, py, (4 + ((i * 7) % 6)) * ctx.u, fill, { opacity });
  }
  return out;
}

const DESIGNS: Record<string, DesignFn> = {
  // ═════════════════════════════════════════════════════════════ COUNTDOWN
  /** Clock-face ring with the day count inside, full-bleed photo behind. */
  countdown_ticker(ctx, k) {
    const { W, H, u, pad, c, s } = ctx;
    const cx = W / 2;
    const cy = H * 0.38;
    const R = W * 0.24;
    let ticks = '';
    for (let i = 0; i < 60; i++) {
      const a = (Math.PI * 2 * i) / 60;
      const major = i % 5 === 0;
      const r1 = R + 16 * u;
      const r2 = r1 + (major ? 26 : 12) * u;
      ticks += line(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a), cx + r2 * Math.cos(a), cy + r2 * Math.sin(a), major ? c.accent : c.ink, major ? 4 : 2, { opacity: major ? 1 : 0.35 });
    }
    const stat = s.stat || s.eyebrow || '';
    const sf = fit(stat, { w: R * 1.6, h: R * 0.95, max: R * 0.95, min: 24, weight: 900, maxLines: 1, lh: 1 });
    let out = bg(ctx) + k.fullPhoto(0.8) + circle(cx, cy, R, c.ground, { opacity: 0.62 }) + circle(cx, cy, R, 'none', { stroke: c.accent, sw: 7 * u }) + ticks;
    out += textBlock(sf.lines, cx, cy - sf.h * 0.62, { size: sf.size, weight: 900, fill: c.ink, anchor: 'middle', font: ctx.headFont, lh: 1 });
    if (s.statLabel) {
      const lf = fit(s.statLabel, { w: R * 1.5, h: 70 * u, max: 28 * u, min: 14, weight: 700, maxLines: 2, upper: true, ls: 3 });
      out += textBlock(lf.lines, cx, cy + sf.h * 0.42, { size: lf.size, weight: 700, fill: c.accent, anchor: 'middle', font: ctx.headFont, ls: 3, lh: lf.lh });
    }
    out += k.brand(cx, pad * 0.7, { anchor: 'middle' });
    const hl = k.headline(cx, H * 0.72, { w: W - pad * 3, h: H * 0.15, max: 62 * u, maxLines: 2, anchor: 'middle' });
    out += hl.svg;
    if (s.closing) out += k.pill(cx, H * 0.72 + hl.h + 24 * u, s.closing, { fill: c.accent, color: c.onAccent, anchor: 'middle', size: 26 * u, arrow: true }).svg;
    return out + k.slideBadge();
  },

  /** Photo card on top, tear-off calendar block with the date underneath. */
  countdown_datecard(ctx, k) {
    const { W, H, u, pad, c, s } = ctx;
    const boxX = pad;
    const boxY = H * 0.58;
    const boxW = W * 0.3;
    const boxH = H * 0.3;
    let out = bg(ctx) + k.photo(pad, pad, W - pad * 2, H * 0.47, 'round', { r: 30 * u });
    out += k.brand(pad * 1.6, pad * 1.55, { height: 46 * u });
    // calendar block
    out += rect(boxX + 8 * u, boxY + 10 * u, boxW, boxH, c.line, { r: 22 * u, opacity: 0.6 });
    out += rect(boxX, boxY, boxW, boxH, c.accent, { r: 22 * u });
    out += rect(boxX, boxY, boxW, boxH * 0.2, c.ink, { r: 22 * u, opacity: 0.2 });
    out += circle(boxX + boxW * 0.28, boxY + boxH * 0.1, 7 * u, c.ground) + circle(boxX + boxW * 0.72, boxY + boxH * 0.1, 7 * u, c.ground);
    const sf = fit(s.stat || '—', { w: boxW * 0.84, h: boxH * 0.5, max: 130 * u, min: 24, weight: 900, maxLines: 2, lh: 0.95 });
    out += textBlock(sf.lines, boxX + boxW / 2, boxY + boxH * 0.26 + (boxH * 0.5 - sf.h) / 2, { size: sf.size, weight: 900, fill: c.onAccent, anchor: 'middle', font: ctx.headFont, lh: sf.lh });
    if (s.statLabel) {
      const lf = fit(s.statLabel, { w: boxW * 0.84, h: boxH * 0.2, max: 22 * u, min: 12, weight: 700, maxLines: 2, upper: true, ls: 2 });
      out += textBlock(lf.lines, boxX + boxW / 2, boxY + boxH * 0.8, { size: lf.size, weight: 700, fill: c.onAccent, anchor: 'middle', font: ctx.headFont, ls: 2, lh: lf.lh });
    }
    const tx = boxX + boxW + 40 * u;
    const tw = W - tx - pad;
    let y = boxY;
    if (s.eyebrow) {
      const e = fit(s.eyebrow, { w: tw, h: 36 * u, max: 24 * u, min: 13, weight: 800, maxLines: 1, upper: true, ls: 3 });
      out += textBlock(e.lines, tx, y, { size: e.size, weight: 800, fill: c.accent, font: ctx.headFont, ls: 3 });
      y += e.h + 14 * u;
    }
    const hl = k.headline(tx, y, { w: tw, h: H * 0.16, max: 58 * u, maxLines: 3 });
    out += hl.svg;
    y += hl.h + 16 * u;
    const sp = k.para(s.subhead, tx, y, { w: tw, h: H * 0.1, max: 28 * u, maxLines: 3 });
    out += sp.svg;
    if (s.closing) out += k.one([s.closing], tx, boxY + boxH - 36 * u, { size: Math.round(26 * u), weight: 800, fill: c.accent, font: ctx.headFont });
    return out + k.slideBadge();
  },

  /** Timeline of what's coming, date up top, round photo in the corner. */
  countdown_agenda(ctx, k) {
    const { W, H, u, pad, c, s } = ctx;
    const r = W * 0.15;
    let out = bg(ctx) + circle(W - pad - r + 26 * u, pad + r + 20 * u, r, c.accent, { opacity: 0.9 });
    out += k.photo(W - pad - r * 2, pad, r * 2, r * 2, 'circle');
    out += k.brand(pad, pad, { height: 46 * u });
    let y = pad + 88 * u;
    if (s.eyebrow) {
      const p = k.pill(pad, y, s.eyebrow, { fill: c.accent, color: c.onAccent, size: 24 * u, upper: true, ls: 2 });
      out += p.svg;
      y += p.h + 24 * u;
    }
    const hl = k.headline(pad, y, { w: W * 0.58, h: H * 0.2, max: 62 * u, maxLines: 3 });
    out += hl.svg;
    y += hl.h + 14 * u;
    const sp = k.para(s.subhead, pad, y, { w: W * 0.58, h: H * 0.08, max: 26 * u, maxLines: 2 });
    out += sp.svg;
    y = Math.max(y + sp.h + 34 * u, H * 0.47);
    const rows = s.pillars.length ? s.pillars : [];
    const rowH = Math.min(H * 0.17, (H - y - pad - (s.closing ? 80 * u : 0)) / Math.max(1, rows.length));
    const lx = pad + 20 * u;
    if (rows.length) out += line(lx, y + 14 * u, lx, y + rowH * (rows.length - 1) + 14 * u, c.line, 4 * u);
    rows.forEach((p, i) => {
      const ry = y + i * rowH;
      out += circle(lx, ry + 14 * u, 20 * u, c.ground, { stroke: c.accent, sw: 5 * u });
      out += k.icon(p.icon, lx - 11 * u, ry + 3 * u, 22 * u, c.accent);
      out += k.one([p.title], lx + 52 * u, ry - 4 * u, { size: Math.round(31 * u), weight: 800, fill: c.ink, font: ctx.headFont });
      out += k.para(p.text, lx + 52 * u, ry + 36 * u, { w: W - lx - 52 * u - pad, h: rowH - 40 * u, max: 24 * u, maxLines: 2 }).svg;
    });
    if (s.closing) out += k.pill(pad, H - pad - 52 * u, s.closing, { fill: c.ink, color: c.ground, size: 24 * u, arrow: true }).svg;
    return out + k.slideBadge();
  },

  // ═════════════════════════════════════════════════════════════ LAUNCH
  /** Framed "device" photo with a NEW burst and three feature cards. */
  launch_feature_hero(ctx, k) {
    const { W, H, u, pad, c, s } = ctx;
    const px = W * 0.47;
    const py = pad * 1.2;
    const pw = W - px - pad;
    const ph = H * 0.5;
    let out = bg(ctx) + circle(W * 0.9, H * 0.12, W * 0.28, c.accent, { opacity: 0.12 });
    out += rect(px + 20 * u, py + 20 * u, pw, ph, c.accent, { r: 38 * u, opacity: 0.9 });
    out += k.photo(px, py, pw, ph, 'round', { r: 38 * u, stroke: c.ink, sw: 8 * u });
    out += `<polygon points="${burstPath(px + 10 * u, py + ph * 0.16, 62 * u, 50 * u, 14)}" fill="${c.accent}"/>`;
    out += k.one(['NEW'], px + 10 * u, py + ph * 0.16 - 20 * u, { size: Math.round(32 * u), weight: 900, fill: c.onAccent, anchor: 'middle', font: ctx.headFont });
    out += k.brand(pad, pad, { height: 46 * u });
    let y = pad + 96 * u;
    if (s.eyebrow) {
      const e = fit(s.eyebrow, { w: W * 0.38, h: 36 * u, max: 24 * u, min: 13, weight: 800, maxLines: 1, upper: true, ls: 3 });
      out += textBlock(e.lines, pad, y, { size: e.size, weight: 800, fill: c.accent, font: ctx.headFont, ls: 3 });
      y += e.h + 16 * u;
    }
    const hl = k.headline(pad, y, { w: W * 0.4, h: H * 0.26, max: 64 * u, maxLines: 4 });
    out += hl.svg;
    y += hl.h + 14 * u;
    out += k.para(s.subhead, pad, y, { w: W * 0.4, h: H * 0.12, max: 25 * u, maxLines: 3 }).svg;
    const cardsY = H * 0.7;
    const n = Math.max(1, s.pillars.length);
    const gap = 22 * u;
    const cw = (W - pad * 2 - gap * (n - 1)) / n;
    const ch = H - cardsY - pad - (s.closing ? 0 : 0);
    s.pillars.forEach((p, i) => {
      const x = pad + i * (cw + gap);
      out += rect(x, cardsY, cw, ch, c.soft, { r: 24 * u, stroke: c.line, sw: 2 });
      out += circle(x + 40 * u, cardsY + 44 * u, 26 * u, c.accent, { opacity: 0.18 });
      out += k.icon(p.icon, x + 26 * u, cardsY + 30 * u, 28 * u, c.accent);
      out += k.one([p.title], x + 24 * u, cardsY + 84 * u, { maxW: cw - 44 * u, size: Math.round(27 * u), weight: 800, fill: c.ink, font: ctx.headFont });
      out += k.para(p.text, x + 24 * u, cardsY + 124 * u, { w: cw - 48 * u, h: ch - 140 * u, max: 21 * u, maxLines: 3 }).svg;
    });
    return out + k.slideBadge();
  },

  /** Single centred claim lit by a spotlight cone. */
  launch_spotlight(ctx, k) {
    const { W, H, u, pad, c, s } = ctx;
    const cx = W / 2;
    const gid = k.id('cone');
    ctx.defs.push(`<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.accent}" stop-opacity="0.5"/><stop offset="1" stop-color="${c.accent}" stop-opacity="0"/></linearGradient>`);
    let out = bg(ctx) + k.fullPhoto(0.78) + `<polygon points="${cx - 90 * u},0 ${cx + 90 * u},0 ${cx + W * 0.42},${H * 0.62} ${cx - W * 0.42},${H * 0.62}" fill="url(#${gid})"/>`;
    out += k.brand(cx, pad * 0.75, { anchor: 'middle' });
    let y = H * 0.24;
    if (s.eyebrow) {
      const p = k.pill(cx, y, s.eyebrow, { fill: c.accent, color: c.onAccent, anchor: 'middle', size: 24 * u, upper: true, ls: 3 });
      out += p.svg;
      y += p.h + 34 * u;
    }
    const hl = k.headline(cx, y, { w: W - pad * 2.6, h: H * 0.3, max: 96 * u, maxLines: 3, anchor: 'middle' });
    out += hl.svg;
    y += hl.h + 22 * u;
    const sp = k.para(s.subhead, cx, y, { w: W * 0.72, h: H * 0.12, max: 30 * u, maxLines: 3, anchor: 'middle', fill: c.ink });
    out += sp.svg;
    y += sp.h + 36 * u;
    if (s.closing) out += k.pill(cx, y, s.closing, { fill: c.ink, color: c.ground, anchor: 'middle', size: 28 * u, arrow: true }).svg;
    return out + k.slideBadge();
  },

  /** Magazine spread: arch photo, big headline, why-it-matters card. */
  launch_dossier(ctx, k) {
    const { W, H, u, pad, c, s } = ctx;
    const ax = pad;
    const ay = pad * 1.3;
    const aw = W * 0.4;
    const ah = H - ay - pad * 1.5;
    let out = bg(ctx) + circle(ax + aw * 0.85, ay + ah * 0.1, aw * 0.5, c.accent, { opacity: 0.18 });
    out += k.photo(ax, ay, aw, ah, 'arch');
    const tx = W * 0.5;
    const tw = W - tx - pad;
    out += k.brand(tx, pad, { height: 44 * u });
    let y = ay + 70 * u;
    if (s.eyebrow) {
      out += line(tx, y + 12 * u, tx + 46 * u, y + 12 * u, c.accent, 4 * u);
      const e = fit(s.eyebrow, { w: tw - 70 * u, h: 36 * u, max: 22 * u, min: 12, weight: 800, maxLines: 1, upper: true, ls: 3 });
      out += textBlock(e.lines, tx + 62 * u, y, { size: e.size, weight: 800, fill: c.accent, font: ctx.headFont, ls: 3 });
      y += 52 * u;
    }
    const hl = k.headline(tx, y, { w: tw, h: H * 0.27, max: 62 * u, maxLines: 4 });
    out += hl.svg;
    y += hl.h + 16 * u;
    const sp = k.para(s.subhead, tx, y, { w: tw, h: H * 0.12, max: 24 * u, maxLines: 4 });
    out += sp.svg;
    y += sp.h + 28 * u;
    if (s.stat) {
      const sf = fit(s.stat, { w: tw * 0.5, h: 90 * u, max: 84 * u, min: 24, weight: 900, maxLines: 1, lh: 1, cw: 0.8 });
      out += textBlock(sf.lines, tx, y, { size: sf.size, weight: 900, fill: c.accent, font: ctx.headFont, lh: 1 });
      if (s.statLabel) out += k.para(s.statLabel, tx + sf.lines.join('').length * sf.size * 0.58 + 20 * u, y + 10 * u, { w: tw * 0.4, h: 60 * u, max: 20 * u, maxLines: 2 }).svg;
      y += sf.h + 22 * u;
    }
    const cardH = Math.min(260 * u, Math.max(120 * u, H - y - pad * 1.5));
    out += rect(tx, y, tw, cardH, c.soft, { r: 22 * u, stroke: c.line, sw: 2 }) + rect(tx, y, 10 * u, cardH, c.accent, { r: 5 * u });
    out += k.one([s.calloutTitle || s.closing || ''], tx + 34 * u, y + 24 * u, { size: Math.round(27 * u), weight: 800, fill: c.ink, font: ctx.headFont });
    out += k.para(s.calloutBody, tx + 34 * u, y + 66 * u, { w: tw - 60 * u, h: cardH - 80 * u, max: 21 * u, maxLines: 4 }).svg;
    return out + k.slideBadge();
  },

  // ═════════════════════════════════════════════════════════════ UPDATE
  /** Release header, then three shipped changes as a clean list. */
  update_changelog(ctx, k) {
    const { W, H, u, pad, c, s } = ctx;
    let out = bg(ctx) + k.photo(W - pad - W * 0.26, pad, W * 0.26, W * 0.26, 'round', { r: 28 * u });
    out += k.brand(pad, pad, { height: 46 * u });
    let y = pad + 96 * u;
    if (s.eyebrow) {
      const p = k.pill(pad, y, s.eyebrow, { fill: c.accent, color: c.onAccent, size: 24 * u, upper: true, ls: 2 });
      out += p.svg;
      y += p.h + 24 * u;
    }
    const hl = k.headline(pad, y, { w: W * 0.6, h: H * 0.2, max: 60 * u, maxLines: 3 });
    out += hl.svg;
    y = Math.max(y + hl.h + 24 * u, pad + W * 0.26 + 30 * u);
    const sp = k.para(s.subhead, pad, y - 10 * u, { w: W - pad * 2, h: 70 * u, max: 24 * u, maxLines: 2 });
    out += sp.svg;
    y += sp.h + 14 * u;
    const rows = s.pillars;
    const footerH = s.footer ? 54 * u : 0;
    const rowH = Math.min(150 * u, (H - y - pad - footerH) / Math.max(1, rows.length));
    rows.forEach((p, i) => {
      const ry = y + i * rowH;
      out += line(pad, ry, W - pad, ry, c.line, 2);
      out += circle(pad + 30 * u, ry + rowH / 2, 28 * u, c.accent, { opacity: 0.16 });
      out += k.icon(p.icon, pad + 16 * u, ry + rowH / 2 - 14 * u, 28 * u, c.accent);
      out += k.one([p.title], pad + 84 * u, ry + rowH * 0.5 - 38 * u, { size: Math.round(30 * u), weight: 800, fill: c.ink, font: ctx.headFont });
      out += k.para(p.text, pad + 84 * u, ry + rowH * 0.5 + 2 * u, { w: W - pad * 2 - 100 * u, h: rowH * 0.45, max: 23 * u, maxLines: 2 }).svg;
    });
    if (rows.length) out += line(pad, y + rows.length * rowH, W - pad, y + rows.length * rowH, c.line, 2);
    if (s.footer) out += k.one([s.footer], pad, H - pad - 26 * u, { size: Math.round(21 * u), weight: 700, fill: c.accent, font: ctx.headFont });
    return out + k.slideBadge();
  },

  /** Terminal-style ledger of changes beside a full-height photo column. */
  update_ledger(ctx, k) {
    const { W, H, u, pad, c, s } = ctx;
    const colW = W * 0.34;
    let out = bg(ctx) + k.photo(0, 0, colW, H, 'rect');
    out += rect(colW - 6 * u, 0, 6 * u, H, c.accent);
    out += k.brand(pad * 0.7, pad * 0.7, { height: 42 * u });
    const tx = colW + pad * 0.9;
    const tw = W - tx - pad;
    let y = pad;
    out += k.one(['CHANGELOG'], tx, y, { size: Math.round(20 * u), weight: 700, fill: c.muted, font: MONO, ls: 4 });
    y += 40 * u;
    if (s.eyebrow) {
      out += k.one([`$ ${s.eyebrow.toLowerCase()}`], tx, y, { size: Math.round(24 * u), weight: 700, fill: c.accent, font: MONO });
      y += 44 * u;
    }
    const hl = k.headline(tx, y, { w: tw, h: H * 0.2, max: 56 * u, maxLines: 3 });
    out += hl.svg;
    y += hl.h + 28 * u;
    const marks = ['+', '~', '↑'];
    const rows = s.pillars;
    const footerH = s.footer ? 50 * u : 0;
    const rowH = Math.min(190 * u, (H - y - pad - footerH) / Math.max(1, rows.length));
    rows.forEach((p, i) => {
      const ry = y + i * rowH;
      out += rect(tx, ry + 4 * u, 52 * u, 52 * u, c.accent, { r: 10 * u, opacity: 0.18 });
      out += k.one([marks[i] || '+'], tx + 26 * u, ry + 10 * u, { size: Math.round(38 * u), weight: 800, fill: c.accent, anchor: 'middle', font: MONO });
      out += k.one([p.title], tx + 76 * u, ry, { size: Math.round(28 * u), weight: 800, fill: c.ink, font: MONO });
      out += k.para(p.text, tx + 76 * u, ry + 40 * u, { w: tw - 80 * u, h: rowH - 56 * u, max: 21 * u, maxLines: 3 }).svg;
      if (i < rows.length - 1) out += line(tx, ry + rowH - 16 * u, W - pad, ry + rowH - 16 * u, c.line, 2, { dash: '8 8' });
    });
    if (s.footer) out += k.one([s.footer], tx, H - pad - 24 * u, { size: Math.round(20 * u), weight: 600, fill: c.muted, font: MONO });
    return out + k.slideBadge();
  },

  /** One notable change: ribbon tag, offset photo card, big statement. */
  update_headline(ctx, k) {
    const { W, H, u, pad, c, s } = ctx;
    const px = W * 0.44;
    const py = H * 0.2;
    const pw = W - px - pad;
    const ph = H * 0.56;
    let out = bg(ctx);
    out += rect(px - 22 * u, py + 22 * u, pw, ph, c.accent, { r: 30 * u });
    out += k.photo(px, py, pw, ph, 'round', { r: 30 * u });
    const label = s.eyebrow || "WHAT'S NEW";
    const lw = Math.max(280 * u, label.length * 25 * u + 120 * u);
    out += `<polygon points="0,${pad * 0.9} ${lw},${pad * 0.9} ${lw - 28 * u},${pad * 0.9 + 38 * u} ${lw},${pad * 0.9 + 76 * u} 0,${pad * 0.9 + 76 * u}" fill="${c.accent}"/>`;
    out += k.one([label.toUpperCase()], pad, pad * 0.9 + 22 * u, { size: Math.round(27 * u), weight: 900, fill: c.onAccent, font: ctx.headFont, ls: 3 });
    out += k.brand(W - pad, pad * 0.8, { anchor: 'end', height: 46 * u });
    const hl = k.headline(pad, H * 0.27, { w: W * 0.34, h: H * 0.36, max: 70 * u, maxLines: 5 });
    out += hl.svg;
    const sp = k.para(s.subhead, pad, H * 0.27 + hl.h + 20 * u, { w: W * 0.37, h: H * 0.16, max: 25 * u, maxLines: 4 });
    out += sp.svg;
    out += rect(pad, H - pad * 1.5, W * 0.2, 6 * u, c.accent, { r: 3 * u });
    if (s.closing) out += k.one([`${s.closing} →`], pad, H - pad * 1.5 + 26 * u, { size: Math.round(26 * u), weight: 800, fill: c.ink, font: ctx.headFont });
    return out + k.slideBadge();
  },

  // ═════════════════════════════════════════════════════════════ ANNOUNCEMENT
  /** News banner band, wide photo, overlapping statement card. */
  announce_banner(ctx, k) {
    const { W, H, u, pad, c, s } = ctx;
    const bandH = H * 0.15;
    let out = bg(ctx) + k.photo(0, bandH, W, H * 0.48, 'rect');
    out += rect(0, 0, W, bandH, c.accent);
    out += k.icon('spark', pad, bandH / 2 - 22 * u, 44 * u, c.onAccent);
    out += k.one([(s.eyebrow || 'Announcement').toUpperCase()], pad + 66 * u, bandH / 2 - 17 * u, { size: Math.round(32 * u), weight: 900, fill: c.onAccent, font: ctx.headFont, ls: 4 });
    out += k.brand(W - pad, bandH / 2 - 24 * u, { anchor: 'end', color: c.onAccent, height: 48 * u });
    const cx = pad;
    const cw = W - pad * 2;
    const ch = Math.min(H - H * 0.5 - pad, 360 * u);
    const cy = H - pad - ch;
    out += rect(cx + 12 * u, cy + 12 * u, cw, ch, c.ink, { r: 26 * u, opacity: 0.18 });
    out += rect(cx, cy, cw, ch, c.ground, { r: 26 * u, stroke: c.line, sw: 2 });
    out += rect(cx, cy + 36 * u, 10 * u, 90 * u, c.accent, { r: 5 * u });
    const hl = k.headline(cx + 44 * u, cy + 34 * u, { w: cw - 88 * u, h: ch * 0.46, max: 64 * u, maxLines: 3 });
    out += hl.svg;
    const sp = k.para(s.subhead, cx + 44 * u, cy + 34 * u + hl.h + 14 * u, { w: cw - 88 * u, h: ch * 0.2, max: 25 * u, maxLines: 2 });
    out += sp.svg;
    if (s.closing) out += k.pill(cx + 44 * u, cy + ch - 24 * u - 54 * u, s.closing, { fill: c.ink, color: c.ground, size: 23 * u, arrow: true }).svg;
    return out + k.slideBadge();
  },

  /** Ceremonial full-bleed: double frame, corner marks, centred news. */
  announce_stage(ctx, k) {
    const { W, H, u, pad, c, s } = ctx;
    const cx = W / 2;
    const m1 = pad * 0.7;
    const m2 = m1 + 14 * u;
    let out = bg(ctx) + k.fullPhoto(0.8);
    out += rect(m1, m1, W - m1 * 2, H - m1 * 2, 'none', { stroke: c.accent, sw: 3 * u });
    out += rect(m2, m2, W - m2 * 2, H - m2 * 2, 'none', { stroke: c.ink, sw: 1.5 * u, opacity: 0.4 });
    for (const [x, y] of [[m1, m1], [W - m1, m1], [m1, H - m1], [W - m1, H - m1]] as const) out += rect(x - 9 * u, y - 9 * u, 18 * u, 18 * u, c.accent);
    out += k.brand(cx, m2 + 28 * u, { anchor: 'middle' });
    let y = H * 0.27;
    if (s.eyebrow) {
      const e = fit(s.eyebrow, { w: W * 0.5, h: 36 * u, max: 26 * u, min: 13, weight: 800, maxLines: 1, upper: true, ls: 6 });
      const ew = e.lines.join('').length * (e.size * 0.66 + 6);
      out += line(cx - ew / 2 - 70 * u, y + 14 * u, cx - ew / 2 - 20 * u, y + 14 * u, c.accent, 3 * u) + line(cx + ew / 2 + 20 * u, y + 14 * u, cx + ew / 2 + 70 * u, y + 14 * u, c.accent, 3 * u);
      out += textBlock(e.lines, cx, y, { size: e.size, weight: 800, fill: c.accent, anchor: 'middle', font: ctx.headFont, ls: 6 });
      y += 70 * u;
    }
    const hl = k.headline(cx, y, { w: W - pad * 3.2, h: H * 0.32, max: 92 * u, maxLines: 4, anchor: 'middle', font: SERIF });
    out += hl.svg;
    y += hl.h + 28 * u;
    out += `<polygon points="${cx},${y - 9 * u} ${cx + 9 * u},${y} ${cx},${y + 9 * u} ${cx - 9 * u},${y}" fill="${c.accent}"/>` + line(cx - 110 * u, y, cx - 26 * u, y, c.accent, 2 * u) + line(cx + 26 * u, y, cx + 110 * u, y, c.accent, 2 * u);
    y += 34 * u;
    out += k.para(s.subhead, cx, y, { w: W * 0.62, h: H * 0.14, max: 28 * u, maxLines: 3, anchor: 'middle', fill: c.ink }).svg;
    if (s.closing) out += k.one([s.closing.toUpperCase()], cx, H - m2 - 80 * u, { size: Math.round(22 * u), weight: 800, fill: c.accent, anchor: 'middle', font: ctx.headFont, ls: 5 });
    return out + k.slideBadge();
  },

  /** NEWS tag + statement beside a round photo, with a context quote strip. */
  announce_brief(ctx, k) {
    const { W, H, u, pad, c, s } = ctx;
    const r = W * 0.22;
    const pcx = W - pad - r;
    const pcy = H * 0.3;
    let out = bg(ctx) + circle(pcx + 22 * u, pcy + 22 * u, r, c.accent) + k.photo(pcx - r, pcy - r, r * 2, r * 2, 'circle');
    out += k.brand(pad, pad, { height: 46 * u });
    let y = pad + 90 * u;
    const tag = k.pill(pad, y, s.eyebrow || 'News', { fill: c.accent, color: c.onAccent, size: 24 * u, upper: true, ls: 3 });
    out += tag.svg;
    y += tag.h + 28 * u;
    const hl = k.headline(pad, y, { w: W * 0.45, h: H * 0.3, max: 64 * u, maxLines: 5 });
    out += hl.svg;
    y += hl.h + 16 * u;
    out += k.para(s.subhead, pad, y, { w: W * 0.45, h: H * 0.13, max: 24 * u, maxLines: 3 }).svg;
    const qy = H * 0.7;
    const qh = H - qy - pad * (s.footer ? 1.9 : 1);
    out += rect(pad, qy, W - pad * 2, qh, c.soft, { r: 22 * u });
    out += rect(pad, qy, 10 * u, qh, c.accent, { r: 5 * u });
    out += k.one(['“'], pad + 34 * u, qy - 4 * u, { size: Math.round(120 * u), weight: 800, fill: c.accent, font: SERIF });
    out += k.one([s.calloutTitle], pad + 120 * u, qy + 22 * u, { size: Math.round(29 * u), weight: 800, fill: c.ink, font: ctx.headFont });
    out += k.para(s.calloutBody, pad + 120 * u, qy + 66 * u, { w: W - pad * 2 - 150 * u, h: qh - 80 * u, max: 23 * u, maxLines: 3 }).svg;
    if (s.footer) out += k.one([s.footer], pad, H - pad - 22 * u, { size: Math.round(20 * u), weight: 700, fill: c.muted, font: ctx.headFont, ls: 1 });
    return out + k.slideBadge();
  },

  // ═════════════════════════════════════════════════════════════ AESTHETIC
  /** The photograph is the post: a whisper of lowercase type. */
  aesthetic_whisper(ctx, k) {
    const { W, H, u, pad, c, s } = ctx;
    const cx = W / 2;
    let out = bg(ctx) + k.fullPhoto(0.42, { bottomHeavy: true });
    out += k.brand(cx, pad * 0.8, { anchor: 'middle', height: 50 * u });
    const hl = k.headline(cx, H * 0.7, { w: W - pad * 3, h: H * 0.16, max: 64 * u, weight: 300, maxLines: 2, anchor: 'middle', ls: 5 * u, accentFill: c.ink, font: SERIF });
    out += line(cx - 30 * u, H * 0.7 - 30 * u, cx + 30 * u, H * 0.7 - 30 * u, c.ink, 2, { opacity: 0.7 });
    out += hl.svg;
    if (s.closing) out += k.one([s.closing.toLowerCase()], cx, H * 0.7 + hl.h + 26 * u, { size: Math.round(26 * u), weight: 400, fill: c.ink, anchor: 'middle', font: SCRIPT, italic: true, opacity: 0.85 });
    return out + k.slideBadge();
  },

  /** Taped polaroid on a soft ground with a handwritten caption. */
  aesthetic_frame(ctx, k) {
    const { W, H, u, pad, c, s } = ctx;
    const pw = W * 0.6;
    const ph = H * 0.76;
    const px = W * 0.12;
    const py = H * 0.1;
    const cxp = px + pw / 2;
    const cyp = py + ph / 2;
    let out = bg(ctx, c.soft);
    out += circle(W * 0.86, H * 0.2, W * 0.1, c.accent, { opacity: 0.35 });
    out += `<g transform="rotate(-4 ${cxp} ${cyp})">`;
    out += rect(px + 14 * u, py + 18 * u, pw, ph, '#000000', { r: 6 * u, opacity: 0.18 });
    out += rect(px, py, pw, ph, '#FBFAF7', { r: 6 * u });
    out += k.photo(px + pw * 0.06, py + pw * 0.06, pw * 0.88, ph * 0.72, 'rect', { grade: 0.6 });
    const cap = fit(s.headline, { w: pw * 0.84, h: ph * 0.18, max: 52 * u, min: 22, weight: 600, maxLines: 2, lh: 1.05, cw: 0.44 });
    out += textBlock(cap.lines, cxp, py + pw * 0.06 + ph * 0.72 + (ph * 0.22 - cap.h) / 2 - 4 * u, { size: cap.size, weight: 600, fill: '#2B2622', anchor: 'middle', font: SCRIPT, lh: cap.lh, accent: s.accent, accentFill: c.accent });
    out += rect(cxp - 70 * u, py - 18 * u, 140 * u, 40 * u, c.accent, { opacity: 0.75 });
    out += '</g>';
    const sw = W - px - pw - pad * 0.5;
    if (s.subhead) out += `<g transform="rotate(3 ${W * 0.78} ${H * 0.62})">` + k.para(s.subhead, W * 0.74, H * 0.56, { w: W * 0.22, h: H * 0.26, max: 25 * u, maxLines: 6, fill: c.ink, font: SCRIPT, weight: 600 }).svg + '</g>';
    void sw;
    out += k.brand(W - pad, H - pad * 1.2, { anchor: 'end', height: 44 * u });
    if (s.closing) out += k.one([s.closing], W - pad, H - pad * 1.2 - 50 * u, { size: Math.round(24 * u), weight: 700, fill: c.accent, anchor: 'end', font: SCRIPT });
    return out + k.slideBadge();
  },

  /** Arch window photo, wide-spaced eyebrow and a soft sun. */
  aesthetic_band(ctx, k) {
    const { W, H, u, pad, c, s } = ctx;
    const ax = W * 0.46;
    const ay = H * 0.09;
    const aw = W * 0.44;
    const ah = H * 0.82;
    let out = bg(ctx) + circle(W * 0.3, H * 0.3, W * 0.09, c.accent, { opacity: 0.6 });
    out += `<path d="${archPath(ax - 16 * u, ay - 16 * u, aw + 32 * u, ah + 32 * u)}" fill="none" stroke="${c.accent}" stroke-width="${3 * u}"/>`;
    out += k.photo(ax, ay, aw, ah, 'arch');
    out += k.brand(pad, pad, { height: 44 * u });
    if (s.eyebrow) {
      out += line(pad, H * 0.45, pad + 40 * u, H * 0.45, c.accent, 3 * u);
      out += k.one([s.eyebrow.toUpperCase()], pad + 56 * u, H * 0.45 - 12 * u, { size: Math.round(20 * u), weight: 600, fill: c.muted, font: ctx.headFont, ls: 6 });
    }
    const hl = k.headline(pad, H * 0.5, { w: W * 0.36, h: H * 0.28, max: 66 * u, weight: 400, maxLines: 4, font: SERIF, accentFill: c.accent });
    out += hl.svg;
    out += k.para(s.subhead, pad, H * 0.5 + hl.h + 18 * u, { w: W * 0.34, h: H * 0.12, max: 22 * u, maxLines: 3 }).svg;
    if (s.closing) out += k.one([s.closing], pad, H - pad - 26 * u, { size: Math.round(24 * u), weight: 600, fill: c.accent, font: SCRIPT, italic: true });
    return out + k.slideBadge();
  },

  // ═════════════════════════════════════════════════════════════ MEME
  /** Modern caption-bar meme: setup above, photo, punchline below. */
  meme_setup_punch(ctx, k) {
    const { W, H, u, pad, c, s } = ctx;
    const barH = H * 0.2;
    let out = bg(ctx, '#FFFFFF') + k.photo(0, barH, W, H - barH * 2, 'rect', { grade: 0 });
    const top = fit(s.headline, { w: W - pad * 2, h: barH - 30 * u, max: 60 * u, weight: 800, maxLines: 3, lh: 1.08 });
    out += textBlock(top.lines, pad, (barH - top.h) / 2 - 2 * u, { size: top.size, weight: 800, fill: '#111111', font: 'Helvetica Neue,Helvetica,Arial,sans-serif', lh: top.lh });
    const punch = fit(s.subhead || s.headline, { w: W - pad * 2, h: barH - 30 * u, max: 56 * u, weight: 800, maxLines: 3, lh: 1.08 });
    out += rect(0, H - barH, W, barH, '#FFFFFF');
    out += textBlock(punch.lines, pad, H - barH + (barH - punch.h) / 2 - 2 * u, { size: punch.size, weight: 800, fill: '#111111', font: 'Helvetica Neue,Helvetica,Arial,sans-serif', lh: punch.lh });
    out += rect(0, H - barH - 6 * u, W, 6 * u, c.accent);
    out += k.brand(W - pad, barH + pad * 0.5, { anchor: 'end', height: 40 * u, color: '#FFFFFF' });
    return out + k.slideBadge();
  },

  /** Classic top/bottom lettering with a heavy outline, full-bleed photo. */
  meme_caption_band(ctx, k) {
    const { W, H, u, pad, s } = ctx;
    let out = bg(ctx, '#000000') + k.photo(0, 0, W, H, 'rect', { grade: 0 });
    const st = { weight: 900, font: IMPACT };
    const top = fit(s.headline, { w: W - pad * 1.6, h: H * 0.24, max: 110 * u, maxLines: 3, upper: true, lh: 1.02, ...st, cw: 0.56 });
    out += textBlock(top.lines, W / 2, pad * 0.55, { size: top.size, weight: 900, fill: '#FFFFFF', anchor: 'middle', font: IMPACT, lh: top.lh, stroke: '#000000', strokeW: top.size * 0.14 });
    const bottomText = s.subhead || '';
    if (bottomText) {
      const bot = fit(bottomText, { w: W - pad * 1.6, h: H * 0.24, max: 110 * u, maxLines: 3, upper: true, lh: 1.02, ...st, cw: 0.56 });
      out += textBlock(bot.lines, W / 2, H - pad * 0.55 - bot.h, { size: bot.size, weight: 900, fill: '#FFFFFF', anchor: 'middle', font: IMPACT, lh: bot.lh, stroke: '#000000', strokeW: bot.size * 0.14 });
    }
    out += k.brand(W - pad * 0.6, H * 0.5 - 20 * u, { anchor: 'end', height: 34 * u, color: '#FFFFFF' });
    return out + k.slideBadge();
  },

  /** Two stacked takes — rejected vs preferred — each with its own photo crop. */
  meme_split_takes(ctx, k) {
    const { W, H, u, pad, c, s } = ctx;
    const topH = H * 0.15;
    let out = bg(ctx);
    out += rect(0, 0, W, topH, c.accent);
    const probe = fit(s.headline, { w: W - pad * 2, h: topH - 24 * u, max: 50 * u, maxLines: 2 });
    const hl2 = k.headline(W / 2, (topH - probe.h) / 2, { w: W - pad * 2, h: topH - 24 * u, max: 50 * u, maxLines: 2, anchor: 'middle', fill: c.onAccent, accentFill: c.onAccent });
    out += hl2.svg;
    const rowH = (H - topH) / 2;
    const takes = [s.pillars[0], s.pillars[1]];
    takes.forEach((p, i) => {
      const y = topH + i * rowH;
      const good = i === 1;
      out += rect(0, y, W, rowH, good ? c.soft : c.ground);
      out += k.photo(0, y, W * 0.42, rowH, 'rect', { focusX: good ? 0.85 : 0.15, grade: good ? 1 : 0.4 });
      out += circle(W * 0.42, y + rowH / 2, 36 * u, good ? c.accent : c.muted);
      out += `<path d="${good ? `M${W * 0.42 - 14 * u},${y + rowH / 2 + 2 * u} l10,10 l18,-20` : `M${W * 0.42 - 12 * u},${y + rowH / 2 - 12 * u} l24,24 m0,-24 l-24,24`}" transform="${good ? `translate(${4 * u} 0)` : ''}" fill="none" stroke="${good ? c.onAccent : c.ground}" stroke-width="${6 * u}" stroke-linecap="round" stroke-linejoin="round"/>`;
      const tx = W * 0.42 + 62 * u;
      const tw = W - tx - pad;
      if (p) {
        out += k.one([p.title.toUpperCase()], tx, y + rowH * 0.2, { size: Math.round(24 * u), weight: 800, fill: good ? c.accent : c.muted, font: ctx.headFont, ls: 3 });
        const body = fit(p.text, { w: tw, h: rowH * 0.5, max: 44 * u, weight: 800, maxLines: 4, lh: 1.1 });
        out += textBlock(body.lines, tx, y + rowH * 0.2 + 42 * u, { size: body.size, weight: 800, fill: good ? c.ink : c.muted, font: ctx.headFont, lh: body.lh });
      }
      out += rect(0, y + rowH - 3, W, 3, c.line);
    });
    out += k.brand(W - pad, H - pad * 0.9, { anchor: 'end', height: 38 * u });
    return out + k.slideBadge();
  },

  // ═════════════════════════════════════════════════════════════ OFFER
  /** Sticker burst with the deal in the middle, tilted product photo. */
  offer_stage(ctx, k) {
    const { W, H, u, pad, c, s } = ctx;
    let out = bg(ctx, c.accent);
    out += circle(W * 0.9, H * 0.9, W * 0.3, c.ink, { opacity: 0.1 }) + circle(W * 0.05, H * 0.05, W * 0.2, c.ink, { opacity: 0.08 });
    out += `<g transform="rotate(5 ${W * 0.7} ${H * 0.3})">` + rect(W * 0.5, H * 0.08, W * 0.42, H * 0.42, c.ground, { r: 30 * u }) + k.photo(W * 0.5 + 12 * u, H * 0.08 + 12 * u, W * 0.42 - 24 * u, H * 0.42 - 24 * u, 'round', { r: 22 * u }) + '</g>';
    const hl = k.headline(pad, pad, { w: W * 0.5, h: H * 0.2, max: 70 * u, maxLines: 3, upper: true, fill: c.onAccent, accentFill: c.ground, weight: 900, ls: 1, cw: 0.6 });
    out += hl.svg;
    const bx = W * 0.3;
    const by = H * 0.68;
    const br = W * 0.22;
    out += `<polygon points="${burstPath(bx + 12 * u, by + 14 * u, br, br * 0.86, 22)}" fill="${c.ink}" opacity="0.25"/>`;
    out += `<polygon points="${burstPath(bx, by, br, br * 0.86, 22)}" fill="${c.ground}"/>`;
    const sf = fit(s.stat || '—', { w: br * 1.45, h: br * 0.9, max: br * 0.9, min: 24, weight: 900, maxLines: 1, lh: 1, cw: 0.8 });
    out += textBlock(sf.lines, bx, by - sf.h * 0.62, { size: sf.size, weight: 900, fill: c.accent, anchor: 'middle', font: ctx.headFont, lh: 1 });
    if (s.statLabel) {
      const lf = fit(s.statLabel, { w: br * 1.4, h: 60 * u, max: 26 * u, min: 12, weight: 800, maxLines: 2, upper: true, ls: 2 });
      out += textBlock(lf.lines, bx, by + sf.h * 0.36, { size: lf.size, weight: 800, fill: c.ink, anchor: 'middle', font: ctx.headFont, ls: 2, lh: lf.lh });
    }
    out += k.brand(pad, H - pad - 46 * u + 4 * u, { height: 44 * u, color: c.onAccent });
    if (s.closing) out += k.pill(W - pad, H * 0.74, s.closing, { fill: c.ink, color: c.ground, anchor: 'end', size: 32 * u, arrow: true }).svg;
    if (s.footer) out += k.para(s.footer, W - pad, H - pad - 44 * u, { w: W * 0.5, h: 60 * u, max: 20 * u, maxLines: 2, anchor: 'end', fill: c.onAccent }).svg;
    return out + k.slideBadge();
  },

  // ═════════════════════════════════════════════════════════════ INSIGHT
  /** A single quote: giant mark, serif statement, attribution with avatar. */
  insight_quote(ctx, k) {
    const { W, H, u, pad, c, s } = ctx;
    let out = bg(ctx);
    out += circle(W * 0.92, H * 0.08, W * 0.22, c.accent, { opacity: 0.12 });
    out += k.one(['“'], pad * 0.9, H * 0.05, { size: Math.round(300 * u), weight: 800, fill: c.accent, font: SERIF });
    const hl = k.headline(pad, H * 0.3, { w: W - pad * 2, h: H * 0.4, max: 74 * u, weight: 600, maxLines: 6, font: SERIF, lh: 1.18 });
    out += hl.svg;
    const ay = H - pad - 120 * u;
    out += line(pad, ay - 28 * u, pad + 90 * u, ay - 28 * u, c.accent, 5 * u);
    const r = 46 * u;
    out += k.photo(pad, ay, r * 2, r * 2, 'circle') + circle(pad + r, ay + r, r, 'none', { stroke: c.accent, sw: 4 * u });
    const nx = pad + r * 2 + 26 * u;
    const name = s.eyebrow || ctx.company;
    out += k.one([name], nx, ay + 8 * u, { size: Math.round(30 * u), weight: 800, fill: c.ink, font: ctx.headFont });
    out += k.para(s.subhead || s.closing, nx, ay + 52 * u, { w: W - nx - pad - 200 * u, h: 50 * u, max: 21 * u, maxLines: 1 }).svg;
    out += k.brand(W - pad, ay + r - 24 * u, { anchor: 'end', height: 48 * u });
    return out + k.slideBadge();
  },

  /** Big numerals 01–03 with a reason each. */
  insight_three_reasons(ctx, k) {
    const { W, H, u, pad, c, s } = ctx;
    const r = W * 0.1;
    let out = bg(ctx) + k.photo(W - pad - r * 2, pad, r * 2, r * 2, 'circle') + circle(W - pad - r, pad + r, r, 'none', { stroke: c.accent, sw: 5 * u });
    let y = pad;
    if (s.eyebrow) {
      const e = fit(s.eyebrow, { w: W * 0.6, h: 34 * u, max: 22 * u, min: 12, weight: 800, maxLines: 1, upper: true, ls: 3 });
      out += textBlock(e.lines, pad, y, { size: e.size, weight: 800, fill: c.accent, font: ctx.headFont, ls: 3 });
      y += 48 * u;
    }
    const hl = k.headline(pad, y, { w: W * 0.66, h: H * 0.22, max: 62 * u, maxLines: 3 });
    out += hl.svg;
    y = Math.max(y + hl.h + 34 * u, pad + r * 2 + 30 * u);
    const rows = s.pillars;
    const bottomPad = s.closing ? 100 * u : pad;
    const rowH = Math.min(210 * u, (H - y - bottomPad) / Math.max(1, rows.length));
    rows.forEach((p, i) => {
      const ry = y + i * rowH;
      out += line(pad, ry, W - pad, ry, c.line, 2);
      out += k.one([`0${i + 1}`], pad, ry + rowH * 0.12, { size: Math.round(Math.min(rowH * 0.62, 110 * u)), weight: 900, fill: i === 0 ? c.accent : c.ink, font: ctx.headFont, opacity: i === 0 ? 1 : 0.9 });
      const tx = pad + 170 * u;
      out += k.one([p.title], tx, ry + rowH * 0.14, { size: Math.round(32 * u), weight: 800, fill: c.ink, font: ctx.headFont });
      out += k.para(p.text, tx, ry + rowH * 0.14 + 46 * u, { w: W - tx - pad, h: rowH * 0.5, max: 24 * u, maxLines: 3 }).svg;
    });
    if (s.closing) out += k.one([s.closing], pad, H - pad - 30 * u, { size: Math.round(28 * u), weight: 800, fill: c.accent, font: ctx.headFont });
    return out + k.slideBadge();
  },

  /** Column essay: text left, tall photo with an offset frame right, pull-quote. */
  insight_column(ctx, k) {
    const { W, H, u, pad, c, s } = ctx;
    const px = W * 0.56;
    const py = pad * 1.3;
    const pw = W - px - pad;
    const ph = H - py - pad * 1.3;
    let out = bg(ctx) + rect(px - 22 * u, py + 22 * u, pw, ph, 'none', { stroke: c.accent, sw: 4 * u });
    out += k.photo(px, py, pw, ph, 'rect');
    const tw = W * 0.46;
    out += k.brand(pad, pad, { height: 44 * u });
    let y = pad + 90 * u;
    if (s.eyebrow) {
      out += rect(pad, y, 10 * u, 28 * u, c.accent);
      out += k.one([s.eyebrow.toUpperCase()], pad + 24 * u, y + 1 * u, { size: Math.round(21 * u), weight: 800, fill: c.accent, font: ctx.headFont, ls: 3 });
      y += 54 * u;
    }
    const hl = k.headline(pad, y, { w: tw, h: H * 0.3, max: 62 * u, maxLines: 5 });
    out += hl.svg;
    y += hl.h + 18 * u;
    const sp = k.para(s.subhead, pad, y, { w: tw, h: H * 0.14, max: 24 * u, maxLines: 4 });
    out += sp.svg;
    y += sp.h + 30 * u;
    if (s.calloutBody || s.calloutTitle) {
      const qh = Math.min(230 * u, Math.max(110 * u, H - y - pad * 1.3));
      out += rect(pad, y, tw, qh, c.soft, { r: 20 * u }) + rect(pad, y, 8 * u, qh, c.accent, { r: 4 * u });
      out += k.one([s.calloutTitle], pad + 28 * u, y + 18 * u, { size: Math.round(26 * u), weight: 800, fill: c.ink, font: SERIF, italic: true });
      out += k.para(s.calloutBody, pad + 28 * u, y + 58 * u, { w: tw - 50 * u, h: qh - 70 * u, max: 21 * u, maxLines: 4 }).svg;
    }
    return out + k.slideBadge();
  },

  // ═════════════════════════════════════════════════════════════ REPORT
  /** Report cover: giant stat + photo, headline, three findings in columns. */
  report_dossier(ctx, k) {
    const { W, H, u, pad, c, s } = ctx;
    let out = bg(ctx) + rect(0, 0, W, pad * 1.1 + 60 * u, c.soft);
    out += k.pill(pad, pad * 0.55, s.eyebrow || 'Report', { fill: c.accent, color: c.onAccent, size: 21 * u, upper: true, ls: 3 }).svg;
    out += k.brand(W - pad, pad * 0.5, { anchor: 'end', height: 44 * u });
    const y0 = pad * 1.1 + 90 * u;
    const sf = fit(s.stat || '—', { w: W * 0.46, h: H * 0.22, max: 250 * u, min: 40, weight: 900, maxLines: 1, lh: 1, cw: 0.8 });
    out += textBlock(sf.lines, pad, y0, { size: sf.size, weight: 900, fill: c.accent, font: ctx.headFont, lh: 1 });
    if (s.statLabel) out += k.para(s.statLabel, pad, y0 + sf.h + 6 * u, { w: W * 0.44, h: 80 * u, max: 26 * u, maxLines: 2, fill: c.ink, weight: 700 }).svg;
    out += k.photo(W * 0.54, y0 - 10 * u, W - W * 0.54 - pad, H * 0.32, 'round', { r: 26 * u });
    const hy = y0 + H * 0.32 + 40 * u;
    const hl = k.headline(pad, hy, { w: W - pad * 2, h: H * 0.16, max: 50 * u, maxLines: 2 });
    out += hl.svg;
    const cy = hy + hl.h + 26 * u;
    const n = Math.max(1, s.pillars.length);
    const gap = 26 * u;
    const cw = (W - pad * 2 - gap * (n - 1)) / n;
    s.pillars.forEach((p, i) => {
      const x = pad + i * (cw + gap);
      out += rect(x, cy, cw, 6 * u, c.accent, { r: 3 * u });
      out += k.icon(p.icon, x, cy + 22 * u, 34 * u, c.accent);
      out += k.one([p.title], x, cy + 70 * u, { maxW: cw, size: Math.round(25 * u), weight: 800, fill: c.ink, font: ctx.headFont });
      out += k.para(p.text, x, cy + 106 * u, { w: cw, h: H - cy - 106 * u - pad * (s.footer ? 1.6 : 0.8), max: 20 * u, maxLines: 4 }).svg;
    });
    if (s.footer) out += k.one([s.footer], pad, H - pad - 20 * u, { size: Math.round(18 * u), weight: 600, fill: c.muted, font: ctx.headFont });
    return out + k.slideBadge();
  },

  /** Accent headline band over a photo, then ranked findings with the stat. */
  report_topline(ctx, k) {
    const { W, H, u, pad, c, s } = ctx;
    const bandH = H * 0.4;
    let out = bg(ctx) + rect(0, 0, W, bandH, c.accent);
    out += k.photo(W * 0.6, 0, W * 0.4, bandH, 'rect', { grade: 1.4 });
    const gid = k.id('fade');
    ctx.defs.push(`<linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${c.accent}"/><stop offset="1" stop-color="${c.accent}" stop-opacity="0"/></linearGradient>`);
    out += `<rect x="${W * 0.5}" y="0" width="${W * 0.2}" height="${bandH}" fill="url(#${gid})"/>`;
    out += k.brand(pad, pad * 0.7, { height: 44 * u, color: c.onAccent });
    let y = pad * 0.7 + 78 * u;
    if (s.eyebrow) {
      out += k.one([s.eyebrow.toUpperCase()], pad, y, { size: Math.round(21 * u), weight: 800, fill: c.onAccent, font: ctx.headFont, ls: 4, opacity: 0.85 });
      y += 44 * u;
    }
    out += k.headline(pad, y, { w: W * 0.54, h: bandH - y - 30 * u, max: 60 * u, maxLines: 4, fill: c.onAccent, accentFill: c.onAccent }).svg;
    const sy = bandH + 36 * u;
    const sf = fit(s.stat || '—', { w: W * 0.34, h: 150 * u, max: 160 * u, min: 36, weight: 900, maxLines: 1, lh: 1, cw: 0.8 });
    out += textBlock(sf.lines, pad, sy, { size: sf.size, weight: 900, fill: c.accent, font: ctx.headFont, lh: 1 });
    if (s.statLabel) out += k.para(s.statLabel, pad, sy + sf.h + 4 * u, { w: W * 0.34, h: 90 * u, max: 23 * u, maxLines: 3, fill: c.ink, weight: 700 }).svg;
    const rx = W * 0.42;
    const rw = W - rx - pad;
    const rows = s.pillars;
    const rowH = Math.min(150 * u, (H - sy - pad - (s.footer ? 44 * u : 0)) / Math.max(1, rows.length));
    rows.forEach((p, i) => {
      const ry = sy + i * rowH;
      out += rect(rx, ry, rw, rowH - 14 * u, c.soft, { r: 18 * u });
      out += circle(rx + 38 * u, ry + (rowH - 14 * u) / 2, 24 * u, c.accent, { opacity: 0.18 });
      out += k.icon('check', rx + 24 * u, ry + (rowH - 14 * u) / 2 - 14 * u, 28 * u, c.accent);
      out += k.one([p.title], rx + 82 * u, ry + 14 * u, { size: Math.round(25 * u), weight: 800, fill: c.ink, font: ctx.headFont });
      out += k.para(p.text, rx + 82 * u, ry + 50 * u, { w: rw - 100 * u, h: rowH - 70 * u, max: 20 * u, maxLines: 2 }).svg;
    });
    if (s.footer) out += k.one([s.footer], pad, H - pad - 20 * u, { size: Math.round(18 * u), weight: 600, fill: c.muted, font: ctx.headFont });
    return out + k.slideBadge();
  },

  /** Stat column: the number owns the left, findings read down the right. */
  report_column(ctx, k) {
    const { W, H, u, pad, c, s } = ctx;
    const colW = W * 0.36;
    let out = bg(ctx) + rect(0, 0, colW, H, c.accent);
    out += k.photo(colW / 2 - W * 0.09, pad, W * 0.18, W * 0.18, 'circle') + circle(colW / 2, pad + W * 0.09, W * 0.09, 'none', { stroke: c.onAccent, sw: 4 * u });
    const sf = fit(s.stat || '—', { w: colW - pad, h: H * 0.2, max: 170 * u, min: 36, weight: 900, maxLines: 1, lh: 1, cw: 0.8 });
    out += textBlock(sf.lines, colW / 2, H * 0.42, { size: sf.size, weight: 900, fill: c.onAccent, anchor: 'middle', font: ctx.headFont, lh: 1 });
    if (s.statLabel) {
      const lf = fit(s.statLabel, { w: colW - pad * 1.2, h: 130 * u, max: 26 * u, min: 13, weight: 700, maxLines: 4, lh: 1.25 });
      out += textBlock(lf.lines, colW / 2, H * 0.42 + sf.h + 10 * u, { size: lf.size, weight: 700, fill: c.onAccent, anchor: 'middle', font: ctx.headFont, lh: lf.lh });
    }
    out += k.brand(colW / 2, H - pad - 44 * u, { anchor: 'middle', color: c.onAccent, height: 44 * u });
    const tx = colW + pad * 0.9;
    const tw = W - tx - pad;
    let y = pad;
    if (s.eyebrow) {
      out += k.one([s.eyebrow.toUpperCase()], tx, y, { size: Math.round(21 * u), weight: 800, fill: c.accent, font: ctx.headFont, ls: 4 });
      y += 48 * u;
    }
    const hl = k.headline(tx, y, { w: tw, h: H * 0.22, max: 56 * u, maxLines: 4 });
    out += hl.svg;
    y += hl.h + 14 * u;
    const sp = k.para(s.subhead, tx, y, { w: tw, h: H * 0.1, max: 23 * u, maxLines: 2 });
    out += sp.svg;
    y += sp.h + 26 * u;
    const rows = s.pillars;
    const rowH = Math.min(170 * u, (H - y - pad - (s.footer ? 40 * u : 0)) / Math.max(1, rows.length));
    rows.forEach((p, i) => {
      const ry = y + i * rowH;
      out += line(tx, ry, W - pad, ry, c.line, 2);
      out += k.icon(p.icon, tx, ry + 18 * u, 38 * u, c.accent);
      out += k.one([p.title], tx + 64 * u, ry + 14 * u, { size: Math.round(27 * u), weight: 800, fill: c.ink, font: ctx.headFont });
      out += k.para(p.text, tx + 64 * u, ry + 52 * u, { w: tw - 64 * u, h: rowH - 60 * u, max: 21 * u, maxLines: 3 }).svg;
    });
    if (s.footer) out += k.one([s.footer], tx, H - pad - 20 * u, { size: Math.round(18 * u), weight: 600, fill: c.muted, font: ctx.headFont });
    return out + k.slideBadge();
  },

  // ═════════════════════════════════════════════════════════════ FESTIVAL
  /** Full-bleed greeting with an ornamental frame and a serif wish. */
  festival_stage(ctx, k) {
    const { W, H, u, pad, c, s } = ctx;
    const cx = W / 2;
    const m = pad * 0.75;
    let out = bg(ctx) + k.fullPhoto(0.74);
    out += rect(m, m, W - m * 2, H - m * 2, 'none', { stroke: c.accent, sw: 3 * u });
    out += rect(m + 14 * u, m + 14 * u, W - (m + 14 * u) * 2, H - (m + 14 * u) * 2, 'none', { stroke: c.accent, sw: 1.5 * u, opacity: 0.55 });
    for (const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]] as const) {
      out += `<path d="M${x + sx * 70 * u},${y + sy * 14 * u} Q${x + sx * 14 * u},${y + sy * 14 * u} ${x + sx * 14 * u},${y + sy * 70 * u}" fill="none" stroke="${c.accent}" stroke-width="${3 * u}"/>`;
    }
    out += k.brand(cx, m + 40 * u, { anchor: 'middle' });
    let y = H * 0.28;
    if (s.eyebrow) {
      out += k.one([s.eyebrow.toUpperCase()], cx, y, { size: Math.round(26 * u), weight: 700, fill: c.accent, anchor: 'middle', font: ctx.headFont, ls: 8 });
      y += 66 * u;
    }
    const hl = k.headline(cx, y, { w: W - pad * 3.2, h: H * 0.34, max: 110 * u, maxLines: 3, anchor: 'middle', font: SERIF, weight: 700 });
    out += hl.svg;
    y += hl.h + 30 * u;
    out += line(cx - 140 * u, y, cx - 24 * u, y, c.accent, 2 * u) + `<polygon points="${cx},${y - 10 * u} ${cx + 10 * u},${y} ${cx},${y + 10 * u} ${cx - 10 * u},${y}" fill="${c.accent}"/>` + line(cx + 24 * u, y, cx + 140 * u, y, c.accent, 2 * u);
    y += 38 * u;
    out += k.para(s.subhead, cx, y, { w: W * 0.6, h: H * 0.14, max: 29 * u, maxLines: 3, anchor: 'middle', fill: c.ink }).svg;
    if (s.closing) out += k.one([s.closing], cx, H - m - 96 * u, { size: Math.round(40 * u), weight: 600, fill: c.accent, anchor: 'middle', font: SCRIPT });
    return out + k.slideBadge();
  },

  /** Greeting card: paper inset on a colour field, arch photo, centred wish. */
  festival_card(ctx, k) {
    const { W, H, u, pad, c, s } = ctx;
    const cx = W / 2;
    const m = pad * 0.8;
    let out = bg(ctx, c.accent) + dots(ctx, 0, 0, W, H, c.onAccent, 26, 0.18);
    out += rect(m, m, W - m * 2, H - m * 2, c.ground, { r: 22 * u });
    out += rect(m + 18 * u, m + 18 * u, W - (m + 18 * u) * 2, H - (m + 18 * u) * 2, 'none', { r: 14 * u, stroke: c.accent, sw: 2.5 * u });
    const aw = W * 0.4;
    const ah = H * 0.34;
    out += `<path d="${archPath(cx - aw / 2 - 12 * u, m + 52 * u - 12 * u, aw + 24 * u, ah + 12 * u)}" fill="none" stroke="${c.accent}" stroke-width="${3 * u}"/>`;
    out += k.photo(cx - aw / 2, m + 52 * u, aw, ah, 'arch');
    let y = m + 52 * u + ah + 34 * u;
    if (s.eyebrow) {
      out += k.one([s.eyebrow.toUpperCase()], cx, y, { size: Math.round(21 * u), weight: 700, fill: c.accent, anchor: 'middle', font: ctx.headFont, ls: 7 });
      y += 48 * u;
    }
    const hl = k.headline(cx, y, { w: W - m * 2 - 120 * u, h: H * 0.2, max: 84 * u, maxLines: 2, anchor: 'middle', font: SERIF, weight: 700 });
    out += hl.svg;
    y += hl.h + 14 * u;
    out += k.para(s.subhead, cx, y, { w: W * 0.58, h: H * 0.1, max: 25 * u, maxLines: 3, anchor: 'middle' }).svg;
    if (s.closing) out += k.one([s.closing], cx, H - m - 150 * u, { size: Math.round(38 * u), weight: 600, fill: c.accent, anchor: 'middle', font: SCRIPT });
    out += k.brand(cx, H - m - 88 * u, { anchor: 'middle', height: 36 * u });
    return out + k.slideBadge();
  },

  /** Colour block with stacked wish and confetti, photo across a wavy edge. */
  festival_editorial(ctx, k) {
    const { W, H, u, pad, c, s } = ctx;
    const edge = W * 0.52;
    let wave = `M0,0 H${edge}`;
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      const y1 = (H / steps) * i;
      const y2 = (H / steps) * (i + 1);
      wave += ` Q${edge + (i % 2 ? -34 : 34) * u},${(y1 + y2) / 2} ${edge},${y2}`;
    }
    wave += ' H0 Z';
    let out = bg(ctx) + k.photo(edge - 40 * u, 0, W - edge + 40 * u, H, 'rect', { focusX: 0.7 });
    out += `<path d="${wave}" fill="${c.accent}"/>` + dots(ctx, pad, pad, edge - pad * 1.6, H - pad * 2, c.onAccent, 22, 0.22);
    out += k.brand(pad, pad, { height: 44 * u, color: c.onAccent });
    let y = H * 0.2;
    if (s.eyebrow) {
      out += k.one([s.eyebrow.toUpperCase()], pad, y, { size: Math.round(21 * u), weight: 800, fill: c.onAccent, font: ctx.headFont, ls: 5, opacity: 0.9 });
      y += 50 * u;
    }
    const hl = k.headline(pad, y, { w: edge - pad * 1.5, h: H * 0.42, max: 110 * u, maxLines: 4, fill: c.onAccent, accentFill: c.ground, font: SERIF, weight: 800 });
    out += hl.svg;
    y += hl.h + 20 * u;
    out += k.para(s.subhead, pad, y, { w: edge - pad * 1.7, h: H * 0.16, max: 26 * u, maxLines: 3, fill: c.onAccent }).svg;
    if (s.closing) out += k.pill(pad, H - pad - 56 * u, s.closing, { fill: c.ground, color: c.accent, size: 25 * u }).svg;
    return out + k.slideBadge();
  },

  // ═════════════════════════════════════════════════════════════ CAROUSEL
  /** Cover with a giant numeral, promise headline and a swipe prompt. */
  carousel_numbered(ctx, k) {
    const { W, H, u, pad, c, s } = ctx;
    let out = bg(ctx);
    const ph = H * 0.44;
    out += k.photo(pad, H - ph - pad, W - pad * 2, ph, 'round', { r: 30 * u });
    out += k.brand(pad, pad, { height: 46 * u });
    if (s.eyebrow) out += k.pill(W - pad, pad + 4 * u, s.eyebrow, { fill: c.ink, color: c.ground, anchor: 'end', size: 21 * u, upper: true, ls: 2 }).svg;
    const num = s.stat || '';
    let y = pad + 96 * u;
    if (num) {
      const nf = fit(num, { w: W * 0.4, h: H * 0.22, max: 280 * u, min: 60, weight: 900, maxLines: 1, lh: 0.9 });
      out += textBlock(nf.lines, pad, y - 10 * u, { size: nf.size, weight: 900, fill: c.accent, font: ctx.headFont, lh: 0.9 });
      out += k.headline(pad + nf.lines.join('').length * nf.size * 0.62 + 26 * u, y + 14 * u, { w: W - pad * 2 - nf.lines.join('').length * nf.size * 0.62 - 26 * u, h: nf.h, max: 62 * u, maxLines: 3 }).svg;
      y += nf.h + 14 * u;
    } else {
      const hl = k.headline(pad, y, { w: W - pad * 2, h: H * 0.3, max: 88 * u, maxLines: 4 });
      out += hl.svg;
      y += hl.h + 14 * u;
    }
    out += k.para(s.subhead, pad, y, { w: W * 0.8, h: H * 0.1, max: 27 * u, maxLines: 2 }).svg;
    const sw = k.pill(W - pad * 1.6, H - ph - pad - 28 * u, s.closing || 'Swipe', { fill: c.accent, color: c.onAccent, anchor: 'end', size: 23 * u, arrow: true });
    out += sw.svg;
    for (let i = 0; i < 4; i++) out += circle(pad * 1.6 + i * 22 * u, H - ph - pad - 28 * u + sw.h / 2, (i === 0 ? 7 : 5) * u, i === 0 ? c.accent : c.line);
    return out + k.slideBadge();
  },

  /** Poster-weight cover on a colour field with a round photo and arrow. */
  carousel_bold(ctx, k) {
    const { W, H, u, pad, c, s } = ctx;
    let out = bg(ctx, c.accent) + dots(ctx, 0, 0, W, H, c.onAccent, 16, 0.12);
    out += k.brand(pad, pad, { height: 46 * u, color: c.onAccent });
    if (s.eyebrow) out += k.pill(W - pad, pad + 2 * u, s.eyebrow, { fill: c.ground, color: c.accent, anchor: 'end', size: 21 * u, upper: true, ls: 2 }).svg;
    const hl = k.headline(pad, H * 0.16, { w: W - pad * 2, h: H * 0.4, max: 130 * u, maxLines: 4, upper: true, fill: c.onAccent, accentFill: c.ground, weight: 900, lh: 1.02, cw: 0.66 });
    out += hl.svg;
    out += k.para(s.subhead, pad, H * 0.17 + hl.h + 18 * u, { w: W * 0.55, h: H * 0.12, max: 26 * u, maxLines: 3, fill: c.onAccent }).svg;
    const r = W * 0.15;
    out += circle(W - pad - r + 14 * u, H - pad - r + 14 * u, r, c.ground) + k.photo(W - pad - r * 2, H - pad - r * 2, r * 2, r * 2, 'circle');
    out += circle(pad + 44 * u, H - pad - 44 * u, 44 * u, c.ground);
    out += `<path d="M${pad + 24 * u} ${H - pad - 44 * u} h${40 * u} m-${14 * u} -${14 * u} l${14 * u} ${14 * u} l-${14 * u} ${14 * u}" fill="none" stroke="${c.accent}" stroke-width="${5 * u}" stroke-linecap="round" stroke-linejoin="round"/>`;
    if (s.closing) out += k.one([s.closing.toUpperCase()], pad + 110 * u, H - pad - 62 * u, { size: Math.round(26 * u), weight: 900, fill: c.onAccent, font: ctx.headFont, ls: 4 });
    return out + k.slideBadge();
  },

  /** Checklist cards: a promise headline and three tips with tick boxes. */
  carousel_column(ctx, k) {
    const { W, H, u, pad, c, s } = ctx;
    const r = W * 0.085;
    let out = bg(ctx) + k.photo(W - pad - r * 2, pad, r * 2, r * 2, 'circle') + circle(W - pad - r, pad + r, r, 'none', { stroke: c.accent, sw: 4 * u });
    out += k.brand(pad, pad, { height: 44 * u });
    let y = pad + 84 * u;
    if (s.eyebrow) {
      out += k.one([s.eyebrow.toUpperCase()], pad, y, { size: Math.round(21 * u), weight: 800, fill: c.accent, font: ctx.headFont, ls: 4 });
      y += 44 * u;
    }
    const hl = k.headline(pad, y, { w: W * 0.72, h: H * 0.22, max: 64 * u, maxLines: 3 });
    out += hl.svg;
    y = Math.max(y + hl.h + 30 * u, pad + r * 2 + 30 * u);
    const rows = s.pillars;
    const bottom = s.closing ? 96 * u : pad;
    const gap = 18 * u;
    const rowH = Math.min(160 * u, (H - y - bottom - gap * (rows.length - 1)) / Math.max(1, rows.length));
    rows.forEach((p, i) => {
      const ry = y + i * (rowH + gap);
      out += rect(pad, ry, W - pad * 2, rowH, c.soft, { r: 22 * u, stroke: c.line, sw: 2 });
      out += rect(pad + 26 * u, ry + 26 * u, 46 * u, 46 * u, c.accent, { r: 12 * u });
      out += `<path d="M${pad + 38 * u} ${ry + 50 * u} l9 9 l15 -17" fill="none" stroke="${c.onAccent}" stroke-width="${6 * u}" stroke-linecap="round" stroke-linejoin="round"/>`;
      out += k.one([p.title], pad + 100 * u, ry + 22 * u, { size: Math.round(30 * u), weight: 800, fill: c.ink, font: ctx.headFont });
      out += k.para(p.text, pad + 100 * u, ry + 64 * u, { w: W - pad * 2 - 126 * u, h: rowH - 76 * u, max: 22 * u, maxLines: 3 }).svg;
    });
    if (s.closing) out += k.pill(W - pad, H - pad - 54 * u, s.closing, { fill: c.accent, color: c.onAccent, anchor: 'end', size: 25 * u, arrow: true }).svg;
    return out + k.slideBadge();
  },
};

export function hasDesign(templateId: string): boolean {
  return Boolean(DESIGNS[templateId]);
}

export function listDesignIds(): string[] {
  return Object.keys(DESIGNS);
}

/** Compose a complete SVG for a design. Pure: no I/O. */
export function renderDesignSvg(opts: {
  templateId: string;
  width: number;
  height: number;
  artHref: string;
  logoHref?: string;
  companyName?: string | null;
  headingFont: string;
  bodyFont: string;
  spec: PosterSpec;
  palette: InsightPalette;
  slideLabel?: string | null;
}): string {
  const design = DESIGNS[opts.templateId];
  if (!design) throw new Error(`Unknown poster design: ${opts.templateId}`);
  const { width: W, height: H } = opts;
  const u = W / 1080;
  const ctx: DesignCtx = {
    W,
    H,
    u,
    pad: Math.round(Math.min(W, H) * 0.072),
    c: designColors(opts.palette),
    headFont: opts.headingFont,
    bodyFont: opts.bodyFont,
    artHref: opts.artHref,
    logoHref: opts.logoHref || '',
    company: (opts.companyName || '').trim(),
    s: cleanSpec(opts.spec),
    slideLabel: opts.slideLabel,
    uid: `d${Math.random().toString(36).slice(2, 7)}`,
    defs: [],
  };
  const body = design(ctx, makeKit(ctx));
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${ctx.defs.length ? `<defs>${ctx.defs.join('')}</defs>` : ''}
${body}
</svg>`;
}

/** Render a design and store it like every other poster. */
export async function writeDesignedPoster(opts: Parameters<typeof renderDesignSvg>[0] & { tenantId: string }): Promise<{ publicUrl: string; width: number; height: number }> {
  const svg = renderDesignSvg(opts);
  const dir = path.resolve(config.UPLOAD_DIR, opts.tenantId, 'social-images');
  fs.mkdirSync(dir, { recursive: true });
  const filename = `poster-${opts.width}x${opts.height}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.svg`;
  fs.writeFileSync(path.join(dir, filename), svg, 'utf8');
  return { publicUrl: `/uploads/${opts.tenantId}/social-images/${filename}`, width: opts.width, height: opts.height };
}

void fit;
