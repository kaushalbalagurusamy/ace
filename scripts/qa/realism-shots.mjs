// Realism fidelity loop: renders the game from viewpoints matched to real Pebble Beach photos and builds side-by-sides
// (real photo left, our render right). Against a LOCAL server (npm run build; PORT=<p> npx tsx src/server/main.ts), real GPU.
// Usage: node scripts/qa/realism-shots.mjs <playwright index.mjs> <chrome binary> [url] [tier] [names...]
// Renders: assets/qa/realism/<name>.png (ours, committed). Side-by-sides: assets/qa/realism/<name>-side.jpg (contain a real photo:
// gitignored, never committed). Uses ?assets=pending so the critic sees the PENDING generated models in place.
import { execFileSync } from 'node:child_process'; import { mkdirSync } from 'node:fs';
const [pwPath, chrome, url = 'http://localhost:3130/', tier = 'medium', ...only] = process.argv.slice(2);
const PHOTOS = '/Users/kaushal/Projects/gauntlet-game-week/refs/pebble-photos';
const OUT = 'assets/qa/realism'; mkdirSync(OUT, { recursive: true });
// name: [real photo, view = hole(1-based), cam x,y,z, target x,y,z, fov] in sim metres (x right, z from the tee toward the pin)
export const VIEWS = {
  'h07-tee': ['coast-tee-shot.jpg', [7, -1, 7, -6, 8, 0, 100, 55]],
  'h08-approach': ['h08-chasm.jpg', [8, -40, 14, 215, 40, -10, 320, 55]],
  'h18-seawall': ['h18-view-back.jpg', [18, 25, 9, 520, -10, 0, 260, 60]],
  'h17-green': ['h17-green.jpg', [17, 8, 1.7, 182, -25, 1, 225, 55]],
  'cypress': ['h18-green-cypress.jpg', [18, 2, 2.5, 455, 25, 6, 494, 55]],
  'bunker': ['bunker-close.jpg', [17, -2, 2.6, 162, -2, 0, 177, 50]],
};
const { chromium } = await import(pwPath);
const b = await chromium.launch({ executablePath: chrome, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const [name, [photo, v]] of Object.entries(VIEWS)) {
  if (only.length && !only.includes(name)) continue;
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(t => localStorage.setItem('ace.gfx', t), tier);
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(`${url}?assets=pending&view=${v.join(',')}`); await p.waitForTimeout(9000);   // models, turf bake and the shadow map settle
  const png = `${OUT}/${name}.png`; await p.screenshot({ path: png });
  execFileSync('magick', [`${PHOTOS}/${photo}`, '-resize', 'x720', png, '-resize', 'x720', '+append', '-quality', '85', `${OUT}/${name}-side.jpg`]);
  console.log(name, errs.length ? `console: ${errs.slice(0, 3).join(' / ')}` : 'ok');
  await ctx.close();
}
await b.close();
