# Real elevation, slope lies and the terrain run-out

Date: 2026-11-05. This covers the source data, how each hole's game frame is laid on the real ground, the shared height field, and the physics that uses it. Constants with no published source are marked **UNVERIFIED**, as in `trackman-physics.md` (cited as R§n).

## 1. Sources

| Data | Source | Licence | Use |
|---|---|---|---|
| Hole tee and green positions, par, refs | OpenStreetMap through the Overpass API: `golf=hole` ways (the first node is the tee) and `golf=green` polygons inside the `leisure=golf_course` boundary | ODbL. Credit: © OpenStreetMap contributors (in `README.md`) | Georeferencing each hole |
| Bare-earth elevation | USGS 3D Elevation Program (3DEP), 1 m lidar DEM, through the `3DEPElevation` ImageServer `exportImage` endpoint, as uncompressed float32 TIFF tiles of 1 km in NAD83 UTM | Public domain (US Government work) | Height fields |
| Spot check | USGS Elevation Point Query Service (EPQS) | Public domain | Confirmed the 1 m resolution at the course (EPQS reports `resolution: 1`) |

The game ships no network calls: the result is committed as data (`src/shared/courses/<id>-height.ts`).

## 2. Method (`scripts/build-course.mjs`)

Run: `npx tsx scripts/build-course.mjs --course pebble [--cache DIR]`. Downloads are cached under `DIR/<course id>/` (default `.elev-cache/`, git-ignored); a second run is offline.

1. **Holes.** For hole n, the tee is the first node of the OSM hole way whose ref is n, and the green is the centroid of the OSM green polygon nearest the way's last node.
2. **Frame.** The game frame has the tee at the origin, x to the right and the pin on +z. A course with traced lie grids (Pebble Beach) keeps its card length L, so the frame is scaled by s = (real tee-to-green distance) / L, rotated so +z points from the real tee to the real green, and translated to the tee. A game point (x, z) maps to UTM as tee + s·(z·forward + x·right).
3. **Sampling.** One node every 4 m over the lie grid's footprint (300 m wide, from 40 m behind the tee to 70 m past the pin). Each node averages five DEM samples (bilinear on the 1 m raster) over its footprint, a light low-pass so lidar texture does not alias.
4. **Water.** Nodes on traced water are set to sea level.
5. **Greens.** Lidar is too coarse for putting breaks, so each green (the traced green cells within 45 m of the pin) is replaced by a least-squares quadratic fitted to the DEM there (a plane if fewer than 12 nodes). The quadratic part is scaled so that no green node is steeper than 3 %, and if the pin itself is flatter than 1 % the plane along its own fall line is raised to 1 %. The fit holds 4 m past the green edge and then blends into the DEM over 8 m (smoothstep). Result: 1-3 % greens with gentle curvature, inside what plays at Stimp 10 (a ball at rest holds up to about 8 %, §3.3).
6. **Tee box.** Levelled within 6 m of the origin, blended out to 12 m. Heights are stored relative to it, in centimetres (int16, base64).

### Coverage and registration (Pebble Beach)

All 18 holes were found in OSM. "Water low" is the share of the traced water cells whose real elevation is under 3 m; on the coastal holes 83-97 % of them are, which shows the traced layouts and the georeferenced DEM line up.

| Hole | OSM tee (lat, lon) | Real tee-green (m) | Scale | Tee elev (m) | Pin vs tee (m) | Range on map (m) | Green slope % | Water low % |
|---|---|---|---|---|---|---|---|---|
| 1 | 36.56939, -121.94953 | 334 | 0.959 | 21 | +6.4 | -12 to 28.9 | 0.01-3 | - |
| 2 | 36.57035, -121.94711 | 470.6 | 1.025 | 24 | +0.5 | -12.5 to 25.3 | 0.34-3.15 | - |
| 3 | 36.56918, -121.94125 | 350.6 | 0.983 | 24.3 | -12.6 | -23.1 to 4.3 | 0.39-3.05 | - |
| 4 | 36.56740, -121.94399 | 311.1 | 1.028 | 9.7 | +5.7 | -9.7 to 15.1 | 0.78-3.18 | 92 |
| 5 | 36.56630, -121.94061 | 181.1 | 1.053 | 16.3 | -1.5 | -16.3 to 10.3 | 0.33-3 | 96 |
| 6 | 36.56607, -121.93788 | 472 | 0.985 | 26 | -5.1 | -26 to 17 | 0.47-3 | 83 |
| 7 | 36.56223, -121.94050 | 97.4 | 1.005 | 18.6 | -8.7 | -18.6 to 3.7 | 0.35-3.11 | 93 |
| 8 | 36.56129, -121.94018 | 384.2 | 1.005 | 9.7 | +9.2 | -9.7 to 18.6 | 0.74-3 | 97 |
| 9 | 36.56352, -121.93682 | 474.5 | 1.114 | 23.8 | -10.8 | -23.8 to 24.2 | 0.67-3 | 97 |
| 10 | 36.56167, -121.93339 | 445.7 | 1.093 | 18.7 | -6.9 | -18.7 to 14.5 | 0.32-3 | 97 |
| 11 | 36.55786, -121.93111 | 348.6 | 1.003 | 13.1 | +21.6 | -11.9 to 31.6 | 1.35-3 | - |
| 12 | 36.56099, -121.92900 | 191.9 | 1.039 | 39.2 | -8.7 | -25.3 to 30.8 | 0.27-3.48 | - |
| 13 | 36.56104, -121.93104 | 405.5 | 1.092 | 28.4 | +0.3 | -27.3 to 22.6 | 0.06-3.13 | - |
| 14 | 36.56306, -121.93528 | 485.1 | 0.926 | 26 | +10.2 | -24.9 to 41.8 | 0.32-3 | - |
| 15 | 36.56710, -121.93696 | 362.9 | 1 | 39.9 | -12.8 | -23.7 to 25.1 | 0.99-3.05 | - |
| 16 | 36.56966, -121.93991 | 360.7 | 0.979 | 30.9 | -19.2 | -29.8 to 9.1 | 0.1-3 | - |
| 17 | 36.56712, -121.94409 | 158.6 | 0.834 | 9.1 | -2.8 | -9.1 to 7.9 | 0.25-3 | 53 |
| 18 | 36.56553, -121.94519 | 460.5 | 0.927 | 5.5 | +3.4 | -5.5 to 11.9 | 1.16-3 | 95 |

