"""Build docs/artifact/index.html: three tabs (Minesweeping, Lecture guidance, Research seeds).

  /Users/kaushal/Projects/software-factory/.venv/bin/python docs/artifact/build.py

Tab 1 is generated from the validated register so it cannot drift from it; tabs 2 and 3 are the
hand-written fragments beside this file.
"""
import html, json, pathlib, collections

HERE = pathlib.Path(__file__).parent
RUN = HERE.parent / "minesweep" / "2026-11-04-game-week-brief"
e = html.escape

reg = json.load(open(RUN / "register.json"))
titles = {}
for p in ("findings-final.json", "findings-final2.json"):
    if (RUN / p).exists():
        for x in json.load(open(RUN / p)):
            titles[x["id"]] = x
rf = {}
for p in sorted(RUN.glob("reframed*.json")):
    for x in json.load(open(p))["findings"]:
        rf[x["id"]] = x
F = reg["findings"]
by_status = collections.Counter(f["status"] for f in F)
by_tier = collections.Counter(f.get("severity", {}).get("tier") for f in F if f.get("severity"))
claims = json.load(open(RUN / "claims.json"))["claims"]
origins = collections.Counter(c["origin"] for c in claims)
TIERS = ["critical", "high", "medium", "low"]
STAT_LABEL = {"confirmed": "Confirmed", "plausible": "Plausible", "dismissed": "Dismissed", "suspect": "Not yet grounded"}
SPEC_LABEL = {"legal-terms": "Terms and licences", "crypto-agent-security": "Agent tooling and security",
              "capacity-physics": "Physics, hosting and capacity", "product-scope": "Product scope and access",
              "trust-consensus": "Netcode authority", "verification-calibration": "Verification"}


def pill(kind, text):
    return f'<span class="pill p-{e(kind)}">{e(text)}</span>'


def finding_row(f):
    t = titles.get(f["id"], {})
    r = rf.get(f["id"], {})
    sev = f.get("severity", {}).get("tier")
    claim_txt = (t.get("supported_claim") or t.get("statement") or "")
    head = (f'<summary><span class="fid">{e(f["id"])}</span>'
            f'<span class="ftitle">{e(t.get("title", f["id"]))}</span>'
            f'<span class="fpills">{pill(sev, sev) if sev else ""}{pill(f["status"], STAT_LABEL[f["status"]])}'
            f'{pill("ask", "ask owner") if f.get("disposition") == "ask-owner" else ""}</span></summary>')
    body = []
    if r.get("build_consequence"):
        body.append(f'<p class="consq"><b>What we do differently:</b> {e(r["build_consequence"])}</p>')
    if f.get("underlying_problem"):
        body.append(f'<p><b>Underlying problem:</b> {e(f["underlying_problem"])}</p>')
    if claim_txt:
        body.append(f'<p><b>{"Narrowed claim the evidence supports" if t.get("supported_claim") else "Concern"}:</b> {e(claim_txt)}</p>')
    if f.get("owner_question"):
        body.append(f'<p class="oq"><b>Question for the owner:</b> {e(f["owner_question"])}</p>')
    if f.get("skeptic"):
        body.append(f'<p><b>Skeptic ({e(f["skeptic"]["verdict"])}):</b> {e(f["skeptic"]["reason"])}</p>')
    if f.get("would_settle"):
        body.append(f'<p><b>Would settle it:</b> {e(f["would_settle"])}</p>')
    if f.get("dismissal_reason"):
        body.append(f'<p><b>Why dismissed:</b> {e(f["dismissal_reason"])}</p>')
    if f.get("evidence"):
        items = []
        for ev in f["evidence"]:
            q = ev.get("quote", "")
            q = q if len(q) < 360 else q[:357] + "..."
            ref = ev["ref"]
            link = f'<a href="{e(ref)}" rel="noopener">{e(ref)}</a>' if ref.startswith("http") else e(ref)
            items.append(f'<li><span class="tag">{e(ev.get("tier") or ev["kind"])}</span> {link}<br><q>{e(q)}</q></li>')
        body.append(f'<details class="ev"><summary>{len(items)} evidence item{"s" if len(items) != 1 else ""}</summary><ul>{"".join(items)}</ul></details>')
    body.append(f'<p class="meta">{len(f["claim_ids"])} claim{"s" if len(f["claim_ids"]) != 1 else ""} · lens {e(f["lens"])} · route {e(f["route"])}</p>')
    cls = f'frow s-{f["status"]} t-{sev or "none"}'
    return (f'<details class="{cls}" data-status="{f["status"]}" data-tier="{sev or "none"}" '
            f'data-ask="{1 if f.get("disposition") == "ask-owner" else 0}">{head}<div class="fbody">{"".join(body)}</div></details>')


