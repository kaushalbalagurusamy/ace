# Build-loop profile — gauntlet-game-week

Read by the `sf` skill. Project-specific paths and commands only; the loop itself is in the skill.
Written 2026-11-04 (Wednesday), before any research or code. Paths marked **TBD** are deliberately
unset until the named stage decides them; do not guess them.

## What this project is

Gauntlet Game Week. Build a browser game from one of three genres (exploration/adventure, platformer,
multiplayer racing) with **all assets generated** (visual and audio, no premade assets).

- **Due:** the brief says Thursday 2026-11-05 at midnight; the owner confirmed **CST**. On 2026-11-05 the
  owner also said the practical cutoff is **before judging, which starts after 08:00 CST Friday
  2026-11-06**. Playing and judging Friday morning; winners around Friday lunch.
- **Direction (owner decision, 2026-11-05):** *Final Frontier* (space racer) is **scrapped**. The game is a
  **multiplayer browser golf race** (brief Option 3): up to 4 players per lobby race through 18 holes,
  first to hole out on 18 wins. First map: Pebble Beach Golf Links. The spec is `PRD/` (README first);
  owner decisions Q1–Q11 are recorded in `PRD/README.md`. Engine: Three.js `three@0.186.1` client, Node
  `ws` authoritative server. The space-racer minesweep under `docs/minesweep/` is history; only its asset,
  licensing, hosting and key findings carry over (listed in `PRD/README.md`).
- **Remote:** `labs.gauntletai.com`, repo `gauntlet-game-week`, public, empty (as the operator reports).
  The namespace and push access are **unverified** (the host needs a login); no remote has been added.
- **Ceiling the operator set:** the deadline above. The loop is not a variable: schedule pressure may
  slice work smaller or reorder it, never drop a stage. If the plan and the deadline conflict, state the
  conflict and let the owner choose what moves.

