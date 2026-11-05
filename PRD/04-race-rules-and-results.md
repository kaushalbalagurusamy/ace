# 04: Race rules and results

## Stories

- **US-R1** [GIVEN]: The goal is speed. I win by holing out on hole 18 before everyone else.
- **US-R2** [GIVEN]: My score doesn't matter, but poor shots cost me time.
- **US-R3** [GIVEN]: If finish times are within 1 second, the lower score wins, which allows for ping and lag.
- **US-R4** [ASSUMED]: I can always see where I stand against the others during the race.
- **US-R5** [ASSUMED]: At the end I see results and can play again.

## Race flow

1. A 5 s countdown starts, then "Go". Every player spawns on hole 1's tee at the same moment.
2. [OPEN Q1] Players play simultaneously at their own pace. There is no turn order and no waiting for others.
3. On holing out, a 2 s hole card shows (hole, strokes, split time), then the player is moved to the next tee automatically. The clock keeps running through this.
4. [GIVEN] A player finishes when they hole out on hole 18.
5. [ASSUMED] A player who has finished can spectate the others from a free camera or follow the leader.
6. [ASSUMED] The race ends when every player has finished, or 3 minutes after the first finisher, or 30 minutes after Go, whichever comes first.

## Timing

- [ASSUMED] The server keeps the one race clock. Clients show the server time, smoothed.
- **Finish time** = the moment the server-simulated ball drops into the 18th cup − Go.
  - The server takes the swing's receive time and adds the simulated flight-and-roll time, so the finish moment comes from the simulation, not from when a message arrives.
- **Score** = total strokes, including penalty strokes.

## Penalties and anti-stuck [OPEN Q5]

| Situation | Rule [ASSUMED] |
|---|---|
| Out of bounds | +1 stroke; ball dropped on the nearest fairway point to where it crossed the line |
| Water | +1 stroke; dropped on the nearest dry fairway or first cut behind the entry point |
| Stuck or unplayable (hold R for 2 s) | +2 strokes; dropped on the nearest fairway point no closer to the hole |
| 10 strokes on a hole | Hole picked up and scored as 10; player moved to the next tee |

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
then rank non-finishers below finishers: most holes completed, then fewest strokes
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
- **AC-R3:** No hole can last longer than 10 strokes. R-reset always ends with the ball on a legal lie.
- **AC-R4:** "Play again" starts a new race with all players returning, without anyone reloading the page.
