# Working state — gauntlet-game-week (2026-11-04; last clock check 17:3x CST)

Branch intake/sources-profile-minesweep. Stage: sf stage 1 (intake/minesweep) complete for passes 1-2. No research briefs, experiments, ADRs or code yet; operator said not to start developing.
Final Frontier = hypothesis only. Deadline Thu 2026-11-05 midnight, timezone unconfirmed.

## Done (committed)
- Sources verbatim + hashes; build-loop profile; claims (216); 3 lens sweeps (4,536 verdicts, 386 suspects); 71 merged findings.
- Grounding G1-G4, skeptic x2, reframer x2; register.json validates (register.v1), gates empty; problem-definition.md.
- Register: confirmed 6, plausible 30, dismissed 3, suspect 32 (ungrounded). Tiers: 0 crit, 0 high, 12 medium, 24 low. stop_reason recorded as iteration-cap (2 of 4 passes; schema has no "paused for owner").
- Artifact published (private to owner): https://claude.ai/artifact/SogJj7fePYrLJEXSYG6eNY, slug d0f8e722-83b8-4296-be94-8814ad69326d, v1793835195-20ef. Source: docs/artifact/ (build.py generates index.html from register.json + two hand-written tab fragments). Rebuild: .venv python docs/artifact/build.py, then republish with publish_files (needs base_version).

## Stage 12 inbound check (done)
Upstream branch w8-game-week-brief tip unchanged (bb9772a); brief, research README and lecture hashes match docs/source/SHA256SUMS. No backlog file exists yet. Hygiene: disk 22 GB free, memory warn; preview server stopped.

## Stack discussion with owner (2026-11-05, not yet ADRs)
- No GPU pixel-streaming (latency, per-player GPU, cold starts). Modal only for offline asset generation, if used.
- Engine recommendation: Three.js (3D) or Phaser (2D), shared JS sim on client + Node server. Unreal/Unity/Godot rejected for web delivery and agent workflow. Owner has not chosen 2D vs 3D; needs ADR. All engine facts from recall, unverified.
- Keys: ElevenLabs = have it (Starter, paid, active, 0/40,000 credits, verified via /v1/user/subscription). Image key (OpenAI or Modal) still to choose. Meshy/Blockade only if 3D/skyboxes. Anthropic API cannot generate images; use Claude for code-drawn art and as critic.
- Consistency plan: generate few hero assets, pin one model version, fixed style paragraph + reference image, unify in engine (palette, grading, bloom). LoRA on Modal only if first batch clashes.
- ElevenLabs key lives in untracked .env (gitignored, chmod 600). NOT in git: copy it to the other machine by hand. Key was pasted in chat; owner advised to rotate.
- ElevenLabs hosted MCP (https://api.elevenlabs.io/v1/mcp) needs OAuth, not the key. Registered at local scope on this Mac only (~/.claude.json); each machine must re-add it and log in via /mcp.

## Open / next
1. Owner answers: F-052 library packs allowed? F-016/F-002 is the entry "commercial"? F-044 spend ceiling; F-007 judge devices; F-022/F-050 deadline timezone.
2. Pass 3: 32 ungrounded findings (netcode authority/failure modes F-013, F-023-F-033, F-035, F-038, F-047; rubric F-049, F-051, F-053; asset critic F-067-F-069; privacy F-008, F-009, F-017; capacity F-026). Then re-sweep problem-definition.md.
3. Then stage 1 research seeded from the lecture, stage 2 experiments (cross-browser determinism, host cold start, art bake-off), stage 3 ADRs (engine, authority model, host). Build docs/requirements-ledger.md from docs/source/brief.md line by line (not yet built: the run's termination condition).
4. Not authorised yet: sf install install; adding a remote (labs.gauntletai.com namespace unverified); any development.

## Disclosures
- Commit 94303ee message says "31 findings"; the count was 33. Not amended.
- Minesweeper config names Opus for some groups and the skeptic; all roles ran on Sonnet per /sf.
- Keyword planner output kept as a record; lenses replaced by plan-override.json.
- Two vendor quotes (ElevenLabs Starter, Suno table) were paraphrases; relabelled, F-060 downgraded.
- Earlier state-file headings carried guessed times; corrected.
