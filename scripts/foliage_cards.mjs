// Adds alpha-clipped foliage cards to a generated tree GLB so its solid crown reads as ragged sprays with gaps.
// The card texture is cut from the tree's own generated concept image (foliage pixels kept, background and bark made transparent),
// and the cards are scattered over the generated crown surface (triangles whose albedo is green), so the asset stays generated.
// Optionally deletes tiny disconnected islands (floating shards) first.
// Usage: node scripts/foliage_cards.mjs IN.glb CONCEPT.png OUT.glb [--cards 1500] [--green #2E4630] [--min-island 0.002] [--size 1] [--flat 0.6] [--seed 1] [--min-y 0.35] [--tiers 4]
//   --flat: 0 = cards face outward from the crown surface, 1 = cards lie horizontal (cypress pads); --size scales the card edge.
import { createRequire } from 'node:module';
const req = createRequire((process.env.GT_MODULES ?? '/Users/kaushal/.npm/_npx/a6797f7ff67bb1f2/node_modules') + '/x.js');
const { NodeIO } = req('@gltf-transform/core'); const { ALL_EXTENSIONS } = req('@gltf-transform/extensions'); const sharp = req('sharp'); const draco3d = req('draco3dgltf');

const [inp, concept, out, ...rest] = process.argv.slice(2);
const opt = { cards: 1500, green: '#2E4630', 'min-island': 0, size: 1, flat: 0.6, seed: 1 };
for (let i = 0; i < rest.length; i += 2) opt[rest[i].slice(2)] = rest[i + 1];
let seed = +opt.seed; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const isGreen = (r, g, b) => g > r * 1.04 && g > b * 1.02;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(...a), norm = a => { const l = len(a) || 1; return a.map(v => v / l); }, add = (a, b, s = 1) => a.map((v, i) => v + b[i] * s);

