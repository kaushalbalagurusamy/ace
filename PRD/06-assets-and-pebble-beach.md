# 06: Assets, generation platforms and the Pebble Beach map

## 1. Rules for every asset

- [GIVEN by the brief] Every visual and sound is generated for this game. No library packs, recorded sound effects or stock textures (register F-014, F-052).
  - This includes the three.js example textures, such as the water normal map shipped with the Water addon. Those are pre-made, so we generate our own.
- [GIVEN] The MVP runs on greyscale polygons. Each asset below has a code-made stand-in with the same ID, so the game never waits on generation.
- [GIVEN] Club models follow the Callaway and Odyssey models in the bag, because Callaway is the sponsor. The HUD keeps generic labels.
- [GIVEN] **Callaway reference:** Callaway (the sponsor) directed us to use its product-site photos for the club models. Logos and wordmarks may appear on the generated models as they do in those photos.
- [ASSUMED] **Provenance:** every asset gets one row in `assets/manifest.json`: id, file, tool, model or version, tier, prompt, seed, date, licence, and the subagent that made it. A `CREDITS.md` lists the tools and an "AI-generated assets" line. The format is the `create-game-assets` skill's `asset-manifest.json`.

## 2. Pebble Beach Golf Links: the first map [GIVEN]

### Layout and data [ASSUMED method, UNVERIFIED data]

- **Pars:** par 72, which is 36 out and 36 in.

  | Holes | Pars |
  |---|---|
  | 1 to 9 | 4, 5, 4, 4, 3, 5, 3, 4, 4 |
  | 10 to 18 | 4, 4, 3, 4, 5, 4, 4, 3, 5 |

  [UNVERIFIED, from memory] Check these against the official scorecard.
- **Yardages:** taken from the official scorecard, from one chosen set of tees. I haven't listed them because my recall isn't reliable enough.
- **Coastline:** holes 4 to 10, 17 and 18 run along Carmel Bay and Stillwater Cove [UNVERIFIED]. Those holes carry the ocean penalty areas (04).
- **Hole shapes:** fairway, green, bunker, tee and water polygons from OpenStreetMap golf features (`golf=fairway|green|bunker|tee|water_hazard|rough`). OpenStreetMap data is ODbL, so CREDITS must say "© OpenStreetMap contributors". Coverage at Pebble Beach is [UNVERIFIED] and must be checked first.
- **Elevation:** a public-domain USGS 3DEP elevation model, resampled to a heightmap [UNVERIFIED resolution there]. Greens need hand-set slopes, because lidar is too coarse for putting breaks.
- **Imagery:** satellite imagery may be used only as a tracing reference during development. It is never shipped.
- **Geometry:** all course geometry is generated in code from this data, so the shipped course is a generated asset, not a copied one.
- **Scale:** the real yardages are kept [ASSUMED]. At 130 mph many par 4s become a drive and a wedge, which suits a race.

### Rights [GIVEN Q12, 2026-11-05]
The owner's Pebble Beach contact approved using the **Pebble Beach** name in the game. Ship the course as "Pebble Beach Golf Links". The 2000 U.S. Open hole graphics are reference only (docs/research/reference-sources.md).

## 3. Generation platforms

| Need | Platform | Why | Status |
|---|---|---|---|
| 3D models: golfer, clubs, trees, rocks, buildings | **Meshy** (text-to-3D and image-to-3D, auto-rigging, API) | Covered by the earlier research. The free tier is CC BY 4.0; paid tiers add an API so subagents can run in parallel | [OPEN] Needs a Meshy Pro key. About $20/mo for API access [UNVERIFIED price]. Tripo or Rodin are fallbacks |
| Concept and reference images (club style sheets, golfer turnaround) feeding Meshy image-to-3D | **OpenAI image generation** | Image-to-3D follows a reference image much better than text alone | [OPEN] The image key is still unchosen |
| Tileable ground textures (fairway, rough, sand, green, rock) | OpenAI images, or code noise | Code noise is free and fine for the MVP | Code first |
| Course terrain, water, sky | **Code** (Three.js): heightmap mesh, surface shaders, our own water shader with a generated normal map, the `Sky` addon shader | Sizes and edges must match the physics data exactly | Track A |
| Golfer animation | **Pose extraction** from the reference clip (02 §6) onto a Meshy-rigged golfer | Brief: no pre-made animations, so no Mixamo or Meshy animation presets | Track A step 5 |
| Sound effects, ambience, announcer voice | **ElevenLabs** (Starter plan, active: 40,000 credits; sound-effects API and text-to-speech) | Already paid for, and includes a commercial licence | Key in `.env` |
| Music | **ElevenLabs Music** [UNVERIFIED on Starter], or Suno Pro as a fallback (paid tier only: F-002, F-016) | Generated, with a commercial-use tier | Check the Starter tier first |
| UI sounds | **jsfxr** (code-made, seeded presets) | Free, tiny and generated | Track B |

