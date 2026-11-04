# Minesweeper trap register

- Brief: `docs/minesweep/2026-11-04-game-week-brief/brief.md` (sha256 `f84b7ad9b107`)
- Run: 2026-11-04, mode full, skill ?
- Calibrated: **NO: uncalibrated lenses, treat findings as leads**
- Lenses: provider-terms 0.1.0 (uncalibrated), copyright-data-rights 0.1.0 (uncalibrated), licensing 0.1.0 (uncalibrated), ai-regulation 0.2.0 (uncalibrated), accessibility 0.1.0 (uncalibrated), privacy-regulated-data 0.1.0 (uncalibrated), security-ethics 0.1.0 (uncalibrated), realtime-transport 0.1.0 (uncalibrated), distributed-systems 0.1.0 (uncalibrated), numeric-representation 0.1.0 (uncalibrated), performance 0.1.0 (uncalibrated), media-pipelines 0.1.0 (uncalibrated), os-systems 0.1.0 (uncalibrated), theory-complexity 0.1.0 (uncalibrated), rubric-inversion 0.1.0 (uncalibrated), ml-evaluation 0.1.0 (uncalibrated), supply-chain 0.1.0 (uncalibrated), agent-security 0.1.0 (uncalibrated), agent-orchestration 0.2.0 (uncalibrated), market-reality 0.1.0 (uncalibrated), company-context 0.1.0 (uncalibrated)
- Loop: 2 pass(es), stop: iteration-cap; open: F-001, F-002, F-003, F-004, F-005, F-006, F-007, F-008, F-009, F-010, F-011, F-013, F-014, F-016, F-017, F-018, F-019, F-020, F-021, F-022, F-023, F-024, F-025, F-026, F-027, F-028, F-029, F-030, F-031, F-032, F-033, F-034, F-035, F-036, F-037, F-038, F-039, F-040, F-043, F-044, F-046, F-047, F-048, F-049, F-050, F-051, F-053, F-054, F-055, F-056, F-057, F-058, F-059, F-060, F-063, F-064, F-066, F-067, F-068, F-069, F-070, F-071

## Findings

| Id | Tier | Status | Lens / trap | Disposition | Underlying problem |
|---|---|---|---|---|---|
| F-002 | medium | plausible | provider-terms / novel | ask-owner | Choose generators and tiers whose terms permit a public, judged, repo-hosted class game, and record the terms read for each. |
| F-007 | medium | plausible | accessibility / accessibility.not-keyboard-or-pointer-operable | ask-owner | State which input methods the judging setup must support and make the lobby and steering work on them. |
| F-010 | medium | plausible | security-ethics / novel | comply-safely | Keep credentials and unreleased prompts out of a public repo and be able to detect and recover if one leaks. |
| F-014 | medium | plausible | copyright-data-rights,licensing / novel | reframe | Resolve a contradictory instruction on pre-made assets before anything is built. |
| F-027 | medium | plausible | numeric-representation,theory-complexity / novel | reframe | Define what 'ahead' means on an orbital course and prove each track is winnable under thrust limits. |
| F-036 | medium | plausible | media-pipelines,numeric-representation,theory-complexity / novel | reframe | Pick an authority model that does not depend on bit-identical floating point across engines. |
| F-037 | medium | plausible | theory-complexity / novel | reframe | Choose one simulated model and state its body count, fixed step and error budget. |
| F-041 | medium | confirmed | distributed-systems,market-reality,os-systems,performance,supply-chain / novel | reframe | Pick a host whose WebSocket, sleep and quota limits fit a short judged session. |
| F-042 | medium | confirmed | distributed-systems,performance / novel | comply-safely | Make the first join on judging morning fast and not dependent on a sleeping instance. |
| F-052 | medium | confirmed | company-context / company-context.contradicts-published-policy | ask-owner | Establish what 'generated' and 'pre-made' mean for this assignment before assets are produced. |
| F-057 | medium | plausible | supply-chain / supply-chain.autonomous-agent-install | reframe | Set a written policy for what agents may install or run. |
| F-065 | medium | confirmed | agent-security / agent-security.local-server-command-execution | reframe | Use Blender through a path that cannot execute attacker-chosen Python. |
| F-001 | low | plausible | accessibility / novel | comply-safely | Make the game legible on a judge's screen and sound-off setup, with an explicit self-chosen baseline. |
| F-003 | low | plausible | copyright-data-rights,licensing,provider-terms / novel | comply-safely | State what rights are claimed: code, design and human edits yes; raw prompt-only generated assets no exclusivity. |
| F-004 | low | plausible | ai-regulation / novel | comply-safely | Tell players, honestly and cheaply, that the game's art and audio are AI-generated. |
| F-005 | low | plausible | accessibility / accessibility.information-by-single-sense | comply-safely | Give every gameplay-critical cue a second channel so the game works muted and without relying on hue. |
| F-011 | low | plausible | company-context,copyright-data-rights / novel | reframe | Use a title that does not collide with an existing game mark. |
| F-012 | low | confirmed | licensing / novel | comply-safely | Honour attribution and no-strip-watermark duties of whichever tools actually ship. |
| F-015 | low | confirmed | provider-terms / provider-terms.unsupported-region-or-tier | comply-safely | Use tiers whose terms and download limits fit the assets we must ship. |
| F-016 | low | plausible | licensing / licensing.non-commercial-asset-in-paid-product | ask-owner | Decide whether the entry is commercial use so tier choice is made on a fact. |
| F-019 | low | plausible | ai-regulation / ai-regulation.undisclosed-ai-interaction | comply-safely | Record that the game is not an EU-regulated high-risk system and that AI-generated content is disclosed. |
| F-020 | low | plausible | security-ethics / novel | comply-safely | Validate multiplayer capacity without breaching the chosen host's load-testing policy. |
| F-034 | low | plausible | os-systems / os-systems.fd-limit-exhaustion | comply-safely | Keep long-lived sockets alive within the free host's idle and connection limits. |
| F-039 | low | plausible | numeric-representation / numeric-representation.order-dependent-float-aggregation | comply-safely | Make every state-producing computation use one fixed order. |
| F-040 | low | plausible | media-pipelines / media-pipelines.decoded-frames-exceed-memory | comply-safely | Keep audio memory modest by decoding only short effects and streaming or looping long music. |
| F-043 | low | plausible | os-systems / os-systems.memory-limit-oom-kill | comply-safely | Keep the server inside a small free instance's memory. |
| F-044 | low | plausible | market-reality,performance,realtime-transport / novel | ask-owner | State a spend ceiling and a quota plan so the game does not die in the judging window. |
| F-046 | low | plausible | distributed-systems,market-reality,os-systems,realtime-transport / novel | reframe | Do not make joining depend on peer-to-peer NAT traversal on unknown judge networks. |
| F-048 | low | plausible | os-systems / os-systems.thread-or-process-per-request | comply-safely | Bound resource use per process. |
| F-056 | low | plausible | supply-chain / supply-chain.unverified-package-name | comply-safely | Vet netcode dependencies before they enter a public repo. |
| F-058 | low | plausible | agent-security / agent-security.untrusted-tool-servers | comply-safely | Treat tool descriptions from non-first-party servers as untrusted input. |
| F-059 | low | plausible | agent-orchestration / agent-orchestration.standing-broad-credentials | comply-safely | Give build agents the least credential and spend authority needed. |
| F-060 | low | plausible | market-reality / novel | comply-safely | Base tool and tier decisions on verbatim current plan tables. |
| F-063 | low | plausible | supply-chain / supply-chain.unpinned-dependencies | comply-safely | Pin and audit server dependencies in a public repo. |
| F-064 | low | plausible | supply-chain / supply-chain.unverified-provenance | comply-safely | If an MCP tool is used, vet it by source, not popularity. |
| F-066 | low | plausible | agent-security / agent-security.untrusted-content-drives-tools | comply-safely | Keep untrusted asset content out of a code-executing session. |

### F-002: novel finding

