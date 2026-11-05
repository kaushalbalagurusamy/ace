#!/usr/bin/env python3
"""Builds docs/dashboard/index.html (+ data.json) from committed sources. Read-only page, no secrets, no prompts.
Every figure is {measured: true, value, source} or {measured: false, reason}; a missing value never renders as 0.
  npm run dashboard      # runs vitest to JSON first, then this script"""
import html, json, os, re, subprocess, datetime, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
D = ROOT / "docs/dashboard"
def meas(value, source): return {"measured": True, "value": value, "source": source}
def unmeas(reason): return {"measured": False, "reason": reason}
def sh(*a):
    try: return subprocess.run(a, cwd=ROOT, capture_output=True, text=True, timeout=30).stdout.strip()
    except Exception: return ""

def parse_ledger(text):
    """Rows of every markdown table whose header has a Status column. Returns [{id, status, check, trust, note}]."""
    rows, header = [], None
    for line in text.splitlines():
        if not line.startswith("|"): header = None; continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if "Status" in cells: header = cells; continue
        if header is None or set("".join(cells)) <= set("-: "): continue
        if len(cells) != len(header): continue
        r = dict(zip(header, cells)); status = re.sub(r"[`*]", "", r["Status"]).split(" ")[0].lower().strip("(),;")
        rows.append({"id": r.get("ID", "?"), "status": status, "check": re.sub(r"[`*]", "", r.get("Check", "")).split(" ")[0] or None,
                     "trust": r.get("Trust"), "note": r.get("Artifact or what it waits on") or r.get("Requirement (verbatim gist)") or r.get("Criterion (short)") or ""})
    return rows

def tests(vjson):
    if not vjson.exists(): return unmeas("no docs/dashboard/vitest.json: run `npm run dashboard`")
    d = json.loads(vjson.read_text()); files = []
    for f in d.get("testResults", []):
        a = f.get("assertionResults", []); files.append({"file": os.path.relpath(f["name"], ROOT), "passed": sum(1 for x in a if x["status"] == "passed"), "failed": sum(1 for x in a if x["status"] == "failed"), "total": len(a)})
    return meas({"files": files, "passed": d["numPassedTests"], "failed": d["numFailedTests"], "total": d["numTotalTests"], "start_ms": d.get("startTime")}, "vitest --reporter=json")

def build():
    ledger_path = ROOT / "docs/requirements-ledger.md"
    ledger = parse_ledger(ledger_path.read_text()) if ledger_path.exists() else []
    counts = {}
    for r in ledger: counts[r["status"]] = counts.get(r["status"], 0) + 1
    manifest = json.loads((ROOT / "assets/manifest.json").read_text()) if (ROOT / "assets/manifest.json").exists() else []
    meshy = [r for r in manifest if "Meshy" in r.get("tool", "")]; imgs = [r for r in manifest if r.get("tool") == "OpenAI images"]; audio = [r for r in manifest if "ElevenLabs" in r.get("tool", "")]
    events = []
    ev = ROOT / "ops/events.jsonl"
    if ev.exists():
        for l in ev.read_text().splitlines()[-30:]:
            try: events.append(json.loads(l))
            except Exception: pass
    results = []
    for p in sorted((D / "results").glob("*.json")): results.append({"file": p.name, **json.loads(p.read_text())})
    reviews = json.loads((D / "reviews.json").read_text()) if (D / "reviews.json").exists() else []
    sha = sh("git", "rev-parse", "HEAD"); when = sh("git", "log", "-1", "--format=%cI")
    t = tests(D / "vitest.json")
    data = {
        "generated": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
        "commit": {"sha": sha, "short": sha[:7], "date": when, "branch": sh("git", "rev-parse", "--abbrev-ref", "HEAD"), "commits": int(sh("git", "rev-list", "--count", "HEAD") or 0)},
        "tests": t, "ledger": ledger, "ledger_counts": counts, "reviews": reviews, "results": results, "events": events,
        "inventory": {"test_files": len(list((ROOT / "tests").glob("*.test.ts"))), "adrs": len(list((ROOT / "docs/decisions").glob("*.md"))), "slices": sorted(p.name for p in (ROOT / "docs/slices").glob("*") if p.is_dir()), "scripts": len(list((ROOT / "scripts").glob("*"))), "manifest_rows": len(manifest)},
        "cost": {
            "meshy_credits_used": meas(sum(r.get("credits_used", 0) for r in meshy), "assets/manifest.json credits_used (read from the Meshy API)") if meshy else unmeas("no Meshy rows"),
            "openai_images": meas(len(imgs), "assets/manifest.json; cap 40") if imgs else unmeas("no image rows"),
            "elevenlabs_audio_files": meas(len(audio), "assets/manifest.json; about 688 credits used (agent report)") if audio else unmeas("no audio rows"),
            "hosting": unmeas("Render plan upgraded by the owner; price not recorded here"), "model_spend_at_runtime": unmeas("not applicable: the product calls no model while running")},
        "latency": unmeas("not live: the load test (12 racers, 3 lobbies, 40 idle sockets, p95 shot resolution and server memory) has not been run; scripts/ws-holeout-bot.mjs measures one player only"),
        "logs": unmeas("not live: server logs are not collected or parsed; Render logs are only available on the platform"),
        "traces": unmeas("not applicable: the product calls no model; no Langfuse traces exist or are expected"),
    }
    (D / "data.json").write_text(json.dumps(data, indent=2))
    (D / "index.html").write_text(render(data))
    return data

