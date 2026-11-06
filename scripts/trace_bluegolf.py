#!/usr/bin/env python3
"""Tracer v3: trace BlueGolf satellite hole maps (refs/<course>/hole-NN-clean.png, captured north-up at zoom 18 with their
Web Mercator reference in hole-NN-clean.json, and BlueGolf's aerial.json with tee, dogleg and green coordinates) into
per-hole lie grids in src/shared/course-grid-<course>.ts. Needs numpy, Pillow and SciPy (pip install numpy pillow scipy).

  python3 scripts/trace_bluegolf.py bethpage-black            # all holes -> src/shared/course-grid-bethpage-black.ts + QA overlays
  python3 scripts/trace_bluegolf.py aronimink --holes 4,15      # some holes, QA overlays only (no TS written)

Geometry is true scale (1 sim metre = 1 metre on the ground): the card's back-tee yardage is measured along BlueGolf's play
line (tee, dogleg, green), so the tee is slid along the first leg until the play line equals the card yardage, and the pin
sits on +z at the straight-line distance (pinZ). Each grid records its geo reference for the elevation work.
Pixels are classified from the image by colour and local texture: a k-nearest-neighbour classifier is calibrated per image
(each satellite tile has its own season and light) on pixels that OpenStreetMap labels (refs/<course>/osm-features.json:
fairways, tees, greens, bunkers, water, woods, paths) plus self-labelled rough and canopy by texture. Greens are kept only
at a green. Out of bounds: outside the club's OpenStreetMap boundary (refs/<course>/boundary.json), buildings, parking, roads.
Classes: o out of bounds, w water, r rough, c first cut, f fairway, g green, s sand, p cart path, t trees, k rock/shore."""
import argparse, json, math, os
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REFS = os.environ.get('ACE_REFS', os.path.join(ROOT, 'refs'))
CELL, X_HALF, Z_BEHIND, Z_BEYOND = 2.0, 150.0, 40.0, 70.0
M_PER_YD, R_EARTH = 0.9144, 6371008.8
# Per-source calibration (BlueGolf / Google satellite, summer and autumn mosaics). tex = std of luminance over 9 px (about 4 m).
# Features: R, G, B, texture, wide texture, wide luminance, G-R; weights favour texture (trees vs mown grass) and G-R (fescue).
SATELLITE = dict(per_class=500, k=15, weights=[1.0, 1.0, 1.0, 1.3, 1.6, 0.7, 1.2], water_min_m2=120, boundary_pad_m=30)
COURSE = {
    'bethpage-black': dict(name='Bethpage Black', tees=0),
    'aronimink': dict(name='Aronimink', tees=0),
}

