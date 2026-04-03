import type { IncomingMessage, ServerResponse } from 'http';
import serverless from 'serverless-http';
import { createApp } from '../server/createApp.ts';

const app = createApp();
app.set('socketio', { to: () => ({ emit: () => {} }) });

const handler = serverless(app);

/** Vercel may forward paths like `/leads` instead of `/api/leads` to this function. */
export default function vercelHandler(
  req: IncomingMessage & { url?: string },
  res: ServerResponse
) {
  const u = req.url ?? '';
  if (u.startsWith('/') && !u.startsWith('/api')) {
    req.url = `/api${u}`;
  }
  return handler(req, res);
}