[OPEN, F-044] Spend ceiling: the costs above are Meshy Pro (about $20) plus OpenAI images (cents each).

## 4. Asset list

**Priority:**
- **P0:** a code stand-in exists in the MVP.
- **P1:** generated tonight.
- **P2:** if time allows.

### 3D and visual

| ID | Asset | Count | Platform | Notes | Pri |
|---|---|---|---|---|---|
| golfer | Golfer, rigged, neutral pose, 4 player colourways | 1 mesh + 4 materials | OpenAI concept → Meshy image-to-3D → auto-rig | Matches the keyframes from the clip. Under 15k triangles | P0 / P1 |
| club-driver | Driver head, Elyte TD 8° style | 1 | OpenAI style sheet → Meshy | Shaft and grip are code cylinders | P0 / P1 |
| club-3w | 3-wood head, Elyte TD style | 1 | same | | P0 / P1 |
| club-ut | 18° utility, Apex 2025 UT style | 1 | same | | P0 / P1 |
| club-iron | Iron head, 2025 X Forged style | 1, scaled and lofted for 4i to PW | same | One mesh, 7 lofts | P0 / P1 |
| club-wedge | Opus SP (50°, 54°) and Full Toe SP 62° heads | 2 | same | | P0 / P1 |
| club-putter | Odyssey S2S Tri-Hot #7 center-shaft head | 1 | same | | P0 / P1 |
| ball | Golf ball with dimples | 1 | Code: sphere plus a dimple normal map made in code | | P0 |
| pin | Flagstick, flag, cup liner | 1 set | Code | Flag cloth sways in a vertex shader | P0 |
| markers | Tee markers, white OB stakes, red and yellow penalty stakes | 4 | Code | | P0 |
| tree-cypress | Monterey cypress | 2 variants | Meshy | Instanced | P1 |
| tree-pine | Monterey pine | 1 variant | Meshy | Instanced | P1 |
| rocks | Coastal rocks and cliff pieces | 3 variants | Meshy | Shoreline holes 4 to 10, 17 and 18 | P1 |
| seawall | Seawall along the left of 18 [UNVERIFIED feature] | 1 kit | Code extrusion | | P2 |
| lodge | Clubhouse silhouette near 18 | 1 | Meshy, generic design | Not a replica of the real lodge (Q12) | P2 |
| terrain | Terrain mesh and surface map (fairway, first cut, rough, sand, green, fringe, path) | 18 holes | Code from OSM and 3DEP | Same polygons drive the physics lies (03 §4) | P0 |
| water | Ocean and shoreline foam | 1 shader | Code, with a generated normal map | | P0 / P1 |
| sky | Sky and coastal fog | 1 | Code (`Sky` addon) | | P0 |
| tex-ground | Tileable fairway, first cut, rough, fringe, green and sand turf (`turf-*`, photographic, owner request 2026-11-05) | 6 | OpenAI `gpt-image-2-2026-04-21` at 2048 px, made seamless and downsized by `scripts/turf_tiles.py` | Normal and roughness derived in the client; mowing stripes in the shader | P1 |
| ui-icons | 14 club icons for the HUD row | 14 | Code SVG | Generic labels | P0 |
| minimap | Mini map and rangefinder art | 1 | Code, rendered from the course data | | P0 |

### Audio

| ID | Asset | Count | Platform | Pri |
|---|---|---|---|---|
| sfx-swing | Swing whoosh: soft, full, max | 3 | ElevenLabs SFX | P1 |
| sfx-impact | Impact: driver, fairway or utility, iron, wedge, putter, mishit | 6 | ElevenLabs SFX | P1 |
| sfx-land | Landing: fairway, rough, sand, green, cart path, rock, water splash | 7 | ElevenLabs SFX | P1 |
| sfx-cup | Ball rattles in the cup and drops | 2 | ElevenLabs SFX | P1 |
| amb | Ambience loops: surf, gulls and sea lions, wind in cypress | 3 | ElevenLabs SFX (long loop) | P1 |
| crowd | Applause, "ooh" on a near miss | 2 | ElevenLabs SFX | P2 |
| ui-sfx | Click, club switch, lobby join, ready, countdown beeps, Go horn, drop chime | 7 | jsfxr | P0 |
| vo | Announcer: "3, 2, 1, Go", "Hole in one", "Finish", "Final minute" | 4 | ElevenLabs text-to-speech, one chosen voice | P1 |
| music | Lobby loop, race loop, results sting | 3 | ElevenLabs Music or Suno Pro | P1 |

