import { describe, it, expect } from 'vitest';
import { RANGE, canAddress, distance, golferSpot, moveAxis } from '../src/client/rules';

describe('RP-2/RP-3 address prompt and the golfer spot', () => {
  it('the spot where the client puts the golfer next to any ball is within address range', () => {
    for (const b of [{ x: 0, z: 0 }, { x: -73.2, z: 311.9 }, { x: 140, z: -20 }, { x: 1e-3, z: 5e2 }]) {
      expect(distance(golferSpot(b), b)).toBeLessThan(RANGE);
      expect(canAddress(golferSpot(b), b, { atRest: true, holedOut: false })).toBe(true);
    }
  });
  it('walking to within range works; one metre past the range does not', () => {
    const b = { x: 10, z: 100 };
    expect(canAddress({ x: 10 + RANGE - 0.01, z: 100 }, b, { atRest: true, holedOut: false })).toBe(true);
    expect(canAddress({ x: 10 + RANGE + 1, z: 100 }, b, { atRest: true, holedOut: false })).toBe(false);
  });
  it('no stance while the ball is still moving, after hole-out, or from a cart', () => {
    const b = { x: 0, z: 0 };
    expect(canAddress(b, b, { atRest: false, holedOut: false })).toBe(false);
    expect(canAddress(b, b, { atRest: true, holedOut: true })).toBe(false);
    expect(canAddress(b, b, { atRest: true, holedOut: false, inCart: true })).toBe(false);
  });
  it('after a penalty the golfer goes to the dropped ball, not to the end of the tracer', () => {
    const tracerEnd = { x: 80, z: 250 }, dropped = { x: 5, z: 150 };
    expect(distance(golferSpot(dropped), dropped)).toBeLessThan(RANGE);
    expect(distance(golferSpot(dropped), tracerEnd)).toBeGreaterThan(RANGE);
  });
});

describe('SS-9 movement is the arrow keys; WASD belongs to the stance', () => {
  const keys = (...k: string[]) => new Set(k);
  it('arrow keys move (up = forward, right = right)', () => {
    expect(moveAxis(keys('ArrowUp'))).toEqual({ f: 1, r: 0 }); expect(moveAxis(keys('ArrowDown'))).toEqual({ f: -1, r: 0 });
    expect(moveAxis(keys('ArrowRight'))).toEqual({ f: 0, r: 1 }); expect(moveAxis(keys('ArrowLeft'))).toEqual({ f: 0, r: -1 }); expect(moveAxis(keys('ArrowUp', 'ArrowRight'))).toEqual({ f: 1, r: 1 });
    expect(moveAxis(keys('ArrowUp', 'ArrowDown'))).toEqual({ f: 0, r: 0 });
  });
  it('WASD never moves the golfer, alone or together with the arrows', () => {
    for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) expect(moveAxis(keys(k)), k).toEqual({ f: 0, r: 0 });
    expect(moveAxis(keys('KeyW', 'KeyD', 'ArrowLeft'))).toEqual({ f: 0, r: -1 });
  });
});
