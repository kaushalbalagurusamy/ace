# 07. Golf cart: the Genesis Box Buggy

**Status:** built 2026-11-05. Code: `src/shared/cart.ts` (kinematics, ground, spawn, bumps), `src/server/movers.ts` (server checks), `src/client/cartmodel.ts` (model), `src/client/main.ts` (driving, camera, HUD). Tests: `tests/cart.test.ts`, `tests/movers.test.ts`, `tests/parse.test.ts`. Browser check: `scripts/e2e-cart.mjs`.

Tags as in [README.md](README.md): **[GIVEN]** is the owner's, **[ASSUMED]** filled a gap.

## Why

- **[GIVEN]** Each player gets a golf cart so that getting between shots is faster and more fun. The cart is the Genesis Box Buggy, because Genesis is a sponsor (refs: `refs/cart/`, docs/research/reference-sources.md).

## Where the cart is

- **[GIVEN]** Every player has a cart. It waits beside them on every tee and moves to the next tee with them at the hole change.
- **[ASSUMED]** On each tee the carts park facing the pin, on the nearest drivable spots to the golfer, at least 3 m apart. The first player's cart is within E range of where they stand; the others are a short walk away. The client and the server compute the same spots from the shared lie grid, and the player's order in the race picks the spot.

## Getting in and out

- **[GIVEN]** **E** within 3 m of your cart gets in; **E** in the cart gets out, and the golfer steps out beside it.
- **[ASSUMED]** The golfer steps out on the driver's (left) side, 1.8 m from the cart's centre. Getting out stops the cart.
- **[GIVEN]** You cannot take a stance or swing from the cart. Space in the cart shows "E: get out to play". **[ASSUMED]** The server also refuses a shot or putt from a player it knows is driving.
- **[ASSUMED]** The driver is hidden while driving rather than drawn seated (a later polish item).

## Driving

- **[GIVEN, swapped 2026-11-05]** W A S D drive: W is throttle, S brakes and then reverses, A and D steer. The mouse orbits the chase camera.
- **[GIVEN]** Arcade feel: top speed 18 m/s, acceleration about 6 m/s², braking about 10 m/s², a steering rate that tightens with speed, a little drift damping, and the cart cannot flip.
- **[ASSUMED]** Coasting with no key loses 2 m/s². Reverse tops out at 5 m/s. The turn rate is zero at a standstill, peaks at about 1.65 rad/s at 4 m/s, and falls to about 0.9 rad/s at 18 m/s. Sideways slip dies away at 5 per second. There is no roll or pitch, so the cart cannot flip.
- **[ASSUMED]** The chase camera sits 11 m back and eases toward the cart's heading plus the mouse orbit (frame-rate independent). When you drive faster than 2 m/s and have not moved the mouse for 1.5 s, the orbit eases back behind the cart. A bump adds a short camera shake.
- **[ASSUMED]** The prompt shows "WASD drive · speed in mph · E: get out to play" while driving, and "E: get in the cart" when you are in range on foot.

## Where carts may go

From the shared lie grid (`src/shared/course-grid.ts`):

- **[GIVEN]** Blocked: greens, fringe, tees, bunkers and water. The cart stops at the edge with a soft bump, as real carts are kept off these areas.
- **[ASSUMED]** "Fringe" is any ground within 2 m of a green cell (the grid has no fringe class). "Tee" is within 3 m of the hole's tee. Out of bounds is blocked too, so carts cannot drive off the map.
- **[ASSUMED]** The soft bump: the cart stays at the edge and rolls back at 20% of its speed, with the bump sound. A cart that is already on blocked ground (pushed there by a bump) can still drive out.
- **[GIVEN]** Rough slows the cart to 70% of top speed (12.6 m/s). **[ASSUMED]** Trees and rock cells count as rough. First cut and fairway are full speed.
- **[GIVEN]** The cart path is full speed.

## Bumping

