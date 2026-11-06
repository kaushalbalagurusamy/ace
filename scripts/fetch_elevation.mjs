// Builds src/shared/course-height.ts: real Pebble Beach Golf Links elevation in each hole's game frame (docs/research/elevation.md).
//   npx tsx scripts/fetch_elevation.mjs [cacheDir]
// 1. OpenStreetMap (Overpass, ODbL): golf=hole ways (tee = first node) and golf=green polygons (centroid) inside the course boundary.
// 2. USGS 3DEP 1 m bare-earth DEM (public domain): ImageServer exportImage tiles in UTM 10N (EPSG:26910), uncompressed float32 TIFF.
// 3. Each hole's game frame (tee at the origin, pin on +z at the card length) is laid on the real tee-to-green line, scaled to its real
//    distance, and sampled on a 4 m grid. Greens are replaced by a fitted quadratic held to 1-3 % slope; the tee box is levelled.
import fs from 'node:fs';
import path from 'node:path';
import { GRIDS } from '../src/shared/course-grid.ts';
import { decodeGrid } from '../src/shared/gridtools.ts';
import { CARD } from '../src/server/course.ts';

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const CACHE = process.argv[2] ?? path.join(ROOT, '.elev-cache');
fs.mkdirSync(CACHE, { recursive: true });
const CELL = 4, M_PER_YD = 0.9144, UA = 'ace-golf-elevation/1.0 (game research; batch, cached)';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function cached(name, url, body) {
  const f = path.join(CACHE, name);
  if (fs.existsSync(f)) return fs.readFileSync(f);
  for (let i = 0; i < 6; i++) {
    const r = await fetch(url, body ? { method: 'POST', body, headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' } } : { headers: { 'User-Agent': UA } });
    const b = Buffer.from(await r.arrayBuffer());
    if (r.ok && b.length > 100 && b[0] !== 0x3c) { fs.writeFileSync(f, b); return b; }
    console.error(`retry ${name}: HTTP ${r.status}`); await sleep(5000 * 2 ** i);
  }
  throw new Error(`could not fetch ${name}`);
}

// ---- 1. OSM ----
const Q = '[out:json][timeout:90];area["leisure"="golf_course"]["name"~"Pebble Beach Golf"]->.c;(way["golf"="hole"](area.c);way["golf"="green"](area.c););out geom tags;';
const osm = JSON.parse(await cached('osm.json', 'https://overpass-api.de/api/interpreter', 'data=' + encodeURIComponent(Q)));
const holesOsm = osm.elements.filter(e => e.tags.golf === 'hole'), greensOsm = osm.elements.filter(e => e.tags.golf === 'green');

// ---- UTM 10N (WGS84 ellipsoid; NAD83 differs by about a metre here) ----
function utm(lat, lon) {
  const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996, n = f / (2 - f), A = (a / (1 + n)) * (1 + n * n / 4 + n ** 4 / 64);
  const al = [n / 2 - (2 / 3) * n * n + (5 / 16) * n ** 3, (13 / 48) * n * n - (3 / 5) * n ** 3, (61 / 240) * n ** 3];
  const phi = (lat * Math.PI) / 180, dl = ((lon + 123) * Math.PI) / 180, e = 2 * Math.sqrt(n) / (1 + n);
  const t = Math.sinh(Math.atanh(Math.sin(phi)) - e * Math.atanh(e * Math.sin(phi)));
  const xi = Math.atan2(t, Math.cos(dl)), eta = Math.atanh(Math.sin(dl) / Math.sqrt(1 + t * t));
  let E = eta, N = xi;
  for (let j = 1; j <= 3; j++) { E += al[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta); N += al[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta); }
  return { e: 500000 + k0 * A * E, n: k0 * A * N };
}
const centroid = g => { let a = 0, x = 0, y = 0; for (let i = 0; i < g.length - 1; i++) { const p = utm(g[i].lat, g[i].lon), q = utm(g[i + 1].lat, g[i + 1].lon), c = p.e * q.n - q.e * p.n; a += c; x += (p.e + q.e) * c; y += (p.n + q.n) * c; } return { e: x / (3 * a), n: y / (3 * a) }; };

const frames = CARD.map((c, i) => {
  const w = holesOsm.find(e => Number(e.tags.ref) === i + 1); if (!w) throw new Error(`no OSM hole ${i + 1}`);
  const teeLL = w.geometry[0], endLL = w.geometry.at(-1), end = utm(endLL.lat, endLL.lon);
  const green = greensOsm.map(g => centroid(g.geometry)).sort((p, q) => Math.hypot(p.e - end.e, p.n - end.n) - Math.hypot(q.e - end.e, q.n - end.n))[0];
  const tee = utm(teeLL.lat, teeLL.lon), d = Math.hypot(green.e - tee.e, green.n - tee.n), fwd = { e: (green.e - tee.e) / d, n: (green.n - tee.n) / d };
  const lengthM = c.yards * M_PER_YD, s = d / lengthM;
  return { i, tee, green, teeLL, s, realM: d, lengthM, toUtm: (x, z) => ({ e: tee.e + s * (z * fwd.e + x * fwd.n), n: tee.n + s * (z * fwd.n - x * fwd.e) }) };
});

// ---- 2. DEM tiles ----
let minE = Infinity, minN = Infinity, maxE = -Infinity, maxN = -Infinity;
for (const f of frames) { const g = GRIDS[f.i]; for (const [x, z] of [[g.x0, g.z0], [-g.x0, g.z0], [g.x0, g.z0 + g.nz * g.cell], [-g.x0, g.z0 + g.nz * g.cell]]) { const p = f.toUtm(x, z); minE = Math.min(minE, p.e); maxE = Math.max(maxE, p.e); minN = Math.min(minN, p.n); maxN = Math.max(maxN, p.n); } }
const T = 1000, E0 = Math.floor(minE / 2) * 2 - 10, N1 = Math.ceil(maxN / 2) * 2 + 10, W = Math.ceil((maxE + 10 - E0) / T) * T, H = Math.ceil((N1 - (minN - 10)) / T) * T;
const dem = new Float32Array(W * H);
function readTiff(b) {
  const le = b.readUInt16LE(0) === 0x4949, u16 = o => (le ? b.readUInt16LE(o) : b.readUInt16BE(o)), u32 = o => (le ? b.readUInt32LE(o) : b.readUInt32BE(o));
  const ifd = u32(4), n = u16(ifd), tags = {};
  for (let k = 0; k < n; k++) { const o = ifd + 2 + k * 12, tag = u16(o), type = u16(o + 2), cnt = u32(o + 4), sz = type === 3 ? 2 : 4, at = cnt * sz > 4 ? u32(o + 8) : o + 8;
    tags[tag] = Array.from({ length: cnt }, (_, j) => (type === 3 ? u16(at + j * 2) : u32(at + j * 4))); }
  if (tags[259]?.[0] !== 1 || tags[258]?.[0] !== 32 || tags[339]?.[0] !== 3) throw new Error('expected an uncompressed float32 TIFF');
  const w = tags[256][0], h = tags[257][0], out = new Float32Array(w * h), f32 = o => (le ? b.readFloatLE(o) : b.readFloatBE(o));
  if (tags[324]) {                                              // tiled
    const tw = tags[322][0], th = tags[323][0], across = Math.ceil(w / tw);
    tags[324].forEach((off, k) => { const ox = (k % across) * tw, oy = Math.floor(k / across) * th;
      for (let y = 0; y < th && oy + y < h; y++) for (let x = 0; x < tw && ox + x < w; x++) out[(oy + y) * w + ox + x] = f32(off + (y * tw + x) * 4); });
  } else { let i = 0; tags[273].forEach((off, k) => { for (let j = 0; j < tags[279][k] / 4 && i < out.length; j++) out[i++] = f32(off + j * 4); }); }
  return { w, h, data: out };
}
for (let ty = 0; ty < H / T; ty++) for (let tx = 0; tx < W / T; tx++) {
  const e0 = E0 + tx * T, n1 = N1 - ty * T;
  const url = `https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage?bbox=${e0},${n1 - T},${e0 + T},${n1}&bboxSR=26910&imageSR=26910&size=${T},${T}&format=tiff&pixelType=F32&compression=None&noData=-9999&interpolation=RSP_BilinearInterpolation&f=image`;
  const t = readTiff(await cached(`dem-${e0}-${n1}.tif`, url));
  if (t.w !== T || t.h !== T) throw new Error(`tile size ${t.w}x${t.h}`);
  for (let r = 0; r < T; r++) dem.set(t.data.subarray(r * T, r * T + T), (ty * T + r) * W + tx * T);
  await sleep(300);
}
const demAt = (e, n) => {   // bilinear on pixel centres (1 m)
  const fx = Math.min(W - 1.001, Math.max(0, e - E0 - 0.5)), fy = Math.min(H - 1.001, Math.max(0, N1 - n - 0.5)), x = Math.floor(fx), y = Math.floor(fy), u = fx - x, v = fy - y;
  const g = (i, j) => { const h = dem[j * W + i]; return h < -100 ? 0 : h; };   // no data offshore: sea level
  return (1 - v) * ((1 - u) * g(x, y) + u * g(x + 1, y)) + v * ((1 - u) * g(x, y + 1) + u * g(x + 1, y + 1));
};

// ---- 3. per-hole height grids ----
const out = [], report = [];
for (const f of frames) {
  const g = GRIDS[f.i], cells = decodeGrid(g, 0), cls = (x, z) => { const ix = Math.floor((x - g.x0) / g.cell), iz = Math.floor((z - g.z0) / g.cell); return ix < 0 || iz < 0 || ix >= g.nx || iz >= g.nz ? 111 : cells[iz * g.nx + ix]; };
  const nx = Math.round((g.nx * g.cell) / CELL) + 1, nz = Math.round((g.nz * g.cell) / CELL) + 1, X = i => g.x0 + i * CELL, Z = j => g.z0 + j * CELL;
  let h = new Float64Array(nx * nz);
  // average 5 points over the cell footprint: a light low-pass so 1 m lidar texture does not alias onto the 4 m grid
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { let s = 0; for (const [dx, dz] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = f.toUtm(X(i) + dx, Z(j) + dz); s += demAt(p.e, p.n); } h[j * nx + i] = Math.max(0, s / 5); }
  let water = 0, waterLow = 0;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (cls(X(i), Z(j)) === 119) { water++; if (h[j * nx + i] < 3) waterLow++; h[j * nx + i] = 0; }   // traced water is the sea surface
  // green: least-squares quadratic over the green nodes, slopes held to 1-3 %, blended into the DEM over 8 m
  const gn = []; for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (cls(X(i), Z(j)) === 103 && Math.hypot(X(i), Z(j) - f.lengthM) < 45) gn.push([X(i), Z(j) - f.lengthM, h[j * nx + i]]);
  const quad = gn.length >= 12, basis = (x, z) => (quad ? [1, x, z, x * x, x * z, z * z] : [1, x, z]), m = basis(0, 0).length;
  const A = Array.from({ length: m }, () => new Float64Array(m + 1));
  for (const [x, z, y] of gn) { const b = basis(x, z); for (let r = 0; r < m; r++) { for (let c = 0; c < m; c++) A[r][c] += b[r] * b[c]; A[r][m] += b[r] * y; } }
  for (let c = 0; c < m; c++) { let p = c; for (let r = c + 1; r < m; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; [A[c], A[p]] = [A[p], A[c]]; for (let r = 0; r < m; r++) if (r !== c) { const k = A[r][c] / A[c][c]; for (let q = c; q <= m; q++) A[r][q] -= k * A[c][q]; } }
  const co = A.map((r, c) => r[m] / r[c]);
  const grad = (x, z) => quad ? [co[1] + 2 * co[3] * x + co[4] * z, co[2] + co[4] * x + 2 * co[5] * z] : [co[1], co[2]];
  let gmax = 0; for (const [x, z] of gn) gmax = Math.max(gmax, Math.hypot(...grad(x, z)));
  const k = gmax > 0.03 ? 0.03 / gmax : 1;                                        // steepest point on the green at most 3 %
  const g0 = grad(0, 0).map(v => v * k), g0m = Math.hypot(...g0), extra = g0m < 0.01 ? (0.01 - g0m) / Math.max(g0m, 1e-9) : 0;   // at least 1 % at the pin, along its own fall line
  const fit = (x, z) => { const b = basis(x, z); let v = co[0]; for (let r = 1; r < m; r++) v += k * co[r] * b[r]; return v + extra * (g0[0] * x + g0[1] * z) * (g0m > 1e-9 ? 1 : 0) + (g0m <= 1e-9 ? 0.01 * z : 0); };
  let slopes = []; for (const [x, z] of gn) { const [a, b] = grad(x, z); slopes.push(Math.hypot(a * k + extra * g0[0], b * k + extra * g0[1])); }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = X(i), z = Z(j) - f.lengthM; let d = Infinity; for (const [gx, gz] of gn) d = Math.min(d, Math.hypot(x - gx, z - gz)); if (d > 8) continue;
    const w = d <= 0 ? 1 : 1 - (d / 8) ** 2 * (3 - 2 * d / 8); h[j * nx + i] = w * fit(x, z) + (1 - w) * h[j * nx + i];
  }
  // tee box: level within 6 m of the origin, blended out to 12 m
  const teeH = (() => { let s = 0, c = 0; for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (Math.hypot(X(i), Z(j)) <= 6) { s += h[j * nx + i]; c++; } return s / c; })();
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const d = Math.hypot(X(i), Z(j)); if (d < 12) { const w = d <= 6 ? 1 : 1 - ((d - 6) / 6) ** 2 * (3 - 2 * (d - 6) / 6); h[j * nx + i] = w * teeH + (1 - w) * h[j * nx + i]; } }
  const cm = new Int16Array(nx * nz); let lo = Infinity, hi = -Infinity;
  for (let q = 0; q < cm.length; q++) { const v = h[q] - teeH; cm[q] = Math.round(v * 100); lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const bytes = Buffer.alloc(cm.length * 2); cm.forEach((v, q) => bytes.writeInt16LE(v, q * 2));
  const pinRel = fit(0, 0) - teeH;
  out.push({ x0: g.x0, z0: g.z0, cell: CELL, nx, nz, teeElevM: +teeH.toFixed(2), scale: +f.s.toFixed(4), data: bytes.toString('base64') });
  report.push({ hole: f.i + 1, teeLL: [f.teeLL.lat, f.teeLL.lon], realM: +f.realM.toFixed(1), scale: +f.s.toFixed(3), teeElevM: +teeH.toFixed(1), pinRiseM: +pinRel.toFixed(1), rangeM: [+lo.toFixed(1), +hi.toFixed(1)],
    greenSlopePct: [+(Math.min(...slopes) * 100).toFixed(2), +(Math.max(...slopes) * 100).toFixed(2)], greenNodes: gn.length, waterLowPct: water ? Math.round((100 * waterLow) / water) : null });
}
console.table(report);
fs.writeFileSync(path.join(CACHE, 'report.json'), JSON.stringify(report, null, 1));
const lines = [
  '// GENERATED by scripts/fetch_elevation.mjs. Do not edit. Method and sources: docs/research/elevation.md.',
  '// Elevation: USGS 3DEP 1 m DEM (public domain). Hole anchors: © OpenStreetMap contributors (ODbL).',
  '// Per hole: heights in centimetres relative to the tee, int16 little-endian, base64; row j (z = z0 + j*cell) of nx nodes from x0.',
  'export interface HoleHeight { x0: number; z0: number; cell: number; nx: number; nz: number; /** real tee elevation above sea level, m */ teeElevM: number; /** real metres per game metre */ scale: number; data: string }',
  'export const HEIGHTS: HoleHeight[] = [',
  ...out.map(o => `  ${JSON.stringify(o)},`),
  '];', '',
];
fs.writeFileSync(path.join(ROOT, 'src/shared/course-height.ts'), lines.join('\n'));
console.log('wrote src/shared/course-height.ts');
