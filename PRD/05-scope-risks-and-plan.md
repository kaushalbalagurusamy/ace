# 05: Scope, risks and build order

## Scope [GIVEN]

- Everything in 01 to 04 and 06 ships tonight, by midnight CST on 2026-11-05.
- **Track A (main thread):** the MVP is built first with greyscale polygons, to prove that the swing, physics, race rules and multiplayer work.
- **Track B (subagents):** asset generation runs in parallel. Generated assets replace the greyscale stand-ins by ID (06 §5).

## Build order

### Track A
1. **Scaffold:** a Vite + TypeScript client on `three@0.186.1`, a Node `ws` server, and a shared `sim/` package that only the server runs. Record the ADR: engine, server authority, host.
2. **Sim first, with tests:**
   - ball flight, bounce and roll (03)
   - swing timing scoring (02 §3)
   - penalties (04)
   - the ranking function (04)
   - Tests to pass first: AC-P3, AC-P4, AC-S3, AC-S5, AC-R1.
3. **Server:** waiting room, lobbies with 3×4 caps, race clock with the 20 min and 1 min limits, shot handling, freezing progress, results.
4. **Client:**
   - greyscale Pebble Beach terrain (06 §3)
   - WASD and mouse aim
   - the club HUD
   - swing mode and putting
   - the post-shot TrackMan card
   - shared tracers
   - the mini map and rangefinder
5. **Golfer:** pose extraction from the reference clip (02 §6), on the code rig.
6. **Integration:** swap in the generated assets (06), then audio.
7. **Deploy:** host it, warm it up and run a 4-player playtest from the public link. Fix feel issues.

### Track B
Starts at once, following 06 §4.

## Top risks

| Risk | Effect | Mitigation |
|---|---|---|
| Swing feel: windows too tight or the camera unclear | The core loop isn't fun | Timing constants as live-tunable config. Playtest as soon as step 4 works |
| Pose extraction from a single front-view clip is noisy, because depth is ambiguous | The animation looks wrong | Smooth the curves. Clamp them to joint limits. Fall back to hand-keyed poses timed from the clip |
| Placeholder physics gives odd distances | Experts notice (Callaway demo) | Source the TrackMan numbers (03 §8) before the demo |
| Pebble Beach rights (06 §2) | The sponsor or the course owner objects | Settle Q12 before anything is published |
| Free host sleeps or cold-starts at judging (F-042, F-043) | Judges can't join | Keep-alive or a paid tier within the spend ceiling (F-044). Warm it up 15 minutes before judging |
| Judges on phones (F-007) | They can't play | Show a "Keyboard required" screen on touch devices |
| Keyboard rollover: holding Z+X+C | Some keyboards drop keys | Test on the judging laptops |
| Generated assets arrive late or don't match | Visual mismatch | Greyscale stand-ins always work. Swap by ID. One style brief for every generator (06 §4) |

## Tests that gate a release

- The ranking function (AC-R1), the Stimp roll check (AC-P3), deterministic flight (AC-P4) and lobby capacity enforced by the server (AC-L1, AC-L2).
- A 2-browser race from the hosted link, start to results to play again (AC-L3, AC-R4).
- A scripted perfect swing gives a straight maximum carry (AC-S3). Progress freezes at the limits (AC-R3).
