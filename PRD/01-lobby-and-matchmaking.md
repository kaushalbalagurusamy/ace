# 01: Waiting room and lobbies

## Stories

- **US-L1** [GIVEN]: Anyone who opens the game link lands in a waiting room.
- **US-L2** [GIVEN]: In the waiting room I see the lobbies and choose which one to join.
- **US-L3** [GIVEN]: Anyone can create a new lobby. At most 3 lobbies exist at once.
- **US-L4** [GIVEN]: A lobby holds at most 4 players.
- **US-L5** [ASSUMED]: I can leave a lobby and go back to the waiting room.
- **US-L6** [ASSUMED]: Players mark themselves ready. The race starts on a countdown.
- **US-L7** [ASSUMED]: If my connection drops mid-race, I can rejoin and keep my progress.

## Rules

### Arriving
1. [ASSUMED] On first arrival the player enters a display name. Names are 2 to 16 characters and unique among connected players. The name is remembered in this browser.
2. [ASSUMED] There are no accounts or passwords. The server gives each browser tab a session token kept in `sessionStorage`, which is used to reconnect.
3. [ASSUMED] The waiting room accepts up to 40 connections. Beyond that, a "Server full, try again shortly" screen retries every 10 seconds.

### Waiting room
4. Each lobby row shows its name, host, players (n/4), status, and a Join button that is disabled when the lobby is full or not open.
5. [ASSUMED] The waiting room also shows who is waiting there and a live player count for each lobby.
6. "Create lobby" is enabled only while fewer than 3 lobbies exist. When there are 3, it reads "All 3 lobbies in use".
7. [ASSUMED] The creator becomes host and is placed in the new lobby. The lobby name defaults to "<host>'s lobby" and can be renamed (up to 24 characters).

### Lobby states

| State | Join allowed | Leaves to |
|---|---|---|
| Open | Yes, up to 4 | Starting (host presses Start) |
| Starting | No, 5 s countdown | In race |
| In race | No | Results |
| Results | No | Open (Play again) or closed (everyone leaves) |

8. [GIVEN by the brief] A race needs at least 2 players. [OPEN Q8] By default, a lone host can start a time trial that doesn't count as a race.
9. [ASSUMED] The host's Start button is enabled when at least 2 players are present and all are ready. The host can also force a start once at least 2 players have been present for 60 seconds.
10. [ASSUMED] If the host leaves, the player who has been in the lobby longest becomes host.
11. [ASSUMED] An empty lobby closes at once and frees its slot. An Open lobby with no start for 10 minutes closes, and its players return to the waiting room.
12. [ASSUMED] "Play again" keeps the lobby and its players, clears ready flags and generates a new course seed (see 03 §7).

### Disconnects and restarts
13. [ASSUMED] During a race, a disconnected player stays listed as "disconnected". Their race clock keeps running. Reopening the link in the same tab reconnects them to their ball, hole and strokes for as long as the race is running.
14. [ASSUMED] A disconnect in an Open lobby removes the player after 15 seconds.
15. [ASSUMED] If the server restarts, all state is lost. Clients show "Server restarted" and return to the waiting room. Rooms aren't persisted in v1 (register F-048).

## Acceptance criteria

- **AC-L1:** With 3 lobbies open, a 4th create attempt is rejected by the server, not only by the UI, and the client shows the reason.
- **AC-L2:** A 5th player joining a 4-player lobby is rejected by the server. When two players join a 3-player lobby at the same moment, exactly one gets in.
- **AC-L3:** Two browsers on different machines can join from the same link, enter one lobby and start a race within 30 seconds of opening the link.
- **AC-L4:** Closing the host tab promotes another player within 2 seconds.
- **AC-L5:** Reloading mid-race restores the player's hole, ball position and strokes.
