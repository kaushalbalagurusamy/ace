# ADR-0001: Engine, server authority and host

Status: accepted 2026-11-05 (owner decisions in `PRD/README.md`; host amended to Railway, see item 5).

## Decision

1. **Client:** Three.js `three@0.186.1` (the version the vendored skills pin; 0.187.0 exists, not adopted so the skills' API notes stay valid), built with Vite and TypeScript.
2. **Server:** one Node process with `ws`, authoritative for every shot. Clients send raw swing key timings; the server re-scores them, simulates the flight at a fixed 240 Hz step and sends back the whole trajectory (60 Hz samples). Clients only replay. No peer-to-peer.
3. **Shared code:** `src/sim/` is pure TypeScript with no DOM and no I/O. Only the server runs it for results. The client may import its types and constants, never call it to decide an outcome.
4. **Tests:** Vitest. Test command: `npm test`.
5. **Host (amended 2026-11-05 by supervisor/owner):** Railway. It supports WebSockets, stays always-on and gives a stable `*.up.railway.app` URL that can be submitted by the midnight deadline and polished in place until 08:00 Fri. One Node process serves the built client and the `ws` endpoint on `PORT`, with a `/healthz` route. Deploy is a Dockerfile. The owner runs `railway login`; no agent deploys before that. Render free (sleeps, F-042/F-043) stays rejected. Spend on Railway is unmeasured; F-044 ceiling still applies.

## Limits of the evidence

No experiment backs the engine choice; it follows the owner's decision and the lecture skills. Physics numbers are placeholders (`PRD/03` §8). The host is unmeasured: cold-start and latency are untested.

## Consequences

Cross-client determinism is avoided by design (AC-P4 is a server property). Message contracts between client and server must be typed and shared from `src/sim/`.
