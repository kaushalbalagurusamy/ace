# 03: Ball physics and course

[GIVEN] Ball flight, turf interaction, lie, friction and roll follow established TrackMan-style physics, researched online. **No web research has been done yet.** Every number below is a placeholder until a source is checked. The required sources are listed in §8.

## 1. Launch: impact to ball (D-plane model)

**Inputs** from the swing (02 §3) and the club:
- club speed v_c
- attack angle (AoA)
- dynamic loft
- club path
- face angle
- strike quality E

**Outputs:**
- ball speed = v_c × smash
- launch angle, which sits close to dynamic loft (TrackMan: launch is mostly determined by face) [UNVERIFIED ratio]
- launch direction, mostly from face angle with some influence from path [UNVERIFIED ratio]
- backspin from spin loft = dynamic loft − AoA
- spin axis tilt from face-to-path; this tilt is what curves the ball

## 2. Speed normalisation [GIVEN, with gaps]

- **Driver:** 130 mph club speed with a +5° AoA.
- **3W off the tee:** +2° AoA.
- **All other clubs:** struck down, with PGA Tour-average delivery.
- [GIVEN Q6] Each club's speed is 130 mph × (that club's Tour-average speed ÷ Tour-average driver speed).

The table below is **[UNVERIFIED] TrackMan PGA Tour averages, recalled from memory**. It must be checked against TrackMan's published table before use. The scaled column is club speed × 130/113.

| Club | Tour club speed (mph) | Tour AoA | Launch | Spin (rpm) | Tour carry (yd) | Scaled club speed (mph) |
|---|---|---|---|---|---|---|
| Driver | 113 | −1.3° (game uses +5°) | 10.9° | 2686 | 275 | 130 |
| 3W | 107 | −2.9° (game uses +2° off tee) | 9.2° | 3655 | 243 | 123 |
| Hybrid | 100 | −3.5° | 10.2° | 4437 | 225 | 115 |
| 4i | 96 | −3.4° | 11.0° | 4836 | 203 | 110 |
| 5i | 94 | −3.7° | 12.1° | 5361 | 194 | 108 |
| 6i | 92 | −4.1° | 14.1° | 6231 | 183 | 106 |
| 7i | 90 | −4.3° | 16.3° | 7097 | 172 | 104 |
| 8i | 87 | −4.5° | 18.1° | 7998 | 160 | 100 |
| 9i | 85 | −4.7° | 20.4° | 8647 | 148 | 98 |
| PW | 83 | −5.0° | 24.2° | 9304 | 136 | 95 |
| 50/54/62° | not in recalled table | to source | | | | about 92/89/85 [ASSUMED] |

- **Driver expectation:** at 130 mph and +5° AoA, my rough expectation is about 320 to 350 yards of carry [UNVERIFIED]. The simulation must compute this, not assume it.
- **AoA difference:** the game's +5° driver and +2° 3W differ from Tour averages on purpose [GIVEN]. They raise launch and cut spin, so those clubs carry further than the Tour numbers scaled up.

## 3. Flight

- [ASSUMED] Forces are gravity, drag ½ρC_dAv² and Magnus lift ½ρC_lAv² along the spin-axis cross velocity.
  - C_d and C_l are functions of the spin ratio (spin × radius ÷ speed), per published golf-ball aerodynamics [UNVERIFIED curve, to source].
  - Spin decays about 3% per second [UNVERIFIED].
  - Air is sea-level ISA (ρ = 1.225 kg/m³) with no wind in v1 [ASSUMED].
- [ASSUMED] The server integrates with RK4 at a fixed 240 Hz step and sends the client the whole trajectory, sampled at 60 Hz, in one message. Clients only replay it, so there is no cross-browser physics drift (register F-036, F-039).
- Ball constants are from the Rules of Golf: mass at most 45.93 g, diameter at least 42.67 mm. Cup diameter is 108 mm.

## 4. Lies [ASSUMED effects, calibrate after sourcing]

| Lie | Speed × | Spin × | Launch | Notes |
|---|---|---|---|---|
| Tee (tee box only) | 1.00 | 1.00 | as delivered | Driver and 3W keep their up-AoA only here |
| Fairway | 1.00 | 1.00 | as delivered | Driver off the deck: AoA −1°, +0.15 to E |
| First cut | 0.97 | 0.85 | +0.5° | |
| Rough | 0.85 | 0.55 (flyer) | +1.5° | ±1.5° random face noise |
| Bunker | 0.75; non-wedges 0.55 | 0.60 | +2° | |
| Fringe / green | putter only is efficient; other clubs 0.9 | 1.0 | | |
| Slope | | | launch shifts by the slope angle | sidehill shifts the aim by ±slope·0.5 |

