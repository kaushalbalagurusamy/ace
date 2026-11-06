// Pure swing state machine for the one-button swing (docs/slices/simple-swing/spec.md): no DOM, no clock; callers pass event times in ms.
// First Space press = stance (movement off; mouse aim, club and ball position stay adjustable) -> second Space press held = backswing (all locked)
// -> release = the shot (hold time and ball position go to the server) or, past 1.10 s, an automatic max-effort release.
import { FULL_TURN_MS, MAX_EFFORT_HOLD_MS } from '../sim/length';

export type ShotMsg = { t: 'shot'; clubKey: string; aimDeg: number; holdMs: number; fb: number; io: number };
export type PuttMsg = { t: 'putt'; aimDeg: number; holdMs: number };
export type Action = { type: 'send-shot'; msg: ShotMsg } | { type: 'send-putt'; msg: PuttMsg } | { type: 'cancel' };

type Phase = 'idle' | 'stance' | 'backswing' | 'done' | 'cancelled';
/** W/S: ball forward/back; D/A: ball away from / closer to the body. Each press is one step, clamped to -2..2. */
const BALL_KEYS: Record<string, ['fb' | 'io', 1 | -1] | undefined> = { KeyW: ['fb', 1], KeyS: ['fb', -1], KeyD: ['io', 1], KeyA: ['io', -1] };
const clamp2 = (n: number) => Math.min(2, Math.max(-2, n));

export class SwingFSM {
  phase: Phase = 'idle';
  private t0 = 0; private fb = 0; private io = 0; private lastMeter = 0;
  private o: { putt: boolean; aimDeg: number; clubKey: string };

  constructor(o: { putt: boolean; aimDeg: number; clubKey: string }) { this.o = { ...o }; }

  ballPos() { return { fb: this.fb, io: this.io }; }
  aim() { return this.o.aimDeg; }
  club() { return { clubKey: this.o.clubKey, putt: this.o.putt }; }
  private adjustable() { return this.phase === 'idle' || this.phase === 'stance'; }
  /** Mouse re-aim: allowed until the backswing starts, then the aim is locked until the shot resolves. */
  setAim(aimDeg: number): boolean { if (!this.adjustable()) return false; this.o.aimDeg = aimDeg; return true; }
  /** Club change: allowed until the backswing starts. Swapping to or from the putter switches mode in place; aim and ball position are kept. */
  setClub(clubKey: string, putt: boolean): boolean { if (!this.adjustable()) return false; this.o.clubKey = clubKey; this.o.putt = putt; return true; }

  key(code: string, down: boolean, t: number): Action | null {
    if (this.phase === 'done' || this.phase === 'cancelled') return null;
    if (code === 'Escape') return down ? this.abort() : null;
    if (code === 'Space') {
      if (down) { // first press = stance, second = backswing; later presses are ignored
        if (this.phase === 'idle') this.phase = 'stance';
        else if (this.phase === 'stance') { this.phase = 'backswing'; this.t0 = t; }
        return null;
      }
      if (this.phase !== 'backswing') return null;
      return this.release(Math.max(0, t - this.t0));
    }
    const step = BALL_KEYS[code];
    if (step && down && this.phase === 'stance' && !this.o.putt) { if (step[0] === 'fb') this.fb = clamp2(this.fb + step[1]); else this.io = clamp2(this.io + step[1]); }
    return null;
  }

  private release(holdMs: number): Action {
    this.phase = 'done';
    if (this.o.putt) { this.lastMeter = Math.min(holdMs, FULL_TURN_MS) / FULL_TURN_MS; return { type: 'send-putt', msg: { t: 'putt', aimDeg: this.o.aimDeg, holdMs: Math.min(holdMs, FULL_TURN_MS) } }; }
    const h = Math.min(holdMs, MAX_EFFORT_HOLD_MS); this.lastMeter = h / FULL_TURN_MS;
    return { type: 'send-shot', msg: { t: 'shot', clubKey: this.o.clubKey, aimDeg: this.o.aimDeg, holdMs: h, fb: this.fb, io: this.io } };
  }

  /** Auto-release at 1.10 s for full swings (max effort); the putter never auto-releases. */
  tick(t: number): Action | null { return this.phase === 'backswing' && !this.o.putt && t - this.t0 >= MAX_EFFORT_HOLD_MS ? this.release(t - this.t0) : null; }

  /** Cancels a stance or backswing (blur, lost key-up, lost pointer lock, Esc). After the release the shot goes ahead, so it does nothing. */
  abort(): Action | null { if (!this.adjustable() && this.phase !== 'backswing') return null; this.phase = 'cancelled'; return { type: 'cancel' }; }

  /** HUD meter: the hold as a fraction of the full turn; above 1 is the max-effort zone (up to 1100/750). */
  meter(t: number): number { return this.phase === 'backswing' ? Math.max(0, t - this.t0) / FULL_TURN_MS : this.phase === 'done' ? this.lastMeter : 0; }
}
