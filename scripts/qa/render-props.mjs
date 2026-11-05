// Renders the code-built props (src/client/props.ts) for the fidelity check. Usage: node scripts/qa/render-props.mjs <playwright-module-dir> <out-dir>
import { spawn } from 'node:child_process'; import { mkdir } from 'node:fs/promises'; import { createRequire } from 'node:module'; import { join, resolve } from 'node:path';
const [pwDir, outDir] = process.argv.slice(2); const { chromium } = createRequire(join(resolve(pwDir), 'x.js'))('playwright');
const vite = spawn('npx', ['vite', '--port', '5391', '--strictPort', '--host', '127.0.0.1'], { cwd: resolve(import.meta.dirname, '../..'), stdio: 'ignore' });
await new Promise(r => setTimeout(r, 4000));
try {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }), p = await b.newPage({ viewport: { width: 640, height: 640 } });
  p.on('pageerror', e => console.log('PAGEERR', e.message)); await p.goto('http://127.0.0.1:5391/scripts/qa/props.html', { waitUntil: 'domcontentloaded' }); await p.waitForFunction('window.ready === true', null, { timeout: 60000 });
  const SET = [['cypress', 0, 'prop-cypress-a'], ['cypress', 1, 'prop-cypress-b'], ['pine', 0, 'prop-pine'], ['rock', 0, 'prop-rock-a'], ['rock', 1, 'prop-rock-b'], ['rock', 2, 'prop-rock-c']], out = {};
  for (const [kind, i, id] of SET) { await mkdir(join(outDir, id), { recursive: true }); for (const view of ['threequarter', 'front', 'top']) { out[id] = await p.evaluate(([k, n, v]) => window.show(k, n, v), [kind, i, view]); await p.screenshot({ path: join(outDir, id, `${view}.jpg`), type: 'jpeg', quality: 82 }); } }
  console.log(JSON.stringify(out)); await b.close();
} finally { vite.kill(); }
