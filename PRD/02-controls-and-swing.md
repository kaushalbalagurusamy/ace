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

*Revised 2026-11-05 (owner decision Q13: the one-button swing; `docs/slices/simple-swing/spec.md`). Supersedes the earlier WASD movement, the Z/X/C timed downswing and "Space locks the aim".*

1. [GIVEN, owner 2026-11-05, swapped back] **Movement is W A S D**, on foot and in the cart. In the stance the **arrow keys** set the ball position (section 3): Up/Down forward/back, Right/Left away/closer.
2. [ASSUMED] Movement is relative to the camera. The mouse orbits a third-person camera.
3. [GIVEN, owner playtest] On-foot speed is **15 m/s**. Holding **Shift** is the **precise walk at 5 m/s** and also halves the look sensitivity (x0.5 on top of the saved setting) on foot and in the stance, for putting lines and fine aim. The arrow keys, Shift and the mouse combine; Shift is released on key-up or on losing focus. Config in `src/client/rules.ts`.
   - [GIVEN, owner 2026-11-05] **Chip stroke:** in the stance, a **Shift** tap (any club except the putter) toggles a chip: the golfer brings the feet together and uses a shoulder-only stroke. The whole meter spans **0-25%** of a full swing (length = 0.25 x hold / 750 ms, floored at 0.05), for four times finer control; there is no max effort. Holding Shift still slows the mouse for fine aim. The shot card shows "Effort: Chip".
4. [GIVEN, owner playtest] **Look speed:** the default is **1.75 times** the original 0.003 rad per pixel (the owner found 2.5 times too fast). A settings menu (gear icon, or Esc when not in a stance) has a "Camera sensitivity" slider from 0.5 to 4.0 in 0.05 steps with "Reset to default (1.75x)"; `,` and `.` step it by 10% with a toast and write the same saved setting (localStorage). A saved 2.5 that the player never adjusted moves to 1.75. Pointer lock asks for unadjusted movement first so a mouse and a trackpad scale the same (`src/client/sensitivity.ts`).
5. [ASSUMED] Players can't walk into water or past out-of-bounds stakes. Trees block movement. Golfers pass through each other.
6. [GIVEN, owner playtest] **Your ball is never lost:** a yellow beacon over your ball, an edge arrow with the distance in yards when it is off screen, a "Walk to your ball" hint, and after a penalty a large banner and the golfer moved to the ball. Out of bounds has a white boundary line and starts about 12 m beyond the traced land. A **pin indicator** (a red flag over the pin with "Pin N yd" from your ball, or an edge arrow of a different shape and colour when the pin is off screen) shows on foot and in the stance, hidden during ball flight and fading within about 30 yd of the pin.
7. [GIVEN] **Stance:** the first Space press within 2.5 m of the ball takes the stance: the golfer fixes to the ball and movement turns off. **The mouse stays live**: it keeps rotating the camera, and the aim and the golfer pivot around the ball (the ball does not move) until the backswing starts. **Club changes stay allowed** (keys 1 to 0, `-`, `=`, `O`, `P`) until the backswing starts; aim and ball position are kept, and switching to or from the putter swaps between putt and full-swing mode in place. Once Space is pressed and held, aim and club are locked until the shot resolves. **No aim line or landing marker is drawn** (owner decision). Esc in the stance, before the release, cancels with no penalty.
8. [GIVEN] A **heading arrow with a soft view cone** on the mini map and the rangefinder shows where the camera faces on foot and the **aim** in the stance (the same direction the shot uses); other players are small dots in their colours.

## 3. Swing mode (hold and release Space)

1. **Hold Space** (the second press, after the stance): the backswing turns at a fixed tempo; the meter fills and reaches **100% at 0.75 s** (`FULL_TURN_MS`). **Release** to hit. Releasing earlier is a partial shot; the length is continuous, 5% to 100%.
2. **Every shot has perfect delivery:** square face, neutral path, the club's normalised speed times the length curve (0.05 -> 0.18, 0.25 -> 0.5, 0.5 -> 0.68, 0.75 -> 0.86, 1 -> 1, interpolated) [ASSUMED, tunable]. Z, X and C are gone, with their timing and scoring.
3. **Ball position (stance only, resets to centre every shot):** `W`/`S` move the ball forward/back and `A`/`D` move it closer to/further from the body, **5 steps per axis (-2..+2)**, shown on a small HUD grid against the feet. Through the D-plane model (`docs/research/trackman-physics.md` section 2) [ASSUMED starting values, to tune]:
   - **Forward/back:** +1.5 degrees of dynamic loft per step: forward = higher launch, more spin loft and spin; back = lower, de-lofted, a penetrating flight.
   - **Away/closer:** +/-2 degrees of club path per step with the face square to the target, so face-to-path drives the curve: further from the body (`D`, +) = in-to-out = a **draw**; closer (`A`, -) = out-to-in = a **fade**. Start direction = (1 - kappa)*face + kappa*path with kappa 0.15 for woods and 0.25 for irons; spin axis tilt = 3 x (face - path).
