# 03: Ball physics and course

[GIVEN] Ball flight, turf interaction, lie, friction and roll follow established TrackMan-style physics, researched online. **The research is done:** `docs/research/trackman-physics.md` (cited below as R§n) holds every source, grade and formula, and its §6 validation cases run in CI (`tests/trackman.test.ts`, slice `docs/slices/trackman-calibration`). Anything with no source there is marked [UNVERIFIED].

## 1. Launch: impact to ball (D-plane model, R§2) — `impact()` in `src/sim/physics.ts`

**Inputs** from the swing (02 §3) and the club: club speed v_c, attack angle A, dynamic loft L, club path P, face angle F.

**Outputs:**
- **Spin loft:** the true 3-D angle between the path vector and the face normal (R§2.2), about L − A when square.
- **Ball speed** = v_c × smashBase × cos(SL) (R§2.4). smashBase = the tour row's smash ÷ cos(tour SL), so the tour rows reproduce exactly.
- **Launch angle** = A + (1 − κ)·SL, with κ = 0.23 + 0.004·(SL − 15°) clamped to [0.12, 0.35]. This deviates from the research's 0.15 base, which launches the R§6 case 4 driver at 11.6° instead of 10.4 ± 1°; the deviation is recorded in the slice spec.
- **Start direction** = (1 − κ_h)·F + κ_h·P, with κ_h = 0.15 for the driver and woods and 0.25 for irons (R§2.1; TrackMan newsletter, grade S).
- **Spin rate** = K·v_c·sin(SL) (R§2.3). K per club = tour spin ÷ (tour speed × sin tour SL): driver 87, irons about 160 to 180.
- **Spin-axis tilt** = atan2(cos L·sin(F − P), sin(L − A)) (R§2.2). Low spin loft curves more per degree of face-to-path.
- Not modelled (R§2.4, R§2.5 "not found"): gear effect and off-centre smash loss.

## 2. Speed normalisation [GIVEN] and the bag (R§1.1, PGA TOUR 2024 averages)

- **Driver:** 130 mph club speed with a +5° attack angle and a 16° dynamic loft off the tee (spin loft 11°, R§6 case 6).
- **3W off the tee:** +2° attack angle at its tour dynamic loft.
- **All other clubs, and the driver and 3W off the ground:** struck down with the PGA Tour-average delivery.
- [GIVEN Q6] Each club's speed is 130 mph × (that club's Tour-average speed ÷ 115 mph, the Tour driver).
- The 18° utility plays the 3-iron row.
- Dynamic loft, smashBase and K are backed out of each row by solving the launch equation of §1.

| Club | Tour club mph | Tour AoA | Smash | Launch | Spin (rpm) | Tour carry (yd) | Game club mph | Game carry / total (yd) |
|---|---|---|---|---|---|---|---|---|
| Driver (tee, +5°) | 115 | −0.9° | 1.49 | 10.4° | 2545 | 282 | 130 | 326 / 332 |
| Driver (fairway) | | | | | | | 130 | 322 / 335 |
| 3W (tee, +2°) | 110 | −2.3° | 1.47 | 9.3° | 3663 | 249 | 124.3 | 310 / 326 |
| 3W (fairway) | | | | | | | 124.3 | 299 / 308 |
| 18° UT (3i row) | 100 | −2.5° | 1.46 | 10.3° | 4404 | 218 | 113.0 | 253 / 256 |
| 4i | 98 | −2.9° | 1.44 | 10.8° | 4782 | 209 | 110.8 | 243 / 245 |
| 5i | 96 | −3.4° | 1.41 | 11.9° | 5280 | 199 | 108.5 | 230 / 231 |
| 6i | 94 | −3.7° | 1.39 | 14.0° | 6204 | 188 | 106.3 | 215 / 214 |
| 7i | 92 | −3.9° | 1.34 | 16.1° | 7124 | 176 | 104.0 | 196 / 194 |
| 8i | 89 | −4.2° | 1.33 | 17.8° | 8078 | 164 | 100.6 | 182 / 179 |
| 9i | 87 | −4.3° | 1.29 | 20.0° | 8793 | 152 | 98.3 | 167 / 163 |
| PW | 84 | −4.7° | 1.24 | 23.7° | 9316 | 142 | 95.0 | 148 / 143 |
| 50° [UNVERIFIED] | 81 | −5.1° | 1.19 | (model) 25.9° | (model) | none | 91.6 | 133 / 128 |
| 54° [UNVERIFIED] | 78 | −5.5° | 1.14 | (model) 28.3° | (model) | none | 88.2 | 117 / 112 |
| 62° [UNVERIFIED] | 72 | −6.3° | 1.04 | (model) 33.2° | (model) | none | 81.4 | 90 / 85 |

