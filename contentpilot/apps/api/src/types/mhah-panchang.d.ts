declare module 'mhah-panchang' {
  type NamedValue = {
    /** Zero-based index within the cycle (Tithi: 0–14 Shukla, 15–29 Krishna) */
    ino?: number;
    name?: string;
    name_en_IN?: string;
  };

  type PanchangCalendar = {
    Masa?: NamedValue;
    Paksha?: NamedValue;
    Ritu?: NamedValue;
  };

  type PanchangCalculated = {
    Tithi?: NamedValue;
    Nakshatra?: NamedValue;
    Karna?: NamedValue;
    Yoga?: NamedValue;
    Raasi?: NamedValue;
  };

  export class MhahPanchang {
    /** Solar/lunar month + fortnight for a moment; needs observer lat/lng. */
    calendar(date: Date, latitude: number, longitude: number): PanchangCalendar;
    /** Tithi / Nakshatra / Yoga for a moment. */
    calculate(date: Date): PanchangCalculated;
  }
}
