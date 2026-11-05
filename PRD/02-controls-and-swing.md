# 02: Controls, bag and swing

## 1. The bag [GIVEN]

Players always have one club equipped. No golf bag is shown. Keys use `KeyboardEvent.code` so they work on any keyboard layout [ASSUMED].

| Key | Club (as given) | HUD label [OPEN Q9] | Loft | Delivery |
|---|---|---|---|---|
| 1 | Elyte TD 8° Driver | Driver | 8° [GIVEN] | +5° attack angle off the tee [GIVEN] |
| 2 | Elyte TD 3W | 3W | 15° [ASSUMED] | +2° off the tee [GIVEN]. Off the ground it's struck down [ASSUMED] |
| 3 | Apex 2025 utility iron, #2 UDI 18° [GIVEN, clarified 2026-11-05] | 18° UT | 18° [GIVEN] | struck down, PGA delivery [GIVEN] |
| 4 to 0 | 2025 X Forged 4-PW | 4i, 5i, 6i, 7i, 8i, 9i, PW | 23/26/30/34/38/42/46° [ASSUMED] | struck down, PGA delivery [GIVEN] |
| - | Opus SP 50° | 50° | 50° [GIVEN] | struck down [GIVEN] |
| = | Opus SP+ 54° | 54° | 54° [GIVEN] | struck down [GIVEN] |
| O | Full Toe SP 62° | 62° | 62° [GIVEN] | struck down [GIVEN] |
| P | S2S Tri-Hot #7 Center Shaft | Putter | 3° [ASSUMED] | putting stroke (§5) |

- **HUD** [GIVEN]: a row of 14 slots across the top in bag order, each with its key and the active club highlighted.
- **Carry readout** [ASSUMED]: the HUD also shows the active club's full-swing carry from flat fairway.
- **Club locking** [ASSUMED]: clubs can change at any time outside swing mode, and are locked once swing mode starts.

## 2. Moving and aiming

1. [GIVEN] WASD moves the golfer.
2. [ASSUMED] Movement is relative to the camera. The mouse orbits a third-person camera.
3. [GIVEN, owner playtest 2026-11-05] Walking speed is **13 m/s**, and holding **Shift** sprints at **18 m/s** (config in `src/client/rules.ts`; 9 m/s felt slow). A 300-yard walk takes about 20 seconds. This speed is the main lever on race length (see 05).
4. [ASSUMED] Players can't walk into water or past out-of-bounds stakes. Trees block movement. Golfers pass through each other.
5. [GIVEN] The first Space press within 2.5 m of the ball [ASSUMED distance] takes the **stance**: swing mode starts, the aim locks and WASD is disabled. A prompt shows "Space: take your stance" when in range.
6. [GIVEN, owner playtest] **Look speed:** the owner prefers the feel of a macOS three-finger drag, so the default look sensitivity is 2.5 times the original 0.003 rad per pixel, adjustable live with `,` and `.` in 10% steps (toast "Look 2.5×", saved in localStorage), and pointer lock asks for unadjusted movement first so a mouse and a trackpad scale the same (`src/client/sensitivity.ts`).
7. [GIVEN, owner playtest] **Your ball is never lost:** a yellow beacon stands over your ball, an edge arrow with the distance in yards shows when it is off screen, and a "Walk to your ball" hint shows until you are in range. After a penalty (water relief or out of bounds) a large banner says what happened and the golfer is moved to where the ball now is. Out of bounds is drawn with a white boundary line and a hatched area beyond it, starting about 12 m beyond the traced land.
8. [GIVEN] **Aiming:** the mouse sets the aim direction, the way the camera faces. **No aim line or landing marker is drawn.** Pressing Space locks the aim. A shot planned on the rangefinder (§7) isn't guaranteed to match where the golfer faces. Lining up is part of the skill.

## 3. Swing mode

*Revised 2026-11-05 (owner design change, `docs/slices/space-hold-swing/spec.md`): the owner sets the backswing length by holding Space. This replaces the automatic backswing and the earlier wheel / `[` `]` step selector.*

