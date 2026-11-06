#!/usr/bin/env python3
"""Makes the generated rock textures (assets/images/tex-cliff.png, tex-seawall.png; local only) seamless and ships them as
assets/textures/<id>.jpg at 1024 px, recording file, sha256 and post-processing in their manifest rows. The client derives the
normal map from luminance at load (coast.ts deriveNormal). Usage: python3 scripts/rock_tiles.py [tex-cliff ...]"""
import json, pathlib, sys, tempfile
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from turf_tiles import ROOT, MF, run, seamless, sha

rows = json.loads(MF.read_text())
for i in sys.argv[1:] or ["tex-cliff", "tex-seawall"]:
    out = ROOT / f"assets/textures/{i}.jpg"
    with tempfile.TemporaryDirectory() as d:
        tile = pathlib.Path(d) / "tile.png"; seamless(ROOT / f"assets/images/{i}.png", tile, 1024)
        run(tile, "-strip", "-sampling-factor", "4:2:0", "-quality", "84", out)
    row = next(r for r in rows if r["id"] == i)
    row.update(file=str(out.relative_to(ROOT)), sha256=sha(out), shipped_bytes=out.stat().st_size, source_png=f"assets/images/{i}.png",
               post_process="made seamless (scripts/turf_tiles.py blend), 1024 px JPEG q84 (scripts/rock_tiles.py); normal map derived in code from luminance (src/client/coast.ts)",
               qa={"verdict": "PENDING"})
    print(i, out.stat().st_size)
MF.write_text(json.dumps(rows, indent=2))
