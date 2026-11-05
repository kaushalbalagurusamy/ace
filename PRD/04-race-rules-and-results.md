# 04: Race rules and results

## Stories

- **US-R1** [GIVEN]: The goal is speed. I win by holing out on hole 18 before everyone else.
- **US-R2** [GIVEN]: My score doesn't matter, but poor shots cost me time.
- **US-R3** [GIVEN]: If finish times are within 1 second, the lower score wins, which allows for ping and lag.
- **US-R4** [ASSUMED]: I can always see where I stand against the others during the race.
- **US-R5** [ASSUMED]: At the end I see results and can play again.

## Race flow

1. A 5 s countdown starts, then "Go". Every player spawns on hole 1's tee at the same moment.
2. [GIVEN] Players share the course and play simultaneously at their own pace. There is no turn order. Everyone sees everyone's balls and tracers. Sabotage mechanics come in a later version.
3. On holing out, a 2 s hole card shows (hole, strokes, split time), then the player is moved to the next tee automatically. The clock keeps running through this.
4. [GIVEN] A player finishes when they hole out on hole 18.
5. [ASSUMED] A player who has finished can spectate the others from a free camera or follow the leader.
6. [GIVEN] Each room has a **20-minute limit** from Go. Once the first player finishes, the others have **1 minute**. When it runs out, or at 20 minutes, every unfinished player's progress is **frozen** for the final results.

## Timing

- [ASSUMED] The server keeps the one race clock. Clients show the server time, smoothed.
- **Finish time** = the moment the server-simulated ball drops into the 18th cup − Go.
  - The server takes the swing's receive time and adds the simulated flight-and-roll time, so the finish moment comes from the simulation, not from when a message arrives.
- **Score** = total strokes, including penalty strokes.

## Penalties [GIVEN: standard Rules of Golf, each with a time cost]

The relief options follow the Rules of Golf as I recall them [UNVERIFIED rule numbers]. The time cost is how the game turns each penalty into lost race time [ASSUMED values].

| Situation | Rule of Golf | In-game handling | Time cost |
|---|---|---|---|
| Out of bounds | Stroke and distance: +1, replay from the previous spot | Ball reappears at the previous spot. The golfer is moved there | 2 s drop wait (the walk back is skipped) |
| Penalty area (water at Pebble Beach: the ocean on 4 to 10 and 17 to 18) | +1. Back-on-the-line relief, or stroke and distance. Lateral relief for red areas | The server picks the legal drop nearest the hole from back-on-the-line or lateral (2 club-lengths) | 2 s drop wait |
| Unplayable (hold R for 1 s) | +1. Stroke and distance, back-on-the-line, or lateral 2 club-lengths | Same choice as above | 2 s drop wait |
| Lost ball | Not possible: the ball is always tracked | None | None |
| Free relief (cart path, ground under repair) | No penalty, nearest point of relief | Automatic | 1 s |

- [ASSUMED] During a drop wait the golfer can't move or swing, and a "Dropping… 2 s" timer shows.
- [ASSUMED] There is no stroke cap. The 20-minute and 1-minute limits bound the race instead.

## Ranking with the 1-second rule [GIVEN rule, ASSUMED grouping]

Comparing times pair by pair can fail when A is within 1 s of B and B is within 1 s of C, but A and C are 1.8 s apart. So players are ranked in groups anchored on the fastest player:

```
sort finishers by finish time
while finishers remain:
    anchor = fastest remaining
    group  = everyone remaining with time <= anchor.time + 1.000 s
    rank the group by strokes (lower first), then by time
    if two players in a group have equal strokes, they share the place (dead heat)
    remove the group
then rank non-finishers (progress frozen at the limit) below finishers:
    most holes completed, then shortest distance from ball to hole, then fewest strokes
```

**Worked example:**

| Player | Time | Strokes | Place |
|---|---|---|---|
| A | 14:00.2 | 70 | 2 |
| B | 14:00.9 | 68 | 1 (within 1 s of A, better score) |
| C | 14:01.4 | 65 | 3 (1.2 s behind A, so outside the group; score can't help) |

## During the race (HUD) [ASSUMED]

- **Top:** the club row (02 §1).
- **Top right:**
  - the race clock
  - a leaderboard listing each player's name, current hole (for example "H7") and strokes
  - an arrow for anyone on the same hole
- **On the same hole:** other players' golfers and live ball flights are visible, with a name tag over each.
- **Hole info:** hole number, par, the distance to the pin, and the lie under the ball.

## Results screen

- **Table:** place, name, time, strokes, holes completed, and a DNF marker where needed. Dead heats are shown as tied.
- **Per player:** a hole-by-hole strip with strokes and split times, plus fun stats: longest drive, fastest hole, most penalties.
- **Buttons:** Play again (back to the same lobby with a new seed, see 01) and Back to waiting room.

## Acceptance criteria

- **AC-R1:** Unit tests cover the ranking function, including the example above, a dead heat, a chain of three players 0.8 s apart and DNF ordering.
- **AC-R2:** With 200 ms of simulated latency on one client, its finish time differs from a 0 ms run of the same inputs by less than 0.25 s.
- **AC-R3:** Every penalty applies the right stroke count and drop wait. Unplayable relief always ends with the ball on a legal lie. Progress freezes exactly 60 s after the first finish, or at 20:00.
- **AC-R4:** "Play again" starts a new race with all players returning, without anyone reloading the page.
