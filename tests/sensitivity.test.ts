import { describe, it, expect } from 'vitest';
import { BASE, DEFAULT_MULT, MAX_MULT, MIN_MULT, label, loadMult, lookDelta, requestLock, resetMult, saveMult, sliderValue, stepMult } from '../src/client/sensitivity';

const store = (init?: string, manual?: string) => { const m = new Map<string, string>(); if (init !== undefined) m.set('ace.look', init); if (manual !== undefined) m.set('ace.look.manual', manual); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, x: string) => { m.set(k, x); } }; };

describe('look sensitivity (owner: 1.75x the old default, 70% of the first 2.5x guess)', () => {
  it('the default is 1.75x the old 0.003 rad per pixel', () => { expect(BASE).toBe(0.003); expect(DEFAULT_MULT).toBe(1.75); expect(lookDelta(100, DEFAULT_MULT)).toBeCloseTo(0.525, 10); });
  it('turn is linear in the physical movement and in the multiplier', () => {
    expect(lookDelta(200, 2)).toBeCloseTo(2 * lookDelta(100, 2), 12); expect(lookDelta(100, 4)).toBeCloseTo(2 * lookDelta(100, 2), 12); expect(lookDelta(-50, 2)).toBeCloseTo(-lookDelta(50, 2), 12);
  });
  it('steps are 10% and clamped to the allowed range', () => {
    expect(stepMult(1.75, 1)).toBeCloseTo(1.93, 1); expect(stepMult(1.75, -1)).toBeCloseTo(1.58, 1);
    let m = 1.75; for (let i = 0; i < 60; i++) m = stepMult(m, 1); expect(m).toBe(MAX_MULT);
    m = 1.75; for (let i = 0; i < 60; i++) m = stepMult(m, -1); expect(m).toBe(MIN_MULT);
  });
  it('the toast label shows the multiplier with a multiplication sign', () => { expect(label(1.75)).toBe('Look 1.75×'); expect(label(2.5)).toBe('Look 2.5×'); });
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

describe('settings slider, shared setting, persistence and the migration rule', () => {
  it('the slider runs 0.5x to 4.0x in 0.05 steps', () => { expect(MIN_MULT).toBe(0.5); expect(MAX_MULT).toBe(4); expect(sliderValue(1.77)).toBeCloseTo(1.75, 10); expect(sliderValue(0.1)).toBe(0.5); expect(sliderValue(9)).toBe(4); expect(sliderValue(2.026)).toBeCloseTo(2.05, 10); });
  it('slider and the , . keys write the same saved setting', () => {
    const s = store(); saveMult(sliderValue(2.2), s); expect(loadMult(s)).toBeCloseTo(2.2, 10);
    const stepped = stepMult(loadMult(s), 1); saveMult(stepped, s); expect(loadMult(s)).toBeCloseTo(stepped, 10);
  });
  it('reset returns to 1.75 and clears the player-changed flag', () => { const s = store(); saveMult(3.3, s); expect(resetMult(s)).toBe(1.75); expect(loadMult(s)).toBe(1.75); });
  it('migration: the old 2.5 default that the player never touched becomes 1.75; a 2.5 the player chose by hand stays', () => {
    expect(loadMult(store('2.5'))).toBe(1.75); expect(loadMult(store('2.5', '0'))).toBe(1.75); expect(loadMult(store('2.5', '1'))).toBe(2.5);
    expect(loadMult(store('3', undefined))).toBe(3);                                      // other values were chosen by hand: kept
  });
  it('a fresh player gets the default', () => { expect(loadMult(store())).toBe(1.75); });
});
