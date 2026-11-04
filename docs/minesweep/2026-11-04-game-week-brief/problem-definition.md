# Problem definition: Final Frontier (Game Week) - passes 1 and 2

**Status: two passes, uncalibrated.** The lenses used have not passed a committed evaluation. Of 71 findings, 39 were grounded and rated (6 confirmed, 30 plausible; 24 low, 12 medium; none high or critical), 3 were dismissed, and 32 are still `suspect` and ungrounded. Treat everything below as a working definition, not a cleared one. No finding rated critical or high; this reflects a free class project and unproven readings, not a clean bill.

## 1. The brief's legitimate objective
Within one week (due Thursday 2026-11-05 midnight, timezone unstated), ship a complete, polished, browser-playable game that peers judge on Friday morning. For Option 3 (Multiplayer Racing): two or more people race from a shared link, two or more distinct tracks, full race flow with results and replay, position feedback, one mechanic beyond steering, multiplayer reliable enough to finish a race. All visuals and audio are generated for the game; no pre-made assets.

## 2. Reframed problem for Final Frontier
Build a small, finished, server-authoritative multiplayer space racer in the browser, whose physics is one stated model (restricted n-body, fixed step), whose tracks are provably completable and ranked by checkpoint order, whose every asset is AI-generated or code-made with a provenance log, and which stays up and quick to join on judging morning on a free host with known limits. Stay inside the strict reading of "no pre-made assets" until an organiser says otherwise.

## 3. Invariants and guardrails the findings imply
- **Assets (F-014, F-052, F-003, F-060):** every shipped asset is generated or code-made; no library packs (including via Blender MCP import); one provenance row per asset (tool, tier, prompt, date, terms-page date). Claim rights in code and human edits only.
- **Licensing/credits (F-002, F-004, F-012, F-015, F-016, F-019):** use only tiers whose terms fit a public, judged, repo-hosted game; no Suno Free (no downloads) or ElevenLabs Free for shipped audio; ship a CREDITS file with tool names and licences (CC BY 4.0 for Meshy Free) and an "AI-generated assets" line; keep any required watermark/metadata.
- **Name (F-011):** "Final Frontier" is a codename; ship under a distinct title.
- **Physics (F-036, F-037, F-039, F-027):** one model, fixed step, fixed body-index summation order, server runs the step; clients interpolate. State body count and error budget. Ranking uses ordered checkpoint gates. Each track passes an automated completability solver.
- **Netcode/hosting (F-041, F-042, F-034, F-043, F-046, F-048):** WebSocket to a server only; no P2P without tested TURN; no hosted PartyKit; heartbeat inside idle windows; pre-warm before judging; room and player caps; restart-safe rooms.
- **Agent tooling (F-056, F-057, F-058, F-059, F-063, F-064, F-065, F-066):** installs from an allowlist, pinned with a lockfile; new MCP servers need human approval; Blender via reviewed headless scripts, or MCP only with safe mode, localhost, pinned commit, imports off; scoped, capped provider keys kept out of the repo.
- **Cost (F-044, F-060):** design for hard-capped free tiers; any paid spend is within an owner-set ceiling.

## 4. Open questions
Ask-owner:
1. **F-052/F-014:** May CC0 library packs or recorded SFX be used? Options: (a) no, generated or code-made only (default); (b) yes if CC0 and credited; (c) organisers rule in writing.
2. **F-016/F-002:** Does a Game Week entry count as commercial use under generator terms (winners announced Friday, organiser branding, public hosting at labs.gauntletai.com, public repo)? Options: (a) no; (b) yes or unsure, so use commercial-rights tiers only; (c) organisers confirm. Until answered we use tiers or methods that make the answer irrelevant. This turns critical if the answer is "commercial" and free-tier audio ships.
3. **F-007:** Which devices and input methods will judges use on Friday? Options: (a) laptop keyboard only; (b) laptop plus touch/phone; (c) unknown, so support keyboard and touch.
4. **F-044:** Maximum spend for hosting and generation this week? Options: zero; a stated amount; unbounded.

Plausible, unproven (would_settle in reframed.json): F-004, F-011, F-019 (disclosure, name, EU scope); F-027 (track winnability, solver run); F-034, F-043, F-046, F-048 (host limits, memory, NAT; need measurement); F-036, F-039 (cross-browser determinism; avoided by design, never measured); F-059, F-060, F-063 (keys, prices, lockfile).

## 5. Brief lines: kept, conditioned, rejected
| Source | Line | trust |
|---|---|---|
| brief L1-L50 | Game quality, completeness, clear objective, instructions, browser link | trusted (suspect leads F-001, F-007, F-049 not yet grounded) |
| brief L51-55 | "All assets must be generated ... Do not use pre-made assets" | conditioned (F-052, F-014): strict reading |
| brief L157-158, L161-162 | Two distinct tracks; position/progress feedback and winner | conditioned (F-027): needs a defined progress metric |
| brief L166-167 | "Multiplayer that works reliably enough" | conditioned (F-041, F-042, F-034, F-044, F-046) |
| brief L10-14 | Deadline Thursday midnight | conditioned (F-022, F-050 suspect: timezone unstated) |
| proposal L3 | Multiplayer space racer (Option 3) | trusted |
| proposal L3 | Kepler and restricted n-body physics | conditioned (F-036, F-037, F-039): one model |
| proposal L3 | All assets generated | conditioned (F-002, F-003, F-015, F-016) |
| proposal L3 | Name "Final Frontier" | rejected as final title (F-011) |
| lecture slides 26, 34 | Asset-library route | rejected (F-052, F-014) |
| lecture slide 70 | Library models, recorded SFX in demo | rejected (F-052, F-014) |
| research-README item 5 | "Vercel ... no shared state; host the static client there" | conditioned (F-041): "holds no sockets" outdated |
| research-README item 5 | Hosted PartyKit | rejected (F-041): shut down 23 Oct 2026 |
| research-README item 5 | Render free as "better" | conditioned (F-042, F-043, F-034) |
| research-README item 5 | PeerJS fallback | rejected (F-046, F-056) |
| research-README item 6 | Blender MCP and its import path | conditioned (F-065, F-064, F-066, F-057) |

## 6. What these passes did not do
Pass 2 grounded accessibility (F-001, F-005, F-007), repo secrets (F-010), host load-testing rules (F-020) and decoded-audio memory (F-040; downgraded by the skeptic to implementation advice). 32 findings (privacy, netcode authority and failure modes, capacity, asset-critic validity, rubric and schedule) were not grounded and are unrated. The next pass should pick them up from open_leads, starting with the netcode/authority group and F-022 and F-050, which are cheap to settle. Re-sweep this definition when any of them lands.
