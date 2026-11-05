import { describe, it, expect } from 'vitest';
import { parseClientMsg } from '../src/server/parse';

const p = (o: unknown) => parseClientMsg(JSON.stringify(o));

describe('parseClientMsg: untrusted wire input', () => {
  it('rejects non-JSON, non-objects, missing or non-string t, and unknown types', () => {
    for (const raw of ['', 'nope', '[]', '42', 'null', '{"t":5}', '{}', '{"t":"nuke"}']) expect(parseClientMsg(raw), raw).toBeNull();
  });
  it('accepts the plain lobby messages and returns only the known fields', () => {
    expect(p({ t: 'createLobby', evil: 1 })).toEqual({ t: 'createLobby' });
    expect(p({ t: 'joinLobby', lobbyId: 'L1', x: 1 })).toEqual({ t: 'joinLobby', lobbyId: 'L1' });
    expect(p({ t: 'ready', ready: true })).toEqual({ t: 'ready', ready: true });
    expect(p({ t: 'ready', ready: 'yes' })).toBeNull();
    expect(p({ t: 'joinLobby', lobbyId: 'x'.repeat(65) })).toBeNull();
  });
  it('does not pass __proto__ or constructor keys through', () => {
    const m = parseClientMsg('{"t":"createLobby","__proto__":{"admin":true},"constructor":{"x":1}}') as Record<string, unknown>;
    expect(m).toEqual({ t: 'createLobby' });
    expect(({} as Record<string, unknown>).admin).toBeUndefined();
  });
  it('hello needs a 1..64 char sessionId and a name of at most 64 chars; token must be a string', () => {
    expect(p({ t: 'hello', sessionId: 's', name: 'Bob' })).toEqual({ t: 'hello', sessionId: 's', name: 'Bob' });
    expect(p({ t: 'hello', sessionId: '', name: 'Bob' })).toBeNull();
    expect(p({ t: 'hello', sessionId: 's', name: 'x'.repeat(65) })).toBeNull();
    expect(p({ t: 'hello', sessionId: 's', name: 'Bob', token: 5 })).toBeNull();
  });
  it('shot: aim must be finite and is normalised to 0..360, so overflow cannot become NaN downstream', () => {
    expect((p({ t: 'shot', clubKey: '1', aimDeg: 370 }) as { aimDeg: number }).aimDeg).toBeCloseTo(10, 10);
    expect((p({ t: 'shot', clubKey: '1', aimDeg: -90 }) as { aimDeg: number }).aimDeg).toBeCloseTo(270, 10);
    for (const bad of [1e308, -1e308, 1e12, null, 'x']) expect(p({ t: 'shot', clubKey: '1', aimDeg: bad }), String(bad)).toBeNull();
    expect(parseClientMsg('{"t":"shot","clubKey":"1","aimDeg":1e999}')).toBeNull(); // parses to Infinity
  });
  it('shot: key timings must be finite and within +-10 s; length must be finite', () => {
    const ok = p({ t: 'shot', clubKey: '1', aimDeg: 0, zMs: -9999, xMs: 9999, cMs: 0, length: 0.5 });
    expect(ok).toEqual({ t: 'shot', clubKey: '1', aimDeg: 0, zMs: -9999, xMs: 9999, cMs: 0, length: 0.5 });
    for (const k of ['zMs', 'xMs', 'cMs']) for (const bad of [10001, -10001, 1e9, null, '5']) expect(p({ t: 'shot', clubKey: '1', aimDeg: 0, [k]: bad }), `${k}=${bad}`).toBeNull();
    for (const bad of [null, '0.5', 1e999]) expect(p({ t: 'shot', clubKey: '1', aimDeg: 0, length: bad })).toBeNull();
  });
  it('shot: club key must be a short string', () => {
    expect(p({ t: 'shot', clubKey: 7, aimDeg: 0 })).toBeNull();
    expect(p({ t: 'shot', clubKey: 'x'.repeat(5), aimDeg: 0 })).toBeNull();
  });
  it('putt: aim normalised, length required and finite', () => {
    expect(p({ t: 'putt', aimDeg: 180, length: 0.3 })).toEqual({ t: 'putt', aimDeg: 180, length: 0.3 });
    expect(p({ t: 'putt', aimDeg: 180 })).toBeNull();
    expect(p({ t: 'putt', aimDeg: 1e308, length: 0.3 })).toBeNull();
    expect(p({ t: 'putt', aimDeg: 0, length: null })).toBeNull();
  });
});
