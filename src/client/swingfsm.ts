// Pure swing state machine (docs/slices/space-hold-swing/spec.md): no DOM, no clock; callers pass event times in ms.
// Stance (aim locked) -> hold Space = backswing -> release Space = top (full swing) or strike (putter).
import { durationScale, lengthFromHold } from '../sim/length';

/** Base downswing time from the top to impact at full length; scaled by durationScale(length). */
const IMPACT_BASE_MS = 300;

export type ShotMsg = { t: 'shot'; clubKey: string; aimDeg: number; length: number; zMs?: number; xMs?: number; cMs?: number };
export type PuttMsg = { t: 'putt'; aimDeg: number; length: number };
export type Action = { type: 'send-shot'; msg: ShotMsg } | { type: 'send-putt'; msg: PuttMsg } | { type: 'cancel' };

type Phase = 'stance' | 'backswing' | 'downswing' | 'done' | 'cancelled';
const KEYS: Record<string, 'z' | 'x' | 'c' | undefined> = { KeyZ: 'z', KeyX: 'x', KeyC: 'c' };

export class SwingFSM {
  phase: Phase = 'stance';
  private t0 = 0; private top = 0; private length = 1; private impactAt = 0;
  private press: { z?: number; x?: number; c?: number } = {};

  constructor(private o: { putt: boolean; aimDeg: number; clubKey: string }) {}

  key(code: string, down: boolean, t: number): Action | null {
    if (this.phase === 'done' || this.phase === 'cancelled') return null;
    if (code === 'Escape') {
      if (!down || (this.phase !== 'stance' && this.phase !== 'backswing')) return null;
      this.phase = 'cancelled';
      return { type: 'cancel' };
    }
    if (code === 'Space') {
      if (down) { if (this.phase === 'stance') { this.phase = 'backswing'; this.t0 = t; } return null; } // repeats and later presses ignored
      if (this.phase !== 'backswing') return null;
      this.top = t; this.length = lengthFromHold(t - this.t0);
      if (this.o.putt) { this.phase = 'done'; return { type: 'send-putt', msg: { t: 'putt', aimDeg: this.o.aimDeg, length: this.length } }; }
      this.phase = 'downswing'; this.impactAt = this.top + IMPACT_BASE_MS * durationScale(this.length);
      return null;
    }
    const k = KEYS[code];
    if (!k || this.o.putt || (this.phase !== 'backswing' && this.phase !== 'downswing')) return null;
    if (down) { if (this.press[k] === undefined) this.press[k] = t; } // first press wins; presses before the release are early (negative)
    else delete this.press[k];                                          // let go before impact: bailed out, counts as never pressed
    return null;
  }

  tick(t: number): Action | null {
    if (this.phase !== 'downswing' || t < this.impactAt) return null;
    this.phase = 'done';
    const msg: ShotMsg = { t: 'shot', clubKey: this.o.clubKey, aimDeg: this.o.aimDeg, length: this.length };
    if (this.press.z !== undefined) msg.zMs = this.press.z - this.top;
    if (this.press.x !== undefined) msg.xMs = this.press.x - this.top;
    if (this.press.c !== undefined) msg.cMs = this.press.c - this.top;
    return { type: 'send-shot', msg };
  }

  /** Fraction shown on the HUD length meter. */
  meter(t: number): number {
    if (this.phase === 'stance') return 0;
    if (this.phase === 'backswing') return lengthFromHold(t - this.t0);
    return this.length;
  }
}