1. **First Space press** near the ball: take the stance and lock the aim (WASD off).
2. **Second Space press, held:** the backswing turns at a fixed tempo, a full turn in 750 ms (`FULL_TURN_MS`, config). A length meter fills on the HUD.
3. **Release Space = the top of the swing.** Holding past a full turn pauses at the top. **Length** is the fraction reached, continuous, clamped to 0.05 to 1.0.
4. **Z, X, C** are timed **relative to the Space release** (it replaces "the top"), each pressed and held to impact. Their ideal offsets and the 120 ms error window scale with length (a shorter swing has a shorter downswing), so good tempo gives a straight shot at any length.
5. **Club speed** = the club's full speed x f(length), interpolated through 0.25 -> 0.5, 0.5 -> 0.68, 0.75 -> 0.86, 1 -> 1 (and 0.05 -> 0.18) [ASSUMED, tunable config]. A perfect 25% swing with the 62 degree wedge carries about 47 yd; a full swing is unchanged.
6. **Impact, follow-through, ball launch** are automatic (0.8 s).

Pressing Space, Z, X and C in any overlapping order loses no key: presses made before the release are scored as early (negative offsets). Implementation: the pure `SwingFSM` in `src/client/swingfsm.ts`.

- **Model** [GIVEN]: the swing is based on MCS (Wax Nation). A full hip turn and shoulder turn go to the top. On the downswing, the hips lead and pull the shoulders, and the wrists release once the arms drop into the slot.
- **Ideal timing:** the target offsets are parameters fitted to the reference clip once we have it [OPEN Q7]. The starting values below follow the general kinematic-sequence ordering of hips, then torso, then arms, then club [UNVERIFIED as exact numbers].
  - At full length, relative to the Space release: Z at t = 0, X at 60 ms, C at 150 ms, about 100 ms before impact.
  - At shorter lengths X and C offsets and the error window are multiplied by `durationScale(length)` (0.6 at 25%, 0.75 at 50%, 0.9 at 75%).
- **Hold:** all three keys must stay held until impact. Letting go early counts as "bailing out" and is scored as if the key had never been pressed.
- **Missed key:** if a key isn't pressed by impact, the swing still finishes. It counts as a mishit with that key's maximum error. The ball always goes somewhere and there is never a whiff [ASSUMED].
- **Cancel:** Esc after the stance and before the Space release cancels with no penalty [ASSUMED]. After the release it does nothing.

### Scoring the timing [ASSUMED, all constants to calibrate]

Each key's error e (ms) is its press time minus the ideal time, normalised as n = clamp(|e| / 120 ms, 0, 1). The errors drive the strike:

| Input | Error mainly affects | Early | Late |
|---|---|---|---|
| Z (hips) | club speed: lost sequencing | arms take over: speed −, path out-to-in | stuck: speed − |
| X (shoulders) | swing path | over the top: path left, pull or slice | stuck: path right, push or hook |
| C (release) | face angle and contact | flip: face closed, dynamic loft −, hook | held off: face open, push or slice |

- `E = 0.4·nZ + 0.3·nX + 0.3·nC`
- club speed = speed_max × (1 − 0.25·E)
- smash = smash_max × (1 − 0.10·E)
- path = ±6° × nX (sign from early or late)
- face-to-path = ±5° × nC (sign from early or late)

A perfect sequence (E = 0) gives full speed, a square face and path, and therefore maximum distance with a straight flight [GIVEN].

**Timing measurement** [ASSUMED]: timing uses `event.timeStamp` and `performance.now`, not frame counts, so a slow frame rate doesn't change the result. The client sends the raw press and release times. The server re-scores them and rejects impossible input, such as presses before swing mode started.

## 4. After the swing

