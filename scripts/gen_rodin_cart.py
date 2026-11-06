#!/usr/bin/env python3
"""Hyper3D Rodin image-to-3D for the Genesis Box Buggy body (PRD/07): reference photos in, one glb out, a manifest row appended.
Key from env RODIN_API_KEY only (never printed). Usage:
  set -a; . ../.env; set +a; python3 scripts/gen_rodin_cart.py ID IMG [IMG...] [--tier Gen-2.5-Medium] [--quality low]
Costs are read from the API (balance before/after and the submission's `consumed`), never estimated. qa verdict starts PENDING."""
import argparse, datetime, json, mimetypes, os, pathlib, sys, time, urllib.request, uuid

def env_key(name):   # from the environment, else from the .env named by ENV_FILE (read here so the key never passes through a shell)
    if name in os.environ: return os.environ[name]
    for line in pathlib.Path(os.environ.get("ENV_FILE", ".env")).read_text().splitlines():
        if line.strip().startswith(name + "="): return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit(f"{name} not set")
KEY = env_key("RODIN_API_KEY")
BASE = "https://api.hyper3d.com/api/v2"
ROOT = pathlib.Path(__file__).resolve().parent.parent

def req(method, path, body=None, ctype="application/json"):
    data = body if isinstance(body, bytes) or body is None else json.dumps(body).encode()
    r = urllib.request.Request(BASE + path, method=method, data=data, headers={"Authorization": f"Bearer {KEY}", "Content-Type": ctype})
    with urllib.request.urlopen(r, timeout=120) as res:
        return json.load(res)

def balance():
    try: return req("GET", "/check_balance").get("balance")
    except Exception as e: return f"unavailable ({e.__class__.__name__})"

def multipart(fields, files):
    b = uuid.uuid4().hex; out = b""
    for k, v in fields: out += f"--{b}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode()
    for p in files:
        out += (f"--{b}\r\nContent-Disposition: form-data; name=\"images\"; filename=\"{p.name}\"\r\nContent-Type: {mimetypes.guess_type(p.name)[0] or 'image/jpeg'}\r\n\r\n").encode()
        out += p.read_bytes() + b"\r\n"
    return out + f"--{b}--\r\n".encode(), f"multipart/form-data; boundary={b}"

ap = argparse.ArgumentParser()
ap.add_argument("id"); ap.add_argument("images", nargs="+")
ap.add_argument("--tier", default="Gen-2.5-Medium"); ap.add_argument("--quality", default="low")
ap.add_argument("--prompt", default="Genesis Box Buggy concept golf cart body: tall rounded glass canopy box with a dark navy-blue frame, tan and plaid interior, open sides, rear panel with white chrome strips. Body only.")
a = ap.parse_args()

before = balance(); print("balance before:", before, flush=True)
body, ctype = multipart([("tier", a.tier), ("quality", a.quality), ("mesh_mode", "Raw"), ("material", "Shaded"),
                         ("geometry_file_format", "glb"), ("prompt", a.prompt)], [pathlib.Path(p) for p in a.images])
sub = req("POST", "/rodin", body, ctype)
if "uuid" not in sub: sys.exit(f"rodin refused: {sub}")
task, key, consumed = sub["uuid"], sub["jobs"]["subscription_key"], sub.get("consumed")
print("submitted", task, "consumed", consumed, flush=True)
time.sleep(10); wait = 8
while True:
    jobs = req("POST", "/status", {"subscription_key": key}).get("jobs", [])
    st = [j.get("status") for j in jobs]; print(" status", st, flush=True)
    if any(s == "Failed" for s in st): sys.exit("rodin job failed")
    if st and all(s == "Done" for s in st): break
    time.sleep(wait); wait = min(30, wait * 1.3)
files = req("POST", "/download", {"task_uuid": task}).get("list", [])
glb = next((f for f in files if f["name"].endswith(".glb")), None)
if not glb: sys.exit(f"no glb in {[f['name'] for f in files]}")
raw = ROOT / "assets/models/raw" / f"{a.id}-rodin.glb"; raw.parent.mkdir(parents=True, exist_ok=True)
urllib.request.urlretrieve(glb["url"], raw)
after = balance(); print("balance after:", after, "| file:", raw, raw.stat().st_size, "bytes")
mf = ROOT / "assets/manifest.json"; rows = json.loads(mf.read_text())
rows.append({"id": a.id, "file": f"assets/models/{a.id}.glb", "tool": "Hyper3D Rodin image-to-3D", "model": a.tier, "quality": a.quality,
             "stage": "generated", "inputs": [f"refs/cart/{pathlib.Path(p).name}" for p in a.images], "prompt": a.prompt, "task_id": task,
             "date": datetime.date.today().isoformat(), "licence": "Hyper3D Rodin paid API terms: owner to confirm", "subagent": "motion-fidelity fork (script)",
             "credits_used": consumed, "balance_before": before, "balance_after": after,
             "qa": {"verdict": "PENDING", "notes": "body only; code-built wheels and chassis; supervisor critic decides"}})
mf.write_text(json.dumps(rows, indent=2, ensure_ascii=False) + "\n")
