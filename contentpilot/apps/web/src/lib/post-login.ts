const KEY = 'cp_next';

/** Only same-site relative paths — never an open redirect. */
function safe(raw: string | null | undefined): string | null {
  const v = (raw || '').trim();
  return v.startsWith('/') && !v.startsWith('//') && !v.includes('\\') ? v : null;
}

/** Remember where a signed-out visitor was heading (e.g. a Teams/Slack deep link). */
export function rememberDestination(path: string): void {
  try {
    const v = safe(path);
    if (v && v !== '/') window.sessionStorage.setItem(KEY, v);
  } catch {
    /* storage blocked — fall back to the dashboard */
  }
}

/** Where to go after login; clears the remembered destination. */
export function consumeDestination(fallback = '/dashboard'): string {
  try {
    const v = safe(window.sessionStorage.getItem(KEY));
    window.sessionStorage.removeItem(KEY);
    if (v) return v;
  } catch {
    /* ignore */
  }
  return fallback;
}