| Stage input | Location |
|---|---|
| **Requirements ledger** (the run's termination condition) | `docs/requirements-ledger.md` — one row per line of the brief, with `trust` (`trusted`, `conditioned (F-id)`, `rejected (F-id)`), status, and the artifact that satisfies it or what it waits on. Built line by line from `docs/source/brief.md`, never from a summary. Does not exist yet; building it is the first slice after the sweep |
| **Verbatim source requirements** | `docs/source/brief.md` — byte-for-byte copy of `W8/game-week/brief.md` on branch `w8-game-week-brief` @ `bb9772a` (hashes in `docs/source/SHA256SUMS`, provenance in `docs/source/PROVENANCE.md`). Every line of prose is a requirement, including the schedule table. The operator's chat message about Final Frontier is a *proposal*, recorded in the backlog, not a requirement line |
| **Course corpus, seeding stage 1** | `docs/source/lecture-2026-11-02-game-assets.md` (Matt Hulme, 2026-11-02) and `~/Projects/gauntlet/lectures/` for the rest. Read before any external search. A floor to exceed: name which lecture slide each seeded claim came from. **Caution:** the lecture teaches three asset routes (AI generation, made with code, asset libraries); the brief bans premade assets, so the library route is outside the floor (see the sweep) |
| Secondary input (not a source of truth) | `docs/source/research-README.md` — an agent's overnight tool research, with its own "could not verify" list. Treated as leads, graded below the brief and the lecture; its claims are re-grounded before use |
| Minesweep runs | `docs/minesweep/<date>-<slug>/` (claims, sweeps, register, problem-definition) |
| Research briefs | `docs/research/` |
| Experiments (script + committed JSON result beside it) | `experiments/` — candidate lists come from a dated enumeration committed beside the script, never from recall |
| Decision records | `docs/decisions/` (ADR-0001 onward) |
| Tracer-bullet specs and slices | `docs/specs/`, `docs/slices/<id>/` |
| Evaluation cases and tests | `evals/`, `tests/` |
| Test command | **TBD at stage 3** (depends on the engine/stack ADR). Python helper scripts use `/Users/kaushal/Projects/software-factory/.venv/bin/python` |
| Asset provenance manifest | `assets/MANIFEST.md` (or `.json`): one row per shipped asset — generator/tool, prompt or code path, date, plan tier and licence at time of use, reviewer verdict. **No asset ships without a row.** This is the evidence for the "generate all assets" line |
| Reviewer | a fresh adversarial subagent (`implementation-review`), told to be skeptical and not agreeable; point it at any place the same author wrote both the code and the logic deciding a gate, and at the asset manifest |
| **Inbound sources, stage 12** — read at the END of every slice | `docs/backlog.md` (ranked ideas, including the operator's freeform ones) · `git -C ~/Projects/gauntlet fetch origin w8-game-week-brief` then diff `W8/game-week/` against the hashes in `docs/source/SHA256SUMS` (the brief can change) · `~/Projects/gauntlet/lectures/` for new lectures · the ledger's own `unserved` and newly-unblocked `blocked` rows. **Rank what you find; do not context-switch into it.** Say so explicitly when nothing arrived |
| Documents downstream of a decision (stage 10, `doc-sync`) | `README.md` (play instructions: a new player must start without the author present) · `ARCHITECTURE.md` · `docs/requirements-ledger.md` · `assets/MANIFEST.md` · the in-game credits/instructions screen · the `Status:` line of every spec · the dashboard rows |
| Deploy target | **TBD at stage 3** (browser-playable public link is a brief requirement; multiplayer needs a realtime server, which constrains hosting) |

## Project-specific invariants

- **The brief's bar is a gate, not polish.** "Graphics that look thrown together, use mismatched styles, or
  are generally poor quality will fail the assignment." Visual cohesion is therefore a required acceptance
  criterion with its own eval, not a finishing touch.
- **Generate all assets; no premade assets.** Every shipped visual and audio asset is AI-generated or
  code-generated by us and recorded in the manifest. Anything pulled from a library (Kenney, Poly Haven,
  Freesound, Mixamo, etc.) is excluded. Third-party *code* libraries (engine, netcode) are not assets, but
  fonts, textures and sound samples inside them are. Whether a free-tier generator's licence permits a
  public, judged game is a finding to settle (provider terms), not an assumption.
- **A smaller finished game beats a larger unfinished one** (the brief says so). Cut scope before cutting
  stages.
- **Multiplayer must work reliably enough to finish a race together**, with a clear way to join. Hosting is
  chosen on evidence, with the multiplayer failure modes (latency, disconnect, cold start, desync) named
  in the spec. Ball physics runs only on the server and clients replay the trajectory it sends
  (`PRD/03` §3), so cross-client determinism is avoided by design.
- **Playable by someone else**: a cold-start run by a person who is not the author is the final check
  (stage 7/8), not the author's own session.
- A zero must mean a measurement, never a failed lookup.
- Engineering requirements are day-one habits: typed message contracts for client/server, explicit error
  schemas, tests built from boundaries and invariants, decision records before commitments.
- **A decision is not landed until the documents that assert otherwise have been fixed or annotated**
  (stage 10).

## Hygiene

Limits for `~/.claude/skills/sf/hygiene/hygiene.sh`: run `scan` before fanning out more than 2 agents.
Worktree agents share one build directory. Generated-asset batches (images, audio) are large: keep
originals out of git unless they ship, and register any dev server or browser with `hygiene.sh register`.

## Run configuration

- Sonnet-only routing for this run (per `/sf`). The minesweeper config names Opus for several sweep
  groups and the skeptic; for this run those are executed on Sonnet and the deviation is recorded in the
  register rather than escalating on our own.
- Away mode: started by `/sf` on 2026-11-04 at 17:03, indefinite (keep-awake tied to the session). Docker was not running at start (warn). The user should run `/remote-control` and keep the lid open. Overnight mode: no open run.
- `sf install install --project .` has **not** been run (it generates hooks and agents; not authorised
  for this task yet). Until it is, the hook-based guards are absent and the loop is procedural.
