// 1280x720 screenshots of the course picker, hole 1 from the tee on Bethpage Black and Aronimink, and their iconic holes, against a
// LOCAL server (never prod), on the real GPU at the High tier. Iconic holes: the race starts on hole 1 and the page is then sent the
// server's own `nextHole` message for that hole (HoleInfo from src/server/course.ts), so no debug hook ships in the game.
// Usage: npx tsx scripts/qa/course-shots.mjs <playwright index.mjs> <chrome binary> [url] [outdir]
import { holesOf } from '../../src/server/course.ts';
const [pwPath, chrome, url = 'http://localhost:3130/', out = 'assets/qa/courses'] = process.argv.slice(2);
const { chromium } = await import(pwPath);
const b = await chromium.launch({ executablePath: chrome, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
let n = 0;
async function page() {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => localStorage.setItem('ace.gfx', 'high'));
  const p = await ctx.newPage(), errs = []; let sock = null, self = '';
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.routeWebSocket(/\/ws$/, ws => {
    const server = ws.connectToServer(); sock = ws;
    ws.onMessage(m => server.send(m));
    server.onMessage(m => { try { const j = JSON.parse(m); if (j.t === 'welcome') self = j.sessionId; } catch { /* binary */ } ws.send(m); });
  });
  await p.goto(url); await p.fill('#nm', `Shots${++n}`); await p.click('[data-act=name]');
  await p.waitForSelector('[data-act=create]');
  return { ctx, p, errs, inject: m => sock.send(JSON.stringify(m)), self: () => self };
}
const shot = async (p, name) => { await p.screenshot({ path: `${out}/${name}.png`, scale: 'css' }); console.log('saved', `${out}/${name}.png`); };

// 1) the picker in the waiting room, Bethpage Black chosen; then the host's own lobby card
{
  const { ctx, p, errs } = await page();
  await p.click('[data-act=course][data-v=bethpage-black]'); await p.waitForTimeout(2500);
  await shot(p, 'lobby-course-picker');
  await p.click('[data-act=create]'); await p.waitForSelector('[data-act=solo]'); await p.waitForTimeout(800);
  await shot(p, 'lobby-host-course');
  if (errs.length) console.log('  console:', errs.slice(0, 4).join(' / '));
  await ctx.close();
}
// 2) per course: hole 1 from the tee, then the iconic holes
for (const [course, iconic] of [['bethpage-black', [4, 15]], ['aronimink', [18]]]) {
  const { ctx, p, errs, inject, self } = await page();
  await p.click(`[data-act=course][data-v=${course}]`); await p.click('[data-act=create]'); await p.click('[data-act=solo]');
  await p.waitForSelector('#bag', { state: 'visible', timeout: 20000 }); await p.waitForTimeout(9000);
  await shot(p, `${course}-hole01-tee`);
  for (const h of iconic) {
    const info = holesOf(course)[h - 1].info;
    inject({ t: 'nextHole', playerId: self(), hole: info, ball: { x: 0, z: 0, strokes: 0, holedOut: false, surface: 'fairway' } });
    await p.waitForTimeout(7000);
    await shot(p, `${course}-hole${String(h).padStart(2, '0')}-tee`);
  }
  if (errs.length) console.log('  console:', errs.slice(0, 4).join(' / '));
  await ctx.close();
}
await b.close();
