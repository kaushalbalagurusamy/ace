
## Anti-cheat on swing timing (rank: low, after the 18-hole race works)
Source: automated security review, 2026-11-05. The server trusts client-reported Z/X/C timings (`PRD/02` §3 design: client sends raw times, server re-scores and rejects impossible input). A scripted client can send ideal timings every shot. Options: server-side swing-start nonce and receive-time sanity bounds, reject exactly-ideal streaks. Disposition: accepted risk for the judged build; revisit if time remains.
