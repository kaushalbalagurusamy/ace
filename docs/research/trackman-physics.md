# Golf ball-flight physics: sourced calibration for Ace

Research date: 2026-11-05. Each number carries a source tag `[n]` (see §7). Grades: **P** = primary (publisher's own data or peer-reviewed or preprint text read in full), **S** = secondary (a reputable source that reports someone else's number, or an abstract only), **U** = unverified (a forum post, a garbled transcription, or a number I could not trace to its original). **D** = derived in this document from sourced inputs, with the derivation shown. **M** = output of the reference simulator built for this research (§3.6), not a measurement.

Units: mph, yd and rpm follow TrackMan practice. The physics sections use SI.

---

## 1. TrackMan Tour averages per club

### 1.1 PGA TOUR, current edition (2023 season, released 2 May 2024) [1][2] (P)

Read directly from TrackMan's own poster (`Tour-average-PGA-yards.jpg`, trackman.media/tour-averages). Method [1]: 40+ events and 200+ players, mostly PGA TOUR with some DP World Tour; competition and range data combined; stat holes run in opposite directions to cancel wind. The atmospheric normalisation used is **not published** (not found).

| Club | Club speed mph | Attack ° | Ball speed mph | Smash | Launch ° | Spin rpm | Max height yd | Land ° | Carry yd |
|---|---|---|---|---|---|---|---|---|---|
| Driver | 115 | -0.9 | 171 | 1.49 | 10.4 | 2545 | 35 | 39 | 282 |
| 3-wood | 110 | -2.3 | 162 | 1.47 | 9.3 | 3663 | 32 | 44 | 249 |
| 5-wood | 106 | -2.5 | 156 | 1.47 | 9.7 | 4322 | 33 | 48 | 236 |
| Hybrid 15-18° | 102 | -2.4 | 149 | 1.47 | 10.2 | 4587 | 31 | 49 | 231 |
| 3-iron | 100 | -2.5 | 145 | 1.46 | 10.3 | 4404 | 30 | 48 | 218 |
| 4-iron | 98 | -2.9 | 140 | 1.44 | 10.8 | 4782 | 31 | 49 | 209 |
| 5-iron | 96 | -3.4 | 135 | 1.41 | 11.9 | 5280 | 33 | 50 | 199 |
| 6-iron | 94 | -3.7 | 130 | 1.39 | 14.0 | 6204 | 32 | 50 | 188 |
| 7-iron | 92 | -3.9 | 123 | 1.34 | 16.1 | 7124 | 34 | 51 | 176 |
| 8-iron | 89 | -4.2 | 118 | 1.33 | 17.8 | 8078 | 33 | 51 | 164 |
| 9-iron | 87 | -4.3 | 112 | 1.29 | 20.0 | 8793 | 32 | 52 | 152 |
| PW | 84 | -4.7 | 104 | 1.24 | 23.7 | 9316 | 32 | 52 | 142 |

### 1.2 LPGA Tour, current edition (same release) [2] (P)

Method [1]: 30+ events and 150+ players, mostly LPGA with some LET. This edition has no 3-iron row.

| Club | Club mph | Attack ° | Ball mph | Smash | Launch ° | Spin rpm | Height yd | Land ° | Carry yd |
|---|---|---|---|---|---|---|---|---|---|
| Driver | 96 | +2.8 | 143 | 1.49 | 12.6 | 2506 | 26 | 36 | 223 |
| 3-wood | 92 | -0.8 | 135 | 1.47 | 11.6 | 2595 | 25 | 38 | 200 |
| 5-wood | 90 | -1.6 | 130 | 1.46 | 12.3 | 4320 | 25 | 43 | 189 |
| Hybrid 15-18° | 87 | -1.9 | 125 | 1.44 | 13.9 | 4504 | 25 | 45 | 178 |
| 4-iron | 82 | -1.7 | 118 | 1.43 | 13.9 | 4608 | 25 | 43 | 175 |
| 5-iron | 81 | -2.0 | 114 | 1.42 | 14.6 | 4966 | 25 | 45 | 166 |
| 6-iron | 80 | -2.3 | 111 | 1.41 | 16.7 | 5904 | 25 | 46 | 155 |
| 7-iron | 78 | -2.5 | 106 | 1.38 | 18.5 | 6630 | 26 | 47 | 143 |
| 8-iron | 76 | -2.8 | 102 | 1.36 | 20.8 | 7413 | 27 | 47 | 133 |
| 9-iron | 74 | -3.2 | 95 | 1.30 | 23.5 | 7605 | 27 | 48 | 123 |
| PW | 72 | -3.2 | 88 | 1.25 | 25.2 | 8465 | 27 | 48 | 111 |

