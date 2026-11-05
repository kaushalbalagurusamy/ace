# ADR-0001: Engine, server authority and host

Status: accepted 2026-11-05 (owner decisions in `PRD/README.md`; host default applied because the owner answered "defaults").

## Decision

1. **Client:** Three.js `three@0.186.1` (the version the vendored skills pin; 0.187.0 exists, not adopted so the skills' API notes stay valid), built with Vite and TypeScript.
2. **Server:** one Node process with `ws`, authoritative for every shot. Clients send raw swing key timings; the server re-scores them, simulates the flight at a fixed 240 Hz step and sends back the whole trajectory (60 Hz samples). Clients only replay. No peer-to-peer.
3. **Shared code:** `src/sim/` is pure TypeScript with no DOM and no I/O. Only the server runs it for results. The client may import its types and constants, never call it to decide an outcome.
4. **Tests:** Vitest. Test command: `npm test`.
5. **Host (default, no ADR-level evidence yet):** a single always-on WebSocket host with the static client served by the same Node process. Free-tier hosts that sleep (Render free, F-042/F-043) are rejected for judging time. Provider is chosen at deploy time within a $0 extra spend ceiling (F-044 default); if no free always-on host works, that is a recorded blocker for the owner, not a silent downgrade.

## Limits of the evidence

No experiment backs the engine choice; it follows the owner's decision and the lecture skills. Physics numbers are placeholders (`PRD/03` §8). The host is unmeasured: cold-start and latency are untested.

## Consequences

Cross-client determinism is avoided by design (AC-P4 is a server property). Message contracts between client and server must be typed and shared from `src/sim/`.