rated = [f for f in F if f["status"] in ("confirmed", "plausible")]
rated.sort(key=lambda f: (TIERS.index(f["severity"]["tier"]), 0 if f["status"] == "confirmed" else 1, f["id"]))
dismissed = [f for f in F if f["status"] == "dismissed"]
ungrounded = [f for f in F if f["status"] == "suspect"]
asks = [f for f in F if f.get("disposition") == "ask-owner"]

ungr_by_lens = collections.defaultdict(list)
for f in ungrounded:
    ungr_by_lens[f["lens"]].append(f)
ungr_html = "".join(
    f'<details class="lead"><summary>{e(lens)} <span class="count">{len(fs)}</span></summary><ul>'
    + "".join(f'<li><span class="fid">{e(f["id"])}</span> {e(titles.get(f["id"], {}).get("title", ""))} '
              f'<span class="meta">route {e(f["route"])}</span>'
              + (f'<br><span class="meta">Would settle: {e(f["would_settle"])}</span>' if f.get("would_settle") else "") + "</li>" for f in fs)
    + "</ul></details>" for lens, fs in sorted(ungr_by_lens.items()))

quar_html = "".join(
    f'<li><b>{e(q["locator"])}</b><br><q>{e(q["text"])}</q><br><span class="meta">{", ".join(e(i) for i in q["finding_ids"])}</span> · {e(q["reason"])}'
    + (f'<br><b>Replaced by:</b> {e(q["replacement"])}' if q.get("replacement") else "") + "</li>" for q in reg["quarantine"])

ask_html = "".join(f'<li><span class="fid">{e(f["id"])}</span> {e(f["owner_question"])}</li>' for f in asks)

pd = (RUN / "problem-definition.md").read_text().split("## 2. Reframed problem for Final Frontier")[1].split("## 3.")[0].strip()
problem = e(pd)

