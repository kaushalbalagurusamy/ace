// One 1280x720 screenshot per graphics tier of hole 1 from the tee, against a LOCAL server (never prod), on the real GPU.
// Usage: node scripts/qa/graphics-shots.mjs <playwright index.mjs> <chrome binary> [url] [outdir]
// Prints, per tier, the F3 readout after settling and every turf file the page fetched (Low must never fetch a 1024/2048 file).
const [pwPath, chrome, url = 'http://localhost:3130/', out = 'assets/qa/graphics'] = process.argv.slice(2);
const { chromium } = await import(pwPath);
const b = await chromium.launch({ executablePath: chrome, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] });
for (const tier of ['low', 'medium', 'high', 'ultra']) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(t => localStorage.setItem('ace.gfx', t), tier);
  const p = await ctx.newPage(), turf = [], errs = [];
  p.on('request', r => { if (r.url().includes('/turf/')) turf.push(r.url().replace(/^.*\/turf\//, '')); });
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); if (m.text().startsWith('graphics:')) console.log('  ', m.text()); });
  await p.goto(url); await p.fill('#nm', `Shot${tier}`); await p.click('[data-act=name]');
  await p.click('[data-act=create]'); await p.click('[data-act=solo]');
  await p.waitForSelector('#bag', { state: 'visible', timeout: 15000 });
  await p.keyboard.press('F3'); await p.waitForTimeout(9000);          // countdown, turf bake and a few seconds of frames
  const fps = (await p.innerText('#fps')).replace(/\n/g, ' | ');
  await p.screenshot({ path: `${out}/hole1-tee-${tier}.png`, scale: 'css' });   // DPR 2 like a Retina Mac, saved at 1280x720
  console.log(tier.padEnd(7), fps, '\n   turf files:', [...new Set(turf)].join(' '), errs.length ? `\n   console: ${errs.slice(0, 4).join(' / ')}` : '');
  await ctx.close();
}
await b.close();
