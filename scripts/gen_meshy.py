#!/usr/bin/env python3
"""Meshy text-to-3D: preview, optional refine, download glb, append a manifest row.
Key from env MESHY_API_KEY only (never printed). Usage:
  set -a; . ./.env; set +a; python3 scripts/gen_meshy.py ID "prompt" [--refine] [--polycount N] [--model meshy-6-lite] [--pose a-pose]
Costs are read from the API (balance before/after and each task's consumed_credits), never estimated."""
import argparse, json, os, sys, time, urllib.request, datetime, pathlib

KEY = os.environ["MESHY_API_KEY"]
BASE = "https://api.meshy.ai/openapi"
ROOT = pathlib.Path(__file__).resolve().parent.parent
STYLE = (ROOT / "assets/STYLE.md").read_text()

def call(method, path, body=None):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)

def balance():
    return call("GET", "/v1/balance").get("balance")

def wait(task_id):
    while True:
        t = call("GET", f"/v2/text-to-3d/{task_id}")
        print(f"  {t['type']} {t['status']} {t.get('progress')}%", flush=True)
        if t["status"] in ("SUCCEEDED", "FAILED", "CANCELED"):
            return t
        time.sleep(8)

ap = argparse.ArgumentParser()
ap.add_argument("id"); ap.add_argument("prompt")
ap.add_argument("--refine", action="store_true"); ap.add_argument("--polycount", type=int, default=3000)
ap.add_argument("--model", default="meshy-6-lite"); ap.add_argument("--pose", default="")
a = ap.parse_args()

before = balance(); print("balance before:", before)
palette = "Style: stylised low-poly, flat-shaded facets, soft painterly colours, matte, single object, no ground, no text. "
pre = call("POST", "/v2/text-to-3d", {"mode": "preview", "prompt": palette + a.prompt, "ai_model": a.model, "should_remesh": True,
           "topology": "triangle", "target_polycount": a.polycount, "pose_mode": a.pose, "target_formats": ["glb"]})["result"]
t = wait(pre); credits = t.get("consumed_credits", 0)
if t["status"] != "SUCCEEDED": sys.exit(f"preview {t['status']}: {t.get('task_error')}")
final = t
if a.refine:
    ref = call("POST", "/v2/text-to-3d", {"mode": "refine", "preview_task_id": pre, "enable_pbr": False, "target_formats": ["glb"],
               "texture_prompt": "matte painterly colours from the Ace palette: " + a.prompt[:300]})["result"]
    final = wait(ref); credits += final.get("consumed_credits", 0)
    if final["status"] != "SUCCEEDED": sys.exit(f"refine {final['status']}: {final.get('task_error')}")
out = ROOT / "assets/models" / f"{a.id}.glb"; out.parent.mkdir(parents=True, exist_ok=True)
urllib.request.urlretrieve(final["model_urls"]["glb"], out)
after = balance(); print("balance after:", after, "| task credits:", credits, "| file:", out.name, out.stat().st_size, "bytes")
mf = ROOT / "assets/manifest.json"; rows = json.loads(mf.read_text()) if mf.exists() else []
row = {"id": a.id, "file": f"assets/models/{a.id}.glb", "tool": "Meshy text-to-3D", "model": a.model, "tier": "Pro",
       "stage": "refined" if a.refine else "preview", "prompt": a.prompt, "task_id": final["id"], "date": datetime.date.today().isoformat(),
       "licence": "Meshy paid-tier terms (commercial use per plan): owner to confirm", "subagent": "build session (script)",
       "credits_used": credits, "balance_before": before, "balance_after": after}
if isinstance(rows, dict): rows.setdefault("assets", []).append(row)
else: rows.append(row)
mf.write_text(json.dumps(rows, indent=2))