- Claims: C-006, C-028, C-029, C-083, C-088, C-093, C-101, C-108, C-109, C-110, C-127, C-128, C-134, C-135, C-140, C-144, C-148, C-150, C-159, C-160; route: grounded-research (Decidable per generator from its current terms page.)
- Evidence (quote, primary, 2026-11-04): https://elevenlabs.io/terms-of-use Free plan use "you may only use the Services for non-commercial purposes"
- Evidence (quote, primary, 2026-11-04): https://elevenlabs.io/terms-of-use Ownership of Output "you retain all rights in and to your Output"
- Evidence (quote, primary, 2026-11-04): https://suno.com/terms free tier output clause "you will only use such Outputs for your lawful, personal and non-commercial purposes"
- Evidence (quote, primary, 2026-11-04): https://suno.com/terms paid-tier ownership; also 'makes no representation or warranty to you that any copyright will vest in any Output'; no attribution duty but must not remove 'any fingerprint, watermark or metadata' "Suno hereby assigns to you all of its right, title and interest in and to any Output owned by Suno"
- Evidence (quote, primary, 2026-11-04): https://www.meshy.ai/pricing Free plan; also '100 monthly credits', downloads limited to '10 Meshy 6 Lite' models/month "CC BY 4.0 license (commercial use with attribution)."
- Evidence (quote, primary, 2026-11-04): https://www.meshy.ai/pricing Pro plan card "Private license for all assets. \| Pro $20/mo, 1,000 monthly credits (up to 100 assets), unlimited downloads"
- Evidence (quote, primary, 2026-11-04): https://suno.com/pricing plan table "Free $0, 50 credits per day, 'No commercial rights', 'No monthly song downloads'; Pro $8/mo, 2,500 credits, 'Commercial use rights', 20 downloads/mo; Premier $24/mo, 60 downloads"
- Evidence (quote, primary, 2026-11-04): https://skybox.blockadelabs.com/plans plans page "essential 100 credits/month '4K exports'; standard 300 credits; business 500 credits, '16K export options', 'Commercial licensing' (listed only under business); no free plan listed; two price sets shown ($20/$48/$112 and $24/$60/$140)"
- Severity medium: first yes = Is it a correctness, measurement, statistical or design flaw that a principal-level reviewer would reject?
- Skeptic: downgraded: Quotes are real, but the finding's bite depends on whether a free, unmonetised class project counts as 'commercial', which no source settles; ElevenLabs/Suno free-tier clauses arguably permit it. The 'data sent / prompt retention' and 'redistribution in public repo' parts were never extracted (statement admits 'unread'), and OpenAI/Stable Audio/PixelLab were not fetched. Settles it: the assignment organiser's statement on commercial status, plus the chosen generator's output-redistribution clause.
- **Owner question:** Is a Game Week entry (peer-judged, winners announced Friday, hosted at labs.gauntletai.com, public repo) a commercial use? Options: (a) no, personal/educational, free tiers acceptable; (b) yes or unsure, so use only tiers with commercial rights; (c) ask the organisers.
- Spec section that must answer it: `legal-terms`

### F-007: accessibility.not-keyboard-or-pointer-operable

- Claims: C-024, C-025, C-042, C-064, C-074, C-090; route: retrieval (WCAG 2.1.1 text plus a decision on supported input set.)
- Evidence (quote, primary, 2026-11-04): https://www.w3.org/TR/WCAG22/ SC 2.1.1 #keyboard "All functionality of the content is operable through a keyboard interface"
- Evidence (quote, primary, 2026-11-04): https://www.w3.org/TR/xaur/ XAUR sec 3.6 "The remapping of keys used to control movement or interaction in virtual environments is not currently required by WCAG."
- Evidence (quote, primary, 2026-11-04): https://www.w3.org/TR/xaur/ XAUR sec 3.1 "There are also currently very useful accessibility guidelines available that are specific to gaming."
- Evidence (note, primary, 2026-11-04): https://www.w3.org/TR/WCAG22/  "Scope note: WCAG is cited as a guideline only. The brief names no accessibility standard and no legal duty is claimed for this class project. Fetched via a summarising tool that caps quotes at 125 chars, so quotes are fragments of the normative sentences."
- Severity medium: first yes = Is it a correctness, measurement, statistical or design flaw that a principal-level reviewer would reject?
- **Owner question:** Which devices and input methods will judges use on Friday? Options: (a) laptop keyboard only; (b) laptop plus touch/phone; (c) unknown, so support keyboard and touch.
- Spec section that must answer it: `product-scope`

### F-010: novel finding

- Claims: C-077; route: check (Secret scan and pre-commit hook.)
- Evidence (quote, primary, 2026-11-04): https://docs.gitlab.com/user/application_security/secret_detection/ GitLab secret detection overview, response section "You should always revoke and replace exposed secrets as soon as possible."
- Evidence (quote, primary, 2026-11-04): https://docs.gitlab.com/user/application_security/secret_detection/secret_push_protection/ GitLab push protection page; page lists Tier: Ultimate and does not mention public projects "To use this feature, you must enable it per project."
- Evidence (quote, primary, 2026-11-04): https://docs.github.com/en/code-security/secret-scanning/introduction/about-secret-scanning GitHub about-secret-scanning, public repositories "Secret scanning runs automatically for free."
- Evidence (quote, primary, 2026-11-04): https://docs.github.com/en/code-security/secret-scanning/introduction/about-secret-scanning GitHub about-secret-scanning, alerts "When you receive an alert, rotate the affected credential immediately to prevent unauthorized access."
- Evidence (note, secondary, 2026-11-04): https://labs.gauntletai.com  "curl -sI returned HTTP/2 302, server: Elestio, on 2026-11-04. Consistent with the known redirect to /users/sign_in on GitLab, but I did not inspect Location or version, and cannot confirm which security features are enabled."
- Severity medium: first yes = Is it a correctness, measurement, statistical or design flaw that a principal-level reviewer would reject?
- Spec section that must answer it: `crypto-agent-security`

### F-014: novel finding

- Claims: C-095, C-126, C-129, C-137, C-139, C-142, C-146, C-149, C-150, C-153, C-157; route: grounded-research (Per-library licence page decides; the rule question belongs to the organisers.)
- Evidence (quote, primary, 2026-11-04): docs/source/brief.md 'GENERATE ALL ASSETS' box "Do not use pre-made assets."
- Severity medium: first yes = Is it a correctness, measurement, statistical or design flaw that a principal-level reviewer would reject?
- Spec section that must answer it: `legal-terms`

### F-027: novel finding

- Claims: C-065, C-067, C-079, C-082, C-092, C-193; route: experiment (Playtests or a solver run show winnability.)
- Severity medium: first yes = Is it a correctness, measurement, statistical or design flaw that a principal-level reviewer would reject?
- Spec section that must answer it: `product-scope`

### F-036: novel finding

