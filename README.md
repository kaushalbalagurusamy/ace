# Ace

A multiplayer golf race in the browser. Up to four players per lobby race through the holes; the first to hole out wins, and strokes only break ties within one second.

**Play:** https://ace-x92s.onrender.com

Course: **Pebble Beach Golf Links** (name approved by the course). Hole 1 is playable now; the full 18-hole card is being added.

## How to play
- Open the link, enter a name, create or join a lobby (up to 3 lobbies, 4 players each), mark ready, and the host presses Start. A lone host can start a solo time trial.
- **Move** with the **arrow keys**; hold **Shift** to walk slowly and aim finely. **Look and aim** with the mouse (`,` and `.` change the look speed, or use the gear menu). There is **no aim line**: line up by eye, and press **M** for the rangefinder.
- **Golf cart (Genesis Box Buggy):** your cart waits beside you on every tee. Press **E** within 3 m to get in or out. In the cart the **arrow keys drive** (Up throttle, Down brake and reverse, Left and Right steer) and the mouse orbits the camera. Carts stay off greens, fringes, tees, bunkers and water, run slower in the rough and bump each other. You cannot swing from the cart: press E to get out.
- **Clubs:** keys 1 to 0, `-`, `=`, `O` (14-club bag); `P` is the putter. You can change club until you start the backswing.
- **Swing:** walk to your ball and press **Space** to take your stance. The mouse still turns your aim, and **W S A D** set the ball position (forward/back for launch, away/closer for a draw or a fade). Then **press and hold Space** and **release to hit**: the meter fills in 0.75 s, a shorter hold is a shorter shot. Keep holding into the red zone for a **MAX effort** shot (20% further, 70% accurate). **Esc** cancels before you release.
- **Putt:** equip the putter (P), press Space for the stance, hold **Space** to draw the putter back, release it to strike: the longer the hold, the harder the putt.
- **Shot card:** after every shot you see carry, total distance, how far offline, club and ball speed, the ball position you used and whether it was a normal or MAX effort shot.
- **Winning:** first to hole out wins; fewer strokes only decides finishes within one second of each other. A room lasts at most 20 minutes, and once someone finishes the others have one minute.
- A keyboard is required (touch screens see a notice).

## Develop
`npm install`, `npm test`, `npx vite build`, then `npx tsx src/server/main.ts` (serves the client, `/ws` and `/healthz` on `PORT`).
Architecture and decisions: `docs/decisions/`. Spec: `PRD/`.

## Credits
All art and sound are generated for this game, with a provenance row for each file in `assets/manifest.json`: audio with ElevenLabs, 3D models with Meshy (seeded by our own images from OpenAI `gpt-image-2-2026-04-21` where noted), ground textures with OpenAI images, and the rest built in code. Three.js and `ws` are used as libraries. Course: Pebble Beach Golf Links.
