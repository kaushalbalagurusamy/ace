// Applies a golferanim Pose to the rigged golfer (Meshy auto-rig bone names): pelvis and spine by forward kinematics,
// legs and arms by two-bone IK so feet stay planted and the hands stay on the club, then returns where the club goes.
import * as THREE from 'three';
import type { Pose, V3 } from './golferanim';
import { clubMatrix } from './clubs';

const NAMES = ['Hips', 'Spine02', 'Spine01', 'Spine', 'Head', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot',
  'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand'] as const;
type Name = typeof NAMES[number];
interface Rest { q: THREE.Quaternion; p: THREE.Vector3; mq: THREE.Quaternion; mp: THREE.Vector3 }   // local and model-space rest

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _w = new THREE.Vector3();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _t = new THREE.Vector3(), _u = new THREE.Vector3(), _p = new THREE.Vector3();

/** True when the model has every bone the rig drives. */
export const hasRig = (model: THREE.Object3D) => NAMES.every(n => !!model.getObjectByName(n));

export class GolferRig {
  private bones = {} as Record<Name, THREE.Bone>;
  private rest = {} as Record<Name, Rest>;
  private inv = new THREE.Matrix4();
  /** `model` is the normalised golfer (assets.normalise): its local space is the Pose's model space. */
  constructor(private model: THREE.Object3D) {
    model.updateMatrixWorld(true);
    this.inv.copy(model.matrixWorld).invert();
    for (const n of NAMES) {
      const b = model.getObjectByName(n) as THREE.Bone; this.bones[n] = b;
      const m = new THREE.Matrix4().multiplyMatrices(this.inv, b.matrixWorld), mp = new THREE.Vector3(), mq = new THREE.Quaternion();
      m.decompose(mp, mq, new THREE.Vector3());
      this.rest[n] = { q: b.quaternion.clone(), p: b.position.clone(), mq, mp };
    }
  }
  /** Rest position of a bone in model space (for tests and the QA page). */
  restPos(n: Name) { return this.rest[n].mp.clone(); }

  /** Poses the skeleton and returns the club's model-space matrix (grip end at the lead wrist, or the trail hand when walking). */
  apply(p: Pose, out = new THREE.Matrix4()): THREE.Matrix4 {
    const B = this.bones, R = this.rest;
    for (const n of NAMES) { B[n].quaternion.copy(R[n].q); B[n].position.copy(R[n].p); }
    // pelvis translation, in model space
    const hips = B.Hips; this.model.updateMatrixWorld(true);
    _v.copy(R.Hips.mp).add(_w.set(...p.shift)).applyMatrix4(this.model.matrixWorld);
    hips.position.copy(hips.parent!.worldToLocal(_v));
    this.rot('Hips', p.pelvis, 1);
    for (const n of ['Spine02', 'Spine01', 'Spine'] as const) this.rot(n, p.torso, 1 / 3);
    this.rot('Head', p.head, 1);
    this.model.updateMatrixWorld(true);
    // legs: ankles to the stance, knees forward (following half the pelvis turn)
    const knee: V3 = [Math.sin(p.pelvis[1] * 0.5), 0, Math.cos(p.pelvis[1] * 0.5)];
    this.ik('LeftUpLeg', 'LeftLeg', 'LeftFoot', this.add(R.LeftFoot.mp, p.lAnkle), knee);
    this.ik('RightUpLeg', 'RightLeg', 'RightFoot', this.add(R.RightFoot.mp, p.rAnkle), knee);
    this.foot('LeftFoot', p.lHeel); this.foot('RightFoot', p.rHeel);
    // arms
    const club = !p.free;
    const lT: V3 = club ? p.grip : p.free!.l;
    const rT: V3 = club ? [p.grip[0] + p.shaft[0] * 0.1, p.grip[1] + p.shaft[1] * 0.1, p.grip[2] + p.shaft[2] * 0.1] : p.free!.r;
    this.ik('LeftArm', 'LeftForeArm', 'LeftHand', lT, p.lPole);
    this.ik('RightArm', 'RightForeArm', 'RightHand', rT, p.rPole);
    // wrists: turn each hand most of the way from the forearm line toward the shaft so the hands wrap the grip
    if (club) for (const [f, h] of [['LeftForeArm', 'LeftHand'], ['RightForeArm', 'RightHand']] as const) {
      const hb = this.bones[h], hw = hb.getWorldPosition(new THREE.Vector3()), dir = hw.clone().sub(this.bones[f].getWorldPosition(_a)).normalize();
      const s = new THREE.Vector3(...p.shaft).transformDirection(this.model.matrixWorld), want = dir.clone().lerp(s, 0.7).normalize();
      this.aim(h, hw.clone().add(dir), hw.clone().add(want));
    }
    // club: grip end a few cm above the holding wrist, along the shaft
    const hand = this.modelPos(club ? 'LeftHand' : 'RightHand', _t);
    const g: V3 = [hand.x - p.shaft[0] * 0.03, hand.y - p.shaft[1] * 0.03, hand.z - p.shaft[2] * 0.03];
    return clubMatrix(g, p.shaft, p.face, out);
  }

  /** Model-space position of a bone now. */
  modelPos(n: Name, out = new THREE.Vector3()) { return out.setFromMatrixPosition(this.bones[n].matrixWorld).applyMatrix4(this.inv.copy(this.model.matrixWorld).invert()); }

