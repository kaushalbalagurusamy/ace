# Game Week tool research (read 2026-11-02, overnight run)

Scope: every tool named in the Game Assets lecture (`lectures/2026-11-02-game-assets-with-matt.md`), checked against official pages where they could be fetched. Detail files:

1. [01-ai-2d.md](01-ai-2d.md): OpenAI image gen, Layer, PixelLab, Retro Diffusion, AutoSprite, Ludo.ai, Scenario, Recraft
2. [02-ai-3d-audio.md](02-ai-3d-audio.md): Meshy, Tripo, Rodin, Sloyd, Skybox AI, ElevenLabs, Suno, Stable Audio
3. [03-libraries-and-free-tools.md](03-libraries-and-free-tools.md): asset libraries plus free/code tools, engines libraries
4. [04-engines-agent-tooling-hosting.md](04-engines-agent-tooling-hosting.md): Godot/Unity/Unreal, MCPs and skills, multiplayer hosting

Prices change often; re-check before paying. Anything not confirmed on an official page is marked "could not verify" in the detail files. Weekly-usage cap: not measurable from the session; run used 4 Sonnet agents (~300k subagent tokens total, 97 tool calls), no paid API calls.

## What matters for the decision

1. **The brief bans premade assets** ("All assets must be generated... Do not use pre-made assets"). The lecture's "asset library" route (Kenney, Poly Haven, Quaternius, KayKit, Freesound, Fab, Mixamo, etc.) therefore likely breaks the rule. Only AI generation and made-with-code routes are safe. Mixamo animations are arguably premade too.
2. **Free AI tiers are the trap.** Several free tiers bar commercial use or downloads: Recraft (free outputs not licensed for commercial use), Scenario (personal/evaluation only), Suno (no commercial rights, no downloads), Sloyd (personal-use licence on guest tier), Stable Audio (free is non-commercial per sources, unverified). Check whether a class game counts as commercial before relying on any free tier; Meshy free is CC BY 4.0 (commercial allowed with credit).
3. **Cheapest sensible stack, no premade assets:**
   - Audio: jsfxr/Web Audio (free, code-made) plus ElevenLabs Starter ($6/mo, $1 first month) if you want generated music/SFX with a commercial licence. Suno Pro ($8/mo) is the alternative for music.
   - 3D: Meshy (free 100 credits/mo, CC BY 4.0; Pro $20/mo for API) or fully procedural three.js geometry and shaders (free).
   - 2D pixel art: PixelLab (strongest fit, pricing unverified) or Retro Diffusion (pay-per-image ~$0.01, third-party source); AutoSprite Starter $12/mo for animated sheets.
   - Code: Three.js / Phaser / PixiJS (MIT, free). Piskel/LibreSprite/Pillow/Blender are free editing and scripting tools.
4. **Engines:** Godot web export exists but is limited (GDScript only on web, single-thread default, WebSocket/WebRTC networking). Unity web is heavy. Unreal has no official web export (secondary source). Plain Three.js or Phaser is the best 3-day fit.
5. **Multiplayer hosting (Racing option only):** Vercel Hobby is non-commercial, 300 s function cap, no shared state across instances: host the static client there at most. Better: Colyseus or a small `ws` Node server on Render free (750 h/mo, 15 min idle sleep, ~1 min cold start) or Railway ($5 trial credit), or Cloudflare Durable Objects (free: 100k req/day, incoming WS messages billed 20:1). Hosted PartyKit shut down on 23 Oct 2026 per the agent's read of its docs (successor: PartyServer on your own Cloudflare). PeerJS is a no-server fallback; NAT reliability unverified.
6. **Agent tooling:** only Blender MCP (MIT, ~33k stars, runs arbitrary Python over an unauthenticated socket) and the gamedev-skills repo (Apache-2.0) matter for a JS browser game. Unity/Godot/Aseprite MCPs only if you pick those tools. Blender MCP can import Poly Haven/Sketchfab assets: avoid that import path under the no-premade rule.

## Could not verify (re-check before relying)

- OpenAI per-image price and ChatGPT free limits; PixelLab pricing and credits (pricing page 404); Retro Diffusion (third-party only); Ludo.ai, AutoSprite, Layer free-tier terms; Recraft paid prices
- Tripo and Stable Audio official pricing (403/empty page; aggregator figures only)
- Aseprite price, Audacity licence text, A Sound Effect, Quaternius/KayKit/0x72 licences, official OpenGameArt/Fab/Synty/Mixamo pages
- Unreal cost/royalty, Godot licence, Unity build size, blender-mcp last commit, PeerJS free-broker limits and TURN details
- Three.js/Phaser/PixiJS pages were not fetched (MIT per the libraries file only)
