// Renders the rigged golfer through the game's rig (scripts/qa/golfer.html) for the fidelity check.
// Usage: node scripts/qa/render-golfer.mjs <playwright-module-dir> <out-dir> [shots.json]
// Default shots: front, side, back (bind A-pose), head close-ups, address and top of the backswing (down the line, as in refs/swing), with a 7-iron.
import { spawn } from 'node:child_process'; import { mkdir, readFile } from 'node:fs/promises'; import { createRequire } from 'node:module'; import { join, resolve } from 'node:path';
const [pwDir, outDir, shotsFile] = process.argv.slice(2); const { chromium } = createRequire(join(resolve(pwDir), 'x.js'))('playwright');
const SHOTS = shotsFile ? JSON.parse(await readFile(shotsFile, 'utf8')) : [
  ['front', 'front', 'rest'], ['side', 'side', 'rest'], ['back', 'back', 'rest'], ['address', 'dtl', 'address'], ['top', 'dtl', 'top'], ['face', 'front', 'rest', { face: true }], ['face-side', 'side', 'rest', { face: true }],
];
const vite = spawn('npx', ['vite', '--port', '5392', '--strictPort', '--host', '127.0.0.1'], { cwd: resolve(import.meta.dirname, '../..'), stdio: 'ignore' });
await new Promise(r => setTimeout(r, 4000));
try {
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }), p = await b.newPage({ viewport: { width: 640, height: 640 } });
  p.on('pageerror', e => console.log('PAGEERR', e.message)); p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await p.goto('http://127.0.0.1:5392/scripts/qa/golfer.html', { waitUntil: 'domcontentloaded' }); await p.waitForFunction('window.ready === true', null, { timeout: 60000 });
  await mkdir(outDir, { recursive: true }); const out = {};
  for (const [name, view, pose, opts] of SHOTS) { out[name] = await p.evaluate(([v, ps, o]) => window.show(v, ps, o), [view, pose, opts ?? {}]); await p.screenshot({ path: join(outDir, `${name}.jpg`), type: 'jpeg', quality: 85 }); }
  console.log(JSON.stringify(out)); await b.close();
} finally { vite.kill(); }
