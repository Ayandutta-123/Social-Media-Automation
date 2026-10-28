'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

type Status = {
  usesServerKeys?: boolean;
  llmProvider?: string;
  openaiApiKeySet?: boolean;
  claudeApiKeySet?: boolean;
};

/** New companies run on their own API keys; nudge them to add one before AI / automation is used. */
export function ApiKeysBanner() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!user?.tenantId) return;
    let cancelled = false;
    api<{ data: Status }>('/settings/providers')
      .then((res) => {
        if (cancelled) return;
        const s = res.data;
        const hasText = s.llmProvider === 'claude' ? s.claudeApiKeySet : s.openaiApiKeySet;
        setMissing(s.usesServerKeys === false && !hasText);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // Re-check when the user leaves Settings (they may just have saved a key).
  }, [user?.tenantId, pathname]);

  if (!missing || pathname.startsWith('/settings')) return null;
  return (
    <Link
      href="/settings?tab=integrations"
      className="mx-3 mt-3 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 transition hover:bg-amber-500/15 dark:text-amber-100 sm:mx-4 md:mx-6 xl:mx-8"
    >
      <KeyRound size={18} className="mt-0.5 shrink-0" />
      <span>
        <strong className="font-semibold">Add your API keys to start.</strong> AI writing, images and automation
        run on your own OpenAI or Claude key. Open Settings → Integrations to add it.
      </span>
    </Link>
  );
}
