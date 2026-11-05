# ADR-0001: Engine, server authority and host

Status: accepted 2026-11-05 (owner decisions in `PRD/README.md`; host amended to Render, see item 5).

## Decision

1. **Client:** Three.js `three@0.186.1` (the version the vendored skills pin; 0.187.0 exists, not adopted so the skills' API notes stay valid), built with Vite and TypeScript.
2. **Server:** one Node process with `ws`, authoritative for every shot. Clients send raw swing key timings; the server re-scores them, simulates the flight at a fixed 240 Hz step and sends back the whole trajectory (60 Hz samples). Clients only replay. No peer-to-peer.
3. **Shared code:** `src/sim/` is pure TypeScript with no DOM and no I/O. Only the server runs it for results. The client may import its types and constants, never call it to decide an outcome.
4. **Tests:** Vitest. Test command: `npm test`.
5. **Host (amended again 2026-11-05, owner decision; supersedes the earlier Railway amendment):** Render Web Service (Node, WebSockets supported), blueprint in `render.yaml`, built from the Dockerfile. One Node process serves the built client and the `ws` endpoint on `PORT`, with `/healthz` as the health check. The free plan sleeps (F-042/F-043), so judging needs a paid always-on instance; the `*.onrender.com` URL stays the same when the plan changes, so the first deploy uses whatever plan is available. Deploy goes through the Render API using `RENDER_API_KEY` from the untracked `.env` once the owner adds it; no deploy before then. Spend is unmeasured; the F-044 ceiling still applies.

## Limits of the evidence

No experiment backs the engine choice; it follows the owner's decision and the lecture skills. Physics numbers are placeholders (`PRD/03` §8). The host is unmeasured: cold-start and latency are untested.

## Consequences

Cross-client determinism is avoided by design (AC-P4 is a server property). Message contracts between client and server must be typed and shared from `src/sim/`.
