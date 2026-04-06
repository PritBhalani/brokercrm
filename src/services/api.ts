import axios from 'axios';
import { getApiOrigin } from '../config/apiOrigin.ts';

/**
 * Local dev: same-origin `/api` (Vite proxy → Express).
 * Split deploy: set VITE_API_BASE_URL, VITE_API_URL, or REACT_APP_API_URL at build time (no trailing slash).
 */
const origin = getApiOrigin();
const baseURL = origin ? `${origin}/api` : '/api';

const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token') || localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