- [ASSUMED] The camera follows the ball, then returns to the golfer.
- [ASSUMED] Movement unlocks once the ball comes to rest. The player can start walking while the ball is still rolling.
- [GIVEN] **Shot card:** after each shot, TrackMan-style stats show briefly: **carry, total and offline** (yards left or right of the aim line).
  - [ASSUMED] The card also shows club speed, ball speed, launch, spin and the swing timing grade for Z, X and C.
  - [ASSUMED] It fades after 4 s.
- [GIVEN] Every ball's tracer is visible to every player.
  - [ASSUMED] Each tracer stays until that player's next shot.

## 5. Putting [GIVEN: simple stroke; revised 2026-11-05 to hold Space]

- With the putter equipped: first Space press takes the stance (aim locks); **hold Space** to draw the putter back (a meter fills over 750 ms for a full draw); **releasing Space strikes the ball.** Hold-Z putting is removed.
- Ball speed = 15 m/s x length (length 0.05 to 1), the old `drawMs / 1500 x 15` curve. Full draw is about 15 m/s, enough for roughly 25 m on Stimp 10 [ASSUMED].
- Z, X and C do nothing with the putter. Esc after the stance and before the release cancels.
- A green slope overlay (arrows on a grid) shows within 10 m of the ball [ASSUMED].

## 6. Golfer animation

- [GIVEN] **Reference clip:** https://www.youtube.com/watch?v=zJpTTF4wr7s, the source for extracting the 3D golfer animation.
- [ASSUMED] **Extraction method:**
  1. Download the clip locally, for reference only.
  2. Step through it frame by frame, slowed down.
  3. Run 3D pose estimation (for example MediaPipe Pose landmarks) on the frames to get joint angles and the phase timings: address, takeaway, top, Z/X/C onsets, impact, finish.
  4. Retarget those onto our own rig as keyframes.
- [ASSUMED] **What ships:** only the extracted joint-angle curves, on our own model. The video and its frames are never shipped (brief: no pre-made assets), and the golfer isn't a likeness of the person in it.
- [GIVEN] **MVP visuals:** greyscale polygons. The golfer is a code-built low-poly rigged figure, and the generated golfer replaces it later (06).
- [ASSUMED] **Club models:** for the MVP, 5 head shapes (driver, fairway wood, hybrid, iron, wedge) plus one putter, built from parameters in code. They're replaced by the generated Callaway-styled models (06).

## 7. Mini map and rangefinder [GIVEN; built 2026-11-05]

- **Mini map:** always visible in a corner, oriented to the hole. It shows:
  - the hole layout (tee, fairway, rough, bunkers, water, green, pin)
  - every player's golfer and ball, in their player colours
- **Rangefinder:** `M` toggles the expanded mini map (the HUD shows "M: rangefinder"), a large top-down view of the traced hole with the tee, pin, your ball and golfer.
  - Hovering any point shows the distance from your ball and the distance from that point to the pin, in yards.
  - It also shows the elevation change, plus a club suggestion ("plays like" 7i) based on full-swing carries [ASSUMED].
  - [ASSUMED] Clicking sets a temporary target marker that shows on the mini map only, not in the 3D world, so the aim stays the golfer's job (§2.6).
  - [ASSUMED] While expanded, movement still works but swing mode can't start.

## Acceptance criteria

- **AC-S1:** All 14 keys select the matching club, and the HUD highlight updates within one frame.
- **AC-S2:** In swing mode WASD has no effect. Esc before the Space release cancels the swing.
- **AC-S3:** A perfect sequence played by script gives E = 0 and the club's maximum carry with under 1% curvature.
- **AC-S4:** The same press timings give the same ball result on the client and the server, because the server scores them.
- **AC-S5:** At 30 fps and 144 fps, identical key timings give an identical E.
- **AC-S6:** A perfect release at 25% with the 62 degree wedge carries 40 to 75 yd; a full swing is unchanged.
- **AC-S7:** Holding Space together with Z, X and C in any overlapping order loses no key (state-machine key-event tests).
- **AC-S8:** A putt released at length L has the speed of the old draw L x 1500 ms.
