# 05: Scope, risks and build order

## Can this all ship tonight?

Not all of it. At writing time there were about 13 hours to midnight CST. No code exists yet, and every visual and sound must be generated.

The full spec needs several large pieces:
- a 3D rigged golfer with a swing animated from a reference clip
- calibrated TrackMan-grade physics
- an 18-hole course generator with a solver
- a multiplayer server
- all generated art and audio

Each is a day's work on its own. The brief explicitly prefers *a smaller, finished game to a larger, unfinished one*. Players and judges will feel the polish of the core loop (walk, Z-X-C swing, watch the flight, putt out) far more than the physics fidelity.

## Cut line [ASSUMED, your call]

| Priority | Item |
|---|---|
| **Must, tonight** | Waiting room and 3×4 lobbies (01). All 14 clubs with the HUD. WASD and the Z-X-C swing with timing scoring. Putting. Server-simulated flight, bounce and roll using the placeholder constants in 03. 18 procedural holes from 3 or 4 templates. Race clock, the 1 s ranking rule, results and play again. A code-built low-poly golfer with keyframed swing poses. Generated audio for swing, impact, cup, UI and one music loop. Hosted, with a link that works on judging morning. |
| **Should** | Sourced TrackMan numbers in place of the placeholders (03 §8). The completability solver (03 §7). Spectate after finishing. Green slope overlay. Hole cards and fun stats. Reconnect mid-race. |
| **Could** | Pose timing fitted from the reference clip. Five club-head shapes. All 5 hole templates. Time-trial solo mode. Brand names in the HUD. |
| **Won't, v1** | Wind, weather, accounts, persistence across server restarts, touch or phone controls, more than 4 per lobby. |

## Build order

1. **Decisions:** answer Q1 to Q10 (README) and write the engine/authority/host ADR. Three.js client, Node `ws` server, server-authoritative shots.
2. **Shared sim:** a ball-flight, bounce and roll module (TypeScript) run by the server. Its unit tests come first: AC-P3, AC-P4 and the ranking tests from AC-R1.
3. **Server:** waiting room, lobbies, race clock, shot handling and ranking.
4. **Client:** terrain from one hole template, the movement and aim camera, the HUD.
5. **Swing:** the swing state machine and timing scoring (02 §3), with the placeholder golfer.
6. **Content:** more hole templates, the golfer model and poses, audio.
7. **Deploy:** host it, warm it up and run a 4-player playtest. Fix the worst feel issue only.
8. **If time remains:** sourced physics numbers, then the solver.

## Top risks

| Risk | Effect | Mitigation |
|---|---|---|
| Swing feel is off: windows too tight or the camera unclear | The core loop isn't fun | Timing constants as live-tunable config. Playtest by step 5. Tolerant windows to start |
| Golfer animation looks rough | Fails the "polished, cohesive" bar | Stylised low-poly figure that looks intentional. One art style for everything |
| Placeholder physics gives odd distances | Experts notice | Clamp results to the Tour-scaled carry table. Source the numbers when time allows |
| 18 holes take too long to play | Races drag on | Run speed and hole lengths are config. Aim for a 10 to 15 minute race (brief) |
| Free host sleeps or cold-starts at judging (F-042, F-043) | Judges can't join | Paid tier or keep-alive within the spend ceiling (F-044). Warm it up 15 minutes before judging |
| Judges on phones (F-007) | They can't play | Show a "Keyboard required" screen on touch devices. Ask the organisers |
| The reference clip or brand names (Q7, Q9) | Rights or "pre-made" challenge | The clip is used only to measure timing. Generic HUD labels. Provenance log and CREDITS file |
| Keyboard rollover: holding Z+X+C | Some keyboards drop keys | Z, X and C sit on one row, which usually survives rollover. Test on the judging laptops |

## Tests that gate a release

- The ranking function (AC-R1), the Stimp roll check (AC-P3), deterministic flight (AC-P4) and lobby capacity enforced by the server (AC-L1, AC-L2).
- A 2-browser race from the hosted link, start to results to play again (AC-L3, AC-R4).
- A scripted perfect swing gives a straight maximum carry (AC-S3).
