// Two-browser smoke test. Usage: from a dir where `npm i playwright && npx playwright install chromium` was run: node e2e-smoke.mjs <screenshot-dir> [url]
import { chromium } from 'playwright';
const E = process.argv[2], URL = process.argv[3] || 'http://localhost:3130/';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errs = [], frames = [];
async function player(name) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error') errs.push(`${name} console: ${m.text()}`); });
  p.on('pageerror', e => errs.push(`${name} pageerror: ${e.message}`));
  p.on('websocket', ws => { ws.on('framesent', f => frames.push(`${name} >> ${String(f.payload).slice(0, 90)}`)); ws.on('framereceived', f => { const s = String(f.payload); if (!s.includes('"t":"countdown"')) frames.push(`${name} << ${s.slice(0, 90)}`); }); });
  await p.goto(URL); await p.fill('#nm', name); await p.click('[data-act=name]');
  return p;
}
const log = (...a) => console.log(...a);
const A = await player('Alice'), B = await player('Bobby');
await A.click('[data-act=create]'); await A.waitForSelector('[data-act=ready]');
await B.waitForSelector('[data-act=join]:not([disabled])'); await B.click('[data-act=join]');
await A.click('[data-act=ready]'); await B.click('[data-act=ready]');
await A.waitForSelector('[data-act=start]:not([disabled])'); await A.click('[data-act=start]');
await A.waitForSelector('#bag', { state: 'visible', timeout: 15000 }).catch(e => log('race HUD not visible', e.message));
await A.waitForTimeout(7000);
await A.screenshot({ path: `${E}/alice.png` }); await B.screenshot({ path: `${E}/bobby.png` });
log('HUD text:', (await A.innerText('body')).replace(/\s+/g, ' ').slice(0, 300));
// swing
await A.keyboard.press('Digit1'); await A.keyboard.press('Space'); await A.waitForTimeout(100);
log('prompt after Space:', await A.innerText('#prompt').catch(() => 'n/a'));
await A.waitForTimeout(1500);
await A.keyboard.down('KeyZ'); await A.waitForTimeout(60); await A.keyboard.down('KeyX'); await A.waitForTimeout(90); await A.keyboard.down('KeyC');
await A.waitForTimeout(800);
await A.screenshot({ path: `${E}/alice-after-swing.png` });
log('card:', (await A.innerText('#card').catch(() => '')).replace(/\s+/g, ' '));
log('shot frames:', frames.filter(f => f.includes('"t":"shot') || f.includes('shotResult')).map(f => f.slice(0, 80)));
log('ERRORS:', errs.length ? errs : 'none');
await b.close();
