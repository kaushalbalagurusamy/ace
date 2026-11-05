
## Anti-cheat on swing timing (rank: low, after the 18-hole race works)
Source: automated security review, 2026-11-05. The server trusts client-reported Z/X/C timings (`PRD/02` §3 design: client sends raw times, server re-scores and rejects impossible input). A scripted client can send ideal timings every shot. Options: server-side swing-start nonce and receive-time sanity bounds, reject exactly-ideal streaks. Disposition: accepted risk for the judged build; revisit if time remains.

## Plan items added 2026-11-05 (supervisor/owner), ranked
1. **Load test before 08:00 (rank: high).** Script simulating 12 racers in 3 lobbies plus 40 idle waiting-room sockets against https://ace-x92s.onrender.com; record p95 shot-resolution latency and server memory in `docs/submission.md`.
2. **Server-lightness rules (rank: high).** Static assets from disk with cache headers, never held in memory (currently read per request, no cache headers); terrain grid about 1 m; simulate per shot, not on a global tick (already per shot).
3. **Client nits found by the smoke run (rank: medium).** Hole number shows 0-based ("Hole 0"); a held-key swing sent only `zMs` in one scripted run (check X/C capture with a real backswing cadence); other players' golfers are drawn at their ball, not walking.
4. **Known sim gap (rank: medium).** `simulateShot` has no bounce or roll (`totalM == carryM`); the server adds a rough roll. PRD/03 §5 bounce model and §8 sourced numbers are still open.
5. **18 holes (rank: high).** Server has one hand-built hole; `hole(index)` exists to extend.
