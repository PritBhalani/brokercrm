import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import os from 'os';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    // Allow CRA-style REACT_APP_* for API URL (see src/config/apiOrigin.ts)
    envPrefix: ['VITE_', 'REACT_APP_'],
    // Keep Vite's dep cache outside the repo so file watchers (tsx/nodemon) never see churn under node_modules/.vite
    cacheDir: path.join(os.tmpdir(), 'broker-crm-vite-cache'),
    build: {
      chunkSizeWarningLimit: 750,
      sourcemap: false,
    },
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // When the UI is served by `vite` alone (e.g. port 5173), forward API calls to Express
      // (`npm run dev` / `tsx server.ts` on 3000). Without this, `/api/*` returns index.html.
      proxy: {
        '/api': {
          target: process.env.VITE_DEV_API_PROXY_TARGET || 'http://127.0.0.1:3000',
          changeOrigin: true,
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
