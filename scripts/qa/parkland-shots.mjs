// Parkland tree QA: hole 1 tee on Bethpage Black and Aronimink, plus a mid-fairway view, through the real game page and ws server
// at a chosen tier (default medium), logging triangles and draw calls per frame. Pass "pending" to preview models awaiting QA.
// npx tsx scripts/qa/parkland-shots.mjs <playwright index.mjs> <chrome binary> [url] [outdir] [tier] [pending]
import { mkdirSync } from 'node:fs';
const [pwPath, chrome, url = 'http://localhost:3918/', out = 'assets/qa/parkland', tier = 'medium', pending = ''] = process.argv.slice(2);
const { holesOf } = await import('../../src/server/course.ts');
const { chromium } = await import(pwPath);
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: chrome, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
let n = 0;
for (const course of ['bethpage-black', 'aronimink']) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(t => localStorage.setItem('ace.gfx', t), tier);
  const p = await ctx.newPage(), errs = []; let sock = null, self = '', block = false;
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.routeWebSocket(/\/ws$/, ws => {
    const server = ws.connectToServer(); sock = ws;
    ws.onMessage(m => { if (block && /"t":"move"/.test(m)) return; server.send(m); });   // the server would snap a jump back
    server.onMessage(m => { try { const j = JSON.parse(m); if (j.t === 'welcome') self = j.sessionId; } catch { } ws.send(m); });
  });
  await p.goto(url + (pending ? '?assets=pending' : '')); await p.fill('#nm', `Trees${++n}`); await p.click('[data-act=name]');
  await p.waitForSelector('[data-act=create]');
  if (await p.$(`[data-act=course][data-v=${course}]`)) await p.click(`[data-act=course][data-v=${course}]`); await p.click('[data-act=create]'); await p.click('[data-act=solo]');
  await p.waitForSelector('#bag', { state: 'visible', timeout: 20000 }); await p.waitForTimeout(12000);
  const shot = async name => {
    const info = await p.evaluate(() => { const r = window.__ace.world.renderer; return { tris: r.info.render.triangles, calls: r.info.render.calls }; });
    await p.screenshot({ path: `${out}/${name}.png` }); console.log(`${out}/${name}.png`, `tris ${info.tris} calls ${info.calls}`);
  };
  await shot(`${course}-hole01-tee${pending ? '-pending' : ''}`);
  const info = holesOf(course)[0].info; block = true;   // mid-fairway on hole 1: tree lines on both sides
  sock.send(JSON.stringify({ t: 'nextHole', playerId: self, hole: info, ball: { strokes: 1, holedOut: false, surface: 'fairway', x: 0, z: info.pin.z * 0.5 } }));
  await p.waitForTimeout(9000);
  await shot(`${course}-hole01-fairway${pending ? '-pending' : ''}`);
  if (errs.length) console.log('  console:', errs.slice(0, 4).join(' / '));
  await ctx.close();
}
await b.close();