- **[GIVEN]** Cart-to-cart collisions push both carts apart with an impulse scaled to the closing speed, Mario Kart style. There is no damage, and a bump plays a sound. A cart hitting a golfer on foot knocks the golfer back a little. Carts never touch balls.
- **[ASSUMED]** Circle colliders of 1.3 m per cart and 0.4 m per golfer. Each cart gets a velocity change of 1.5 m/s plus 0.8 × the closing speed, equal and opposite, and the overlap is split between them. A cart moving faster than 1.5 m/s that reaches a golfer pushes them out of its path by about 1 m plus 0.1 m per m/s of the cart's speed. Your own cart never knocks you.
- **[GIVEN]** The server resolves collisions from the positions players report and sends corrections.
- **[ASSUMED]** The server applies each push to its own copy at once and resolves a pair at most every 250 ms, so one contact is not counted twice.

## Server and protocol

- **[GIVEN]** The wire protocol is typed and validated (`src/server/parse.ts` style: bounded numbers, no extra fields).
  - **[ASSUMED]** Client to server, about 10 times a second: `move {x, z, yaw, driving, cart {x, z, yaw, vx, vz}}`. Positions are bounded to ±5000 m, velocities to ±100 m/s, headings normalised to [0, 2π). Unknown fields are dropped.
  - **[ASSUMED]** Server to client: `movers` (every racer's golfer and cart, 10 Hz), `bump` (a push for one player to apply), `snap` (the server's state after a refused move).
- **[GIVEN]** The server clamps reported cart speeds to 19 m/s or less and rejects teleports.
  - **[ASSUMED]** Teleport check, a leaky-bucket travel allowance per player (supervisor security review). Each report refills the cart's allowance at 19 m/s, and the golfer's at 16 m/s on foot or 19 m/s while driving. The allowance is capped at 1 s of travel plus 3 m of slack. Each report spends the distance moved, and a report that overspends is refused with `snap`. So many reports a few ms apart cannot each claim the slack.
  - **[ASSUMED]** A golfer may always move onto their own ball's spot (after a penalty drop). Entering the cart needs the golfer within 3.5 m of it on the server. While driving, the golfer is wherever the cart is.
  - **[ASSUMED]** At most 30 `move` messages per second per socket are processed; the rest are dropped, inside the existing limit of 40 messages per second.

## Mini map

- **[GIVEN]** Carts show on the mini map: your own as the heading arrow while you drive, the others as small cart icons.
- **[ASSUMED]** A parked cart, your own included, is a small cart icon in its player's colour, turned to its heading. Other golfers on foot now show where they really are (from `movers`), not beside their ball.

## Model

- **[GIVEN]** A code-built, stylised low-poly Box Buggy in the existing look (assets/STYLE.md). It has a dark blue glass-canopy box body, a rear light bar with chrome strips, chunky knobby wheels on exposed suspension and tan seats. It should read as the Genesis references at play distance. The wheels spin with speed and the front wheels steer.
- **[ASSUMED]** Each cart's roof carries a band in its player's colour so the carts can be told apart. The front has a single chrome bar. There is no Genesis badge (STYLE.md: no logos baked in).
- **[GIVEN]** A Meshy model is optional and is used only after an independent critic gives its manifest row a PASS. **Not generated in this slice** (no credits spent). The code-built cart ships. Renders at the reference angles are in `assets/qa/cart/cart-model-rear34.png` and `cart-model-front34.png`.

## Sound

- **[GIVEN]** An electric whir whose pitch follows speed, and a bump.
- **[ASSUMED]** Both are synthesised in Web Audio (`src/client/audio.ts`), not generated files. The whir is a low-passed sawtooth with a sub-octave, at 110 to 530 Hz, getting louder with speed. The bump is a decaying noise burst over a falling 95 to 40 Hz thump. No ElevenLabs credits were spent and no manifest rows were added.

## Not done

- **[ASSUMED]** There is no client-side prediction of other players' carts beyond easing toward the 10 Hz reports.
- **[ASSUMED]** There is no seated driver pose.
- **[ASSUMED]** Carts do not collide with trees or props (only the lie grid applies).
