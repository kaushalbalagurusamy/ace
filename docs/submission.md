# Submission checklist (owner, 2026-11-05)

**Hard deadline: midnight CST, Thu 2026-11-05.** Because it's a live deployment, the build behind the deployed URL may keep being polished until **08:00 CST Fri 2026-11-06**, when judging starts. Everything below must be submitted by midnight, so the deployed URL has to be **stable**: the same URL from first deploy through judging.

## 1. Portal: portlet.gauntletai.com
| Item | Status | Owner of the action |
|---|---|---|
| GitLab repo link | `https://labs.gauntletai.com/kaushalbalagurusamy/gauntlet-game-week` (check which branch judges see; currently only `intake/sources-profile-minesweep` exists, with no `main`) | build session prepares; owner submits |
| Deployment URL | **https://ace-x92s.onrender.com** (Render service `srv-dbmbob3m8hqs73f9pbpg`, free plan for now: upgrade to always-on before 08:00). Deploys from the GitHub mirror `github.com/kaushalbalagurusamy/ace` branch `main` (remote `github`), because Render can't pull from the self-hosted GitLab. Host: **Render** (owner, 2026-11-05). Needs `RENDER_API_KEY` in `.env` from the owner, and an always-on paid instance for judging, because the free tier sleeps | build session |
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
