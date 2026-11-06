// Course pipeline: real elevation for every hole of a course in its game frames (docs/research/elevation.md). Generic over courses.
//   npx tsx scripts/build-course.mjs --course pebble|bethpage-black|aronimink [--cache DIR]
// Writes src/shared/courses/<id>-height.ts (hole anchors, par and yardage, height fields); raw downloads cache under DIR/<id>/ (default .elev-cache).
// 1. OpenStreetMap (Overpass, ODbL): golf=hole ways (tee = first node; ref, par, dist tags) and golf=green polygons inside the named course.
// 2. USGS 3DEP 1 m bare-earth DEM (public domain): ImageServer exportImage tiles in the course's NAD83 UTM zone, uncompressed float32 TIFF.
// 3. Each hole's game frame (tee at the origin, pin on +z) is laid on the real tee-to-green line and sampled on a 4 m grid. A course with traced
//    lie grids (Pebble Beach) keeps its card length and grid extents, scaled to the real distance; a new course uses the real distance at scale 1
//    and a default extent. Greens (plus one node around them) become a fitted quadratic held to 1-3 % slope; the tee box is levelled.
import fs from 'node:fs';
import path from 'node:path';
import { GRIDS } from '../src/shared/course-grid.ts';
import { decodeGrid } from '../src/shared/gridtools.ts';
import { CARD } from '../src/shared/pebble-card.ts';
import { CARD as BP_CARD, GRIDS as BP_GRIDS } from '../src/shared/course-grid-bethpage-black.ts';
import { CARD as AR_CARD, GRIDS as AR_GRIDS } from '../src/shared/course-grid-aronimink.ts';
const card = rows => rows.map(([par, yards]) => ({ par, yards }));

/** Courses the pipeline knows: the OSM golf_course name to search, an optional tag filter for its holes, and the traced lie grids and card if the game has them.
 *  Grids that carry `geo` (tee lat/lng, bearing of +z, scale) are laid on the Earth by it, so heights line up with the traced lies exactly; OSM is not needed.
 *  `sea: false`: inland, traced water keeps its lidar surface instead of dropping to sea level. */
