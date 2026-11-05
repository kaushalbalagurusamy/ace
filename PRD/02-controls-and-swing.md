# 02: Controls, bag and swing

## 1. The bag [GIVEN]

Players always have one club equipped. No golf bag is shown. Keys use `KeyboardEvent.code` so they work on any keyboard layout [ASSUMED].

| Key | Club (as given) | HUD label [OPEN Q9] | Loft | Delivery |
|---|---|---|---|---|
| 1 | Elyte TD 8° Driver | Driver | 8° [GIVEN] | +5° attack angle off the tee [GIVEN] |
| 2 | Elyte TD 3W | 3W | 15° [ASSUMED] | +2° off the tee [GIVEN]. Off the ground it's struck down [ASSUMED] |
| 3 | Apex 2025 UT 18° | 18° UT | 18° [GIVEN] | struck down, PGA delivery [GIVEN] |
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
3. [ASSUMED] Run speed is 9 m/s, so a 300-yard walk takes about 30 seconds. This speed is the main lever on race length (see 05).
4. [ASSUMED] Players can't walk into water or past out-of-bounds stakes. Trees block movement. Golfers pass through each other.
5. [GIVEN] Space within 2.5 m of the ball [ASSUMED distance] enters swing mode. A prompt shows "Space: address ball" when in range.
6. [GIVEN] **Aiming:** the mouse sets the aim direction, the way the camera faces. **No aim line or landing marker is drawn.** Pressing Space locks the aim. A shot planned on the rangefinder (§7) isn't guaranteed to match where the golfer faces. Lining up is part of the skill.

## 3. Swing mode

On Space, WASD is disabled [GIVEN]. The rest of the swing runs as a timed sequence:

| Phase | Who drives it | Duration [ASSUMED, calibrate] |
|---|---|---|
| Address: golfer sets up over the ball | automatic | 0.6 s |
| Takeaway and backswing to the top | automatic | 0.75 s |
| Transition: Z window opens | player | window ±150 ms around the top |
| Downswing: hips (Z), then shoulders (X), then release (C), each pressed and held | player | about 0.25 s from top to impact |
| Impact, follow-through, ball launch | automatic | 0.8 s |

- **Model** [GIVEN]: the swing is based on MCS (Wax Nation). A full hip turn and shoulder turn go to the top. On the downswing, the hips lead and pull the shoulders, and the wrists release once the arms drop into the slot.
- **Ideal timing:** the target offsets are parameters fitted to the reference clip once we have it [OPEN Q7]. The starting values below follow the general kinematic-sequence ordering of hips, then torso, then arms, then club [UNVERIFIED as exact numbers].
  - Z at the top of the backswing: t = 0.
  - X at Z + 60 ms.
  - C at Z + 150 ms, about 100 ms before impact.
- **Hold:** all three keys must stay held until impact. Letting go early counts as "bailing out" and is scored as if the key had never been pressed.
- **Missed key:** if a key isn't pressed by impact, the swing still finishes. It counts as a mishit with that key's maximum error. The ball always goes somewhere and there is never a whiff [ASSUMED].
- **Cancel:** Esc before the top cancels with no penalty [ASSUMED].

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

## 5. Putting [GIVEN: simple Z pendulum]

- With the putter equipped, Space within range enters putt mode. There is no automatic backswing.
- Holding Z draws the putter back and a meter fills over 1.5 s for maximum length. Releasing Z strikes the ball.
- Ball speed is proportional to the draw. Full draw is about 15 m/s, enough for roughly 25 m on Stimp 10 [ASSUMED].
- X and C do nothing.
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

## 7. Mini map and rangefinder [GIVEN]

- **Mini map:** always visible in a corner, oriented to the hole. It shows:
  - the hole layout (tee, fairway, rough, bunkers, water, green, pin)
  - every player's golfer and ball, in their player colours
- **Rangefinder:** expanding the mini map (key M, [ASSUMED]) turns it into a full-screen top-down rangefinder.
  - Hovering any point shows the distance from your ball and the distance from that point to the pin, in yards.
  - It also shows the elevation change, plus a club suggestion ("plays like" 7i) based on full-swing carries [ASSUMED].
  - [ASSUMED] Clicking sets a temporary target marker that shows on the mini map only, not in the 3D world, so the aim stays the golfer's job (§2.6).
  - [ASSUMED] While expanded, movement still works but swing mode can't start.

## Acceptance criteria

- **AC-S1:** All 14 keys select the matching club, and the HUD highlight updates within one frame.
- **AC-S2:** In swing mode WASD has no effect. Esc before the top cancels the swing.
- **AC-S3:** A perfect sequence played by script gives E = 0 and the club's maximum carry with under 1% curvature.
- **AC-S4:** The same press timings give the same ball result on the client and the server, because the server scores them.
- **AC-S5:** At 30 fps and 144 fps, identical key timings give an identical E.
