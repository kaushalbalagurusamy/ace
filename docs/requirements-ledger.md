# Requirements ledger: Ace

Rebuilt line by line from `docs/source/brief.md` (verbatim, 172 lines) and every acceptance ID in `PRD/*.md`, **2026-11-05 about 14:30 CST**. Statuses: `satisfied` (artifact named), `partial` (what is missing named), `blocked` (what it waits on), `unserved` (nothing produces it yet), `n/a` (the brief line applies to an option we did not choose). Each row has **exactly one** check: `unit`, `e2e`, `load`, `manual` (playtest by a person) or `eval`. A row marked satisfied without a named artifact is a claim, not evidence. `trust` is `trusted` unless a finding conditions it.

## Summary (of the rows below)
Run `grep -c` on the status column for current counts; the headline gaps, highest value first:
1. **B-158 two distinct courses/layouts: partial, and the weakest row.** 18 holes exist (par 72 card) but every hole is a straight line with the same surfaces, so layouts do not differ. No producer for doglegs, water or hazards beyond OOB.
2. **B-20/B-41/B-48 visual and audio polish: unserved in the build.** Assets exist (25 audio, 6 models, golfer, 4 textures) but none is wired into the client; the live game is greyscale boxes.
3. **AC-L5 reload keeps the race: unserved.** A reload drops the player (review finding 4).
4. **AC-P1 sourced physics: blocked** on TrackMan/aero sources (PRD/03 §8). **AC-P5 solver: unserved.**
5. **B-167 reliability under load: partial**, load test not yet run.

