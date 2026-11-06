// Tee (hole 1) per course, Pebble hole 7 tee, and a green on Bethpage Black and Aronimink, through the real game page and ws server.
// npx tsx scripts/qa/course-elevation-shots.mjs <playwright index.mjs> <chrome binary> [url] [outdir], against a LOCAL server
const [pwPath, chrome, url = 'http://localhost:3918/', out = 'assets/qa/courses-elevation'] = process.argv.slice(2);
const { holesOf } = await import('../../src/server/course.ts');
const { chromium } = await import(pwPath);
const b = await chromium.launch({ executablePath: chrome, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
let n = 0;
async function page() {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => localStorage.setItem('ace.gfx', 'high'));
  const p = await ctx.newPage(), errs = []; let sock = null, self = '', block = false;
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.routeWebSocket(/\/ws$/, ws => {
    const server = ws.connectToServer(); sock = ws;
    ws.onMessage(m => { if (block && /"t":"move"/.test(m)) return; server.send(m); });   // the server would snap a jump to the green back
    server.onMessage(m => { try { const j = JSON.parse(m); if (j.t === 'welcome') self = j.sessionId; } catch { } ws.send(m); });
  });
  await p.goto(url); await p.fill('#nm', `Shots${++n}`); await p.click('[data-act=name]');
  await p.waitForSelector('[data-act=create]');
  return { ctx, p, errs, blockMoves: () => { block = true; }, inject: m => sock.send(JSON.stringify(m)), self: () => self };
}
const shot = async (p, name) => { await p.screenshot({ path: `${out}/${name}.png` }); console.log('saved', `${out}/${name}.png`); };
const goHole = async (t, course, h, ball) => {
  const info = holesOf(course)[h - 1].info; t.blockMoves();
  t.inject({ t: 'nextHole', playerId: t.self(), hole: info, ball: { strokes: 0, holedOut: false, surface: 'fairway', ...ball(info) } });
  await t.p.waitForTimeout(8000);
};
for (const course of ['pebble', 'bethpage-black', 'aronimink']) {
  const t = await page(), { p } = t;
  if (await p.$(`[data-act=course][data-v=${course}]`)) await p.click(`[data-act=course][data-v=${course}]`); await p.click('[data-act=create]'); await p.click('[data-act=solo]');
  await p.waitForSelector('#bag', { state: 'visible', timeout: 20000 }); await p.waitForTimeout(9000);
  await shot(p, `${course}-hole01-tee`);
  if (course === 'pebble') { await goHole(t, course, 7, () => ({ x: 0, z: 0 })); await shot(p, 'pebble-hole07-tee'); }
  else for (const h of course === 'bethpage-black' ? [15, 2] : [8, 11]) {   // greens well above or below the approach
    await goHole(t, course, h, i => ({ x: 2, z: i.pin.z - 9, surface: 'green' }));
    await shot(p, `${course}-hole${String(h).padStart(2, '0')}-green`);
  }
  if (t.errs.length) console.log('  console:', t.errs.slice(0, 4).join(' / '));
  await t.ctx.close();
}
await b.close();
