#!/usr/bin/env python3
"""Club heads: Meshy multi-image-to-3D from the owner-approved Callaway/Odyssey photos in refs/callaway/ (reference only, never shipped).
  set -a; . ./.env; set +a; python3 scripts/gen_meshy_clubs.py [asset-id ...]    # default: all
Key from env MESHY_API_KEY only. Credits are read from the API; seed photo file names go into every manifest row."""
import base64, datetime, json, os, pathlib, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

KEY = os.environ["MESHY_API_KEY"]; BASE = "https://api.meshy.ai/openapi"
ROOT = pathlib.Path(__file__).resolve().parent.parent
# asset id -> (photo stem in refs/callaway, product, in-game loft label)
CLUBS = {
  "club-driver": ("club-driver", "Callaway Elyte Triple Diamond Driver (2025)", "8 deg"),
  "club-3w": ("club-3w", "Callaway Elyte Triple Diamond Fairway Wood (2025)", "15 deg"),
  "club-ut": ("club-ut", "Callaway Apex Utility Iron (#2 UDI, stamped 18 deg; the photos show a 22 deg head)", "18 deg"),
  "club-iron": ("club-iron", "Callaway X Forged Iron (2025)", "4i-PW"),
  "club-wedge-50": ("club-wedge-opus-sp", "Callaway Opus SP Chrome Wedge (2025)", "50 deg"),
  "club-wedge-54": ("club-wedge-opus-sp-plus", "Callaway Opus SP+ Chrome Wedge (2026 page)", "54 deg"),
  "club-wedge-62": ("club-wedge-full-toe-sp", "Callaway Full Toe SP Wedge (2026 page)", "62 deg"),
  "club-putter": ("club-putter", "Odyssey Square 2 Square TRI-HOT Black Seven CS Putter", "putter"),
}
def call(method, path, body=None):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None, headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as r: return json.load(r)
def uri(p): return "data:image/jpeg;base64," + base64.b64encode(p.read_bytes()).decode()

def make(asset):
    stem, product, loft = CLUBS[asset]; photos = sorted((ROOT / "refs/callaway").glob(f"{stem}-[1-4].jpg"))
    assert len(photos) == 4, (asset, photos)
    tid = call("POST", "/v1/multi-image-to-3d", {"image_urls": [uri(p) for p in photos], "ai_model": "meshy-6", "should_texture": True, "enable_pbr": False,
          "should_remesh": True, "topology": "triangle", "target_polycount": 4000, "target_formats": ["glb"]})["result"]
    while True:
        t = call("GET", f"/v1/multi-image-to-3d/{tid}")
        if t["status"] in ("SUCCEEDED", "FAILED", "CANCELED"): break
        time.sleep(8)
    if t["status"] != "SUCCEEDED": return {"asset": asset, "error": f"{t['status']}: {t.get('task_error')}"}
    raw = ROOT / "assets/models/raw"; raw.mkdir(parents=True, exist_ok=True); out = raw / f"{asset}.glb"
    urllib.request.urlretrieve(t["model_urls"]["glb"], out)
    return {"id": asset, "file": f"assets/models/{asset}.glb", "tool": "Meshy multi-image-to-3D", "model": "meshy-6", "tier": "Pro", "stage": "textured",
            "seed_photos": [f"refs/callaway/{p.name}" for p in photos], "seed_source": "callawaygolf.com / odyssey.callawaygolf.com product photos (reference only, never shipped); owner-approved, sponsor allows logos as they appear",
            "product": product, "loft_label": loft, "task_id": tid, "credits_used": t.get("consumed_credits", 0), "date": datetime.date.today().isoformat(),
            "licence": "Meshy paid-tier terms (commercial use per plan): owner to confirm", "subagent": "build session (script)", "raw": f"assets/models/raw/{asset}.glb (local only)"}

if __name__ == "__main__":
    ids = sys.argv[1:] or list(CLUBS)
    b0 = call("GET", "/v1/balance")["balance"]; print("balance before:", b0, flush=True)
    with ThreadPoolExecutor(4) as ex: results = list(ex.map(make, ids))
    b1 = call("GET", "/v1/balance")["balance"]; print("balance after:", b1, "| used:", b0 - b1)
    mf = ROOT / "assets/manifest.json"; rows = json.loads(mf.read_text())
    for r in results:
        if "error" in r: print("FAILED", r); continue
        rows = [x for x in rows if x.get("id") != r["id"]]; r.update({"balance_before": b0, "balance_after": b1}); rows.append(r); print("ok", r["id"], "credits", r["credits_used"])
    mf.write_text(json.dumps(rows, indent=2))
