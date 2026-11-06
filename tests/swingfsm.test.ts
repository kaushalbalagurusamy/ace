import { describe, it, expect } from 'vitest';
import { SwingFSM, type Action } from '../src/client/swingfsm';

type Shot = Extract<Action, { type: 'send-shot' }>;
const raw = (putt = false) => new SwingFSM({ putt, aimDeg: putt ? 3 : 12.5, clubKey: putt ? 'P' : '7' });
/** The first Space press (and its release) is the stance; tests then press Space again to start the backswing. */
const armed = (f: SwingFSM) => { f.key('Space', true, -2000); f.key('Space', false, -1950); return f; };
const full = () => armed(raw());
const putter = () => armed(raw(true));
const shot = (a: Action | null | undefined): Shot => { expect(a?.type).toBe('send-shot'); return a as Shot; };

describe('SS-8 hold and release: the only swing input', () => {
  it('first Space = stance, second Space held = backswing, release sends one shot with the hold time and the ball position', () => {
    const f = raw();
    expect(f.phase).toBe('idle'); f.key('Space', true, 0); expect(f.phase).toBe('stance'); f.key('Space', false, 60); expect(f.phase).toBe('stance');
    f.key('Space', true, 200); expect(f.phase).toBe('backswing');
    const a = shot(f.key('Space', false, 575));
    expect(a.msg).toEqual({ t: 'shot', clubKey: '7', aimDeg: 12.5, holdMs: 375, fb: 0, io: 0 });
    expect(f.phase).toBe('done'); expect(f.tick(9999)).toBeNull(); expect(f.key('Space', true, 10000)).toBeNull();
  });
  it('a normal hold between 0.75 s and 1.10 s is sent as held (the server turns it into a normal 100% shot)', () => {
    const f = full(); f.key('Space', true, 0); expect(shot(f.key('Space', false, 900)).msg.holdMs).toBe(900);
  });
  it('key auto-repeat of Space during the backswing does not restart it', () => { const f = full(); f.key('Space', true, 1000); f.key('Space', true, 1100); f.key('Space', true, 1200); expect(shot(f.key('Space', false, 1375)).msg.holdMs).toBe(375); });
  it('meter(t) shows the hold as a fraction of the full turn, passing 1 into the max-effort zone, and is 0 in the stance', () => {
    const f = full(); expect(f.meter(500)).toBe(0); f.key('Space', true, 1000);
    expect(f.meter(1000)).toBe(0); expect(f.meter(1000 + 375)).toBeCloseTo(0.5, 10); expect(f.meter(1000 + 750)).toBeCloseTo(1, 10); expect(f.meter(1000 + 1100)).toBeCloseTo(1100 / 750, 10);
  });
});

describe('SS-8 max effort: auto-release at 1.10 s', () => {
  it('tick fires the shot exactly when the hold reaches 1100 ms, once, with holdMs 1100; the later key-up does nothing', () => {
    const f = full(); f.key('Space', true, 5000);
    expect(f.tick(5000 + 1099)).toBeNull();
    const a = shot(f.tick(5000 + 1100)); expect(a.msg.holdMs).toBe(1100);
    expect(f.tick(5000 + 1500)).toBeNull(); expect(f.key('Space', false, 5000 + 2000)).toBeNull();
  });
  it('a release just before the limit is a normal shot, not a max-effort one', () => { const f = full(); f.key('Space', true, 0); expect(f.tick(1099)).toBeNull(); expect(shot(f.key('Space', false, 1099)).msg.holdMs).toBe(1099); });
  it('if the key-up arrives after the deadline but before a tick, the hold is capped at 1100 (max effort)', () => { const f = full(); f.key('Space', true, 0); expect(shot(f.key('Space', false, 1400)).msg.holdMs).toBe(1100); });
});

