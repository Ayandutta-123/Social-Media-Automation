/**
 * Moving-date calendar events, expressed as rules instead of per-year rows.
 *
 * Before this existed, every floating date (Easter, Eid, Diwali, Thanksgiving)
 * needed a hand-written row per year, so the calendar silently emptied out once
 * the last hard-coded year passed. These definitions resolve for any year with
 * no network access, which is what keeps an on-prem install working long after
 * deploy.
 *
 * `OVERRIDES` still wins when present: lunar observance is announced locally
 * (moon sighting, regional muhurta) and a computed date can land a day either
 * side. Seeded with the dates that were previously hand-verified in the
 * catalog, and the place to record official future announcements.
 */
import type { DateRule } from './calendar-date-rules';
import { HIJRI_MONTH, TITHI } from './calendar-date-rules';
import type { CalendarRegion, EventCategory } from './festival-calendar';

export interface RecurringFestivalDef {
  id: string;
  name: string;
  region: CalendarRegion;
  category: EventCategory;
  when: DateRule;
  description: string;
  hashtagHints: string[];
  promptHints: string;
}

const MONDAY = 1 as const;
const THURSDAY = 4 as const;
const FRIDAY = 5 as const;
const SUNDAY = 0 as const;

export const RECURRING: RecurringFestivalDef[] = [
  // ═══════════════════════════════════════════════════════════
  // GLOBAL — weekday-anchored tech days
  // ═══════════════════════════════════════════════════════════
  {
    id: 'tech-password-day',
    name: 'World Password Day',
    region: 'global',
    category: 'tech',
    when: { kind: 'nthWeekday', month: 5, weekday: THURSDAY, nth: 1 },
    description: 'First Thursday of May — stronger passwords and MFA.',
    hashtagHints: ['#WorldPasswordDay', '#CyberSecurity', '#MFA'],
    promptHints: 'Password hygiene, MFA, protect accounts.',
  },
  {
    id: 'tech-sysadmin',
    name: 'System Administrator Appreciation Day',
    region: 'global',
    category: 'tech',
    when: { kind: 'nthWeekday', month: 7, weekday: FRIDAY, nth: 'last' },
    description: 'Last Friday of July — thank the admins who keep systems running.',
    hashtagHints: ['#SysAdminDay', '#ITPros', '#ThankAnAdmin'],
    promptHints: 'Gratitude to IT ops, reliability heroes, behind-the-scenes craft.',
  },
  {
    id: 'tech-accessibility',
    name: 'Global Accessibility Awareness Day',
    region: 'global',
    category: 'tech',
    when: { kind: 'nthWeekday', month: 5, weekday: THURSDAY, nth: 3 },
    description: 'GAAD — third Thursday of May.',
    hashtagHints: ['#GAAD', '#Accessibility', '#InclusiveDesign'],
    promptHints: 'Inclusive digital experiences.',
  },
  {
    id: 'tech-programmer',
    name: 'Programmers’ Day',
    region: 'global',
    category: 'tech',
    // 256th day of the year — Sep 13, or Sep 12 in a leap year.
    when: { kind: 'offset', base: { kind: 'fixed', month: 1, day: 1 }, days: 255 },
    description: 'Day of the Programmer — the 256th day of the year.',
    hashtagHints: ['#ProgrammersDay', '#Coding', '#Developers'],
    promptHints: 'Celebrate builders and code craft — fun, respectful geek culture.',
  },

  // ═══════════════════════════════════════════════════════════
  // EUROPE — Easter cycle
  // ═══════════════════════════════════════════════════════════
  {
    id: 'eu-easter',
    name: 'Easter Sunday (Europe)',
    region: 'europe',
    category: 'festival',
    when: { kind: 'easter' },
    description: 'Christian Easter Sunday.',
    hashtagHints: ['#Easter', '#HappyEaster', '#Europe'],
    promptHints: 'Renewal, spring, family — inclusive holiday tone.',
  },
  {
    id: 'eu-good-friday',
    name: 'Good Friday (Europe)',
    region: 'europe',
    category: 'festival',
    when: { kind: 'easter', offset: -2 },
    description: 'Public holiday in many European countries.',
    hashtagHints: ['#GoodFriday'],
    promptHints: 'Quiet, respectful observance.',
  },
  {
    id: 'eu-easter-monday',
    name: 'Easter Monday (Europe)',
    region: 'europe',
    category: 'festival',
    when: { kind: 'easter', offset: 1 },
    description: 'Public holiday across much of Europe.',
    hashtagHints: ['#EasterMonday', '#Easter'],
    promptHints: 'Spring break energy, gentle greeting.',
  },
  {
    id: 'eu-ascension',
    name: 'Ascension Day',
    region: 'europe',
    category: 'festival',
    when: { kind: 'easter', offset: 39 },
    description: 'Public holiday in several European countries.',
    hashtagHints: ['#AscensionDay'],
    promptHints: 'Quiet cultural note for EU markets.',
  },
  {
    id: 'eu-whit',
    name: 'Whit Monday / Pentecost Monday',
    region: 'europe',
    category: 'festival',
    when: { kind: 'easter', offset: 50 },
    description: 'Public holiday in France, Germany, and others.',
    hashtagHints: ['#WhitMonday', '#Pentecost'],
    promptHints: 'Early summer pause, cultural greeting.',
  },

  // ═══════════════════════════════════════════════════════════
  // USA — federal / commercial floating dates
  // ═══════════════════════════════════════════════════════════
  {
    id: 'us-mlk',
    name: 'Martin Luther King Jr. Day',
    region: 'usa',
    category: 'national',
    when: { kind: 'nthWeekday', month: 1, weekday: MONDAY, nth: 3 },
    description: 'Federal holiday (3rd Monday in January).',
    hashtagHints: ['#MLKDay', '#MLK', '#Service'],
    promptHints: 'Service, equality, leadership — sincere.',
  },
  {
    id: 'us-presidents',
    name: 'Presidents’ Day',
    region: 'usa',
    category: 'national',
    when: { kind: 'nthWeekday', month: 2, weekday: MONDAY, nth: 3 },
    description: 'Federal holiday (3rd Monday in February).',
    hashtagHints: ['#PresidentsDay', '#USA'],
    promptHints: 'Leadership, civic pride — light nod.',
  },
  {
    id: 'us-super-bowl',
    name: 'Super Bowl Sunday (cultural)',
    region: 'usa',
    category: 'observance',
    when: { kind: 'nthWeekday', month: 2, weekday: SUNDAY, nth: 2 },
    description: 'Major U.S. cultural/media moment — confirm the NFL schedule.',
    hashtagHints: ['#SuperBowl', '#USA'],
    promptHints: 'High-energy cultural moment — optional brand play.',
  },
  {
    id: 'us-memorial',
    name: 'Memorial Day',
    region: 'usa',
    category: 'national',
    when: { kind: 'nthWeekday', month: 5, weekday: MONDAY, nth: 'last' },
    description: 'Federal holiday (last Monday in May).',
    hashtagHints: ['#MemorialDay', '#Honor'],
    promptHints: 'Respectful remembrance — no hard sell.',
  },
  {
    id: 'us-labour',
    name: 'Labor Day (USA)',
    region: 'usa',
    category: 'national',
    when: { kind: 'nthWeekday', month: 9, weekday: MONDAY, nth: 1 },
    description: 'Federal holiday (1st Monday in September).',
    hashtagHints: ['#LaborDay', '#USA'],
    promptHints: 'Appreciate workers and teams.',
  },
  {
    id: 'us-columbus',
    name: 'Columbus Day / Indigenous Peoples’ Day',
    region: 'usa',
    category: 'national',
    when: { kind: 'nthWeekday', month: 10, weekday: MONDAY, nth: 2 },
    description:
      'Federal holiday (2nd Monday in October); many mark Indigenous Peoples’ Day.',
    hashtagHints: ['#IndigenousPeoplesDay', '#ColumbusDay'],
    promptHints: 'Thoughtful, inclusive cultural awareness.',
  },
  {
    id: 'us-thanksgiving',
    name: 'Thanksgiving (USA)',
    region: 'usa',
    category: 'national',
    when: { kind: 'nthWeekday', month: 11, weekday: THURSDAY, nth: 4 },
    description: 'Federal holiday (4th Thursday in November).',
    hashtagHints: ['#Thanksgiving', '#Grateful'],
    promptHints: 'Gratitude to customers and team.',
  },
  {
    id: 'us-black-friday',
    name: 'Black Friday',
    region: 'usa',
    category: 'observance',
    when: {
      kind: 'offset',
      base: { kind: 'nthWeekday', month: 11, weekday: THURSDAY, nth: 4 },
      days: 1,
    },
    description: 'Major shopping / commerce day after Thanksgiving.',
    hashtagHints: ['#BlackFriday', '#Deals'],
    promptHints: 'Offers with taste — avoid spammy hard sell.',
  },
  {
    id: 'us-cyber-monday',
    name: 'Cyber Monday',
    region: 'usa',
    category: 'tech',
    when: {
      kind: 'offset',
      base: { kind: 'nthWeekday', month: 11, weekday: THURSDAY, nth: 4 },
      days: 4,
    },
    description: 'Online shopping / digital commerce peak.',
    hashtagHints: ['#CyberMonday', '#Ecommerce', '#Digital'],
    promptHints: 'Digital deals, online experience quality.',
  },
  {
    id: 'us-giving-tuesday',
    name: 'Giving Tuesday',
    region: 'usa',
    category: 'observance',
    when: {
      kind: 'offset',
      base: { kind: 'nthWeekday', month: 11, weekday: THURSDAY, nth: 4 },
      days: 5,
    },
    description: 'Global generosity day after Cyber Monday.',
    hashtagHints: ['#GivingTuesday', '#Charity'],
    promptHints: 'Purpose, community impact.',
  },

  // ═══════════════════════════════════════════════════════════
  // GCC — Islamic calendar (ICU Umm al-Qura)
  // ═══════════════════════════════════════════════════════════
  {
    id: 'gcc-ramadan',
    name: 'Ramadan (approx. start)',
    region: 'gcc',
    category: 'festival',
    when: { kind: 'hijri', month: HIJRI_MONTH.ramadan, day: 1 },
    description: 'Approximate start of Ramadan — confirm by moon sighting.',
    hashtagHints: ['#Ramadan', '#RamadanKareem', '#GCC'],
    promptHints: 'Respectful, reflective, supportive of fasting colleagues.',
  },
  {
    id: 'gcc-eid-fitr',
    name: 'Eid al-Fitr (GCC)',
    region: 'gcc',
    category: 'festival',
    when: { kind: 'hijri', month: HIJRI_MONTH.shawwal, day: 1 },
    description: 'Eid al-Fitr — end of Ramadan (approx.; confirm locally).',
    hashtagHints: ['#EidMubarak', '#EidAlFitr', '#Ramadan', '#GCC'],
    promptHints: 'Warm Gulf greeting, gratitude, community.',
  },
  {
    id: 'gcc-eid-adha',
    name: 'Eid al-Adha (GCC)',
    region: 'gcc',
    category: 'festival',
    when: { kind: 'hijri', month: HIJRI_MONTH.dhuAlHijjah, day: 10 },
    description: 'Eid al-Adha (approx.; confirm locally).',
    hashtagHints: ['#EidAlAdha', '#EidMubarak', '#GCC'],
    promptHints: 'Faith, generosity, family.',
  },
  {
    id: 'gcc-islamic-ny',
    name: 'Islamic New Year (approx.)',
    region: 'gcc',
    category: 'festival',
    when: { kind: 'hijri', month: HIJRI_MONTH.muharram, day: 1 },
    description: '1 Muharram approximate Gregorian date.',
    hashtagHints: ['#IslamicNewYear', '#Muharram'],
    promptHints: 'Quiet, respectful New Year greeting.',
  },
  {
    id: 'gcc-prophet',
    name: 'Prophet’s Birthday (Mawlid, approx.)',
    region: 'gcc',
    category: 'festival',
    when: { kind: 'hijri', month: HIJRI_MONTH.rabiAlAwwal, day: 12 },
    description: 'Mawlid an-Nabi approximate date — observance varies by country.',
    hashtagHints: ['#Mawlid', '#ProphetBirthday'],
    promptHints: 'Peaceful, respectful cultural note.',
  },

  // ═══════════════════════════════════════════════════════════
  // INDIA — Islamic observances (commonly a day after the Gulf)
  // ═══════════════════════════════════════════════════════════
  {
    id: 'in-eid-fitr',
    name: 'Eid al-Fitr (India)',
    region: 'india',
    category: 'festival',
    when: {
      kind: 'offset',
      base: { kind: 'hijri', month: HIJRI_MONTH.shawwal, day: 1 },
      days: 1,
    },
    description: 'Eid marking the end of Ramadan (approx.; confirm locally).',
    hashtagHints: ['#EidMubarak', '#EidAlFitr', '#India'],
    promptHints: 'Warm greetings, community, gratitude.',
  },
  {
    id: 'in-eid-adha',
    name: 'Eid al-Adha / Bakrid (India)',
    region: 'india',
    category: 'festival',
    when: { kind: 'hijri', month: HIJRI_MONTH.dhuAlHijjah, day: 10 },
    description: 'Festival of sacrifice (approx.; confirm locally).',
    hashtagHints: ['#EidAlAdha', '#Bakrid', '#EidMubarak'],
    promptHints: 'Faith, generosity, family — respectful greeting.',
  },
  {
    id: 'in-muharram',
    name: 'Muharram',
    region: 'india',
    category: 'festival',
    when: { kind: 'hijri', month: HIJRI_MONTH.muharram, day: 10 },
    description: 'Muharram / Ashura observance (approx.).',
    hashtagHints: ['#Muharram', '#IslamicNewYear'],
    promptHints: 'Solemn, respectful, low-key greeting.',
  },
  {
    id: 'in-milad',
    name: 'Milad-un-Nabi / Id-e-Milad',
    region: 'india',
    category: 'festival',
    when: {
      kind: 'offset',
      base: { kind: 'hijri', month: HIJRI_MONTH.rabiAlAwwal, day: 12 },
      days: 1,
    },
    description: 'Birthday of Prophet Muhammad (approx.; confirm locally).',
    hashtagHints: ['#MiladUnNabi', '#EidEMilad'],
    promptHints: 'Respectful, peaceful cultural greeting.',
  },
  {
    id: 'in-good-friday',
    name: 'Good Friday',
    region: 'india',
    category: 'festival',
    when: { kind: 'easter', offset: -2 },
    description: 'Christian observance before Easter.',
    hashtagHints: ['#GoodFriday', '#Easter'],
    promptHints: 'Reflective, respectful, subdued tone.',
  },

  // ═══════════════════════════════════════════════════════════
  // INDIA — Hindu luni-solar (panchang tithi within a solar window)
  // ═══════════════════════════════════════════════════════════
  {
    id: 'in-makar',
    name: 'Makar Sankranti / Pongal',
    region: 'india',
    category: 'festival',
    // Solar (sankranti) festival — effectively fixed, drifts to Jan 15 rarely.
    when: { kind: 'fixed', month: 1, day: 14 },
    description: 'Harvest festival — Makar Sankranti / Pongal season.',
    hashtagHints: ['#MakarSankranti', '#Pongal', '#HarvestFestival'],
    promptHints: 'Gratitude, harvest, warmth, regional pride.',
  },
  {
    id: 'in-onam',
    name: 'Onam',
    region: 'india',
    category: 'festival',
    // Thiruvonam is nakshatra-based; this tithi window lands within a day of it.
    when: {
      kind: 'tithi',
      tithiIno: TITHI.shuklaTrayodashi,
      from: { month: 8, day: 20 },
      to: { month: 9, day: 15 },
    },
    description: 'Kerala’s harvest festival — unity and prosperity.',
    hashtagHints: ['#Onam', '#Kerala', '#HarvestFestival'],
    promptHints: 'Flower carpets, togetherness, prosperity.',
  },
  {
    id: 'in-basant',
    name: 'Basant Panchami / Saraswati Puja',
    region: 'india',
    category: 'festival',
    when: {
      kind: 'tithi',
      tithiIno: TITHI.shuklaPanchami,
      from: { month: 1, day: 15 },
      to: { month: 2, day: 20 },
    },
    description: 'Celebrates knowledge, learning, and the arrival of spring.',
    hashtagHints: ['#BasantPanchami', '#SaraswatiPuja', '#Knowledge'],
    promptHints: 'Learning, creativity, yellow spring accents.',
  },
  {
    id: 'in-holi',
    name: 'Holi',
    region: 'india',
    category: 'festival',
    // Rangwali Holi is the day after Holika Dahan (Phalguna Purnima).
    when: {
      kind: 'offset',
      base: {
        kind: 'tithi',
        tithiIno: TITHI.purnima,
        from: { month: 2, day: 25 },
        to: { month: 3, day: 31 },
      },
      days: 1,
    },
    description: 'Festival of colours — spring and renewal.',
    hashtagHints: ['#Holi', '#FestivalOfColours', '#India'],
    promptHints: 'Vibrant colour, joy, inclusive celebration.',
  },
  {
    id: 'in-ram-navami',
    name: 'Ram Navami',
    region: 'india',
    category: 'festival',
    when: {
      kind: 'tithi',
      tithiIno: TITHI.shuklaNavami,
      from: { month: 3, day: 20 },
      to: { month: 4, day: 20 },
    },
    description: 'Celebrates the birth of Lord Rama.',
    hashtagHints: ['#RamNavami', '#India'],
    promptHints: 'Devotion, values, respectful cultural tone.',
  },
  {
    id: 'in-mahavir',
    name: 'Mahavir Jayanti',
    region: 'india',
    category: 'festival',
    when: {
      kind: 'tithi',
      tithiIno: TITHI.shuklaTrayodashi,
      from: { month: 3, day: 25 },
      to: { month: 4, day: 25 },
    },
    description: 'Birth anniversary of Lord Mahavira (Jainism).',
    hashtagHints: ['#MahavirJayanti', '#Ahimsa', '#India'],
    promptHints: 'Peace, non-violence, ethical living.',
  },
  {
    id: 'in-buddha',
    name: 'Buddha Purnima',
    region: 'india',
    category: 'festival',
    when: {
      kind: 'tithi',
      tithiIno: TITHI.purnima,
      from: { month: 4, day: 25 },
      to: { month: 5, day: 31 },
    },
    description: 'Birth, enlightenment, and mahaparinirvana of the Buddha.',
    hashtagHints: ['#BuddhaPurnima', '#Vesak', '#Peace'],
    promptHints: 'Peace, mindfulness, compassion.',
  },
  {
    id: 'in-rakhi',
    name: 'Raksha Bandhan',
    region: 'india',
    category: 'festival',
    when: {
      kind: 'tithi',
      tithiIno: TITHI.purnima,
      from: { month: 8, day: 1 },
      to: { month: 9, day: 5 },
    },
    description: 'Celebrating bonds of care and protection.',
    hashtagHints: ['#RakshaBandhan', '#Rakhi', '#Family'],
    promptHints: 'Care, relationships, warmth.',
  },
  {
    id: 'in-janmashtami',
    name: 'Janmashtami',
    region: 'india',
    category: 'festival',
    when: {
      kind: 'tithi',
      tithiIno: TITHI.krishnaAshtami,
      from: { month: 8, day: 10 },
      to: { month: 9, day: 15 },
    },
    description: 'Birth celebration of Lord Krishna.',
    hashtagHints: ['#Janmashtami', '#Krishna'],
    promptHints: 'Joy, devotion, cultural festivity — respectful.',
  },
  {
    id: 'in-ganesh',
    name: 'Ganesh Chaturthi',
    region: 'india',
    category: 'festival',
    when: {
      kind: 'tithi',
      tithiIno: TITHI.shuklaChaturthi,
      from: { month: 8, day: 20 },
      to: { month: 9, day: 25 },
      pradosh: true,
    },
    description: 'Festival honouring Lord Ganesha — beginnings and wisdom.',
    hashtagHints: ['#GaneshChaturthi', '#GanpatiBappaMorya'],
    promptHints: 'New beginnings, wisdom, festive energy.',
  },
  {
    id: 'in-navratri',
    name: 'Navratri (start)',
    region: 'india',
    category: 'festival',
    when: {
      kind: 'tithi',
      tithiIno: TITHI.shuklaPratipada,
      from: { month: 9, day: 20 },
      to: { month: 10, day: 25 },
    },
    description: 'Nine nights of dance, devotion, and celebration.',
    hashtagHints: ['#Navratri', '#Garba', '#Dandiya'],
    promptHints: 'Energy, colour, community celebration.',
  },
  {
    id: 'in-dussehra',
    name: 'Dussehra / Vijayadashami',
    region: 'india',
    category: 'festival',
    when: {
      kind: 'tithi',
      tithiIno: TITHI.shuklaDashami,
      from: { month: 9, day: 28 },
      to: { month: 11, day: 3 },
    },
    description: 'Victory of good over evil; end of Navratri.',
    hashtagHints: ['#Dussehra', '#Vijayadashami', '#Navratri'],
    promptHints: 'Triumph of good, courage, renewal.',
  },
  {
    id: 'in-chhath',
    name: 'Chhath Puja',
    region: 'india',
    category: 'festival',
    when: {
      kind: 'tithi',
      tithiIno: TITHI.shuklaSaptami,
      from: { month: 10, day: 20 },
      to: { month: 11, day: 25 },
    },
    description: 'Sun worship festival prominent in Bihar, Jharkhand, UP & diaspora.',
    hashtagHints: ['#ChhathPuja', '#Chhath'],
    promptHints: 'Devotion, nature, discipline, cultural pride.',
  },
  {
    id: 'in-diwali',
    name: 'Diwali (Deepavali)',
    region: 'india',
    category: 'festival',
    // Lakshmi Puja falls on the Amavasya prevailing at dusk.
    when: {
      kind: 'tithi',
      tithiIno: TITHI.amavasya,
      from: { month: 10, day: 15 },
      to: { month: 11, day: 20 },
      pradosh: true,
    },
    description: 'Festival of lights — prosperity and new beginnings.',
    hashtagHints: ['#Diwali', '#Deepavali', '#FestivalOfLights'],
    promptHints: 'Warm lights, prosperity, gratitude, fresh starts.',
  },
  {
    id: 'in-govardhan',
    name: 'Govardhan Puja',
    region: 'india',
    category: 'festival',
    when: {
      kind: 'offset',
      base: {
        kind: 'tithi',
        tithiIno: TITHI.amavasya,
        from: { month: 10, day: 15 },
        to: { month: 11, day: 20 },
        pradosh: true,
      },
      days: 1,
    },
    description: 'Day after Diwali in many regions.',
    hashtagHints: ['#GovardhanPuja', '#Diwali'],
    promptHints: 'Continued festive goodwill.',
  },
  {
    id: 'in-bhai-dooj',
    name: 'Bhai Dooj',
    region: 'india',
    category: 'festival',
    when: {
      kind: 'offset',
      base: {
        kind: 'tithi',
        tithiIno: TITHI.amavasya,
        from: { month: 10, day: 15 },
        to: { month: 11, day: 20 },
        pradosh: true,
      },
      days: 2,
    },
    description: 'Celebrating sibling bonds after Diwali.',
    hashtagHints: ['#BhaiDooj', '#Family'],
    promptHints: 'Family bonds, affection, warmth.',
  },
  {
    id: 'in-guru-nanak',
    name: 'Guru Nanak Jayanti',
    region: 'india',
    category: 'festival',
    when: {
      kind: 'tithi',
      tithiIno: TITHI.purnima,
      from: { month: 10, day: 28 },
      to: { month: 12, day: 5 },
    },
    description: 'Birth anniversary of Guru Nanak Dev Ji.',
    hashtagHints: ['#GuruNanakJayanti', '#Gurpurab', '#Sikh'],
    promptHints: 'Equality, service (seva), humility.',
  },
];