## 5. Pipeline and parallel work [ASSUMED]

- **Style brief:** one shared brief in `assets/STYLE.md` covers palette, shapes, triangle budgets, scale (1 unit = 1 m) and a reference image. Every subagent prompt includes it.
- **Subagents:** one per group: clubs, golfer, foliage and rocks, sound effects and ambience, music and voice. Each writes to `assets/<group>/` and adds manifest rows. None of them edits game code.
- **Formats:** models are glTF binary (`.glb`). Each model gets a Draco-compressed copy, ≤ 2 MB per model, checked by `asset_report.py`. Audio is `.ogg` and `.mp3`, loudness-normalised to −16 LUFS for sound effects and −20 LUFS for music [ASSUMED targets].
- **Integration:** the client loads `assets/manifest.json`. A missing ID falls back to the greyscale stand-in, so assets can land in any order.

## 6. Graphics presets [GIVEN by the owner 2026-11-05]

The turf is HD and realistic, and each device loads only what its hardware can carry. Settings menu (Esc or gear): **Graphics: Auto (High)** by default, with Low, Medium, High and Ultra as overrides, saved in `localStorage` (`ace.gfx`). **F3** toggles an FPS, tier, draw-call and triangle readout. Code: `src/client/graphics.ts` (table, Auto, adaptation; unit tested), `turf*.ts`, `terrain.ts`, `grass.ts`.

| | Low | Medium | High | Ultra |
|---|---|---|---|---|
| Turf files downloaded | 6 × 512 px (~0.7 MB) | 6 × 1024 (~3.2 MB) | 6 × 2048 (~10.6 MB) | 6 × 2048 + close-range detail sampling |
| Rough grass blades (instanced, wind sway) | off | off | 30 m, 0.45 m spacing | 50 m, 0.36 m spacing |
| Sun shadows (box follows the player) | off | 1024 | 2048 | 4096, softer |
| Pixel ratio | 0.75 | 1.0 | min(DPR, 1.5) | min(DPR, 2) |
| Antialias (MSAA, applies on the next load) | off | on | on | on |
| Trees and rocks placed | 50% | 75% | 100% | 100% |
| Fog / far plane | 160–650 / 900 m | 200–800 / 1200 m | 220–900 / 2000 m | 260–1100 / 2000 m |

- **Turf:** six surfaces blended by the lie grid (fringe is the ring around each green), with soft, noise-jittered edges. Each surface is sampled twice (the second rotated, larger and offset, mixed by world noise) and carries macro colour variation, so tiles do not repeat visibly. Fairway mowing stripes (6 m) and green stripes (1 m) run along the tee-to-pin axis. A worker bakes each photo's colour toward the course palette and derives a normal and roughness map from its luminance (Sobel). If any turf file fails, the terrain keeps the flat lie-grid colours.
- **Auto, initial tier:** from the unmasked WebGL renderer string when available, `MAX_TEXTURE_SIZE`, `navigator.deviceMemory`, `hardwareConcurrency` and a mobile check. Software GL, ≤2 GB, ≤2 cores or a max texture below 8192 get Low. Phones get Low (Medium with ≥6 GB). An M1 or Intel integrated GPU gets Medium. Newer Apple chips and mainstream discrete GPUs get High. RTX x060+, RX 6000+ and M-series Max/Ultra get Ultra. A masked renderer gets Medium.
- **Auto, runtime:** a 2.5 s rolling frame-time window. Averaging over 20 ms steps down one tier. Staying under 12 ms for 10 s steps up one, never above the initial tier + 1, and not back into a tier it left for being slow within 45 s. Frames over 250 ms (tab switch, loading) reset the window. No switch happens during a swing or while your ball is in flight; it waits for rest.
- **Limits:** rAF frame time cannot go below the display refresh interval, so on a 60 Hz screen (16.7 ms) Auto steps down but never up. Medium at 60 fps on an M1 MacBook Air at 1280×720 is the budget, but it has not been measured on an M1 (only on an M5 Pro, where every tier holds 60 fps).

## Acceptance criteria

- **AC-A1:** Every shipped file has a manifest row. CREDITS lists every tool and the OpenStreetMap attribution.
- **AC-A2:** With `assets/` empty, the game still runs in greyscale.
- **AC-A3:** All models load at the same scale and orientation (golfer about 1.8 m tall, club lengths true to life).
- **AC-A4:** No sound effect clips. Music sits below the sound effects in the final mix.
