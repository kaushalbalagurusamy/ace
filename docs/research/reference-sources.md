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

## Callaway product photos: `refs/callaway/` (sponsor-directed reference, 2026-11-05)

- **What:** 4 studio photos for each product, at 1200 to 2000 px, from callawaygolf.com and odyssey.callawaygolf.com. Page and image URLs are in `refs/callaway/sources.json`.
- **How they were fetched:** through a real headless browser. Plain HTTP clients get HTTP 429 from the site's bot protection.

| Asset id (PRD/06) | Product page title | Files |
|---|---|---|
| club-driver | Elyte Triple Diamond Driver (2025) | club-driver-1..4.jpg |
| club-3w | Elyte Triple Diamond Fairway Woods (2025) | club-3w-1..4.jpg |
| club-ut | Apex Utility Woods (2026 page; the site lists no 2025 "UT", so this is the closest match to the owner's "Apex 2025 UT 18°") | club-ut-1..4.jpg |
| club-iron | X Forged Irons (2025) | club-iron-1..4.jpg |
| club-wedge (50°) | Opus SP Chrome Wedge (2025) | club-wedge-opus-sp-1..4.jpg |
| club-wedge (54°) | Opus SP+ Chrome Wedge (2026 page) | club-wedge-opus-sp-plus-1..4.jpg |
| club-wedge (62°) | Full Toe SP Wedge (2026 page) | club-wedge-full-toe-sp-1..4.jpg |
| club-putter | Odyssey Square 2 Square TRI-HOT Black Seven CS Putter | club-putter-1..4.jpg |

**Second approved source (owner, 2026-11-05):** Fairway Jockey (fairwayjockey.com) product photos of the same Callaway and Odyssey models. Use them for extra angles, such as a face-on or sole view, when the callawaygolf.com set lacks one. Same rules: reference only, and list them in `sources.json`.

**Use:** these are the primary input for Meshy image-to-3D. The photos themselves never ship. Each generated model's manifest row names the photo files it was seeded from.