tab1 = f'''<section id="panel-minesweep" class="tabpanel" role="tabpanel" aria-labelledby="t-minesweep" hidden>
  <header class="panelhead">
    <h2>Minesweeping</h2>
    <p class="lede">Before building, the brief, your Final Frontier proposal and the supporting notes were treated as claims and swept for traps: licences, provider terms, multiplayer physics, hosting, the judging rubric and agent tooling. This is pass {reg["convergence"]["passes"]} of up to 4, <b>uncalibrated</b>: none of the {len(reg["run"]["lenses"])} lenses has passed its own evaluation, so every finding is a lead, not a verdict.</p>
  </header>

  <div class="stats" role="list">
    <div class="stat" role="listitem"><b>{len(claims)}</b><span>claims extracted</span></div>
    <div class="stat" role="listitem"><b>{len(reg["run"]["lenses"])}</b><span>lenses applied</span></div>
    <div class="stat" role="listitem"><b>386</b><span>suspects raised</span></div>
    <div class="stat" role="listitem"><b>{len(F)}</b><span>findings after merging</span></div>
    <div class="stat" role="listitem"><b>{by_status["confirmed"]}</b><span>confirmed</span></div>
    <div class="stat" role="listitem"><b>{by_status["plausible"]}</b><span>plausible</span></div>
    <div class="stat" role="listitem"><b>{by_status["suspect"]}</b><span>not yet grounded</span></div>
  </div>
  <p class="note">Severity so far: {by_tier.get("critical", 0)} critical, {by_tier.get("high", 0)} high, {by_tier.get("medium", 0)} medium, {by_tier.get("low", 0)} low. That reflects a free class project and unproven readings; it is not a clean bill, and the {by_status["suspect"]} ungrounded findings are unrated.</p>

  <h3 class="sub">The problem, reframed</h3>
  <p class="reframed">{problem}</p>
  <p class="note">The design choices in it (server-authoritative physics, WebSocket only, the strict reading of the asset rule) are consequences the evidence points to, not decisions. They become decisions in ADRs.</p>

  <h3 class="sub">Questions only you or the organisers can answer</h3>
  <ol class="asks">{ask_html}
    <li><span class="fid">F-022 / F-050</span> The brief says <q>Thursday @ Midnight</q> with no timezone and no late rule. Which timezone, and is a late submission refused? (Found by the sweep but not yet grounded.)</li>
  </ol>

  <h3 class="sub">Findings</h3>
  <div class="filters" role="group" aria-label="Filter findings">
    <button type="button" class="chip on" data-f="all">All ({len(rated)})</button>
    <button type="button" class="chip" data-f="confirmed">Confirmed ({by_status["confirmed"]})</button>
    <button type="button" class="chip" data-f="plausible">Plausible ({by_status["plausible"]})</button>
    <button type="button" class="chip" data-f="medium">Medium</button>
    <button type="button" class="chip" data-f="ask">Ask owner</button>
  </div>
  <div id="flist">{"".join(finding_row(f) for f in rated)}</div>

  <h3 class="sub">Dismissed ({len(dismissed)})</h3>
  <div>{"".join(finding_row(f) for f in dismissed)}</div>

  <h3 class="sub">Lines that will not be followed as written</h3>
  <ul class="quar">{quar_html}</ul>

  <h3 class="sub">Not yet grounded ({len(ungrounded)})</h3>
  <p class="note">Raised by the sweep, merged, not yet researched or rated. They cover netcode authority and failure modes, capacity, privacy, the peer-judged rubric, the asset critic and the schedule. Each says what would settle it.</p>
  <div>{ungr_html}</div>

  <h3 class="sub">How this was made</h3>
  <ul class="how">
    <li>Sources saved verbatim with SHA-256 hashes (<code>docs/source/</code>). Claims by origin: brief {origins["brief"]}, your proposal {origins["proposal"]}, research README {origins["research-README"]}, lecture {origins["lecture"]}, gaps the lenses expected the brief to state {origins["omission"]}.</li>
    <li>The skill's keyword planner picked the wrong lenses (it matched “phi” in “physics”, “oom” in “room” and “install” in “not need to install”, and skipped provider terms, copyright and distributed systems). It was replaced by a hand-picked set of {len(reg["run"]["lenses"])} lenses with a reason for each; four lenses were left out as not engaged.</li>
    <li>Every agent ran on Sonnet, per the loop's routing rule, although the skill's config names Opus for some sweeps and the skeptic.</li>
    <li>The skeptic saw only claims and confirmed findings, and re-fetched sources itself. It upheld 7 and downgraded 11 of 18. Two vendor “quotes” turned out to be paraphrases and were relabelled. One local run (the n-body test) was reproduced by hand.</li>
    <li>The register records its stop as <code>iteration-cap</code> because the schema has no “paused for owner answers”; 2 of 4 passes were used and no budget was hit.</li>
  </ul>
</section>'''

css = (HERE / "style.css").read_text()
js = (HERE / "app.js").read_text()
page = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Final Frontier Research</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=Bricolage+Grotesque:wght@600;700&display=swap" rel="stylesheet">
<style>
{css}
</style>
</head>
<body>
<header class="top">
  <p class="eyebrow">Gauntlet Game Week · Option 3, multiplayer racing · due Thursday 5 November, midnight</p>
  <h1>Final Frontier: what the research says so far</h1>
  <nav class="tabs" role="tablist" aria-label="Sections">
    <button id="t-minesweep" role="tab" data-tab="minesweep" aria-controls="panel-minesweep">Minesweeping</button>
    <button id="t-lecture" role="tab" data-tab="lecture" aria-controls="panel-lecture">Lecture guidance</button>
    <button id="t-seeds" role="tab" data-tab="seeds" aria-controls="panel-seeds">Research seeds</button>
  </nav>
</header>
<main>
{tab1}
{(HERE / "tab-lecture.html").read_text()}
{(HERE / "tab-seeds.html").read_text()}
</main>
<footer><p>Built 4 November 2026 from <code>docs/minesweep/2026-11-04-game-week-brief/register.json</code> in the gauntlet-game-week project. Nothing here has been built yet; Final Frontier is still a proposal.</p></footer>
<script>
{js}
</script>
</body>
</html>'''
(HERE / "index.html").write_text(page)
print("wrote", HERE / "index.html", len(page), "bytes")
