# Submission checklist (owner, 2026-11-05)

**Hard deadline: midnight CST, Thu 2026-11-05.** Because it's a live deployment, the build behind the deployed URL may keep being polished until **08:00 CST Fri 2026-11-06**, when judging starts. Everything below must be submitted by midnight, so the deployed URL has to be **stable**: the same URL from first deploy through judging.

## 1. Portal: portlet.gauntletai.com
| Item | Status | Owner of the action |
|---|---|---|
| GitLab repo link | `https://labs.gauntletai.com/kaushalbalagurusamy/gauntlet-game-week` (check which branch judges see; currently only `intake/sources-profile-minesweep` exists, with no `main`) | build session prepares; owner submits |
| Deployment URL | **https://ace-x92s.onrender.com** (Render service `srv-dbmbob3m8hqs73f9pbpg`, plan **1 CPU / 2 GB always-on** (owner upgraded 2026-11-05; confirmed via API)). Deploys from the GitHub mirror `github.com/kaushalbalagurusamy/ace` branch `main` (remote `github`), because Render can't pull from the self-hosted GitLab. Host: **Render** (owner, 2026-11-05). Needs `RENDER_API_KEY` in `.env` from the owner, paid always-on plan, done | build session |
| Twitter/X post | not drafted | build session drafts; **owner posts** |
| Demo video | not recorded | build session records (demo-script skill); owner reviews |

## 2. Google Form: "Game Week Sign Up"
https://docs.google.com/forms/d/e/1FAIpQLSdVvgG46_P7PNFvrQdg9Vgon85uyUBiCis6G-UGTDLry59xqA/viewform. No sign-in needed. One page, all four fields required:
1. **Your name:** Kaushal Balagurusamy
2. **Your game title:** **Ace** (owner, 2026-11-05)
3. **Your game's deployed URL:** https://ace-x92s.onrender.com
4. **Category:** Multiplayer racing

The owner submits the form and the portal. No agent submits forms or posts on the owner's behalf.

## Timeline that follows from this
- **ASAP, and by 18:00 CST at the latest:** first deploy of a skeleton (waiting room and lobby working) to the final host and URL, so the URL is fixed early and the README links to it.
- **By about 22:00:** a playable race on the deployed URL (greyscale is fine). Record the demo video from it.
- **By 23:30:** video, tweet draft and repo link ready for the owner. The owner submits the portal and the form before midnight.
- **Midnight to 08:00:** polish in place on the same URL: generated assets, audio, physics calibration. Re-test from a cold browser before 08:00.

## Demo video (ready 2026-11-05 about 20:10 CST)
- **File:** `~/Movies/ace-clips/ace-demo.mp4` (69 s, 1280×720, captioned, no audio), recorded from the live site at deploy 2d5aa26 (HD turf, Genesis cart).
- **Contents:** title card, waiting room and a two-player lobby, the other player on the shared tee, stance and ball position, hold-and-release swing, flight with tracer, shot card, rangefinder auto-club, a draw from ball position, max effort (its shot card is blurred until the speed decision), and a closing card with the URL.
- **Needs a public link for the portal:** upload it (YouTube unlisted, Loom or Drive) and paste the link.

## Tweet draft (owner posts)
> I built ACE for Gauntlet AI Game Week ⛳ A multiplayer golf race on Pebble Beach: first to hole out on 18 wins. One-button swing, draws and fades from ball position, TrackMan-style flight. Every asset generated for the game. Play free: https://ace-x92s.onrender.com  (259/280)

Shorter version:
> ACE: a multiplayer golf race on Pebble Beach, built for Gauntlet AI Game Week. First to hole out on 18 wins. Play in your browser: https://ace-x92s.onrender.com

Attach the demo video or a still from it.
