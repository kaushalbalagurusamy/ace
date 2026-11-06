#!/usr/bin/env python3
"""Genesis Box Buggy body: Meshy multi-image-to-3D (latest model, textured, PBR) from the refs/cart photos (first = front view).
Key from env MESHY_API_KEY, else read from the .env named by ENV_FILE (never printed). Usage:
  ENV_FILE=../../../.env python3 scripts/gen_meshy_cart.py ID IMG [IMG...] [--polycount 50000] [--prompt TEXT] [--no-texture-prompt]
Writes assets/models/raw/ID.glb (gitignored) and appends a manifest row ID with credits read from the API, never estimated."""
import argparse, base64, datetime, json, mimetypes, os, pathlib, sys, time, urllib.request

def env_key(name):
    if name in os.environ: return os.environ[name]
    for line in pathlib.Path(os.environ.get("ENV_FILE", ".env")).read_text().splitlines():
        if line.strip().startswith(name + "="): return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit(f"{name} not set")
KEY = env_key("MESHY_API_KEY"); BASE = "https://api.meshy.ai/openapi"
ROOT = pathlib.Path(__file__).resolve().parent.parent
PROMPT = ("Concept golf cart. Body panels, roof frame and pillars glossy dark navy blue (#2E3F66). Large clear glass windows. Interior cream tan "
          "leather (#D8C4A0) with beige-brown tartan plaid seat panels. Two thin white pinstripes across the front panel, small silver wing badge. "
          "Red light bar across the rear. Black knobby turf tyres on silver rims, dark grey suspension.")

def call(method, path, body=None):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return json.load(r)
    except urllib.error.HTTPError as e: sys.exit(f"{method} {path}: HTTP {e.code} {e.read()[:500]!r}")
def uri(p): return f"data:{mimetypes.guess_type(p)[0]};base64," + base64.b64encode(pathlib.Path(p).read_bytes()).decode()

ap = argparse.ArgumentParser(); ap.add_argument("id"); ap.add_argument("images", nargs="+")
ap.add_argument("--polycount", type=int, default=50000); ap.add_argument("--prompt", default=PROMPT); ap.add_argument("--no-texture-prompt", action="store_true")
ap.add_argument("--geometry", default="standard", choices=["standard", "2k"])   # 2k = Ultra geometry, +5 credits
ap.add_argument("--retexture", metavar="TASK_ID", help="re-texture that task's mesh from the photos instead (multiview, its UVs kept)")
ap.add_argument("--style-image", action="store_true", help="with --retexture: first image as the style image plus --prompt as text style")
a = ap.parse_args()
b0 = call("GET", "/v1/balance")["balance"]; print("balance before:", b0)
kind = "retexture" if a.retexture else "multi-image-to-3d"
if a.retexture:
    body = {"input_task_id": a.retexture, "ai_model": "meshy-7", "enable_original_uv": True, "enable_pbr": True, "texture_resolution": "2k", "target_formats": ["glb"]}
    if a.style_image: body.update(image_style_url=uri(a.images[0]), text_style_prompt=a.prompt[:600])   # one photo as style + the text
    else: body["multiview_image_urls"] = [uri(p) for p in a.images]
else:
    body = {"image_urls": [uri(p) for p in a.images], "ai_model": "latest", "should_texture": True, "enable_pbr": True, "texture_resolution": "2k",
            "geometry_resolution": a.geometry, "should_remesh": True, "topology": "triangle", "target_polycount": a.polycount, "target_formats": ["glb"]}
    if not a.no_texture_prompt: body["texture_prompt"] = a.prompt[:800]
tid = call("POST", f"/v1/{kind}", body)["result"]; print("task:", tid)
while True:
    t = call("GET", f"/v1/{kind}/{tid}"); print(f"  {t['status']} {t.get('progress')}%", flush=True)
    if t["status"] in ("SUCCEEDED", "FAILED", "CANCELED"): break
    time.sleep(10)
if t["status"] != "SUCCEEDED": sys.exit(f"{kind} {t['status']}: {t.get('task_error')}")
raw = ROOT / "assets/models/raw"; raw.mkdir(parents=True, exist_ok=True); out = raw / f"{a.id}.glb"
urllib.request.urlretrieve(t["model_urls"]["glb"], out)
b1 = call("GET", "/v1/balance")["balance"]; print("credits:", t.get("consumed_credits"), "| balance after:", b1, "|", out.name, out.stat().st_size, "bytes")
mf = ROOT / "assets/manifest.json"; rows = [r for r in json.loads(mf.read_text()) if r.get("id") != a.id]
rows.append({"id": a.id, "file": f"assets/models/raw/{a.id}.glb (local only, raw intermediate)", "tool": f"Meshy {kind}", "model": "meshy-7" if a.retexture else "meshy-7.1 (latest)", "retexture_of": a.retexture,
             "tier": "Pro", "inputs": [f"refs/cart/{pathlib.Path(p).name}" for p in a.images], "prompt": body.get("texture_prompt"), "task_id": tid,
             "target_polycount": a.polycount, "geometry_resolution": a.geometry, "enable_pbr": True, "date": datetime.date.today().isoformat(), "subagent": "cart asset agent (script)",
             "licence": "Meshy paid-tier terms (commercial use per plan): owner to confirm", "credits_used": t.get("consumed_credits"),
             "balance_before": b0, "balance_after": b1})
mf.write_text(json.dumps(rows, indent=2, ensure_ascii=False) + "\n")