const COURSES = {
  pebble: { osmName: 'Pebble Beach Golf', grids: GRIDS, card: CARD },
  'bethpage-black': { osmName: 'Bethpage State Park Golf', holes: { 'golf:course:name': 'Black' }, grids: BP_GRIDS, card: card(BP_CARD), sea: false },   // one OSM boundary holds all five Bethpage courses
  aronimink: { osmName: 'Aronimink', grids: AR_GRIDS, card: card(AR_CARD), sea: false },
};
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const ID = arg('--course') ?? 'pebble', C = COURSES[ID];
if (!C) throw new Error(`unknown course ${ID}; known: ${Object.keys(COURSES).join(', ')}`);
const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const CACHE = path.join(arg('--cache') ?? path.join(ROOT, '.elev-cache'), ID);
fs.mkdirSync(CACHE, { recursive: true });
const CELL = 4, M_PER_YD = 0.9144, UA = 'ace-golf-elevation/1.0 (game research; batch, cached)';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function cached(name, url, body) {
  const f = path.join(CACHE, name);
  if (fs.existsSync(f)) return fs.readFileSync(f);
  for (let i = 0; i < 6; i++) {
    const r = await fetch(url, body ? { method: 'POST', body, headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' } } : { headers: { 'User-Agent': UA } });
    const b = Buffer.from(await r.arrayBuffer());
    if (r.ok && b.length > 100 && b[0] !== 0x3c && !b.subarray(0, 40).toString().includes('Overpass')) { fs.writeFileSync(f, b); return b; }
    console.error(`retry ${name}: HTTP ${r.status}`); await sleep(5000 * 2 ** i);
  }
  throw new Error(`could not fetch ${name}`);
}

// ---- 1. OSM (skipped when every traced grid has its geo frame) ----
const GEO = C.grids?.every(g => g.geo) ?? false;
const Q = `[out:json][timeout:90];area["leisure"="golf_course"]["name"~"${C.osmName}"]->.c;(way["golf"="hole"](area.c);way["golf"="green"](area.c););out geom tags;`;
const osm = GEO ? { elements: [] } : JSON.parse(await cached('osm.json', 'https://overpass-api.de/api/interpreter', 'data=' + encodeURIComponent(Q)));
const refOf = e => Number(/(\d+)\s*$/.exec(e.tags.ref ?? '')?.[1]);                  // "7" or "Black - 7"
const holesOsm = osm.elements.filter(e => e.tags.golf === 'hole' && Object.entries(C.holes ?? {}).every(([k, v]) => e.tags[k] === v)).sort((a, b) => refOf(a) - refOf(b)), greensOsm = osm.elements.filter(e => e.tags.golf === 'green');
if (!GEO && !holesOsm.length) throw new Error(`no golf=hole ways inside a golf course named ~"${C.osmName}"`);
const ZONE = Math.floor(((GEO ? C.grids[0].geo.lng : holesOsm[0].geometry[0].lon) + 180) / 6) + 1, EPSG = 26900 + ZONE;   // NAD83 / UTM zone N

// ---- UTM (WGS84 ellipsoid; NAD83 differs by about a metre) ----
function utm(lat, lon) {
  const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996, n = f / (2 - f), A = (a / (1 + n)) * (1 + n * n / 4 + n ** 4 / 64);
  const al = [n / 2 - (2 / 3) * n * n + (5 / 16) * n ** 3, (13 / 48) * n * n - (3 / 5) * n ** 3, (61 / 240) * n ** 3];
  const phi = (lat * Math.PI) / 180, dl = ((lon - (ZONE * 6 - 183)) * Math.PI) / 180, e = 2 * Math.sqrt(n) / (1 + n);
  const t = Math.sinh(Math.atanh(Math.sin(phi)) - e * Math.atanh(e * Math.sin(phi)));
  const xi = Math.atan2(t, Math.cos(dl)), eta = Math.atanh(Math.sin(dl) / Math.sqrt(1 + t * t));
  let E = eta, N = xi;
  for (let j = 1; j <= 3; j++) { E += al[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta); N += al[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta); }
  return { e: 500000 + k0 * A * E, n: k0 * A * N };
}
const centroid = g => { let a = 0, x = 0, y = 0; for (let i = 0; i < g.length - 1; i++) { const p = utm(g[i].lat, g[i].lon), q = utm(g[i + 1].lat, g[i + 1].lon), c = p.e * q.n - q.e * p.n; a += c; x += (p.e + q.e) * c; y += (p.n + q.n) * c; } return { e: x / (3 * a), n: y / (3 * a) }; };

const inPoly = (g, p) => { let c = false; for (let i = 0, j = g.length - 1; i < g.length; j = i++) { const a = utm(g[i].lat, g[i].lon), b = utm(g[j].lat, g[j].lon); if ((a.n > p.n) !== (b.n > p.n) && p.e < ((b.e - a.e) * (p.n - a.n)) / (b.n - a.n) + a.e) c = !c; } return c; };
// a traced grid's own frame: tee at geo, +z along geo.bearing, as scripts/trace_bluegolf.py laid it (local equirectangular about the tee)
const R_EARTH = 6371008.8, RAD = Math.PI / 180;
const along = (geo, m) => ({ lat: geo.lat + (m * Math.cos(geo.bearing * RAD)) / (R_EARTH * RAD), lon: geo.lng + (m * Math.sin(geo.bearing * RAD)) / (R_EARTH * Math.cos(geo.lat * RAD) * RAD) });
const geoFrame = (grid, i) => {
  const { geo } = grid, tee = utm(geo.lat, geo.lng), far = utm(along(geo, 100).lat, along(geo, 100).lon), d = Math.hypot(far.e - tee.e, far.n - tee.n);
  const fwd = { e: (far.e - tee.e) / d, n: (far.n - tee.n) / d }, s = d / 100 / geo.scale, lengthM = grid.pinZ ?? C.card[i].yards * M_PER_YD;   // s: UTM metres per game metre (grid convergence and scale factor included)
  const toUtm = (x, z) => ({ e: tee.e + s * (z * fwd.e + x * fwd.n), n: tee.n + s * (z * fwd.n - x * fwd.e) });
  const cells = decodeGrid(grid, 0), cls = (x, z) => { const ix = Math.floor((x - grid.x0) / grid.cell), iz = Math.floor((z - grid.z0) / grid.cell); return ix < 0 || iz < 0 || ix >= grid.nx || iz >= grid.nz ? 111 : cells[iz * grid.nx + ix]; };
  const greenLL = along(geo, lengthM / geo.scale);
  return { i, ref: i + 1, par: C.card[i].par, yards: C.card[i].yards, tee, teeLL: { lat: geo.lat, lon: geo.lng }, greenLL, s, realM: lengthM * s, lengthM, grid, cls, toUtm };
};
const frames = GEO ? C.grids.map(geoFrame) : holesOsm.map((w, i) => {
  const teeLL = w.geometry[0], endLL = w.geometry.at(-1), end = utm(endLL.lat, endLL.lon);
  const greenW = [...greensOsm].sort((p, q) => { const a = centroid(p.geometry), b = centroid(q.geometry); return Math.hypot(a.e - end.e, a.n - end.n) - Math.hypot(b.e - end.e, b.n - end.n); })[0];
  const green = greenW ? centroid(greenW.geometry) : end;
  const tee = utm(teeLL.lat, teeLL.lon), d = Math.hypot(green.e - tee.e, green.n - tee.n), fwd = { e: (green.e - tee.e) / d, n: (green.n - tee.n) / d };
  const card = C.card?.[i], lengthM = card ? card.yards * M_PER_YD : d, s = d / lengthM;
  const grid = C.grids?.[i] ?? { x0: -150, z0: -40, cell: 2, nx: 150, nz: Math.ceil((lengthM + 110) / 2) };
  const toUtm = (x, z) => ({ e: tee.e + s * (z * fwd.e + x * fwd.n), n: tee.n + s * (z * fwd.n - x * fwd.e) });
  // lie class at a game point: the traced grid when the course has one, else just the OSM green (103 'g') or rough
  const cells = C.grids ? decodeGrid(grid, 0) : null;
  const cls = cells ? (x, z) => { const ix = Math.floor((x - grid.x0) / grid.cell), iz = Math.floor((z - grid.z0) / grid.cell); return ix < 0 || iz < 0 || ix >= grid.nx || iz >= grid.nz ? 111 : cells[iz * grid.nx + ix]; }
    : (x, z) => (greenW && Math.hypot(x, z - lengthM) < 45 && inPoly(greenW.geometry, toUtm(x, z)) ? 103 : 114);
  const yards = Number(w.tags.dist ?? w.tags.yardage ?? w.tags['dist:yards']) || Math.round(d / M_PER_YD);
  return { i, ref: refOf(w) || i + 1, par: Number(w.tags.par) || card?.par || null, yards: card?.yards ?? yards, tee, green, teeLL, greenLL: greenW ? greenW.geometry[0] : endLL, s, realM: d, lengthM, grid, cls, toUtm };
});
if (C.card && frames.length !== C.card.length) throw new Error(`OSM has ${frames.length} holes, the card ${C.card.length}`);

// ---- 2. DEM tiles ----
let minE = Infinity, minN = Infinity, maxE = -Infinity, maxN = -Infinity;
for (const f of frames) { const g = f.grid; for (const [x, z] of [[g.x0, g.z0], [-g.x0, g.z0], [g.x0, g.z0 + g.nz * g.cell], [-g.x0, g.z0 + g.nz * g.cell]]) { const p = f.toUtm(x, z); minE = Math.min(minE, p.e); maxE = Math.max(maxE, p.e); minN = Math.min(minN, p.n); maxN = Math.max(maxN, p.n); } }
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
  const url = `https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage?bbox=${e0},${n1 - T},${e0 + T},${n1}&bboxSR=${EPSG}&imageSR=${EPSG}&size=${T},${T}&format=tiff&pixelType=F32&compression=None&noData=-9999&interpolation=RSP_BilinearInterpolation&f=image`;
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
  const g = f.grid, cls = f.cls;
  const nx = Math.round((g.nx * g.cell) / CELL) + 1, nz = Math.round((g.nz * g.cell) / CELL) + 1, X = i => g.x0 + i * CELL, Z = j => g.z0 + j * CELL;
  let h = new Float64Array(nx * nz);
  // average 5 points over the cell footprint: a light low-pass so 1 m lidar texture does not alias onto the 4 m grid
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { let s = 0; for (const [dx, dz] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = f.toUtm(X(i) + dx, Z(j) + dz); s += demAt(p.e, p.n); } h[j * nx + i] = Math.max(0, s / 5); }
  let water = 0, waterLow = 0;
  if (C.sea !== false) for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (cls(X(i), Z(j)) === 119) { water++; if (h[j * nx + i] < 3) waterLow++; h[j * nx + i] = 0; }   // traced water is the sea surface
  // green: least-squares quadratic over the green nodes, slopes held to 1-3 %, blended into the DEM over 8 m
  let gn = []; for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (cls(X(i), Z(j)) === 103 && Math.hypot(X(i), Z(j) - f.lengthM) < 45) gn.push([X(i), Z(j) - f.lengthM, h[j * nx + i]]);
  if (gn.length < 3) gn = [];                                                       // no mapped green: keep the DEM
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
    const x = X(i), z = Z(j) - f.lengthM; let d = Infinity; for (const [gx, gz] of gn) d = Math.min(d, Math.hypot(x - gx, z - gz)); if (d > 12) continue;
    const e = Math.max(0, d - 4) / 8, w = 1 - e * e * (3 - 2 * e);              // the fit holds one node past the green edge, then blends out over 8 m
    h[j * nx + i] = w * fit(x, z) + (1 - w) * h[j * nx + i];
  }
  // tee box: level within 6 m of the origin, blended out to 12 m
  const teeH = (() => { let s = 0, c = 0; for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (Math.hypot(X(i), Z(j)) <= 6) { s += h[j * nx + i]; c++; } return s / c; })();
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const d = Math.hypot(X(i), Z(j)); if (d < 12) { const w = d <= 6 ? 1 : 1 - ((d - 6) / 6) ** 2 * (3 - 2 * (d - 6) / 6); h[j * nx + i] = w * teeH + (1 - w) * h[j * nx + i]; } }
  const cm = new Int16Array(nx * nz); let lo = Infinity, hi = -Infinity;
  for (let q = 0; q < cm.length; q++) { const v = h[q] - teeH; cm[q] = Math.round(v * 100); lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const bytes = Buffer.alloc(cm.length * 2); cm.forEach((v, q) => bytes.writeInt16LE(v, q * 2));
  const pinRel = (gn.length ? fit(0, 0) : h[Math.round((f.lengthM - g.z0) / CELL) * nx + Math.round(-g.x0 / CELL)]) - teeH;
  out.push({ ref: f.ref, par: f.par, yards: f.yards, tee: [f.teeLL.lat, f.teeLL.lon], green: [+(f.greenLL.lat).toFixed(7), +(f.greenLL.lon).toFixed(7)], x0: g.x0, z0: g.z0, cell: CELL, nx, nz, teeElevM: +teeH.toFixed(2), scale: +f.s.toFixed(4), data: bytes.toString('base64') });
  report.push({ hole: f.i + 1, teeLL: [f.teeLL.lat, f.teeLL.lon], realM: +f.realM.toFixed(1), scale: +f.s.toFixed(3), teeElevM: +teeH.toFixed(1), pinRiseM: +pinRel.toFixed(1), rangeM: [+lo.toFixed(1), +hi.toFixed(1)],
    greenSlopePct: [+(Math.min(...slopes) * 100).toFixed(2), +(Math.max(...slopes) * 100).toFixed(2)], greenNodes: gn.length, waterLowPct: water ? Math.round((100 * waterLow) / water) : null });
}
console.table(report);
fs.writeFileSync(path.join(CACHE, 'report.json'), JSON.stringify(report, null, 1));
const file = `src/shared/courses/${ID}-height.ts`;
fs.mkdirSync(path.join(ROOT, 'src/shared/courses'), { recursive: true });
fs.writeFileSync(path.join(ROOT, file), [
  `// GENERATED by scripts/build-course.mjs --course ${ID}. Do not edit. Method and sources: docs/research/elevation.md.`,
  '// Elevation: USGS 3DEP 1 m DEM (public domain). Hole anchors, par and yardage: © OpenStreetMap contributors (ODbL).',
  '// Per hole: heights in centimetres relative to the tee, int16 little-endian, base64; row j (z = z0 + j*cell) of nx nodes from x0.',
  "import type { HoleHeight } from '../height-types';",
  'export const HEIGHTS: HoleHeight[] = [',
  ...out.map(o => `  ${JSON.stringify(o)},`),
  '];', '',
].join('\n'));
console.log(`wrote ${file}`);
