import { describe, it, expect } from 'vitest';
import { COURSES, COURSE_IDS, DEFAULT_COURSE, gridKey, gridOf, isCourseId } from '../src/shared/courses';
import { COURSE_HEIGHTS, heightAt } from '../src/shared/height';
import { hole, holesOf } from '../src/server/course';
import { LobbyManager } from '../src/server';
import { parseClientMsg } from '../src/server/parse';

const p = (o: unknown) => parseClientMsg(JSON.stringify(o));
const err = (r: { ok: boolean }) => (r as { ok: false; error: string }).error;

describe('course registry', () => {
  it('Pebble Beach is the default; ids validate strictly', () => {
    expect(DEFAULT_COURSE).toBe('pebble');
    for (const id of COURSE_IDS) expect(isCourseId(id)).toBe(true);
    for (const bad of ['', 'Pebble', 'augusta', 'pebble ', 1, null, undefined, {}, '__proto__', 'toString']) expect(isCourseId(bad), String(bad)).toBe(false);
  });
  it('every course has 18 holes with sane pars (par 70-72) and yardages, one grid per hole, and a registered height field', () => {
    for (const id of COURSE_IDS) {
      const c = COURSES[id];
      expect(c.id).toBe(id);
      expect(c.card).toHaveLength(18); expect(c.grids).toHaveLength(18);
      const par = c.card.reduce((s, h) => s + h.par, 0), yards = c.card.reduce((s, h) => s + h.yards, 0);
      expect(par, id).toBeGreaterThanOrEqual(70); expect(par, id).toBeLessThanOrEqual(72);
      expect(yards, id).toBeGreaterThan(6500); expect(yards, id).toBeLessThan(7800);
      for (const [i, h] of c.card.entries()) {
        expect([3, 4, 5], `${id} ${i + 1}`).toContain(h.par);
        const [lo, hi] = h.par === 3 ? [95, 260] : h.par === 4 ? [300, 560] : [440, 640];
        expect(h.yards, `${id} hole ${i + 1}`).toBeGreaterThanOrEqual(lo); expect(h.yards, `${id} hole ${i + 1}`).toBeLessThanOrEqual(hi);
      }
      expect(COURSE_HEIGHTS[id], id).toHaveLength(18);
      for (let i = 0; i < 18; i++) expect(Math.abs(heightAt(id, i, 0, 0))).toBeLessThan(0.02);   // heights are relative to a level tee
      if (id !== 'pebble') for (const g of c.grids) { expect(g.geo, id).toBeDefined(); expect(g.margin).toBe(0); expect(g.pinZ).toBeGreaterThan(100); }
    }
  });
  it('grid keys are unique per course and hole, and Pebble keeps keys 0..17', () => {
    const keys = new Set(COURSE_IDS.flatMap(id => Array.from({ length: 18 }, (_, i) => gridKey(id, i))));
    expect(keys.size).toBe(18 * COURSE_IDS.length);
    for (let i = 0; i < 18; i++) { expect(gridKey('pebble', i)).toBe(i); expect(gridOf(i)).toBe(COURSES.pebble.grids[i]); }
    for (const id of COURSE_IDS) for (let i = 0; i < 18; i++) expect(gridOf(gridKey(id, i))).toBe(COURSES[id].grids[i]);
  });
  it('every hole of every course: course on the info, playable fairway tee, pin on the green, card par and length', () => {
    for (const id of COURSE_IDS) holesOf(id).forEach((h, i) => {
      const where = `${id} hole ${i + 1}`;
      expect(h.info.course).toBe(id); expect(h.info.index).toBe(i); expect(h.info.par).toBe(COURSES[id].card[i]!.par);
      expect(h.info.lengthM).toBeCloseTo(COURSES[id].card[i]!.yards * 0.9144, 6);
      expect(h.surfaceAt(0, 0), where).toBe('fairway'); expect(h.penaltyAt(0, 0), where).toBeNull();
      expect(h.surfaceAt(h.info.pin.x, h.info.pin.z), where).toBe('green'); expect(h.penaltyAt(h.info.pin.x, h.info.pin.z), where).toBeNull();
      // a dogleg's straight-line pin may be nearer than the card's play line, never much nearer or farther
      expect(h.info.pin.z / h.info.lengthM, where).toBeGreaterThan(0.8); expect(h.info.pin.z / h.info.lengthM, where).toBeLessThanOrEqual(1.0001);
      expect(h.info.greenRadius, where).toBeGreaterThan(5); expect(h.info.greenRadius, where).toBeLessThan(30);
    });
  });
  it('hole() rejects an unknown course', () => {
    expect(() => hole(0, 'augusta' as never)).toThrow(RangeError);
  });
});

describe('lobby course choice', () => {
  const setup = () => { const m = new LobbyManager(); m.connect('h', 'Host'); m.connect('g', 'Guest'); return m; };
  it('a new lobby plays Pebble Beach unless the host picks another course; the view shows it', () => {
    const m = setup();
    const l = m.createLobby('h'); expect(l.ok && l.value.course).toBe('pebble');
    for (const id of COURSE_IDS) { const r = m.setCourse('h', id); expect(r.ok && r.value.course).toBe(id); expect(m.lobbyOf('h')!.course).toBe(id); expect(m.list()[0]!.course).toBe(id); }
    const m2 = setup(), last = COURSE_IDS[COURSE_IDS.length - 1]!;
    const l2 = m2.createLobby('h', last); expect(l2.ok && l2.value.course).toBe(last);
  });
  it('only the host, only while open, only a known course', () => {
    const m = setup(); m.createLobby('h'); m.joinLobby('g', m.list()[0]!.id);
    expect(err(m.setCourse('g', 'pebble'))).toBe('NOT_HOST');
    expect(err(m.setCourse('h', 'augusta' as never))).toBe('COURSE_INVALID');
    expect(err(m.createLobby('x', 'pebble'))).toBe('NOT_CONNECTED');
    m.connect('z', 'Zed'); expect(err(m.createLobby('z', 'nope' as never))).toBe('COURSE_INVALID');
    m.setState(m.list()[0]!.id, 'in_race');
    expect(err(m.setCourse('h', 'pebble'))).toBe('LOBBY_NOT_OPEN');
    expect(err(m.setCourse('nobody', 'pebble'))).toBe('NOT_CONNECTED');
  });
  it('the course survives a race and a host hand-over', () => {
    const m = setup(), last = COURSE_IDS[COURSE_IDS.length - 1]!; m.createLobby('h', last); const id = m.list()[0]!.id; m.joinLobby('g', id);
    m.setState(id, 'in_race'); m.setState(id, 'open'); m.leaveLobby('h');
    expect(m.lobbyOf('g')!.course).toBe(last);
  });
});

describe('course on the wire', () => {
  it('createLobby takes an optional known course; setCourse needs one', () => {
    expect(p({ t: 'createLobby' })).toEqual({ t: 'createLobby' });
    for (const id of COURSE_IDS) { expect(p({ t: 'createLobby', course: id })).toEqual({ t: 'createLobby', course: id }); expect(p({ t: 'setCourse', course: id, x: 1 })).toEqual({ t: 'setCourse', course: id }); }
    for (const bad of [null, 1, '', 'augusta', 'PEBBLE', ['pebble'], { id: 'pebble' }, '__proto__']) {
      expect(p({ t: 'createLobby', course: bad }), JSON.stringify(bad)).toBeNull();
      expect(p({ t: 'setCourse', course: bad }), JSON.stringify(bad)).toBeNull();
    }
    expect(p({ t: 'setCourse' })).toBeNull();
  });
});
