// Renders the cart through scripts/qa/cart.html. Usage: node scripts/qa/render-cart.mjs <playwright-module-dir> <out-dir> <shots.json> [chromium-path]
// shots.json: [[name, showOptions], ...]; prints each shot's bounds and body state as JSON.
import { spawn } from 'node:child_process'; import { mkdir, readFile } from 'node:fs/promises'; import { createRequire } from 'node:module'; import { join, resolve } from 'node:path';
const [pwDir, outDir, shotsFile, exe] = process.argv.slice(2); const { chromium } = createRequire(join(resolve(pwDir), 'x.js'))('playwright');
const SHOTS = JSON.parse(await readFile(shotsFile, 'utf8'));
const vite = spawn('npx', ['vite', '--port', '5393', '--strictPort', '--host', '127.0.0.1'], { cwd: resolve(import.meta.dirname, '../..'), stdio: 'ignore' });
await new Promise(r => setTimeout(r, 4000));
try {
  const b = await chromium.launch({ executablePath: exe, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }), p = await b.newPage({ viewport: { width: 960, height: 640 } });
  p.on('pageerror', e => console.log('PAGEERR', e.message)); p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await p.goto('http://127.0.0.1:5393/scripts/qa/cart.html', { waitUntil: 'domcontentloaded' }); await p.waitForFunction('window.ready === true', null, { timeout: 60000 });
  await mkdir(outDir, { recursive: true }); const out = {};
  for (const [name, opts] of SHOTS) { out[name] = await p.evaluate(o => window.show(o), opts); await p.screenshot({ path: join(outDir, `${name}.jpg`), type: 'jpeg', quality: 85 }); }
  console.log(JSON.stringify(out)); await b.close();
} finally { vite.kill(); }
