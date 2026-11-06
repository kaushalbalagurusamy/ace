// Coast-on-real-elevation QA: renders holes 7, 8, 17 and 18 through main.ts ?view= (camera and target heights are above the ground there),
// with the PENDING generated models (?assets=pending) and without, at Medium, and logs triangles / draw calls for each frame.
// Usage: node scripts/qa/coast-elevation-shots.mjs <playwright index.mjs> <chrome binary> [url] [outDir] [names...]
import { mkdirSync } from 'node:fs';
const [pw, exe, url = 'http://localhost:3297/', out = 'assets/qa/coast-elevation', ...only] = process.argv.slice(2);
// name: hole (1-based), cam x,y,z, target x,y,z, fov, in sim metres (x right, z from the tee toward the pin)
const VIEWS = {
  'h07-tee': [7, -1, 7, -6, 8, 0, 100, 55],
  'h07-green': [7, -4, 2.2, 82, 0, 0, 97, 50],
  'h08-approach': [8, -40, 14, 215, 40, -10, 320, 55],
  'h17-green': [17, 8, 1.7, 182, -25, 1, 225, 55],
  'h18-seawall': [18, 25, 9, 520, -10, 0, 260, 60],
  'h18-green': [18, -3, 2.2, 482, 0, 0, 496.5, 50],
  'h18-wall': [18, -55, 3, 185, -85, -3, 245, 55],
  'h17-shore': [17, -10, 3, 150, -45, -3, 225, 55],
  'h07-shore': [7, 20, 3, 60, 45, -4, 90, 50],
};
const { chromium } = await import(pw);
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: exe, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const pending of [true, false]) for (const [name, v] of Object.entries(VIEWS)) {
  if (only.length && !only.includes(name)) continue;
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => localStorage.setItem('ace.gfx', 'medium'));
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(`${url}?${pending ? 'assets=pending&' : ''}view=${v.join(',')}`); await p.waitForTimeout(9000);
  const info = await p.evaluate(() => { const r = window.__ace.world.renderer; return { tris: r.info.render.triangles, calls: r.info.render.calls }; });
  const file = `${out}/${name}${pending ? '-pending' : ''}.png`; await p.screenshot({ path: file });
  console.log(file, `tris ${info.tris} calls ${info.calls}`, errs.length ? `console: ${errs.slice(0, 3).join(' / ')}` : 'ok');
  await ctx.close();
}
await b.close();
