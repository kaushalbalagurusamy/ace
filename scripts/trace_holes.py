#!/usr/bin/env python3
"""Trace the Pebble Beach hole graphics (refs/pebble-beach/hole-NN.jpg, SFGATE 2000 U.S. Open) into per-hole lie grids.
Pure Python (no PIL/numpy): sips converts each JPEG to BMP, pixels are classified by colour, the tee (ring marker) and
the flag give the scale and heading (card yardage), and the result is resampled so the tee is the origin and the pin is on +z.
  python3 scripts/trace_holes.py --preview 7        # writes a colour-coded PNG for hole 7 into the scratch dir
  python3 scripts/trace_holes.py --all              # writes src/shared/course-grid.ts
Classes: o out of bounds, w water, r rough, c first cut, f fairway, g green, s sand, p cart path, t trees, k rock/shore."""
import math, os, struct, subprocess, sys, tempfile
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
YARDS = [381, 502, 390, 331, 188, 524, 106, 418, 466, 446, 380, 202, 406, 573, 397, 403, 208, 543]
CELL = 2.0                      # metres per grid cell
X_HALF = 150.0                  # lateral extent either side of the tee-pin line
Z_BEHIND, Z_BEYOND = 40.0, 70.0 # grid starts this far behind the tee and ends this far past the pin
M_PER_YD = 0.9144

def load_bmp(path):
    d = open(path, 'rb').read(); off = struct.unpack_from('<I', d, 10)[0]; w, h = struct.unpack_from('<ii', d, 18); bpp = struct.unpack_from('<H', d, 28)[0]
    by = bpp // 8; row = (w * by + 3) // 4 * 4; flip = h > 0; h = abs(h); px = [None] * h
    for y in range(h):
        r = d[off + row * y: off + row * y + w * by]
        px[(h - 1 - y) if flip else y] = [(r[i * by + 2], r[i * by + 1], r[i * by]) for i in range(w)]
    return w, h, px

def make_classifier(coastal, centroids, green_ref, pin_px, green_r_px):
    """Per-image classifier: non-green colours by fixed rules, greens by nearest k-means centroid (darkest to brightest:
    trees, rough, first cut, fairway, fairway-highlight); the putting green is the pixels near the pin matching the colour around the flag."""
    def d2(a, b): return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
    names = ['t', 'r', 'c', 'f', 'f']
    def classify(c, x=None, y=None):
        r, g, b = c; mn = min(r, g, b)
        if mn >= 196 and b >= r - 3: return 'w' if (coastal and b >= r + 6) else 'o'   # blue-tinted wash is ocean; blank white is outside the drawn course
        if r >= 190 and g >= 190 and b <= r - 10 and b <= g - 6: return 's'
        sat = max(r, g, b) - mn
        if sat <= 22 and 135 <= r <= 225: return 'p'
        if g >= r + 20 and g >= b + 20:
            if x is not None and math.hypot(x - pin_px[0], y - pin_px[1]) <= green_r_px and d2(c, green_ref) <= 34 ** 2: return 'g'
            best = min(range(len(centroids)), key=lambda i: d2(c, centroids[i])); return names[best]
        if r >= g - 12 and sat <= 80 and r < 200: return 'k'
        return 'r'
    return classify

def kmeans(samples, k=5, iters=14):
    samples = sorted(samples, key=lambda c: c[1]); cents = [samples[int((i + 0.5) * len(samples) / k)] for i in range(k)]
    for _ in range(iters):
        groups = [[] for _ in range(k)]
        for c in samples: groups[min(range(k), key=lambda i: (c[0] - cents[i][0]) ** 2 + (c[1] - cents[i][1]) ** 2 + (c[2] - cents[i][2]) ** 2)].append(c)
        cents = [tuple(sum(c[j] for c in gr) / len(gr) for j in range(3)) if gr else cents[i] for i, gr in enumerate(groups)]
    return sorted(cents, key=lambda c: c[1])

