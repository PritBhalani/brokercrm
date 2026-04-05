import axios from 'axios';

/**
 * Local dev: use same-origin `/api` (Vite proxy → Express on :3000).
 * Vercel UI + API on your PC: set `VITE_API_BASE_URL` at build time to your public URL (e.g. https://xxx.ngrok-free.app) — no trailing slash.
 */
const origin = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
const baseURL = origin ? `${origin.replace(/\/$/, '')}/api` : '/api';

/** Free ngrok serves a browser warning HTML without CORS unless this header is sent. */
const isNgrokTunnel = Boolean(origin && /ngrok/i.test(origin));

const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token') || localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (isNgrokTunnel) {
    config.headers['ngrok-skip-browser-warning'] = 'true';
  }
  return config;
});

export default api;
