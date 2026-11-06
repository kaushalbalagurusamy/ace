// Bakes crisp surface detail from a generated concept image into a generated GLB's own UV textures (triplanar projection, baked per texel),
// so a rock keeps its generated shape and colour layout but loses the generator's soft felt/crosshatch surface.
// A square crop of the concept (pure rock surface) is tiled over the model in world space (mirror-repeat, no seams); per texel:
//   albedo = blur(generated albedo) * (crop colour / crop mean)^mix       (grain, pits, fissures from the concept)
//   normal = blur(generated normal) + height gradient of the crop along the texel's UV tangent frame (crisp relief)
// Usage: node scripts/bake_detail.mjs IN.glb CONCEPT.png OUT.glb --crop x,y,w [--height 1.4] [--tile 0.6] [--mix 1] [--bump 2] [--blur 2] [--nblur 4 | -1 drops the generated normal map] [--size 2048]
//   --crop: square region of the concept in its own pixels; --tile: metres of rock one crop covers; --height: model height in metres (sets world scale).
import { createRequire } from 'node:module';
const req = createRequire((process.env.GT_MODULES ?? '/Users/kaushal/.npm/_npx/a6797f7ff67bb1f2/node_modules') + '/x.js');
const { NodeIO } = req('@gltf-transform/core'); const { ALL_EXTENSIONS } = req('@gltf-transform/extensions'); const sharp = req('sharp'); const draco3d = req('draco3dgltf');

const [inp, concept, out, ...rest] = process.argv.slice(2);
const opt = { height: 1.4, tile: 0.6, mix: 1, bump: 2, blur: 2, nblur: 4, size: 2048 };
for (let i = 0; i < rest.length; i += 2) opt[rest[i].slice(2)] = rest[i + 1];
const [cx, cy, cw] = opt.crop.split(',').map(Number), S = +opt.size, TILE = +opt.tile, MIX = +opt.mix, BUMP = +opt.bump;

// Crop: colour ratio to its mean (detail only) and a high-passed height (luminance minus its blur), both sampled with mirror-repeat.
const P = 512, { data: pc0 } = await sharp(concept).extract({ left: cx, top: cy, width: cw, height: cw }).resize(P, P).removeAlpha().raw().toBuffer({ resolveWithObject: true });
// Seamless tile: crossfade the crop with a copy shifted by half a tile, weighted toward the shifted copy near the crop's edges
// (mirror tiling left kaleidoscope diamonds on flat faces).
const pc = Buffer.alloc(pc0.length);
for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) {
  const w = Math.min(1, Math.sin(Math.PI * (x + 0.5) / P) * Math.sin(Math.PI * (y + 0.5) / P) * 2), s = (((y + P / 2) % P) * P + (x + P / 2) % P) * 3, d = (y * P + x) * 3;
  for (let c = 0; c < 3; c++) pc[d + c] = pc0[d + c] * w + pc0[s + c] * (1 - w);
}
const mean = [0, 0, 0]; for (let i = 0; i < pc.length; i++) mean[i % 3] += pc[i] / (P * P);
const lum = new Float32Array(P * P); for (let i = 0; i < P * P; i++) lum[i] = (pc[3 * i] + pc[3 * i + 1] + pc[3 * i + 2]) / 765;
const lowL = await sharp(Buffer.from(Uint8Array.from(lum, v => v * 255)), { raw: { width: P, height: P, channels: 1 } }).blur(12).raw().toBuffer();
const hgt = Float32Array.from(lum, (v, i) => v - lowL[i] / 255);
const wrap = (v) => ((v % 1) + 1) % 1;   // repeat in [0,1)
const samp = (arr, ch, u, v, c = 0) => { const x = wrap(u) * P, y = wrap(v) * P, x0 = Math.floor(x) % P, y0 = Math.floor(y) % P, x1 = (x0 + 1) % P, y1 = (y0 + 1) % P, fx = x - Math.floor(x), fy = y - Math.floor(y);
  const g = (xx, yy) => arr[(yy * P + xx) * ch + c]; return (g(x0, y0) * (1 - fx) + g(x1, y0) * fx) * (1 - fy) + (g(x0, y1) * (1 - fx) + g(x1, y1) * fx) * fy; };
