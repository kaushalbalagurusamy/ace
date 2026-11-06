import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CLUBS, clubMatrix, headScale, makeCodeClub } from '../src/client/clubs';
import { BAG } from '../src/client/ui';

describe('club attach transform', () => {
  it('puts the grip end at the grip and runs the shaft (local -Y) along the shaft direction', () => {
    const m = clubMatrix([0.1, 0.8, 0.3], [0, -0.6, 0.8], [1, 0, 0]);
    const origin = new THREE.Vector3().applyMatrix4(m), tip = new THREE.Vector3(0, -1, 0).applyMatrix4(m);
    expect(origin.toArray()).toEqual([0.1, 0.8, 0.3]);
    expect(tip.sub(origin).toArray().map(x => +x.toFixed(6))).toEqual([0, -0.6, 0.8]);
  });
  it('makes the face perpendicular to the shaft and keeps a right-handed rigid basis', () => {
    const m = clubMatrix([0, 1, 0], [0.3, -0.9, 0.3], [1, 0.5, 0]), x = new THREE.Vector3(), y = new THREE.Vector3(), z = new THREE.Vector3();
    m.extractBasis(x, y, z);
    expect(z.dot(y)).toBeCloseTo(0, 9); expect(z.length()).toBeCloseTo(1, 9);
    expect(m.determinant()).toBeCloseTo(1, 9);
  });
  it('still works when the face hint is parallel to the shaft', () => {
    const m = clubMatrix([0, 0, 0], [0, -1, 0], [0, 1, 0]);
    expect(Number.isFinite(m.determinant())).toBe(true); expect(m.determinant()).toBeCloseTo(1, 9);
  });
});

describe('club specs and scale', () => {
  it('has one club per bag slot, driver longest, putter flagged', () => {
    expect(CLUBS.length).toBe(BAG.length);
    expect(Math.max(...CLUBS.map(c => c.length))).toBe(CLUBS[0]!.length);
    expect(CLUBS[13]!.kind).toBe('putter');
  });
  it('scales a generated head to its real heel-to-toe length', () => {
    expect(headScale(2, 0.122)).toBeCloseTo(0.061);
    expect(headScale(0, 0.1)).toBe(1);
  });
  it('code clubs hang their head about one club length below the grip end', () => {
    for (const spec of [CLUBS[0]!, CLUBS[6]!, CLUBS[13]!]) {
      const b = new THREE.Box3().setFromObject(makeCodeClub(spec));
      expect(b.max.y).toBeCloseTo(0, 2);
      // the toe hangs lower than the heel by the lie (90 - lie degrees over the head length) in the club's own frame
      expect(b.min.y).toBeGreaterThan(-spec.length - spec.head); expect(b.min.y).toBeLessThan(-spec.length + 0.03);
    }
  });
});
