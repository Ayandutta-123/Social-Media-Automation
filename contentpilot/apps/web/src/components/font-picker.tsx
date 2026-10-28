'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { FONT_CATALOG, FONT_CATEGORIES, findFont } from '@/lib/editor-fonts';

type Props = {
  value?: string;
  onChange: (fontStack: string) => void;
};

/** Font dropdown that previews every option in its own typeface, grouped by style. */
export function FontPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = findFont(value);
  const currentStack = value || FONT_CATALOG[0].id;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        className="input flex min-h-[44px] w-full items-center justify-between gap-2 text-left text-sm md:!min-h-[36px]"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="truncate text-base" style={{ fontFamily: currentStack }}>
          {current?.label || value?.split(',')[0] || 'Choose font'}
        </span>
        <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 z-[120] mt-1 max-h-72 overflow-y-auto overscroll-contain rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-1 shadow-xl"
        >
          {FONT_CATEGORIES.map((category) => (
            <div key={category}>
              <p className="sticky top-0 bg-[hsl(var(--card))] px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                {category}
              </p>
              {FONT_CATALOG.filter((f) => f.category === category).map((font) => {
                const active = current?.id === font.id;
                return (
                  <button
                    key={font.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[15px] hover:bg-[hsl(var(--muted))] ${
                      active ? 'bg-brand-500/10 text-brand-700 dark:text-brand-300' : ''
                    }`}
                    style={{ fontFamily: font.id }}
                    onClick={() => {
                      onChange(font.id);
                      setOpen(false);
                    }}
                  >
                    <span className="truncate">{font.label}</span>
                    {active && <Check size={14} className="shrink-0" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
