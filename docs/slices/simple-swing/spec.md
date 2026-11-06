# Slice: the simple swing (owner redesign 2026-11-05)

Status: spec accepted 2026-11-05. The owner found Z/X/C too complex for casual players. **Supersedes** `docs/slices/space-hold-swing/spec.md` for the downswing (the hold-Space backswing and continuous length stay) and PRD/02 §2 to §5 (see the PRD/README decisions table, Q13).

## Behaviour
1. **Movement is the arrow keys** (on foot; the cart in P2 later). WASD is no longer movement.
2. **Stance:** first Space near the ball takes the stance and locks the aim (mouse sets it, unchanged).
3. **Swing = hold and release Space only.** Z/X/C, their timing, scoring, keys and HUD are removed. The meter fills to 100% at 0.75 s; releasing earlier is a partial shot; length is continuous (0.05 to 1.0) as before.
4. **Every shot has perfect delivery:** square face, neutral path, the club's normalised speed x the length curve. Variation comes only from the ball position, the lie and turf, and max effort.
5. **Ball position, in the stance only** (resets to centre every shot): `W`/`S` moves the ball forward/back (fb -2..+2) and `A`/`D` moves it closer to/further from the body (io -2..+2). Forward = +1.5 degrees of dynamic loft per step (higher launch, more spin loft and spin); back = lower, more delofted. Further from the body (`D`, +) = in-to-out path of +2 degrees per step with the face square = a **draw**; closer (`A`, -) = out-to-in = a **fade**. A small HUD grid shows the ball against the feet.
6. **Max effort:** holding past full keeps the meter going (a red MAX zone); at **1.10 s** the swing auto-releases as a max-effort shot: club speed scaled so carry is **+20%** (solved through the sim) at **70% accuracy** (random face and path errors from a seeded server RNG; spread 3x the normal-shot reference, which is defined as sigma/3). Releasing between 0.75 s and 1.10 s is a normal 100% shot.
7. **Putting:** same hold and release; no max effort; holding past full caps at the maximum putt length (length 1).
8. **Esc** in the stance or before the release cancels, no penalty.
9. **Shot card:** ball position ("Fwd +1, Away +2") and effort (normal or MAX) replace the timing grades; carry, total, offline, speeds, launch and spin stay.
10. **Wire:** `shot { clubKey, aimDeg, holdMs, fb, io }`, `putt { aimDeg, holdMs }`. The server derives length (`holdMs / 750`, clamped 0.05..1) and max effort (`holdMs >= 1100`, full swings only) itself, validates every range and rejects anything else; fb and io are integers in -2..2.
11. **Lie and turf** (PRD/03 section 4) apply in the sim: first cut x0.97 speed, x0.85 spin, +0.5 degrees; rough x0.85, x0.55 spin (flyer), +1.5 degrees and a seeded +-1.5 degree face noise; bunker x0.75 (x0.55 for non-wedges), x0.60 spin, +2 degrees; fringe and green with a non-putter x0.9; driver off the tee has -1 degree attack angle instead of +5 (3-wood -2.9 instead of +2).

## Contract
`src/sim/delivery.ts` and `physics.ts`: `launchFor(club, strike?)` with `Strike { length?, ballPos?, maxEffort?, seed?, lie? }`; `BallPos`, `CENTRE`, `isValidBallPos`, `LOFT_PER_FB_DEG`, `PATH_PER_IO_DEG`, `MAX_EFFORT`, `maxEffortSpeedFactor(club)`, `LIE`; `effortFromHold(holdMs, putt)` in `length.ts`. Removed: `scoreSwing`, `IDEAL_MS`, `durationScale`, `SwingScore`.
`src/client/swingfsm.ts`: stance with ball-position steps, hold/release, auto-release at 1100 ms. `src/client/rules.ts`: `moveAxis(keys)` (arrow keys only).

## Acceptance criteria and the one check for each
| ID | Criterion | Check |
|---|---|---|
| SS-1 | A centre full swing is straight and deterministic for every club | unit |
| SS-2 | Each forward/back step raises/lowers launch (about 0.9 deg) and spin; each away/closer step draws/fades with the right start-direction sign | unit |
| SS-3 | Partial lengths are monotonic in carry | unit (existing) |
| SS-4 | Max effort gives about +20% carry (within 5%) for driver, 7i, PW and the 62 degree wedge | unit |
| SS-5 | Over 500 seeded max-effort shots the offline spread is about 3x the reference (within 12%), mean about 0; same seed same shot | unit |
| SS-6 | Lie multipliers (speed, spin, launch, bunker wedge versus non-wedge) and tee versus fairway attack angle for driver and 3-wood | unit |
| SS-7 | `effortFromHold`: lengths, 1100 ms boundary, putter has no max effort; server rejects out-of-range or non-integer ball position and non-finite hold | unit |
| SS-8 | State machine: stance steps and clamps, ball keys ignored in the backswing and for the putter, hold/release, auto-release at 1100 ms, putter cap, Esc, abort | unit |
| SS-9 | Arrow keys move, WASD never moves, and the two inputs cannot conflict | unit |
| SS-10 | Browser: arrow-key walking, W/S/A/D ball-position HUD in the stance, MAX zone auto-release, new card text; no Z/X/C anywhere | browser script + docs-sync diff |
