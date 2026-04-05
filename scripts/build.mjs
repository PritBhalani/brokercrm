/**
 * Runs `vite build` when Vite is installed (Vercel, local dev with devDependencies).
 * Exits 0 without building when Vite is missing (e.g. Render `npm install` with NODE_ENV=production).
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const viteBin = join(root, 'node_modules', 'vite', 'bin', 'vite.js');

if (!existsSync(viteBin)) {
  console.log(
    '[build] Skipping Vite: not installed (OK for API-only deploys e.g. Render without devDependencies).'
  );
  process.exit(0);
}

const result = spawnSync(process.execPath, [viteBin, 'build'], {
  stdio: 'inherit',
  cwd: root,
  env: process.env,
});

process.exit(result.status === null ? 1 : result.status);
