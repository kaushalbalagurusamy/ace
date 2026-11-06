// Post-process for the Meshy Genesis Box Buggy body (assets/manifest.json row cart-body): cut out its four wheels so the code wheels
// (spin, steer, suspension) take their place, turn its opaque black canopy into tinted see-through glass, and pull the colours toward
// the refs/cart photos where the generator drifted (interior grey-white -> cream tan, the rear's copy of the front white stripes ->
// the red GENESIS light bar). All in the raw model's units and axes (length along x, rear at +x, y up).
// Usage: node scripts/fit_cart_meshy.mjs <dir-with-@gltf-transform/core-and-sharp> <in.glb> <out.glb>
import { createRequire } from 'node:module'; import { join, resolve } from 'node:path';
const [dir, inp, out] = process.argv.slice(2);
const req = createRequire(join(resolve(dir), 'x.js')), { NodeIO } = req('@gltf-transform/core'), sharp = req('sharp');
// measured on cart-meshy-2 (side render and vertex histograms): wheel centres (±WX, WY), radius WR, tyres outboard of |z| > WZ
// env CUT="WX,WY,WR,WZ" re-measures them for another mesh; CUT_ONLY=1 keeps its own canopy and paint (only tyres cut, interior tint)
const [WX, WY, WR, WZ] = (process.env.CUT ?? '0.75,-0.3,0.25,0.28').split(',').map(Number), BELT = -0.06, CUT_ONLY = process.env.CUT_ONLY === '1';
const DROP = process.env.DROP?.split(',').map(Number);   // "x0,x1,y0,y1,z0,z1" raw box (CUT_ONLY mode)
const io = new NodeIO(), doc = await io.read(inp), root = doc.getRoot();
const prim = root.listMeshes()[0].listPrimitives()[0], mat = prim.getMaterial();
const pos = prim.getAttribute('POSITION').getArray(), uv = prim.getAttribute('TEXCOORD_0').getArray(), ia = prim.getIndices().getArray();
const img = mat.getBaseColorTexture(), { data: px, info } = await sharp(Buffer.from(img.getImage())).raw().toBuffer({ resolveWithObject: true });
const at = (u, w) => {   // base colour (0..1) at uv (u, w), nearest texel
  const x = Math.min(info.width - 1, Math.max(0, Math.round(u * (info.width - 1)))), y = Math.min(info.height - 1, Math.max(0, Math.round(w * (info.height - 1))));
  const o = (y * info.width + x) * info.channels; return [px[o] / 255, px[o + 1] / 255, px[o + 2] / 255];
};
const texel = v => at(uv[2 * v], uv[2 * v + 1]);
const P = (v, c) => pos[3 * v + c];
const body = [], glass = [], frames = [], navySum = [0, 0, 0]; let cut = 0, navyN = 0;
for (let t = 0; t < ia.length; t += 3) {
  const v = [ia[t], ia[t + 1], ia[t + 2]], c = [0, 1, 2].map(k => (P(v[0], k) + P(v[1], k) + P(v[2], k)) / 3);
  if (Math.abs(c[2]) > WZ && Math.hypot(Math.abs(c[0]) - WX, c[1] - WY) < WR) { cut++; continue; }   // tyre
  if (CUT_ONLY) {   // DROP: the generated steering wheel's dark triangles, so the code wheel (which turns with steer) shows instead
    const tc = at((uv[2 * v[0]] + uv[2 * v[1]] + uv[2 * v[2]]) / 3, (uv[2 * v[0] + 1] + uv[2 * v[1] + 1] + uv[2 * v[2] + 1]) / 3);
    if (DROP && c.every((x, k) => x > DROP[2 * k] && x < DROP[2 * k + 1]) && Math.max(...tc) - Math.min(...tc) < 0.08) { cut++; continue; }   // its black rim and grey face (cream dash kept)
    body.push(...v); continue;
  }
  // the triangle's colour from its centroid texel (vertex texels sit on atlas seams and can belong to the neighbouring chart)
  const col = at((uv[2 * v[0]] + uv[2 * v[1]] + uv[2 * v[2]]) / 3, (uv[2 * v[0] + 1] + uv[2 * v[1] + 1] + uv[2 * v[2] + 1]) / 3), luma = 0.3 * col[0] + 0.59 * col[1] + 0.11 * col[2];
  // glass: the canopy shell above the belt line (sides, roof, end windows), except its navy frame and the end-panel stripes / light bar
  const shell = c[1] > BELT && (Math.abs(c[2]) > 0.42 || c[1] > 0.3 || Math.abs(c[0]) > 0.62), screen = c[0] < -0.7 && c[1] > 0.12;   // front windscreen: Meshy painted it navy
  const navy = col[2] > col[0] + 0.05 && luma > 0.27 && luma < 0.55, band = Math.abs(c[0]) > 0.8 && c[1] < 0.12 && luma > 0.45;
  // the photos' opaque navy frame: the roof and the four corner pillars (Meshy left them glass-dark), repainted navy below
  const frame = c[1] > BELT && (c[1] > 0.44 || (Math.abs(c[0]) > 0.66 && Math.abs(c[2]) > 0.36));
  if (frame) frames.push(v);
  (!frame && (screen || (shell && !navy && !band)) ? glass : body).push(...v);
  if (navy && shell) { navySum.forEach((_, i) => { navySum[i] += col[i]; }); navyN++; }
}
// end panels repainted in texture space (Meshy smeared them into one grey bar at both ends): navy with two white pinstripes at the
// front (refs/cart genesis-1), navy with a red light bar at the rear (genesis-3); bands placed by each texel's height on the panel
const NAVY = navySum.map(s => s / navyN), ends = [];
for (let t = 0; t < body.length; t += 3) {
  const v = body.slice(t, t + 3), c = [0, 1, 2].map(k => (P(v[0], k) + P(v[1], k) + P(v[2], k)) / 3);
  if (Math.abs(c[0]) > 0.77 && c[1] > -0.14 && c[1] < 0.14 && Math.abs(c[2]) < 0.5) ends.push(v);
}
const paintTris = (tris, paint) => {   // paint(k): colour for a texel at height k (0..1) between the tris' lowest and highest points
  const ys = tris.flat().map(v => P(v, 1)), lo = Math.min(...ys), hi = Math.max(...ys);
  for (const v of tris) {
    const q = v.map(i => [uv[2 * i] * (info.width - 1), uv[2 * i + 1] * (info.height - 1)]), y = v.map(i => P(i, 1));
    const d = (q[1][1] - q[2][1]) * (q[0][0] - q[2][0]) + (q[2][0] - q[1][0]) * (q[0][1] - q[2][1]); if (Math.abs(d) < 1e-9) continue;
    for (let py = Math.floor(Math.min(...q.map(p => p[1]))); py <= Math.ceil(Math.max(...q.map(p => p[1]))); py++)
      for (let px_ = Math.floor(Math.min(...q.map(p => p[0]))); px_ <= Math.ceil(Math.max(...q.map(p => p[0]))); px_++) {
        const a = ((q[1][1] - q[2][1]) * (px_ - q[2][0]) + (q[2][0] - q[1][0]) * (py - q[2][1])) / d, b = ((q[2][1] - q[0][1]) * (px_ - q[2][0]) + (q[0][0] - q[2][0]) * (py - q[2][1])) / d;
        if (a < -0.05 || b < -0.05 || a + b > 1.05) continue;   // a texel of margin so the chart edges are covered too
        const rgb = paint((a * y[0] + b * y[1] + (1 - a - b) * y[2] - lo) / (hi - lo)), o = (py * info.width + px_) * info.channels;
        if (py >= 0 && py < info.height && px_ >= 0 && px_ < info.width) rgb.forEach((x, i) => { px[o + i] = Math.round(x * 255); });
      }
  }
};
if (!CUT_ONLY) {
  paintTris(ends.filter(v => P(v[0], 0) < 0), k => (k > 0.66 && k < 0.71) || (k > 0.76 && k < 0.81) ? [0.93, 0.93, 0.91] : NAVY);
  paintTris(ends.filter(v => P(v[0], 0) > 0), k => k > 0.7 && k < 0.82 ? [0.86, 0.12, 0.1] : NAVY);
  paintTris(frames, () => NAVY);
}
if (!CUT_ONLY) img.setImage(await sharp(px, { raw: info }).png().toBuffer()).setMimeType('image/png');
// vertex tint (COLOR_0 multiplies the base colour): the grey-white interior below the canopy toward the photos' cream tan
const n = pos.length / 3, col = new Float32Array(n * 4).fill(1);
for (let v = 0; v < n; v++) {
  const x = P(v, 0), y = P(v, 1), z = P(v, 2), [r, g, b] = texel(v), sat = Math.max(r, g, b) - Math.min(r, g, b), bright = (r + g + b) / 3;
  if (Math.abs(x) < 0.72 && Math.abs(z) < 0.46 && y > -0.38 && y < 0.12 && sat < 0.12 && bright > 0.25) col.set([1.0, 0.86, 0.66], 4 * v);
}
prim.setAttribute('COLOR_0', doc.createAccessor().setType('VEC4').setArray(col).setBuffer(prim.getAttribute('POSITION').getBuffer()));
prim.getIndices().setArray(new Uint32Array(body));
const glassMat = doc.createMaterial('glass').setBaseColorFactor([0.8, 0.88, 0.95, 0.12]).setAlphaMode('BLEND').setMetallicFactor(0).setRoughnessFactor(0.08).setDoubleSided(true);
const gp = doc.createPrimitive().setMaterial(glassMat).setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(glass)).setBuffer(prim.getIndices().getBuffer()));
for (const s of prim.listSemantics()) if (s !== 'COLOR_0') gp.setAttribute(s, prim.getAttribute(s));
if (glass.length) root.listMeshes()[0].addPrimitive(gp);
await io.write(out, doc);
console.log(`triangles ${ia.length / 3}: tyres cut ${cut}, glass ${glass.length / 3}, body ${body.length / 3}`);