// 1. Atlas: 4x4 tiles cut from the concept's foliage, alpha = foliage mask, colour graded to the target swatch.
const T = 256, N = 4, CELL = +(opt.cell ?? 160);   // --cell: crop size in the 1024-wide concept (smaller = finer tufts per card)
const { data: cd, info: ci } = await sharp(concept).resize({ width: 1024 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const fol = (x, y) => { const p = (y * ci.width + x) * 4, r = cd[p], g = cd[p + 1], b = cd[p + 2], l = (r + g + b) / 3; return l < 215 && (isGreen(r, g, b) || l < 55); };
const cells = [];
for (let y = 0; y + CELL <= ci.height; y += CELL / 2) for (let x = 0; x + CELL <= ci.width; x += CELL / 2) {
  let n = 0; for (let j = 0; j < CELL; j += 4) for (let i = 0; i < CELL; i += 4) n += fol(x + i, y + j); const f = n / (CELL * CELL / 16);
  if (f > 0.25 && f < 0.95) cells.push({ x, y, f });   // mostly foliage; the lobed mask below supplies the ragged outline
}
if (cells.length < 4) throw new Error(`only ${cells.length} usable foliage cells in ${concept}`);
cells.sort(() => rnd() - 0.5); const pick = Array.from({ length: N * N }, (_, i) => cells[i % cells.length]);
let sum = [0, 0, 0, 0]; for (let p = 0; p < cd.length; p += 4) if (fol((p / 4) % ci.width, Math.floor(p / 4 / ci.width))) { sum[0] += cd[p]; sum[1] += cd[p + 1]; sum[2] += cd[p + 2]; sum[3]++; }
const gain = hex(opt.green).map((t, c) => t / (sum[c] / sum[3]));
const atlas = Buffer.alloc(T * N * T * N * 4);
for (let k = 0; k < N * N; k++) {
  const c = pick[k], ox = (k % N) * T, oy = Math.floor(k / N) * T, ph = rnd() * 6.3, lobes = 7 + Math.floor(rnd() * 6);
  for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) {
    const sx = c.x + Math.floor(i * CELL / T), sy = c.y + Math.floor(j * CELL / T), sp = (sy * ci.width + sx) * 4, dp = ((oy + j) * T * N + ox + i) * 4;
    // frayed round mask: no straight tile edges survive, so each card reads as a ragged spray (and leaves a clear mip border)
    const dx = (i - T / 2) / (T / 2), dy = (j - T / 2) / (T / 2), rr = Math.hypot(dx, dy), th = Math.atan2(dy, dx);
    const on = fol(sx, sy) && rr < 0.8 + 0.08 * Math.sin(lobes * th + ph) + 0.1 * (rnd() - 0.5);
    // recesses are lifted to at least 55% of the target so they read as shade, not as black holes through the card
    const lift = Math.max(1, (0.55 * (hex(opt.green)[1])) / Math.max(1, cd[sp + 1] * gain[1]));
    for (let ch = 0; ch < 3; ch++) atlas[dp + ch] = Math.min(255, cd[sp + ch] * gain[ch] * lift); atlas[dp + 3] = on ? 255 : 0;
  }
}
const atlasPng = await sharp(atlas, { raw: { width: T * N, height: T * N, channels: 4 } }).png().toBuffer();
if (process.env.ATLAS_OUT) await sharp(atlasPng).toFile(process.env.ATLAS_OUT);   // for eyeballing the cut-outs

// 2. Crown surface: green-albedo triangles of the generated mesh, in world space.
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule(), 'draco3d.encoder': await draco3d.createEncoderModule() });
const doc = await io.read(inp); const root = doc.getRoot(); const tris = []; let removed = 0, kept = 0, lowRemoved = 0;
let yMin = Infinity, yMax = -Infinity;
for (const node of root.listNodes()) { const M = node.getWorldMatrix(); for (const prim of node.getMesh()?.listPrimitives() ?? []) { const pos = prim.getAttribute('POSITION'); for (let i = 0; i < (pos?.getCount() ?? 0); i++) { const v = pos.getElement(i, []), y = M[1] * v[0] + M[5] * v[1] + M[9] * v[2] + M[13]; yMin = Math.min(yMin, y); yMax = Math.max(yMax, y); } } }
// --min-y F: crown (green) triangles below F of the height are deleted and get no cards (clear trunk); --tiers K: cards only in K horizontal bands
const cutY = yMin + (yMax - yMin) * +(opt['min-y'] ?? 0), tierPh = rnd() * 6.3;
const inTier = y => !opt.tiers || Math.sin(2 * Math.PI * +opt.tiers * (y - cutY) / (yMax - cutY) + tierPh) > -0.55;
for (const node of root.listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue; const M = node.getWorldMatrix();
  const xf = v => [0, 1, 2].map(r => M[r] * v[0] + M[4 + r] * v[1] + M[8 + r] * v[2] + M[12 + r]);
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION'), uv = prim.getAttribute('TEXCOORD_0'), idx = prim.getIndices(), tex = prim.getMaterial()?.getBaseColorTexture();
    if (!pos || !idx) continue;
    const ia = Array.from(idx.getArray()), nt = ia.length / 3, P = i => xf(pos.getElement(i, []));
    const area = t => len(cross(sub(P(ia[3 * t + 1]), P(ia[3 * t])), sub(P(ia[3 * t + 2]), P(ia[3 * t])))) / 2;
    // islands: union triangles that share a welded vertex position; drop components below min-island of the total area
    if (+opt['min-island'] > 0) {
      const key = new Map(), par = Array.from({ length: nt }, (_, i) => i), f = i => (par[i] === i ? i : (par[i] = f(par[i])));
      for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) { const q = pos.getElement(ia[3 * t + k], []).map(v => Math.round(v * 1e4)).join(); if (key.has(q)) par[f(t)] = f(key.get(q)); else key.set(q, t); }
      const ca = new Map(); let tot = 0; for (let t = 0; t < nt; t++) { const a = area(t); tot += a; ca.set(f(t), (ca.get(f(t)) ?? 0) + a); }
      const keep = []; for (let t = 0; t < nt; t++) if (ca.get(f(t)) >= tot * +opt['min-island']) keep.push(ia[3 * t], ia[3 * t + 1], ia[3 * t + 2]); else removed++;
      idx.setArray(new Uint32Array(keep)); ia.length = 0; ia.push(...keep); kept += keep.length / 3;
    }
    let px = null, w = 0, h = 0;
    if (tex && uv) { const r = await sharp(Buffer.from(tex.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); px = r.data; w = r.info.width; h = r.info.height; }
    const low = new Set();
    for (let t = 0; t < ia.length / 3; t++) {
      if (px) {
        const u = (uv.getElement(ia[3 * t], [])[0] + uv.getElement(ia[3 * t + 1], [])[0] + uv.getElement(ia[3 * t + 2], [])[0]) / 3;
        const v = (uv.getElement(ia[3 * t], [])[1] + uv.getElement(ia[3 * t + 1], [])[1] + uv.getElement(ia[3 * t + 2], [])[1]) / 3;
        const x = Math.min(w - 1, Math.max(0, Math.floor((u - Math.floor(u)) * w))), y = Math.min(h - 1, Math.max(0, Math.floor((v - Math.floor(v)) * h))), p = (y * w + x) * 4;
        if (!isGreen(px[p], px[p + 1], px[p + 2])) continue;
      }
      const a = P(ia[3 * t]), b = P(ia[3 * t + 1]), c = P(ia[3 * t + 2]), n = cross(sub(b, a), sub(c, a)), ar = len(n) / 2;
      const cy = (a[1] + b[1] + c[1]) / 3; if (cy < cutY || !inTier(cy)) { low.add(t); continue; }   // opens the gaps between tiers in the mesh too
      if (ar > 0) tris.push({ a, b, c, n: norm(n), ar });
    }
    if (low.size) { idx.setArray(new Uint32Array(ia.filter((_, k) => !low.has(Math.floor(k / 3))))); lowRemoved += low.size; }
  }
}
const totalArea = tris.reduce((s, t) => s + t.ar, 0); if (!tris.length) throw new Error('no green crown triangles found');

