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
    expect((p({ t: 'shot', clubKey: '1', aimDeg: 370, holdMs: 500 }) as { aimDeg: number }).aimDeg).toBeCloseTo(10, 10);
    expect((p({ t: 'shot', clubKey: '1', aimDeg: -90, holdMs: 500 }) as { aimDeg: number }).aimDeg).toBeCloseTo(270, 10);
    for (const bad of [1e308, -1e308, 1e12, null, 'x']) expect(p({ t: 'shot', clubKey: '1', aimDeg: bad, holdMs: 500 }), String(bad)).toBeNull();
    expect(parseClientMsg('{"t":"shot","clubKey":"1","aimDeg":1e999,"holdMs":500}')).toBeNull(); // parses to Infinity
  });
  it('shot: holdMs finite and 0..5000; ball position integers -2..2; the exact fields pass through', () => {
    expect(p({ t: 'shot', clubKey: '1', aimDeg: 0, holdMs: 375, fb: 1, io: -2 })).toEqual({ t: 'shot', clubKey: '1', aimDeg: 0, holdMs: 375, fb: 1, io: -2 });
    expect(p({ t: 'shot', clubKey: '1', aimDeg: 0, holdMs: 750 })).toEqual({ t: 'shot', clubKey: '1', aimDeg: 0, holdMs: 750, fb: 0, io: 0 });   // missing ball position = centre
    for (const bad of [-1, 5001, 1e9, null, '5', NaN]) expect(p({ t: 'shot', clubKey: '1', aimDeg: 0, holdMs: bad }), `holdMs ${bad}`).toBeNull();
    for (const [fb, io] of [[3, 0], [0, -3], [0.5, 0], [0, 1.5], ['1', 0], [null, 0]]) expect(p({ t: 'shot', clubKey: '1', aimDeg: 0, holdMs: 500, fb, io }), `${fb},${io}`).toBeNull();
    expect(p({ t: 'shot', clubKey: '1', aimDeg: 0 })).toBeNull();                                              // the hold time is required
    expect(parseClientMsg('{"t":"shot","clubKey":"1","aimDeg":0,"holdMs":1e999}')).toBeNull();
  });
  it('Z/X/C timing fields and the old length field are gone: they are ignored, never passed through', () => {
    expect(p({ t: 'shot', clubKey: '1', aimDeg: 0, holdMs: 500, zMs: 5, xMs: 60, cMs: 150, length: 0.5 })).toEqual({ t: 'shot', clubKey: '1', aimDeg: 0, holdMs: 500, fb: 0, io: 0 });
  });
  it('shot: club key must be a short string', () => {
    expect(p({ t: 'shot', clubKey: 7, aimDeg: 0, holdMs: 500 })).toBeNull();
    expect(p({ t: 'shot', clubKey: 'x'.repeat(5), aimDeg: 0, holdMs: 500 })).toBeNull();
  });
  it('putt: aim normalised, holdMs required, finite and 0..5000', () => {
    expect(p({ t: 'putt', aimDeg: 180, holdMs: 300 })).toEqual({ t: 'putt', aimDeg: 180, holdMs: 300 });
    expect(p({ t: 'putt', aimDeg: 180 })).toBeNull(); expect(p({ t: 'putt', aimDeg: 1e308, holdMs: 300 })).toBeNull();
    for (const bad of [null, -1, 5001, '3', NaN]) expect(p({ t: 'putt', aimDeg: 0, holdMs: bad })).toBeNull();
  });
});
