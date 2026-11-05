import { describe, it, expect } from 'vitest';
import { BASE, DEFAULT_MULT, MAX_MULT, MIN_MULT, label, loadMult, lookDelta, requestLock, saveMult, stepMult } from '../src/client/sensitivity';

const store = (init?: string) => { let v = init; return { getItem: () => v ?? null, setItem: (_: string, x: string) => { v = x; }, get value() { return v; } }; };

describe('look sensitivity (owner: three-finger-drag feel, about 2.5x the old default)', () => {
  it('the default is 2.5x the old 0.003 rad per pixel', () => { expect(BASE).toBe(0.003); expect(DEFAULT_MULT).toBe(2.5); expect(lookDelta(100, DEFAULT_MULT)).toBeCloseTo(0.75, 10); });
  it('turn is linear in the physical movement and in the multiplier', () => {
    expect(lookDelta(200, 2)).toBeCloseTo(2 * lookDelta(100, 2), 12); expect(lookDelta(100, 4)).toBeCloseTo(2 * lookDelta(100, 2), 12); expect(lookDelta(-50, 2)).toBeCloseTo(-lookDelta(50, 2), 12);
  });
  it('steps are 10% and clamped to the allowed range', () => {
    expect(stepMult(2.5, 1)).toBeCloseTo(2.75, 10); expect(stepMult(2.5, -1)).toBeCloseTo(2.25, 10);
    let m = 2.5; for (let i = 0; i < 60; i++) m = stepMult(m, 1); expect(m).toBe(MAX_MULT);
    m = 2.5; for (let i = 0; i < 60; i++) m = stepMult(m, -1); expect(m).toBe(MIN_MULT);
  });
  it('the toast label shows one decimal and the multiplication sign', () => { expect(label(2.5)).toBe('Look 2.5×'); expect(label(2.75)).toBe('Look 2.8×'); });
  it('persists and reloads the chosen multiplier', () => { const s = store(); expect(saveMult(3.3, s)).toBe(true); expect(loadMult(s)).toBeCloseTo(3.3, 10); });
  it('a missing, garbage or out-of-range stored value falls back to the default or the clamp', () => {
    expect(loadMult(store())).toBe(DEFAULT_MULT); expect(loadMult(store('abc'))).toBe(DEFAULT_MULT); expect(loadMult(store('NaN'))).toBe(DEFAULT_MULT);
    expect(loadMult(store('999'))).toBe(MAX_MULT); expect(loadMult(store('0.0001'))).toBe(MIN_MULT);
  });
  it('storage that throws (private mode, disabled) never breaks load or save', () => {
    const bad = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(loadMult(bad)).toBe(DEFAULT_MULT); expect(saveMult(2, bad)).toBe(false);
  });
});

describe('pointer lock request: unadjusted movement when the browser allows it, plain lock otherwise', () => {
  it('asks for unadjustedMovement first', async () => {
    const calls: unknown[] = []; const el = { requestPointerLock: (o?: unknown) => { calls.push(o); return Promise.resolve(); } };
    await requestLock(el as never); expect(calls).toEqual([{ unadjustedMovement: true }]);
  });
  it('falls back to a plain lock when the option is rejected (promise rejection or a thrown error)', async () => {
    const calls: unknown[] = []; const rejecting = { requestPointerLock: (o?: unknown) => { calls.push(o); return o ? Promise.reject(new Error('NotSupportedError')) : Promise.resolve(); } };
    await requestLock(rejecting as never); expect(calls).toEqual([{ unadjustedMovement: true }, undefined]);
    const calls2: unknown[] = []; const throwing = { requestPointerLock: (o?: unknown) => { calls2.push(o); if (o) throw new TypeError('bad option'); } };
    await requestLock(throwing as never); expect(calls2).toEqual([{ unadjustedMovement: true }, undefined]);
  });
  it('does nothing and never throws when pointer lock is not available', async () => { await expect(requestLock({} as never)).resolves.toBeUndefined(); });
});
