# Production deployment (Vercel + Render + MongoDB Atlas)

## Architecture

| Layer    | Host              |
|----------|-------------------|
| React UI | Vercel            |
| API + Socket.io | Render (Web Service) |
| Database | MongoDB Atlas     |

## Backend (Render)

1. Create a **Web Service** connected to this repository.
2. **Root directory:** repository root (same `package.json` as the Express app).
3. **Build command:** **`npm ci`** or **`npm install`** is enough. If your dashboard still runs **`npm run build`**, that is OK: the **`build`** script skips Vite when it is not installed (production installs omit devDependencies). The API does not need a frontend bundle; **Vercel** builds the React app.
4. **Start command:** `npm start`  
   This runs `tsx server.ts`, which listens on `process.env.PORT` and `0.0.0.0`.
5. Optional: connect this repo’s **`render.yaml`** as a Blueprint so build/start stay correct.
6. **Environment variables:** copy from `backend.env.example` and set at least:
   - `MONGODB_URI` — Atlas connection string (Network Access: allow Render’s IPs or `0.0.0.0/0` for simplicity).
   - `JWT_SECRET` — long random string (required when `NODE_ENV=production`).
   - `CORS_ORIGINS` or `FRONTEND_URL` — your Vercel site origin(s), comma-separated for multiple.
   - `NODE_ENV=production`
7. Render injects `PORT`; do not hardcode it. Optional: `RENDER_EXTERNAL_URL` is logged if present.

### If you really must run `vite build` on Render

Prefer building the UI on Vercel. If you need a full install including devDependencies:

`npm ci --include=dev && npm run build`

(or set `NODE_ENV=development` only for the install step — not ideal for production images.)

## Frontend (Vercel)

1. Import the same repo; **Framework Preset:** Vite (or Other with `npm run build` / `dist`).
2. **Build command:** `npm run build`
3. **Output directory:** `dist`
4. Set **environment variables** at build time (see `frontend.env.example`):
   - `VITE_API_BASE_URL` = your Render service URL (e.g. `https://your-api.onrender.com`), no trailing slash.  
   - You may use `VITE_API_URL` or `REACT_APP_API_URL` instead (see `src/config/apiOrigin.ts`).

## Verification

- Open `https://<render-host>/api/health` — should return `{ "ok": true, ... }`.
- From the Vercel app, log in and confirm real-time features (Socket.io) work; check browser devtools Network → WS.

## Required environment variables (summary)

**Render (backend):** `MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGINS` or `FRONTEND_URL`, `NODE_ENV=production`  
**Vercel (frontend):** `VITE_API_BASE_URL` (or `VITE_API_URL` / `REACT_APP_API_URL`)

Optional: `GEMINI_API_KEY` if your build uses it; `DEBUG_API_ERRORS` / `VERCEL_DEBUG` only for private debugging.
