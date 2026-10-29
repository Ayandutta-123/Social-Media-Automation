'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { api, apiUpload } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/toast';
import { Spinner, Toggle } from '@/components/ui';

export type PlanStyleMode = 'off' | 'guide' | 'strong';

export type PlanStyleReference = {
  id: string;
  imageUrl: string;
  label: string;
  varietyKey?: string;
};

const MAX_PICTURES = 10;

/**
 * Optional style pictures for one calendar. With no pictures nothing changes; with pictures and the
 * switch on, the AI makes this calendar's posters in the same look.
 *
 * `planId` null = the calendar is not saved yet (pictures wait on the server and join it when saved).
 */
export function PlanReferenceStyles({
  planId,
  references,
  onReferencesChange,
  mode,
  onModeChange,
  note,
}: {
  planId: string | null;
  references: PlanStyleReference[];
  onReferencesChange: (next: PlanStyleReference[]) => void;
  mode: PlanStyleMode;
  /** Resolve normally; throw to keep the previous value (the caller shows nothing, we do). */
  onModeChange: (mode: PlanStyleMode) => void | Promise<void>;
  /** Shown instead of the controls when pictures cannot apply (e.g. Brand Studio template calendars). */
  note?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const full = references.length >= MAX_PICTURES;
  const following = mode !== 'off' && references.length > 0;

  /** A rejected change keeps the old value (the caller already told the user why). */
  const changeMode = async (next: PlanStyleMode) => {
    try {
      await onModeChange(next);
    } catch {
      /* keep previous mode */
    }
  };

  const upload = async (files: File[]) => {
    if (!files.length) return;
    const room = MAX_PICTURES - references.length;
    if (room <= 0) {
      notifyError(`You can add up to ${MAX_PICTURES} style pictures.`);
      return;
    }
    const batch = files.slice(0, room);
    if (files.length > room) notifyError(`Only ${room} more fit — adding the first ${room}.`);
    setBusy(true);
    const added: PlanStyleReference[] = [];
    const failures: string[] = [];
    for (let i = 0; i < batch.length; i += 1) {
      setProgress(batch.length > 1 ? `Reading picture ${i + 1} of ${batch.length}…` : 'Reading picture…');
      try {
        const fd = new FormData();
        fd.append('file', batch[i]);
        const res = await apiUpload<{ data: { reference: PlanStyleReference } }>(
          `/content/calendar/plan/references${planId ? `?planId=${planId}` : ''}`,
          fd,
        );
        added.push(res.data.reference);
      } catch (e) {
        failures.push(`${batch[i].name}: ${e instanceof Error ? e.message : 'could not be read'}`);
      }
    }
    setBusy(false);
    setProgress('');
    if (added.length) {
      const next = [...references, ...added];
      onReferencesChange(next);
      notifySuccess(`${added.length} style picture${added.length === 1 ? '' : 's'} added`);
      // First pictures: turn the switch on, so adding them is all it takes.
      if (references.length === 0 && mode === 'off') await changeMode('guide');
    }
    if (failures.length) notifyError(failures.join(' · ').slice(0, 300));
  };

  const remove = async (reference: PlanStyleReference) => {
    if (planId && !window.confirm('Remove this style picture from the calendar?')) return;
    try {
      await api(`/content/calendar/plan/references/${reference.id}`, { method: 'DELETE' });
      const next = references.filter((r) => r.id !== reference.id);
      onReferencesChange(next);
      if (!next.length && mode !== 'off') await changeMode('off');
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Could not remove the picture');
    }
  };

  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Style pictures <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></p>
          <p className="mt-1 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
            Add posters you like. The AI will make this calendar’s posters in the same style. No
            pictures? Nothing changes.
          </p>
        </div>
        <span className="shrink-0 text-xs font-semibold tabular-nums text-[hsl(var(--muted-foreground))]">
          {references.length}/{MAX_PICTURES}
        </span>
      </div>

      {note ? (
        <p className="mt-3 rounded-xl bg-[hsl(var(--muted))]/60 px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">{note}</p>
      ) : (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              e.target.value = '';
              void upload(files);
            }}
          />
          <button
            type="button"
            className="btn-secondary mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 sm:w-auto"
            disabled={busy || full}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? <Spinner size={16} /> : <ImagePlus size={16} />}
            {busy && progress ? progress : full ? 'Maximum reached' : 'Add style pictures'}
          </button>
          <span className="ml-0 mt-2 block text-[11px] text-[hsl(var(--muted-foreground))] sm:ml-3 sm:mt-0 sm:inline">
            PNG, JPG or WebP · select several at once
          </span>

          {references.length > 0 && (
            <>
              <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {references.map((reference) => (
                  <li key={reference.id} className="relative overflow-hidden rounded-xl border border-[hsl(var(--border))]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={reference.imageUrl} alt={reference.label || 'Style picture'} className="aspect-square w-full object-cover" />
                    <button
                      type="button"
                      aria-label={`Remove ${reference.label || 'style picture'}`}
                      className="absolute right-1 top-1 grid h-9 w-9 place-items-center rounded-full bg-slate-950/80 text-white shadow"
                      onClick={() => void remove(reference)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>

              <div className="mt-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1">
                <Toggle
                  checked={following}
                  onCheckedChange={(on) => void changeMode(on ? 'guide' : 'off')}
                  label="Make posters in these styles"
                  description={following ? 'On — the AI follows these pictures.' : 'Off — pictures are saved but not used.'}
                />
              </div>
              {following && (
                <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="How closely to follow">
                  {(
                    [
                      ['guide', 'Similar look', 'Same feel, new layout'],
                      ['strong', 'Very close', 'Starts from one of your pictures'],
                    ] as const
                  ).map(([value, title, hint]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={mode === value}
                      onClick={() => void changeMode(value)}
                      className={`min-h-[56px] rounded-xl border px-3 py-2 text-left transition ${
                        mode === value
                          ? 'border-brand-500 bg-brand-500/10'
                          : 'border-[hsl(var(--border))] hover:border-brand-500/40'
                      }`}
                    >
                      <span className="block text-sm font-semibold">{title}</span>
                      <span className="block text-[11px] text-[hsl(var(--muted-foreground))]">{hint}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
