# Working state: gauntlet-game-week (2026-11-06, about 00:15 CST, overnight polish)

Supersedes the 2026-11-05 11:20 state. Where this file and the repo disagree, **the cited file or commit wins**.

## The one thing that matters

The game **Ace** is submitted (portal + Google Form, before midnight). The game is live at https://ace-x92s.onrender.com and the demo video at https://ace-demo.onrender.com, which has no game link (an owner request). Polishing continues until judging after 08:00 CST Fri 2026-11-06. The owner's words: **"the crucial deliverable is the HD 3D asset generation"**, judged by "whether it looks accurate to the real photos of it". This covers the motion assets too: the golfer's swing and run, and the cart's movement.

## Live

- GitLab `main` = live = `b73c265`, deployed via `scripts/deploy.sh`.
- Working branch: `intake/sources-profile-minesweep`.
- `b73c265` contains:
  - real Pebble elevation and slope lies (`66d2990`)
  - the captured swing, gait and seated driver, and the Rodin cart, which is still PENDING
  - a ball-scale cup used as the hitbox. The run-out also captures on `CUP_VISUAL_RADIUS_M`.
- Checks at `b73c265`: tsc clean; vitest 372 pass + 2 expected fail; the 18-hole bot passes on the local server (78 strokes).

## In flight (background agents, worktree isolation)

- **Realism:** photo-accurate Pebble assets (cypress, rocks, cliffs, ocean, sky, bunkers, sea wall) from `refs/pebble-photos`, using Rodin and Meshy, gated by a critic.
- **Courses:** Bethpage Black and Aronimink, traced from BlueGolf, plus a course picker. Their height files exist in `src/shared/courses/` but are not yet registered in `COURSE_HEIGHTS`.
- **Cart:** regenerate the Genesis body with Meshy multi-image (≤150 Meshy and ≤4 Rodin credits). The Rodin Low body came out silver and smeared, so it stays PENDING and the code body is shown.
- **Swing critic:** compares the old hand-keyed swing (v12) with the new captured swing against the Dunaway clip. Output goes to `critic-swing.json` in the session scratchpad.

## Known gaps

- **Captured swing** (per the motion agent):
  - the stance is too crouched
  - at P4 the hands reach only head height
  - at P8 the arms don't extend
  - the P10 finish is off
  - the club path is hand-keyed
- **Sprint:** the arm swing is too small and the trunk lean too shallow.
- **Walk:** built from 12 Muybridge frames.
- **Clubs:** none passed the critic (best 3.8), so they stay gated.
- **Cart suspension:** `heightAt` returns 0. The root follows the terrain tilt instead.

## Owner decisions not to undo

- WASD moves; the arrows set ball position on a 7×7 grid.
- One-button Space swing. Max effort is ×1.1 speed and 75% accuracy.
- A Shift tap gives the chip stroke (≤25%).
- Putt roll is about √hold, ~30 m at full.
- The cup is drawn at ball scale and is the hitbox; physics are unchanged.
- The golfer ships under owner override.
- The title stays "Ace".
- No extra spend beyond the current balances: the $30 top-up was asked and not answered.

## Rules

- Commit with explicit paths.
- Reference photos and clips in `refs/` are never committed or shipped.
- Keys stay in `.env` or the Keychain.
- Use `npm run build`; a bare vite build leaves the assets out.

## Asset round 2 artifacts (2026-11-06, visual realism worktree)

- **Committed:** `assets/models/tree-cypress-r13.glb` and `assets/models/seawall-r3.glb` (both PASS the independent critic), plus turntable renders under `assets/qa/<id>/` for every scored round-2 candidate.
- **Kept local, gitignored:** the 32 round-2 GLBs that failed the critic (cliff-r2..r5, rock-r5..r15, seawall-r2, tree-cypress-r5..r12/r14..r16, tree-pine-r2..r6) were moved to `assets/models/raw/rejected/`, so `copy-assets.mjs` no longer ships them. Generator raws stay in `assets/models/raw/`. Manifest rows record each one's critic scores with `file: null`.
- **Delete** `assets/models/raw/rejected/` once a later round supersedes these; nothing loads from it.