def find_markers(px, w, h):
    """Tee = dark ring with a white centre (any size). Pin = foot of the flag pole under the yellow flag. Returns (tee, pin)."""
    ys = [(x, y) for y in range(0, h, 2) for x in range(0, w, 2) if px[y][x][0] > 215 and px[y][x][1] > 215 and px[y][x][2] < 110]
    if not ys: raise SystemExit('no flag found')
    fx = sum(p[0] for p in ys) / len(ys); fy = sum(p[1] for p in ys) / len(ys); fminx = min(p[0] for p in ys); fminy = min(p[1] for p in ys)
    # pole: dark pixels in a narrow column just left of the flag, running down; the last one is the pin
    pin = (fminx, fy)
    for y in range(int(fminy) - 4, min(h - 1, int(fminy) + 110)):
        if any(max(px[y][x]) < 110 for x in range(max(0, int(fminx) - 7), min(w, int(fminx) + 8))):
            xs = [x for x in range(max(0, int(fminx) - 7), min(w, int(fminx) + 8)) if max(px[y][x]) < 110]; pin = (sum(xs) / len(xs), y)
    seen = set(); best = None
    dark = {(x, y) for y in range(0, h, 2) for x in range(0, w, 2) if max(px[y][x]) < 110}
    for s0 in dark:
        if s0 in seen: continue
        comp = []; stack = [s0]; seen.add(s0)
        while stack:
            cx, cy = stack.pop(); comp.append((cx, cy))
            for dx in (-2, 0, 2):
                for dy in (-2, 0, 2):
                    n = (cx + dx, cy + dy)
                    if n in dark and n not in seen: seen.add(n); stack.append(n)
        xs = [p[0] for p in comp]; yy = [p[1] for p in comp]; bw = max(xs) - min(xs) + 2; bh = max(yy) - min(yy) + 2
        cx = (max(xs) + min(xs)) // 2; cy = (max(yy) + min(yy)) // 2
        if 12 <= bw <= 66 and 12 <= bh <= 66 and abs(bw - bh) <= 12 and len(comp) * 4 < bw * bh * 0.85 and 0 <= cx < w and 0 <= cy < h:
            if min(px[cy][cx]) >= 225 and math.hypot(cx - fx, cy - fy) > 100 and (best is None or len(comp) > best[0]): best = (len(comp), cx, cy)
    if not best: raise SystemExit('no tee ring found')
    return (best[1], best[2]), pin

