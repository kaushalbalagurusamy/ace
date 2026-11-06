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
| [06-assets-and-pebble-beach.md](06-assets-and-pebble-beach.md) | Asset list, generation platforms for 3D and audio, the Pebble Beach map |
| [07-cart.md](07-cart.md) | The Genesis Box Buggy golf cart: driving, where carts may go, bumps, server checks, model and sound |

## How to read the tags

- **[GIVEN]**: you stated it. I only reworded it.
- **[ASSUMED]**: I filled a gap. Accept it, change it or strike it.
- **[UNVERIFIED]**: a fact from memory that needs a source check before it drives numbers.
- **[OPEN]**: needs your answer. The default I'd use is shown.

## Decisions (owner answers, 2026-11-05)

| # | Question | Decision [GIVEN] |
|---|---|---|
| Q1 | Shared course? | Yes. All players share the course and see each other's balls and tracers. Ways to sabotage each other come in a later version. |
| Q1b | Mini map | Required. It shows players, balls and the hole layout. Expanded, it becomes a rangefinder for planning the shot and choosing a club (02 §7). |
| Q2 | Aiming | The mouse sets the aim, and **no aim line is drawn**. Planning a shot on the rangefinder doesn't guarantee the golfer is facing that way. After each shot, transient TrackMan-style stats show: carry, total, offline. |
| Q3 | Putting | A simple Z pendulum: hold to draw back, release to strike. |
| Q4 | Race end | Each room has a 20-minute limit. Once the first player finishes, the rest have 1 minute. After that their progress is frozen for the final results. |
| Q5 | Penalties | Standard Rules of Golf, with each penalty also costing time in game, such as a 2-second wait for a drop (04). |
| Q6 | Speed across the bag | Tour-average speed ratios, with the driver at 130 mph. |
| Q7 | Swing reference | Use https://www.youtube.com/watch?v=zJpTTF4wr7s to extract the 3D golfer animation. |
| Q8 | Solo | A single-player time trial, with score stats. |
| Q9 | Club names | Generic HUD labels. The Callaway and Odyssey model names are for generating the club assets, because Callaway is the sponsor (06). |
| Q10 | Scope | Everything ships tonight. Build the MVP first with greyscale polygons to prove the physics. Asset generation runs in parallel through subagents. |
| Q11 | First map | Pebble Beach Golf Links (06). |
| Q13 | Swing complexity (2026-11-05) | Z/X/C is too complex for casual players. **One-button swing:** arrow keys move; Space takes the stance (mouse still aims, clubs still change); hold and release Space swings (full at 0.75 s); every shot has perfect delivery; W/S and A/D set the ball position (forward-back launch, closer-away draw or fade); holding to 1.10 s auto-releases a MAX-effort shot (+20% carry, 70% accuracy). Look speed default 1.75x with a settings slider; walk 15 m/s, Shift 5 m/s walk and 0.5x look. Title stays "Ace". See PRD/02 sections 2 to 5. |

**Still open:**
- **Keys:** a Meshy Pro key and an OpenAI image key.
- **F-044:** the spend ceiling.
- **F-007:** judge devices.

## What carries over from the space-game research

- **Assets:** every visual and sound is generated or made in code, never taken from a library pack, with a provenance log and a CREDITS file (register F-014, F-052, F-003, F-060).
- **Generator terms:** use tiers whose terms fit a public, judged game. ElevenLabs Starter is already active (F-002, F-016).
- **Netcode and hosting:** WebSocket to one authoritative server, no peer-to-peer, and a warm-up before judging (F-041, F-042, F-034, F-043).
- **Keys:** keys stay in an untracked `.env`, never in git.
- **Engine (decided 2026-11-05):** Three.js r186 (`three@0.186.1`, the version the vendored skills pin) on the client, and a Node `ws` server that owns the shot simulation. This replaces my earlier 2D Phaser recommendation. The project skills in `.claude/skills/` (see PROVENANCE.md there) cover Three.js scene setup, materials, glTF loading, camera, input, game feel, physics tuning, procedural generation, UI, audio and asset creation.
- **Dropped:** the n-body physics findings (F-036, F-037, F-039) no longer apply.
