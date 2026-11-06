# Ace asset style brief (include in every generator prompt)

One cohesive look across every asset: **stylised low-poly, clean flat-shaded facets, soft painterly colour, no photoreal textures, no text or logos baked in.** Think a polished mobile golf game on the Monterey coast.

## Palette (sRGB hex; stay within these families)
| Role | Colour |
|---|---|
| Cypress foliage | #2F4A3A (shadow #1F3329, highlight #4A6B52) |
| Pine foliage | #3D5A3A, needles highlight #5C7F4D |
| Parkland oak and maple foliage (Bethpage, Aronimink) | oak #3E5B2E, #4A6A35, #35502A; maple #56702F, #6B7A33, #4F6A2C |
| Bark / wood | #5B4636, dark #3A2C22 |
| Coastal rock | #8A8F8C, shadow #5F6663, lichen accent #9AA37A |
| Sand | #E3D3A8 |
| Skin (golfer) | #D9A97F (one tone; colourways change clothing only) |
| Player colourways | red #D64545, blue #3F6FD6, yellow #E8C23A, white #EDEDED |
| Metal club heads | #C9CDD2 steel, #2B2E33 black PVD, #D6B45A gold accent |

## Exception: turf
The ground turf (`turf-*` in the manifest) is photographic by owner request (2026-11-05): seamless top-down photos, colour-pulled toward the terrain palette in code so the lies stay readable.

## Exception: home-screen backdrops
The aerial views behind the name entry, waiting room and lobby (`bg-*` in the manifest, shipped in `assets/backdrops/`) are photographic by owner request (2026-11-05): golden-hour drone-style photos, each generated as an image edit seeded with the matching `refs/pebble-beach` hole graphic so the layout matches the real hole. No text, logos or people. WebP, 1920 px wide under 400 KB plus a 640 px placeholder.

## Rules
- Units: **1 unit = 1 metre**, Y up, origin at the base centre (feet / trunk base / club sole). Face +Z.
- Triangle budgets (final shipped .glb): tree <= 3,000; rock <= 2,000; golfer <= 15,000; club head <= 4,000.
- Single material per asset where possible; PBR base colour only (no emissive), matte (roughness >= 0.6) except metal club faces.
- No ground plane, no shadow blob, no background. Single object per file.
- Shipped files: `.glb`, Draco or meshopt compressed, <= 2 MB each. Originals stay out of git.
- Every shipped asset has a row in `assets/manifest.json`; the game falls back to greyscale code stand-ins when a file is missing.
