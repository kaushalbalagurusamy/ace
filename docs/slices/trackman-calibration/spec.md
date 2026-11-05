# Slice: calibrate the ball physics to TrackMan (docs/research/trackman-physics.md)

Status: spec accepted 2026-11-05 (supervisor: calibration is its own slice, red tests first). Source of every number: `docs/research/trackman-physics.md` (P primary, S secondary, D derived, M modelled, U unverified); anything not sourced there is marked UNVERIFIED in `PRD/03`.

## What changes
Replace the placeholder constants in `src/sim` with the research models:
- **Impact (D-plane, §2):** start direction `H = (1-κ)·F + κ·P`; vertical launch `A + (1-κ)·SL`; spin axis tilt `atan2(cosL·sin(F-P), sin(L-A))`; spin `K·V·sin(SL)` with K per club; smash `smashBase·cos(SL)` so the tour rows reproduce. **Deviation from the doc, recorded:** κ = `0.23 + 0.004·(SL - 15°)` clamped to [0.12, 0.35] (the doc's `0.15 + ...` gives a driver launch of 11.6° where its own case 4 needs 10.4 ± 1; the doc's backed-out κ values are 0.23 driver and 0.27 6-iron).
- **Flight (§3):** `Cd` and `Cl` vs spin ratio S and Reynolds number (Set B for driver/woods, Set A otherwise, blended on S over 0.10 to 0.14), spin decay `dω/dt = -λ·v·ω/R` with λ = 2.0e-5, air density from temperature, elevation and humidity (`airDensity`), RK4.
- **Landing (§4):** Penner tilted-plane bounce with the rigid-body friction equations (tee-turf parameters), hops until the ball skids to roll, then a constant-deceleration roll tuned so a firm-fairway driver rolls 30 ± 4 yd; Stimp-based green roll (already in place).
- **Holing (§5):** capture speed `v_c(b) = max(0, 2·sqrt(R_h² - b²) - r)·sqrt(g/(2r))` (1.31 m/s centred), replacing the old flat 1.6 m/s.
- **Bag (§1):** per-club delivery from the 2024 PGA tour averages scaled to 130 mph driver speed (ratio of club speeds), driver +5° attack angle with a 16° dynamic loft, 3-wood +2° off the tee; the 18° club is a utility iron (3-iron row); wedges 50/54/62 extrapolated from the PW row by spin loft, **UNVERIFIED** (§1.5: no sourced wedge row exists).

## Acceptance criteria and the one check for each (validation cases = research §6)
| ID | Criterion | Check |
|---|---|---|
| TM-1 | Flight, PGA driver 2024: ball 171 mph, 10.4°, 2545 rpm gives carry 282 ± 6 yd, apex 35 ± 3, land 39 ± 3° | unit |
| TM-2 | Flight, prior-edition driver: 167, 10.9°, 2686 gives 275 ± 6, 32 ± 3, 38 ± 3° | unit |
| TM-3 | Flight, PGA 7-iron: 123, 16.1°, 7124 gives 176 ± 6, 34 ± 3, 51 ± 3° | unit |
| TM-4 | Impact, PGA driver: club 115, A -0.9°, SL 14.7° gives ball 171 ± 2 mph, launch 10.4 ± 1°, spin 2545 ± 250 | unit |
| TM-5 | Impact then flight, PGA 6-iron: club 94, A -3.7°, SL 24.3° gives ball 130 ± 2, launch 14.0 ± 1.5°, spin 6204 ± 400, carry 188 ± 7 | unit |
| TM-6 | Normalised driver: club 130, A +5°, dynamic loft 16° gives ball 196 ± 3, launch 13.8 ± 1°, spin 2160 to 2730, carry 326 ± 12, apex 58 to 61 yd (± 3), land 52 to 54° (± 3) | unit |
| TM-7 | 3-wood off the tee: club 110, A +2°, SL 10.2° gives ball 164 ± 3, launch 10.2 ± 1°, spin 2590 ± 300, carry 257 to 267 ± 8, land 37 to 42° ± 3 | unit |
| TM-8 | Denver (1609 m) carries further than sea level; 5 °C < 21 °C < 35 °C; sizes within ± 50% of +11 to +14 yd | unit |
| TM-9 | USGA/R&A ODS: (a) 176 mph, 10°, 2520 rpm and (b) 183 mph, 11°, 2220 rpm give carry plus roll between 300 and 320 yd | unit |
| TM-10 | Driver bounce and roll from landing 62.8 mph, 39.5°, 1982 rpm on firm fairway: 30 ± 4 yd | unit |
| TM-11 | PW landing 47 mph, 55°, 8200 rpm: net bounce plus roll between -5 and +3 yd; the same landing with 0 rpm rolls at least 8 yd | unit |
| TM-12 | Stimp 10 green: 1.83 m/s rolls 3.05 m ± 1% (AC-P3, tightened from 5%) | unit |
| TM-13 | Hole capture: centred 1.30 m/s holes, 1.35 does not; at b = 40 mm 0.75 m/s holes | unit |
| TM-14 | In-game bag: a perfect full swing's carries are ordered and plausible for the 130 mph game (driver 320 to 345 yd, PW 130 to 150, ordered by loft), and a full swing stays straight (< 1% offline) | unit |
| TM-15 | The server uses the sim's bounce and roll (one model): its total on a flat fairway equals the sim's total within 3% | unit (existing race test updated) |

## Not in this slice (stated limits)
Gear effect and off-centre smash loss (§2.4, §2.5: constants "not found"; the game keeps its E-based speed and smash penalties); wind; lip-out deflection (§5.3 "not found"); soft or wet turf variants; wedge distances beyond extrapolation.