def mercator(lat, lng, z):
    s = 256 * 2 ** z
    return (lng + 180) / 360 * s, (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * s

class Img:
    """A captured hole image and its lat/lng <-> pixel transform."""
    def __init__(self, course, n):
        self.rgb = np.asarray(Image.open(f'{REFS}/{course}/hole-{n:02d}-clean.png').convert('RGB')).astype(np.float32)
        r = json.load(open(f'{REFS}/{course}/hole-{n:02d}-clean.json'))
        self.z, self.w, self.h = r['zoom'], r['width'], r['height']
        self.cx, self.cy = mercator(r['center']['lat'], r['center']['lng'], self.z)
        self.ky = self.rgb.shape[0] / self.h; self.kx = self.rgb.shape[1] / self.w   # device pixels per CSS pixel
        self.mpp = 156543.03392 * math.cos(math.radians(r['center']['lat'])) / 2 ** self.z / self.kx
    def px(self, lat, lng):
        X, Y = mercator(lat, lng, self.z)
        return (X - self.cx + self.w / 2) * self.kx, (Y - self.cy + self.h / 2) * self.ky

def features(rgb):
    """Per pixel: smoothed RGB, local texture at two scales, a wider luminance, and green-minus-red (standardised later)."""
    s = np.stack([nd.gaussian_filter(rgb[..., c], 1.2) for c in range(3)], -1)
    L = rgb.mean(2); m = nd.uniform_filter(L, 9); tex = np.sqrt(np.maximum(nd.uniform_filter(L * L, 9) - m * m, 0))
    F = np.concatenate([s, tex[..., None], nd.uniform_filter(tex, 9)[..., None], nd.gaussian_filter(L, 4)[..., None], (s[..., 1] - s[..., 0])[..., None]], -1)
    return F, s.mean(2), tex

ROADS = {'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'service', 'primary_link', 'secondary_link', 'tertiary_link'}
ROAD_W = {'primary': 10, 'secondary': 9, 'tertiary': 8, 'residential': 7, 'unclassified': 7, 'service': 5}

def osm_masks(course, img, shape):
    """Rasterise the OSM extract (refs/<course>/osm-features.json) into training masks per class, plus roads and buildings."""
    H, W = shape; layers = {k: Image.new('L', (W, H), 0) for k in 'fgswtopRB'}
    draw = {k: ImageDraw.Draw(v) for k, v in layers.items()}
    def kind(t):
        g = t.get('golf')
        if g in ('fairway', 'tee'): return 'f'
        if g == 'green': return 'g'
        if g == 'bunker': return 's'
        if g in ('water_hazard', 'lateral_water_hazard') or t.get('natural') == 'water': return 'w'
        if t.get('natural') == 'wood' or t.get('landuse') == 'forest': return 't'
        if g in ('cartpath', 'path') or t.get('highway') in ('footway', 'path', 'cycleway', 'track', 'bridleway', 'pedestrian'): return 'p'
        if t.get('highway') in ROADS: return 'R'
        if 'building' in t: return 'B'
        if t.get('amenity') == 'parking': return 'B'
        return None
    mpp = img.mpp
    for el in json.load(open(f'{REFS}/{course}/osm-features.json'))['elements']:
        k = kind(el.get('tags', {}))
        if not k: continue
        parts = [(el['geometry'], 'outer')] if el['type'] == 'way' else [(m['geometry'], m.get('role') or 'outer') for m in el.get('members', []) if 'geometry' in m]
        for geom, role in parts:
            xy = [img.px(p['lat'], p['lon']) for p in geom]
            if len(xy) < 2: continue
            closed = geom[0] == geom[-1] and len(xy) > 3
            if k in 'pR':
                w = (1.6 if k == 'p' else ROAD_W.get(el['tags'].get('highway'), 6)) / mpp
                draw[k].line(xy, fill=1, width=max(1, int(round(w))))
            elif closed:
                draw[k].polygon(xy, fill=0 if role == 'inner' else 1)
    return {k: np.asarray(v).astype(bool) for k, v in layers.items()}

def classify(img, P, greens_px, inside, osm, rng):
    """Pixel class map (single chars as uint8): k-nearest-neighbour on colour and texture, trained per image from OSM-labelled pixels."""
    from scipy.spatial import cKDTree
    F, L, tex = features(img.rgb); H, W = L.shape; mpp = img.mpp
    er = lambda m, r=2.0: nd.binary_erosion(m, iterations=max(1, int(r / mpp)))
    golf = osm['f'] | osm['g'] | osm['s'] | osm['w'] | osm['p'] | osm['R'] | osm['B']
    tex9 = F[..., 4]; brown = (F[..., 6] < 4)
    free = inside & ~nd.binary_dilation(golf, iterations=int(3 / mpp)) & ~osm['t']
    lo, hi = (np.percentile(tex9[free], [35, 75]) if free.sum() > 500 else (6, 12))
    train = {
        'f': er(osm['f']) & inside, 'g': er(osm['g'], 1.5), 's': er(osm['s'], 1.0), 'w': er(osm['w'], 2.5),
        't': (er(osm['t'], 3) | (free & (tex9 > hi) & ~brown & (L < np.percentile(L[free], 60) if free.any() else True))),
        'r': free & ((tex9 < lo) | (brown & (tex9 < hi * 1.5))) | er(inside & ~golf & ~osm['t'] & (tex9 < lo), 1),
        'p': osm['p'] & ~er(osm['p'], 0.4) & (F[..., 3] < 40) & (np.abs(F[..., 6]) < 18) | er(osm['p'], 0.4),
        'o': er(osm['B'], 1.5) | er(osm['R'], 1.0),
    }
    X, y = [], []
    for ch, m in train.items():
        idx = np.flatnonzero(m.ravel())
        if len(idx) < 60: continue
        pick = rng.choice(idx, min(len(idx), P['per_class']), replace=False)
        X.append(F.reshape(-1, F.shape[-1])[pick]); y += [ord(ch)] * len(pick)
    X = np.concatenate(X); y = np.array(y, np.uint8)
    mu, sd = X.mean(0), X.std(0) + 1e-6; wgt = np.array(P['weights'], np.float32)
    tree = cKDTree((X - mu) / sd * wgt)
    Q = (F.reshape(-1, F.shape[-1]) - mu) / sd * wgt
    _, nn = tree.query(Q, k=P['k'], workers=-1)
    lab = y[nn]; codes = np.unique(y)
    counts = np.stack([(lab == c).sum(1) for c in codes], 1)
    out = codes[counts.argmax(1)].reshape(H, W)
    # spatial smoothing of the vote (about 1.5 m) so single pixels do not flip a cell
    sm = np.stack([nd.uniform_filter((out == c).astype(np.float32), int(1.5 / mpp) * 2 + 1) for c in codes], 0)
    out = codes[sm.argmax(0)]
    # greens only where a green is: components near a green coordinate or mostly on an OSM green; other green-coloured turf is fairway
    gl, k = nd.label(out == ord('g'))
    if k:
        keep = np.zeros(k + 1, bool)
        for gx, gy in greens_px:
            if 0 <= gx < W and 0 <= gy < H:
                r = int(8 / mpp); ids = np.unique(gl[max(0, int(gy) - r):int(gy) + r, max(0, int(gx) - r):int(gx) + r]); keep[ids] = True
        onosm = nd.mean(osm['g'].astype(np.float32), gl, range(1, k + 1)); keep[1:] |= onosm > 0.5; keep[0] = False
        out[(gl > 0) & ~keep[gl]] = ord('f')
    def demote(ch, keep, to):
        """Components of class ch failing keep(area_m2, overlap_with_osm_support) become `to`."""
        lab, k = nd.label(out == ord(ch))
        if not k: return
        area = nd.sum(np.ones_like(L), lab, range(1, k + 1)) * mpp * mpp
        sup = nd.mean(support[ch].astype(np.float32), lab, range(1, k + 1))
        bad = 1 + np.flatnonzero([not keep(a, o) for a, o in zip(area, sup)])
        out[np.isin(lab, bad)] = ord(to)
    pad = lambda m, r: nd.binary_dilation(m, iterations=max(1, int(r / mpp)))
    support = {'w': pad(osm['w'], 4), 'f': pad(osm['f'] | osm['g'], 4), 'p': pad(osm['p'] | osm['R'], 4), 'o': pad(osm['B'] | osm['R'], 12), 's': pad(osm['s'], 4)}
    yard = pad(osm['B'], 10) & ~support['s']             # car parks and pale roofs beside buildings are not bunkers or paths
    # water: a pond the map also knows (dark smooth shadows are not water); fairway: big, or on a mapped fairway; paths: long, or mapped
    demote('w', lambda a, o: a >= P['water_min_m2'] and o > 0.3, 'r')
    demote('f', lambda a, o: a >= 400 or o > 0.5, 'r')
    out[yard & np.isin(out, [ord('s'), ord('p')])] = ord('o')
    lot = pad(osm['B'] | osm['R'], 25) & ~support['s']   # glare off cars and kerbs near roads and buildings
    out[lot & (out == ord('s'))] = ord('o')
    demote('s', lambda a, o: a >= 40 or o > 0.2, 'r')      # unmapped specks of glare are not bunkers
    out[(out == ord('p')) & ~support['p']] = ord('r')     # shaded canopy edges look like asphalt: a path must be on the map's path
    out[(out == ord('r')) & er(osm['t'], 2)] = ord('t')   # smooth sunlit canopy inside a mapped wood is still wood
    demote('o', lambda a, o: o > 0.3, 'r')                 # roof-coloured dirt and leaves are not buildings
    demote('s', lambda a, o: a < 300 or o > 0.2, 'o')      # a big sand-coloured blob no map calls a bunker is a court or a yard
    out[osm['B'] | osm['R']] = ord('o')                   # buildings, parking and roads are out of bounds
    # the mapped club boundary hugs the holes: woods just beyond it stay trees (a lost ball, not a white stake), everything else is out
    near = nd.binary_dilation(inside, iterations=max(1, int(P['boundary_pad_m'] / mpp)))
    out[~inside & ~(near & (out == ord('t')))] = ord('o')
    return out, dict(train={ch: int(m.sum()) for ch, m in train.items()}, tex_lo=float(lo), tex_hi=float(hi))

def boundary_mask(course, img):
    p = f'{REFS}/{course}/boundary.json'
    H, W = img.rgb.shape[:2]
    if not os.path.exists(p): return np.ones((H, W), bool)
    m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m)
    for ring in json.load(open(p))['rings']: d.polygon([img.px(lat, lng) for lat, lng in ring], fill=1)
    return np.asarray(m).astype(bool)

def trace(course, n, aerial, card_yd):
    i = n - 1; img = Img(course, n)
    lat0, lng0 = aerial['teelat'][i], aerial['teelng'][i]
    cosl = math.cos(math.radians(lat0)); rad = math.pi / 180
    en = lambda lat, lng: ((lng - lng0) * rad * R_EARTH * cosl, (lat - lat0) * rad * R_EARTH)
    ll = lambda e, nn: (lat0 + nn / (R_EARTH * rad), lng0 + e / (R_EARTH * cosl * rad))
    pts = [(lat0, lng0), (aerial['doglat'][i], aerial['doglng'][i])]
    if aerial['catlat'][i] and aerial['catlng'][i]: pts.append((aerial['catlat'][i], aerial['catlng'][i]))
    pts.append((aerial['greenlat'][i], aerial['greenlng'][i]))
    E = [en(*p) for p in pts]
    E = [E[0]] + [q for a, q in zip(E, E[1:]) if math.hypot(q[0] - a[0], q[1] - a[1]) > 1]   # drop a dogleg point on the tee
    legs = [math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(E, E[1:])]
    shift = sum(legs) - card_yd * M_PER_YD                    # + slides the tee forward, - back (it is behind the marker)
    u0 = ((E[1][0] - E[0][0]) / legs[0], (E[1][1] - E[0][1]) / legs[0])
    tee = (u0[0] * shift, u0[1] * shift)
    gE = E[-1]; pinZ = math.hypot(gE[0] - tee[0], gE[1] - tee[1]); ue, un = (gE[0] - tee[0]) / pinZ, (gE[1] - tee[1]) / pinZ
    re_, rn = un, -ue                                          # sim +x: right of the tee-to-pin line
    teell = ll(*tee)
    greens = [img.px(aerial['greenlat'][k], aerial['greenlng'][k]) for k in range(18)]
    cls, stats = classify(img, SATELLITE, greens, boundary_mask(course, img), osm_masks(course, img, img.rgb.shape[:2]), np.random.default_rng(n))
    H, W = cls.shape
    nx = int(2 * X_HALF / CELL); nz = int((pinZ + Z_BEHIND + Z_BEYOND) / CELL)
    def sample(xs, zs):   # sim (x, z) arrays -> pixel coordinates
        e = tee[0] + zs * ue + xs * re_; nn = tee[1] + zs * un + xs * rn
        lat = lat0 + nn / (R_EARTH * rad); lng = lng0 + e / (R_EARTH * cosl * rad)
        X, Y = mercator_v(lat, lng, img.z)
        return (X - img.cx + img.w / 2) * img.kx, (Y - img.cy + img.h / 2) * img.ky
    # 3x3 votes per 2 m cell
    off = np.array([-0.33, 0, 0.33]) * CELL
    zc = -Z_BEHIND + (np.arange(nz) + 0.5) * CELL; xc = -X_HALF + (np.arange(nx) + 0.5) * CELL
    Z, X = np.meshgrid(zc, xc, indexing='ij')
    votes = {}
    for oz in off:
        for ox in off:
            px_, py_ = sample(X + ox, Z + oz); ix, iy = px_.astype(int), py_.astype(int)
            ok = (ix >= 0) & (iy >= 0) & (ix < W) & (iy < H)
            v = np.full(X.shape, ord('o'), np.uint8); v[ok] = cls[iy[ok], ix[ok]]
            for ch in 'owrcfgsptk':
                votes[ch] = votes.get(ch, 0) + (v == ord(ch))
    order = np.array([ord(c) for c in 'owrcfgsptk']); stack = np.stack([votes[c] for c in 'owrcfgsptk'])
    grid = order[stack.argmax(0)].astype(np.uint8)
    grid[(votes['s'] >= 3) & (grid != ord('g'))] = ord('s'); grid[(votes['p'] >= 3) & ~np.isin(grid, [ord('g'), ord('s')])] = ord('p')
    grid = cleanup(grid)
    # tree lines, not confetti: between rough and trees the 5x5-cell (10 m) majority decides
    rt = np.isin(grid, [ord('r'), ord('t')]); tf = nd.uniform_filter((grid == ord('t')).astype(np.float32), 5) / np.maximum(nd.uniform_filter(rt.astype(np.float32), 5), 1e-6)
    grid[rt] = np.where(tf[rt] >= 0.5, ord('t'), ord('r'))
    # first cut: a 2 m ring of rough around fairways
    f = grid == ord('f'); ring = nd.binary_dilation(f) & (grid == ord('r')); grid[ring] = ord('c')
    # tee box and pin always playable
    put = lambda x, z, r, c: grid.__setitem__((np.hypot(X - x, Z - z) <= r), ord(c))
    put(0, 0, 6, 'f'); put(0, pinZ, 4.5, 'g')
    bearing = (math.degrees(math.atan2(ue, un)) + 360) % 360
    return dict(n=n, grid=grid, nx=nx, nz=nz, pinZ=pinZ, geo=dict(lat=teell[0], lng=teell[1], bearing=bearing, scale=1.0), shift=shift,
                stats=stats, img=img, cls=cls, sample=sample, X=X, Z=Z)

def mercator_v(lat, lng, z):
    s = 256 * 2 ** z
    return (lng + 180) / 360 * s, (1 - np.log(np.tan(np.radians(lat)) + 1 / np.cos(np.radians(lat))) / np.pi) / 2 * s

def cleanup(g):
    """Mode-filter specks: grass and tree islands under 3 cells take their neighbours' majority (sand, green, water, path stay)."""
    out = g.copy()
    for ch in 'frtc':
        lab, k = nd.label(g == ord(ch))
        if not k: continue
        sizes = nd.sum(np.ones_like(lab), lab, range(1, k + 1))
        small = np.isin(lab, 1 + np.flatnonzero(sizes < 3))
        if not small.any(): continue
        best = None; bestc = None
        for c2 in 'owrcfgsptk':
            if c2 == ch: continue
            cnt = nd.uniform_filter((g == ord(c2)).astype(np.float32), 3)
            if best is None: best, bestc = cnt, np.full(g.shape, ord(c2), np.uint8)
            else: m = cnt > best; best = np.where(m, cnt, best); bestc = np.where(m, ord(c2), bestc)
        out[small] = bestc[small]
    return out

def rle(row):
    out = []; i = 0; row = [chr(c) for c in row]
    while i < len(row):
        j = i
        while j < len(row) and row[j] == row[i]: j += 1
        out.append(f'{row[i]}{j - i}' if j - i > 1 else row[i]); i = j
    return ''.join(out)

COLOURS = {'o': (30, 58, 36), 'w': (66, 150, 208), 'r': (63, 155, 78), 'c': (88, 176, 96), 'f': (111, 194, 106), 'g': (166, 217, 139), 's': (239, 230, 210), 'p': (184, 184, 186), 't': (25, 85, 45), 'k': (138, 143, 140)}

def qa(t, path):
    """Reference resampled into the grid frame | traced classes | 50% blend, 4 px per cell, tee at the bottom, pin at the top."""
    k = 4; nz, nx = t['nz'], t['nx']
    zs = -Z_BEHIND + (np.arange(nz * k)[::-1] + 0.5) * CELL / k; xs = -X_HALF + (np.arange(nx * k) + 0.5) * CELL / k
    Z, X = np.meshgrid(zs, xs, indexing='ij'); px_, py_ = t['sample'](X, Z)
    ref = np.stack([nd.map_coordinates(t['img'].rgb[..., c], [py_, px_], order=1, mode='constant', cval=0) for c in range(3)], -1)
    pal = np.zeros((256, 3), np.uint8)
    for ch, col in COLOURS.items(): pal[ord(ch)] = col
    cl = pal[np.repeat(np.repeat(t['grid'][::-1], k, 0), k, 1)].astype(np.float32)
    blend = ref * 0.5 + cl * 0.5
    im = np.concatenate([ref, cl, blend], 1).clip(0, 255).astype(np.uint8)
    img = Image.fromarray(im); d = ImageDraw.Draw(img)
    for o in range(3):   # tee and pin marks
        x0 = o * nx * k + nx * k / 2
        d.ellipse([x0 - 6, nz * k - (Z_BEHIND / CELL) * k - 6, x0 + 6, nz * k - (Z_BEHIND / CELL) * k + 6], outline=(255, 255, 255), width=2)
        yp = nz * k - (t['pinZ'] + Z_BEHIND) / CELL * k; d.ellipse([x0 - 6, yp - 6, x0 + 6, yp + 6], outline=(255, 225, 77), width=2)
    img.save(path)

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('course'); ap.add_argument('--holes', default='')
    a = ap.parse_args(); cfg = COURSE[a.course]
    aerial = json.load(open(f'{REFS}/{a.course}/aerial.json'))
    tees = aerial['tee'][cfg['tees']]
    holes = [int(x) for x in a.holes.split(',')] if a.holes else list(range(1, 19))
    os.makedirs(f'{REFS}/{a.course}/qa', exist_ok=True)
    traced = []
    for n in holes:
        t = trace(a.course, n, aerial, tees['distance'][n - 1]); traced.append(t)
        qa(t, f'{REFS}/{a.course}/qa/hole-{n:02d}.png')
        c = {ch: int((t['grid'] == ord(ch)).sum()) for ch in 'owrcfgsptk'}
        print(f"hole {n}: par {tees['par'][n - 1]} {tees['distance'][n - 1]} yd, tee shift {t['shift']:+.1f} m, pin {t['pinZ']:.1f} m, {t['stats']}, {c}", flush=True)
    if not a.holes:
        ident = a.course.replace('-', '_').upper()
        lines = [f'// GENERATED by scripts/trace_bluegolf.py from refs/{a.course} (BlueGolf satellite hole maps, {tees["description"]} tees). Do not edit.',
                 '// Per-hole lie grid: tee at the origin, pin on +z at pinZ, cell = metres, rows from z0 upward, each row run-length encoded (class char + optional count).',
                 '// Classes: o out of bounds, w water, r rough, c first cut, f fairway, g green, s sand, p cart path, t trees, k rock/shore.',
                 "import type { HoleGrid } from './course-grid';",
                 f"/** The card from the {tees['description']} (back) tees: [par, yards] per hole. */",
                 f"export const CARD: [number, number][] = {json.dumps([[p, d] for p, d in zip(tees['par'], tees['distance'])], separators=(', ', ': '))};",
                 'export const GRIDS: HoleGrid[] = [']
        for t in traced:
            g = t['geo']
            lines.append(f"  {{ x0: {-X_HALF}, z0: {-Z_BEHIND}, cell: {CELL}, nx: {t['nx']}, nz: {t['nz']}, coastal: false, margin: 0, pinZ: {t['pinZ']:.2f}, "
                         f"geo: {{ lat: {g['lat']:.7f}, lng: {g['lng']:.7f}, bearing: {g['bearing']:.3f}, scale: 1 }}, rows: [")
            lines += [f"    '{rle(r)}'," for r in t['grid']]; lines.append('  ] },')
        lines.append(']')
        open(os.path.join(ROOT, f'src/shared/course-grid-{a.course}.ts'), 'w').write('\n'.join(lines) + '\n')
