import { describe, it, expect } from 'vitest';
import { SwingFSM, type Action } from '../src/client/swingfsm';
import { durationScale, FULL_TURN_MS } from '../src/sim';

const IMPACT_BASE = 300;
const full = () => new SwingFSM({ putt: false, aimDeg: 12.5, clubKey: '7' });
const putter = () => new SwingFSM({ putt: true, aimDeg: 3, clubKey: 'P' });
type Shot = Extract<Action, { type: 'send-shot' }>;
const shot = (a: Action | null | undefined): Shot => { expect(a?.type).toBe('send-shot'); return a as Shot; };

describe('SH-6 full swing: Space hold sets length, release is the top, Z/X/C relative to release', () => {
  it('the happy path sends one shot with continuous length and release-relative timings', () => {
    const f = full();
    expect(f.key('Space', true, 1000)).toBeNull();            // second Space press: backswing starts
    expect(f.key('Space', false, 1375)).toBeNull();           // release at 375 ms = length 0.5
    const d = durationScale(0.5);
    expect(f.key('KeyZ', true, 1375)).toBeNull();
    expect(f.key('KeyX', true, 1375 + 60 * d)).toBeNull();
    expect(f.key('KeyC', true, 1375 + 150 * d)).toBeNull();
    expect(f.tick(1375 + IMPACT_BASE * d - 1)).toBeNull();    // before the (scaled) impact deadline
    const a = shot(f.tick(1375 + IMPACT_BASE * d));
    expect(a.msg).toEqual({ t: 'shot', clubKey: '7', aimDeg: 12.5, length: 0.5, zMs: 0, xMs: 60 * d, cMs: 150 * d });
    expect(f.tick(5000)).toBeNull();                          // no double send
    expect(f.key('Space', true, 5001)).toBeNull();
  });
  it('holding past a full turn pauses at the top: length stays 1', () => {
    const f = full(); f.key('Space', true, 0); f.key('Space', false, 5000);
    const a = shot(f.tick(5000 + IMPACT_BASE)); expect(a.msg.length).toBe(1);
  });
  it('a quick tap floors at the minimum length 0.05', () => {
    const f = full(); f.key('Space', true, 100); f.key('Space', false, 110);
    expect(shot(f.tick(110 + IMPACT_BASE)).msg.length).toBe(0.05);
  });
  it('the impact deadline scales with length: a 25% swing strikes 180 ms after the release', () => {
    const f = full(); f.key('Space', true, 0); f.key('Space', false, 0.25 * FULL_TURN_MS);
    const top = 0.25 * FULL_TURN_MS;
    expect(f.tick(top + 179)).toBeNull();
    expect(shot(f.tick(top + 180)).msg.length).toBe(0.25);
  });
  it('meter(t) shows the fraction reached while holding, 0 in the stance, and freezes after release', () => {
    const f = full();
    expect(f.meter(500)).toBe(0);
    f.key('Space', true, 1000);
    expect(f.meter(1000)).toBe(0.05); expect(f.meter(1000 + 375)).toBeCloseTo(0.5, 10); expect(f.meter(9000)).toBe(1);
    f.key('Space', false, 1000 + 375); expect(f.meter(9000)).toBeCloseTo(0.5, 10);
  });
  it('key auto-repeat of the second Space press is ignored (t0 does not move)', () => {
    const f = full(); f.key('Space', true, 1000); f.key('Space', true, 1100); f.key('Space', true, 1200);
    f.key('Space', false, 1375);
    expect(shot(f.tick(1375 + IMPACT_BASE)).msg.length).toBeCloseTo(0.5, 10);
  });
});

