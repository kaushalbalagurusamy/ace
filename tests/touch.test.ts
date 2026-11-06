import { describe, expect, it } from 'vitest';
import { FULL_PULL, TAP_PX, pullToHoldMs, touchText } from '../src/client/touch';
import { FULL_TURN_MS, MAX_EFFORT_HOLD_MS } from '../src/sim/length';

describe('touch swing pull', () => {
  const H = 800, full = FULL_PULL * H;   // 280 px = a full turn
  it('a pull shorter than the tap threshold is no shot', () => {
    expect(pullToHoldMs(0, H, false)).toBeNull();
    expect(pullToHoldMs(TAP_PX - 1, H, false)).toBeNull();
    expect(pullToHoldMs(TAP_PX, H, false)).not.toBeNull();
  });
  it('scales linearly: half the full pull is half the full-turn hold', () => {
    expect(pullToHoldMs(full / 2, H, false)).toBe(FULL_TURN_MS / 2);
    expect(pullToHoldMs(full, H, false)).toBe(FULL_TURN_MS);
  });
  it('full swings run on into the MAX-effort zone and stop at 1.10 s', () => {
    expect(pullToHoldMs(full * 1.2, H, false)).toBe(900);
    expect(pullToHoldMs(full * (MAX_EFFORT_HOLD_MS / FULL_TURN_MS), H, false)).toBe(MAX_EFFORT_HOLD_MS);
    expect(pullToHoldMs(full * 3, H, false)).toBe(MAX_EFFORT_HOLD_MS);
  });
  it('putts and chips stop at the full turn', () => {
    expect(pullToHoldMs(full * 2, H, true)).toBe(FULL_TURN_MS);
  });
  it('rewords the keyboard prompts', () => {
    expect(touchText('Space: take your stance · E: get in the cart')).toBe('Tap Swing to take your stance · Cart: get in the cart');
  });
});
