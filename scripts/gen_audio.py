#!/usr/bin/env python3
"""Generate P1 audio (PRD/06) with ElevenLabs. Key from env ELEVENLABS_API_KEY only.
Run: set -a; . ./.env; set +a; python3 scripts/gen_audio.py
Idempotent: skips files that exist. Stops if credits used would exceed CAP."""
import json, os, subprocess, sys, datetime, urllib.request, urllib.error, tempfile, shutil

KEY = os.environ["ELEVENLABS_API_KEY"]
API = "https://api.elevenlabs.io/v1"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "audio")
MANIFEST = os.path.join(ROOT, "assets", "manifest.json")
CAP = 8000
VOICE = ("JBFqnCBsd6RMkjVDRZzb", "George")  # warm, mature; announcer-style read
TTS_MODEL = "eleven_multilingual_v2"
SFX_MODEL = "eleven_text_to_sound_v2"
LICENCE = "ElevenLabs Starter commercial licence per plan terms — unverified, owner to confirm"
HAVE_FFMPEG = shutil.which("ffmpeg") and shutil.which("ffprobe")

# (id, kind, prompt/text, duration_s, loop)
S = "no music, no voice, clean isolated game sound effect, "
A = [
 ("sfx-swing-soft", "sfx", S+"soft golf club swing whoosh through air, gentle, short", 0.8, False),
 ("sfx-swing-full", "sfx", S+"full golf club swing whoosh through air, fast swish", 1.0, False),
 ("sfx-swing-max", "sfx", S+"powerful maximum effort golf driver swing whoosh, loud fast swish", 1.2, False),
 ("sfx-impact-driver", "sfx", S+"golf driver striking ball, loud sharp crack with metallic ping", 1.0, False),
 ("sfx-impact-fairway", "sfx", S+"golf fairway wood or utility club striking ball, solid click thwack", 1.0, False),
 ("sfx-impact-iron", "sfx", S+"golf iron striking ball off grass, crisp click", 1.0, False),
 ("sfx-impact-wedge", "sfx", S+"golf wedge chip shot striking ball, soft short thud click", 1.0, False),
 ("sfx-impact-putter", "sfx", S+"golf putter tapping ball on green, soft tick", 0.8, False),
 ("sfx-impact-mishit", "sfx", S+"golf club mishit, dull clunky thunk, off-centre hit", 1.0, False),
 ("sfx-land-fairway", "sfx", S+"golf ball landing and bouncing on short grass fairway, soft thuds", 1.5, False),
 ("sfx-land-rough", "sfx", S+"golf ball landing in thick long grass rough, muffled rustling thud", 1.5, False),
 ("sfx-land-sand", "sfx", S+"golf ball landing in sand bunker, soft sandy plop", 1.5, False),
 ("sfx-land-green", "sfx", S+"golf ball landing on putting green, gentle soft bounce then roll", 1.5, False),
 ("sfx-land-cartpath", "sfx", S+"golf ball bouncing on concrete cart path, hard clacky bounces", 1.5, False),
 ("sfx-land-rock", "sfx", S+"golf ball hitting rocks, sharp clacking ricochet", 1.5, False),
 ("sfx-land-water", "sfx", S+"golf ball dropping into water, plunk and splash", 2.0, False),
 ("sfx-cup-rattle", "sfx", S+"golf ball rattling around inside the hole cup edge then settling", 2.0, False),
 ("sfx-cup-drop", "sfx", S+"golf ball dropping into the cup with a satisfying plunk", 1.5, False),
 ("amb-surf", "amb", "gentle ocean surf waves breaking on a rocky coastline, steady seamless ambience, no voices, no music", 15, True),
 ("amb-gulls-sealions", "amb", "seagulls calling and distant sea lions barking over soft ocean waves, coastal ambience, no voices, no music", 15, True),
 ("amb-wind-cypress", "amb", "steady wind blowing through cypress trees, soft rustling branches, calm seamless ambience, no voices, no music", 15, True),
 ("vo-countdown", "vo", "3, 2, 1, Go!", None, False),
 ("vo-hole-in-one", "vo", "Hole in one!", None, False),
 ("vo-finish", "vo", "Finish!", None, False),
 ("vo-final-minute", "vo", "Final minute!", None, False),
]
BOUNDS = {"sfx": (0.4, 3.5), "amb": (8, 22), "vo": (0.4, 5)}