describe('SS-8 ball position in the stance (W/S forward-back, A/D closer-away), 5 steps per axis, only in the stance', () => {
  it('Up and Down step the ball forward and back (fb), Right and Left step it away from and closer to the body (io)', () => {
    const f = armed(raw()); expect(f.ballPos()).toEqual({ fb: 0, io: 0 });
    f.key('ArrowUp', true, 0); f.key('ArrowUp', true, 1); expect(f.ballPos()).toEqual({ fb: 2, io: 0 });
    f.key('ArrowDown', true, 2); f.key('ArrowDown', true, 3); f.key('ArrowDown', true, 4); expect(f.ballPos()).toEqual({ fb: -1, io: 0 });
    f.key('ArrowRight', true, 5); f.key('ArrowRight', true, 6); expect(f.ballPos()).toEqual({ fb: -1, io: 2 });
    f.key('ArrowLeft', true, 7); expect(f.ballPos()).toEqual({ fb: -1, io: 1 });
  });
  it('steps clamp at -3 and +3 (7x7 grid)', () => {
    const f = armed(raw()); for (let i = 0; i < 6; i++) { f.key('ArrowUp', true, i); f.key('ArrowRight', true, i); } expect(f.ballPos()).toEqual({ fb: 3, io: 3 });
    for (let i = 0; i < 9; i++) { f.key('ArrowDown', true, i); f.key('ArrowLeft', true, i); } expect(f.ballPos()).toEqual({ fb: -3, io: -3 });
  });
  it('key releases do nothing; only presses step', () => { const f = armed(raw()); f.key('ArrowUp', true, 0); f.key('ArrowUp', false, 10); expect(f.ballPos().fb).toBe(1); });
  it('the position is sent with the shot', () => { const f = armed(raw()); f.key('ArrowUp', true, 0); f.key('ArrowRight', true, 1); f.key('ArrowRight', true, 2); f.key('Space', true, 10); expect(shot(f.key('Space', false, 400)).msg).toMatchObject({ fb: 1, io: 2 }); });
  it('ball keys are ignored once the backswing has started, and before the stance (idle)', () => {
    const f = raw(); f.key('ArrowUp', true, 0); expect(f.ballPos()).toEqual({ fb: 0, io: 0 });          // idle
    const g = full(); g.key('ArrowRight', true, 0); g.key('Space', true, 5); g.key('ArrowUp', true, 10); g.key('ArrowLeft', true, 11); g.key('ArrowDown', true, 12);
    expect(shot(g.key('Space', false, 300)).msg).toMatchObject({ fb: 0, io: 1 });
  });
  it('a fresh machine (a new shot) starts at the centre', () => { const a = armed(raw()); a.key('ArrowUp', true, 0); expect(armed(raw()).ballPos()).toEqual({ fb: 0, io: 0 }); });
  it('arrow keys and Z/X/C do nothing to the swing', () => { const f = full(); for (const k of ['KeyW', 'KeyA', 'KeyZ', 'KeyX', 'KeyC']) expect(f.key(k, true, 0)).toBeNull(); expect(f.ballPos()).toEqual({ fb: 0, io: 0 }); f.key('Space', true, 5); expect(shot(f.key('Space', false, 250)).msg).toEqual({ t: 'shot', clubKey: '7', aimDeg: 12.5, holdMs: 245, fb: 0, io: 0 }); });
});

describe('SS-8 putter: same hold and release, no max effort, no ball position', () => {
  it('release sends one putt with the hold time, capped at the full turn; holding longer never auto-releases', () => {
    const a = putter(); a.key('Space', true, 0); expect(a.key('Space', false, 300)).toEqual({ type: 'send-putt', msg: { t: 'putt', aimDeg: 3, holdMs: 300 } });
    const b = putter(); b.key('Space', true, 0); expect(b.tick(5000)).toBeNull(); expect(b.key('Space', false, 9000)).toEqual({ type: 'send-putt', msg: { t: 'putt', aimDeg: 3, holdMs: 750 } });
  });
  it('ball-position keys are ignored for the putter', () => { const f = putter(); f.key('ArrowUp', true, 0); f.key('ArrowRight', true, 1); expect(f.ballPos()).toEqual({ fb: 0, io: 0 }); });
  it('a quick tap strikes (the server floors the length)', () => { const f = putter(); f.key('Space', true, 0); expect(f.key('Space', false, 5)).toEqual({ type: 'send-putt', msg: { t: 'putt', aimDeg: 3, holdMs: 5 } }); });
});

describe('SS-8 Esc and abort', () => {
  it('Esc in the idle, stance or backswing cancels; after a release it is ignored', () => {
    expect(raw().key('Escape', true, 0)?.type).toBe('cancel'); expect(full().key('Escape', true, 10)?.type).toBe('cancel');
    const b = full(); b.key('Space', true, 0); expect(b.key('Escape', true, 200)?.type).toBe('cancel'); expect(b.key('Space', false, 300)).toBeNull(); expect(b.tick(9999)).toBeNull();
    const c = full(); c.key('Space', true, 0); shot(c.key('Space', false, 300)); expect(c.key('Escape', true, 310)).toBeNull();
  });
  it('abort() cancels a stance or backswing (lost keyup, blur, lost pointer lock) so a late keyup cannot fire a shot', () => {
    const a = full(); expect(a.abort()?.type).toBe('cancel'); expect(a.key('Space', false, 5)).toBeNull();
    const b = full(); b.key('Space', true, 0); expect(b.abort()?.type).toBe('cancel'); expect(b.key('Space', false, 9999)).toBeNull(); expect(b.tick(99999)).toBeNull();
    const c = full(); c.key('Space', true, 0); shot(c.key('Space', false, 300)); expect(c.abort()).toBeNull();
  });
  it('releasing the first press does not start the swing; the machine ignores Space release in idle', () => { const f = raw(); expect(f.key('Space', false, 5)).toBeNull(); f.key('Space', true, 10); f.key('Space', false, 80); expect(f.phase).toBe('stance'); });
});

