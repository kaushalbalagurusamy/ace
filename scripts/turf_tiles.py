#!/usr/bin/env python3
"""Turns the generated turf photos (assets/images/turf-*.png, local only) into seamless per-tier tiles:
assets/textures/turf/{2048,1024,512}/turf-<surface>.jpg, and records file, sha256 and variants in the manifest rows.
Seamless: variance-preserving blend with a half-offset copy, x then y (smoothstep masks), so no seam survives at the wrap or inside the tile.
Needs ImageMagick 7 (`magick`). Usage: python3 scripts/turf_tiles.py [turf-fairway ...]"""
import hashlib, json, pathlib, subprocess, sys, tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
SIZES = (2048, 1024, 512)
QUALITY = {2048: 80, 1024: 84, 512: 86}
MF = ROOT / "assets/manifest.json"
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
run = lambda *a: subprocess.run(["magick", *map(str, a)], check=True)

# Variance-preserving blend of u[0] (rolled) and u[1] (original) by mask u[2]: a plain cross-fade halves the contrast in the
# blend bands, which tiles into a visible grid on the ground.
# The per-channel mean is passed in (fx `mean` is over all channels, which would shift the hue in the bands).
BLEND = "wk=u[2]; mu=channel({}); mu + ((u[1]-mu)*wk + (u[0]-mu)*(1-wk)) / sqrt(wk*wk + (1-wk)*(1-wk))"

def seamless(src: pathlib.Path, out: pathlib.Path, n: int = 2048):
    with tempfile.TemporaryDirectory() as d:
        d = pathlib.Path(d); base, mx, my, a = d / "base.png", d / "mx.png", d / "my.png", d / "a.png"
        run(src, "-resize", f"{n}x{n}!", base)
        run("-size", f"{n}x1", "xc:", "-fx", "ramp=min(1,min(i,w-1-i)/(w/4)); ramp*ramp*(3-2*ramp)", "-scale", f"{n}x{n}!", mx)
        run(mx, "-rotate", "90", my)
        mean = subprocess.run(["magick", base, "-format", "%[fx:mean.r],%[fx:mean.g],%[fx:mean.b]", "info:"], check=True, capture_output=True, text=True).stdout
        blend = BLEND.format(mean)   # rolling keeps the mean, so one value serves both passes
        run(base, "-roll", f"+{n // 2}+0", base, mx, "-fx", blend, a)          # centre columns from the original, edges from the rolled copy
        run(a, "-roll", f"+0+{n // 2}", a, my, "-fx", blend, out)             # same for rows; the x pass is already wrap-continuous

ids = sys.argv[1:] or [p.stem for p in sorted((ROOT / "assets/images").glob("turf-*.png"))]
rows = json.loads(MF.read_text())
for i in ids:
    src = ROOT / "assets/images" / f"{i}.png"
    with tempfile.TemporaryDirectory() as d:
        tile = pathlib.Path(d) / "tile.png"; seamless(src, tile)
        variants = {}
        for n in SIZES:
            f = ROOT / f"assets/textures/turf/{n}/{i}.jpg"; f.parent.mkdir(parents=True, exist_ok=True)
            run(tile, "-resize", f"{n}x{n}", "-strip", "-sampling-factor", "4:2:0", "-quality", QUALITY[n], f)
            variants[str(n)] = {"file": str(f.relative_to(ROOT)), "sha256": sha(f), "bytes": f.stat().st_size}
    row = next(r for r in rows if r["id"] == i)
    top = variants["2048"]
    row.update(file=top["file"], sha256=top["sha256"], shipped_bytes=top["bytes"], variants=variants, source_png=f"assets/images/{i}.png",
               post_process="made seamless (variance-preserving half-offset smoothstep blend, x then y), resized to 2048/1024/512, JPEG q80/84/86 4:2:0 (ImageMagick, scripts/turf_tiles.py); original PNG kept local; normal and roughness are derived in the client")
    print(i, {k: v["bytes"] for k, v in variants.items()})
MF.write_text(json.dumps(rows, indent=2))
