// Browser check of the Box Buggy (PRD/07) against a LOCAL server (never prod):
//   npx tsx scripts/e2e-cart.mjs <playwright index.mjs> <chrome binary> <screenshot dir> [url]
// Solo race on hole 1: walk-free enter (E), drive 100 m, drive at the green until the cart stops at its edge, Space in the cart,
// drive back to the ball, get out (E), walk up and take the stance. Prints each step and the cart's ground from the shared lie grid.
import { cartGround } from '../src/shared/cart.ts';
import { hole } from '../src/server/course.ts';
const [pwPath, exe, outDir, url = 'http://localhost:3197/'] = process.argv.slice(2);
const { chromium } = await import(pwPath);
const b = await chromium.launch({ executablePath: exe, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = [], snaps = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
p.on('websocket', ws => ws.on('framereceived', f => { const t = String(f.payload); if (t.includes('"t":"snap"')) snaps.push(t); }));
const sleep = ms => p.waitForTimeout(ms), R = (k, v) => console.log(k.padEnd(30), v);
const txt = async s => (await p.innerText(s).catch(() => '')).replace(/\s+/g, ' ');
const st = () => p.evaluate(() => { const w = window.__ace.world, e = w.ents.get(w.selfId); return { ...e.cs, driving: e.driving }; });
const H = hole(0), pin = H.info.pin;

await p.goto(url); await p.fill('#nm', 'Cart'); await p.click('[data-act=name]');
await p.click('[data-act=create]'); await p.click('[data-act=solo]');
await p.waitForSelector('#bag', { state: 'visible', timeout: 15000 }); await sleep(7000);
R('prompt at the tee:', await txt('#prompt'));
// model views at the reference angles (genesis-1 rear three-quarter, genesis-3 front three-quarter): render once with a placed camera and grab the canvas
for (const [name, ox, oy, oz] of [['cart-model-rear34', -4.5, 1.6, -5.5], ['cart-model-front34', 4.5, 1.8, 5.5]]) {
  const png = await p.evaluate(([ox, oy, oz]) => {
    const w = window.__ace.world, e = w.ents.get(w.selfId), c = e.cart.root.position, cam = w.cam;
    cam.position.set(c.x + ox, oy, c.z + oz); cam.lookAt(c.x, 1.0, c.z); w.renderer.render(w.scene, cam); return w.renderer.domElement.toDataURL('image/png');
  }, [ox, oy, oz]);
  (await import('node:fs')).writeFileSync(`${outDir}/${name}.png`, Buffer.from(png.split(',')[1], 'base64'));
}
await p.keyboard.press('KeyE'); await sleep(300);
const s0 = await st(); R('after E (driving?):', s0.driving + ' | ' + await txt('#prompt'));
await p.keyboard.press('Space'); await sleep(200); R('Space in the cart:', await txt('#toast') + ' | meter ' + await p.evaluate(() => getComputedStyle(document.querySelector('#meter')).display));

/** Steer toward (tx, tz) with the arrow keys until stop() says so or the time runs out. */
async function drive(tx, tz, stop, ms) {
  let still = 0, bumps = 0; const t0 = Date.now(); await p.keyboard.down('KeyW');
  while (Date.now() - t0 < ms) {
    const s = await st(), want = Math.atan2(tx - s.x, tz - s.z), d = Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw));
    await p.keyboard.up('KeyA'); await p.keyboard.up('KeyD');
    if (Math.abs(d) > 0.05) await p.keyboard.down(d > 0 ? 'KeyD' : 'KeyA');
    const v = Math.hypot(s.vx, s.vz); still = v < 0.6 ? still + 1 : 0;
    if (stop(s, still)) break;
    if (still >= 8) {                                                         // nosed into blocked ground short of the goal (a bunker lip): back up, turning, and retry
      for (const k of ['KeyW', 'KeyA', 'KeyD']) await p.keyboard.up(k);
      await p.keyboard.down('KeyS'); await p.keyboard.down('KeyA'); await sleep(1500); await p.keyboard.up('KeyS'); await p.keyboard.up('KeyA');
      await p.keyboard.down('KeyW'); still = 0; bumps++;
    }
    await sleep(100);
  }
  for (const k of ['KeyW', 'KeyA', 'KeyD']) await p.keyboard.up(k);
  await sleep(600); return { ...(await st()), backups: bumps };
}
let top = 0;
const s1 = await drive(pin.x, pin.z, s => { top = Math.max(top, Math.hypot(s.vx, s.vz)); return Math.hypot(s.x - s0.x, s.z - s0.z) >= 100; }, 20000);
R('drove (m) / top speed (m/s):', `${Math.hypot(s1.x - s0.x, s1.z - s0.z).toFixed(1)} / ${top.toFixed(1)}`);
await p.screenshot({ path: outDir + '/cart-driving.png' });
const s2 = await drive(pin.x, pin.z, (s, still) => still >= 6 && Math.hypot(s.x - pin.x, s.z - pin.z) < 50, 60000);
R('backed off blocked ground:', s2.backups + ' times on the way');
R('stopped at the green edge:', `(${s2.x.toFixed(1)}, ${s2.z.toFixed(1)}) ${Math.hypot(s2.x - pin.x, s2.z - pin.z).toFixed(1)} m from the pin, ground ${cartGround(0, s2.x, s2.z)}, lie ${H.surfaceAt(s2.x, s2.z)}`);
const ahead = { x: s2.x + Math.sin(s2.yaw) * 2.5, z: s2.z + Math.cos(s2.yaw) * 2.5 };
R('2.5 m ahead of the cart:', `ground ${cartGround(0, ahead.x, ahead.z)}, lie ${H.surfaceAt(ahead.x, ahead.z)}`);
await p.screenshot({ path: outDir + '/cart-green-edge.png' });
// back to the ball on the tee, then out and on foot
const s3 = await drive(1, -0.5, (s, still) => Math.hypot(s.x - 1, s.z + 0.5) < 6 || (still >= 6 && Math.hypot(s.x - 1, s.z + 0.5) < 10), 60000);
R('back near the ball:', `${Math.hypot(s3.x - 1, s3.z + 0.5).toFixed(1)} m`);
await p.keyboard.press('KeyE'); await sleep(300); R('after E (driving?):', (await st()).driving + ' | ' + await txt('#prompt'));
for (let i = 0; i < 60 && !(await txt('#prompt')).includes('Space: take your stance'); i++) {   // walk to the ball (tee, origin) in short arrow taps, relative to the facing
  const g = await p.evaluate(() => { const w = window.__ace.world, e = w.ents.get(w.selfId); return { x: -e.golfer.position.x, z: e.golfer.position.z, yaw: -e.golfer.rotation.y }; });
  const a = Math.atan2(Math.sin(Math.atan2(-g.x, -g.z) - g.yaw), Math.cos(Math.atan2(-g.x, -g.z) - g.yaw));
  const k = Math.abs(a) < Math.PI / 4 ? 'KeyW' : Math.abs(a) > 3 * Math.PI / 4 ? 'KeyS' : a > 0 ? 'KeyD' : 'KeyA';
  await p.keyboard.down('ShiftLeft'); await p.keyboard.down(k); await sleep(100); await p.keyboard.up(k); await p.keyboard.up('ShiftLeft'); await sleep(60);
}
R('prompt on foot:', await txt('#prompt'));
await p.keyboard.press('Space'); await sleep(250);
R('stance meter shown:', await p.evaluate(() => getComputedStyle(document.querySelector('#meter')).display) + ' | ' + await txt('#meter'));
await p.screenshot({ path: outDir + '/cart-stance.png' });
await p.keyboard.press('Escape');
R('server snaps (refused moves):', snaps.length); R('ERRORS:', errs.length ? errs : 'none'); await b.close();