- **Wedges [UNVERIFIED]:** TrackMan publishes no wedge row (R§1.5). The 50°, 54° and 62° rows are extrapolated from the PW per degree of static loft along the 9i→PW trend: −0.75 mph, −0.1° attack angle and −0.0125 smash per degree. Dynamic loft rises degree for degree, and the PW's spin constant K is reused, so launch and spin come from the §1 model.
  - Wedge smash is held constant rather than following the cos(SL) law, because the cos(SL) law is fitted only on spin lofts of 15° to 26° (R§2.4). At a 61° spin loft it would cost 9% ball speed per 3° of added loft.
  - The only comparator is one player's Vokey fitting: 54°, 27° launch, 10,100 rpm (R§1.5, grade S, n = 1).
- **Driver:** 130 mph and +5° carries 326 yd, inside R§6 case 6 (326 ± 12, a model value, not a measurement). The +5° driver and +2° 3W differ from the Tour averages on purpose [GIVEN]: they raise launch and cut spin.
- **Swing length:** club speed × `lengthSpeedFactor` (PRD/02). The curve was retuned to (0.05, 0.25), (0.25, 0.62), (0.5, 0.76), (0.75, 0.86), (1, 1) so that a 25% 62° swing still carries 40 to 75 yd (AC-S6: 45 yd).

## 3. Flight (R§3) — `simulateShot()`

