// The lie panel's numbers (owner: show the penalties and the slope angles, never a computed curve). Pure, so tests can check it against LIE.
import { LIE, type Club, type Lie } from '../sim';
import type { StanceSlope, Vec3 } from '../shared/height';

const NAME: Record<Lie, string> = { tee: 'Tee', fairway: 'Fairway', firstCut: 'First cut', rough: 'Rough', bunker: 'Bunker', fringe: 'Fringe', green: 'Green' };
const LIES = Object.keys(NAME) as Lie[];
export const asLie = (s: string): Lie => (LIES.includes(s as Lie) ? (s as Lie) : 'rough');   // paths and other surfaces play like rough
const pct = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}%`;
const deg = (r: number) => (r * 180) / Math.PI;
const f1 = (n: number) => Math.abs(n).toFixed(1);
const sg = (n: number) => `${n > 0.05 ? '+' : n < -0.05 ? '−' : ''}${f1(n)}`;

export interface LieInfo { name: string; powerPct: number; spinPct: number; launchDeg: number; lines: string[] }
/** Ball-speed, spin and launch changes this lie gives `club` (the LIE table, as launchFor applies it), and the stance angles. */
export function lieInfo(surface: string, club: Club, slope: StanceSlope, n: Vec3): LieInfo {
  const lie = asLie(surface), L = LIE[lie], putter = club.key === 'P';
  const speed = lie === 'bunker' && club.loftDeg >= 50 ? L.wedgeSpeed! : putter && (lie === 'fringe' || lie === 'green') ? 1 : L.speed;
  const powerPct = Math.round((speed - 1) * 100), spinPct = putter ? 0 : Math.round((L.spin - 1) * 100), launchDeg = putter ? 0 : L.launch;
  const parts = [`${pct(powerPct)} power`, `${pct(spinPct)} spin${lie === 'rough' ? ' (flyer)' : ''}`, `${launchDeg ? `+${launchDeg}°` : '±0°'} launch`];
  const lines = [`${NAME[lie]}: ${parts.join(' · ')}`];
  if (lie === 'tee') lines.push('Level tee box');
  else {
    const a = slope.alongDeg, s = slope.sideDeg;
    lines.push(Math.abs(a) < 0.1 ? 'Level along the line' : `${a > 0 ? 'Uphill' : 'Downhill'} ${f1(a)}° along the line`);
    lines.push(Math.abs(s) < 0.1 ? 'Level stance' : `Ball ${s > 0 ? 'above' : 'below'} your feet ${f1(s)}°`);
  }
  lines.push(`Tilt x ${sg(deg(Math.asin(n.x)))}° · y ${f1(deg(Math.acos(Math.min(1, n.y))))}° · z ${sg(deg(Math.asin(n.z)))}°`);
  return { name: NAME[lie], powerPct, spinPct, launchDeg, lines };
}