## Brief lines (`docs/source/brief.md`)
| ID | Lines | Requirement (verbatim gist) | Trust | Status | Check | Artifact or what it waits on |
|---|---|---|---|---|---|---|
| B-01 | 1-5 | Choose one genre; own identity, mechanics, visual style | trusted | partial | manual | Option 3 chosen (PRD/README). Identity = Ace, Pebble Beach golf race. Visual style still greyscale |
| B-02 | 6-9 | Beautiful, unique, clean game; practise generating visual and audio assets | trusted | partial | manual | Generated: `assets/audio/` (25), `assets/models/` (6 + golfer), `assets/textures/` (4). Not yet in the client |
| B-03 | 10-14 | Due Thursday midnight; judging Friday morning | trusted | partial | manual | Deployed https://ace-x92s.onrender.com; owner submits portal and form (`docs/submission.md`) |
| B-04 | 15-16 | A complete experience, not a tech demo or single level | trusted | partial | manual | Lobby to 18-hole race to results exists server-side; client does not yet handle `nextHole` |
| B-05 | 20-22 | Polished graphics, cohesive style; thrown-together or mismatched fails | trusted | unserved | manual | Waits on wiring generated assets (backlog item 3) and one style pass; `assets/STYLE.md` exists |
| B-06 | 23-27 | Substantial: varied challenges and progression, not repetition | trusted | partial | manual | 14 clubs, swing timing, lengths, penalties. Holes differ only in length (see B-158) |
| B-07 | 28-29 | Clear objective; players know how to play | trusted | satisfied | manual | In-game How-to-play panel (`src/client/ui.ts` HELP) and README |
| B-08 | 37-38 | Beginning, middle, end: introduction, progression, satisfying result | trusted | partial | manual | Waiting room, countdown, race, results table. No introduction screen or title art |
| B-09 | 39-40 | More than one moment; new challenges or mechanics as they progress | trusted | partial | manual | Putting, lengths, hazards exist; holes do not introduce new mechanics (water, doglegs, wind unserved) |
| B-10 | 41-43 | Visually distinctive, cohesive; look, sound and feel reinforce the world | trusted | unserved | manual | Same as B-05; audio generated but not wired |
| B-11 | 44-45 | Playable by someone else; brief instructions | trusted | partial | manual | README + in-game panel. A cold start by a non-author has not happened |
| B-12 | 46-47 | Browser access with a link; no install | trusted | satisfied | e2e | https://ace-x92s.onrender.com (`scripts/e2e-smoke.mjs`; supervisor ran the hole-out bot on prod) |
| B-13 | 48-50 | Finish the details: layout, typography, animation, sound levels, feedback | trusted | unserved | manual | Default fonts/DOM HUD; no animation, no sound |
| B-14 | 51-56 | All assets generated; no pre-made assets | conditioned (F-002, F-016: provider terms to confirm) | partial | eval | `assets/manifest.json` (32 rows, tool, model, prompt, date). Clubs, music and crowd not generated; licence text unconfirmed by owner |
| B-15 | 57-58 | Smaller finished beats larger unfinished | trusted | n/a | manual | Principle; guides scope cuts (`.claude/build-loop.md`) |
| B-16 | 59-102 | Pick one of three options | trusted | satisfied | manual | Option 3 chosen (PRD/README Decisions) |
| B-17 | 103-126 | Option 1 requirements (exploration) | trusted | n/a | manual | Option not chosen |
| B-18 | 127-150 | Option 2 requirements (platformer) | trusted | n/a | manual | Option not chosen |
| B-19 | 151-153 | Short, exciting racing game people play together and replay | trusted | partial | manual | Race flow exists; replay loop (play again) unverified in the client |
| B-20 | 156 | At least two people racing, clear way to join | trusted | satisfied | e2e | Lobbies; two Chromium contexts joined and raced (`scripts/e2e-smoke.mjs`) |
| B-158 | 158 | At least two distinct tracks/courses with different layouts or challenges | trusted | partial | manual | 18 holes with different lengths and pars; **all straight with identical surfaces**. Needs per-hole layout (doglegs, hazards, water) from `refs/pebble-beach` |
| B-21 | 160 | Complete flow: start, race, finish, results, play again | trusted | partial | e2e | `scripts/ws-holeout-bot.mjs` covers start to finish to results; "play again" untested in the client |
| B-22 | 162 | Clear feedback on position/progress and who won | trusted | partial | manual | Leaderboard (hole, strokes) and results table; no live position number or finish banner |
| B-23 | 164-165 | At least one mechanic beyond basic steering/acceleration | trusted | satisfied | unit | Timed swing, length, lies, penalties (`tests/swing*.test.ts`, `tests/race.test.ts`) |
| B-24 | 167 | Multiplayer reliable enough to finish a race together | trusted | partial | load | Hardening in `src/server/main.ts`; load test (12 racers, 40 idle sockets) not yet run |
| B-25 | 168-169 | Enough variety and multiplayer polish to race again | trusted | partial | manual | See B-158, B-05 |
| B-26 | 170-171 | What makes it great: feels good, easy to get into a match, fun over repeats | trusted | n/a | manual | Principle for judging |

