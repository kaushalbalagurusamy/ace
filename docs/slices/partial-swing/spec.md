# Slice: backswing length (partial swings)

Status: SUPERSEDED for input by docs/slices/space-hold-swing/spec.md (2026-11-05); the timing and speed ideas live on there. Original status: spec accepted 2026-11-05. Source: supervisor message, `.claude/supervisor-inbox.md` gap note.

## Why
No partial swing exists, so from inside ~130 yd every club overshoots (even 62 degrees) and the server calls the shot out of bounds. Players can rarely reach a putt, so putting and hole-out cannot be played or physics-tested.

## Behaviour
- Before entering swing mode the player steps a **swing length** with the mouse wheel or `[` and `]` through 25, 50, 75, 100 percent (default 100). The HUD shows a 4-step bar beside the club row.
- The automatic backswing stops at that fraction of the full turn.
- Club speed = full speed x `lengthSpeedFactor(length)`; starting values 0.45 / 0.65 / 0.85 / 1.0 (config, tuned to meet PS-5).
- The Z/X/C ideal offsets and the error window scale with `durationScale(length)` (shorter downswing), so good tempo still gives a straight shot at any length.
- Client sends `length` on `shot`; the server validates it is one of the four steps (absent = 100) and rejects anything else.
- Putting is unchanged (length does not apply).

## Contract (src/sim/types.ts)
`SwingLength`, `SWING_LENGTHS`, `isSwingLength`, `durationScale`, `lengthSpeedFactor`; `scoreSwing(input, length = 100)`; `launchFor(club, score, length = 100)`.

## Acceptance criteria and the one check for each (MECE over this slice)
| ID | Criterion | Check |
|---|---|---|
| PS-1 | At length 100, `scoreSwing` and `launchFor` are exactly today's results | unit |
| PS-2 | Ideal timings scale: perfect scaled timings give E = 0 at every length; unscaled timings at 25% give E > 0 | unit |
| PS-3 | `isSwingLength` accepts only 25/50/75/100; scoring helpers reject others | unit |
| PS-4 | For every non-putter club, carry strictly increases with length; perfect swings stay straight (<1% offline) | unit |
| PS-5 | Perfect 25% swing with the 62 degree wedge carries 40 to 75 yd on flat ground | unit |
| PS-6 | Server rejects `shot` with an invalid length and accepts 25/50/75/100 | wire script (ws) |
| PS-7 | Wheel and `[`/`]` step the length, HUD bar shows it, backswing stops at the fraction | browser script plus manual playtest |

## What this slice emits (for the dashboard)
Eval rows PS-1..PS-7 pass/fail; a server error code for an invalid length; nothing model-related (no LLM calls).
