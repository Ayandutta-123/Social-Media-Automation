/**
 * Offline date rules for recurring calendar events.
 *
 * Every rule resolves for ANY Gregorian year with no network call and no API
 * key, so an air-gapped on-prem install keeps producing a full calendar years
 * after deploy. Lunar systems come from ICU (`islamic-umalqura`) and from
 * astronomical panchang maths (`mhah-panchang`) — never from scraping.
 *
 * Results are memoised per year because the lunar scans walk a whole year.
 */
import { MhahPanchang } from 'mhah-panchang';

/** 0 = Sunday … 6 = Saturday */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type DateRule =
  /** Same Gregorian month/day every year (e.g. New Year's Day). */
  | { kind: 'fixed'; month: number; day: number }
  /** "3rd Monday of January", or nth: 'last' for "last Monday of May". */
  | { kind: 'nthWeekday'; month: number; weekday: Weekday; nth: 1 | 2 | 3 | 4 | 5 | 'last' }
  /** Western Easter Sunday (Computus), optionally shifted by days. */
  | { kind: 'easter'; offset?: number }
  /** Islamic date via ICU Umm al-Qura, e.g. Eid al-Fitr = 1 Shawwal → month 10, day 1. */
  | { kind: 'hijri'; month: number; day: number }
  /**
   * Hindu luni-solar date: the first occurrence of a tithi inside a solar
   * window. `tithiIno` follows mhah-panchang indexing — 0–14 = Shukla
   * Padyami…Purnima, 15–29 = Krishna Padyami…Amavasya.
   *
   * A window is required because a tithi repeats every lunation, and the
   * reported masa is sankranti-based so it drifts against lunar festivals.
   * The window pins which lunation is meant (Diwali = the Amavasya between
   * mid-October and late November).
   *
   * `pradosh` samples the tithi at dusk IST instead of midday, which is how
   * Diwali / Lakshmi Puja is conventionally dated.
   */
  | {
      kind: 'tithi';
      tithiIno: number;
      from: { month: number; day: number };
      to: { month: number; day: number };
      pradosh?: boolean;
    }
  /** Shift another rule by N days (Black Friday = Thanksgiving + 1). */
  | { kind: 'offset'; base: DateRule; days: number };

