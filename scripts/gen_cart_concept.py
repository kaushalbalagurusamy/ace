#!/usr/bin/env python3
"""Genesis cart concept image for Meshy: OpenAI image edit seeded with a refs/cart photo, so the generator sees the canopy as an opaque navy
frame around clear panes and the plaid seats through them. Key from env OPENAI_API_KEY, else the .env named by ENV_FILE (never printed).
Usage: ENV_FILE=../../../.env python3 scripts/gen_cart_concept.py PHOTO OUT.png [--model gpt-image-2-2026-04-21]"""
import argparse, base64, json, os, pathlib, sys, uuid, urllib.request

def env_key(name):
    if name in os.environ: return os.environ[name]
    for line in pathlib.Path(os.environ.get("ENV_FILE", ".env")).read_text().splitlines():
        if line.strip().startswith(name + "="): return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit(f"{name} not set")
PROMPT = ("Edit this photo into a clean product render of the same golf cart, same camera angle, same proportions, on a plain light grey studio background. "
          "The canopy is an opaque glossy dark navy blue frame: thick navy roof and four thick navy corner pillars, holding large perfectly clear, "
          "colourless, transparent glass panes with no tint, so the interior is plainly visible: cream tan leather seats with beige, brown and black "
          "tartan plaid cushions and backrests, a dashboard with a black tablet screen, a steering wheel. Glossy navy body with blue lower side sills, "
          "two thin white pinstripes and a small silver wing badge on the front panel. Black turf tyres on silver rims. Whole cart in frame, no people, no text.")
ap = argparse.ArgumentParser(); ap.add_argument("photo"); ap.add_argument("out"); ap.add_argument("--model", default="gpt-image-2-2026-04-21"); a = ap.parse_args()
b = uuid.uuid4().hex; img = pathlib.Path(a.photo).read_bytes()
parts = [f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode() for k, v in
         {"model": a.model, "prompt": PROMPT, "size": "1536x1024", "quality": "high"}.items()]
parts.append(f'--{b}\r\nContent-Disposition: form-data; name="image"; filename="ref.jpg"\r\nContent-Type: image/jpeg\r\n\r\n'.encode() + img + b"\r\n")
req = urllib.request.Request("https://api.openai.com/v1/images/edits", data=b"".join(parts) + f"--{b}--\r\n".encode(), method="POST",
                             headers={"Authorization": f"Bearer {env_key('OPENAI_API_KEY')}", "Content-Type": f"multipart/form-data; boundary={b}"})
try:
    with urllib.request.urlopen(req, timeout=300) as r: res = json.load(r)
except urllib.error.HTTPError as e: sys.exit(f"HTTP {e.code} {e.read()[:500]!r}")
pathlib.Path(a.out).write_bytes(base64.b64decode(res["data"][0]["b64_json"])); print("wrote", a.out, res.get("usage"))
