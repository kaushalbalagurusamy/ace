// Solo full-cycle check against a LOCAL server (never prod): node e2e-solo.mjs <screenshot-dir> [url]. Needs playwright installed outside the repo.
import { chromium } from 'playwright';
const E = process.argv[2], URL = process.argv[3] || 'http://localhost:3130/';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
const txt = async s => (await p.innerText(s).catch(() => '')).replace(/\s+/g, ' ');
const sleep = ms => p.waitForTimeout(ms);
p.on('websocket', ws => ws.on('framesent', f => { const t = String(f.payload); if (t.includes('"t":"shot"')) console.log('SENT', t.slice(0, 140)); }));
await p.goto(URL); await p.fill('#nm', 'Solo'); await p.click('[data-act=name]');
await p.click('[data-act=create]'); await p.click('[data-act=solo]');
await p.waitForSelector('#bag', { state: 'visible', timeout: 15000 }); await sleep(7000);
console.log('INFO start:', await txt('#info'));
await p.screenshot({ path: `${E}/s1-address.png` });
async function swing(label) {
  await p.keyboard.press('Space'); await sleep(1345); // top of backswing at 1.35 s
  await p.keyboard.down('KeyZ'); await sleep(60); await p.keyboard.down('KeyX'); await sleep(90); await p.keyboard.down('KeyC');
  await sleep(900); await p.keyboard.up('KeyZ'); await p.keyboard.up('KeyX'); await p.keyboard.up('KeyC');
  console.log(label, 'CARD:', await txt('#card')); console.log(label, 'INFO right after:', await txt('#info'));
}
await p.keyboard.press('Digit1'); await swing('shot1');
await sleep(2500); await p.screenshot({ path: `${E}/s2-flight.png` });
await sleep(14000); console.log('INFO after landing:', await txt('#info')); await p.screenshot({ path: `${E}/s3-landed.png` });
// walk toward ball
const near = async () => (await txt('#prompt')).includes('address');
await p.keyboard.down('KeyW'); for (let i = 0; i < 400 && !(await near()); i++) await sleep(100); await p.keyboard.up('KeyW');
for (const k of ['KeyA', 'KeyD']) { if (await near()) break; await p.keyboard.down(k); for (let i = 0; i < 16 && !(await near()); i++) await sleep(250); await p.keyboard.up(k); }
console.log('PROMPT near ball:', await txt('#prompt')); await p.screenshot({ path: `${E}/s4-at-ball.png` });
await p.keyboard.press('Digit7'); await swing('shot2');
console.log('ERRORS:', errs.length ? errs : 'none'); await b.close();
