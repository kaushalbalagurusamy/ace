// PS-7 browser check against a LOCAL server (never prod): node e2e-length.mjs <screenshot-dir> [url]. Needs playwright installed outside the repo.
import { chromium } from 'playwright';
const E = process.argv[2], URL = process.argv[3] || 'http://localhost:3130/';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
p.on('websocket', ws => ws.on('framesent', f => { const t = String(f.payload); if (t.includes('"t":"shot"')) console.log('SENT', t.slice(0, 150)); }));
const txt = async s => (await p.innerText(s).catch(() => '')).replace(/\s+/g, ' ');
const sleep = ms => p.waitForTimeout(ms);
await p.goto(URL); await p.fill('#nm', 'LenUI'); await p.click('[data-act=name]'); await p.click('[data-act=create]'); await p.click('[data-act=solo]');
await p.waitForSelector('#bag', { state: 'visible', timeout: 15000 }); await sleep(7000);
console.log('LEN default:', await txt('#len'), '| lit:', await p.locator('#len i.on').count());
await p.keyboard.press('BracketLeft'); console.log('after [ :', await txt('#len'));
await p.keyboard.press('BracketLeft'); await p.keyboard.press('BracketLeft'); await p.keyboard.press('BracketLeft'); console.log('after [[[ (floor):', await txt('#len'), '| lit:', await p.locator('#len i.on').count());
await p.keyboard.press('BracketRight'); await p.keyboard.press('BracketLeft');
await p.mouse.move(640, 360); await p.mouse.wheel(0, 100); await sleep(200); console.log('after wheel down:', await txt('#len'));
await p.mouse.wheel(0, -100); await sleep(200); console.log('after wheel up:', await txt('#len'));
await p.keyboard.press('BracketLeft'); // 25%
await p.keyboard.press('KeyO'); await sleep(100);
const topMs = 600 + 750 * 0.25, d = 0.6;
await p.keyboard.press('Space'); await sleep(topMs - 40);
await p.keyboard.down('KeyZ'); await sleep(40 * 0 + 36); await p.keyboard.down('KeyX'); await sleep(54); await p.keyboard.down('KeyC'); await sleep(700);
for (const k of ['KeyZ', 'KeyX', 'KeyC']) await p.keyboard.up(k);
console.log('CARD:', await txt('#card')); console.log('INFO:', await txt('#info'));
// swing locked: brackets must not change length mid-swing
console.log('ERRORS:', errs.length ? errs : 'none'); await b.close();
