import { describe, it, expect } from 'vitest';
import { RANGE, WALK_SPEED, PRECISE_SPEED, PRECISE_LOOK, canAddress, distance, golferSpot, lookScale, moveAxis, walkSpeed } from '../src/client/rules';

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

describe('owner movement and precision rules', () => {
  const keys = (...k: string[]) => new Set(k);
  it('default on-foot speed is 15 m/s; holding Shift (either side) walks at 5 m/s', () => {
    expect(WALK_SPEED).toBe(15); expect(PRECISE_SPEED).toBe(5);
    expect(walkSpeed(keys('ArrowUp'))).toBe(15); expect(walkSpeed(keys('ArrowUp', 'ShiftLeft'))).toBe(5); expect(walkSpeed(keys('ShiftRight'))).toBe(5);
  });
  it('the look multiplier is 0.5 while Shift is held and returns to 1 when it is released (set cleared on blur)', () => {
    expect(PRECISE_LOOK).toBe(0.5); const held = new Set(['ShiftLeft']);
    expect(lookScale(held)).toBe(0.5); held.delete('ShiftLeft'); expect(lookScale(held)).toBe(1);
    const stuck = new Set(['ShiftRight', 'ArrowUp']); stuck.clear();                                  // the blur handler clears the key set: no stuck Shift
    expect(lookScale(stuck)).toBe(1); expect(walkSpeed(stuck)).toBe(15);
  });
  it('Shift combines with an arrow key and with the stance keys without conflict', () => {
    expect(moveAxis(keys('ShiftLeft', 'ArrowUp'))).toEqual({ f: 1, r: 0 }); expect(moveAxis(keys('ShiftLeft', 'KeyW'))).toEqual({ f: 0, r: 0 });
    expect(lookScale(keys('ShiftLeft', 'KeyW', 'Digit7'))).toBe(0.5);                               // applies in the stance too
  });
});
