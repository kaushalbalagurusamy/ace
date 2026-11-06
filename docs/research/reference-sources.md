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
| club-ut | **Apex Utility Irons** (owner, 2026-11-05: the bag club is the 2025 Apex utility iron, **#2 UDI 18°**). The site has one Apex Utility Irons page (slug `irons-2026-apex-utility`, lofts 18/20/22/24°), and its photos show a 22° head, so stamp the model **18°**. It's an iron-style hollow head, not a wood | club-ut-1..4.jpg |
| club-iron | X Forged Irons (2025) | club-iron-1..4.jpg |
| club-wedge (50°) | Opus SP Chrome Wedge (2025) | club-wedge-opus-sp-1..4.jpg |
| club-wedge (54°) | Opus SP+ Chrome Wedge (2026 page) | club-wedge-opus-sp-plus-1..4.jpg |
| club-wedge (62°) | Full Toe SP Wedge (2026 page) | club-wedge-full-toe-sp-1..4.jpg |
| club-putter | Odyssey Square 2 Square TRI-HOT Black Seven CS Putter | club-putter-1..4.jpg |

**Second approved source (owner, 2026-11-05):** Fairway Jockey (fairwayjockey.com) product photos of the same Callaway and Odyssey models. Use them for extra angles, such as a face-on or sole view, when the callawaygolf.com set lacks one. Same rules: reference only, and list them in `sources.json`.

**Use:** these are the primary input for Meshy image-to-3D. The photos themselves never ship. Each generated model's manifest row names the photo files it was seeded from.

## Golfer character reference: `refs/golfer/character-reference.png` (owner, 2026-11-05)

- The owner supplied this image as **the** reference for the player character, replacing the earlier text-only concept.
- What to carry into the model: face, short curly dark hair with faded sides, a full trimmed beard, skin tone and build, and the **glowing violet eyes** as a signature detail.
- What not to copy: the cosmic background and the white embroidered robe. Dress the golfer in golf attire that keeps the white-with-gold-embroidery look (for example a white polo or quarter-zip with subtle gold celestial embroidery, dark trousers and golf shoes), so it reads as golf on the course.
- **Pipeline:** OpenAI image edit with this reference produces a front/side/back A-pose turnaround in STYLE.md's look. Then Meshy multi-image-to-3D, auto-rig, and the swing keyframes from refs/swing.
- **Fidelity:** a fresh critic compares renders against this image (face and hair silhouette, beard, skin tone, eyes) before the golfer ships.
- Reference only: the image itself never ships.

## Golf cart: Genesis Box Buggy, `refs/cart/` (owner, 2026-11-05: Genesis is a sponsor)

- **Source:** The Independent, "Genesis may put Box Buggy electric golf cart into production" (Steve Fowler, 2026-08-21). https://www.independent.co.uk/cars/electric-vehicles/genesis-box-buggy-electric-golf-cart-b3037105.html. Image URLs are in `refs/cart/sources.json`.
- **Files:** `genesis-1.jpg` (rear three-quarter), `genesis-3.jpg` (front three-quarter, Genesis wing logo in the background), `genesis-4.jpg` (interior: plaid seats and a tan dash). `genesis-2` was a duplicate and is removed.
- **Signature features:** a four-seat glass-canopy box body in dark blue, a horizontal light bar with chrome strips at the rear, chunky knobby wheels with exposed suspension, a tan and plaid interior, and the Genesis winged badge.
- **Use:** Meshy image-to-3D for the player's cart, then the fidelity critic, as for every model. Reference only; the photos never ship.

## Real photographs of Pebble Beach Golf Links: `refs/pebble-photos/` (gathered 2026-11-05)

26 real photographs, used **only** as the fidelity reference and as seed inputs to generation (OpenAI image edits, then Rodin/Meshy image-to-3D). None of them ships, and the side-by-side composites that contain them (`assets/qa/realism/*-side.jpg`) are not committed. Full metadata (image URL, author, licence URL) is in `refs/pebble-photos/sources.json`; `refs/pebble-photos/seeds/` holds 1024 px PNG copies sent to the generators. The look-dev brief that distils them is `docs/research/pebble-look.md`.

- **How:** the Wikimedia Commons API (category *Pebble Beach Golf Links*, the 2016 AT&T Pro-Am category and a Monterey cypress search) and the Openverse API (Flickr CC photos) for the holes Commons lacks (7 from the tee, 8, 17). Commons files were taken at 1280 px.
- **Licences:** CC BY / CC BY-SA / public domain on Commons; four Flickr photos are NC or ND. All are used as reference only, which these licences allow; nothing derived is a copy of a photo.

| File | Shows | Author | Licence | Source |
|---|---|---|---|---|
| `h18-green-cypress.jpg` | Hole 18 green and fairway cypress, Carmel Bay behind | glwx | CC BY-SA 3.0 | [page](https://commons.wikimedia.org/wiki/File:18th_Hole,_pebble_beach.jpg) |
| `h18-view-back.jpg` | Hole 18 from behind the tee side: striped fairway, fairway cypress, bay and far shore | User:Dudesleeper | CC BY 2.5 | [page](https://commons.wikimedia.org/wiki/File:18th_hole_at_Pebble_Beach,_Dudesleeper.jpg) |
| `h18-fairway-bay.jpg` | Hole 18 fairway, the lone fairway cypress, bay and far shore | Bernard Gagnon | CC BY-SA 3.0 | [page](https://commons.wikimedia.org/wiki/File:Pebble_Beach_18th_hole.jpg) |
| `h06-cliffs.jpg` | Hole 6 headland: sandstone cliffs above Stillwater Cove, cypress on top | Bernard Gagnon | CC BY-SA 3.0 | [page](https://commons.wikimedia.org/wiki/File:Pebble_Beach_6th_hole.jpg) |
| `h18-marine-layer.jpg` | Hole 18 under the marine layer (fog), cart path, cypress | Tewy | CC BY 2.5 | [page](https://commons.wikimedia.org/wiki/File:Pebble_Beach_Golf_Links_01.jpg) |
| `h18-green-bunkers.jpg` | 18th green bunkers: white sand, grass lips, sea wall and bay behind | Tewy | CC BY 2.5 | [page](https://commons.wikimedia.org/wiki/File:Pebble_Beach_Golf_Links_02.jpg) |
| `coast-rocks-fescue.jpg` | Coastal rocks and fescue grass at the sea edge, low sun | Dameon Hudson | CC BY 3.0 | [page](https://commons.wikimedia.org/wiki/File:Pebble_Beach,_Del_Monte_Forest,_CA,_USA_-_panoramio_(3).jpg) |
| `coast-headland-cypress.jpg` | Rocky headland with wind-sculpted Monterey cypress, Carmel Bay | Dameon Hudson | CC BY 3.0 | [page](https://commons.wikimedia.org/wiki/File:Pebble_Beach,_Del_Monte_Forest,_CA,_USA_-_panoramio_(4).jpg) |
| `cypress-path.jpg` | Monterey cypress canopy over a coastal path, ocean behind | Dameon Hudson | CC BY 3.0 | [page](https://commons.wikimedia.org/wiki/File:Pebble_Beach,_Del_Monte_Forest,_CA,_USA_-_panoramio_(5).jpg) |
| `cypress-silhouette-sea.jpg` | Monterey cypress silhouette over granite boulders and the sea | Dameon Hudson | CC BY 3.0 | [page](https://commons.wikimedia.org/wiki/File:Pebble_Beach,_Del_Monte_Forest,_CA,_USA_-_panoramio_(6).jpg) |
| `h18-green.jpg` | Hole 18 green, bunker and the Lodge behind | WilliamFMeyer | CC BY-SA 4.0 | [page](https://commons.wikimedia.org/wiki/File:Pebble_Beach_Golf_Links,_18th_green.jpg) |
| `h07-green.jpg` | Hole 7 green on its point: bunkers, rocks, surf | Metallion | CC BY-SA 3.0 | [page](https://commons.wikimedia.org/wiki/File:Pebble_Beach_Golf_Links,_hole_7.jpg) |
| `lodge.jpg` | The Lodge behind the 18th green (reference for a generic silhouette only) | Bernard Gagnon | CC BY-SA 3.0 | [page](https://commons.wikimedia.org/wiki/File:Pebble_Beach_Golf_Links_05.jpg) |
| `coast-tee-shot.jpg` | Hole 7 tee shot (downhill par 3): cart path, the green on the point, rocks, surf and the far shore | RaymondHearn | CC BY-SA 4.0 | [page](https://commons.wikimedia.org/wiki/File:Ray_at_Pebble_Beach_GC.jpg) |
| `bunker-close.jpg` | Bunker close-up: bright white sand, steep grass face | Presidio of Monterey | Public domain | [page](https://commons.wikimedia.org/wiki/File:2016_AT%26T_Pebble_Beach_Pro-Am_(24818527520).jpg) |
| `green-bunker-play.jpg` | Green with a white bunker and grass lip | Presidio of Monterey | Public domain | [page](https://commons.wikimedia.org/wiki/File:2016_AT%26T_Pebble_Beach_Pro-Am_(25020762281).jpg) |
| `green-bunker.jpg` | Green surface with a white bunker | Presidio of Monterey | Public domain | [page](https://commons.wikimedia.org/wiki/File:2016_AT%26T_Pebble_Beach_Pro-Am_(25087728626).jpg) |
| `h18-dawn.jpg` | Dawn over the bay: cypress silhouette, the 18th green and far shore | Presidio of Monterey | Public domain | [page](https://commons.wikimedia.org/wiki/File:2016_AT%26T_Pebble_Beach_Pro-Am_(25114096335).jpg) |
| `lone-cypress.jpg` | The Lone Cypress on its granite rock (17-Mile Drive) | Harvey Barrison | CC BY-SA 2.0 | [page](https://commons.wikimedia.org/wiki/File:Lone_Cypress_on_a_sunny_day.jpg) |
| `point-lobos-cypress.jpg` | Monterey cypress on granite at Point Lobos, ocean horizon | Harvey Barrison | CC BY-SA 2.0 | [page](https://commons.wikimedia.org/wiki/File:Point_Lobos_10_09_09_01.jpg) |
| `h07-morgen.jpg` | Chipping on hole 7: choppy surf, Carmel Beach, the far shore and Santa Lucia hills behind | morgen | CC BY-NC-SA 2.0 | [page](https://www.flickr.com/photos/40053024@N00/2290862548) |
| `h08-fairway.jpg` | Hole 8 fairway toward the cliff edge and the chasm | morgen | CC BY-NC-SA 2.0 | [page](https://www.flickr.com/photos/40053024@N00/2290812994) |
| `h08-chasm.jpg` | Hole 8 second shot over the chasm, cliffs and Carmel Bay | StonehouseGolf | CC BY-NC-ND 2.0 | [page](https://www.flickr.com/photos/40677827@N07/3856681019) |
| `h17-green.jpg` | Hole 17 green by the sea, rocks and bunkers | morgen | CC BY-NC-SA 2.0 | [page](https://www.flickr.com/photos/40053024@N00/2290089605) |
| `h18-moreira.jpg` | 18th green from the fairway under the marine layer: fairway cypress, white bunkers, bay | Mikael Moreira | CC BY 2.0 | [page](https://www.flickr.com/photos/38019000@N00/14380615940) |
| `h18-across-bay.jpg` | Hole 18 and the Lodge across Carmel Bay | circulating | CC BY-NC-SA 2.0 | [page](https://www.flickr.com/photos/26835318@N00/1837331523) |
