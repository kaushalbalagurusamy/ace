# Reference sources for generation (gathered 2026-11-05)

These inputs **seed generation only** (owner, 2026-11-05: "we are expected to use the 2D references to seed generation"). The files live in `refs/`, which is gitignored: it is third-party material and the GitLab repo is public. Nothing in `refs/` ships in the game. Each generated asset cites the reference it was seeded from in `assets/manifest.json`.

## Pebble Beach hole layouts: `refs/pebble-beach/`

- **Source:** SFGATE, "THE HOLE LAYOUT OF PEBBLE", 2000-06-15 (2000 U.S. Open). https://www.sfgate.com/sports/article/THE-HOLE-LAYOUT-OF-PEBBLE-3312001.php
- **Graphics:** "Chronicle Graphic by Steve Greenberg". The owner says use is permitted as reference.
- **Files:**
  - `layout.jpg`: the whole course.
  - `hole-01.jpg` to `hole-18.jpg`: top-down illustrations, 1080 px wide, showing tee, fairway, rough, bunkers, cart path, green, pin and coastline. There is no scale bar, so scale each one by its yardage.
  - `holes-2000-us-open.txt`: the article's hole notes.
  - `graphics.json`: source URLs.
- **Use:** trace the hole polygons for the mini map, rangefinder and terrain. Seed the texture and colour palette. Cross-check against OpenStreetMap and USGS elevation (PRD/06 §2) for true geometry and elevation.

### Card for the game (supervisor decision, 2026-11-05)

Yardages are the 2000 U.S. Open setup from the article. Hole 2 is played as a **par 5 at 502 yd**, its everyday and AT&T setup (the article says the USGA made it a par 4 at 484 yd only for the Open). That makes the game card **par 72**.

| Hole | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | Out |
|---|---|---|---|---|---|---|---|---|---|---|
| Par | 4 | 5 | 4 | 4 | 3 | 5 | 3 | 4 | 4 | 36 |
| Yards | 381 | 502 | 390 | 331 | 188 | 524 | 106 | 418 | 466 | 3306 |

| Hole | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | In |
|---|---|---|---|---|---|---|---|---|---|---|
| Par | 4 | 4 | 3 | 4 | 5 | 4 | 4 | 3 | 5 | 36 |
| Yards | 446 | 380 | 202 | 406 | 573 | 397 | 403 | 208 | 543 | 3558 |

**Total:** 6864 yd, par 72. This replaces the pars I recalled from memory in PRD/06 §2 (they matched apart from the yardage gap).

## Swing reference: `refs/swing/dunaway-dtl-sybervision.mp4`

- **Source:** "Mike Dunaway Driver Swings DTL (Sybervision)", WAX Golf, uploaded 2020-04-28. https://www.youtube.com/watch?v=zJpTTF4wr7s. 56 s, 1280×720, 30 fps.
- **Camera angle:** the clip is filmed **down the line (DTL)**, not face-on, although the owner first described it as a front view. DTL shows the plane, path and the arms dropping "into the slot" well. Hip and shoulder turn depth is ambiguous from this angle, so pose estimation needs joint-limit clamping (PRD/05 risks).
- **Frame rate:** 30 fps gives about 33 ms per frame, which is coarse for the Z/X/C onsets (PRD/02 §3: target offsets of 60 and 150 ms). Interpolate across frames, and treat the timings as ±1 frame.
- **Use:** extract the joint-angle curves and phase timings only. The video and its frames never ship.

## Callaway product photos (owner: sponsor-approved, for seeding the club models)

- Not fetched yet. callawaygolf.com returned HTTP 429 to automated requests, so download them by hand or slowly in a browser.
- Put them in `refs/callaway/<club-id>.jpg`, using the IDs from PRD/06 §4.
