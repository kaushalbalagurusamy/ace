// Handedness of the solved arms on a stick-figure skeleton with the Meshy rig's bone names (facing +Z, his left = +X = the target).
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GolferRig } from '../src/client/golferrig';
import { P_POS, swingPoses } from '../src/client/golferanim';

function stickFigure() {
  const root = new THREE.Group(), bones = new Map<string, THREE.Bone>();
  const bone = (name: string, parent: THREE.Object3D, x: number, y: number, z = 0) => { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z); parent.add(b); bones.set(name, b); return b; };
  const hips = bone('Hips', root, 0, 1.0), s2 = bone('Spine02', hips, 0, 0.12), s1 = bone('Spine01', s2, 0, 0.12), sp = bone('Spine', s1, 0, 0.12);
  bone('Head', sp, 0, 0.2);
  for (const [side, k] of [['Left', 1], ['Right', -1]] as const) {
    const arm = bone(`${side}Arm`, sp, 0.17 * k, 0.04), fore = bone(`${side}ForeArm`, arm, 0.09 * k, -0.245); bone(`${side}Hand`, fore, 0.09 * k, -0.245);
    const up = bone(`${side}UpLeg`, hips, 0.1 * k, -0.06), leg = bone(`${side}Leg`, up, 0, -0.44); bone(`${side}Foot`, leg, 0, -0.42);
  }
  root.updateMatrixWorld(true);
  return root;
}
const L = 1.156;   // driver
const pos = (rig: GolferRig, n: string) => rig.modelPos(n as Parameters<GolferRig['modelPos']>[0]);
/** 2D segment intersection (face-on projection: x, y). */
const cross2 = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) => {
  const o = (p: THREE.Vector3, q: THREE.Vector3, r: THREE.Vector3) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
};

describe('golfer hands (right-handed: the left hand leads)', () => {
  it('at P1 the left wrist is target-side of the right, higher up the grip, and the forearms do not cross', () => {
    const rig = new GolferRig(stickFigure()), p = swingPoses(L)[0]!; rig.apply(p);
    const lh = pos(rig, 'LeftHand'), rh = pos(rig, 'RightHand'), le = pos(rig, 'LeftForeArm'), re = pos(rig, 'RightForeArm');
    expect(lh.x).toBeGreaterThan(rh.x);
    expect(lh.clone().sub(rh).dot(new THREE.Vector3(...p.shaft))).toBeLessThan(0);   // lead nearer the butt end
    expect(cross2(le, lh, re, rh)).toBe(false);
  });
  it('at P7 the hands keep the same order and the forearms do not cross', () => {
    const rig = new GolferRig(stickFigure()), p = swingPoses(L)[6]!; rig.apply(p);
    const lh = pos(rig, 'LeftHand'), rh = pos(rig, 'RightHand');
    expect(lh.x).toBeGreaterThan(rh.x - 0.005);
    expect(cross2(pos(rig, 'LeftForeArm'), lh, pos(rig, 'RightForeArm'), rh)).toBe(false);
  });
  it('at P4 the hand midpoint is on the trail side of the head along the target axis', () => {
    const rig = new GolferRig(stickFigure()); rig.apply(P_POS[3]!);
    const mid = pos(rig, 'LeftHand').add(pos(rig, 'RightHand')).multiplyScalar(0.5);
    expect(mid.x).toBeLessThan(pos(rig, 'Head').x);
  });
});