- Claims: C-079, C-080, C-081, C-082, C-087, C-089, C-091, C-107; route: experiment (A same-seed run hashed across engines is the decider.)
- Evidence (quote, primary, 2026-11-04): https://tc39.es/ecma262/ 6.1.6.1 The Number Type "The Number type has exactly 18,437,736,874,454,810,627 (that is, 264 - 253 + 3) values, representing the double-precision floating point IEEE 754-2019 binary64 values as specified in the IEEE Standard for Binary Floating-Point Arithmetic"
- Evidence (quote, primary, 2026-11-04): https://tc39.es/ecma262/ 21.3.2.33 Math.sqrt ( x ) "Return 𝔽(the square root of ℝ(n))."
- Evidence (quote, primary, 2026-11-04): https://tc39.es/ecma262/ 21.3.2.31 Math.sin ( x ) "Return an implementation-approximated Number value representing the sine of ℝ(n)."
- Evidence (quote, primary, 2026-11-04): https://tc39.es/ecma262/ Conformance: kinds of deferral "An implementation-approximated facility is one that defers its definition to an external source while recommending an ideal behaviour. While conforming implementations are free to choose any behaviour within the constraints put forth by this specification, they are encouraged to strive to approximate the ideal. Some mathematical operations, such as Math.exp, are implementation-approximated."
- Evidence (experiment, -, 2026-11-04): /private/tmp/claude-501/-Users-kaushal/0a2c1e26-0f94-48f5-8ab8-e74094b6f0eb/scratchpad/nbody.js node run "perturb 1e-12 -> 5.9e-8 after 1e5 steps; order change -> 9.65e-10"
- Severity medium: first yes = Is it a correctness, measurement, statistical or design flaw that a principal-level reviewer would reject?
- Skeptic: downgraded: The spec point is correct: ES Math.sin is 'implementation-approximated' (verified), arithmetic and sqrt are exact. But (a) no cross-engine run was done; the experiment used V8 only and shows sensitivity to perturbation/order, not engine disagreement; (b) the proposal claim C-089 itself offers 'or a server is authoritative', so the hazard only applies to lockstep designs; (c) the 6e4x amplification is one 3-source velocity-Verlet scenario, dt=0.001, single run, and does not generalise to other setups. Settles it: run the same script on SpiderMonkey/JSC, or just use a server-authoritative design.
- Spec section that must answer it: `capacity-physics`

### F-037: novel finding

- Claims: C-080, C-081, C-087, C-091, C-194; route: grounded-research (Decidable from orbital mechanics references plus a chosen design.)
- Evidence (quote, primary, 2026-11-04): https://arxiv.org/html/2506.17867 arXiv 2506.17867 (Liu & Salomao), section 1 "Consider two primaries moving along circular orbits about their center of mass. A massless satellite moves in the same plane under Newtonian attraction."
- Evidence (quote, primary, 2026-11-04): https://arxiv.org/html/2506.17867 section 4 "Hamilton's equations of E_mu are equivalent to q'' = -mu (q-m(t))/\|q-m(t)\|^3 - (1-mu)(q-e(t))/\|q-e(t)\|^3"
- Evidence (quote, primary, 2026-11-04): https://tlakoba.w3.uvm.edu/math337/for_final_topics/SSM_1990_Yoshida.pdf Yoshida, Phys. Lett. A 150 (1990), Introduction "the discrete mapping obtained describes the exact time evolution of a slightly perturbed Hamiltonian system and thus possesses the perturbed Hamiltonian as a conserved quantity. This guarantees that there is no secular change in the error of the total energy"
- Evidence (quote, primary, 2026-11-04): https://tlakoba.w3.uvm.edu/math337/for_final_topics/SSM_1990_Yoshida.pdf same "If the integrator is not symplectic, the error of the total energy grows secularly in general."
- Evidence (experiment, -, 2026-11-04): /private/tmp/claude-501/-Users-kaushal/0a2c1e26-0f94-48f5-8ab8-e74094b6f0eb/scratchpad/nbody.js node run "ship position difference vs 1e-12 perturbation: 5.9e-8 at 1e5 steps"
- Severity medium: first yes = Is it a correctness, measurement, statistical or design flaw that a principal-level reviewer would reject?
- Skeptic: downgraded: 'Mismatch' is not shown: the restricted three-body setup the proposal likely means (analytic-orbit primaries, massless ship stepped numerically) is exactly the arXiv model quoted and the finding's own note says so. What stands is that the brief/proposal omits body count, dt and accuracy budget (C-194), and that the ship is stepped, not closed-form. Yoshida quotes support symplectic energy behaviour only for fixed step. Experiment is one scenario on one engine.
- Spec section that must answer it: `capacity-physics`

### F-041: novel finding

- Claims: C-117, C-120, C-121; route: grounded-research (Each is one decidable fact on current vendor docs.)
- Evidence (quote, primary, 2026-11-04): https://vercel.com/docs/plans/hobby Hobby plan page, last_updated 2026-09-14 "the Hobby plan restricts users to non-commercial, personal use only. / Vercel Function maximum duration \| 300s (5 minutes)"
- Evidence (quote, primary, 2026-11-04): https://vercel.com/docs/functions/websockets WebSockets doc, last_updated 2026-08-10 "> WebSockets are available on all plans ... Vercel Functions can serve WebSocket connections ... A single WebSocket connection is pinned to one Vercel Function instance. ... WebSocket connections close when a Vercel Function reaches its maximum duration. ... Store durable state, presence, counters, rooms, and pub/sub coordination in an external data store instead of relying on in-memory variables."
- Evidence (quote, primary, 2026-11-04): https://docs.partykit.io/guides/migrate-to-partyserver/ migration guide intro + timeline (also docs.partykit.io home banner) "The hosted PartyKit platform is shutting down. Deploys stop on 16 October and the platform shuts down on 23 October 2026. / 23 October 2026: `npx partykit deploy` to your own Cloudflare account stops working. Workers already in your account keep running."
- Evidence (quote, primary, 2026-11-04): https://developers.cloudflare.com/durable-objects/platform/pricing/ DO pricing page "Free: Requests "100,000 / day", Duration "13,000 GB-s / day"; "For compute requests billing-only, a 20:1 ratio is applied to incoming WebSocket messages"; "Only Durable Objects with SQLite storage backend are available.""
- Evidence (quote, primary, 2026-11-04): https://render.com/docs/free free-instances page, fetched via WebFetch summariser (quotes as returned) "Render spins down a Free web service that goes "15 minutes without receiving any inbound traffic." / Spin-up "takes about one minute" / "750 Free instance hours" / "Do not use them for production applications.""
- Severity medium: first yes = Is it a correctness, measurement, statistical or design flaw that a principal-level reviewer would reject?
- Skeptic: upheld: All cited constraints verified: Vercel Hobby non-commercial and 300s cap, Render sleep, PartyKit shutdown 23 Oct 2026 with deploys stopping 16 Oct. Narrowing: Vercel Hobby non-commercial is a non-issue for a free class project, and the finding itself refutes C-117's 'no sockets'. Brief names no host, so this is a constraint list, not a breach.
- Spec section that must answer it: `capacity-physics`

### F-042: novel finding

- Claims: C-118; route: experiment (Cold-start time on the real plan is measured.)
- Evidence (quote, primary, 2026-11-04): https://render.com/docs/free free-instances page, fetched via WebFetch summariser (quotes as returned) "Render spins down a Free web service that goes "15 minutes without receiving any inbound traffic." / Spin-up "takes about one minute" / "750 Free instance hours" / "Do not use them for production applications.""
- Evidence (quote, primary, 2026-11-04): https://render.com/docs/free free-instances page, traffic section "existing WebSocket messages count as activity that prevents spin-down; new WebSocket connections wake a spun-down service (paraphrase by fetch tool, not verbatim)"
- Severity medium: first yes = Is it a correctness, measurement, statistical or design flaw that a principal-level reviewer would reject?
- Skeptic: upheld: Render doc verified directly: spins down after 15 minutes without inbound traffic and spins up on next request or new WebSocket. Conditional on choosing Render free; 'about one minute' is the vendor's figure. Duplicates F-061.
- Spec section that must answer it: `capacity-physics`

### F-052: company-context.contradicts-published-policy