// 3. Cards: area-weighted points on the crown, quads tilted between outward-facing and horizontal, slightly proud of the surface.
const nc = +opt.cards, s0 = Math.sqrt((2.2 * totalArea) / nc) * +opt.size, cum = []; let acc = 0; for (const t of tris) cum.push((acc += t.ar));
const P = [], Nn = [], UV = [], I = [], asp = Math.sqrt(+(opt.aspect ?? 1));   // --aspect 2: cards twice as long as wide (wind-sheared plates)
for (let k = 0; k < nc; k++) {
  const r = rnd() * acc; let lo = 0, hi = cum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < r) lo = m + 1; else hi = m; }
  const t = tris[lo]; let u = rnd(), v = rnd(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
  const p = add(add(t.a, sub(t.b, t.a), u), sub(t.c, t.a), v), s = s0 * (0.7 + 0.6 * rnd());
  if (!inTier(p[1])) { k--; continue; }   // shortcut: rejection sampling, fine while the bands keep well over half the crown
  const facing = norm(add(t.n.map(x => x * (1 - +opt.flat)), [0, +opt.flat, 0]));   // plane normal of the card
  // --wind x|z: card long axis follows that axis (with jitter), so the sprays streak leeward like the crown itself
  const jit = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5], rr = norm(opt.wind ? add(opt.wind === 'x' ? [1, 0, 0] : [0, 0, 1], jit, 0.7) : jit), ta = norm(sub(rr, facing.map(x => x * (rr[0] * facing[0] + rr[1] * facing[1] + rr[2] * facing[2])))), bb = cross(facing, ta);
  const tilt = (rnd() - 0.5) * 1.2, ba = norm(add(bb.map(x => x * Math.cos(tilt)), facing, Math.sin(tilt))), c = add(p, t.n, s * 0.12);
  const tile = Math.floor(rnd() * N * N), u0 = (tile % N) / N, v0 = Math.floor(tile / N) / N, fl = rnd() < 0.5, base = P.length / 3;
  for (const [i, j] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    P.push(...add(add(c, ta, (i * s * asp) / 2), ba, (j * s) / asp / 2)); Nn.push(...norm(add(t.n, [0, 0.6, 0])));
    UV.push(u0 + (((fl ? -i : i) + 1) / 2) / N, v0 + ((1 - j) / 2) / N);
  }
  I.push(base, base + 1, base + 2, base, base + 2, base + 3);
}
const buf = root.listBuffers()[0] ?? doc.createBuffer();
const acc3 = (arr, type) => doc.createAccessor().setArray(arr).setType(type).setBuffer(buf);
const mat = doc.createMaterial('foliage-cards').setBaseColorTexture(doc.createTexture('foliage-atlas').setImage(new Uint8Array(atlasPng)).setMimeType('image/png'))
  .setAlphaMode('MASK').setAlphaCutoff(0.5).setDoubleSided(true).setRoughnessFactor(1).setMetallicFactor(0);
const prim = doc.createPrimitive().setAttribute('POSITION', acc3(new Float32Array(P), 'VEC3')).setAttribute('NORMAL', acc3(new Float32Array(Nn), 'VEC3'))
  .setAttribute('TEXCOORD_0', acc3(new Float32Array(UV), 'VEC2')).setIndices(acc3(new Uint32Array(I), 'SCALAR')).setMaterial(mat);
const cardNode = doc.createNode('foliage-cards').setMesh(doc.createMesh('foliage-cards').addPrimitive(prim));
root.listScenes()[0].addChild(cardNode);
await io.write(out, doc);
console.log(JSON.stringify({ crownTris: tris.length, crownArea: +totalArea.toFixed(4), cards: nc, cardSize: +s0.toFixed(4), cells: cells.length, islandTrisRemoved: removed, lowCrownTrisRemoved: lowRemoved, trisKept: kept || undefined }));