/**
 * Hand-verified dates that beat the computed rule for a specific year.
 *
 * Lunar observance is set locally (moon sighting, regional muhurta) so a
 * computed date can sit a day either side of the observed one. Everything here
 * was verified in the original catalog; add official announcements as they are
 * published.
 */
export const OVERRIDES: Record<string, Record<number, string>> = {
  'in-makar': { 2025: '2025-01-14', 2026: '2026-01-14' },
  'in-basant': { 2026: '2026-01-23' },
  'in-holi': { 2025: '2025-03-14', 2026: '2026-03-04' },
  'in-eid-fitr': { 2025: '2025-03-31', 2026: '2026-03-21' },
  'in-ram-navami': { 2026: '2026-03-26' },
  'in-mahavir': { 2026: '2026-03-31' },
  'in-buddha': { 2026: '2026-05-01' },
  'in-eid-adha': { 2025: '2025-06-07', 2026: '2026-05-27' },
  'in-muharram': { 2026: '2026-06-26' },
  'in-rakhi': { 2025: '2025-08-09', 2026: '2026-08-28' },
  'in-milad': { 2026: '2026-08-26' },
  'in-janmashtami': { 2025: '2025-08-16', 2026: '2026-09-04' },
  'in-ganesh': { 2025: '2025-08-27', 2026: '2026-09-14' },
  'in-onam': { 2025: '2025-09-05', 2026: '2026-08-26' },
  'in-dussehra': { 2025: '2025-10-02', 2026: '2026-10-20' },
  'in-navratri': { 2026: '2026-10-11' },
  'in-diwali': { 2025: '2025-10-20', 2026: '2026-11-08' },
  'in-govardhan': { 2026: '2026-11-09' },
  'in-bhai-dooj': { 2026: '2026-11-10' },
  'in-chhath': { 2025: '2025-10-27', 2026: '2026-11-15' },
  'in-guru-nanak': { 2025: '2025-11-05', 2026: '2026-11-24' },
  'gcc-ramadan': { 2025: '2025-02-28', 2026: '2026-02-17' },
  'gcc-eid-fitr': { 2025: '2025-03-30', 2026: '2026-03-20' },
  'gcc-eid-adha': { 2025: '2025-06-06', 2026: '2026-05-27' },
  'gcc-islamic-ny': { 2025: '2025-06-26', 2026: '2026-06-16' },
  'gcc-prophet': { 2025: '2025-09-04', 2026: '2026-08-25' },
  'us-super-bowl': { 2025: '2025-02-09', 2026: '2026-02-08' },
};

/** Ids owned by the rule engine — matching hard-coded rows are ignored. */
export const RECURRING_IDS: ReadonlySet<string> = new Set(RECURRING.map((r) => r.id));