- Claims: C-029, C-076, C-077, C-085, C-095, C-137, C-139, C-142, C-146, C-148, C-149, C-150, C-152, C-153, C-154, C-157; route: none (ask-owner: only the organisers can say which governs.)
- Evidence (quote, primary, 2026-11-04): docs/source/lecture-2026-11-02-game-assets.md slide 26, 'Three ways to get visual assets', item 3 "3 Asset libraries ... Packs and models that artists have already made. Kenney · Poly Haven · itch.io"
- Evidence (quote, primary, 2026-11-04): docs/source/lecture-2026-11-02-game-assets.md slide 34, 'Library assets' "Look for a coherent pack with the scale, camera, and license your game needs."
- Evidence (quote, primary, 2026-11-04): docs/source/lecture-2026-11-02-game-assets.md slide 70, 'Sky Roadster' (game demo) "Art: Library models + code-built scenery ... SFX: Recorded vehicle and air sounds"
- Evidence (quote, primary, 2026-11-04): docs/source/brief.md 'GENERATE ALL ASSETS' box "All assets must be generated for your game, including visuals and audio such as sprites, characters, environments, sound effects, and music. Do not use pre-made assets."
- Severity medium: first yes = Is it a correctness, measurement, statistical or design flaw that a principal-level reviewer would reject?
- Skeptic: upheld: Brief text verified verbatim ('Do not use pre-made assets'); slide 26 'Packs and models that artists have already made', slide 34 library advice, and slide 70-ish demo 'Library models + code-built scenery' / 'Recorded vehicle and air sounds' verified in the lecture file. The brief is unambiguous on its face and a careful builder would obey it, so the reader-level risk is smaller than stated, but the organiser's own materials teach and demo the banned route, which is a genuine trap for anyone following the slides. Which governs is not stated.
- **Owner question:** May CC0 library packs (Kenney, Poly Haven, Freesound) or recorded SFX be used, given the brief says 'Do not use pre-made assets' but the lecture teaches them? Options: (a) no, generated or code-made only (our default); (b) yes, if licensed CC0 and credited; (c) organisers to rule in writing.
- Spec section that must answer it: `legal-terms`

### F-057: supply-chain.autonomous-agent-install

- Claims: C-088, C-203; route: check (A stated approval rule plus allowlist settles it.)
- Evidence (quote, primary, 2026-11-04): https://modelcontextprotocol.io/specification/2025-06-18/index.md Security and Trust & Safety > Tool Safety "Tools represent arbitrary code execution and must be treated with appropriate caution. In particular, descriptions of tool behavior such as annotations should be considered untrusted, unless obtained from a trusted server."
- Evidence (quote, primary, 2026-11-04): https://modelcontextprotocol.io/specification/2025-06-18/index.md Tool Safety "Hosts must obtain explicit user consent before invoking any tool"
- Severity medium: first yes = Is it a correctness, measurement, statistical or design flaw that a principal-level reviewer would reject?
- Skeptic: downgraded: MCP spec text verified, but it governs hosts invoking tools, not who may install servers, and the user's own agent harness already has a permission system. The finding assumes an agent installs and calls tools without approval; nothing shows the project does. Brief silence is real (C-203 omission).
- Spec section that must answer it: `crypto-agent-security`

### F-065: agent-security.local-server-command-execution

