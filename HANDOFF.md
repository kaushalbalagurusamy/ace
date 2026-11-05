# Handoff: start here (written 2026-11-05)

You are picking up **gauntlet-game-week**. The game is a multiplayer browser golf race (Gauntlet Game Week, Option 3). It must be playable from a public link **before judging, which starts after 08:00 CST on Fri 2026-11-06**.

Read these in order before doing anything else:

1. **`.claude/state.md`**: the full handoff. It covers decisions, what's still open, access and keys, artifact links, next actions and known gaps.
2. **`PRD/README.md`**, then `PRD/01` to `PRD/06`: the spec. The owner's answers Q1–Q11 are in the README's Decisions table. Tags: GIVEN means the owner said it, ASSUMED means a gap-fill, UNVERIFIED means it needs a source, OPEN means the owner decides.
3. **`.claude/build-loop.md`**: the `/sf` profile for this project.

Key facts, in case you skim:
- **Direction:** the space racer (*Final Frontier*) is scrapped. The `docs/minesweep/` material is history, apart from the asset, licensing, hosting and key findings listed in `PRD/README.md`.
- **Engine:** Three.js `three@0.186.1` client, with a Node `ws` server that owns every shot simulation.
- **Skills:** 14 game-dev skills are vendored in `.claude/skills/` (see `PROVENANCE.md` there).
- **Order of work:** build a greyscale MVP first. Asset generation runs in parallel through subagents (`PRD/06`). The ElevenLabs key is in `.env`.

Then:
1. Summarise what you understood.
2. Ask the owner the open items in one message: Pebble Beach naming rights (Q12), Meshy and OpenAI keys, the spend ceiling, judge devices, the host, and whether to run `sf install`.
3. Confirm which thread to start with before writing code.

Where this file and the repo disagree, the cited file or commit wins.
