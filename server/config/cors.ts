import type { CorsOptions } from 'cors';

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/$/, '');
}

/** Comma-separated origins from CORS_ORIGINS or FRONTEND_URL (e.g. https://app.vercel.app). */
export function parseCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '';
  return raw
    .split(',')
    .map((s) => normalizeOrigin(s.trim()))
    .filter(Boolean);
}

export function getExpressCorsOptions(): CorsOptions {
  const origins = parseCorsOrigins();
  const base: CorsOptions = {
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86_400,
    optionsSuccessStatus: 204,
  };

  if (origins.length === 0) {
    return { ...base, origin: true };
  }

  return {
    ...base,
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (origins.includes(normalizeOrigin(origin))) {
        callback(null, true);
        return;
      }
      if (process.env.DEBUG_CORS === '1') {
        console.warn('[CORS] blocked origin:', origin, 'allowed:', origins);
      }
      callback(new Error('Not allowed by CORS'));
    },
  };
}

/** Socket.io accepts the same shape as Express cors `origin`. */
export function getSocketIoCorsOrigin(): string | string[] | boolean {
  const origins = parseCorsOrigins();
  return origins.length ? origins : true;
}