- Claims: C-124, C-141, C-145; route: grounded-research (The addon's listening address and auth is a decidable fact.)
- Evidence (quote, primary, 2026-11-04): https://raw.githubusercontent.com/ahujasid/blender-mcp/main/README.md README line ~405 Note "the addon's socket server has no authentication or encryption, so anyone who can reach that port can run Python inside Blender. Keep it on `localhost` unless you are on a trusted network"
- Evidence (quote, primary, 2026-11-04): https://raw.githubusercontent.com/ahujasid/blender-mcp/main/README.md README line ~850 Warning "The `execute_blender_code` tool allows running arbitrary Python code in Blender, which can be powerful but potentially dangerous. Use with caution in production environments. **ALWAYS save your work before using it.**"
- Evidence (quote, primary, 2026-11-04): https://raw.githubusercontent.com/ahujasid/blender-mcp/main/README.md README Safe mode "By default, the AI can run any Python code in Blender. Set `BLENDER_MCP_SAFE_MODE=1` to check every script before it runs and block risky code"
- Evidence (quote, primary, 2026-11-04): https://raw.githubusercontent.com/ahujasid/blender-mcp/main/addon.py addon.py _blendermcp_bind_address "Non-loopback binding requires Allow Remote Connections in add-on preferences"
- Severity medium: first yes = Is it a correctness, measurement, statistical or design flaw that a principal-level reviewer would reject?
- Skeptic: upheld: README quotes verified: no authentication or encryption on the socket, arbitrary Python via execute_blender_code, safe mode off by default (BLENDER_MCP_SAFE_MODE=1). Mitigations already exist (localhost default, remote bind opt-in, safe mode), and risk only materialises if the optional tool is used, so severity is moderate, not critical.
- Spec section that must answer it: `crypto-agent-security`

### F-001: novel finding

- Claims: C-005, C-012, C-013, C-017, C-020, C-023, C-151; route: retrieval (WCAG success-criteria text defines the baseline; choosing a level is an owner decision.)
- Evidence (quote, primary, 2026-11-04): https://www.w3.org/TR/WCAG22/ SC 1.4.3 #contrast-minimum "The visual presentation of text and images of text has a contrast ratio of at least 4.5:1, except for the following:"
- Evidence (note, primary, 2026-11-04): https://www.w3.org/TR/WCAG22/  "Scope note: WCAG is cited as a guideline only. The brief names no accessibility standard and no legal duty is claimed for this class project. Fetched via a summarising tool that caps quotes at 125 chars, so quotes are fragments of the normative sentences."
- Severity low: first yes = Is it operational friction, weaker maintainability, or minor inefficiency?
- Spec section that must answer it: `product-scope`

### F-003: novel finding

- Claims: C-006, C-028, C-029, C-075, C-077, C-083, C-088, C-093, C-135, C-140, C-144, C-148, C-161; route: deep-research (A synthesis of AI-output copyright and provider terms, not one fact.)
- Evidence (quote, primary, 2026-11-04): https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-2-Copyrightability-Report.pdf Executive summary / conclusions "Copyright does not extend to purely AI-generated material, or material where there is insufficient human control over the expressive elements."
- Evidence (quote, primary, 2026-11-04): https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-2-Copyrightability-Report.pdf Part 2 conclusions "given current generally available technology, prompts alone do not provide sufficient human control to make users of an AI system the authors of the output."
- Evidence (quote, primary, 2026-11-04): https://www.copyright.gov/ai/ landing page (latest report listed; no newer position found in this run) "Part 2 was published on January 29, 2025, and addresses the copyrightability of outputs created using generative AI."
- Evidence (quote, primary, 2026-11-04): https://elevenlabs.io/terms-of-use Ownership of Output "you retain all rights in and to your Output"
- Evidence (quote, primary, 2026-11-04): https://suno.com/terms paid-tier ownership; also 'makes no representation or warranty to you that any copyright will vest in any Output'; no attribution duty but must not remove 'any fingerprint, watermark or metadata' "Suno hereby assigns to you all of its right, title and interest in and to any Output owned by Suno"
- Evidence (quote, secondary, 2026-11-04): https://openai.com/policies/terms-of-use/ (search result summary only) Ownership of content "OpenAI assigns to the user whatever rights it holds in Output, 'if any'; excludes other users' output (summary, not fetched)"
- Severity low: first yes = Is it operational friction, weaker maintainability, or minor inefficiency?
- Skeptic: downgraded: Copyright Office quote is accurate (US view, Jan 2025 report, not law/court holding, and US only). But the brief never asks about ownership and a class entry loses nothing if raw AI assets are unprotectable; consequence arises only if the repo licence claims exclusive rights over assets or the game is later commercialised. OpenAI clause is a search-summary (secondary), not a fetched quote. Safe reading: license code, state assets are AI-generated and no exclusivity is claimed.
- Spec section that must answer it: `legal-terms`

### F-004: novel finding

- Claims: C-006, C-028, C-075, C-083, C-148; route: deep-research (Legal synthesis (AI Act Art 50, platform rules).)
- Evidence (quote, secondary, 2026-11-04): https://artificialintelligenceact.eu/article/50/ Art. 50(4); also 50(2) 'marked in a machine-readable format and detectable as artificially generated' "shall disclose that the content has been artificially generated or manipulated. ... Where the content forms part of an evidently artistic, creative, satirical, fictional or analogous work or programme,"
- Severity low: first yes = Is it operational friction, weaker maintainability, or minor inefficiency?
- Spec section that must answer it: `legal-terms`

### F-005: accessibility.information-by-single-sense

- Claims: C-021, C-026, C-028, C-030, C-066, C-067, C-068, C-092, C-168, C-169, C-170; route: retrieval (WCAG 1.4.1/1.2 text settles what is required; whether the judges need it is a scope choice.)
- Evidence (quote, primary, 2026-11-04): https://www.w3.org/TR/WCAG22/ SC 1.4.1 #use-of-color "Color is not used as the only visual means of conveying information, indicating an action,"
- Evidence (quote, primary, 2026-11-04): https://www.w3.org/TR/WCAG22/ SC 1.4.2 #audio-control "If any audio on a web page plays automatically for more than 3 seconds,"
- Evidence (note, primary, 2026-11-04): https://www.w3.org/TR/WCAG22/  "Scope note: WCAG is cited as a guideline only. The brief names no accessibility standard and no legal duty is claimed for this class project. Fetched via a summarising tool that caps quotes at 125 chars, so quotes are fragments of the normative sentences."
- Severity low: first yes = Is it operational friction, weaker maintainability, or minor inefficiency?
- Spec section that must answer it: `product-scope`

### F-011: novel finding

- Claims: C-079, C-094; route: grounded-research (A trademark and store search is a decidable fact.)
- Evidence (quote, secondary, 2026-11-04): https://trademarkregistration.app/Trademark/Details/50030136 aggregator record "FINAL FRONTIER (U.S. Serial No. 50030136), owner Decimal Games LLC, Scottsdale AZ, Class 009 downloadable computer/multiplayer game software, filed Aug 4, 2026, status Active, not yet registered"
- Evidence (quote, primary, 2026-11-04): https://store.steampowered.com/app/1733400 Steam, DJ Games, released Sep 12, 2021 "The Final Frontier is a retro multi-directional shooter inspired by the likes of Asteroids and Galaga."
- Severity low: first yes = Is it operational friction, weaker maintainability, or minor inefficiency?
- Spec section that must answer it: `legal-terms`

### F-012: novel finding

- Claims: C-080, C-081, C-086, C-087, C-088, C-093, C-102, C-103, C-104, C-106, C-129, C-131; route: retrieval (Licence texts are primary sources to quote.)
- Evidence (quote, primary, 2026-11-04): https://www.meshy.ai/pricing Free plan; also '100 monthly credits', downloads limited to '10 Meshy 6 Lite' models/month "CC BY 4.0 license (commercial use with attribution)."
- Evidence (quote, primary, 2026-11-04): https://www.meshy.ai/pricing Pro plan card "Private license for all assets. \| Pro $20/mo, 1,000 monthly credits (up to 100 assets), unlimited downloads"
- Evidence (quote, primary, 2026-11-04): https://elevenlabs.io/terms-of-use brand use "The terms don't include an attribution requirement (fetch summary); brand 'may not be copied, imitated or used... without our prior written permission'"
- Evidence (quote, primary, 2026-11-04): https://suno.com/terms paid-tier ownership; also 'makes no representation or warranty to you that any copyright will vest in any Output'; no attribution duty but must not remove 'any fingerprint, watermark or metadata' "Suno hereby assigns to you all of its right, title and interest in and to any Output owned by Suno"
- Severity low: first yes = Is it operational friction, weaker maintainability, or minor inefficiency?
- Skeptic: upheld: Meshy Free = CC BY 4.0 is verified from the pricing page JSON-LD and FAQ ('If you are on a free plan, we grant you a CC BY 4.0 license'), so attribution is a real duty if Meshy free outputs ship. It is conditional on using Meshy free. The 'plan active at generation' rule and library licences are not evidenced.
- Spec section that must answer it: `legal-terms`

### F-015: provider-terms.unsupported-region-or-tier

- Claims: C-096, C-097, C-098, C-099, C-100, C-102, C-103, C-104, C-106, C-117, C-152, C-153, C-156, C-158; route: grounded-research (Each is a decidable fact on a vendor terms page, and terms change (freshness 30 days).)
- Evidence (quote, primary, 2026-11-04): https://elevenlabs.io/terms-of-use Free plan use "you may only use the Services for non-commercial purposes"
- Evidence (quote, primary, 2026-11-04): https://elevenlabs.io/pricing plan cards (WebFetch summary, paraphrased around short quotes) "Starter adds 'Commercial License' (Starter $1 first month then $6/mo, 30k credits; Free $0, 10k credits; 'Music commercial use' on Starter)"
- Evidence (quote, primary, 2026-11-04): https://suno.com/terms free tier output clause "you will only use such Outputs for your lawful, personal and non-commercial purposes"
- Evidence (quote, primary, 2026-11-04): https://suno.com/pricing plan table "Free $0, 50 credits per day, 'No commercial rights', 'No monthly song downloads'; Pro $8/mo, 2,500 credits, 'Commercial use rights', 20 downloads/mo; Premier $24/mo, 60 downloads"
- Evidence (quote, primary, 2026-11-04): https://www.meshy.ai/pricing Free plan; also '100 monthly credits', downloads limited to '10 Meshy 6 Lite' models/month "CC BY 4.0 license (commercial use with attribution)."
- Severity low: first yes = Is it operational friction, weaker maintainability, or minor inefficiency?
- Skeptic: upheld: Narrowed. Suno pricing page verifiably lists Free as 'No commercial rights' and 'No monthly song downloads' (a practical bar on shipping files, independent of the commercial-status question); ElevenLabs Free is non-commercial only. Meshy Free does NOT bar commercial use (CC BY allows it), so it should be removed from the 'bar' list, and Recraft/Scenario/Sloyd/Stable Audio are unsupported by this evidence.
- Spec section that must answer it: `legal-terms`

### F-016: licensing.non-commercial-asset-in-paid-product

- Claims: C-096, C-097, C-098, C-099, C-100, C-101, C-163, C-164; route: grounded-research (Needs the provider's definition of commercial; the organiser's status is an owner fact.)
- Evidence (quote, primary, 2026-11-04): https://elevenlabs.io/terms-of-use Free plan use "you may only use the Services for non-commercial purposes"
- Evidence (quote, primary, 2026-11-04): https://suno.com/terms free tier output clause "you will only use such Outputs for your lawful, personal and non-commercial purposes"
- Severity low: first yes = Is it operational friction, weaker maintainability, or minor inefficiency?
- **Owner question:** Does Game Week's judging and winner announcement, organiser branding or public hosting that makes the entry commercial under generator terms? Options: (a) no, personal/educational; (b) yes or unsure; (c) organisers to confirm in writing.
- Spec section that must answer it: `legal-terms`

### F-019: ai-regulation.undisclosed-ai-interaction

- Claims: C-165; route: deep-research (A legal synthesis (Art 50 scope for games) not one fact.)
- Evidence (quote, secondary, 2026-11-04): https://artificialintelligenceact.eu/article/50/ Art. 50(4); also 50(2) 'marked in a machine-readable format and detectable as artificially generated' "shall disclose that the content has been artificially generated or manipulated. ... Where the content forms part of an evidently artistic, creative, satirical, fictional or analogous work or programme,"
- Severity low: first yes = Is it operational friction, weaker maintainability, or minor inefficiency?
- Spec section that must answer it: `legal-terms`

### F-020: novel finding

- Claims: C-174; route: retrieval (Host acceptable-use text decides.)
- Evidence (quote, primary, 2026-11-04): https://render.com/docs/penetration-testing Render penetration-testing policy; sentence continues 'is expressly prohibited' "Engaging in any form of Denial of Service (DoS) testing against Render infrastructure including customer environments"
- Evidence (quote, primary, 2026-11-04): https://vercel.com/kb/guide/what-s-vercel-s-policy-regarding-load-testing-deployments Vercel KB load-testing policy "Load testing is only permitted on Enterprise plans."
- Evidence (quote, primary, 2026-11-04): https://vercel.com/kb/guide/what-s-vercel-s-policy-regarding-load-testing-deployments Vercel KB load-testing policy "If no prior warning is given before conducting a load test, you are likely to be in breach of the fair usage policy."
- Evidence (quote, primary, 2026-11-04): https://www.cloudflare.com/terms/ Cloudflare Self-Serve Subscription Agreement s2.2.2 (relayed by fetch tool, not independently read) "You are permitted to perform benchmark tests of our Services."
- Evidence (note, primary, 2026-11-04): https://developers.cloudflare.com/workers/platform/limits/  "No load/stress-testing statement found on the Workers limits page or Cloudflare terms page; linked Service-Specific Terms not read. No dedicated Render load-test page found, only the DoS clause."
- Severity low: first yes = Is it operational friction, weaker maintainability, or minor inefficiency?
- Spec section that must answer it: `capacity-physics`

### F-034: os-systems.fd-limit-exhaustion

- Claims: C-073, C-086; route: grounded-research (One decidable fact on the host's plan limits.)
- Evidence (quote, primary, 2026-11-04): https://render.com/docs/free free-instances page, fetched via WebFetch summariser (quotes as returned) "Render spins down a Free web service that goes "15 minutes without receiving any inbound traffic." / Spin-up "takes about one minute" / "750 Free instance hours" / "Do not use them for production applications.""
- Evidence (quote, primary, 2026-11-04): https://vercel.com/docs/functions/websockets WebSockets doc, last_updated 2026-08-10 "> WebSockets are available on all plans ... Vercel Functions can serve WebSocket connections ... A single WebSocket connection is pinned to one Vercel Function instance. ... WebSocket connections close when a Vercel Function reaches its maximum duration. ... Store durable state, presence, counters, rooms, and pub/sub coordination in an external data store instead of relying on in-memory variables."
- Evidence (quote, primary, 2026-11-04): https://docs.colyseus.io/deployment deployment doc "deploys "no different than deploying a regular Node.js application"; "IMPORTANT: DO NOT use 'cluster' mode."; gives no limits on rooms or connections per process; Render/Railway not mentioned; memory not covered"
- Evidence (quote, primary, 2026-11-04): https://docs.railway.com/reference/pricing/plans plans page; websockets URL 404 "The document does not mention WebSockets. (docs.railway.com/reference/websockets returned 404)"
- Severity low: first yes = Is it operational friction, weaker maintainability, or minor inefficiency?
- Spec section that must answer it: `capacity-physics`

### F-039: numeric-representation.order-dependent-float-aggregation

- Claims: C-089; route: experiment (A cross-browser run settles it.)
- Evidence (quote, primary, 2026-11-04): https://tc39.es/ecma262/ 6.1.6.1 The Number Type "The Number type has exactly 18,437,736,874,454,810,627 (that is, 264 - 253 + 3) values, representing the double-precision floating point IEEE 754-2019 binary64 values as specified in the IEEE Standard for Binary Floating-Point Arithmetic"
- Evidence (experiment, -, 2026-11-04): /private/tmp/claude-501/-Users-kaushal/0a2c1e26-0f94-48f5-8ab8-e74094b6f0eb/scratchpad/nbody.js node run, 3 sources "order_diff 0 at 1e3, 1.73e-13 at 1e4, 9.65e-10 at 1e5 steps"
- Severity low: first yes = Is it operational friction, weaker maintainability, or minor inefficiency?
- Skeptic: downgraded: Float addition non-associativity is true but JS fixes evaluation order, so every client running the same code sums identically. Divergence needs different code paths (server vs client rewrite, iteration over unordered collections). Measured effect is one V8 scenario (3 sources, 1e5 steps, 9.65e-10). The finding duplicates F-036 with a weaker cause.
- Spec section that must answer it: `capacity-physics`

### F-040: media-pipelines.decoded-frames-exceed-memory

- Claims: C-105, C-108, C-110, C-134; route: check (Arithmetic from clip length x sample rate x channels gives the size.)
- Evidence (quote, primary, 2026-11-04): https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer MDN AudioBuffer description "The buffer contains the audio signal waveform encoded as a series of amplitudes in the following format: non-interleaved IEEE754 32-bit linear PCM"
- Evidence (quote, primary, 2026-11-04): https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer MDN AudioBuffer description "Objects of these types are designed to hold small audio snippets, typically less than 45 s."
- Evidence (quote, primary, 2026-11-04): https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData MDN decodeAudioData, successCallback "The single argument to this callback is an AudioBuffer representing the decodedData (the decoded PCM audio data)."
- Evidence (quote, primary, 2026-11-04): https://www.w3.org/TR/webaudio-1.1/ Web Audio API 1.1 sec 1.4 "represents a memory-resident audio asset."
- Evidence (quote, primary, 2026-11-04): https://www.w3.org/TR/webaudio-1.1/ Web Audio API 1.1 sec 1.4 "usually somewhat less than a minute."
- Evidence (check, -, 2026-11-04): orchestrator arithmetic orchestrator "3 min stereo 44.1 kHz = 31.8 MB as 16-bit PCM, 63.5 MB as 32-bit float; 5 tracks about 318 MB (supplied by orchestrator, not recomputed here; spec format is 32-bit float so 63.5 MB each applies)"
- Severity low: first yes = Is it operational friction, weaker maintainability, or minor inefficiency?
- Skeptic: downgraded: MDN quotes re-fetched 2026-11-04 and are accurate (float32 PCM; 'designed to hold small audio snippets, typically less than 45 s'; MDN adds 'For longer sounds, objects implementing the MediaElementAudioSourceNode are more suitable', which is the easy alternative: stream via an <audio> element). But the quotes are design guidance, not a limit or a hazard. Nothing in the brief requires multi-minute decoded tracks; the brief only says generate sound effects and music (brief.md:54-55). Claim C-105 only says jsfxr/Web Audio are free code-made audio; C-108/C-110/C-134 are about sprite tools and have no bearing on audio memory. The 'autoplay unlock is unaddressed' part has no evidence in the finding at all. Memory arithmetic (not recomputed): one 3-min stereo float track is about 64 MB, fine on a judge's laptop; only many long tracks (about 318 MB for 5) would matter. A short looped track, mono, or streamed element avoids it. No documented browser memory limit was found.
- Spec section that must answer it: `capacity-physics`

### F-043: os-systems.memory-limit-oom-kill

- Claims: C-118, C-191; route: grounded-research (Plan RAM/restart behaviour is a fact on the host's docs.)
- Evidence (quote, primary, 2026-11-04): https://render.com/docs/free free page; render.com/pricing returned no plan rows "Memory/CPU limits: The page doesn't specify any."
- Evidence (quote, primary, 2026-11-04): https://docs.railway.com/reference/pricing/plans plans reference ""$1 of free credit per month." / "Users who create a new Trial account receive a free one-time grant of $5." / Free: half a gigabyte of RAM and one vCPU; Trial: 1 GB of RAM and 2 vCPUs / if balance hits zero Railway will "stop all of your workloads""
- Severity low: first yes = Is it operational friction, weaker maintainability, or minor inefficiency?
- Spec section that must answer it: `capacity-physics`

### F-044: novel finding

- Claims: C-119, C-120, C-188, C-214; route: check (Arithmetic from the owner's budget and current prices.)
- Evidence (quote, primary, 2026-11-04): https://docs.railway.com/reference/pricing/plans plans reference ""$1 of free credit per month." / "Users who create a new Trial account receive a free one-time grant of $5." / Free: half a gigabyte of RAM and one vCPU; Trial: 1 GB of RAM and 2 vCPUs / if balance hits zero Railway will "stop all of your workloads""
- Evidence (quote, primary, 2026-11-04): https://developers.cloudflare.com/durable-objects/platform/pricing/ DO pricing page "Free: Requests "100,000 / day", Duration "13,000 GB-s / day"; "For compute requests billing-only, a 20:1 ratio is applied to incoming WebSocket messages"; "Only Durable Objects with SQLite storage backend are available.""
- Evidence (quote, primary, 2026-11-04): https://vercel.com/docs/plans/hobby Hobby plan page, last_updated 2026-09-14 "the Hobby plan restricts users to non-commercial, personal use only. / Vercel Function maximum duration \| 300s (5 minutes)"
- Evidence (check, primary, 2026-11-04): python3 inline calc calc "100000 req/day x 20 incoming msgs per billed request = 2,000,000 incoming msgs/day; at 20 Hz x 8 players sending = 160 msg/s -> 12,500 s = 3.47 h of one room; 10Hz x 8 -> 6.94 h; 30Hz x 20 players -> 0.93 h. Assumes the 20:1 ratio means 20 messages = 1 request (page quote does not spell direction)."
- Severity low: first yes = Is it operational friction, weaker maintainability, or minor inefficiency?
- Skeptic: downgraded: Railway and Cloudflare figures were not re-fetched here, and the headline 'no cost ceiling' is contradicted by the finding's own note (free tiers are hard-capped; exposure is outage, not bill). The 3.47 h calculation rests on an assumed message rate (20Hz x 8 players), an assumed 20:1 direction, and a design not in the brief. The valid core is that the brief states no budget.
- **Owner question:** What is the maximum spend for hosting and generation this week? Options: (a) zero, free tiers only; (b) up to a stated amount (e.g. $20); (c) whatever the build needs.
- Spec section that must answer it: `capacity-physics`

### F-046: novel finding

- Claims: C-122; route: experiment (Connection tests across NAT types settle it.)
- Evidence (quote, primary, 2026-11-04): https://peerjs.com/ home + docs pages ""Use our free cloud server or host your own PeerServer." (site gives no broker limits, no TURN/STUN/NAT statement; peerjs.com/docs also silent)"
- Evidence (check, primary, 2026-11-04): curl https://registry.npmjs.org/<pkg> (read-only metadata) dist-tags.latest + time "colyseus 0.18.10 published 2026-10-22 MIT, created 2015, maintainer endel; partyserver 0.5.10 published 2026-08-03 ISC, created 2024-06; peerjs 1.5.5 published 2025-06-07 MIT (about 17 months before today); ws 8.22.1 published 2026-10-31 MIT, maintainer lpinca"
- Severity low: first yes = Is it operational friction, weaker maintainability, or minor inefficiency?
- Spec section that must answer it: `trust-consensus`

### F-048: os-systems.thread-or-process-per-request

- Claims: C-123; route: grounded-research (A decidable fact about the chosen server library's room model.)
- Evidence (quote, primary, 2026-11-04): https://docs.colyseus.io/deployment deployment doc "deploys "no different than deploying a regular Node.js application"; "IMPORTANT: DO NOT use 'cluster' mode."; gives no limits on rooms or connections per process; Render/Railway not mentioned; memory not covered"
- Evidence (quote, primary, 2026-11-04): https://github.com/colyseus/colyseus repo README; GitHub releases section empty in fetch "License: MIT. No per-process room limit stated; "Go from 10 to 10,000+ CCU by scaling vertically or horizontally with Redis and load balancers.""
- Severity low: first yes = Is it operational friction, weaker maintainability, or minor inefficiency?
- Spec section that must answer it: `capacity-physics`

### F-056: supply-chain.unverified-package-name

- Claims: C-086, C-087, C-105, C-145, C-201; route: check (Registry metadata checks decide it per package.)
- Evidence (check, primary, 2026-11-04): curl https://registry.npmjs.org/<pkg> (read-only metadata) dist-tags.latest + time "colyseus 0.18.10 published 2026-10-22 MIT, created 2015, maintainer endel; partyserver 0.5.10 published 2026-08-03 ISC, created 2024-06; peerjs 1.5.5 published 2025-06-07 MIT (about 17 months before today); ws 8.22.1 published 2026-10-31 MIT, maintainer lpinca"
- Evidence (quote, primary, 2026-11-04): https://github.com/colyseus/colyseus repo README; GitHub releases section empty in fetch "License: MIT. No per-process room limit stated; "Go from 10 to 10,000+ CCU by scaling vertically or horizontally with Redis and load balancers.""
- Severity low: first yes = Is it operational friction, weaker maintainability, or minor inefficiency?
- Skeptic: downgraded: The evidence shows the candidate packages are real, maintained and permissively licensed, which undercuts 'chosen without vetting'; no typosquat or bad package was found. The remaining point is only that the brief has no vetting rule, a process omission, not a demonstrated defect. npm metadata was not re-fetched.
- Spec section that must answer it: `crypto-agent-security`

### F-058: agent-security.untrusted-tool-servers

- Claims: C-088, C-125, C-205; route: grounded-research (Decidable per server: publisher, pinned version, tool list.)
- Evidence (quote, primary, 2026-11-04): https://modelcontextprotocol.io/specification/2025-06-18/index.md Security and Trust & Safety > Tool Safety "Tools represent arbitrary code execution and must be treated with appropriate caution. In particular, descriptions of tool behavior such as annotations should be considered untrusted, unless obtained from a trusted server."
- Evidence (quote, primary, 2026-11-04): https://modelcontextprotocol.io/specification/2025-06-18/server/tools Tool > warning "clients MUST consider tool annotations to be untrusted unless they come from trusted servers."
- Severity low: first yes = Is it operational friction, weaker maintainability, or minor inefficiency?
- Skeptic: downgraded: Quote is accurate (annotations untrusted unless from a trusted server), but the finding is a hypothetical about this project's agent trusting community server descriptions; no community server is actually selected apart from Blender MCP, covered by F-065. Largely duplicates F-057/F-065.
- Spec section that must answer it: `crypto-agent-security`

### F-059: agent-orchestration.standing-broad-credentials

- Claims: C-088, C-210; route: check (Inspect key scope and spend limit at the provider.)
- Evidence (quote, primary, 2026-11-04): https://modelcontextprotocol.io/specification/2025-06-18/index.md Key Principles 2 Data Privacy "User data should be protected with appropriate access controls"
- Severity low: first yes = Is it operational friction, weaker maintainability, or minor inefficiency?
- Spec section that must answer it: `crypto-agent-security`

### F-060: novel finding

- Claims: C-103, C-104, C-106, C-108, C-109, C-110, C-127, C-128, C-143; route: grounded-research (Pricing pages are decidable facts; fetch now.)
- Evidence (quote, primary, 2026-11-04): https://elevenlabs.io/pricing plan cards (WebFetch summary, paraphrased around short quotes) "Starter adds 'Commercial License' (Starter $1 first month then $6/mo, 30k credits; Free $0, 10k credits; 'Music commercial use' on Starter)"
- Evidence (quote, primary, 2026-11-04): https://www.meshy.ai/pricing Free plan; also '100 monthly credits', downloads limited to '10 Meshy 6 Lite' models/month "CC BY 4.0 license (commercial use with attribution)."
- Evidence (quote, primary, 2026-11-04): https://www.meshy.ai/pricing Pro plan card "Private license for all assets. \| Pro $20/mo, 1,000 monthly credits (up to 100 assets), unlimited downloads"
- Evidence (quote, primary, 2026-11-04): https://suno.com/pricing plan table "Free $0, 50 credits per day, 'No commercial rights', 'No monthly song downloads'; Pro $8/mo, 2,500 credits, 'Commercial use rights', 20 downloads/mo; Premier $24/mo, 60 downloads"
- Evidence (quote, primary, 2026-11-04): https://skybox.blockadelabs.com/plans plans page "essential 100 credits/month '4K exports'; standard 300 credits; business 500 credits, '16K export options', 'Commercial licensing' (listed only under business); no free plan listed; two price sets shown ($20/$48/$112 and $24/$60/$140)"
- Severity low: first yes = Is it operational friction, weaker maintainability, or minor inefficiency?
- Spec section that must answer it: `legal-terms`

### F-063: supply-chain.unpinned-dependencies

- Claims: C-123, C-202; route: check (Lockfile and audit output decide it.)
- Evidence (check, primary, 2026-11-04): curl https://registry.npmjs.org/<pkg> (read-only metadata) dist-tags.latest + time "colyseus 0.18.10 published 2026-10-22 MIT, created 2015, maintainer endel; partyserver 0.5.10 published 2026-08-03 ISC, created 2024-06; peerjs 1.5.5 published 2025-06-07 MIT (about 17 months before today); ws 8.22.1 published 2026-10-31 MIT, maintainer lpinca"
- Severity low: first yes = Is it operational friction, weaker maintainability, or minor inefficiency?
- Spec section that must answer it: `crypto-agent-security`

### F-064: supply-chain.unverified-provenance

- Claims: C-124, C-125, C-126, C-163; route: grounded-research (One decidable fact: repo, maintainer, last commit, release.)
- Evidence (quote, primary, 2026-11-04): https://github.com/ahujasid/blender-mcp github.com/ahujasid/mcp-for-blender -> redirects (API 301) to repositories/944414751; page header, fetched today "MIT license; 33.3k stars (API stargazers_count 33317); latest commit 2e4b0bc2 at 2026-11-04T13:04:02Z, pushed_at 2026-11-04T13:04:08Z"
- Evidence (check, primary, 2026-11-04): https://api.github.com/repositories/944414751/commits?per_page=1 curl -sL; commits[0].commit.committer.date "2e4b0bc2 2026-11-04T13:04:02Z"
- Severity low: first yes = Is it operational friction, weaker maintainability, or minor inefficiency?
- Skeptic: downgraded: The repo is real, MIT, 33,317 stars, last commit 2026-11-04T13:04:02Z, all verified live, but that supports provenance, not a defect. The finding that stars were used as the trust basis is an inference about the claim's intent; C-124 merely cites the number. Real residual point: a commit hours old on an unpinned repo means no review window, and no version is pinned.
- Spec section that must answer it: `crypto-agent-security`

### F-066: agent-security.untrusted-content-drives-tools

- Claims: C-126, C-138, C-206, C-207; route: grounded-research (Decidable from the MCP's tool list and import behaviour.)
- Evidence (quote, primary, 2026-11-04): https://raw.githubusercontent.com/ahujasid/blender-mcp/main/README.md README tools table "`search_assets` / `import_asset` \| Poly Haven HDRIs, textures and models, Sketchfab models, Poly Pizza low-poly models"
- Evidence (quote, primary, 2026-11-04): https://raw.githubusercontent.com/ahujasid/blender-mcp/main/README.md README tools table "`execute_blender_code` \| Run Python in your live Blender"
- Evidence (quote, primary, 2026-11-04): https://raw.githubusercontent.com/ahujasid/blender-mcp/main/README.md README feature table "Poly Haven assets, Sketchfab models, Poly Pizza low-poly models, and AI-generated 3D models via Meshy, Tripo, Hyper3D Rodin and Hunyuan3D"
- Severity low: first yes = Is it operational friction, weaker maintainability, or minor inefficiency?
- Skeptic: downgraded: README tool/feature table lines exist, but the claim that imported third-party models are 'untrusted content in a code-executing session' is an inference; no exploit path or sanitisation behaviour was examined (finding admits it did not inspect import_asset), and model files are not themselves code. The no-premade conflict is duplicated by F-052.
- Spec section that must answer it: `crypto-agent-security`

## Poisoned-instruction autopsy

| Brief locator | Quarantined text | Findings | Reason | Replaced by |
|---|---|---|---|---|
| docs/source/lecture-2026-11-02-game-assets.md slide 26 (L267), slide 34 (L347-353) | Three ways to get visual assets: (3) Asset libraries, packs and models artists have already made (Kenney, Poly Haven, itch.io); Library assets (Kenney Tiny Dungeon, Poly Haven, Quaternius). | F-052, F-014 | Contradicts brief L55 'Do not use pre-made assets'; the strict reading is the only one that cannot fail the assignment. | Invariant: every shipped asset is AI-generated or code-made and has a provenance-log row; no library pack is used unless the organisers rule otherwise in writing. |
| docs/source/lecture-2026-11-02-game-assets.md slide 70 (L892-898) | Sky Roadster demo: Art 'Library models + code-built scenery'; SFX 'Recorded vehicle and air sounds'. | F-052, F-014 | The demo shows library models and recorded SFX, which the brief bans; it is an example, not an allowance. | Do not copy the demo's asset route; code-built scenery and synthesised/generated audio only. |
| docs/source/research-README.md item 5 (C-117) | Vercel Hobby is non-commercial, 300 s function cap and no shared state across instances; host the static client there at most. | F-041 | Current Vercel docs say WebSockets are available on all plans (functions can serve WS, 300 s cap), so 'holds no sockets' is outdated; non-commercial and 300 s parts stand. | Vercel is fine for the static client; if used for sockets, reconnect before the 300 s cap and keep room state outside the function. |
| docs/source/research-README.md item 5 (C-121) | Hosted PartyKit shut down on 23 Oct 2026; successor is PartyServer on your own Cloudflare. | F-041, F-056 | The shutdown is upheld, not refuted, so the fact is kept; any lead that treats hosted PartyKit as a hosting option is rejected. | Hosted PartyKit is excluded; PartyServer on our own Cloudflare account or a ws/Colyseus Node server are the candidates. |
| docs/source/research-README.md item 5 (C-118) | Better: Colyseus or a small ws Node server on Render free (750 h/mo, 15 min idle sleep, about 1 min cold start). | F-042, F-043, F-034 | Recommended as 'better' without the judging-morning cold-start, lost in-memory rooms or memory limits. | Render free only with a pre-warm before judging, room caps, a heartbeat and restart-safe rooms. |
| docs/source/research-README.md item 5 (C-122) | PeerJS is a no-server fallback; NAT reliability unverified. | F-046, F-056 | Peer-to-peer may fail on judge networks and peerjs is stale (2025-06); no TURN plan. | Server-relayed WebSocket is the only transport; no P2P without a tested TURN. |
| docs/source/research-README.md item 6 (C-124, C-126) | Blender MCP: MIT, about 33k stars; can import Poly Haven/Sketchfab assets. | F-065, F-064, F-066, F-057 | Unauthenticated socket that runs arbitrary Python; star count is not vetting; import path breaches the no-premade rule. | Headless reviewed bpy scripts preferred; MCP only with safe mode, localhost, pinned commit and import tools off. |
| proposal.md L3 (C-080, C-081) | Final Frontier ... with Kepler and restricted n-body physics. | F-037, F-036, F-039 | Two physics models named with no body count, step or error budget; Kepler is closed-form only for two bodies. | One simulated model: server-authoritative restricted n-body, fixed step, stated body count and error budget; Kepler only seeds/draws orbits. |
| proposal.md L3 (C-079, C-094) | Final Frontier (name). | F-011 | May collide with a pending US application for FINAL FRONTIER (class 9 game software, filed 2026-08-04; seen via an aggregator, not checked against the USPTO) and existing Steam titles. | Use as a codename only; ship under a distinct title. |

## Dismissed

- F-045 (performance / performance.egress-unit-economics): Claim says 100k requests with 20:1 billing is about 5k messages/day. The page gives 100,000 requests/day and bills incoming WebSocket messages at 20:1, which (reading it as 20 messages = 1 request) is about 2,000,000 incoming messages/day, not 5k. Calc: one 8-player room at 20 Hz uses ~3.5 h of quota, so one class session fits; sustained multi-room all-day load does not. Direction of the ratio is not spelled out in the fetched quote, so treat the arithmetic as inferred.
- F-061 (market-reality / market-reality.latency-over-correctness-floor): Exact duplicate of F-042 (same Render free-tier evidence); skeptic upheld the evidence, merged here.
- F-062 (market-reality / market-reality.unbounded-free-tier): Same arithmetic as F-045: 100k req/day x 20 = ~2M incoming messages/day; one class-sized session at racing tick rate uses hours of one room's budget at 20 Hz, not the whole quota in minutes. Not dismissed for a 30 Hz x 20-player lobby (0.93 h).

_Not legal advice. The skill flags and cites; the owner decides._

