// Untrusted wire input: every incoming ws message passes through here and leaves as a clean, bounded ClientMsg or null.
import type { CartState, ClientMsg } from '../shared/protocol';
import { isValidBallPos } from '../sim';
import { isCourseId } from '../shared/courses';

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown, min: number, max: number): v is string => typeof v === 'string' && v.length >= min && v.length <= max;
/** Aim in degrees: finite and sane, normalised to [0, 360) so trig can never overflow into NaN. */
const aim = (v: unknown): number | null => (num(v) && Math.abs(v) <= 1e6 ? ((v % 360) + 360) % 360 : null);
/** How long Space was held, in ms. */
const hold = (v: unknown): v is number => num(v) && v >= 0 && v <= 5000;
/** A coordinate (m) or a velocity (m/s) within `max`; a heading in radians, normalised to [0, 2π). */
const within = (v: unknown, max: number): v is number => num(v) && Math.abs(v) <= max;
const rad = (v: unknown): number | null => (within(v, 1e6) ? ((v % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) : null);
function cartState(v: unknown): CartState | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const c = v as Record<string, unknown>, yaw = rad(c.yaw);
  if (!within(c.x, 5000) || !within(c.z, 5000) || yaw === null || !within(c.vx, 100) || !within(c.vz, 100)) return null;
  return { x: c.x, z: c.z, yaw, vx: c.vx, vz: c.vz };
}

export function parseClientMsg(raw: string): ClientMsg | null {
  let m: Record<string, unknown>;
  try { const j = JSON.parse(raw); if (!j || typeof j !== 'object' || Array.isArray(j)) return null; m = j as Record<string, unknown>; } catch { return null; }
  switch (m.t) {
    case 'hello':
      if (!str(m.sessionId, 1, 64) || !str(m.name, 0, 64) || (m.token !== undefined && typeof m.token !== 'string')) return null;
      return { t: 'hello', sessionId: m.sessionId, name: m.name, ...(m.token !== undefined && { token: m.token as string }) };
    case 'createLobby':
      if (m.course === undefined) return { t: 'createLobby' };
      return isCourseId(m.course) ? { t: 'createLobby', course: m.course } : null;
    case 'setCourse': return isCourseId(m.course) ? { t: 'setCourse', course: m.course } : null;
    case 'leaveLobby': case 'start': case 'startSolo': return { t: m.t };
    case 'joinLobby': return str(m.lobbyId, 1, 64) ? { t: 'joinLobby', lobbyId: m.lobbyId } : null;
    case 'ready': return typeof m.ready === 'boolean' ? { t: 'ready', ready: m.ready } : null;
    case 'shot': {
      const a = aim(m.aimDeg), fb = m.fb === undefined ? 0 : m.fb, io = m.io === undefined ? 0 : m.io;   // null is not 'missing': it is rejected
      if (!str(m.clubKey, 1, 4) || a === null || !hold(m.holdMs) || !isValidBallPos({ fb, io })) return null;
      if (m.chip !== undefined && typeof m.chip !== 'boolean') return null;
      return { t: 'shot', clubKey: m.clubKey, aimDeg: a, holdMs: m.holdMs, fb: fb as number, io: io as number, ...(m.chip === true && { chip: true }) };
    }
    case 'putt': {
      const a = aim(m.aimDeg);
      return a !== null && hold(m.holdMs) ? { t: 'putt', aimDeg: a, holdMs: m.holdMs } : null;
    }
    case 'move': {
      const yaw = rad(m.yaw), cart = cartState(m.cart);
      if (!within(m.x, 5000) || !within(m.z, 5000) || yaw === null || typeof m.driving !== 'boolean' || !cart) return null;
      return { t: 'move', x: m.x, z: m.z, yaw, driving: m.driving, cart };
    }
    default: return null;
  }
}
