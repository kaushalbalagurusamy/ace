// Renders club heads as the game fits them (scripts/qa/club.html), at angles matching each reference photo.
// Usage: node scripts/qa/render-clubs.mjs <playwright-module-dir> <out-root> <shots.json>
// shots.json: [[outfile relative to out-root, asset id, [camera dir x,y,z in the club frame], {raw?, orient?, whole?}], ...]
import { spawn } from 'node:child_process'; import { mkdir, readFile } from 'node:fs/promises'; import { createRequire } from 'node:module'; import { dirname, join, resolve } from 'node:path';
const [pwDir, outRoot, shotsFile] = process.argv.slice(2); const { chromium } = createRequire(join(resolve(pwDir), 'x.js'))('playwright');
const SHOTS = JSON.parse(await readFile(shotsFile, 'utf8'));
const vite = spawn('npx', ['vite', '--port', '5393', '--strictPort', '--host', '127.0.0.1'], { cwd: resolve(import.meta.dirname, '../..'), stdio: 'ignore' });
await new Promise(r => setTimeout(r, 4000));
try {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }), p = await b.newPage({ viewport: { width: 640, height: 640 } });
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto('http://127.0.0.1:5393/scripts/qa/club.html', { waitUntil: 'domcontentloaded' }); await p.waitForFunction('window.ready === true', null, { timeout: 60000 });
  const out = {};
  for (const [file, id, dir, opts] of SHOTS) {
    const f = join(outRoot, file); await mkdir(dirname(f), { recursive: true });
    out[file] = await p.evaluate(([i, d, o]) => window.show(i, d, o), [id, dir, opts ?? {}]); await p.screenshot({ path: f, type: 'jpeg', quality: 85 });
  }
  console.log(JSON.stringify(out)); await b.close();
} finally { vite.kill(); }
