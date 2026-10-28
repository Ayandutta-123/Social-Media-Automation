/**
 * Calendar catalog refresh — optional network extras on top of the offline
 * rule engine. Air-gapped / on-prem boxes skip the fetch and still show a
 * full year because listFestivalEvents computes dates locally.
 */
import { prisma } from '../lib/prisma';
import { config } from '../config';
import {
  listFestivalEvents,
  catalogYearStats,
  getFestivalById,
  canonicalFestivalId,
  type CalendarEvent,
  type CatalogDateOverride,
  type CalendarRegion,
  type EventCategory,
} from '../data/festival-calendar';

const WARM_KEY = '_warm';
const REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

const CALENDARIFIC_COUNTRIES: Array<{ code: string; region: CalendarRegion }> = [
  { code: 'US', region: 'usa' },
  { code: 'GB', region: 'europe' },
  { code: 'DE', region: 'europe' },
  { code: 'FR', region: 'europe' },
  { code: 'IN', region: 'india' },
  { code: 'AE', region: 'gcc' },
  { code: 'SA', region: 'gcc' },
];

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

export async function loadCatalogOverrides(year: number): Promise<CatalogDateOverride[]> {
  try {
    const rows = await prisma.calendarEventOverride.findMany({
      where: {
        year,
        source: { in: ['manual', 'calendarific'] },
        NOT: { eventKey: WARM_KEY },
      },
    });
    return rows.map((r) => ({
      eventKey: r.eventKey,
      date: r.date,
      name: r.name || undefined,
      region: r.region as CalendarRegion,
      category: r.category as EventCategory,
      description: r.description || undefined,
      hashtagHints: r.hashtagHints,
      promptHints: r.promptHints || undefined,
      source: r.source === 'calendarific' && r.eventKey.startsWith('ext-') ? 'external' : 'override',
    }));
  } catch (err) {
    console.warn(
      '[calendar-catalog] override table unavailable — using offline rules only:',
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

export async function listCatalogEvents(opts: {
  year: number;
  month?: number;
  regions?: CalendarRegion[];
  categories?: EventCategory[];
}): Promise<CalendarEvent[]> {
  const overrides = await loadCatalogOverrides(opts.year);
  return listFestivalEvents({ ...opts, overrides });
}

export async function resolveFestivalEvent(id: string, year?: number): Promise<CalendarEvent | null> {
  const y = year ?? new Date().getFullYear();
  const events = await listCatalogEvents({ year: y });
  const canon = canonicalFestivalId(id);
  return (
    events.find((e) => e.id === id || e.id === canon || canonicalFestivalId(e.id) === canon) ||
    getFestivalById(id, y)
  );
}

export async function refreshCalendarCatalog(years?: number[]): Promise<{
  years: number[];
  fetched: boolean;
  extras: number;
}> {
  const now = new Date();
  const targets = years?.length ? years : [now.getFullYear(), now.getFullYear() + 1];
  let extras = 0;
  let fetched = false;

  for (const year of targets) {
    await markWarmed(year);
    const apiKey = config.CALENDARIFIC_API_KEY?.trim();
    if (!apiKey) continue;
    try {
      extras += await fetchCalendarificYear(year, apiKey);
      fetched = true;
    } catch (err) {
      console.warn(
        `[calendar-catalog] Calendarific ${year} skipped:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return { years: targets, fetched, extras };
}

export async function maybeRefreshCalendarCatalog(): Promise<void> {
  const year = new Date().getFullYear();
  if (!(await isStale(year))) return;
  const result = await refreshCalendarCatalog([year, year + 1]);
  const stats = catalogYearStats(year);
  console.log(
    `[calendar-catalog] refreshed ${result.years.join(',')} · offline=${stats.count} · extras=${result.extras} · network=${result.fetched ? 'ok' : 'skipped'}`,
  );
}

async function isStale(year: number): Promise<boolean> {
  try {
    const row = await prisma.calendarEventOverride.findUnique({
      where: { eventKey_year: { eventKey: WARM_KEY, year } },
    });
    if (!row) return true;
    return Date.now() - row.updatedAt.getTime() > REFRESH_MS;
  } catch {
    return false;
  }
}

async function markWarmed(year: number): Promise<void> {
  try {
    await prisma.calendarEventOverride.upsert({
      where: { eventKey_year: { eventKey: WARM_KEY, year } },
      create: {
        eventKey: WARM_KEY,
        year,
        date: `${year}-01-01`,
        name: 'warmup',
        source: 'computed',
      },
      update: { date: `${year}-01-01` },
    });
  } catch (err) {
    console.warn(
      '[calendar-catalog] could not mark warmup:',
      err instanceof Error ? err.message : err,
    );
  }
}

async function fetchCalendarificYear(year: number, apiKey: string): Promise<number> {
  const existing = await listFestivalEvents({ year });
  const takenDates = new Set(existing.map((e) => `${e.date}|${e.name.toLowerCase()}`));
  let written = 0;

  for (const { code, region } of CALENDARIFIC_COUNTRIES) {
    const url = `https://calendarific.com/api/v2/holidays?api_key=${encodeURIComponent(apiKey)}&country=${code}&year=${year}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        console.warn('[calendar-catalog] Calendarific key rejected — stopping fetch');
        return written;
      }
      continue;
    }
    const json = (await res.json()) as {
      response?: { holidays?: Array<{ name?: string; date?: { iso?: string }; type?: string[] }> };
    };
    for (const h of json.response?.holidays || []) {
      const name = String(h.name || '').trim();
      const iso = String(h.date?.iso || '').slice(0, 10);
      if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) continue;
      if (takenDates.has(`${iso}|${name.toLowerCase()}`)) continue;
      const key = `ext-${code.toLowerCase()}-${slug(name)}`;
      const locked = await prisma.calendarEventOverride.findFirst({
        where: { eventKey: key, year, locked: true },
        select: { id: true },
      });
      if (locked) continue;
      await prisma.calendarEventOverride.upsert({
        where: { eventKey_year: { eventKey: key, year } },
        create: {
          eventKey: key,
          year,
          date: iso,
          name,
          region,
          category: 'national',
          source: 'calendarific',
          description: `${name} (${code})`,
          hashtagHints: [`#${name.replace(/[^A-Za-z0-9]/g, '')}`].filter((t) => t.length > 2),
          promptHints: 'Respectful cultural / national greeting.',
        },
        update: {
          date: iso,
          name,
          region,
        },
      });
      takenDates.add(`${iso}|${name.toLowerCase()}`);
      written += 1;
    }
  }
  return written;
}
