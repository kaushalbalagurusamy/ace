# Slice: hold Space to set the backswing length (full swing and putting)

Status: spec accepted 2026-11-05 (owner design change relayed by the supervisor). Supersedes `docs/slices/partial-swing/spec.md` for input: the wheel and `[` `]` selector and its step bar are removed; the timing-scale and speed-factor ideas stay, now over a continuous length.

## Behaviour
FULL SWING
1. First Space press near the ball: take the stance and lock the aim (WASD off).
2. Second Space press and HOLD: the backswing turns at a fixed tempo, a full turn in 750 ms (`FULL_TURN_MS`, config). A length meter fills on the HUD.
3. RELEASE Space = the top of the swing. Holding past full pauses at the top. **Length** = fraction reached, continuous, clamped to 0.05 to 1.0.
4. Z, X, C are timed **relative to the Space release** (it replaces "top"). Their ideal offsets and the error window scale with length (`durationScale`, piecewise-linear through 0.25 -> 0.6, 0.5 -> 0.75, 0.75 -> 0.9, 1 -> 1, and 0.05 -> 0.48). Club speed = full speed x `lengthSpeedFactor(length)`, piecewise-linear through 0.25 -> 0.5, 0.5 -> 0.68, 0.75 -> 0.86, 1 -> 1, and 0.05 -> 0.18.
PUTTER
- Same steps 1 and 2; **releasing Space strikes the ball**. Speed = 15 m/s x length (the old `drawMs / 1500 x 15` curve with draw = length x 1500 ms). Hold-Z putting is removed; Z, X, C do nothing with the putter.
BOTH
- Esc between the stance and the release cancels with no penalty. After the release (full swing) Esc does nothing.
- The client sends the continuous `length` (fraction). The server rejects a non-finite value, clamps to 0.05 to 1, and computes speed from the curve above.
- Pressing Space, Z, X and C in any overlapping order must not lose a key: presses made before the release are kept as early (negative) offsets.

## Contract
`src/sim/length.ts`: `MIN_LENGTH`, `MAX_LENGTH`, `FULL_TURN_MS`, `isValidLength`, `clampLength`, `lengthFromHold`, `durationScale`, `lengthSpeedFactor`, `puttSpeedMs`; `scoreSwing(input, length = 1)`, `launchFor(club, score, length = 1)`.
`src/client/swingfsm.ts`: pure `SwingFSM` (no DOM, no clock): `key(code, down, t)`, `tick(t)`, `meter(t)`; actions `send-shot`, `send-putt`, `cancel`.
Protocol: `shot.length?: number` (fraction), `putt { aimDeg, length }` (replaces `drawMs`).

## Acceptance criteria and the one check for each (MECE over this slice)
| ID | Criterion | Check |
|---|---|---|
| SH-1 | Length helpers: validity, clamp 0.05..1, hold-to-length (750 ms = full, past full pauses, floor 0.05) | unit |
| SH-2 | Timing offsets and window scale continuously with length; perfect scaled timings give E = 0 at any length; length 1 is exactly the old full swing | unit |
| SH-3 | Speed factor is continuous, monotone, 1 at full; carry rises with length for every club; perfect swings stay straight | unit |
| SH-4 | Perfect release at 25% with the 62 degree wedge carries 40-75 yd; very short swings carry a few yards (chips exist) | unit |
| SH-5 | Putt speed = 15 m/s x length; matches the old drawMs curve; holes out from 1 m at the matching length | unit |
| SH-6 | `SwingFSM`: sequence, rollover and early keys, Esc rules, putter strike on release, no double send, scaled impact deadline | unit (key-event sequences) |
| SH-7 | Server rejects a non-finite length, clamps out-of-range lengths, accepts any fraction | wire script (ws) |
| SH-8 | Wheel, `[ ]` and the step bar are gone; the length meter shows while holding; README and PRD/02 §3 and §5 describe the new input | browser script + docs-sync diff |

## Emits for the dashboard
Eval rows SH-1..SH-8; server error text for an invalid length; no model calls.
