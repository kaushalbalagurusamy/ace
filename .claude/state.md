# Working state: gauntlet-game-week (2026-11-06, about 00:15 CST, overnight polish)

Supersedes the 2026-11-05 11:20 state. Where this file and the repo disagree, **the cited file or commit wins**.

## The one thing that matters

The game **Ace** is submitted (portal + Google Form, before midnight). The game is live at https://ace-x92s.onrender.com and the demo video at https://ace-demo.onrender.com, which has no game link (an owner request). Polishing continues until judging after 08:00 CST Fri 2026-11-06. The owner's words: **"the crucial deliverable is the HD 3D asset generation"**, judged by "whether it looks accurate to the real photos of it". This covers the motion assets too: the golfer's swing and run, and the cart's movement.

## Live

- GitLab `main` = live = `98471c7` (deployed ~07:30 CST Fri 6 Nov). Three courses on real elevation with lie, slope, run-out and Stimp-10 greens.
- Generated assets live (critic PASS): cypress r13, pine r19b, rock r20, 18th sea wall r3. The cart body is Meshy cart-meshy-5 under owner override (critic 3.25). The golfer ships under owner override.
- Live scorecard: standings strip, a Tab full card, and a results card, broadcast by the server as `progress` messages.
- Swing: MediaPipe capture fused with hand keys, critic 3.5. The Uthana video-to-motion swing is behind `?swing=uthana` (critic 3.0).
- Checks: tsc; vitest 392 + 2 expected fail; build. The bot passes 18 holes on all courses solo, three races at once, and a 4-player lobby race (Aronimink, places 1–4).
- Bot multiplayer mode: `HOST=<n>` creates the lobby and starts it; `JOIN=1` joins one.
- Rodin works only at Gen-2.5-Low; `gen_rodin.py` now defaults to it. Meshy was upgraded by the owner. The Uthana key is in `.env`.
- Owner report: https://claude.ai/artifact/T9gRsv7gZyeecGUisPbxyk

## Known gaps

- Rocks (best 3.5, felt-like surfaces), Monterey pine (3.25), cliff block unscored; failed GLBs live in gitignored assets/models/raw/rejected/.
- Scenes vs photos avg 2–3/5: no bunker lips/green mounds, flat far shore band, no marine-layer sky, too many trees on 7 and 8, hole 8 chasm walls grey-green.
- Swing: knees too bent P2–P9, P8 arms collapsed (rig arm reach); P4 turn capped by the 90±5° spec.
- Clubs gated (best 3.8). ~70 sea-drawn cells still score as sand/path.

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

## Asset round 4 artifacts (2026-11-06, model-gen-r4 worktree)

- **Committed:** `assets/models/rock-r20.glb` (critic PASS 4/4/4/4, wired as the only rock in `scene.ts`), QA renders for rock-r17..r20 and tree-pine-r7..r13, manifest rows with scores.
- **Kept local, gitignored:** failing GLBs rock-r17..r19 and tree-pine-r7..r13 in `assets/models/raw/rejected/`; concepts in `assets/images/`.
- **Not committed:** `node_modules` in this worktree is a symlink to the main checkout's `node_modules` for tsc/vitest/build. `.gitignore`'s `node_modules/` only matches directories, so it shows as untracked. Delete the symlink with the worktree; never commit it.

## Final model round artifacts (2026-11-06, final-model-round worktree)

- **Committed:** `assets/models/tree-pine-r19b.glb` (critic PASS 4/4/4/4, wired as the pine in `scene.ts`), plus QA renders and manifest rows for every critic-scored candidate (pine r16e..r19b, oak r16b..r22c, maple r16a..r21a).
- **Deleted:** `assets/qa/` renders of candidates that never went to a critic: the raw Meshy and Rodin outputs (`*-r15*`) and intermediate tries (pine r16a..d, r16f..h, r18a, r18c; oak r16a, r17b..d, r18a..c, r19a, r19b, r20a, r21a, r21b, r22b, r23a; maple r16b, r20a). They support no verdict and can be re-rendered from the GLBs.
- **Kept local, gitignored:** all failing and unscored GLBs in `assets/models/raw/rejected/`; the raw Meshy sources and staged `*.row.json` files in `assets/models/raw/`; the concepts in `assets/images/`.
- **Not committed:** the `node_modules` and `refs/*` symlinks into the main checkout.
