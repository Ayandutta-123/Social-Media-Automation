'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  /** What the control does — shown on hover and keyboard focus. */
  label: string;
  /** Optional keyboard shortcut, e.g. "⌘/Ctrl+Z". */
  shortcut?: string;
  children: ReactNode;
  side?: 'top' | 'bottom';
  className?: string;
};

/**
 * Instant, styled tooltip for icon-only controls. Rendered in a portal so scrolling toolbars
 * (overflow-x: auto) and the fullscreen editor never clip it. Mouse and keyboard only —
 * touch screens keep the control's aria-label.
 */
export function Tip({ label, shortcut, children, side = 'bottom', className = '' }: Props) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number; flip: boolean } | null>(null);

  const show = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const flip = side === 'top' ? r.top > 48 : r.bottom + 48 > window.innerHeight;
      const x = Math.min(Math.max(r.left + r.width / 2, 80), window.innerWidth - 80);
      setPos({ x, y: flip ? r.top - 8 : r.bottom + 8, flip });
    }, 120);
  }, [side]);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setPos(null);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('blur', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('blur', close);
    };
  }, [pos]);

  return (
    <span
      ref={wrapRef}
      className={`inline-flex shrink-0 ${className}`}
      onPointerEnter={(e) => {
        if (e.pointerType !== 'touch') show();
      }}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {pos &&
        typeof document !== 'undefined' &&
        createPortal(
          <span
            role="tooltip"
            className="pointer-events-none fixed z-[300] max-w-[240px] -translate-x-1/2 rounded-lg bg-slate-900 px-2.5 py-1.5 text-center text-[11px] font-medium leading-snug text-white shadow-lg dark:bg-slate-100 dark:text-slate-900"
            style={{ left: pos.x, top: pos.y, transform: `translate(-50%, ${pos.flip ? '-100%' : '0'})` }}
          >
            {label}
            {shortcut && (
              <span className="ml-1.5 rounded bg-white/15 px-1 py-px text-[10px] font-semibold opacity-80 dark:bg-slate-900/15">
                {shortcut}
              </span>
            )}
          </span>,
          document.body,
        )}
    </span>
  );
}