(The 3-wood spin of 2595 rpm is anomalously low against the 5-wood's 4320 rpm. It is transcribed exactly as TrackMan printed it.)

### 1.3 Previous edition (the "113 mph" table)

Source: TrackMan support-site PDFs [3] (P). The PDF files were created on 16 July 2020. Golf Magic labels the data "2019 season" [4] (S). The same driver row (113 / 167 / 10.9° / 2686 / 275) circulates with older dates, so the edition label is **unverified**.

PGA TOUR (yards poster):

| Club | Club | AoA | Ball | Smash | Launch | Spin | Height | Land | Carry |
|---|---|---|---|---|---|---|---|---|---|
| Driver | 113 | -1.3 | 167 | 1.48 | 10.9 | 2686 | 32 | 38 | 275 |
| 3-wood | 107 | -2.9 | 158 | 1.48 | 9.2 | 3655 | 30 | 43 | 243 |
| 5-wood | 103 | -3.3 | 152 | 1.47 | 9.4 | 4350 | 31 | 47 | 230 |
| Hybrid | 100 | -3.5 | 146 | 1.46 | 10.2 | 4437 | 29 | 47 | 225 |
| 3-iron | 98 | -3.1 | 142 | 1.45 | 10.4 | 4630 | 27 | 46 | 212 |
| 4-iron | 96 | -3.4 | 137 | 1.43 | 11.0 | 4836 | 28 | 48 | 203 |
| 5-iron | 94 | -3.7 | 132 | 1.41 | 12.1 | 5361 | 31 | 49 | 194 |
| 6-iron | 92 | -4.1 | 127 | 1.38 | 14.1 | 6231 | 30 | 50 | 183 |
| 7-iron | 90 | -4.3 | 120 | 1.33 | 16.3 | 7097 | 32 | 50 | 172 |
| 8-iron | 87 | -4.5 | 115 | 1.32 | 18.1 | 7998 | 31 | 50 | 160 |
| 9-iron | 85 | -4.7 | 109 | 1.28 | 20.4 | 8647 | 30 | 51 | 148 |
| PW | 83 | -5.0 | 102 | 1.23 | 24.2 | 9304 | 29 | 52 | 136 |

LPGA (previous edition, yards) [3]: Driver 94 / +3.0 / 140 / 1.48 / 13.2 / 2611 / 25 / 37 / 218; 3W 90 / -0.9 / 132 / 1.48 / 11.2 / 2704 / 23 / 39 / 195; 5W 88 / -1.8 / 128 / 1.47 / 12.1 / 4501 / 26 / 43 / 185; 7W 85 / -3.0 / 123 / 1.46 / 12.7 / 4693 / 25 / 46 / 174; 4i 80 / -1.7 / 116 / 1.45 / 14.3 / 4801 / 24 / 43 / 169; 5i 79 / -1.9 / 112 / 1.43 / 14.8 / 5081 / 23 / 45 / 161; 6i 78 / -2.3 / 109 / 1.41 / 17.1 / 5943 / 25 / 46 / 152; 7i 76 / -2.3 / 104 / 1.38 / 19.0 / 6699 / 26 / 47 / 141; 8i 74 / -3.1 / 100 / 1.33 / 20.8 / 7494 / 25 / 47 / 130; 9i 72 / -3.1 / 93 / 1.32 / 23.9 / 7589 / 26 / 47 / 119; PW 70 / -2.8 / 86 / 1.28 / 25.7 / 8403 / 23 / 48 / 107.

### 1.4 Changes between editions (PGA, 2024 release minus previous edition)

- Driver: club speed +2 mph, ball speed +4, smash +0.01, launch -0.5°, spin -141 rpm, attack angle +0.4°, apex +3 yd, land angle +1°, carry +7 yd. TrackMan's own summary [1]: "higher ball speed and lower spin rate on driver".
- Irons: club speed +2 mph on every iron, ball speed +2 to +3 mph, attack angle about 0.2-0.4° shallower, carry +4 to +6 yd (PW +6). Apex is 1-3 yd higher throughout.
- The new edition lists the hybrid's loft range ("15-18°"). The old LPGA table had a 7-wood row; the new one has a hybrid row.

### 1.5 Wedges (50 / 54 / 58-60°): not found

TrackMan publishes no tour-average wedge row in either edition. Closest sourced data:

- TrackMan Optimizer standard PW case [6][7] (P): 72 mph club speed, mid trajectory, spin loft 40.6°, launch 26.7°, spin 8,408 rpm.
- One player's Vokey fitting [33] (S, n=1): 54°: launch 27°, 10,100 rpm, carry 104 yd. 58°: launch 28°, 9,285 rpm.

Best-supported range for the game: extrapolate from PW using spin loft (§2.3, §2.4). Do not invent a tour row.

### 1.6 Other TrackMan reference numbers

- Spin loft, tour averages [5] (P): PGA driver 14.7°, PGA 6-iron 24.3°; LPGA driver 15.0°, LPGA 6-iron 25.9°.
- Optimizer standard cases [5][6][7] (P):

| Case | Club speed | Attack | Spin loft | Launch | Spin |
|---|---|---|---|---|---|
| Driver, optimised carry | 94 mph | 0° | 15.6° | 13.6° | 2,772 rpm |
| 6-iron, mid trajectory | 80 mph | not stated | 25.5° | 16.9° | 5,956 rpm |
| PW, mid trajectory | 72 mph | not stated | 40.6° | 26.7° | 8,408 rpm |

- Driver spin loft from the TrackMan Combine [5] (P): scratch 14.8°, 5 handicap 15.8°, 10 handicap 17.3°, average golfer 18.3°.
- TrackMan's "Normalization" feature assumes calm air, a user-entered altitude and temperature, and a premium ball [34] (S).

---

## 2. Impact model (D-plane)

Conventions: angles in degrees, positive = right or up. F = face angle, P = club path, A = attack angle, L = dynamic loft. TrackMan defines spin loft as the 3-D angle between the club's direction of travel (A, P) and the face normal (L, F). It is "approximately" L - A, and the gap grows as face-to-path moves away from zero [5] (P).

### 2.1 Start direction: face versus path

Rule of thumb from the January 2009 TrackMan newsletter (F. Tuxen), reported second-hand: horizontal launch is about **85% face, 15% path for a driver**, and about **75% face, 25% path for irons** [9][10] (S). TrackMan's current blog gives no percentages [8].

```
H_launch = (1 - κ)·F + κ·P        κ_driver ≈ 0.15,  κ_iron ≈ 0.25          (S)
```

The vertical plane obeys the same physics. The ball leaves between the face normal and the path, closer to the face normal:

```
V_launch = A + (1 - κ)·SL         (SL = spin loft)                          (D)
```

κ backed out of the TrackMan data (D): PGA driver 0.23, PGA 6-iron 0.27, Optimizer driver 0.13, LPGA driver 0.35. These are noisy because the published spin loft is the 3-D value, which includes face-to-path scatter. Use **κ = 0.15 + 0.004·(SL - 15°)**, clamped to [0.12, 0.35]. That gives 0.15 at a driver's spin loft and about 0.19-0.25 for mid-irons. It is a design choice, not a published fit (D).

### 2.2 Spin axis (curvature) from the D-plane

The spin axis is normal to the D-plane, the plane that contains the club-path vector p and the face normal n (TrackMan's 3-D spin-loft definition [5]). Implement it exactly, not with a 2-D approximation (D):

```
p  = (cosA·cosP, cosA·sinP, sinA)          # x = target, y = right, z = up
n  = (cosL·cosF, cosL·sinF, sinL)
SL3D = acos(p·n)                           # true spin loft
axis = normalize(p × n)                    # spin vector direction (backspin about -y)
tilt = atan2( cosL·sin(F-P) , sin(L-A) )   # small-angle spin-axis tilt; + = fade/slice (right)
```

Consequence: for the same 2° face-to-path, a driver (SL 14.7°) gets a tilt of about 7.6°, while a 7-iron (SL about 25°) gets about 4.3°. Low spin loft curves more per degree of face-to-path (D).

### 2.3 Spin rate versus spin loft and club speed

TrackMan states qualitatively that spin rises with spin loft and with club speed, all else equal [5][6] (P). No closed-form formula is published (not found). Empirical form fitted to the seven TrackMan points that carry both spin loft and spin (D):

```
spin_rpm = K · V_club_mph · sin(SL3D)
```

| Data point | V mph | SL ° | Spin | K = spin/(V·sinSL) |
|---|---|---|---|---|
| PGA driver 2024 | 115 | 14.7 | 2545 | 87 |
| LPGA driver 2024 | 96 | 15.0 | 2506 | 101 |
| Optimizer driver | 94 | 15.6 | 2772 | 110 |
| PGA 6-iron | 94 | 24.3 | 6204 | 160 |
| LPGA 6-iron | 80 | 25.9 | 5904 | 169 |
| Optimizer 6-iron | 80 | 25.5 | 5956 | 173 |
| Optimizer PW | 72 | 40.6 | 8408 | 179 |

- Use **K_driver/woods ≈ 87-110** (87 reproduces PGA tour spin; tour players strike high on the face, so vertical gear effect lowers spin) and **K_irons/wedges ≈ 160-180**. Interpolate K by club loft.
- A single power law, spin = a·V^p·SL^q, fits worse (errors of -15% to +19%), so do not use one.
- Rigid-ball "roll-off-the-face" theory (ω = v_t/r with v_t = (2/7)·V·sinSL/(1+2m/7M)) predicts about 1,300 rpm for a tour driver, roughly half of what is measured. Do not use it uncalibrated (D).

### 2.4 Smash factor versus spin loft and strike quality

Impact theory gives smash = (1+e)·cos(SL)/(1+m/M). TrackMan's centred-strike data collapse onto one constant (D):

```
smash ≈ S0 · cos(SL3D),   S0 = 1.54 (PGA driver 1.540, PGA 6i 1.525, LPGA driver 1.543, LPGA 6i 1.568)
```

- Model the spin-loft penalty as cos(SL) on top of the club's tabled smash, so the table rows reproduce exactly.
- **Off-centre strike, not found**: no published smash-loss-per-cm figure was traceable. A Golf Digest robot test reports carry loss at 3/4 in toe and heel off 95 mph swings, but gives no smash data [32] (S).
- Physics form (D): replace M with the effective mass M_eff = 1/(1/M + d²/I_head) for an offset d from the centre of gravity, and drop e toward the face edge. Head mass and MOI are not sourced here. The USGA MOI limit of about 5900 g·cm² for drivers is **unverified in this session**. Calibrate so the penalty matches the game's feel.

### 2.5 Gear effect (brief)

Penner (AJP 69:1073, 2001) and Nathan & Cross (AJP 75:658, 2007) are cited for gear effect [30], but I did not read them (S).

Behaviour to implement:

- **Toe strike**: the head yaws open, and the ball takes a draw-tilted spin axis plus slightly less spin.
- **Heel strike**: fade tilt.
- **High-face strike**: less backspin and a higher launch.
- **Low-face strike**: more spin and a lower launch.

Bulge and roll partly cancel the start-direction error. Form (D):

```
tilt_gear  = -k_h · d_horiz        Δspin_gear = -k_v · d_vert · spin
```

k_h and k_v are **not found** and must be tuned (designer constants).

---

## 3. Flight aerodynamics

### 3.1 Forces (Nathan calculator structure [11], P)

```
S   = r·ω / |v_rel|                      (spin parameter)
Re  = ρ·|v_rel|·2r / μ_air
a   = -k·Cd·|v_rel|·v_rel  +  k·Cl·|v_rel|·(ω̂ × v_rel)  +  g
k   = ρ·A / (2m),  A = π r²
```

Ball constants:

- Rules ball: diameter ≥ 1.680 in (42.67 mm), mass ≤ 1.620 oz (45.93 g) [29] (S).
- Nathan's sheet uses 1.62 oz and a circumference of 5.277 in, so r = 21.33 mm [11].

### 3.2 Drag and lift coefficients

Published data and models:

- **Bearman & Harvey (1976)** [14] (S, via secondary): wind tunnel, Re 40k-240k, S 0.02-0.3. Cl rises monotonically from about 0.08 to 0.25. Cd rises above S ≈ 0.1, from about 0.27 to 0.32. Both are Re-independent for 126k < Re < 238k.
- **Smits & Smith (1994)** [13] (S): Re 40k-250k, S 0.04-1.4. Lift is about 0.04 above Bearman & Harvey's hexagonal-dimple ball. Drag depends more strongly on spin, and includes a sinusoidal Re term for drag falling above about 2×10⁵: `Cd = Cd1 + Cd2·S + Cd3·sin(π(Re-A1)/A2)`. The coefficients appear only in garbled patent transcriptions (U).
- **WSU (2018), 13 production balls** [15] (S, abstract only): 18-91 m/s, 1500-4500 rpm. Ball-to-ball Cd difference is >0.1 at Re < 10⁵ and <0.05 above. Cl is a 2nd-order polynomial in spin. Carry varies by 18 m across ball models.
- **Nathan calculator v2 (Feb 2025)** [11] (P, formulas read from the xlsx):

  ```
  Cd = CdL                          if Re ≤ 0.5e5
     = linear CdL→CdH               if 0.5e5 < Re < 1.0e5
     = CdH                          if Re ≥ 1.0e5
     + CdS·S
  Cl = ClAmp · S^0.4
  ```

  The shipped "solver-fitted" values are CdS = 0.2087, CdL = 1.9451, CdH = 0.1325, ClAmp = 0.2294. A parked default column holds 0.18 / 0.54 / 0.217 / 0.5.

**Finding (M):** the shipped fitted set hits driver carry (279.5 yd against 282) but gives an apex of 20 yd (TrackMan 35) and a land angle of 22° (TrackMan 39). It also collapses on irons: CdL = 1.95 at low Re, so the PW carries 101 yd against 142. It was fitted to carry only. **Do not use it for shape.**

**Recommended coefficient sets.** I fitted these to TrackMan carry, apex and land angle using the reference simulator of §3.6, with λ = 2.0e-5 and RK4 (M):

| Set | CdH (Re≥1e5) | CdS | CdL (Re≤0.5e5) | Cl | Use |
|---|---|---|---|---|---|
| **A, all clubs** | 0.2213 | 0.1816 | 0.5038 | 0.4566·S^0.4005 | irons, hybrids, wedges |
| **B, driver/woods** | 0.2149 | 0.0099 | 0.5038 | 0.2555·S^0.20 | driver and woods off the tee (S ≲ 0.10) |

Fit quality:

- Set A on the PGA 2024 table: carry RMS 5.0 yd. Every club from 3-wood to 9-iron is within ±7 yd and apex within ±3 yd. The driver is -13 yd and lands 5° too steep. The PW is -10 yd.
- Set B on the three TrackMan driver rows: carry within +3.5/-1.2 yd, apex within 2 yd, land angle within 1.5°.
- At S = 0.074 (a tour driver), set B gives Cd ≈ 0.216 and Cl ≈ 0.153. At S = 0.1, set A gives Cd ≈ 0.239 and Cl ≈ 0.182. Both sit inside Bearman & Harvey's ranges.
- Implementation: blend between the two sets on S over 0.10-0.14, or select by club.
- **Keep Cd independent of Re above 1×10⁵.** A fitted Re slope improved carry but made carry *fall* with altitude and *rise* in cold air, which is unphysical (M).

### 3.3 Spin decay in flight

Smits & Smith and Tavares (reviewed by Nathan [12], P for the model and S for the golf data):

```
SRD ≡ ω̇·R²/v² = -λ·S   →   dω/dt = -λ·v·ω / R,     λ = 2.0e-5 (Smits) | 2.5e-5 (Tavares)
τ = R/(λ·v)   → 23.8 s (Smits) / 19.1 s (Tavares) at v = 44.7 m/s
```

- At driver launch (76 m/s) τ ≈ 14 s. Over a 7 s flight, a 2545 rpm drive lands with about 2000 rpm, a loss of about 22% (M).
- Moment form: I·ω̇ = -R·ρ·A·C_M·v², with C_M = β·S, β = 0.010 (Smits) or 0.012 (Tavares) [12].
- Carry sensitivity (M): with no decay the driver carries +0.8 yd; with the Tavares λ it carries -0.2 yd. Decay matters little for carry but does matter for landing spin.

### 3.4 Air density

Nathan's formula [11] (P). T in °C, elevation in m, RH in %, P in mmHg:

```
SVP = 4.5841·exp((18.687 - T/234.5)·T/(257.14 + T))                 [mmHg]
ρ   = 1.2929 · (273/(T+273)) · (P·exp(-1.217e-4·elev) - 0.3783·RH·SVP/100) / 760   [kg/m³]
μ   = 1.512e-6 · (T+273.16)^1.5 / (T+273.16+120)                      [Pa·s, Sutherland]
```

- Checks: 15 °C, dry air, 760 mmHg gives 1.2255 kg/m³ (ISA 1.225). Nathan's default (21.1 °C, 50% RH) gives 1.1944 (M).
- Altitude scale height = 1/1.217e-4 = 8217 m, so ρ falls about 3.6% per 1000 ft.
- Temperature: ρ ∝ 273/(T+273).

Model sensitivity (set A, M): Denver (1609 m) +13.8 yd driver carry; 5 °C -2.9 yd; 35 °C +1.8 yd. The size is not sourced, only the direction. Treat these as sign tests (§6).

### 3.5 Integration

- Nathan uses dt = 0.01 s with a 2nd-order Taylor position update [11].
- **Recommendation: RK4 at dt = 0.01 s** on the server, with the state (x, v, ω) and spin decay integrated as an ODE.
- Convergence (M): driver carry changes by <0.001 yd between dt = 0.001 and dt = 0.02 s. dt = 1/60 s is also fine.
- Detect landing by linear interpolation of the step that crosses z = 0.
- A wind field enters through v_rel = v - v_wind. Nathan applies wind only above a height h_wind [11].

### 3.6 Reference simulator

The reference simulator is the Nathan v2 force model plus RK4, with the decay ODE and the coefficient sets above. It reproduces Nathan's own sheet: 160 mph, 11°, 3000 rpm, 70 °F gives 259.0 yd against the sheet's 259.3 yd when run with Nathan's shipped coefficients (M). Scripts are in the session scratchpad. They are not committed.

---

## 4. Landing, bounce and roll

### 4.1 Rigid bounce with friction

Source: Biber, Jones (R&A), Champneys, Green, Szalai 2023 [17] (P), eq. 5, written here in SI.

Conventions: vx > 0 forward, vy < 0 incoming, ω > 0 backspin, contact-point slip u = vx + R·ω.

```
J = (1+e)·vy                    (negative)
if  u/(-vy) >  3.5·μ·(1+e):   vx' = vx + μJ ;   Rω' = Rω + 2.5·μJ          (slips throughout)
elif u/(-vy) < -3.5·μ·(1+e):  vx' = vx - μJ ;   Rω' = Rω - 2.5·μJ
else:                          vx' = (5vx - 2Rω)/7 ;  Rω' = -vx'           (grips → leaves rolling)
vy' = -e·vy
```

**Penner's tilted-plane extension** [17][19]: bounce off a rigid plane rotated toward the incoming ball by an angle β. Rotate (vx, vy) into the tilted frame, apply the equations above, then rotate back. This is what makes backspin produce check and spin-back.

```
β = kP · s · φ ,  s = |v_in| / R  (ball radii per s),  φ = landing angle (rad)  → β in rad
```

Fitted values [17] (P), from more than 1000 bounces:

| Turf | Model | e (r) | μ | β | Error δ |
|---|---|---|---|---|---|
| Natural tee turf (Campaign B) | rigid | 0.260 | 0.998 | 0 | 35% |
| | Penner | 0.222 | 0.999 | kP = 2.973e-4 | 21% |
| | fixed β | 0.147 | 0.998 | 18.4° | 19% |
| Artificial turf (Campaign A) | rigid | 0.544 | 0.997 | 0 | 32% |
| | Penner | 0.448 | 0.969 | kP = 1.543e-4 | 25% |
| | fixed β | 0.420 | 0.852 | 12.9° | 19% |

Caveats [17][18]:

- No physics model fits well. Most of the error is in the tangential velocity and spin; the normal error is five times smaller.
- Balls that grip usually leave *slipping with reversed spin* rather than rolling.
- A piecewise-affine fit was five times better, but it is non-physical.
- Penner's velocity-dependent COR (e = 0.510 - 0.0375v + 0.000903v² for v ≤ 20 m/s, 0.120 above) reached me only via a search-result paraphrase, so it is **U**.
- Penner's numeric θc coefficients: **not found**.

Penner-model results (M), with Campaign B Penner parameters, hops without aero, then a skid-to-roll transition v = (5vx - 2Rω)/7:

| Landing (from flight model) | 1st bounce out | Bounce + roll |
|---|---|---|
| Driver 62.8 mph, 39.5°, 1982 rpm | β 15.5°, vx 8.5, vy 7.7 m/s, spin -4588 rpm (topspin) | 34-57 yd for roll decel 3→1 m/s² |
| 7-iron 49.5 mph, 51.8°, 6043 rpm | vx 0.8 m/s | ≈ 1 yd (stops) |
| PW 47.4 mph, 55.2°, 8177 rpm | vx -1.65 m/s (spins back) | -2 to -5 yd |
| PW, same landing, 0 rpm | — | +8 to +17 yd |

### 4.2 Driver roll-out, field data

From the USGA/R&A agronomy report [20] (P):

- **PGA TOUR 2007** (ShotLink + TrackMan, 19 venues), drives in the fairway: **30.1 ± 3.5 yd** bounce and roll [20][21].
- **USGA 2018 launcher tests** at high-quality courses (624 shots; inbound 32/38/44/50°; 1800 rpm): **17.8 ± 13.3 yd**.
- Spin from <1000 to >3000 rpm made "little observable difference" to roll [20].
- Soil moisture is the dominant factor. A 0.15-0.2 in irrigation cycle (+5-8% soil moisture) cut roll by **7.7 yd** on average, and by **>12 yd at a 32° inbound angle** (<5 yd at 38-50°).
- Mowing height: -2.23 yd per increment (model) and -3.1 yd for 0.400 → 0.450 in. Down-grain versus against-grain: +10.9 yd on zoysia.
- Bermudagrass rolled 17.4 yd less than adjacent bentgrass.
- Historical: 1949 US Open 28.3 yd, 1953 21 yd.

**Game targets (D):**

| Fairway | Bounce + roll |
|---|---|
| Firm (tour) | 30 ± 4 yd |
| Typical | 18 yd |
| Soft / wet | 8-12 yd |
| Shallow landing (≤ 32°) | sensitive; add roll |

Fairway rolling deceleration: **not found**. With Penner tee-turf bounce, a constant roll decel of about **3 m/s² (μ_eff ≈ 0.3)** gives about 34 yd for the tour drive. Tune it to the targets above.

### 4.3 Greens and the Stimpmeter

- **Stimpmeter** (USGA, 1982) [23] (P): a 36 in aluminium bar with a V-groove and a ball-release notch 30 in from the tapered end. The ball releases at about 20° [24] (S); one patent says 20.2°.
- Release speed 6.00 ft/s = 1.83 m/s [24] (S). A forum derivation gives 7.96 ft/s (U).
- Reading = average roll in feet: 3 balls each way, averaged.
- USGA 1982 ranges [23] (P):

  | Speed | Regular play | Tournament |
  |---|---|---|
  | Fast | 8'6" | 10'6" |
  | Medium-fast | 7'6" | 9'6" |
  | Medium | 6'6" | 8'6" |
  | Medium-slow | 5'6" | 7'6" |
  | Slow | 4'6" | 6'6" |

- Masters 1982 averaged 11.48 ft [23].
- Modern tour green speeds: **not found** in a primary source. A patent gives 6-14 ft for slow to fast [24] (S).
- Constant-deceleration green model (D, assuming uniform rolling resistance):

  ```
  a_green = v0² / (2·D_stimp),  v0 = 1.83 m/s
  ```

  | Stimp | Decel | μ_eff |
  |---|---|---|
  | 8 ft | 0.687 m/s² | 0.070 |
  | 10 ft | 0.549 m/s² | 0.056 |
  | 12 ft | 0.458 m/s² | 0.047 |
  | 13 ft | 0.423 m/s² | 0.043 |
  | 14 ft | 0.392 m/s² | 0.040 |

- Rolling resistance actually varies with speed. On 3 of 4 surfaces it fell as the ball slowed [31] (S, abstract). A constant value is adequate for a game.
- Putt skid (classic rigid body, D): a ball struck with no spin skids, then rolls at v = (5/7)·v0. Green sliding μ: **not found**.
- Bounce on greens: the Sports Engineering 2023 paper [17] fits green bounce, but its numbers were paywalled (not found). Use Campaign B (tee turf) values with lower e for soft greens.

---

## 5. Putting and holing

### 5.1 Dimensions

- **Hole**: 4¼ in (108 mm) diameter, at least 4 in (101.6 mm) deep. A liner must be sunk ≥ 1 in (25.4 mm) below the surface, with outer diameter ≤ 108 mm (Rules of Golf, "Hole" definition) [29] (S, the exact wording widely reproduced).
- **Ball**: diameter ≥ 1.680 in (42.67 mm), mass ≤ 1.620 oz (45.93 g) [29] (S).
- Physics constants: R_h = 0.054 m, r = 0.021335 m.

### 5.2 Capture speed

Penner (2002) [27] (S). The Stan case-study transcription [28] has the formula wrong (√(g/2R)). The form below is checked by derivation (free-fall of one ball radius while crossing 2R - r), and it reproduces the published 1.31 m/s:

```
v_c(0) = (2R_h - r) · sqrt(g / (2r)) = 1.314 m/s
```

The 1.31 m/s figure is also cited by Sheppard, Hurrion & Collinson 2016 [25] (S) as "Holmes 1991". Holmes 1991 [26] analysed lip-outs and rim bounce, and a Korean paper cites "≈1.6 m/s" from it (U). The higher value plausibly counts back-wall rebounds that still drop.

Offset b from the hole centre (D, geometric extension using the chord 2√(R_h² - b²)):

```
v_c(b) = max(0, 2·sqrt(R_h² - b²) - r) · sqrt(g/(2r)),   capture requires |b| < R_h
```

| b (mm) | 0 | 10 | 20 | 30 | 40 | 45 | 50 | 52 |
|---|---|---|---|---|---|---|---|---|
| v_c (m/s) | 1.31 | 1.29 | 1.20 | 1.04 | 0.78 | 0.58 | 0.30 | 0.12 |

Cross-check: at an entry speed of 0.65 m/s the formula gives a capture half-width of 43 mm, a 20% loss. Sheppard et al. measured an effective-hole reduction of about 25% at 0.65 m/s and about 4% at 0.23 m/s [25] (S). Consistent.

Measured entry speeds [25] (S):

- 3° slope, Stimp 10: uphill 0.66 m/s, downhill 0.29 m/s.
- Recommended finishing distance past the hole: 30 cm (PGA manual), 17 in (Pelz), 9 in (Aimpoint).

### 5.3 Lip-out behaviour

- Quantitative lip-out laws: **not found** in a primary source. Holmes 1991 [26] is the reference, and its contents are unverified here.
- Implementable rule (D):
  - The ball is over the hole while |b(t)| < R_h. Gravity acts from the moment the centre passes the near edge.
  - If the ball's centre has dropped ≥ r by the time it reaches the far rim, it is holed.
  - If not, collide the ball with the far rim edge, treated as a point at distance R_h. Use the bounce of §4.1 with e ≈ 0.4 (not sourced) against the rim normal. A tangential hit near |b| → R_h gives the "horseshoe" deflection.
  - Ball drops below the rim within 2 steps: holed.
- Flagstick interaction: not researched.

---

## 6. Validation targets

Run these in CI with RK4 at dt = 0.01 s, standard air (21 °C, 50% RH, sea level, still air) unless a case says otherwise. "Sourced" means the expected numbers are measurements. "Model" means they come from §3.6 and are an implementation-agreement target.

| # | Case | Inputs | Expected | Tolerance | Basis |
|---|---|---|---|---|---|
| 1 | PGA tour driver (2024) | ball 171 mph, launch 10.4°, spin 2545 | carry 282 yd, apex 35 yd, land 39° | ±6 yd, ±3 yd, ±3° | TrackMan [2] P. Set B gives 280.8 / 33.2 / 39.5 |
| 2 | PGA driver (prior edition) | club 113 → ball 167, 10.9°, 2686 | carry 275, apex 32, land 38 | ±6, ±3, ±3° | TrackMan [3] P. Set B: 274.6 / 33.0 / 39.7 |
| 3 | PGA 7-iron (2024) | 123 mph, 16.1°, 7124 | carry 176, apex 34, land 51° | ±6, ±3, ±3° | [2] P. Set A: 175.1 / 33.7 / 51.8 |
| 4 | Impact model, PGA driver | club 115, A -0.9°, SL 14.7°, F = P = 0 | ball 171 ±2 mph, launch 10.4 ±1°, spin 2545 ±250 | as stated | [2][5]. Smash 1.54·cos14.7 = 1.49; K = 87; κ = 0.23 |
| 5 | Impact model, PGA 6-iron | club 94, A -3.7°, SL 24.3° | ball 130 ±2, launch 14.0 ±1.5°, spin 6204 ±400, carry 188 ±7 | as stated | [2][5] |
| 6 | **Normalised driver: 130 mph, +5° AoA** | club 130, A +5°, L 16° (SL 11°), F = P = 0 | ball 196 ±3 mph (smash 1.51), launch 13.8 ±1°, spin 2160-2730 (K 87-110), **carry 326 ±12 yd**, apex about 58-61 yd, land 52-54° | ±12 yd | Impact D; flight M (set B). No TrackMan measurement at this speed was found. Sanity bound: case 9 |
| 7 | **3-wood off tee, +2° AoA** | club 110, L 12.2° (from the PGA 3W row: SL = (9.3+2.3)/0.8 = 14.5°), A +2° → SL 10.2° | ball 164 ±3 mph, launch 10.2 ±1°, spin 2590 ±300 (K = 133), carry 257-267 yd, land 37-42° | ±8 yd | D + M (set A 257.4, set B 267.1). Sourced comparators: PGA 3W 162/9.3/3663 → 249 [2]; LPGA 3W 135/11.6/2595 → 200 [2] |
| 8 | Altitude and temperature signs | case 1 at 1609 m elevation; again at 5 °C and 35 °C | Denver carry > sea level (model +11 to +14 yd); 5 °C < 21 °C < 35 °C | sign required; size ±50% | ρ formula [11] P; size M |
| 9 | USGA/R&A ODS | (a) 176 mph, 10°, 2520 rpm; (b) 2028: 183 mph, 11°, 2220 rpm | carry + roll ≤ 317 + 3 yd for a conforming ball. Model carry (a) 289.5, (b) 302.8 yd, so the game's fairway roll should be about 25-30 yd to land near the limit | total in 300-320 yd | R&A [22] P; carry M |
| 10 | Driver bounce + roll | landing 62.8 mph, 39.5°, 1982 rpm | firm fairway 30 ± 4 yd; typical 18 ± 13 yd; the irrigated case is ~8 yd shorter | as stated | [20] P |
| 11 | Wedge check | PW landing 47 mph, 55°, 8200 rpm on firm turf (Penner B params) | net bounce + roll between -5 and +3 yd; the same landing with 0 rpm rolls ≥ 8 yd | as stated | [17] P params; outcome M |
| 12 | Stimp calibration | ball rolled at 1.83 m/s on a flat green set to Stimp 10 | stops at 3.05 m (10.0 ft) | ±1% | [23][24] |
| 13 | Hole capture | centred, b = 0: v = 1.30 m/s; and v = 1.35 m/s. b = 40 mm: v = 0.75 m/s | holed; not holed (lips or jumps); holed | binary | [27] S + D |

---

## 7. Sources

1. TrackMan Editorial Team, "Introducing updated Tour averages", trackman.com, 2 May 2024. https://www.trackman.com/blog/introducing-updated-tour-averages (P)
2. TrackMan media, "Tour averages" posters (PGA/LPGA, yards and metres), trackman.media, 2024 release. https://trackman.media/tour-averages. Image files: `Tour-average-PGA-yards.jpg`, `Tour-average-LPGA-yards.jpg` (Dropbox links on that page). (P)
3. TrackMan Support, Tour averages poster PDFs (PGA and LPGA, meters/yards), PDF created 16 Jul 2020. https://support.trackmangolf.com/hc/en-us/article_attachments/7349802113051 and …/7349801987483 (P)
4. Golf Magic, "REVEALED! Trackman launches 2019 PGA Tour and LPGA Tour stats", updated 30 Oct 2020. https://www.golfmagic.com/equipment-news/revealed-trackman-launches-2019-pga-tour-and-lpga-tour-stats (S, edition label only)
5. TrackMan, "Spin Loft", 23 Sep 2024. https://trackman.com/blog/golf/spin-loft (P)
6. TrackMan, "Spin Rate", 23 Sep 2024. https://www.trackman.com/blog/golf/spin-rate (P)
7. TrackMan, "Launch Angle", 23 Sep 2024. https://www.trackman.com/blog/launch-angle (P)
8. TrackMan, "What is Face Angle", 23 Sep 2024. https://www.trackman.com/blog/golf/what-is-face-angle (P, no percentages)
9. The Sand Trap, "Ball Flight Laws" (quotes the TrackMan Jan 2009 newsletter, F. Tuxen). https://thesandtrap.com/b/playing_tips/ball_flight_laws (S)
10. Titleist Learning Lab, "Physics of ball striking in golf" (75/25 irons, 85/15 driver). https://www.titleist.com/learning-lab/performance/physics-of-ball-striking-in-golf (S; returned 403, content via search snippet)
11. A. M. Nathan, "Golf Ball Trajectory Calculator" v2 xlsx, Univ. of Illinois, updated 15 Feb 2025. https://baseball.physics.illinois.edu/trajectory-calculator-golf.html (P; formulas read from the workbook)
12. A. M. Nathan, "The Spin Decay of a Baseball" (sections II-III review golf spin decay: Smits & Smith, Tavares). https://baseball.physics.illinois.edu/spindown-rev1.pdf (P for the model; the PDF's date line reads 16 Jun 2026, probably a LaTeX \today)
13. A. J. Smits & D. R. Smith, "A new aerodynamic model of a golf ball in flight", Science and Golf II, 1994, pp. 340-347. https://www.taylorfrancis.com/chapters/edit/10.4324/9780203474709-54/new-aerodynamic-model-golf-ball-flight-smits-smith (S; not read, values via [11][12][16])
14. P. W. Bearman & J. K. Harvey, "Golf ball aerodynamics", Aeronautical Quarterly 27, May 1976, pp. 112-122 (S; values via secondary summaries in search results)
15. "Aerodynamics of Golf Balls in Still Air", Proceedings 2018, 2(6), 238 (MDPI; WSU). https://www.mdpi.com/2504-3900/2/6/238 (S, abstract only)
16. US Patent 6,186,002, "Method for determining coefficients of lift and drag of a golf ball". https://patents.google.com/patent/US6186002 (S/U; OCR errors)
17. S. W. Biber, K. M. Jones (R&A), A. R. Champneys, R. Green, R. Szalai, "Measurements and linearized models for golf ball bounce", arXiv:2302.02758, Jan 2023; journal version Sports Engineering 2023, doi:10.1007/s12283-023-00442-4. https://arxiv.org/abs/2302.02758 (P)
18. S. W. Biber, A. R. Champneys, R. Szalai, "Analysis of point-contact models of the bounce of a hard spinning ball on a compliant frictional surface", arXiv:2208.11685, Aug 2022 (IMA J. Appl. Math., doi:10.1093/imamat/hxad020). https://arxiv.org/abs/2208.11685 (P)
19. A. R. Penner, "The run of a golf ball", Can. J. Phys. 80 (2002) 931-940 (S; not read, model via [17])
20. USGA/R&A, "Agronomic Impacts on Bounce and Roll Distance" (Distance Insights R03), PDF created Jan 2020. https://assets.randa.org/c42c7bf4-dca7-00ea-4f2e-373223f80f76/cdd48ad2-2ed1-4e67-ad53-1a6522110779/R03%20-%20Agronomic%20Impacts%20on%20Bounce%20and%20Roll%20Distance.pdf (P)
21. S. Quintavalla & M. J. Rogers, "Survey of bounce and roll at 2007 PGA TOUR events", USGA, 2008 (S, via [20])
22. The R&A, "Decision to revise golf ball testing conditions beginning in 2028 announced", Dec 2023. https://www.randa.org/articles/decision-to-revise-golf-ball-testing-conditions-beginning-in-2028-announced (P)
23. D. D. Hoos, "In Defense of the Stimpmeter", USGA Green Section Record, Nov/Dec 1982. https://archive.lib.msu.edu/tic/holen/article/1982nov3.pdf (P)
24. Wikipedia, "Stimpmeter" (20°, 6.00 ft/s), plus patent US 7,987,693 (6-14 ft range; 30 in release; 20.2°). https://en.wikipedia.org/wiki/Stimpmeter ; https://patents.google.com/patent/US7987693 (S)
25. J. J. Sheppard, P. D. Hurrion, A. R. Collinson, "Golf ball speed at hole entry", World Scientific Congress of Golf 2016 (web version 27 Sep 2016). https://www.paulhurrion.com/tuition/an-investigation-into-golf-ball-speed-at-hole-entry/ (S)
26. B. W. Holmes, "Putting: How a golf ball and hole interact", Am. J. Phys. 59 (1991) 129-136 (U; not read)
27. A. R. Penner, "The physics of putting", Can. J. Phys. 80 (2002) 83-96 (S; capture formula via [28], corrected by derivation)
28. "Golf" case study (Stan Discourse attachment, 2 May 2022). https://discourse.mc-stan.org/uploads/short-url/tfw6u1hU6Xm0usC2I5QUJkulPCl.html (S; contains a formula transcription error)
29. Rules of Golf, definition of "Hole", and Equipment Rules for the ball, as reproduced by the Golf News Net, Britannica and others. https://thegolfnewsnet.com/golfnewsnetteam/2022/11/01/what-size-golf-ball-1-68-inches-golf-hole-4-25-inches-74425/ ; https://www.britannica.com/sports/golf/Play-of-the-game (S; usga.org and randa.org returned 403 or empty)
30. R. Cross, "Physics of Golf" (cites Penner AJP 69:1073 (2001) and Nathan & Cross AJP 75:658 (2007) on gear effect). https://www.physics.sydney.edu.au/~cross/GOLF/GOLF.htm (S)
31. A. Burritt & E. Henrikson, "Modeling golf ball roll with a variable coefficient of friction", Sports Engineering 27:39 (2024). https://lida.sport-iat.de/twm/Record/4091083 (S, abstract only)
32. Golf Digest, "Drivers 2026 robotic testing data". https://www.golfdigest.com/story/drivers-2026-robotic-testing-data-gear-questions (S; qualitative only)
33. GOLF.com, "Vokey wedge fitting with Aaron Dill". https://golf.com/gear/vokey-wedge-fitting-with-aaron-dill (S, n = 1)
34. TrackMan, "Normalization feature explained". https://www.trackman.com/blog/golf/normalization-feature-explained (S; via search summary)

### Not found or unsourced (best range given in the text)

- TrackMan tour wedge averages (50/54/58-60°)
- The atmosphere TrackMan's tour averages are normalised to
- Off-centre smash loss per cm
- Gear-effect constants
- Primary text of Holmes 1991
- Penner's θc and COR coefficients (the COR is U)
- Fairway rolling deceleration
- Green sliding friction
- Green-bounce parameters (paywalled)
- Modern tour Stimp readings from a primary source
- A measured 130 mph / +5° launch-monitor reference