const MS_DAY = 86_400_000;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toYmd(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function fromYmd(ymd: string): number {
  return Date.parse(`${ymd}T00:00:00Z`);
}

/** Anonymous Gregorian Computus — Western Easter Sunday. */
function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${pad(month)}-${pad(day)}`;
}

function nthWeekdayOf(
  year: number,
  month: number,
  weekday: Weekday,
  nth: 1 | 2 | 3 | 4 | 5 | 'last',
): string | null {
  if (nth === 'last') {
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    for (let day = lastDay; day >= 1; day -= 1) {
      const ms = Date.UTC(year, month - 1, day);
      if (new Date(ms).getUTCDay() === weekday) return toYmd(ms);
    }
    return null;
  }
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const shift = (weekday - first + 7) % 7;
  const day = 1 + shift + (nth - 1) * 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInMonth) return null;
  return toYmd(Date.UTC(year, month - 1, day));
}

// ── Islamic (Umm al-Qura via ICU) ──────────────────────────
const hijriFormatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  timeZone: 'UTC',
});

/** `${hijriMonth}-${hijriDay}` → first Gregorian date in the year, per year. */
const hijriIndexCache = new Map<number, Map<string, string>>();

function hijriIndexForYear(year: number): Map<string, string> {
  const cached = hijriIndexCache.get(year);
  if (cached) return cached;

  const index = new Map<string, string>();
  const end = Date.UTC(year, 11, 31);
  for (let ms = Date.UTC(year, 0, 1); ms <= end; ms += MS_DAY) {
    const parts = hijriFormatter.formatToParts(new Date(ms));
    let hMonth = 0;
    let hDay = 0;
    for (const part of parts) {
      if (part.type === 'month') hMonth = Number(part.value);
      else if (part.type === 'day') hDay = Number(part.value);
    }
    if (!hMonth || !hDay) continue;
    const key = `${hMonth}-${hDay}`;
    // Keep the first occurrence; a Hijri month can wrap twice in one solar year.
    if (!index.has(key)) index.set(key, toYmd(ms));
  }
  hijriIndexCache.set(year, index);
  return index;
}

// ── Hindu luni-solar (panchang) ────────────────────────────
/** IST offset in minutes; midday and dusk sampling points. */
const IST_OFFSET_MIN = 330;
const MIDDAY_IST_HOUR = 12;
const PRADOSH_IST_HOUR = 18;

let panchangInstance: MhahPanchang | null = null;

function panchang(): MhahPanchang {
  if (!panchangInstance) panchangInstance = new MhahPanchang();
  return panchangInstance;
}

/** Tithi index per day of a year, sampled at one IST hour. */
const tithiYearCache = new Map<string, Map<string, number>>();

function tithiDaysForYear(year: number, istHour: number): Map<string, number> {
  const cacheKey = `${year}:${istHour}`;
  const cached = tithiYearCache.get(cacheKey);
  if (cached) return cached;

  const p = panchang();
  const days = new Map<string, number>();
  const end = Date.UTC(year, 11, 31);
  for (let ms = Date.UTC(year, 0, 1); ms <= end; ms += MS_DAY) {
    const sample = new Date(ms + (istHour * 60 - IST_OFFSET_MIN) * 60_000);
    try {
      const ino = p.calculate(sample).Tithi?.ino;
      if (ino != null) days.set(toYmd(ms), ino);
    } catch {
      // Astronomy library can throw on edge dates — skip that day.
    }
  }
  tithiYearCache.set(cacheKey, days);
  return days;
}

function tithiDate(
  year: number,
  tithiIno: number,
  from: { month: number; day: number },
  to: { month: number; day: number },
  pradosh: boolean,
): string | null {
  const days = tithiDaysForYear(year, pradosh ? PRADOSH_IST_HOUR : MIDDAY_IST_HOUR);
  const startMs = Date.UTC(year, from.month - 1, from.day);
  // A window may wrap past new year (e.g. mid-Dec → mid-Jan); clamp to this year.
  const endMs =
    to.month < from.month
      ? Date.UTC(year, 11, 31)
      : Date.UTC(year, to.month - 1, to.day);

  for (let ms = startMs; ms <= endMs; ms += MS_DAY) {
    const ymd = toYmd(ms);
    if (days.get(ymd) === tithiIno) return ymd;
  }
  return null;
}

/**
 * Resolve a rule to `YYYY-MM-DD` in the given Gregorian year.
 * Returns null when the rule has no occurrence that year (e.g. a Hijri date
 * that falls outside the solar year), so callers can simply skip it.
 */
export function resolveRuleDate(rule: DateRule, year: number): string | null {
  switch (rule.kind) {
    case 'fixed': {
      const daysInMonth = new Date(Date.UTC(year, rule.month, 0)).getUTCDate();
      if (rule.day > daysInMonth) return null;
      return `${year}-${pad(rule.month)}-${pad(rule.day)}`;
    }
    case 'nthWeekday':
      return nthWeekdayOf(year, rule.month, rule.weekday, rule.nth);
    case 'easter': {
      const base = easterSunday(year);
      if (!rule.offset) return base;
      return toYmd(fromYmd(base) + rule.offset * MS_DAY);
    }
    case 'hijri':
      return hijriIndexForYear(year).get(`${rule.month}-${rule.day}`) ?? null;
    case 'tithi':
      return tithiDate(year, rule.tithiIno, rule.from, rule.to, Boolean(rule.pradosh));
    case 'offset': {
      const base = resolveRuleDate(rule.base, year);
      if (!base) return null;
      return toYmd(fromYmd(base) + rule.days * MS_DAY);
    }
    default:
      return null;
  }
}

/** Tithi indices used by the catalog, named for readability. */
export const TITHI = {
  shuklaPratipada: 0,
  shuklaChaturthi: 3,
  shuklaPanchami: 4,
  shuklaSaptami: 6,
  shuklaAshtami: 7,
  shuklaNavami: 8,
  shuklaDashami: 9,
  shuklaTrayodashi: 12,
  purnima: 14,
  krishnaAshtami: 22,
  krishnaTrayodashi: 27,
  krishnaChaturdashi: 28,
  amavasya: 29,
} as const;

/** Hijri months used by the catalog. */
export const HIJRI_MONTH = {
  muharram: 1,
  rabiAlAwwal: 3,
  ramadan: 9,
  shawwal: 10,
  dhuAlHijjah: 12,
} as const;

/** Test/diagnostic helper — clears memoised lunar scans. */
export function clearDateRuleCaches(): void {
  hijriIndexCache.clear();
  tithiYearCache.clear();
}
