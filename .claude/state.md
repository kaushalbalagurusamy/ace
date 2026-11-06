# Working state: gauntlet-game-week (handoff written 2026-11-05, about 11:20 CST)

This file supersedes the 2026-11-04 state, which described the space racer. Where this file and the repo disagree, **the cited file or commit wins**.

Branch `intake/sources-profile-minesweep`, the only branch on GitLab. The PRD and skills commits run from `e8bea0b` to the commit that wrote this file.

## The one thing that matters

Build the **multiplayer browser golf race** MVP described in `PRD/`, and have it playable from a public link **before judging, after 08:00 CST Fri 2026-11-06**. The brief says Thursday midnight CST, but the owner says judging is the real cutoff.

The owner has said development may start ("now you can make the MVP").

## Direction and decisions (owner, 2026-11-05)

- **Game:** *Final Frontier* (the space racer) is scrapped. The game is now a golf race (brief Option 3, Multiplayer Racing).
  - 3 lobbies × 4 players, entered from a waiting room.
  - 14-club Callaway bag on keys `1`–`0`, `-`, `=`, `O`, `P`.
  - WASD to move. Space enters swing mode, then the player times Z (hips), X (shoulders), C (release) against an automatic backswing.
  - Fastest to hole out on 18 wins. Strokes break ties within 1 s.
- **Decisions:** all answers are in the `PRD/README.md` "Decisions" table (Q1–Q11):
  - shared course with visible tracers
  - mini map plus rangefinder
  - no aim line, and a post-shot TrackMan card (carry, total, offline)
  - Z-pendulum putting
  - 20-minute room limit, and 1 minute for the rest after the first finish, then progress freezes
  - Rules of Golf penalties, each with a time cost (2 s drop wait)
  - Tour speed ratios from a 130 mph driver
  - reference swing clip https://www.youtube.com/watch?v=zJpTTF4wr7s
  - solo time trial with stats
  - generic HUD labels; Callaway names are for generating assets (Callaway is the sponsor)
  - everything ships
  - first map is Pebble Beach
- **Visuals:** greyscale polygons first, to prove the physics. Asset generation runs in parallel through subagents (`PRD/06`).
- **Engine:** Three.js (`three@0.186.1`, the version the skills pin), with a Node `ws` server that owns the shot simulation. Clients only replay the trajectories it sends. **No ADR written yet:** write ADR-0001 (engine, authority, host) first.
- **Skills:** 14 project skills are vendored in `.claude/skills/`, commit `9854e5c`. Provenance is in `.claude/skills/PROVENANCE.md`. They come from the lecture's gamedev-skills repo @ `19d93f97c9c1`, Apache-2.0, and were reviewed before install:
  - threejs-scene-setup, threejs-materials-lighting, threejs-gltf-loading
  - prototype-fast, game-jam
  - camera-systems, game-feel, input-systems, physics-tuning, procedural-gen, game-ui-ux
  - create-game-assets, audio-design, performance-optimization

## Still open: ask the owner, don't decide

1. **Q12, Pebble Beach rights:** use the name in the public build, or ship an unnamed "Monterey coastal links"? Default: unnamed (`PRD/06` §2).
2. **Keys:** a Meshy Pro key for 3D generation and an OpenAI key for images. Neither exists yet.
3. **F-044:** the spend ceiling.
4. **F-007:** judge devices. The default is keyboard only, with a "keyboard required" screen on touch devices.
5. **Host:** not chosen. Render free sleeps after 15 minutes (F-042, F-043).
6. **`sf install install --project .`:** never run. The owner now wants development but hasn't explicitly authorised this command. Ask once.

## Known gaps in the PRD (not decided, just unverified)

- **Physics numbers:** every one in `PRD/03` is a placeholder. The Tour-average table is recalled from memory and marked UNVERIFIED. The 5 sources to pull are in `PRD/03` §8. No web research has been done.
- **Pebble Beach data:** the pars come from memory. Yardages must come from the official scorecard. OpenStreetMap golf coverage and USGS 3DEP resolution at Pebble Beach are unchecked (`PRD/06` §2).
- **Swing timing:** the Z/X/C windows and error weights in `PRD/02` §3 are invented starting values, to be tuned in playtest and against the clip.
- **Requirements ledger:** `docs/requirements-ledger.md` doesn't exist yet. Build it from `docs/source/brief.md` line by line (`build-loop.md`).

## Access and keys (this Mac)

- **Git credentials:** GitHub and GitLab tokens are in the macOS Keychain, and `credential.helper osxkeychain` is set globally. `gh` is logged in. Plain `git push` works.
- **Remote:** origin is `https://labs.gauntletai.com/kaushalbalagurusamy/gauntlet-game-week.git`.
- **ElevenLabs key:** in `.env` as `ELEVENLABS_API_KEY`. The file is gitignored and readable only by the owner (mode 600). Starter plan; 40,000 credits as of 2026-11-04.
- **Course repo:** `~/Projects/gauntlet` (GitHub `kaushalbalagurusamy/gauntlet`). Lectures are under `lectures/`.

## Artifacts (private to the owner)

- **Full PRD (7 tabs):** https://claude.ai/artifact/XWm2HzjKRsheuc48j66vFF
- **Asset plan only:** https://claude.ai/artifact/XaY5hj7QGVCQjYxNbmAE1C
- Both are built from `PRD/*.md` by a script in the old session's scratchpad (not in the repo). If the PRD changes, rebuild or republish them.
- **Stale:** the space-racer research artifact (https://claude.ai/artifact/SogJj7fePYrLJEXSYG6eNY) and the deadline briefing (https://claude.ai/artifact/Gb27dNJAbL7zP3Hw4AMo7F).

## Next concrete actions

1. Ask the owner the open items above in one message. Don't block on them; use the defaults.
2. Write ADR-0001. Scaffold the Vite + TypeScript client, the `ws` server and a shared `sim/`.
3. Track A, following `PRD/05`. Tests come first: AC-P3, AC-P4, AC-S3, AC-S5, AC-R1.
4. Track B: start the asset subagents (`PRD/06` §4–5), beginning with ElevenLabs audio since that key exists.

## Disclosures carried over

- Commit 94303ee says "31 findings"; the count was 33. Not amended.
- The minesweeper ran on Sonnet, not the Opus its config names.
- In this session, I (Claude) recommended 2D Phaser. That's withdrawn: golf needs 3D.

## Asset round 2 artifacts (2026-11-06, visual realism worktree)

- **Committed:** `assets/models/tree-cypress-r13.glb` and `assets/models/seawall-r3.glb` (both PASS the independent critic), plus turntable renders under `assets/qa/<id>/` for every scored round-2 candidate.
- **Kept local, gitignored:** the 32 round-2 GLBs that failed the critic (cliff-r2..r5, rock-r5..r15, seawall-r2, tree-cypress-r5..r12/r14..r16, tree-pine-r2..r6) were moved to `assets/models/raw/rejected/`, so `copy-assets.mjs` no longer ships them. Generator raws stay in `assets/models/raw/`. Manifest rows record each one's critic scores with `file: null`.
- **Delete** `assets/models/raw/rejected/` once a later round supersedes these; nothing loads from it.
