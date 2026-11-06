// Screenshots of the real-elevation terrain against a LOCAL server: node scripts/qa/elevation-shots.mjs <playwright index.mjs> <chrome binary> [url] [outDir]
// Starts a solo race, then rebuilds the scene for holes 7, 8 and 18 (every tee is the origin, so the player stands on each tee) and frames a green.
import fs from 'node:fs';
const [pw, exe, url = 'http://localhost:3297/', out = 'assets/qa/elevation'] = process.argv.slice(2);
const { chromium } = await import(pw);
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: exe, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => (m.type() === 'error' || /turf|graphics|shader/i.test(m.text())) && errs.push(m.text().slice(0, 300)));
await p.goto(url); await p.fill('#nm', 'Elevation'); await p.click('[data-act=name]');
await p.click('[data-act=create]'); await p.click('[data-act=solo]');
await p.waitForSelector('#bag', { state: 'visible', timeout: 15000 }); await p.waitForTimeout(6000);
await p.screenshot({ path: `${out}/hole01-tee-liepanel.png` });
const YARDS = { 7: 106, 8: 418, 18: 543 };
/** Rebuilds hole n and fixes the camera at cam(L) = [x, z, yaw, pitch, eye height, distance] in sim space (L = hole length, m). */
async function shot(n, cam, file) {
  const L = YARDS[n] * 0.9144;
  await p.evaluate(([n, L, c]) => {
    const w = window.__ace.world;
    w.myHole = n - 1; w.buildCourse({ index: n - 1, par: 4, pin: { x: 0, z: L }, tee: { x: 0, z: 0 }, greenRadius: 12, fairwayHalfWidth: 20, lengthM: L });
    const orig = w.__render ??= w.render.bind(w); w.render = () => orig(...c);
  }, [n, L, cam(L)]);
  await p.waitForTimeout(5000);
  await p.screenshot({ path: `${out}/${file}` });
}
await shot(7, () => [0, 4, 0, 0.32, 1.7, 16], 'hole07-tee.png');
await shot(8, () => [0, 4, 0, 0.22, 1.7, 16], 'hole08-tee.png');
await shot(18, () => [0, 4, 0, 0.22, 1.7, 16], 'hole18-tee.png');
await shot(7, L => [6, L - 4, -0.5, 0.25, 1.2, 22], 'hole07-green-closeup.png');
console.log(errs.length ? `ERRORS: ${errs.join(' | ')}` : 'no page errors');
await b.close();
