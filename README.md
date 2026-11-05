# Ace

A multiplayer golf race in the browser. Up to four players per lobby race through the holes; the first to hole out wins, and strokes only break ties within one second.

**Play:** https://ace-x92s.onrender.com (the free host sleeps when idle, so the first load can take about a minute)

## How to play
- Open the link, enter a name, create or join a lobby, mark ready and let the host press Start. A lone host can start a solo time trial.
- **Move:** WASD. **Clubs:** keys 1 to 0, `-`, `=`, `O` (14-club bag), `P` for the putter.
- **Swing:** press Space near your ball, then time Z (hips), X (shoulders) and C (release) against the backswing. Putting: hold Z, release to strike.
- A keyboard is required.

## Develop
`npm install`, `npm test`, `npx vite build`, then `npx tsx src/server/main.ts` (serves the client, `/ws` and `/healthz` on `PORT`).
Architecture and decisions: `docs/decisions/`. Spec: `PRD/`.

## Credits
All art and sound are generated for this game: audio with ElevenLabs (see `assets/manifest.json`); visuals are code-built. Three.js and `ws` are used as libraries.
