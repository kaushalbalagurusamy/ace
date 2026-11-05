# Ace

A multiplayer golf race in the browser. Up to four players per lobby race through the holes; the first to hole out wins, and strokes only break ties within one second.

**Play:** https://ace-x92s.onrender.com

Course: **Pebble Beach Golf Links** (name approved by the course). Hole 1 is playable now; the full 18-hole card is being added.

## How to play
- Open the link, enter a name, create or join a lobby (up to 3 lobbies, 4 players each), mark ready, and the host presses Start. A lone host can start a solo time trial.
- **Move** with WASD. **Look and aim** with the mouse. There is **no aim line**: line up by eye, and use the mini map and its rangefinder to choose a club.
- **Clubs:** keys 1 to 0, `-`, `=`, `O` (14-club bag); `P` is the putter.
- **Swing:** stand by your ball and press **Space** to take your stance (the aim locks). Then **press and hold Space**: the club swings back and a meter fills. **Release Space** at the length you want, since a short hold is a short shot, and press **Z** (hips), **X** (shoulders) and **C** (release) in order right after the release. Good timing gives a long, straight shot; early or late keys cost distance and send the ball left or right. **Esc** cancels before the release.
- **Putt:** equip the putter (P), press Space for the stance, hold **Space** to draw the putter back, and release it to strike: the longer the hold, the harder the putt.
- **Shot card:** after every shot you see carry, total distance, how far offline, club and ball speed, and how well you timed Z, X and C.
- **Winning:** first to hole out wins; fewer strokes only decides finishes within one second of each other. A room lasts at most 20 minutes, and once someone finishes the others have one minute.
- A keyboard is required (touch screens see a notice).

## Develop
`npm install`, `npm test`, `npx vite build`, then `npx tsx src/server/main.ts` (serves the client, `/ws` and `/healthz` on `PORT`).
Architecture and decisions: `docs/decisions/`. Spec: `PRD/`.

## Credits
All art and sound are generated for this game, with a provenance row for each file in `assets/manifest.json`: audio with ElevenLabs, 3D models with Meshy (seeded by our own images from OpenAI `gpt-image-2-2026-04-21` where noted), ground textures with OpenAI images, and the rest built in code. Three.js and `ws` are used as libraries. Course: Pebble Beach Golf Links.