const tri = (fn0, p, n) => { const fn = (u, v) => 0.5 * fn0(u, v) + 0.5 * fn0(0.8 * u - 0.6 * v + 0.37, 0.6 * u + 0.8 * v + 0.11);   // second copy rotated 37 deg hides the tile period
  let w = n.map(a => a ** 4); const s = w[0] + w[1] + w[2]; w = w.map(a => a / s);   // triplanar blend of a sampler fn(u, v)
  return w[0] * fn(p[2] / TILE + 0.31, p[1] / TILE) + w[1] * fn(p[0] / TILE, p[2] / TILE + 0.57) + w[2] * fn(p[0] / TILE + 0.73, p[1] / TILE + 0.19); };   // offsets decorrelate the three planes

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule(), 'draco3d.encoder': await draco3d.createEncoderModule() });
const doc = await io.read(inp);
// World-space scale so --tile is in metres: the whole model is normalised to --height.
let lo = Infinity, hi = -Infinity; const prims = [];
for (const n of doc.getRoot().listNodes()) { const M = n.getWorldMatrix(); for (const p of n.getMesh()?.listPrimitives() ?? []) { prims.push([p, M]); const pos = p.getAttribute('POSITION'); for (let i = 0; i < pos.getCount(); i++) { const v = pos.getElement(i, []), y = M[1] * v[0] + M[5] * v[1] + M[9] * v[2] + M[13]; lo = Math.min(lo, y); hi = Math.max(hi, y); } } }
const k = +opt.height / (hi - lo), xf = (M, v) => [0, 1, 2].map(r => (M[r] * v[0] + M[4 + r] * v[1] + M[8 + r] * v[2] + M[12 + r]) * k);
const xn = (M, v) => { const n = [0, 1, 2].map(r => M[r] * v[0] + M[4 + r] * v[1] + M[8 + r] * v[2]), l = Math.hypot(...n) || 1; return n.map(a => a / l); };

