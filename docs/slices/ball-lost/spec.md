# Slice P0: the ball is never "lost" (owner playtest 2026-11-05)

Owner report: the 2nd shot went into the rough, the ball was not visible, and walking to the end of the tracer never showed the address prompt, so the race could not continue.

## Root cause (reproduced by reading the data path, verified by the invariant test below)
The tracer ends where the flight ended, but when the shot ends in **water or out of bounds** the server legally puts the ball somewhere else (a relief drop, or back at the previous spot) and charges the penalty. On inland holes "outside the traced map" was drawn as dark forest, indistinguishable from rough, and the penalty toast lasted 3 s, so the player walked to the end of the tracer (in the forest), found no ball and no prompt, and the golfer was never moved to the ball. Not a coordinate mismatch: the server's final ball position equals the replay's last sample whenever there is no penalty (checked by TEST RP-1).

## Fix
1. Out of bounds is visible: a white boundary line and a hatched, darker texture outside it (legend in the how-to-play panel).
2. A penalty shows a large banner for 5 s ("Out of bounds: +1, replay from the previous spot" or the water relief text) and **the golfer is moved to the ball** when the replay ends (PRD/04: "the golfer is moved there").
3. An always-visible marker for your own ball: a yellow beacon above it, an edge arrow with the distance in yards when it is off screen, a bigger ring on the mini map, and a "Walk to your ball: N yd" hint when you are out of range.
4. One shared rule for the address range (`src/client/rules.ts`), used by the prompt and tested.

## Acceptance criteria and the one check for each
| ID | Criterion | Check |
|---|---|---|
| RP-1 | Over 200 seeded shots from every lie type on all 18 holes: with no penalty the server ball equals the last replay sample; with a penalty the ball is on a playable lie, strokes are +2, drop wait 2 s; every resting lie (green, fairway, first cut, rough, bunker) and both penalties are seen | unit (server) |
| RP-2 | Standing where the client places the golfer for any server rest position shows the address prompt (distance within range); one metre past the range does not | unit (client rules) |
| RP-3 | After a penalty the golfer's spot is the dropped ball, not the tracer's end | unit (client rules) |
| RP-4 | The beacon, the edge arrow with distance, the OOB boundary line and the penalty banner are present in a real browser run | browser script |