describe('mouse aim and club change in the stance (owner: both stay live until the backswing starts)', () => {
  it('re-aiming in the stance changes the aim that is sent; after the backswing starts it is locked', () => {
    const f = armed(raw()); expect(f.setAim(40)).toBe(true); expect(f.aim()).toBe(40); f.setAim(41);
    f.key('Space', true, 0); expect(f.setAim(99)).toBe(false); expect(f.aim()).toBe(41);
    expect(shot(f.key('Space', false, 300)).msg.aimDeg).toBe(41);
  });
  it('aim and ball position are kept across re-aims and club changes', () => {
    const f = armed(raw()); f.key('ArrowUp', true, 0); f.key('ArrowRight', true, 1); f.setAim(77); f.setClub('9', false); f.setAim(78); f.key('Space', true, 5);
    expect(shot(f.key('Space', false, 400)).msg).toEqual({ t: 'shot', clubKey: '9', aimDeg: 78, holdMs: 395, fb: 1, io: 1 });
  });
  it('a club change in the stance updates the club used; after the backswing starts it is ignored', () => {
    const f = armed(raw()); expect(f.setClub('1', false)).toBe(true); expect(f.club()).toEqual({ clubKey: '1', putt: false });
    f.key('Space', true, 0); expect(f.setClub('3', false)).toBe(false); expect(shot(f.key('Space', false, 200)).msg.clubKey).toBe('1');
  });
  it('switching to the putter in the stance swaps to putt mode in place (no new stance), and back again restores ball-position keys', () => {
    const f = armed(raw()); f.key('ArrowUp', true, 0); expect(f.setClub('P', true)).toBe(true); expect(f.phase).toBe('stance');
    f.key('ArrowRight', true, 1); expect(f.ballPos()).toEqual({ fb: 1, io: 0 });                    // ball keys are ignored for the putter; earlier position kept
    expect(f.setClub('7', false)).toBe(true); f.key('ArrowRight', true, 2); expect(f.ballPos()).toEqual({ fb: 1, io: 1 });
    const g = armed(raw()); g.setClub('P', true); g.key('Space', true, 0); expect(g.key('Space', false, 300)).toEqual({ type: 'send-putt', msg: { t: 'putt', aimDeg: 12.5, holdMs: 300 } });
  });
  it('putter to a full swing club: the shot uses full-swing mode and may auto-release at 1.10 s', () => {
    const f = armed(raw(true)); f.setClub('5', false); f.key('Space', true, 0); expect(shot(f.tick(1100)).msg).toMatchObject({ clubKey: '5', holdMs: 1100 });
  });
  it('re-aiming and club changes work before the first Space press too (idle), and not after cancel or release', () => {
    const f = raw(); expect(f.setAim(5)).toBe(true); expect(f.setClub('4', false)).toBe(true);
    const g = armed(raw()); g.key('Space', true, 0); shot(g.key('Space', false, 200)); expect(g.setAim(1)).toBe(false); expect(g.setClub('2', false)).toBe(false);
    const h = armed(raw()); h.key('Escape', true, 0); expect(h.setAim(1)).toBe(false);
  });
});

describe('chip stroke (owner 2026-11-05): Shift in the stance toggles a 0-25% shoulder stroke', () => {
  const stanceAt = (putt = false) => { const f = new SwingFSM({ putt, aimDeg: 0, clubKey: putt ? 'P' : 'O' }); f.key('Space', true, 0); return f; };
  it('a Shift press in the stance toggles chip, a second press toggles it back; the putter ignores it', () => {
    const f = stanceAt(); expect(f.isChip()).toBe(false); f.key('ShiftLeft', true, 1); expect(f.isChip()).toBe(true); f.key('ShiftRight', true, 2); expect(f.isChip()).toBe(false);
    const p = stanceAt(true); p.key('ShiftLeft', true, 1); expect(p.isChip()).toBe(false);
  });
  it('the chip shot carries chip: true and never auto-releases into max effort', () => {
    const f = stanceAt(); f.key('ShiftLeft', true, 1); f.key('Space', true, 10);
    expect(f.tick(10 + 2000)).toBeNull();
    const a = f.key('Space', false, 10 + 2000); expect(a && a.type === 'send-shot' && a.msg.chip).toBe(true);
    expect(a && a.type === 'send-shot' && a.msg.holdMs).toBe(750);
  });
});
