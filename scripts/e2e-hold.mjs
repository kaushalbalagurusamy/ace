// SH-8 browser check against a LOCAL server (never prod): node e2e-hold.mjs <screenshot-dir> [url]. Needs playwright installed outside the repo.
import { chromium } from 'playwright';
const E = process.argv[2], URL = process.argv[3] || 'http://localhost:3130/';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
p.on('websocket', ws => ws.on('framesent', f => { const t = String(f.payload); if (/"t":"(shot|putt)"/.test(t)) console.log('SENT', t.slice(0, 150)); }));
const txt = async s => (await p.innerText(s).catch(() => '')).replace(/\s+/g, ' ');
const sleep = ms => p.waitForTimeout(ms);
await p.goto(URL); await p.fill('#nm', 'HoldUI'); await p.click('[data-act=name]'); await p.click('[data-act=create]'); await p.click('[data-act=solo]');
await p.waitForSelector('#bag', { state: 'visible', timeout: 15000 }); await sleep(7000);
console.log('step bar gone:', (await p.locator('#len').count()) === 0, '| prompt:', await txt('#prompt'));
// Esc cancel: stance, then Esc, then WASD must work again (prompt returns)
await p.keyboard.press('Space'); await sleep(100); console.log('stance meter:', await txt('#meter'), '| prompt hidden:', (await txt('#prompt')) === '');
await p.keyboard.press('Escape'); await sleep(150); console.log('after Esc prompt:', await txt('#prompt'));
// full swing: stance, hold Space 375 ms (length .5), release, Z/X/C at scaled offsets
await p.keyboard.press('Digit7'); await p.keyboard.press('Space'); await sleep(100);
await p.keyboard.down('Space'); await sleep(200); console.log('meter while holding:', await txt('#meter'));
await sleep(175); await p.keyboard.up('Space');
await p.keyboard.down('KeyZ'); await sleep(45 - 6); await p.keyboard.down('KeyX'); await sleep(67 - 6); await p.keyboard.down('KeyC'); await sleep(700);
for (const k of ['KeyZ', 'KeyX', 'KeyC']) await p.keyboard.up(k);
console.log('CARD:', (await txt('#card')).slice(0, 110));
// rollover: Space held while Z already down (early key), then release
await sleep(14000);
console.log('ERRORS:', errs.length ? errs : 'none'); await b.close();
