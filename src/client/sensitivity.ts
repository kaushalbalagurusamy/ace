// Look sensitivity: the owner prefers a faster look than the old 0.003 rad per pixel but 2.5x was too fast, so the default is 1.75x.
// Adjustable with the settings slider (0.5x to 4.0x in 0.05 steps) and with , and . (10% steps); both write the same saved setting.
export const BASE = 0.003;
export const DEFAULT_MULT = 1.75, MIN_MULT = 0.5, MAX_MULT = 4, STEP = 0.1, SLIDER_STEP = 0.05;
const KEY = 'ace.look', MANUAL_KEY = 'ace.look.manual', OLD_DEFAULT = 2.5;

const clamp = (m: number) => Math.min(MAX_MULT, Math.max(MIN_MULT, m));
export const lookDelta = (movement: number, mult: number) => movement * BASE * mult;
export const stepMult = (m: number, dir: 1 | -1) => clamp(Math.round(m * (1 + dir * STEP) * 100) / 100);
export const sliderValue = (v: number) => clamp(Math.round(v / SLIDER_STEP) * SLIDER_STEP);
export const label = (m: number) => `Look ${m.toFixed(2).replace(/0$/, '')}×`;

type Store = Pick<Storage, 'getItem' | 'setItem'>;
const store = (): Store => localStorage;
/** Saved multiplier. Migration: a stored 2.5 (the old default) that the player never adjusted by hand moves to the new default. */
export function loadMult(storage: Pick<Storage, 'getItem'> = store()): number {
  try {
    const raw = storage.getItem(KEY); if (raw === null || raw === '') return DEFAULT_MULT;
    const v = Number(raw); if (!Number.isFinite(v)) return DEFAULT_MULT;
    if (storage.getItem(MANUAL_KEY) !== '1' && Math.abs(v - OLD_DEFAULT) < 1e-9) return DEFAULT_MULT;
    return clamp(v);
  } catch { return DEFAULT_MULT; }
}
/** Saves the multiplier; `byPlayer` (slider or keys) sets the flag that protects it from the default migration. */
export function saveMult(m: number, storage: Pick<Storage, 'setItem'> = store(), byPlayer = true): boolean {
  try { storage.setItem(KEY, String(m)); if (byPlayer) storage.setItem(MANUAL_KEY, '1'); return true; } catch { return false; }
}
export function resetMult(storage: Pick<Storage, 'setItem'> = store()): number { try { storage.setItem(KEY, String(DEFAULT_MULT)); storage.setItem(MANUAL_KEY, '0'); } catch { /* ignore */ } return DEFAULT_MULT; }

/** Requests pointer lock with unadjustedMovement (no OS acceleration, so a trackpad drag and a mouse move scale the same); plain lock if rejected. */
export async function requestLock(el: { requestPointerLock?: (o?: { unadjustedMovement?: boolean }) => unknown }): Promise<void> {
  if (!el.requestPointerLock) return;
  try { await el.requestPointerLock({ unadjustedMovement: true }); return; } catch { /* not granted: fall back */ }
  try { await el.requestPointerLock(); } catch { /* no lock available */ }
}
