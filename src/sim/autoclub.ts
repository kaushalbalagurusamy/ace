// Rangefinder auto-club: the shortest club whose simulated full swing from this lie reaches the plays-like distance.
import { BAG, launchFor, simulateShot } from './physics';
import { MIN_LENGTH } from './length';
import type { Lie } from './delivery';

const YD = 1.0936;
const FIELD = BAG.filter(c => c.key !== 'P');                       // long to short
const totalYd = (c: (typeof BAG)[number], lie: Lie, length = 1) => simulateShot(launchFor(c, { length, lie })).totalM * YD;

export interface ClubSuggestion { club: string; label: string; playsYd: number; holdPct?: number; text: string }

export function suggestClub(targetYd: number, lie: Lie, opts: { riseYd?: number } = {}): ClubSuggestion {
  const playsYd = targetYd + (opts.riseYd ?? 0);
  const head = `Target ${Math.round(targetYd)} yd · plays ${Math.round(playsYd)}`;
  const putter = BAG.find(c => c.key === 'P')!;
  if (lie === 'green' || (lie === 'fringe' && targetYd <= 5)) return { club: putter.key, label: putter.label, playsYd, text: `${head} · ${putter.label}` };
  const wedge = FIELD[FIELD.length - 1]!;
  if (playsYd < totalYd(wedge, lie)) {
    let lo = MIN_LENGTH, hi = 1;                                      // total grows with length: bisect for the hold that lands on the target
    for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (totalYd(wedge, lie, mid) < playsYd) lo = mid; else hi = mid; }
    const holdPct = Math.round(((lo + hi) / 2) * 100);
    return { club: wedge.key, label: wedge.label, playsYd, holdPct, text: `${head} · ${wedge.label} · about ${holdPct}% hold` };
  }
  let pick = FIELD[0]!;                                               // beyond the driver stays the driver
  for (const c of FIELD) if (totalYd(c, lie) >= playsYd) pick = c;    // keeps the last (shortest) club that still reaches
  return { club: pick.key, label: pick.label, playsYd, text: `${head} · ${pick.label}` };
}

/** A manual number-key club sticks while the target is unchanged. */
export function overrideSticks(state: { manual: string | null; target: number }, now: { target: number }): string | null {
  return state.manual !== null && state.target === now.target ? state.manual : null;
}
