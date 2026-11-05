# Golf Race: product requirements (draft for review)

**Status:** draft v0.1, written 2026-11-05 at about 10:30 CST. The game is due tonight at midnight CST.
**Replaces:** the "Final Frontier" multiplayer space racer. Option 3 (Multiplayer Racing) still applies.
**Working title:** Golf Race. The final name is still open.

## The game in one paragraph

Up to four players race through 18 holes of golf in a browser. Players join from a shared link, pick one of up to three lobbies in a waiting room and start together. Each player walks to their ball with WASD and presses Space to enter swing mode. They then time a three-key downswing (Z hips, X shoulders, C wrist release) against an automatic backswing. Good timing gives full distance and a straight ball. The first player to hole out on 18 wins. Strokes only break ties when finish times are within one second.

## Documents

| File | Covers |
|---|---|
| [01-lobby-and-matchmaking.md](01-lobby-and-matchmaking.md) | Waiting room, lobbies, start, leaving, reconnecting |
| [02-controls-and-swing.md](02-controls-and-swing.md) | Bag, HUD, movement, aiming, the Z-X-C swing model, putting, animation |
| [03-physics-and-course.md](03-physics-and-course.md) | Ball flight, launch, lies, bounce and roll, greens, cup, course layout |
| [04-race-rules-and-results.md](04-race-rules-and-results.md) | Race flow, timing, penalties, ranking with the 1-second rule, results |
| [05-scope-risks-and-plan.md](05-scope-risks-and-plan.md) | What fits by tonight, risks, build order, tests |

## How to read the tags

- **[GIVEN]**: you stated it. I only reworded it.
- **[ASSUMED]**: I filled a gap. Accept it, change it or strike it.
- **[UNVERIFIED]**: a fact from memory that needs a source check before it drives numbers.
- **[OPEN]**: needs your answer. The default I'd use is shown.

## Review these first

These are the gaps where my default changes the game most.

| # | Question | Default if you don't answer |
|---|---|---|
| Q1 | Do players share one course and see each other's golfers and balls? | Yes. Everyone plays the same 18 holes at their own pace. You see others only when on the same hole, with no collisions. A live leaderboard shows everyone. |
| Q2 | How do players aim? WASD is disabled in swing mode. | The mouse turns the camera. Near the ball, the aim line follows the camera, and Space locks it. |
| Q3 | How does putting work? Z-X-C doesn't fit a putting stroke. | Hold Z to draw the putter back (a meter fills), release to strike. Distance follows the draw length. X and C do nothing. |
| Q4 | When does the race end for players who haven't finished? | 3 minutes after the first finisher, or 30 minutes after Go. Unfinished players are ranked by holes completed, then strokes. |
| Q5 | What happens with out of bounds, water and a stuck ball? | +1 stroke and an automatic drop. A hole is picked up at 10 strokes. Holding R for 2 seconds drops you on the fairway for +2. |
| Q6 | How does 130 mph scale across the bag? | 130 mph is driver club speed. Other clubs scale by Tour-average speed ratios (see 03). |
| Q7 | What are "MCS (Wax Nation)" and the "Dunaway front SyberVision" clip? | I can't identify either from memory. Please send links. Until then the swing is animated in code from kinematic-sequence timing. A video would only be used to measure timing, never shipped (see 02 §6). |
| Q8 | Can one player start alone, for practice or for judges? | Yes, as a "time trial" lobby that doesn't count as a race. |
| Q9 | Should the HUD show brand names (Elyte, Apex, Opus, Odyssey Tri-Hot)? | The HUD shows generic labels (Driver, 3W, 18° UT, 4i...). Brand names stay in the bag data. |
| Q10 | Does all of this ship tonight? | No. See 05 for the cut line I recommend. |

## What carries over from the space-game research

- **Assets:** every visual and sound is generated or made in code, never taken from a library pack, with a provenance log and a CREDITS file (register F-014, F-052, F-003, F-060).
- **Generator terms:** use tiers whose terms fit a public, judged game. ElevenLabs Starter is already active (F-002, F-016).
- **Netcode and hosting:** WebSocket to one authoritative server, no peer-to-peer, and a warm-up before judging (F-041, F-042, F-034, F-043).
- **Keys:** keys stay in an untracked `.env`, never in git.
- **Engine:** my earlier recommendation of 2D Phaser is withdrawn. Golf ball flight needs 3D, so the plan is Three.js, which still needs an ADR.
- **Dropped:** the n-body physics findings (F-036, F-037, F-039) no longer apply.