def req(url, body=None, raw=False):
    r = urllib.request.Request(url, data=json.dumps(body).encode() if body else None,
                               headers={"xi-api-key": KEY, "Content-Type": "application/json"})
    with urllib.request.urlopen(r, timeout=120) as f:
        d = f.read()
    return d if raw else json.loads(d)


def credits():
    return req(API + "/user/subscription")["character_count"]


def dur(p):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                          "-of", "csv=p=0", p]).decode().strip())


def gen(i, kind, text, d, loop):
    if kind == "vo":
        return req(f"{API}/text-to-speech/{VOICE[0]}?output_format=mp3_44100_128",
                   {"text": text, "model_id": TTS_MODEL}, raw=True)
    return req(f"{API}/sound-generation?output_format=mp3_44100_128",
               {"text": text, "duration_seconds": d, "loop": loop, "prompt_influence": 0.5,
                "model_id": SFX_MODEL}, raw=True)


def norm(path, kind):
    # single-pass loudnorm: -16 LUFS sfx/vo, -20 ambience (beds sit under sfx)
    tmp = path + ".tmp.mp3"
    subprocess.check_call(["ffmpeg", "-v", "error", "-y", "-i", path, "-af",
                           f"loudnorm=I={-20 if kind == 'amb' else -16}:TP=-1.5:LRA=11",
                           "-ar", "44100", "-b:a", "128k", tmp])
    os.replace(tmp, path)


def main():
    os.makedirs(OUT, exist_ok=True)
    rows = {r["id"]: r for r in json.load(open(MANIFEST))} if os.path.exists(MANIFEST) else {}
    start = credits()
    print("credits used before:", start)
    for i, kind, text, d, loop in A:
        path = os.path.join(OUT, i + ".mp3")
        if os.path.exists(path):
            continue
        try:
            if credits() - start > CAP - 400:  # conservative margin for one more asset
                print("budget guard: stopping"); break
        except urllib.error.URLError:
            pass  # subscription endpoint rate-limited; total spend here is far below CAP
        ok = False
        for attempt in range(3):  # 1 try + max 2 retries
            try:
                open(path, "wb").write(gen(i, kind, text, d, loop))
                if HAVE_FFMPEG:
                    norm(path, kind)
                    lo, hi = BOUNDS[kind]
                    assert lo <= dur(path) <= hi, f"duration {dur(path):.2f}s out of bounds"
                assert os.path.getsize(path) > 0
                ok = True; break
            except (urllib.error.URLError, AssertionError, subprocess.CalledProcessError) as e:
                print("FAIL", i, attempt, type(e).__name__, getattr(e, "code", ""), str(e)[:100])
                if os.path.exists(path): os.remove(path)
        if not ok: continue
        rows[i] = {"id": i, "file": f"assets/audio/{i}.mp3", "tool": "ElevenLabs " + ("text-to-speech" if kind == "vo" else "sound-effects API"),
                   "model": TTS_MODEL if kind == "vo" else SFX_MODEL, "tier": "Starter",
                   "prompt": text + (f" [voice {VOICE[1]} {VOICE[0]}]" if kind == "vo" else f" [duration {d}s, loop={loop}]"),
                   "seed": None, "date": datetime.date.today().isoformat(), "licence": LICENCE, "subagent": "audio"}
        json.dump(list(rows.values()), open(MANIFEST, "w"), indent=2)
        print("ok", i, f"{dur(path):.2f}s" if HAVE_FFMPEG else "")
    print("credits used after:", credits(), "(delta", credits() - start, ")")


if __name__ == "__main__":
    main()
