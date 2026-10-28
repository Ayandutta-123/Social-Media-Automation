import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { config } from '../config';
import { toPublicMediaUrl } from './public-media-url';
import { PLATFORM_ASPECT_LIMITS } from '../providers/images/social-frame';
import { resolveUploadPath } from '../providers/templates/brand-renderer';
import { resolveProviders } from '../services/providers.service';
import { uploadPlacidMedia } from '../providers/templates/placid.client';

/** Hosts Meta cannot reliably fetch (broken DNS / private). */
const UNREACHABLE_HOST_RE =
  /localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|storage\.placid\.app|(^https:\/\/(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.))/i;

/** True when Meta/LinkedIn servers can fetch this HTTPS URL themselves. */
export function isExternallyReachableHttps(url: string | null | undefined): boolean {
  const u = (url || '').trim();
  if (!/^https:\/\//i.test(u)) return false;
  if (UNREACHABLE_HOST_RE.test(u)) return false;
  return true;
}

export type PublishImageBytes = {
  buffer: Buffer;
  filename: string;
  mimetype: string;
};

/** Load a stored or remote image into memory for publishing. */
export async function loadImageBytesForPublish(
  url: string,
): Promise<PublishImageBytes | null> {
  const raw = (url || '').trim();
  if (!raw) return null;

  if (raw.startsWith('data:')) {
    const m = /^data:([^;]+);base64,(.+)$/i.exec(raw);
    if (!m) return null;
    const mimetype = m[1] || 'image/jpeg';
    const buffer = Buffer.from(m[2], 'base64');
    if (buffer.length < 64) return null;
    const ext = mimetype.includes('png') ? 'png' : mimetype.includes('webp') ? 'webp' : 'jpg';
    return { buffer, filename: `embed.${ext}`, mimetype };
  }

  const disk = resolveUploadPath(raw);
  if (disk) {
    const buffer = await fs.readFile(disk);
    if (buffer.length < 64) return null;
    const filename = path.basename(disk) || 'upload.jpg';
    const ext = path.extname(filename).toLowerCase();
    const mimetype =
      ext === '.png'
        ? 'image/png'
        : ext === '.webp'
          ? 'image/webp'
          : ext === '.gif'
            ? 'image/gif'
            : ext === '.svg'
              ? 'image/svg+xml'
              : 'image/jpeg';
    return { buffer, filename, mimetype };
  }

  if (!/^https?:\/\//i.test(raw)) return null;
  try {
    const res = await fetch(raw, { headers: { Accept: 'image/*,*/*' }, redirect: 'follow' });
    if (!res.ok) return null;
    const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 64) return null;
    const mimetype = contentType.startsWith('image/') ? contentType : 'image/jpeg';
    let filename = (raw.split('?')[0].split('/').pop() || 'remote.jpg').replace(
      /[^a-zA-Z0-9._-]+/g,
      '_',
    );
    if (!/\.(png|jpe?g|webp|gif|svg)$/i.test(filename)) {
      filename += mimetype.includes('png') ? '.png' : mimetype.includes('svg') ? '.svg' : '.jpg';
    }
    return { buffer, filename, mimetype };
  } catch {
    return null;
  }
}

/** Instagram only accepts JPEG from a public URL — rasterize SVG/PNG/WebP. */
async function rasterizeToJpeg(bytes: PublishImageBytes): Promise<PublishImageBytes> {
  const isJpeg =
    /image\/jpe?g/i.test(bytes.mimetype) || /\.jpe?g$/i.test(bytes.filename);
  if (isJpeg && !/image\/svg/i.test(bytes.mimetype)) {
    try {
      const buffer = await sharp(bytes.buffer, { failOn: 'none' })
        .rotate()
        .jpeg({ quality: 92, mozjpeg: true })
        .toBuffer();
      return { buffer, filename: bytes.filename.replace(/\.[^.]+$/, '.jpg'), mimetype: 'image/jpeg' };
    } catch {
      return { ...bytes, mimetype: 'image/jpeg' };
    }
  }

  // density 72 = 1 SVG unit per pixel, so the JPEG is exactly the canvas size (no resampling).
  const buffer = await sharp(bytes.buffer, { failOn: 'none', density: 72 })
    .rotate()
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
  return {
    buffer,
    filename: bytes.filename.replace(/\.[^.]+$/, '.jpg') || 'publish.jpg',
    mimetype: 'image/jpeg',
  };
}

/** Reject frames that rasterised to a flat colour (missing photo / failed render). */
export async function assertImageNotBlank(buffer: Buffer, label: string): Promise<void> {
  const { channels } = await sharp(buffer, { failOn: 'none' })
    .resize(96, 96, { fit: 'inside' })
    .removeAlpha()
    .stats();
  const spread = Math.max(...channels.map((c) => c.stdev));
  if (spread < 2) {
    throw new Error(
      `${label} rendered as a blank image, so it was not posted. Re-generate the slide and try again.`,
    );
  }
}

let svgTextProbe: Promise<boolean> | null = null;

/**
 * Poster slides are SVG; sharp/librsvg draws their text with *system* fonts. A
 * container with no fonts silently drops every headline, which publishes as a
 * blank card even though the browser preview looks fine. Probe once and cache.
 */
export function svgTextRenders(): Promise<boolean> {
  if (!svgTextProbe) {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="48"><rect width="120" height="48" fill="#fff"/>' +
      '<text x="6" y="34" font-family="Helvetica Neue,Helvetica,Arial,DejaVu Sans,Liberation Sans,sans-serif" font-size="32" font-weight="800" fill="#000">Aa</text></svg>';
    svgTextProbe = sharp(Buffer.from(svg))
      .removeAlpha()
      .stats()
      .then(({ channels }) => Math.max(...channels.map((c) => c.stdev)) > 8)
      .catch(() => false);
  }
  return svgTextProbe;
}

/** Rasterize to JPEG and refuse to hand back a blank / text-less frame. */
export async function toInstagramJpeg(bytes: PublishImageBytes): Promise<PublishImageBytes> {
  const isSvg = /image\/svg/i.test(bytes.mimetype) || /\.svg$/i.test(bytes.filename);
  if (isSvg && !(await svgTextRenders())) {
    throw new Error(
      'This server has no fonts installed, so slide text would be missing from the published image. ' +
        'Install fonts in the API container (Debian: fonts-dejavu-core fonts-liberation fontconfig) and publish again.',
    );
  }
  const jpeg = await rasterizeToJpeg(bytes);
  await assertImageNotBlank(jpeg.buffer, `Image ${bytes.filename}`);
  return jpeg;
}

/** Aspect window shared by every selected network (the strictest bounds win). */
export function aspectWindowFor(platforms: readonly string[]): { min: number; max: number } {
  let min = 0;
  let max = Infinity;
  for (const p of platforms) {
    const lim = PLATFORM_ASPECT_LIMITS[String(p).toLowerCase()];
    if (!lim) continue;
    min = Math.max(min, lim.min);
    max = Math.min(max, lim.max);
  }
  return { min: min || 0.8, max: Number.isFinite(max) ? max : 1.91 };
}

/**
 * Make sure a feed image is a shape the networks show whole. Anything inside the window is passed
 * through untouched (no resize, no crop). Outside it, the original is fitted — never cropped — onto
 * the nearest allowed shape over a blurred, darkened copy of itself.
 */
export async function ensureFeedAspect(
  bytes: PublishImageBytes,
  win: { min: number; max: number },
): Promise<{ bytes: PublishImageBytes; adjusted: boolean; from: string; to?: string }> {
  const meta = await sharp(bytes.buffer, { failOn: 'none' }).metadata();
  const w = meta.width || 0;
  const h = meta.height || 0;
  if (!w || !h) return { bytes, adjusted: false, from: 'unknown' };
  const ratio = w / h;
  const from = `${w}×${h}`;
  const tol = 0.004;
  if (ratio >= win.min - tol && ratio <= win.max + tol) return { bytes, adjusted: false, from };

  const target = ratio < win.min ? win.min : win.max;
  let cw = w;
  let ch = h;
  if (ratio < win.min) cw = Math.round(h * target); // too tall → widen the canvas
  else ch = Math.round(w / target); // too wide → heighten the canvas
  const background = await sharp(bytes.buffer, { failOn: 'none' })
    .resize(cw, ch, { fit: 'cover' })
    .blur(40)
    .modulate({ brightness: 0.75 })
    .jpeg({ quality: 80 })
    .toBuffer();
  let composed = await sharp(background)
    .composite([{ input: await sharp(bytes.buffer, { failOn: 'none' }).jpeg({ quality: 95 }).toBuffer(), left: Math.round((cw - w) / 2), top: Math.round((ch - h) / 2) }])
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
  // Instagram accepts widths up to 1440px.
  if (cw > 1440) {
    composed = await sharp(composed).resize({ width: 1440 }).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
    ch = Math.round((ch * 1440) / cw);
    cw = 1440;
  }
  const buffer = composed;
  return {
    bytes: { buffer, filename: bytes.filename.replace(/\.[^.]+$/, '.jpg'), mimetype: 'image/jpeg' },
    adjusted: true,
    from,
    to: `${cw}×${ch}`,
  };
}

/**
 * Serve the JPEG from our own public API URL when it is reachable, so Meta does
 * not depend on a third-party anonymous file host. Returns null when API_URL is
 * private/localhost or the URL is not actually fetchable from outside.
 */
async function hostOnOwnApi(tenantId: string, jpeg: PublishImageBytes): Promise<string | null> {
  const filename = `publish-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const publicUrl = toPublicMediaUrl(`/uploads/${tenantId}/publish/${filename}`);
  if (!publicUrl || !isExternallyReachableHttps(publicUrl)) return null;
  const dir = path.resolve(config.UPLOAD_DIR, tenantId, 'publish');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), jpeg.buffer);
  try {
    const res = await fetch(publicUrl, { method: 'HEAD', redirect: 'follow' });
    if (res.ok) return publicUrl;
  } catch {
    /* not reachable — fall back to a CDN */
  }
  await fs.rm(path.join(dir, filename), { force: true });
  return null;
}

/**
 * Upload JPEG to a CDN Instagram/Facebook can fetch.
 * Prefer catbox — Placid media URLs (storage.placid.app) have broken public DNS
 * and Meta rejects them with 9004/2207052.
 */
async function uploadPublicJpegHost(jpeg: PublishImageBytes): Promise<string> {
  const errors: string[] = [];
  const fileName = jpeg.filename.endsWith('.jpg') ? jpeg.filename : 'publish.jpg';
  const blob = new Blob([new Uint8Array(jpeg.buffer)], { type: 'image/jpeg' });

  // 1) catbox.moe — public HTTPS, no API key
  try {
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('fileToUpload', blob, fileName);
    const res = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: form,
    });
    const text = (await res.text()).trim();
    if (res.ok && /^https:\/\/files\.catbox\.moe\//i.test(text)) {
      return text;
    }
    errors.push(`catbox: ${res.status} ${text.slice(0, 120)}`);
  } catch (err) {
    errors.push(`catbox: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2) tmpfiles.org — convert download page URL to direct link
  try {
    const form = new FormData();
    form.append('file', blob, 'publish.jpg');
    const res = await fetch('https://tmpfiles.org/api/v1/upload', {
      method: 'POST',
      body: form,
    });
    const data = (await res.json()) as {
      status?: string;
      data?: { url?: string };
      message?: string;
    };
    const pageUrl = data.data?.url?.trim();
    if (res.ok && pageUrl) {
      const direct = pageUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
      if (/^https:\/\//i.test(direct)) return direct;
    }
    errors.push(`tmpfiles: ${res.status} ${data.message || pageUrl || 'no url'}`);
  } catch (err) {
    errors.push(`tmpfiles: ${err instanceof Error ? err.message : String(err)}`);
  }

  throw new Error(`Could not host image on a Meta-reachable CDN. ${errors.join(' | ')}`);
}

/**
 * Host an image where Instagram/Facebook can fetch it.
 * Required for local /uploads and localhost API_URL.
 */
export async function hostImageForSocialPublish(
  tenantId: string,
  url: string,
  platforms: readonly string[] = ['instagram'],
): Promise<string> {
  const trimmed = (url || '').trim();
  if (!trimmed) throw new Error('No image URL to publish');

  // Fast path: already a public image on a Meta-reachable HTTPS CDN
  if (isExternallyReachableHttps(trimmed) && !/\.svg(\?|$)/i.test(trimmed)) {
    // Only skip our own pipeline when its shape is already acceptable; otherwise fit it (never crop).
    const peek = await loadImageBytesForPublish(trimmed);
    if (!peek) return trimmed;
    const probe = await ensureFeedAspect(peek, aspectWindowFor(platforms));
    if (!probe.adjusted) return trimmed;
  }

  const loaded = await loadImageBytesForPublish(trimmed);
  if (!loaded) {
    throw new Error(
      `Could not read image for publish (${trimmed.slice(0, 80)}). Re-generate the post image and try again.`,
    );
  }

  const rasterized = await toInstagramJpeg(loaded);
  const fitted = await ensureFeedAspect(rasterized, aspectWindowFor(platforms));
  if (fitted.adjusted) {
    console.warn(`[publish] ${fitted.from} is outside ${platforms.join('/')} feed shape; fitted to ${fitted.to} without cropping`);
  }
  const jpeg = fitted.bytes;

  const own = await hostOnOwnApi(tenantId, jpeg);
  if (own) return own;

  try {
    return await uploadPublicJpegHost(jpeg);
  } catch (primaryErr) {
    // Fallback: Placid media — only if the returned host is actually public
    const providers = await resolveProviders(tenantId);
    if (providers.placidApiKey) {
      try {
        const placidUrl = await uploadPlacidMedia({
          apiKey: providers.placidApiKey,
          buffer: jpeg.buffer,
          filename: jpeg.filename.endsWith('.jpg') ? jpeg.filename : 'publish.jpg',
          mimetype: 'image/jpeg',
        });
        if (isExternallyReachableHttps(placidUrl)) return placidUrl;
      } catch {
        /* fall through */
      }
    }
    const msg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
    throw new Error(
      `Instagram needs a public HTTPS image. Local /uploads cannot be fetched by Meta. ${msg}`,
    );
  }
}

/** Resolve every slide/cover URL to a Meta-fetchable HTTPS JPEG. */
export async function resolvePublishImageUrls(
  tenantId: string,
  urls: Array<string | null | undefined>,
  platforms: readonly string[] = ['instagram'],
): Promise<string[]> {
  const out: string[] = [];
  for (const u of urls) {
    if (!u?.trim()) continue;
    out.push(await hostImageForSocialPublish(tenantId, u.trim(), platforms));
  }
  return out;
}

/**
 * Chat clients (Teams, Slack) cannot render SVG posters or localhost URLs. Rasterise to a
 * 1080px JPEG, store it under /uploads and return its public URL. Returns undefined when the
 * image cannot be rendered or the API has no public HTTPS address.
 */
export async function createPublicPreviewJpeg(
  tenantId: string,
  url: string | null | undefined,
  maxWidth = 1080,
): Promise<string | undefined> {
  const raw = (url || '').trim();
  if (!raw) return undefined;
  // Already a normal public raster image — use as is.
  if (isExternallyReachableHttps(raw) && !/\.svg(\?|$)/i.test(raw)) return raw;
  try {
    const loaded = await loadImageBytesForPublish(raw);
    if (!loaded) return undefined;
    const jpeg = await toInstagramJpeg(loaded);
    const buffer = await sharp(jpeg.buffer, { failOn: 'none' })
      .resize({ width: maxWidth, withoutEnlargement: true })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
    const filename = `preview-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const publicUrl = toPublicMediaUrl(`/uploads/${tenantId}/previews/${filename}`);
    if (!publicUrl || !isExternallyReachableHttps(publicUrl)) return undefined;
    const dir = path.resolve(config.UPLOAD_DIR, tenantId, 'previews');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, filename), buffer);
    return publicUrl;
  } catch (err) {
    console.warn('[Notification] preview image failed', err instanceof Error ? err.message : err);
    return undefined;
  }
}
