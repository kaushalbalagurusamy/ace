# Slice: the 18-hole Pebble Beach Golf Links race

Status: spec accepted 2026-11-05 (supervisor priority 2). Sources: `docs/research/reference-sources.md` (card), `PRD/04` (race flow, limits, ranking), `PRD/05`.

## Behaviour
- The course has **18 holes**, par 72, with the pars and yardages of the card in `reference-sources.md` (hole 2 as a par 5, 502 yd). 6,864 yd total.
- Every hole is built from its card: tee at the origin, pin straight ahead at `yards x 0.9144` m, the same surface bands and out-of-bounds rules as today. **Simplification, stated:** the centre line is straight; the real doglegs and the coastline from the hole graphics are not modelled tonight (backlog).
- Each player has their own **current hole**. Holing out on holes 1 to 17 shows a 2 s hole card, then the server moves that player to the next tee; the race clock keeps running. Holing out on hole 18 **finishes** the player (finish time from the simulated ball drop).
- Strokes are cumulative across the round (score = total strokes, penalties included).
- Race limits (PRD/04): 20 minutes from Go; 60 s after the first finish; then progress freezes and results are ranked (`rankPlayers`: finishers first, then holes completed, distance to the hole on the current hole, strokes).
- Other players' balls, golfers and tracers are shown **only when they are on your current hole**; the leaderboard shows every player's hole and strokes.

## Contract
`src/server/course.ts`: `HOLE_COUNT`, `CARD` (par and yards per hole), `hole(index)` (RangeError outside 0..17), `teeBall(h, totalStrokes)`.
Protocol: `shotResult` and `holedOut` carry `hole` (0-based); new server message `nextHole {hole, ball}` sent to the player who moves; `raceEnd` results carry `holes` completed.

## Acceptance criteria and the one check for each
| ID | Criterion | Check |
|---|---|---|
| C18-1 | 18 holes, par sum 72, the exact card pars and yardages, total 6,864 yd | unit |
| C18-2 | `hole(i)`: pin at yards x 0.9144 m straight ahead, `info.index == i`, par and `lengthM` match the card, RangeError for an invalid index | unit |
| C18-3 | Surface bands and out-of-bounds are consistent on every hole (green at the pin, fairway at the centre line, OOB behind the tee and past the pin) | unit |
| C18-4 | `teeBall` places the ball on the tee with cumulative strokes, not holed out | unit |
| C18-5 | A player holing out on hole 1 is moved to hole 2 after 2 s with strokes carried; holing out on 18 finishes and records the finish time | wire bot (ws, 18 holes) |
| C18-6 | 20 min and 60 s limits freeze progress and rank by holes completed | unit on the ranking inputs plus the existing AC-R1 tests; timers by wire script with shortened limits |
| C18-7 | The client shows only same-hole balls, 1-based hole numbers, and the 2 s hole card | browser script plus manual playtest |

## Emits for the dashboard
Eval rows C18-1..C18-7; per-player hole and stroke counts in the leaderboard message; server errors for out-of-range holes.