for (const [prim, M] of prims) {
  const mat = prim.getMaterial(), bt = mat?.getBaseColorTexture(); if (!bt) continue;
  const alb = await sharp(Buffer.from(bt.getImage())).resize(S, S).removeAlpha().blur(+opt.blur || 0.3).raw().toBuffer();
  const nt = mat.getNormalTexture(), nrm = nt && +opt.nblur >= 0 ? await sharp(Buffer.from(nt.getImage())).resize(S, S).removeAlpha().blur(+opt.nblur || 0.3).raw().toBuffer() : Buffer.alloc(S * S * 3, 0).fill(128).map((v, i) => (i % 3 === 2 ? 255 : 128));
  const oa = Buffer.from(alb), on = Buffer.from(nrm), done = new Uint8Array(S * S);
  const pos = prim.getAttribute('POSITION'), nor = prim.getAttribute('NORMAL'), uv = prim.getAttribute('TEXCOORD_0'), idx = prim.getIndices();
  const I = idx ? idx.getArray() : Uint32Array.from({ length: pos.getCount() }, (_, i) => i);
  for (let t = 0; t < I.length; t += 3) {
    const ids = [I[t], I[t + 1], I[t + 2]], p = ids.map(i => xf(M, pos.getElement(i, []))), n = ids.map(i => xn(M, nor ? nor.getElement(i, []) : [0, 1, 0])), q = ids.map(i => uv.getElement(i, []).map(c => c * S));
    // UV tangent frame of this triangle: T = dP/du, B = dP/dv (what three.js derives when no TANGENT attribute is present)
    const e1 = p[1].map((a, i) => a - p[0][i]), e2 = p[2].map((a, i) => a - p[0][i]), du1 = q[1][0] - q[0][0], dv1 = q[1][1] - q[0][1], du2 = q[2][0] - q[0][0], dv2 = q[2][1] - q[0][1];
    const det = du1 * dv2 - du2 * dv1; if (Math.abs(det) < 1e-9) continue;
    const T = e1.map((a, i) => (a * dv2 - e2[i] * dv1) / det), B = e2.map((a, i) => (a * du1 - e1[i] * du2) / det), tl = Math.hypot(...T) || 1, bl = Math.hypot(...B) || 1;
    const Tn = T.map(a => a / tl), Bn = B.map(a => a / bl), eps = TILE / P;   // one crop pixel, in metres
    const x0 = Math.max(0, Math.floor(Math.min(q[0][0], q[1][0], q[2][0]) - 1)), x1 = Math.min(S - 1, Math.ceil(Math.max(q[0][0], q[1][0], q[2][0]) + 1));
    const y0 = Math.max(0, Math.floor(Math.min(q[0][1], q[1][1], q[2][1]) - 1)), y1 = Math.min(S - 1, Math.ceil(Math.max(q[0][1], q[1][1], q[2][1]) + 1));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5, d = (q[1][1] - q[2][1]) * (q[0][0] - q[2][0]) + (q[2][0] - q[1][0]) * (q[0][1] - q[2][1]);
      const a = ((q[1][1] - q[2][1]) * (px - q[2][0]) + (q[2][0] - q[1][0]) * (py - q[2][1])) / d, b = ((q[2][1] - q[0][1]) * (px - q[2][0]) + (q[0][0] - q[2][0]) * (py - q[2][1])) / d, c = 1 - a - b;
      const m = -1.5 / Math.max(1, Math.abs(d) ** 0.5); if (a < m || b < m || c < m) continue;   // 1.5-texel gutter so seams do not show the old texture
      const k2 = y * S + x; if (done[k2] && (a < 0 || b < 0 || c < 0)) continue; done[k2] = 1;
      const W = [a, b, c].map(v => Math.min(1, Math.max(0, v))), P3 = [0, 1, 2].map(i => W[0] * p[0][i] + W[1] * p[1][i] + W[2] * p[2][i]), N = xn([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], [0, 1, 2].map(i => W[0] * n[0][i] + W[1] * n[1][i] + W[2] * n[2][i])), An = N.map(Math.abs);
      for (let ch = 0; ch < 3; ch++) { const r = tri((u, v) => samp(pc, 3, u, v, ch), P3, An) / mean[ch]; oa[k2 * 3 + ch] = Math.min(255, alb[k2 * 3 + ch] * Math.pow(Math.max(0.05, r), MIX)); }
      const h = pp => tri((u, v) => samp(hgt, 1, u, v), pp, An), h0 = h(P3), ht = (h(P3.map((v, i) => v + eps * Tn[i])) - h0) / eps, hb = (h(P3.map((v, i) => v + eps * Bn[i])) - h0) / eps;
      const gx = (nrm[k2 * 3] / 127.5 - 1) - BUMP * ht * eps * 4, gy = (nrm[k2 * 3 + 1] / 127.5 - 1) - BUMP * hb * eps * 4, gz = nrm[k2 * 3 + 2] / 127.5 - 1, l = Math.hypot(gx, gy, gz) || 1;
      on[k2 * 3] = (gx / l + 1) * 127.5; on[k2 * 3 + 1] = (gy / l + 1) * 127.5; on[k2 * 3 + 2] = (gz / l + 1) * 127.5;
    }
  }
  bt.setImage(new Uint8Array(await sharp(oa, { raw: { width: S, height: S, channels: 3 } }).png().toBuffer())).setMimeType('image/png');
  const ntex = nt ?? doc.createTexture('detail-normal'); ntex.setImage(new Uint8Array(await sharp(on, { raw: { width: S, height: S, channels: 3 } }).png().toBuffer())).setMimeType('image/png');
  if (!nt) mat.setNormalTexture(ntex);
  mat.setRoughnessFactor(1).setMetallicFactor(0);
  console.log('baked', mat.getName() || 'material', 'texels', done.reduce((s, v) => s + v, 0), 'of', S * S);
}
await io.write(out, doc);
