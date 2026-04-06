/**
 * API base URL for split deployments (Vercel UI + Render API).
 * Priority: VITE_API_BASE_URL → VITE_API_URL → REACT_APP_API_URL (CRA-style).
 * Omit in dev when the UI is served with the API (same origin / Vite proxy).
 *
 * Only accepts string values at runtime (import.meta.env can be non-string in edge cases).
 */
export function getApiOrigin(): string | undefined {
  const e = import.meta.env as Record<string, unknown>;
  const keys = [
    'VITE_API_BASE_URL',
    'VITE_API_URL',
    'REACT_APP_API_URL',
  ] as const;
  for (const k of keys) {
    const v = e[k];
    if (typeof v !== 'string') continue;
    const trimmed = v.trim();
    if (!trimmed) continue;
    return trimmed.replace(/\/$/, '');
  }
  return undefined;
}
