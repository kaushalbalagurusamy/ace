// Live scorecard arithmetic, shared by the server (records each hole) and the client (to-par, out/in totals).

const sum = (a: readonly (number | undefined)[]) => a.reduce<number>((t, v) => t + (v ?? 0), 0);

/** Records strokes on `hole` from the cumulative count in the ball state (penalty strokes included). */
export function recordHole(byHole: number[], hole: number, cumulative: number) { byHole[hole] = cumulative - sum(byHole.slice(0, hole)); }

/** Strokes against par over the holes finished so far: every hole before `hole`, plus `hole` itself once holed out. */
export function toPar(byHole: readonly number[], pars: readonly number[], hole: number, holedOut: boolean): number {
  const done = hole + (holedOut ? 1 : 0);
  return sum(byHole.slice(0, done)) - sum(pars.slice(0, done));
}

/** "E", "+3", "-1". */
export const parText = (d: number) => (d === 0 ? 'E' : d > 0 ? `+${d}` : `${d}`);
