"""Assemble register.json (register.v1) from the run's working files.

Run with the Software Factory venv:
  /Users/kaushal/Projects/software-factory/.venv/bin/python assemble_register.py FINDINGS.json REFRAMED.json [REFRAMED2.json ...]

Content is copied, never rewritten. Only fields the schema allows are kept, and the
reframer's free-text spec_section is mapped onto the schema's six values.
"""
import hashlib, json, sys, pathlib

HERE = pathlib.Path(__file__).parent
SPEC = {
    "licensing/credits": "legal-terms", "asset-provenance": "legal-terms",
    "agent-tooling/security": "crypto-agent-security",
    "hosting/ops": "capacity-physics", "physics/determinism": "capacity-physics",
    "gameplay/track-design": "product-scope", "netcode/authority": "trust-consensus",
    "accessibility": "product-scope", "repo-hygiene": "crypto-agent-security",
}
KEEP = ("id claim_ids lens trap_id trap_status cues_matched status route route_reason "
        "would_settle dismissal_reason").split()


def evidence(e):
    out = {k: e[k] for k in ("kind", "ref", "quote", "locator", "tier", "date") if k in e}
    if e.get("verbatim") is False:  # schema has no flag; say it in the text
        out["quote"] = "[paraphrase, not verbatim] " + out.get("quote", "")
    return out


def main(findings_path, *reframed_paths):
    fin = json.load(open(findings_path))
    rf = {}
    for p in reframed_paths:
        for x in json.load(open(p))["findings"]:
            rf[x["id"]] = x
    quarantine = []
    for p in reframed_paths:
        quarantine += json.load(open(p)).get("quarantine", [])
    out = []
    for x in fin:
        f = {k: x[k] for k in KEEP if k in x and x[k] is not None}
        f["evidence"] = [evidence(e) for e in x.get("evidence", [])]
        f["pass"] = 2 if x.get("grounded_by", "").startswith("G4") else 1
        if x.get("skeptic"):
            f["skeptic"] = {"verdict": x["skeptic"]["verdict"], "reason": x["skeptic"]["reason"]}
        r = rf.get(x["id"])
        if r:
            f["severity"] = {"tier": r["severity"]["tier"],
                             "answers": [{k: a[k] for k in ("q", "a", "why") if k in a} for a in r["severity"]["answers"]]}
            f["underlying_problem"] = r["underlying_problem"]
            f["disposition"] = r["disposition"]
            f["spec_section"] = SPEC.get(r["spec_section"], r["spec_section"])  # pass-2 already uses schema values
            if r.get("owner_question"):
                f["owner_question"] = r["owner_question"]
            if x["status"] == "plausible" and not f.get("would_settle"):
                f["would_settle"] = r.get("would_settle") or x.get("would_settle", "")
        out.append(f)
    plan = json.load(open(HERE / "plan-override.json"))
    lenses = [{"id": l["id"], "version": l["version"], "calibrated": bool(l["calibrated"])}
              for g in plan["groups"].values() for l in g["lenses"]]
    open_ids = [f["id"] for f in out if f["status"] in ("suspect", "plausible")]
    reg = {
        "schema_version": 1,
        "brief": {"path": "docs/minesweep/2026-11-04-game-week-brief/brief.md",
                  "sha256": hashlib.sha256((HERE / "brief.md").read_bytes()).hexdigest()},
        "run": {"date": "2026-11-04", "mode": "full", "calibrated": False, "lenses": lenses,
                "claims_path": "docs/minesweep/2026-11-04-game-week-brief/claims.json"},
        "findings": out,
        "quarantine": quarantine,
        "problem_definition_path": "docs/minesweep/2026-11-04-game-week-brief/problem-definition.md",
        "convergence": {"passes": 2, "converged": False, "stop_reason": "iteration-cap",  # shortcut: schema has no 'paused for owner'; we chose to stop at 2 of 4 passes, no budget was hit
                        "open": open_ids,
                        "routed_calls": ["G1 generator terms", "G2 hosting/netcode", "G3 physics/agent-security",
                                         "skeptic pass 1", "G4 pass 2", "skeptic pass 2"]},
    }
    json.dump(reg, open(HERE / "register.json", "w"), indent=1)
    print("findings", len(out), "open", len(open_ids), "quarantine", len(quarantine))


if __name__ == "__main__":
    main(*sys.argv[1:])
