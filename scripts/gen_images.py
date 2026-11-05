#!/usr/bin/env python3
"""OpenAI image generation with the model pinned, a 40-image nightly cap and a manifest row per image.
Key from env OPENAI_API_KEY only. Usage:
  set -a; . ./.env; set +a; python3 scripts/gen_images.py ID "prompt" [--size 1024x1024] [--quality low|medium|high]"""
import argparse, base64, datetime, json, os, pathlib, urllib.request

MODEL = "gpt-image-2-2026-04-21"  # pinned by the owner so every image shares one look
CAP = 40
KEY = os.environ["OPENAI_API_KEY"]
ROOT = pathlib.Path(__file__).resolve().parent.parent
mf = ROOT / "assets/manifest.json"
rows = json.loads(mf.read_text()) if mf.exists() else []
used = sum(1 for r in rows if r.get("tool") == "OpenAI images")
ap = argparse.ArgumentParser(); ap.add_argument("id"); ap.add_argument("prompt")
ap.add_argument("--size", default="1024x1024"); ap.add_argument("--quality", default="low", choices=["low", "medium", "high"])
a = ap.parse_args()
if used >= CAP: raise SystemExit(f"image cap reached ({used}/{CAP})")
req = urllib.request.Request("https://api.openai.com/v1/images/generations", method="POST",
      data=json.dumps({"model": MODEL, "prompt": a.prompt, "size": a.size, "quality": a.quality, "n": 1}).encode(),
      headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
with urllib.request.urlopen(req, timeout=300) as r: resp = json.load(r)
out = ROOT / "assets/images" / f"{a.id}.png"; out.parent.mkdir(parents=True, exist_ok=True)
out.write_bytes(base64.b64decode(resp["data"][0]["b64_json"]))
rows.append({"id": a.id, "file": f"assets/images/{a.id}.png", "tool": "OpenAI images", "model": MODEL, "tier": "API", "quality": a.quality,
             "size": a.size, "prompt": a.prompt, "date": datetime.date.today().isoformat(), "usage": resp.get("usage"),
             "licence": "OpenAI API terms: output usable commercially, owner to confirm", "subagent": "build session (script)"})
mf.write_text(json.dumps(rows, indent=2)); print(f"saved {out.name} ({out.stat().st_size} bytes); images used {used + 1}/{CAP}")