- **Forces** (Nathan's structure, R§3.1): gravity, drag −k·Cd·|v|·v and Magnus lift k·Cl·|v|·(ω̂ × v), with k = ρA/2m.
- **Coefficients** (R§3.2): Cd = Cd(Re) + CdS·S and Cl = a·S^p.
  - Cd(Re) is CdL at or below Re 5×10⁴, CdH at or above 10⁵, and linear in between.
  - **Set A** (irons and wedges): CdH 0.2213, CdS 0.1816, CdL 0.5038, Cl 0.4566·S^0.4005.
  - **Set B** (driver and woods): CdH 0.2149, CdS 0.0099, CdL 0.5038, Cl 0.2555·S^0.20.
  - The two sets blend on the launch spin ratio over 0.10 to 0.14.
  - These are fits made in the research to TrackMan carry, apex and land angle (grade M). The PGA driver row reproduces at 280.7 yd carry, 33.2 yd apex and a 39.5° land angle, against TrackMan's 282 / 35 / 39.
- **Spin decay** (R§3.3, Smits & Smith): dω/dt = −λ·v·ω/R with λ = 2.0×10⁻⁵. This replaces the old flat 3% per second.
- **Air** (R§3.4, Nathan): ρ from temperature, elevation, humidity and pressure (`airDensity`), and μ from Sutherland's law.
  - Game air is 21 °C, 50% RH, sea level, 760 mmHg (ρ = 1.194 kg/m³), with no wind in v1.
  - Denver carries further and warm air carries further (R§6 case 8).
- **Integration** [GIVEN design, R§3.5]: RK4 at a fixed 1/120 s step. That is finer than the 0.01 s the research recommends, chosen so the 60 Hz replay samples fall on whole steps. Landing is found by linear interpolation of the step that crosses the ground.
  - The server sends the client the whole trajectory, sampled at 60 Hz, in one message, and clients only replay it (register F-036, F-039).
- **Ball constants:** from the Rules of Golf (mass 45.93 g, radius 21.335 mm, cup radius 54 mm).

## 4. Lies [UNVERIFIED effects, not in the research]

| Lie | Speed × | Spin × | Launch | Notes |
|---|---|---|---|---|
| Tee (tee box only) | 1.00 | 1.00 | as delivered | Driver and 3W keep their up-AoA only here |
| Fairway | 1.00 | 1.00 | as delivered | Driver off the deck: Tour delivery (AoA −0.9°) |
| First cut | 0.97 | 0.85 | +0.5° | |
| Rough | 0.85 | 0.55 (flyer) | +1.5° | ±1.5° random face noise |
| Bunker | 0.75; non-wedges 0.55 | 0.60 | +2° | |
| Fringe / green | putter only is efficient; other clubs 0.9 | 1.0 | | |
| Slope (real elevation) | | | uphill: loft +1°/°, attack +0.5°/° (downhill the reverse) | side slope turns the face by atan(tan(loft)·sin(slope)): ball above the feet draws, below fades; the curve comes from the D-plane. See `docs/research/elevation.md` |

With the sourced aero, the rough's 0.55 flyer spin offsets most of its 0.85 speed loss: a 9i totals 163 yd from fairway and 153 yd from rough.

## 5. Bounce and roll (R§4) — `bounceRoll()`, one model for the sim and the server

- **Landing** (R§4.1, Biber, Jones et al. 2023, grade P): a rigid bounce with friction off a Penner tilted plane.
  - The plane is tilted by β = kP·(|v|/R)·φ.
  - Parameters are the natural tee-turf Penner fit: e = 0.222, μ = 0.999, kP = 2.973×10⁻⁴.
  - The ball hops until a rebound is slower than 0.3 m/s [design constant], then skids to roll at (5vx − 2Rω)/7.
  - A steep, high-spin wedge therefore checks or spins back: a PW landing at 47 mph, 55° and 8200 rpm nets −1.8 yd. The same bounce applies on every surface except the bunker, where the ball plugs. Green bounce parameters were paywalled (R§4.3).
- **Rolling:** constant deceleration on each surface.
  - **Fairway: 4.5 m/s²**, tuned so a tour driver landing (62.8 mph, 39.5°, 1982 rpm) bounces and rolls 30 yd. That is the firm-fairway field figure, 30 ± 4 yd (R§4.2, USGA/R&A, grade P). The research found no sourced fairway deceleration.
  - The game driver from the tee lands steeper (about 52°), so it rolls out only about 6 yd.
- **Green speed from the Stimpmeter** (R§4.3): a = (6 ft/s)² ÷ (2·Stimp). Stimp 10 gives 0.549 m/s², so 1.83 m/s rolls 3.05 m.

| Surface | Bounce | Rolling decel a (m/s²) |
|---|---|---|
| Green (Stimp 10) | Penner tee turf | 0.549 (R§4.3) |
| Fringe | Penner tee turf | 3.5 [UNVERIFIED: old placeholder ratio to fairway] |
| Fairway | Penner tee turf | 4.5 (tuned to R§4.2) |
| First cut | Penner tee turf | 8.0 [UNVERIFIED] |
| Rough | Penner tee turf | 16.1 [UNVERIFIED] |
| Bunker | plugs, no bounce | ball stops |
| Tree trunk | 0.30 bounce, no capture [UNVERIFIED] | |

**Known conflicts in the research's §6 targets** (kept as `it.fails` tripwires in `tests/trackman.test.ts`):
- **Case 9(b)**, the 2028 ODS condition: 183 mph, 11°, 2220 rpm carries 302.7 yd, and its hops alone are 16.9 yd. A total of 320 yd or less therefore needs almost no roll, which contradicts case 10. The research's own suggested 25 to 30 yd of roll gives about 328 yd. The game total is 324 yd.
- **Case 11's 0 rpm half** (a PW rolls at least 8 yd) was modelled at a roll deceleration of 1 to 3 m/s². At the 4.5 m/s² that case 10 needs, the PW rolls 7.2 yd. The game still checks the intent: the spinning PW releases at least 8 yd less than the spinless one.

## 6. Holing out (R§5) — `captureSpeed()`

- The ball drops if it crosses the cup at offset b from the centre below **v_c(b) = max(0, 2·√(R_h² − b²) − r)·√(g/2r)** (Penner, corrected by derivation in R§5.2).
  - That is 1.31 m/s centred and 0.78 m/s at 40 mm, falling to 0 at about 53 mm.
  - It replaces the old flat 1.6 m/s [UNVERIFIED] limit.
- A faster ball rolls on past the cup. Lip-out deflection is not modelled (R§5.3: "not found").
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

## 8. Sources (pulled: `docs/research/trackman-physics.md` §7)

1. TrackMan's published PGA and LPGA Tour averages per club (R§1): done; no wedge rows exist.
2. TrackMan's D-plane and ball-flight laws (R§2): done; the face/path split is grade S.
3. Golf-ball lift and drag against spin ratio and Reynolds number (R§3.2): done; fitted coefficient sets, grade M.
4. The USGA Stimpmeter definition (R§4.3): done.
5. Cup-capture speed against offset (R§5.2): done.
6. Still not found (R§7): wedge averages, gear-effect constants, off-centre smash loss, fairway rolling deceleration, green bounce parameters and lip-out laws.

## Acceptance criteria

- **AC-P1:** The research's §6 validation cases pass in CI with their stated tolerances (`tests/trackman.test.ts`, TM-1 to TM-14). The two known conflicts in §5 are recorded as tripwires.
- **AC-P2:** A 4° face-to-path error curves the ball the expected direction (right-hand golfer: open to the path curves right), and the curve gets bigger as the error grows.
- **AC-P3:** On flat Stimp 10, a putt starting at 1.83 m/s (6 ft/s) rolls 3.05 m ± 5% (TM-12 checks it to ± 1%).
- **AC-P4:** The same inputs and seed produce the identical trajectory every run, because the server owns the simulation.
- **AC-P5:** The solver passes all 18 holes of 100 random seeds.
