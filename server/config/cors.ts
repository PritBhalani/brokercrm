import type { CorsOptions } from 'cors';

const NGROK_HEADER = 'ngrok-skip-browser-warning';

/** Comma-separated origins from CORS_ORIGINS or FRONTEND_URL (e.g. https://app.vercel.app). */
export function parseCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getExpressCorsOptions(): CorsOptions {
  const origins = parseCorsOrigins();
  return {
    origin: origins.length ? origins : true,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', NGROK_HEADER],
  };
}

/** Socket.io accepts the same shape as Express cors `origin`. */
export function getSocketIoCorsOrigin(): string | string[] | boolean {
  const origins = parseCorsOrigins();
  return origins.length ? origins : true;
}