COL = {"satisfied": "#2e9e5b", "partial": "#d9a21b", "blocked": "#c0572b", "unserved": "#c03a3a", "n/a": "#6b7280"}
def chip(s): return f'<span class="chip" style="background:{COL.get(s, "#6b7280")}">{html.escape(s)}</span>'
def fig(m, fmt=lambda v: v):
    return f'<b>{html.escape(str(fmt(m["value"])))}</b> <small>{html.escape(m["source"])}</small>' if m.get("measured") else f'<span class="nl">not live</span> <small>{html.escape(m["reason"])}</small>'

def render(d):
    t = d["tests"]; stale = ""
    tests_html = fig(t, lambda v: f'{v["passed"]}/{v["total"]} passed, {v["failed"]} failed') if t["measured"] else fig(t)
    rows = "".join(f'<tr><td>{html.escape(r["id"])}</td><td>{chip(r["status"])}</td><td>{html.escape(r["check"] or "—")}</td><td class="note">{html.escape(r["note"][:170])}</td></tr>' for r in d["ledger"])
    files = "".join(f'<tr><td>{html.escape(f["file"])}</td><td class="{"ok" if f["failed"] == 0 else "bad"}">{f["passed"]}/{f["total"]}</td></tr>' for f in (t["value"]["files"] if t["measured"] else []))
    counts = " ".join(f'{chip(k)} {v}' for k, v in sorted(d["ledger_counts"].items()))
    rev = "".join(f'<div class="card"><b>{html.escape(r["id"])}</b> {html.escape(r["scope"])}<br><small>{html.escape(json.dumps(r["findings"]))}</small><ul>' + "".join(f'<li class="ok">fixed: {html.escape(x)}</li>' for x in r["fixed"]) + "".join(f'<li>accepted: {html.escape(x)}</li>' for x in r["accepted"]) + "".join(f'<li class="bad">open: {html.escape(x)}</li>' for x in r["open"]) + f'</ul><p><b>Third state:</b> {html.escape(r["third_state"])}</p></div>' for r in d["reviews"])
    res = "".join(f'<tr><td>{html.escape(r["file"])}</td><td>{html.escape(str(r.get("summary", r)))[:200]}</td></tr>' for r in d["results"]) or '<tr><td colspan=2><span class="nl">none recorded</span></td></tr>'
    ev = "".join(f'<tr><td>{html.escape(str(e.get("at", "")))}</td><td>{html.escape(str(e.get("stage", "")))}</td><td>{html.escape(str(e.get("slice", "")))}</td><td>{html.escape(str(e.get("verdict", "")))}</td></tr>' for e in d["events"][-12:]) or '<tr><td colspan=4><span class="nl">no stage events</span></td></tr>'
    c = d["cost"]
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Ace ops dashboard</title><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{{font:14px system-ui;background:#14181c;color:#dde3ea;margin:0;padding:24px;max-width:1100px;margin:auto}}h1{{margin:0 0 4px}}h2{{margin:28px 0 8px;font-size:16px;border-bottom:1px solid #2b333b;padding-bottom:4px}}table{{border-collapse:collapse;width:100%}}td,th{{border-bottom:1px solid #232a31;padding:4px 8px;text-align:left;vertical-align:top}}small{{color:#8b97a3}}.chip{{color:#fff;border-radius:10px;padding:1px 8px;font-size:12px}}.nl{{color:#d9a21b;font-weight:600}}.ok{{color:#59c68a}}.bad{{color:#ef6a6a}}.note{{color:#9aa6b2;font-size:12px}}.card{{background:#1b2127;border:1px solid #2b333b;border-radius:6px;padding:8px 12px;margin:8px 0}}ul{{margin:4px 0}}</style></head><body>
<h1>Ace: ops dashboard</h1><small>Generated {html.escape(d["generated"])} from commit {d["commit"]["short"]} ({html.escape(d["commit"]["branch"])}, {d["commit"]["commits"]} commits). Read-only. Figures are measured or marked not live.</small>
<h2>Test run record</h2><p>{tests_html}<br><small>command: npm run dashboard (vitest run --reporter=json) · commit {d["commit"]["short"]} · {html.escape(d["commit"]["date"])} · label this stale if older than 24 h</small></p>
<table>{files}</table>
<h2>Drift: requirements ledger against the verbatim source</h2><p>{counts}</p><table><tr><th>ID</th><th>Status</th><th>Check</th><th>Artifact or what it waits on</th></tr>{rows}</table>
<h2>Third state and reviews</h2>{rev}
<h2>Latency and volume</h2><p>{fig(d["latency"])}</p>
<h2>Runs recorded (bot, wire and browser checks)</h2><table>{res}</table>
<h2>Cost</h2><table><tr><td>Meshy credits used</td><td>{fig(c["meshy_credits_used"])}</td></tr><tr><td>OpenAI images (cap 40)</td><td>{fig(c["openai_images"])}</td></tr><tr><td>ElevenLabs audio files</td><td>{fig(c["elevenlabs_audio_files"])}</td></tr><tr><td>Hosting</td><td>{fig(c["hosting"])}</td></tr><tr><td>Model spend at runtime</td><td>{fig(c["model_spend_at_runtime"])}</td></tr></table>
<h2>Logs and errors</h2><p>{fig(d["logs"])}</p><h2>Traces</h2><p>{fig(d["traces"])}</p>
<h2>Platform inventory</h2><p>{d["inventory"]["test_files"]} test files · {d["inventory"]["adrs"]} ADRs · slices: {html.escape(", ".join(d["inventory"]["slices"]))} · {d["inventory"]["scripts"]} scripts · {d["inventory"]["manifest_rows"]} manifest rows</p>
<h2>Dev journey (ops/events.jsonl)</h2><table>{ev}</table></body></html>"""

if __name__ == "__main__": build(); print("wrote docs/dashboard/index.html")
