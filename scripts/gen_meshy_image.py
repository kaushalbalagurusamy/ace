#!/usr/bin/env python3
"""Meshy image-to-3D (PBR): submit one seed image, poll, download the GLB, shrink it for the web, stage a manifest row (qa PENDING).
Key from env MESHY_API_KEY only (never printed). Credits are read from the API (balance before/after, task consumed_credits).
  python3 scripts/gen_meshy_image.py ID HEIGHT_M IMAGE [--polycount 6000] [--model latest] [--seed-photo refs/...]
Rows are staged in assets/models/raw/ID.row.json and folded in with `python3 scripts/gen_rodin.py --merge`."""
import argparse, base64, datetime, json, os, pathlib, subprocess, sys, time, urllib.error, urllib.request

KEY = os.environ["MESHY_API_KEY"]; BASE = "https://api.meshy.ai/openapi"
ROOT = pathlib.Path(__file__).resolve().parent.parent
GT = os.environ.get("GLTF_TRANSFORM", "/Users/kaushal/.npm/_npx/a6797f7ff67bb1f2/node_modules/.bin/gltf-transform")

def call(method, path, body=None):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return json.load(r)
    except urllib.error.HTTPError as e: sys.exit(f"HTTP {e.code} on {path}: {e.read().decode()[:400]}")

ap = argparse.ArgumentParser(); ap.add_argument("id"); ap.add_argument("height", type=float); ap.add_argument("image")
ap.add_argument("--polycount", type=int, default=6000); ap.add_argument("--model", default="latest")
ap.add_argument("--seed-photo", action="append", default=[]); ap.add_argument("--texture", type=int, default=1024)
a = ap.parse_args()
img = pathlib.Path(a.image); mime = "image/jpeg" if img.suffix.lower() in (".jpg", ".jpeg") else "image/png"
b0 = call("GET", "/v1/balance")["balance"]; print("balance before:", b0, flush=True)
tid = call("POST", "/v1/image-to-3d", {"image_url": f"data:{mime};base64," + base64.b64encode(img.read_bytes()).decode(), "ai_model": a.model,
           "should_texture": True, "enable_pbr": True, "should_remesh": True, "topology": "triangle", "target_polycount": a.polycount,
           "texture_resolution": "2k", "target_formats": ["glb"]})["result"]
print("submitted", tid, flush=True)
while True:
    t = call("GET", f"/v1/image-to-3d/{tid}"); print("  status", t["status"], t.get("progress"), flush=True)
    if t["status"] in ("SUCCEEDED", "FAILED", "CANCELED"): break
    time.sleep(10)
if t["status"] != "SUCCEEDED": sys.exit(f"task {t['status']}: {t.get('task_error')}")
raw = ROOT / "assets/models/raw" / f"{a.id}.glb"; raw.parent.mkdir(parents=True, exist_ok=True)
urllib.request.urlretrieve(t["model_urls"]["glb"], raw)
out = ROOT / "assets/models" / f"{a.id}.glb"
subprocess.run([GT, "optimize", str(raw), str(out), "--compress", "draco", "--texture-compress", "webp", "--texture-size", str(a.texture),
                "--simplify", "false", "--flatten", "true", "--join", "true"], check=True, capture_output=True)
b1 = call("GET", "/v1/balance")["balance"]; print("balance after:", b1, "| consumed", t.get("consumed_credits"), "| shipped", out.stat().st_size, "bytes", flush=True)
row = {"id": a.id, "file": f"assets/models/{a.id}.glb", "tool": "Meshy image-to-3D", "model": t.get("ai_model", a.model), "tier": "Pro",
       "seed_images": [str(img.relative_to(ROOT)) if img.is_relative_to(ROOT) else img.name], "seed_photos": a.seed_photo, "task_id": tid,
       "target_polycount": a.polycount, "pbr": True, "credits_used": t.get("consumed_credits"), "balance_before": b0, "balance_after": b1,
       "target_height_m": a.height, "date": datetime.date.today().isoformat(),
       "post_process": f"gltf-transform optimize: draco, webp textures <= {a.texture}; raw kept local (assets/models/raw, gitignored)",
       "licence": "Meshy paid-tier terms (commercial use per plan): owner to confirm", "subagent": "visual realism round 2 (worktree session)",
       "qa": {"verdict": "PENDING"}}
(raw.parent / f"{a.id}.row.json").write_text(json.dumps(row, indent=2)); print("row staged:", a.id)