## PRD acceptance criteria
| ID | Criterion (short) | Trust | Status | Check | Artifact or what it waits on |
|---|---|---|---|---|---|
| AC-S1 | 14 keys select the matching club, HUD updates in a frame | trusted | partial | e2e | Implemented in `src/client/main.ts`; no automated check yet |
| AC-S2 | Swing mode disables WASD; Esc before release cancels | trusted | partial | unit | Esc rules in `tests/swingfsm.test.ts`; WASD-off is client code with no test |
| AC-S3 | Perfect sequence: E = 0, max carry, under 1% curvature | trusted | satisfied | unit | `tests/physics.test.ts` (perfect swing straight, every club) |
| AC-S4 | Same press timings give the same result on client and server | trusted | satisfied | unit | The client never scores; `scoreSwing` is pure (`tests/swing.test.ts`) |
| AC-S5 | 30 fps and 144 fps give identical E | trusted | satisfied | unit | `tests/swing.test.ts`; weak: shows purity, not a real frame-rate run |
| AC-S6 | Perfect 25% wedge release carries 40-75 yd; full unchanged | trusted | satisfied | unit | `tests/swing-length.test.ts` SH-4 (47 yd) |
| AC-S7 | Space with Z, X, C overlapping loses no key | trusted | satisfied | unit | `tests/swingfsm.test.ts` rollover cases (hardware ghosting is not testable) |
| AC-S8 | Putt at length L equals the old draw L x 1500 ms | trusted | satisfied | unit | `tests/swing-length.test.ts` SH-5 and `tests/race.test.ts` |
| AC-R1 | Ranking: example, dead heat, 0.8 s chain, DNF order | trusted | satisfied | unit | `tests/ranking.test.ts` |
| AC-R2 | 200 ms latency changes finish time by under 0.25 s | trusted | unserved | e2e | Nothing simulates latency; finish time is server-simulated, which makes it likely true |
| AC-R3 | Penalties, legal drops, freeze at 60 s / 20:00 | trusted | partial | unit | OOB +1 and 2 s wait tested (`tests/race.test.ts`); water, unplayable, lateral relief not implemented; timers untested |
| AC-R4 | Play again with no reload | trusted | partial | e2e | Server returns the lobby to `open`; client results screen button unverified |
| AC-P1 | Per-club carry within 5% of sourced values | trusted | blocked | unit | Waits on sourcing TrackMan averages (PRD/03 §8); placeholders today |
| AC-P2 | Face-to-path error curves the ball the right way, bigger with error | trusted | satisfied | unit | `tests/physics.test.ts` AC-P2, `tests/physics-review.test.ts` |
| AC-P3 | Stimp 10, 1.83 m/s rolls 3.05 m +-5% | trusted | satisfied | unit | `tests/physics.test.ts`, `tests/race.test.ts` |
| AC-P4 | Same inputs give identical trajectory | trusted | satisfied | unit | `tests/physics.test.ts`, `tests/race.test.ts` (weak: only catches randomness) |
| AC-P5 | Solver passes all 18 holes over 100 seeds | trusted | unserved | unit | No solver; holes are fixed data today |
| AC-L1 | Server rejects a 4th lobby, client shows why | trusted | satisfied | unit | `tests/lobbies.test.ts` |
| AC-L2 | 5th player rejected; simultaneous joins admit one | trusted | satisfied | unit | `tests/lobbies.test.ts` |
| AC-L3 | Two machines join and start within 30 s | trusted | partial | manual | Two browser contexts verified; a two-machine playtest is outstanding |
| AC-L4 | Closing the host tab promotes another within 2 s | trusted | partial | unit | Promotion unit-tested; the 2 s timing is implicit (close handler is immediate) |
| AC-L5 | Reload mid-race restores hole, ball, strokes | trusted | unserved | e2e | Reload drops the player; resume token restores nothing (review finding 4) |
| AC-A1 | Every shipped file has a manifest row; CREDITS lists tools | trusted | partial | eval | Manifest rows exist; no `CREDITS` file yet; OSM attribution not applicable (no OSM data used) |
| AC-A2 | With `assets/` empty the game runs in greyscale | trusted | partial | e2e | True today because nothing is wired; must be re-tested after wiring |
| AC-A3 | Models share scale and orientation | trusted | unserved | manual | Models not wired; manifest records target heights and a normalisation note |
| AC-A4 | No clipping sound effects; music below effects | trusted | unserved | manual | Audio not wired; -16 / -20 LUFS normalisation done at generation |

## Slice acceptance rows (not in the brief or PRD, owned by slice specs)
| ID | Slice | Status | Check |
|---|---|---|---|
| PS-1..PS-5 | `docs/slices/partial-swing` | satisfied then superseded by SH-1..SH-5 | unit |
| SH-1..SH-6 | `docs/slices/space-hold-swing` | satisfied | unit (`tests/swing-length.test.ts`, `tests/swingfsm.test.ts`) |
| SH-7 | same | satisfied | e2e (`scripts/ws-length-check.mjs`) |
| SH-8 | same | partial (browser run passed locally; putter hold not browser-run) | e2e (`scripts/e2e-hold.mjs`) |
| C18-1..C18-4 | `docs/slices/course-18` | satisfied | unit (`tests/course.test.ts`) |
| C18-5 | same | partial (2 holes verified over the wire; 18-hole run in progress) | e2e (`scripts/ws-holeout-bot.mjs`) |
| C18-6 | same | unserved (limit timers untested) | e2e |
| C18-7 | same | unserved (client has no `nextHole` handler yet) | e2e |
