// Untrusted wire input: every incoming ws message passes through here and leaves as a clean, bounded ClientMsg or null.
import type { ClientMsg } from '../shared/protocol';

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown, min: number, max: number): v is string => typeof v === 'string' && v.length >= min && v.length <= max;
/** Aim in degrees: finite and sane, normalised to [0, 360) so trig can never overflow into NaN. */
const aim = (v: unknown): number | null => (num(v) && Math.abs(v) <= 1e6 ? ((v % 360) + 360) % 360 : null);
/** A key timing relative to the release, in ms: within +-10 s of it. */
const ms = (v: unknown): v is number => num(v) && Math.abs(v) <= 10_000;

export function parseClientMsg(raw: string): ClientMsg | null {
  let m: Record<string, unknown>;
  try { const j = JSON.parse(raw); if (!j || typeof j !== 'object' || Array.isArray(j)) return null; m = j as Record<string, unknown>; } catch { return null; }
  switch (m.t) {
    case 'hello':
      if (!str(m.sessionId, 1, 64) || !str(m.name, 0, 64) || (m.token !== undefined && typeof m.token !== 'string')) return null;
      return { t: 'hello', sessionId: m.sessionId, name: m.name, ...(m.token !== undefined && { token: m.token as string }) };
    case 'createLobby': case 'leaveLobby': case 'start': case 'startSolo': return { t: m.t };
    case 'joinLobby': return str(m.lobbyId, 1, 64) ? { t: 'joinLobby', lobbyId: m.lobbyId } : null;
    case 'ready': return typeof m.ready === 'boolean' ? { t: 'ready', ready: m.ready } : null;
    case 'shot': {
      const a = aim(m.aimDeg);
      if (!str(m.clubKey, 1, 4) || a === null) return null;
      for (const k of ['zMs', 'xMs', 'cMs'] as const) if (m[k] !== undefined && !ms(m[k])) return null;
      if (m.length !== undefined && !num(m.length)) return null;
      return { t: 'shot', clubKey: m.clubKey, aimDeg: a,
        ...(m.length !== undefined && { length: m.length as number }),
        ...(m.zMs !== undefined && { zMs: m.zMs as number }), ...(m.xMs !== undefined && { xMs: m.xMs as number }), ...(m.cMs !== undefined && { cMs: m.cMs as number }) };
    }
    case 'putt': {
      const a = aim(m.aimDeg);
      return a !== null && num(m.length) ? { t: 'putt', aimDeg: a, length: m.length } : null;
    }
    default: return null;
  }
}