Green slope is the range over the green's nodes; a few edge nodes reach 3.1-3.5 % where the 1 % pin rule tilts a near-flat fit.

### Other courses

The same script builds any OSM-mapped course in the US 3DEP coverage. Each course is an entry in `COURSES` at the top of the script: the OSM `golf_course` name to search, an optional tag filter for its holes (Bethpage's one boundary holds five courses, so Black is `golf:course:name=Black`), and the traced lie grids and card if the game has them. Without lie grids, a hole's frame is the real tee-to-green line at scale 1 with the same 300 m by (length + 110 m) footprint, and its green comes from the OSM polygon. Par comes from the OSM `par` tag, yardage from a `dist`/`yardage` tag or else the straight tee-to-green distance. The UTM zone (and its NAD83 EPSG code) comes from the course's longitude.

- `bethpage-black`: built (`src/shared/courses/bethpage-black-height.ts`, 18 holes, OSM pars, par 71). Not registered in `COURSE_HEIGHTS` yet, so it is not bundled. Yardages are straight tee-to-green distances (OSM has no `dist` tags there), so doglegs read short.
- `aronimink`: built (`src/shared/courses/aronimink-height.ts`, 18 holes). The 3DEP ImageServer returned HTTP 504 on some tiles; the script's backoff retries got them all. Not registered yet either.

To add a course to the game: add it to `COURSES`, run the script, register its `HEIGHTS` in `COURSE_HEIGHTS` (`src/shared/height.ts`), and give it lie grids and visuals.

## 3. Physics on the terrain

### 3.1 Shared height field (`src/shared/height.ts`)

`heightAt(course, hole, x, z)` is bilinear on the 4 m nodes, clamped at the edges; it is continuous everywhere. `normalAt(course, hole, x, z)` takes central differences half a cell either side, so normals are continuous too (no seams at cell edges). Both are pure, read only committed data, and are used unchanged by the server (`src/server/course.ts` Hole.heightAt/normalAt) and the client (terrain mesh, props, cart, camera, rangefinder).

### 3.2 Flight and landing

`simulateShot(launch, air, ground)` ends the flight where the ball meets `ground(x, z)` (height relative to the ball's lie), interpolated within the step as R§3.5 does for flat ground. The first 0.1 s ignores the ground so the ball clears its own slope. Uphill landings come short and downhill ones long purely from where the descending ball meets the ground. With no ground callback the code path and results are bit-for-bit the old flat ones (tested).

### 3.3 Bounce and roll (`src/sim/runout.ts`)

- **Bounce:** the same Penner tilted-plane rigid bounce (R§4.1, Campaign B tee turf), applied in the plane of the surface normal: the incoming velocity splits into normal and tangential parts, the 2-D bounce acts on them, and the result is rebuilt in 3-D. On flat ground this is exactly the old bounce. Sidespin is not modelled (as before).
- **Hops:** ballistic (no air, as before) until the ball meets the terrain again, then bounce off the local normal; hops end when the rebound is under 0.3 m/s (unchanged).
- **Roll:** horizontal acceleration = downhill gravity for a rolling solid sphere, (5/7)·g·sin θ along the fall line, minus the surface's rolling resistance (R§4.2, R§4.3 Stimp) against the motion. The surface is looked up as the ball rolls, so a ball running off the green meets the fringe's resistance. Each 1/60 s step uses constant acceleration, and a stop inside a step is solved exactly, so on flat ground the roll equals `rollDistance` (1.83 m/s rolls 3.05 m at Stimp 10).
- **Rest:** a stopped ball stays only where the resistance can hold it: (5/7)·g·sin θ ≤ a. At Stimp 10 a green holds up to about 7.9 %, fairway about 66 %. Otherwise it starts rolling downhill again. The ball stops at once on water or out of bounds (the penalty then applies) and plugs in a bunker.
- **Cup:** the capture-speed rule (R§5.2) at the closest approach within each step, so curving putts can drop.

### 3.4 Slope lies (`src/sim/delivery.ts`, `launchFor`)

The stance slope at the ball comes from the normal and the aim: `alongDeg` is the slope along the target line (+ uphill) and `sideDeg` across it (+ ball above the feet, for a right-handed golfer standing left of the line). The tee box is level, so slope is ignored for the `tee` lie and for the putter. The slope changes only the delivery; launch, spin and curve then come from the D-plane impact model (R§2), with no curve added directly.

| Effect | Model | Grade |
|---|---|---|
| Up/downhill dynamic loft | + `SLOPE_LOFT_SHARE` (1.0) × along | **UNVERIFIED** design constant (golfers set up with the slope) |
| Up/downhill attack angle | + `SLOPE_ATTACK_SHARE` (0.5) × along: the club meets an upslope earlier, so spin loft grows uphill and shrinks downhill | **UNVERIFIED** design constant |
| Side slope face angle | face += −atan(tan(static loft) · sin(side)): the lie-angle rule for a face tilted toe up (ball above the feet: face left, draw) or toe down (fade) | **D** (geometry of a lofted plane rotated about the target line). Gives 0.14°/° for a driver, 0.67°/° for a 7-iron, 1.04°/° for a PW, 1.38°/° for a 54° |

Path and the lie-angle effect on effective loft are not changed. PRD/03 §4's old "Slope" row (launch shifts by the slope angle; aim shifts by ±slope·0.5) is replaced by this table.

### 3.5 Measured effect sizes (`launchFor` + `simulateShot`, standard air)

Side slope, ball above the feet (+) and below (−), flat ground, full swing:

| Club | Carry flat (yd) | +5° offline (yd) | −5° offline (yd) | +10° offline (yd) | Spin-axis change per degree | Miss angle per degree |
|---|---|---|---|---|---|---|
| Driver | 322 | −11.4 | +11.4 | −22.7 | −0.54° | 0.39° |
| 5-iron | 230 | −23.8 | +23.8 | −45.8 | −1.33° | 1.18° |
| 7-iron | 196 | −23.2 | +23.2 | −44.3 | −1.31° | 1.37° |
| 9-iron | 167 | −22.3 | +22.3 | −42.1 | −1.33° | 1.57° |
| PW | 148 | −19.6 | +19.6 | −37.0 | −1.17° | 1.57° |
| 54° | 117 | −17.6 | +17.6 | −33.4 | −1.19° | 1.78° |

So about 4.5 yd left per degree of "ball above the feet" for a mid-iron, and the miss angle per degree rises with loft.

Up/downhill: the lie alone on flat ground, ±3°: 7-iron −7.5 / +7.0 yd carry (5-iron −6.8 / +5.3, PW −7.8 / +7.7; the driver loses 1.6 / 2.5 yd either way, since a downhill lie launches it too low). Uphill 5° adds about 4° of launch and 600-700 rpm for irons. Lie plus ground continuing at the same 5° grade: driver −25 / +25 yd, 7-iron −22 / +25 yd, PW −20 / +22 yd carry.

## 4. Client

- The terrain mesh has one vertex per height node, displaced by `heightAt`; the lie colours, HD turf masks and graphics tiers are unchanged textures, and the turf's baked normals now tilt the mesh's own normal.
- The ball, golfer, other players, the cart (also tilted to the ground normal), pin, flag, props and grass sit on the ground, and the camera never goes below the ground behind the player.
- The rangefinder shows "Elevation: +12 ft" (the real rise from the ball to the hovered point), and the plays-like club adds that rise yard for yard.
- At the ball, a lie panel shows the lie's power, spin and launch changes from the `LIE` table (for example "Rough: −15% power · −45% spin (flyer) · +1.5° launch"), the up/downhill angle along the aim, the side slope (ball above or below the feet), and the surface normal's tilt (x and z lean, y from vertical), with an icon of the fall line relative to the target. It shows no curve number: the player estimates the curve from the angles.

## 5. Limitations

- **Similarity transform.** Each traced layout is laid on the real ground by one rotation and scale per hole (0.83-1.11). The traced graphic and the real hole can still differ by metres, more on doglegs; the water check above is the evidence they broadly agree.
- **Resolution.** 4 m nodes. Real cliffs at Carmel Bay reach about 7 m per metre on this grid, and small features (bunker lips, mounds under 8 m) are smoothed out.
- **Greens are a model,** fitted to the lidar trend, not surveyed contours.
- **No sidespin** in bounces or rolls, and hops ignore air, both as before.
- The slope delivery shares and the green 1-3 % band are design choices, not measurements.