4. **Max effort:** keep holding past full: the meter enters a red MAX zone. At **1.10 s** the swing **auto-releases** as a max-effort shot: **club speed x1.1** (the 130 mph driver swings 143 mph) at **75% accuracy**: random face and path errors (sigma 1.0 degrees each) from a **server-side RNG seeded per shot** [GIVEN, owner 2026-11-05: replaces +20% distance / 70% accuracy, which needed an unrealistic ~165 mph]. Releasing between 0.75 s and 1.10 s is a normal 100% shot.
5. **Lie and turf** (PRD/03 section 4) apply in the sim: first cut x0.97 speed, x0.85 spin, +0.5 degrees; rough x0.85, x0.55 spin (flyer), +1.5 degrees and a seeded +/-1.5 degree face noise; bunker x0.75 (x0.55 for non-wedges), x0.60 spin, +2 degrees; fringe/green with a non-putter x0.9. Off the ground the driver has a -1 degree attack angle instead of +5 (3-wood -2.9 instead of +2).
6. **Wire:** `shot {clubKey, aimDeg, holdMs, fb, io}`; the server derives length (`holdMs / 750`, clamped) and max effort (`holdMs >= 1100`), validates every range and rejects anything else.
7. **Cancel:** Esc in the stance or before the release cancels with no penalty; blur, a hidden tab or losing pointer lock cancels too, so a lost key-up can never fire a shot.

## 4. After the swing

- [ASSUMED] The camera follows the ball, then returns to the golfer.
- [ASSUMED] Movement unlocks once the ball comes to rest. The player can start walking while the ball is still rolling.
- [GIVEN] **Shot card:** after each shot, TrackMan-style stats show for 10 s: **carry, total and offline** (yards left or right of the aim line), club speed, ball speed, then **Ball: Fwd +n / Away +n** and **Effort: Normal or MAX**.
- [GIVEN] Every ball's tracer is visible to every player; each stays until that player's next shot.

## 5. Putting

- With the putter equipped: first Space press takes the stance; **hold Space** to draw the putter back; **release strikes**. Speed = 5.74 m/s x √length (length 0.05 to 1 from the hold, as for full swings), so roll distance is proportional to the hold. **No max effort:** holding past full caps at the maximum putt. Ball position does not apply. Esc before the release cancels.
- A full hold rolls about 30 m on Stimp 10 [ASSUMED, supervisor 2026-11-05]. The earlier 15 m/s full speed rolled 205 m once the Stimp roll model was calibrated, which made putting uncontrollable.
- A green slope overlay (arrows on a grid) shows within 10 m of the ball [ASSUMED].

## 6. Golfer animation

- [GIVEN] **Reference clip:** https://www.youtube.com/watch?v=zJpTTF4wr7s, the source for extracting the 3D golfer animation.
- [ASSUMED] **Extraction method:**
  1. Download the clip locally, for reference only.
  2. Step through it frame by frame, slowed down.
  3. Run 3D pose estimation (for example MediaPipe Pose landmarks) on the frames to get joint angles and the phase timings: address, takeaway, top (the Space release), impact, finish.
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
- **AC-S2:** On foot only W A S D move; in the stance the arrow keys set the ball position and move nothing. Esc before the release cancels the swing.
- **AC-S3:** A centre full swing is straight (under 1% curvature) and deterministic for every club.
- **AC-S4:** The server decides length and max effort from the reported hold time; the client never computes an outcome.
- **AC-S5:** Max-effort dispersion is seeded: the same seed gives the same shot, and over 500 seeded shots the offline spread is about 3 times the reference.
- **AC-S6:** A perfect release at 25% with the 62 degree wedge carries 40 to 75 yd; a full swing is unchanged.
- **AC-S7:** The swing state machine passes its key-event tests: stance steps and clamps, club and aim changes until the backswing, auto-release at 1100 ms, putter cap, Esc and abort.
- **AC-S8:** A putt released at length L has the speed of the old draw L x 1500 ms.
