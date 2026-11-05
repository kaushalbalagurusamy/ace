#!/usr/bin/env python3
"""Golfer: Meshy multi-image-to-3D from the 3 cropped views, then auto-rig. Key from env MESHY_API_KEY only.
  set -a; . ./.env; set +a; python3 scripts/gen_meshy_golfer.py
Outputs raw glbs to assets/models/raw/ (gitignored) and appends manifest rows with credits read from the API."""
import base64, datetime, json, os, pathlib, sys, time, urllib.request

KEY = os.environ["MESHY_API_KEY"]; BASE = "https://api.meshy.ai/openapi"
ROOT = pathlib.Path(__file__).resolve().parent.parent
def call(method, path, body=None):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r: return json.load(r)
def wait(path):
    while True:
        t = call("GET", path); print(f"  {path.split('/')[1]} {t['status']} {t.get('progress')}%", flush=True)
        if t["status"] in ("SUCCEEDED", "FAILED", "CANCELED"): return t
        time.sleep(8)
def uri(p): return "data:image/png;base64," + base64.b64encode((ROOT / p).read_bytes()).decode()

views = ["assets/images/golfer-front.png", "assets/images/golfer-side.png", "assets/images/golfer-back.png"]
b0 = call("GET", "/v1/balance")["balance"]; print("balance before:", b0)
tid = call("POST", "/v1/multi-image-to-3d", {"image_urls": [uri(v) for v in views], "ai_model": "meshy-6", "should_texture": True, "enable_pbr": False,
      "should_remesh": True, "topology": "triangle", "target_polycount": 12000, "pose_mode": "a-pose", "target_formats": ["glb"]})["result"]
t = wait(f"/v1/multi-image-to-3d/{tid}")
if t["status"] != "SUCCEEDED": sys.exit(f"image-to-3d {t['status']}: {t.get('task_error')}")
raw = ROOT / "assets/models/raw"; raw.mkdir(parents=True, exist_ok=True)
urllib.request.urlretrieve(t["model_urls"]["glb"], raw / "golfer-mesh.glb")
c1 = t.get("consumed_credits", 0); print("mesh credits:", c1)
rid = call("POST", "/v1/rigging", {"input_task_id": tid, "height_meters": 1.8})["result"]
r = wait(f"/v1/rigging/{rid}")
if r["status"] != "SUCCEEDED": sys.exit(f"rigging {r['status']}: {r.get('task_error')}")
res = r["result"]; urllib.request.urlretrieve(res["rigged_character_glb_url"], raw / "golfer-rigged.glb")
c2 = r.get("consumed_credits", 0); b1 = call("GET", "/v1/balance")["balance"]
print("rig credits:", c2, "| balance after:", b1, "| animations:", [k for k in (res.get("basic_animations") or {})])
mf = ROOT / "assets/manifest.json"; rows = json.loads(mf.read_text())
base = {"tool": "Meshy multi-image-to-3D + auto-rig", "tier": "Pro", "date": datetime.date.today().isoformat(), "subagent": "build session (script)",
        "licence": "Meshy paid-tier terms (commercial use per plan): owner to confirm", "balance_before": b0, "balance_after": b1,
        "seed_images": views + ["assets/images/golfer-sheet.png"], "seed_image_model": "gpt-image-2-2026-04-21"}
rows.append({**base, "id": "golfer-mesh", "file": "assets/models/raw/golfer-mesh.glb", "model": "meshy-6", "task_id": tid, "credits_used": c1, "prompt": "3 views of the Ace golfer concept sheet"})
rows.append({**base, "id": "golfer-rigged", "file": "assets/models/raw/golfer-rigged.glb", "model": "meshy rigging", "task_id": rid, "credits_used": c2, "height_m": 1.8})
mf.write_text(json.dumps(rows, indent=2))