describe('SH-6 rollover: Space, Z, X and C can overlap without losing a key', () => {
  it('Z pressed while Space is still down is kept as an early (negative) offset', () => {
    const f = full(); f.key('Space', true, 1000); f.key('KeyZ', true, 1300); f.key('Space', false, 1375);
    f.key('KeyX', true, 1375 + 45); f.key('KeyC', true, 1375 + 112.5);
    const a = shot(f.tick(1375 + 225));
    expect(a.msg.zMs).toBe(-75); expect(a.msg.xMs).toBeCloseTo(45, 10); expect(a.msg.cMs).toBeCloseTo(112.5, 10);
  });
  it('all four keys down together, then Space released: nothing is dropped', () => {
    const f = full(); f.key('Space', true, 1000);
    f.key('KeyZ', true, 1360); f.key('KeyX', true, 1362); f.key('KeyC', true, 1364); f.key('Space', false, 1375);
    const a = shot(f.tick(1375 + 300));
    expect([a.msg.zMs, a.msg.xMs, a.msg.cMs]).toEqual([-15, -13, -11]);
  });
  it('keys released in any order after impact do not matter; keys released early are omitted', () => {
    const f = full(); f.key('Space', true, 0); f.key('Space', false, 750);
    f.key('KeyZ', true, 750); f.key('KeyZ', false, 800);      // let go before impact: bail out
    f.key('KeyX', true, 810); f.key('KeyC', true, 900);
    const a = shot(f.tick(750 + 300));
    expect(a.msg.zMs).toBeUndefined(); expect(a.msg.xMs).toBe(60); expect(a.msg.cMs).toBe(150);
  });
  it('a key never pressed is omitted; a key pressed twice keeps its first press', () => {
    const f = full(); f.key('Space', true, 0); f.key('Space', false, 750);
    f.key('KeyZ', true, 750); f.key('KeyZ', true, 790);
    const a = shot(f.tick(1100));
    expect(a.msg.zMs).toBe(0); expect(a.msg.xMs).toBeUndefined(); expect(a.msg.cMs).toBeUndefined();
  });
  it('a key pressed and released before the Space release (early bail) is omitted', () => {
    const f = full(); f.key('Space', true, 0); f.key('KeyC', true, 200); f.key('KeyC', false, 300); f.key('Space', false, 750);
    expect(shot(f.tick(1100)).msg.cMs).toBeUndefined();
  });
});

describe('SH-6 Esc', () => {
  it('Esc in the stance cancels', () => { const f = full(); expect(f.key('Escape', true, 10)?.type).toBe('cancel'); expect(f.key('Space', true, 20)).toBeNull(); expect(f.tick(5000)).toBeNull(); });
  it('Esc during the backswing (Space still held) cancels with no shot', () => {
    const f = full(); f.key('Space', true, 0);
    expect(f.key('Escape', true, 400)?.type).toBe('cancel');
    f.key('Space', false, 500); expect(f.tick(2000)).toBeNull();
  });
  it('Esc after the release is ignored and the shot still strikes', () => {
    const f = full(); f.key('Space', true, 0); f.key('Space', false, 750);
    expect(f.key('Escape', true, 800)).toBeNull();
    shot(f.tick(1050));
  });
});

describe('SH-6 putter: releasing Space strikes', () => {
  it('sends one putt with the held fraction as length and ignores Z, X, C', () => {
    const f = putter(); f.key('Space', true, 0);
    f.key('KeyZ', true, 100); f.key('KeyX', true, 150);
    const a = f.key('Space', false, 300);
    expect(a).toEqual({ type: 'send-putt', msg: { t: 'putt', aimDeg: 3, length: 300 / FULL_TURN_MS } });
    expect(f.tick(10000)).toBeNull(); expect(f.key('Space', true, 10001)).toBeNull();
  });
  it('a long hold strikes at length 1; Esc before the release cancels; Esc after is ignored', () => {
    const a = putter(); a.key('Space', true, 0);
    expect((a.key('Space', false, 9000) as Extract<Action, { type: 'send-putt' }>).msg.length).toBe(1);
    const b = putter(); b.key('Space', true, 0); expect(b.key('Escape', true, 200)?.type).toBe('cancel'); expect(b.key('Space', false, 300)).toBeNull();
    const c = putter(); c.key('Space', true, 0); c.key('Space', false, 300); expect(c.key('Escape', true, 310)).toBeNull();
  });
  it('a quick tap strikes at the minimum length', () => {
    const f = putter(); f.key('Space', true, 0);
    expect((f.key('Space', false, 5) as Extract<Action, { type: 'send-putt' }>).msg.length).toBe(0.05);
  });
});

describe('SH-6 stance rules', () => {
  it('releasing the FIRST Space press (still in the stance) does nothing; the swing starts on the next press', () => {
    const f = full();
    expect(f.key('Space', false, 5)).toBeNull();
    f.key('Space', true, 100); f.key('Space', false, 475);
    expect(shot(f.tick(475 + IMPACT_BASE)).msg.length).toBeCloseTo(0.5, 10);
  });
  it('Z, X, C pressed in the stance (before the second Space) are ignored', () => {
    const f = full(); f.key('KeyZ', true, 5); f.key('Space', true, 100); f.key('Space', false, 850);
    expect(shot(f.tick(1200)).msg.zMs).toBeUndefined();
  });
});
