# Pebble Beach look-dev brief (from the real photos)

This brief describes what the 26 real photographs in `refs/pebble-photos/` show (sources: `docs/research/reference-sources.md`). Every generated texture, model, shader and light in the game is tuned against it. The swatches are mean sRGB colours of crops from the named photos (`magick -crop … -resize 1x1`). They are measurements of photos under that photo's light, so treat them as targets for the lit, tone-mapped frame, not as raw albedo.

## Light and sky

- **Two weathers dominate.** The first is clear afternoon light: a hard sun, crisp shadows, a deep blue zenith and a paler horizon (h07-green, coast-tee-shot, lone-cypress). The second is the **marine layer**: a flat, bright grey-white overcast with almost no shadows and fog hiding the far shore (h18-marine-layer, h18-moreira, h08-fairway).
- **Aerial haze is strong.** The far shore across Carmel Bay (Carmel Beach and Point Lobos, with the Santa Lucia hills behind) always reads as low-contrast blue-grey bands. Even on clear days the distance desaturates to blue within about 2 km.
- **Swatches:** sky zenith `#7AA8DA` (h07-green), sky near the horizon `#8EAFD4` (h07-green), marine-layer sky `#C7D1DC` (h18-marine-layer), far-shore hills in haze `#8DA0B2` (h18-fairway-bay), far-shore tree line `#434649` (h07-morgen).
- **Game choice:** a clear afternoon with a sun about 35° high and a little warm, bright sky light, ACES tone mapping and a blue-grey distance haze (fog colour near the horizon swatch). This is the look of most of the hole photos.

## Ocean (Carmel Bay and Stillwater Cove)

- **Offshore** water is a mid to deep slate blue with a fine chop and sun glitter. It is never the saturated cyan of a tropical sea (h07-green `#5A7EA4`, ocean-mid `#5D82AA`).
- **On clear days near rocks**, the colour turns a richer cobalt to turquoise over the shallows and kelp (point-lobos-cypress `#4987C8`). Under the marine layer it goes silver-grey with flecks of kelp (lone-cypress `#8FB3CF`, h18-green-bunkers).
- **White surf** breaks on every rock and at the foot of every cliff. Foam lines are thin and broken, not a solid band (h07-green, h07-morgen, coast-tee-shot).
- **Beaches:** pale sand coves below holes 4 to 10, and Carmel Beach on the far side of the bay, which reads as a white strip (h07-morgen).

## Coastline: cliffs, rocks and the sea wall

- **Cliffs (holes 6, 8, 9 and 10):** near-vertical, 10 to 25 m faces of layered sedimentary rock (sandstone, mudstone and breccia). Colours are ochre and tan in sun and dark grey in shadow, with vertical fractures and ledges. A sharp edge of green turf sits right on top, with white bird guano streaks low down (h06-cliffs, h08-chasm). Swatches: shaded face `#595A59`, lit face `#94816B`.
- **Shore rocks (holes 7, 17 and 18):** low, dark, jagged reefs and boulders at the waterline, wet and almost black at the base (h07-green, h17-green). Inland of them are **pale granite boulders** (Carmel granite), rounded and lichen-spotted (coast-rocks-fescue, point-lobos-cypress `#CBC7BA`), with dark lichen and moss in the shade (lone-cypress `#435B6F` incl. shadowed water).
- **18th-hole sea wall:** the whole left side of 18 is protected by a sloped wall of stacked, rounded grey stones and boulders, about 2 to 4 m high, with sand and loose rocks at its foot. From the fairway, it reads as a thin grey-beige band between the turf and the water (h18-green-bunkers, h18-view-back).
- **Ice plant:** coppery red to orange mats on the rocks (lone-cypress `#604C3B`, mixed with rock).

## Vegetation

- **Monterey cypress** is the icon. It has a dark, almost black-green foliage mass (lone-cypress shadowed foliage `#232C22`, lit pads `#516051` on point-lobos-cypress) held in **flat, horizontal, wind-sheared pads**. Trunks are grey, twisted and often bare in the lower half, and dark when backlit (`#282B2F`). Silhouettes come in three shapes:
  1. The flat-topped "table" cypress on the rocks (lone-cypress, point-lobos-cypress).
  2. The swept, multi-stem cypress leaning away from the sea (coast-headland-cypress, cypress-silhouette-sea).
  3. The tall, dense, layered fairway cypress, such as the famous tree on 18 (h18-fairway-bay, h18-moreira, h18-green-cypress).
- **Monterey pine** forms the backdrop tree line inland and on the far shore: tall, straight trunks with irregular rounded crowns. Seen through the haze, it is darker and bluer than the turf.
- **Coastal scrub and native grass** fill the slopes between the course and the sea: grey-green and olive (h07-green `#50583D`), with straw and blond tufts of fescue (coast-rocks-fescue `#56553F` including stems).

## Turf

- **Fairways** are a deep, slightly yellow-olive green, mown in strong light and dark stripes, never lime (h18-fairway-bay sun `#4F6522`, h08-fairway overcast `#3A6326`).
- **Greens** are lighter and more yellow than the fairway, a smooth Poa annua surface (h07-green `#728D5A`, h17-green `#587829`).
- **Rough and first cut** are darker and coarser than the fairway, kikuyu and rye with olive and brown patches. At the edges they turn tan or straw where the turf dries out (see the lodge photo's worn lawn).
- **Bunkers** have **bright white sand** in sun (bunker-close `#EEE3E1`, shade `#DFD7D5`) that reads pale cream at a distance (h07-green `#D9D3BE`). Faces are steep, with a sharp lip of longer, darker grass or fescue overhanging the sand (h18-green-bunkers, green-bunker-play, h17-green).

## The Lodge and the houses behind 18

- Behind the 18th green stands a long, low, two-storey building with **cream-white walls** (sunlit plaster reads close to `#E6DFCC`; this value is estimated by eye, because the automatic crop hit windows), dark multi-pane windows with striped awnings, and **low-pitched grey-brown shingle roofs** (lodge `#766E66`). Terraces and steps lead down to the lawn.
- The game uses a **generic** cluster of cream, low-roofed coastal buildings among cypress in that position. It is not a replica of the trademarked Lodge, as the brief and the legal note require.
- Houses line the bay behind holes 17 and 18 and on the far shore: small cream and white blocks among pines, softened by haze (h18-across-bay, h18-view-back).

## Biggest gaps against the current build (before this work)

1. A flat, single-colour blue plane for the ocean, with no surf, cliffs or shore rocks.
2. A flat pale sky colour with no sun, no tone mapping and no aerial haze toward the far shore.
3. Lime-saturated turf palette targets (fairway `#68B05C`, rough `#3E8A42`) where the photos show olive (`#4F6522`).
4. Cream-yellow bunker sand (`#E3D3A8`) where the photos show near-white.
5. Low-poly, flat-shaded code trees that do not read as Monterey cypress.
