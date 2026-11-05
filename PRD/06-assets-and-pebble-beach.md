# 06: Assets, generation platforms and the Pebble Beach map

## 1. Rules for every asset

- [GIVEN by the brief] Every visual and sound is generated for this game. No library packs, recorded sound effects or stock textures (register F-014, F-052).
  - This includes the three.js example textures, such as the water normal map shipped with the Water addon. Those are pre-made, so we generate our own.
- [GIVEN] The MVP runs on greyscale polygons. Each asset below has a code-made stand-in with the same ID, so the game never waits on generation.
- [GIVEN] Club models follow the Callaway and Odyssey models in the bag, because Callaway is the sponsor. The HUD keeps generic labels.
- [ASSUMED] **Logos:** no Callaway logos or wordmarks appear unless Callaway supplies approved artwork. The shapes and colourways can follow the real clubs.
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

### Rights [OPEN Q12]
Pebble Beach is a famous, trademarked course. The Pebble Beach Company licenses it to video games, and I recall it suing a replica-course builder in the 1990s (*Pebble Beach Co. v. Tour 18*) [UNVERIFIED]. Three options:
- (a) Use the name and layout for an internal sponsor demo only.
- (b) Ask Callaway whether they can arrange permission.
- (c) Ship the public, judged build as "a coastal links inspired by the Monterey Peninsula" with no Pebble Beach name or marks. The layout is unchanged.

My default is (c) for anything public until you decide.

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
| tex-ground | Tileable fairway, rough, sand and green textures | 4 | Code noise, then OpenAI tileables | Fairway mowing stripes in a shader | P0 / P1 |
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

## Acceptance criteria

- **AC-A1:** Every shipped file has a manifest row. CREDITS lists every tool and the OpenStreetMap attribution.
- **AC-A2:** With `assets/` empty, the game still runs in greyscale.
- **AC-A3:** All models load at the same scale and orientation (golfer about 1.8 m tall, club lengths true to life).
- **AC-A4:** No sound effect clips. Music sits below the sound effects in the final mix.