## 5. Bounce and roll [ASSUMED values, method sound]

- **Landing:** on contact, the normal velocity is multiplied by −e (the surface's restitution). The tangential velocity and spin exchange through friction μ, so a ball landing steeply with high backspin checks or spins back.
- **Rolling:** rolling slows at a constant rate a on each surface, plus the slope term g·sinθ.
- **Green speed from the Stimpmeter:** the Stimpmeter releases a ball at 6 ft/s, so a green with Stimp S ft has a = 36 ÷ (2S) ft/s². Stimp 10 therefore gives a ≈ 0.55 m/s².

| Surface | e | μ | Rolling decel a (m/s²) |
|---|---|---|---|
| Green (Stimp 10) | 0.35 | 0.40 | 0.55 |
| Fringe | 0.35 | 0.45 | 1.1 |
| Fairway | 0.45 | 0.50 | 1.4 |
| First cut | 0.35 | 0.55 | 2.5 |
| Rough | 0.20 | 0.70 | 5.0 |
| Bunker | 0.05 | 0.90 | ball stops |
| Tree trunk | 0.30 bounce, no capture | | |

## 6. Holing out [ASSUMED model]

- The ball drops if it passes within 54 mm − 21 mm of the cup centre and is moving slowly enough.
- The maximum capture speed is 1.6 m/s at the centre [UNVERIFIED], falling linearly to 0 at the edge.
- A faster ball lips out with a deflection.
- There are no gimmes. Every hole must be holed.

## 7. Course

- [GIVEN] **First map:** Pebble Beach Golf Links, laid out from real course data. Layout, data sources and legal notes are in 06.
- [ASSUMED] **Pebble Beach and the solver:** Pebble Beach uses its real yardages. The completability solver below still runs on it.
- [ASSUMED] **Later maps:** the procedural generator described below is for maps after Pebble Beach and doesn't block the MVP.
- [ASSUMED] **Procedural holes:** 18 holes, par 72: 4 par 3s, 10 par 4s and 4 par 5s. Hole order and pars are fixed, and the layouts are procedural from a per-lobby seed.
- **Lengths** are scaled for 130 mph:
  - par 3: 160 to 250 yd
  - par 4: 380 to 500 yd
  - par 5: 560 to 680 yd
- **Hole parts:** each hole is built from a template (straight, dogleg left or right, split fairway, island green, forced carry over water). Each has a tee box, a fairway spline, first cut, rough, 1 to 4 bunkers, optional water, trees, a green with slope and a pin.
- **Completability check:** every generated hole is checked by a solver that plays scripted perfect swings with the bag. The green must be reachable within par − 2 full shots, and every fairway landing zone must be reachable. Seeds that fail are regenerated (register F-027).
- **Brief requirement:** at least two distinct tracks. The 18 different holes cover this, and the hole templates make them differ in layout and challenge.

## 8. Sources to pull before numbers are trusted

1. TrackMan's published PGA and LPGA Tour averages per club (club speed, AoA, launch, spin, carry).
2. TrackMan's D-plane and ball-flight-laws explanation: how launch direction and curve split between face and path.
3. Golf-ball lift and drag coefficients against spin ratio and Reynolds number, from peer-reviewed aerodynamics papers.
4. The USGA Stimpmeter definition (release speed, how green speed is measured).
5. Cup-capture speed research (maximum holing speed against offset).

## Acceptance criteria

- **AC-P1:** For each club, a perfect strike from a flat fairway is within ±5% of the sourced carry value scaled to 130 mph. This only applies once §8 sources replace the placeholders.
- **AC-P2:** A 4° face-to-path error curves the ball the expected direction (right-hand golfer: open to the path curves right), and the curve gets bigger as the error grows.
- **AC-P3:** On flat Stimp 10, a putt starting at 1.83 m/s (6 ft/s) rolls 3.05 m ± 5%.
- **AC-P4:** The same inputs and seed produce the identical trajectory every run, because the server owns the simulation.
- **AC-P5:** The solver passes all 18 holes of 100 random seeds.
