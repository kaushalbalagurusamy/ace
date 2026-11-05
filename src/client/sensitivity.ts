// Look sensitivity: the owner prefers the speed of a macOS three-finger drag, so the default is 2.5x the old 0.003 rad per pixel,
// adjustable live with , and . in 10% steps, persisted in localStorage (never allowed to throw).
export const BASE = 0.003;
export const DEFAULT_MULT = 2.5, MIN_MULT = 0.5, MAX_MULT = 8, STEP = 0.1;
const KEY = 'ace.look';

const clamp = (m: number) => Math.min(MAX_MULT, Math.max(MIN_MULT, m));
export const lookDelta = (movement: number, mult: number) => movement * BASE * mult;
export const stepMult = (m: number, dir: 1 | -1) => clamp(Math.round(m * (1 + dir * STEP) * 100) / 100);
export const label = (m: number) => `Look ${m.toFixed(1)}×`;

export function loadMult(storage: Pick<Storage, 'getItem'> = localStorage): number {
  try { const v = Number(storage.getItem(KEY)); return Number.isFinite(v) && storage.getItem(KEY) !== null && storage.getItem(KEY) !== '' ? clamp(v) : DEFAULT_MULT; } catch { return DEFAULT_MULT; }
}
export function saveMult(m: number, storage: Pick<Storage, 'setItem'> = localStorage): boolean {
  try { storage.setItem(KEY, String(m)); return true; } catch { return false; }
}

/** Requests pointer lock with unadjustedMovement (no OS acceleration, so a trackpad drag and a mouse move scale the same); plain lock if rejected. */
export async function requestLock(el: { requestPointerLock?: (o?: { unadjustedMovement?: boolean }) => unknown }): Promise<void> {
  if (!el.requestPointerLock) return;
  try { await el.requestPointerLock({ unadjustedMovement: true }); return; } catch { /* not granted: fall back */ }
  try { await el.requestPointerLock(); } catch { /* no lock available */ }
}
