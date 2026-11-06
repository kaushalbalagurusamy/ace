#!/usr/bin/env python3
"""Hyper3D Rodin Gen-2.5 image-to-3D: submit seed image(s), poll, download the GLB, shrink it for the web, append a manifest row (qa PENDING).
Key from env RODIN_API_KEY only (never printed). Balance read from the API before and after every job.
  set -a; . ./.env; set +a; python3 scripts/gen_rodin.py ID HEIGHT_M "prompt" IMAGE [IMAGE ...] [--faces 20000] [--keep 0.35] [--seed-photo refs/...]
The raw GLB stays in assets/models/raw/ (gitignored); the shipped copy is Draco + WebP (textures <= 1024) after meshoptimizer simplification."""
import argparse, datetime, json, os, pathlib, subprocess, sys, time, urllib.request, uuid

if sys.argv[1:] == ["--merge"]:   # fold staged rows into the manifest (replacing rows with the same id)
    mf = pathlib.Path(__file__).resolve().parent.parent / "assets/manifest.json"; rows = json.loads(mf.read_text())
    for p in sorted((mf.parent / "models/raw").glob("*.row.json")):
        r = json.loads(p.read_text()); rows = [x for x in rows if x.get("id") != r["id"]] + [r]; print("merged", r["id"])
    mf.write_text(json.dumps(rows, indent=2)); sys.exit(0)
KEY = os.environ["RODIN_API_KEY"]; BASE = "https://api.hyper3d.com/api/v2"
ROOT = pathlib.Path(__file__).resolve().parent.parent
GT = os.environ.get("GLTF_TRANSFORM", "/Users/kaushal/.npm/_npx/a6797f7ff67bb1f2/node_modules/.bin/gltf-transform")

def call(path, body=None, files=None):
    if files is not None:   # multipart: repeated `images` parts plus plain fields
        b = uuid.uuid4().hex; parts = []
        for k, v in body.items(): parts.append(f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
        for p in files:
            parts.append(f'--{b}\r\nContent-Disposition: form-data; name="images"; filename="{p.name}"\r\nContent-Type: image/png\r\n\r\n'.encode() + p.read_bytes() + b"\r\n")
        data, ctype = b"".join(parts) + f"--{b}--\r\n".encode(), f"multipart/form-data; boundary={b}"
    else:
        data, ctype = (json.dumps(body).encode() if body is not None else None), "application/json"
    req = urllib.request.Request(BASE + path, data=data, method="POST" if data is not None else "GET", headers={"Authorization": f"Bearer {KEY}", "Content-Type": ctype})
    try:
        with urllib.request.urlopen(req, timeout=300) as r: return json.load(r)
    except urllib.error.HTTPError as e: sys.exit(f"HTTP {e.code} on {path}: {e.read().decode()[:400]}")

balance = lambda: call("/check_balance").get("balance")

ap = argparse.ArgumentParser(); ap.add_argument("id"); ap.add_argument("height", type=float); ap.add_argument("prompt"); ap.add_argument("images", nargs="+")
ap.add_argument("--faces", type=int, default=8000); ap.add_argument("--keep", type=float, default=1.0); ap.add_argument("--tier", default="Gen-2.5-Low")   # Medium and up are refused on this API plan (API_NO_ACTIVE_SUBSCRIPTION)
ap.add_argument("--seed-photo", action="append", default=[]); ap.add_argument("--texture", type=int, default=1024)
ap.add_argument("--texture-mode", default=None, help="Rodin texture_mode (extreme-low..extreme-high); default follows the tier")
a = ap.parse_args()
imgs = [pathlib.Path(p) for p in a.images]
b0 = balance(); print("balance before:", b0, flush=True)
sub = call("/rodin", {"tier": a.tier, "prompt": a.prompt, "geometry_file_format": "glb", "material": "PBR", "mesh_mode": "Raw", "quality": "medium", "quality_override": a.faces, **({"texture_mode": a.texture_mode} if a.texture_mode else {})}, imgs)
if "uuid" not in sub: sys.exit(f"submit failed: {sub}")
print("submitted", sub["uuid"], "consumed", sub.get("consumed"), flush=True)
time.sleep(8)
while True:
    st = call("/status", {"subscription_key": sub["jobs"]["subscription_key"]})
    ss = [j.get("status") for j in st.get("jobs", [])]; print("  status", ss, flush=True)
    if any(s == "Failed" for s in ss): sys.exit("job failed")
    if ss and all(s == "Done" for s in ss): break
    time.sleep(10)
dl = call("/download", {"task_uuid": sub["uuid"]})
files = dl.get("list") or dl.get("files") or []
glb = next((f for f in files if f.get("name", "").endswith(".glb")), None)
if not glb: sys.exit(f"no glb in {[f.get('name') for f in files]}")
raw = ROOT / "assets/models/raw" / f"{a.id}.glb"; raw.parent.mkdir(parents=True, exist_ok=True)
urllib.request.urlretrieve(glb["url"], raw)
out = ROOT / "assets/models" / f"{a.id}.glb"
subprocess.run([GT, "optimize", str(raw), str(out), "--compress", "draco", "--texture-compress", "webp", "--texture-size", str(a.texture),
                *(["--simplify", "true", "--simplify-ratio", str(a.keep), "--simplify-error", "0.02"] if a.keep < 1 else ["--simplify", "false"]),
                "--flatten", "true", "--join", "true"], check=True, capture_output=True)
b1 = balance(); print("balance after:", b1, "| raw", raw.stat().st_size, "-> shipped", out.stat().st_size, "bytes", flush=True)
row = ({"id": a.id, "file": f"assets/models/{a.id}.glb", "tool": "Hyper3D Rodin image-to-3D", "model": a.tier, "tier": "API",
             "prompt": a.prompt, "seed_images": [str(p.relative_to(ROOT)) if p.is_relative_to(ROOT) else p.name for p in imgs], "seed_photos": a.seed_photo,
             "task_id": sub["uuid"], "faces_requested": a.faces, "texture_mode": a.texture_mode, "credits_used": sub.get("consumed"), "balance_before": b0, "balance_after": b1,
             "target_height_m": a.height, "date": datetime.date.today().isoformat(),
             "post_process": f"gltf-transform optimize: meshopt simplify ratio {a.keep} (1 = none; Rodin face target {a.faces}), draco, webp textures <= {a.texture}; raw kept local (assets/models/raw, gitignored)",
             "licence": "Hyper3D Rodin API terms (generated output owned by the user per plan): owner to confirm", "subagent": "visual realism (worktree session)",
             "qa": {"verdict": "PENDING"}})
# The row is staged next to the raw file and merged by --merge, so parallel jobs (and gen_images.py) never overwrite each other's manifest edits.
(raw.parent / f"{a.id}.row.json").write_text(json.dumps(row, indent=2)); print("row staged:", a.id)
