/**
 * API base URL for split deployments (Vercel UI + Render API).
 * Priority: VITE_API_BASE_URL → VITE_API_URL → REACT_APP_API_URL (CRA-style).
 * Omit in dev when the UI is served with the API (same origin / Vite proxy).
 */
export function getApiOrigin(): string | undefined {
  const e = import.meta.env;
  const raw =
    (typeof e.VITE_API_BASE_URL === 'string' && e.VITE_API_BASE_URL) ||
    (typeof e.VITE_API_URL === 'string' && e.VITE_API_URL) ||
    (typeof e.REACT_APP_API_URL === 'string' && e.REACT_APP_API_URL);
  if (!raw?.trim()) return undefined;
  return raw.replace(/\/$/, '');
}

export function isNgrokApiOrigin(origin: string | undefined): boolean {
  return Boolean(origin && /ngrok/i.test(origin));
}
