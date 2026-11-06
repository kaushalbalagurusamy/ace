// Shot lists for the motion QA videos (scripts/qa/render-golfer.mjs <pw> <out> <shots.json>), one shot per 30 fps frame per view.
// Usage: npx tsx scripts/qa/motion-shots.ts swing|run <out.json>
//   swing: address, a full 750 ms hold, the release to the held finish in real time, then the same swing again at half speed.
//   run:   the 15 m/s sprint, slowing to the 5 m/s jog, a walk, the stop into the idle (speeds eased as the game's speed filter does).
import { writeFileSync } from 'node:fs';
import { gaitCadence, releaseTimes } from '../../src/client/golferanim';
import { FULL_TURN_MS } from '../../src/sim/length';

const [kind, out] = process.argv.slice(2);
const views = ['faceon', 'dtl'], shots: unknown[] = [], dt = 1000 / 30;
const add = (n: number, pose: string, o: object) => { for (const v of views) shots.push([`${v}-${String(n).padStart(4, '0')}`, v, pose, o]); };
if (kind === 'swing') {
  const T = releaseTimes(1), rel = T.down + T.follow + 500;
  let n = 0;
  for (const slow of [1, 2]) {
    for (let t = 0; t < 300; t += dt) add(n++, 'back', { depth: 0 });
    for (let t = 0; t < FULL_TURN_MS * slow; t += dt) add(n++, 'back', { depth: t / slow / FULL_TURN_MS });
    for (let t = 0; t < rel * slow; t += dt) add(n++, 'release', { depth: 1, ms: t / slow });
  }
} else {
  const plan: [number, number][] = [[15, 2000], [5, 2000], [1.4, 2000], [0, 1200]];   // target speed, ms
  let v = 15, phase = 0, n = 0;
  for (const [target, ms] of plan) for (let t = 0; t < ms; t += dt) {
    v += (target - v) * (1 - Math.exp(-8 * dt / 1000)); phase += gaitCadence(v) * dt / 1000;
    add(n++, 'gait', { phase, speed: v, t: n * dt / 1000 });
  }
}
writeFileSync(out!, JSON.stringify(shots));
console.log(kind, shots.length, 'shots');
