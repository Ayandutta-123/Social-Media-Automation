'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { rememberDestination } from '@/lib/post-login';
import { AppShell } from '@/components/app-shell';
import { LoadingState } from '@/components/ui';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      rememberDestination(`${window.location.pathname}${window.location.search}`);
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading) {
    return <LoadingState fullScreen title="Opening ContentPilot" description="Loading your workspace…" />;
  }

  if (!user) return null;

  return <AppShell>{children}</AppShell>;
}