  private add(a: THREE.Vector3, d: V3): V3 { return [a.x + d[0], a.y + d[1], a.z + d[2]]; }
  /** Rotates a bone by a model-space euler (times k) applied in its parent's posed frame: local = rest * (Wr^-1 * D * Wr). */
  private rot(n: Name, e: V3, k: number) {
    if (!e[0] && !e[1] && !e[2]) return;
    const r = this.rest[n]; _q.setFromEuler(_e.set(e[0] * k, e[1] * k, e[2] * k));
    _q2.copy(r.mq).invert().multiply(_q).multiply(r.mq);
    this.bones[n].quaternion.copy(r.q).multiply(_q2);
  }
  /** Turns bone `n` so its child (at world `childW`) points from the bone toward world `want`. */
  private aim(n: Name, childW: THREE.Vector3, want: THREE.Vector3) {
    const b = this.bones[n]; b.getWorldPosition(_a);
    const from = _b.copy(childW).sub(_a).normalize(), to = _c.copy(want).sub(_a).normalize();
    _q.setFromUnitVectors(from, to).multiply(b.getWorldQuaternion(_q2));
    b.quaternion.copy(b.parent!.getWorldQuaternion(_q2).invert().multiply(_q));
    b.updateMatrixWorld(true);
  }
  /** Two-bone IK: root `a` (shoulder/hip), mid `b` (elbow/knee), end `c` (wrist/ankle) to a model-space target, bending toward `pole`. */
  private ik(a: Name, b: Name, c: Name, target: V3, pole: V3) {
    const M = this.model.matrixWorld, A = this.bones[a].getWorldPosition(new THREE.Vector3()), Bp = this.bones[b].getWorldPosition(new THREE.Vector3());
    const C = this.bones[c].getWorldPosition(new THREE.Vector3()), la = A.distanceTo(Bp), lb = Bp.distanceTo(C);
    const T = new THREE.Vector3(...target).applyMatrix4(M), toT = _u.copy(T).sub(A), d = Math.min(Math.max(toT.length(), 1e-4), (la + lb) * 0.999);
    const u = toT.normalize(), pw = new THREE.Vector3(...pole).transformDirection(M);
    const v = pw.addScaledVector(u, -pw.dot(u)); if (v.lengthSq() < 1e-8) v.set(0, 1, 0).addScaledVector(u, -u.y); v.normalize();
    const cosA = Math.min(1, Math.max(-1, (la * la + d * d - lb * lb) / (2 * la * d))), sinA = Math.sqrt(1 - cosA * cosA);
    const E = A.clone().addScaledVector(u, la * cosA).addScaledVector(v, la * sinA);
    this.aim(a, Bp, E);
    const T2 = A.clone().addScaledVector(u, d);
    this.aim(b, this.bones[c].getWorldPosition(new THREE.Vector3()), T2);
  }
  /** Foot back to its rest orientation in model space, pitched about the toes by `heel` radians. */
  private foot(n: Name, heel: number) {
    const b = this.bones[n], mq = this.model.getWorldQuaternion(new THREE.Quaternion());
    _q.setFromEuler(_e.set(heel, 0, 0)).premultiply(mq).multiply(this.rest[n].mq);
    b.quaternion.copy(b.parent!.getWorldQuaternion(_q2).invert().multiply(_q)); b.updateMatrixWorld(true);
  }
}

/** Dresses one golfer: the polo in the player's colour (near-white texels between the belt and the collar, by bind-pose height,
 *  are multiplied by it; skin, trousers, shoes and the gold embroidery keep their texture; '#ffffff' leaves it white) and the
 *  signature glowing violet eyes (bluish texels on the head become emissive #7a5cff). Materials are cloned per golfer. */
export const EYE = '#7a5cff';
export function tintPolo(model: THREE.Object3D, colour: string) {
  model.traverse(o => {
    const m = o as THREE.SkinnedMesh; if (!m.isMesh) return;
    m.geometry.computeBoundingBox(); const bb = m.geometry.boundingBox!;
    const mat = (m.material as THREE.MeshStandardMaterial).clone(), tint = new THREE.Color(colour), eye = new THREE.Color(EYE);
    mat.onBeforeCompile = s => {
      s.uniforms.uTint = { value: tint }; s.uniforms.uEye = { value: eye }; s.uniforms.uMinY = { value: bb.min.y }; s.uniforms.uSpanY = { value: bb.max.y - bb.min.y };
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform float uMinY; uniform float uSpanY; varying float vBindH;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBindH = (position.y - uMinY) / uSpanY;');
      s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uTint; uniform vec3 uEye; varying float vBindH; float eyeMask;')
        .replace('#include <map_fragment>', `#include <map_fragment>
  { float mx = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)), mn = min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b));
    float white = smoothstep(0.30, 0.45, mx) * (1.0 - smoothstep(0.10, 0.2, (mx - mn) / max(mx, 1e-3)));
    float band = smoothstep(0.555, 0.575, vBindH) * (1.0 - smoothstep(0.85, 0.865, vBindH));
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uTint, white * band);
    // eyes: on the head, texels bluer than they are red or green (skin and hair are warm, so nothing else matches)
    float blue = diffuseColor.b - max(diffuseColor.r, diffuseColor.g * 1.05);
    eyeMask = smoothstep(0.905, 0.915, vBindH) * (1.0 - smoothstep(0.94, 0.945, vBindH)) * smoothstep(-0.015, 0.01, blue) * smoothstep(0.12, 0.2, mx);   // bright: not the dark hair
    diffuseColor.rgb = mix(diffuseColor.rgb, uEye, eyeMask); }`)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += uEye * eyeMask * 3.0;');
    };
    m.material = mat;
  });
}