def trace(n, tmp):
    bmp = os.path.join(tmp, f'hole-{n:02d}.bmp')
    subprocess.run(['sips', '-s', 'format', 'bmp', os.path.join(ROOT, f'refs/pebble-beach/hole-{n:02d}.jpg'), '--out', bmp], check=True, capture_output=True)
    w, h, px = load_bmp(bmp)
    blue = sum(1 for y in range(0, h, 6) for x in range(0, w, 6) if min(px[y][x]) >= 196 and px[y][x][2] > px[y][x][0] + 6)
    coastal = blue / ((w // 6) * (h // 6)) > 0.02
    (tx, ty), (pxp, pyp) = find_markers(px, w, h)
    yards0 = YARDS[n - 1]; scale0 = yards0 * M_PER_YD / math.hypot(pxp - tx, pyp - ty)
    gd = [(x, y) for y in range(0, h, 5) for x in range(0, w, 5) if px[y][x][1] >= px[y][x][0] + 20 and px[y][x][1] >= px[y][x][2] + 20]
    cents = kmeans([px[y][x] for x, y in gd[:: max(1, len(gd) // 4000)]])
    near = sorted(px[y][x] for y in range(int(pyp) - int(5 / scale0) - 2, int(pyp) + 3) for x in range(int(pxp) - int(5 / scale0), int(pxp) + int(5 / scale0)) if 0 <= x < w and 0 <= y < h and px[y][x][1] >= px[y][x][0] + 20 and px[y][x][1] >= px[y][x][2] + 20)
    green_ref = near[len(near) // 2] if near else cents[-1]
    classify = make_classifier(coastal, cents, green_ref, (pxp, pyp), 24 / scale0)
    yards = YARDS[n - 1]; L = yards * M_PER_YD
    dpx = math.hypot(pxp - tx, pyp - ty); scale = L / dpx            # metres per pixel
    ux, uy = (pxp - tx) / dpx, (pyp - ty) / dpx; rx, ry = -uy, ux      # forward and right in image coordinates (y down)
    nx = int(2 * X_HALF / CELL); z0 = -Z_BEHIND; nz = int((L + Z_BEHIND + Z_BEYOND) / CELL)
    rows = []
    for iz in range(nz):
        z = z0 + (iz + 0.5) * CELL; row = []
        for ix in range(nx):
            x = -X_HALF + (ix + 0.5) * CELL; votes = Counter()
            for ox in (-.33, 0, .33):
              for oz in (-.33, 0, .33):
                zz = z + oz * CELL; xx = x + ox * CELL
                ppx = tx + (zz * ux + xx * rx) / scale; ppy = ty + (zz * uy + xx * ry) / scale
                ix2, iy2 = int(ppx), int(ppy)
                votes[classify(px[iy2][ix2], ix2, iy2) if (0 <= ix2 < w and 0 <= iy2 < h) else 'o'] += 1     # beyond the graphic: outside
            # thin features survive a 2 m cell: sand and path win with 2 of 9 samples, rock shore with 3 (the rest by majority)
            row.append('s' if votes['s'] >= 2 else 'p' if votes['p'] >= 2 else 'k' if votes['k'] >= 3 else votes.most_common(1)[0][0])
        rows.append(row)
    # tee box and pin always playable
    def put(x, z, rad, c):
        for iz in range(nz):
            for ix in range(nx):
                if math.hypot(-X_HALF + (ix + .5) * CELL - x, z0 + (iz + .5) * CELL - z) <= rad: rows[iz][ix] = c
    put(0, 0, 6, 'f'); put(0, L, 4.5, 'g')
    return {'n': n, 'coastal': coastal, 'x0': -X_HALF, 'z0': z0, 'cell': CELL, 'nx': nx, 'nz': nz, 'rows': rows, 'L': L, 'scale': scale, 'tee': (tx, ty), 'pin': (pxp, pyp)}

def rle(row):
    out = []; i = 0
    while i < len(row):
        j = i
        while j < len(row) and row[j] == row[i]: j += 1
        out.append(f'{row[i]}{j - i}' if j - i > 1 else row[i]); i = j
    return ''.join(out)

COLOURS = {'o': (30, 80, 45), 'w': (70, 150, 210), 'r': (63, 155, 78), 'c': (88, 176, 96), 'f': (111, 194, 106), 'g': (166, 217, 139), 's': (239, 230, 210), 'p': (184, 184, 186), 't': (35, 110, 60), 'k': (138, 143, 140)}

def preview(g, path):
    nx, nz = g['nx'], g['nz']; cs = 4; w, h = nx * cs, nz * cs; rowb = (w * 3 + 3) // 4 * 4
    data = bytearray()
    for y in range(h - 1, -1, -1):           # BMP bottom-up; z increases upwards in the picture
        iz = nz - 1 - (y // cs)
        row = bytearray()
        for x in range(w):
            r, gg, b = COLOURS[g['rows'][iz][x // cs]]; row += bytes((b, gg, r))
        row += b'\0' * (rowb - len(row)); data += row
    hdr = b'BM' + struct.pack('<IHHI', 54 + len(data), 0, 0, 54) + struct.pack('<IiiHHIIiiII', 40, w, h, 1, 24, 0, len(data), 2835, 2835, 0, 0)
    open(path + '.bmp', 'wb').write(hdr + bytes(data))
    subprocess.run(['sips', '-s', 'format', 'png', path + '.bmp', '--out', path], check=True, capture_output=True)

if __name__ == '__main__':
    tmp = tempfile.mkdtemp(prefix='holes-')
    if sys.argv[1] == '--preview':
        n = int(sys.argv[2]); g = trace(n, tmp); out = sys.argv[3] if len(sys.argv) > 3 else f'/tmp/hole-{n:02d}-preview.png'
        preview(g, out); c = Counter(ch for r in g['rows'] for ch in r)
        print(f"hole {n}: coastal={g['coastal']} {g['nx']}x{g['nz']} cells, scale {g['scale']:.3f} m/px, classes {dict(c.most_common())} -> {out}")
    elif sys.argv[1] == '--all':
        lines = ['// GENERATED by scripts/trace_holes.py from refs/pebble-beach (SFGATE 2000 U.S. Open hole graphics). Do not edit.',
                 '// Per-hole lie grid: tee at the origin, pin on +z, cell = metres, rows from z0 upward, each row run-length encoded (class char + optional count).',
                 '// Classes: o out of bounds, w water, r rough, c first cut, f fairway, g green, s sand, p cart path, t trees, k rock/shore.',
                 'export interface HoleGrid { x0: number; z0: number; cell: number; nx: number; nz: number; coastal: boolean; rows: string[] }', 'export const GRIDS: HoleGrid[] = [']
        for n in range(1, 19):
            g = trace(n, tmp); lines.append(f"  {{ x0: {g['x0']}, z0: {g['z0']}, cell: {g['cell']}, nx: {g['nx']}, nz: {g['nz']}, coastal: {str(g['coastal']).lower()}, rows: [")
            lines += [f"    '{rle(r)}'," for r in g['rows']]; lines.append('  ] },'); print('traced hole', n, flush=True)
        lines.append(']'); open(os.path.join(ROOT, 'src/shared/course-grid.ts'), 'w').write('\n'.join(lines) + '\n')
