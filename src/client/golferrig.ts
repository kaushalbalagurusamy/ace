// Applies a golferanim Pose to the rigged golfer (Meshy auto-rig bone names): pelvis and spine by forward kinematics,
// legs and arms by two-bone IK so feet stay planted and the hands stay on the club, then returns where the club goes.
import * as THREE from 'three';
import type { Pose, V3 } from './golferanim';
import { clubMatrix } from './clubs';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const NAMES = ['Hips', 'Spine02', 'Spine01', 'Spine', 'Head', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot',
  'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand'] as const;
type Name = typeof NAMES[number];
interface Rest { q: THREE.Quaternion; p: THREE.Vector3; mq: THREE.Quaternion; mp: THREE.Vector3 }   // local and model-space rest

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _w = new THREE.Vector3();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _t = new THREE.Vector3(), _u = new THREE.Vector3(), _p = new THREE.Vector3();

/** Top-down turn of a pose in degrees, closed (away from the target) > 0, open < 0: the hip line after the pelvis rotation and the
 *  shoulder line after the pelvis then the torso (the torso applied in the pelvis's frame, as the rig does), projected on the ground. */
export function turnAngles(p: Pose): { hips: number; shoulders: number } {
  const qp = new THREE.Quaternion().setFromEuler(new THREE.Euler(...p.pelvis)), qt = new THREE.Quaternion().setFromEuler(new THREE.Euler(...p.torso));
  const ang = (q: THREE.Quaternion) => { const v = new THREE.Vector3(1, 0, 0).applyQuaternion(q); return (Math.atan2(v.z, v.x) * 180) / Math.PI; };
  return { hips: ang(qp), shoulders: ang(qp.clone().multiply(qt)) };
}

/** Slides a lead-hand grip point (with its trail point rigidly below it) toward the mid-shoulder point until the lead target is within
 *  `lReach` of the lead shoulder and the trail target within `rReach` of the trail shoulder. Returns the (possibly moved) lead point. */
export function keepReachable(lead: V3, trail: V3, lSh: { x: number; y: number; z: number }, rSh: { x: number; y: number; z: number }, lReach: number, rReach: number): V3 {
  const mid = [(lSh.x + rSh.x) / 2, (lSh.y + rSh.y) / 2, (lSh.z + rSh.z) / 2];
  const at = (t: number, p: V3): V3 => [p[0] + (mid[0]! - lead[0]) * t, p[1] + (mid[1]! - lead[1]) * t, p[2] + (mid[2]! - lead[2]) * t];
  const ok = (t: number) => { const a = at(t, lead), b = at(t, trail);
    return Math.hypot(a[0] - lSh.x, a[1] - lSh.y, a[2] - lSh.z) <= lReach && Math.hypot(b[0] - rSh.x, b[1] - rSh.y, b[2] - rSh.z) <= rReach; };
  if (ok(0)) return lead;
  let lo = 0, hi = 1; for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (ok(m)) hi = m; else lo = m; }   // smallest slide that reaches
  return at(hi, lead);
}

/** Vertical drop for a hip at `hip` so a limb of length `reach` touches `target` (0 when it already can). */
export function requiredDrop(hip: V3, target: V3, reach: number): number {
  const dx = hip[0] - target[0], dy = hip[1] - target[1], dz = hip[2] - target[2], h2 = dx * dx + dz * dz;
  if (dx * dx + dy * dy + dz * dz <= reach * reach || h2 >= reach * reach) return 0;
  return dy - Math.sqrt(reach * reach - h2);
}

/** True when the model has every bone the rig drives. */
export const hasRig = (model: THREE.Object3D) => NAMES.every(n => !!model.getObjectByName(n));

export class GolferRig {
  private bones = {} as Record<Name, THREE.Bone>;
  private rest = {} as Record<Name, Rest>;
  private inv = new THREE.Matrix4();
  /** `model` is the normalised golfer (assets.normalise): its local space is the Pose's model space. */
  constructor(private model: THREE.Object3D) {
    // likeness (critic): the reference's face is longer and narrower than the mesh's; skinned to the head bone, so scale it there
    const head = model.getObjectByName('Head'); if (head && !head.userData.narrowed) { head.scale.multiply(new THREE.Vector3(0.92, 1.04, 0.97)); head.userData.narrowed = true; }
    model.updateMatrixWorld(true);
    this.inv.copy(model.matrixWorld).invert();
    for (const n of NAMES) {
      const b = model.getObjectByName(n) as THREE.Bone; this.bones[n] = b;
      const m = new THREE.Matrix4().multiplyMatrices(this.inv, b.matrixWorld), mp = new THREE.Vector3(), mq = new THREE.Quaternion();
      m.decompose(mp, mq, new THREE.Vector3());
      this.rest[n] = { q: b.quaternion.clone(), p: b.position.clone(), mq, mp };
    }
  }
  /** After apply(): how far (m) each wrist ended from its grip point (QA reports this; 0 when the arms reach). */
  handError = { lead: 0, trail: 0 };
  private armLen(side: 'Left' | 'Right') {
    const r = this.rest; return r[`${side}Arm`].mp.distanceTo(r[`${side}ForeArm`].mp) + r[`${side}ForeArm`].mp.distanceTo(r[`${side}Hand`].mp);
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
    // the chest and ribcage skin follows the lower spine bones most, so most of the turn goes there (an even split left the chest square)
    this.rot('Spine02', p.torso, 0.7); this.rot('Spine01', p.torso, 0.2); this.rot('Spine', p.torso, 0.1);
    this.rot('Head', p.head, 1);
    this.model.updateMatrixWorld(true);
    // legs: ankles to the stance, knees forward (following half the pelvis turn). The ankle targets are pinned to the ground;
    // if a straightened leg can't reach its target the pelvis drops until it can, so the golfer never floats.
    // a lifted heel turns that knee in (critic: at impact the trail knee kicks in toward the target, at the top the lead knee in toward the trail side)
    const kn = (a: number): V3 => [Math.sin(a), 0, Math.cos(a)], knee = kn(p.pelvis[1] * 0.5), lKnee = kn(p.pelvis[1] * 0.5 - p.lHeel * 0.6), rKnee = kn(p.pelvis[1] * 0.5 + p.rHeel * 0.6);
    const lFoot = this.add(R.LeftFoot.mp, p.lAnkle), rFoot = this.add(R.RightFoot.mp, p.rAnkle);
    const drop = Math.max(this.legDrop('LeftUpLeg', 'LeftLeg', 'LeftFoot', lFoot), this.legDrop('RightUpLeg', 'RightLeg', 'RightFoot', rFoot));
    if (drop > 0) {
      hips.getWorldPosition(_v); _v.applyMatrix4(this.inv.copy(this.model.matrixWorld).invert()); _v.y -= drop;
      hips.position.copy(hips.parent!.worldToLocal(_v.applyMatrix4(this.model.matrixWorld))); this.model.updateMatrixWorld(true);
    }
    this.ik('LeftUpLeg', 'LeftLeg', 'LeftFoot', lFoot, p.free ? knee : lKnee);   // gait heels pitch both ways: knees stay forward
    this.ik('RightUpLeg', 'RightLeg', 'RightFoot', rFoot, p.free ? knee : rKnee);
    this.foot('LeftFoot', p.lHeel); this.foot('RightFoot', p.rHeel);
    // arms
    const club = !p.free;
    let tgt = club ? this.gripTarget(p) : null;
    // wrists sit either side of the shaft, palms facing: the lead (left) wrist on the clubface side, the trail (right) wrist on the other,
    // the trail 7 cm further down the grip (on the shaft line itself the two hand meshes overlapped into an X)
    const sh = new THREE.Vector3(...p.shaft), side = new THREE.Vector3(...p.face).addScaledVector(sh, -new THREE.Vector3(...p.face).dot(sh)).normalize().multiplyScalar(0.03);
    const off = (t: V3, k: number, down: number): V3 => [t[0] + side.x * k + p.shaft[0] * down, t[1] + side.y * k + p.shaft[1] * down, t[2] + side.z * k + p.shaft[2] * down];
    const below = (t: V3): V3 => off(t, -1, 0.07);
    // hard grip constraint: if either hand's grip point is out of reach, slide the whole grip toward the shoulders until both arms
    // reach it, so the hands never come off the club (critic: hands separating at P6 and P7)
    if (tgt) tgt = keepReachable(off(tgt, 1, 0), below(tgt), this.modelPos('LeftArm'), this.modelPos('RightArm'), this.armLen('Left') * 0.995, this.armLen('Right') * 0.995);
    const lT: V3 = tgt ?? p.free!.l;   // keepReachable returned the (lead-side) wrist point
    const rT: V3 = tgt ? off(tgt, -2, 0.07) : p.free!.r;   // from the lead wrist: across the shaft and down the grip
    this.ik('LeftArm', 'LeftForeArm', 'LeftHand', lT, p.lPole);
    this.ik('RightArm', 'RightForeArm', 'RightHand', rT, p.rPole);
    this.handError = { lead: this.modelPos('LeftHand').distanceTo(new THREE.Vector3(...lT)), trail: this.modelPos('RightHand').distanceTo(new THREE.Vector3(...rT)) };
    // wrists: turn each hand most of the way from the forearm line toward the shaft so the hands wrap the grip
    if (club) for (const [f, h] of [['LeftForeArm', 'LeftHand'], ['RightForeArm', 'RightHand']] as const) {
      const hb = this.bones[h], hw = hb.getWorldPosition(new THREE.Vector3()), dir = hw.clone().sub(this.bones[f].getWorldPosition(_a)).normalize();
      const s = new THREE.Vector3(...p.shaft).transformDirection(this.model.matrixWorld), want = dir.clone().lerp(s, 0.7).normalize();
      this.aim(h, hw.clone().add(dir), hw.clone().add(want));
    }
    // club: grip end a few cm above the holding wrist, along the shaft
    const hand = this.modelPos(club ? 'LeftHand' : 'RightHand', _t);
    const k = club ? 1 : 0;   // with the club in both hands the shaft runs between the wrists: back across from the lead wrist
    const g: V3 = [hand.x - side.x * k - p.shaft[0] * 0.03, hand.y - side.y * k - p.shaft[1] * 0.03, hand.z - side.z * k - p.shaft[2] * 0.03];
    return clubMatrix(g, p.shaft, p.face, out);
  }

  /** Model-space position of a bone now. */
  modelPos(n: Name, out = new THREE.Vector3()) { return out.setFromMatrixPosition(this.bones[n].matrixWorld).applyMatrix4(this.inv.copy(this.model.matrixWorld).invert()); }

  private add(a: THREE.Vector3, d: V3): V3 { return [a.x + d[0], a.y + d[1], a.z + d[2]]; }
  /** The lead-wrist target: the model-space grip blended (by gripT) with tgrip, an offset from the mid-shoulder point in the turned
   *  thorax frame (x lead side, y up the spine, z out of the chest), so hands keyed there turn with the chest (critic: at P4 the hands
   *  sat in front of the face because they were placed in a frame that had not turned). */
  private gripTarget(p: Pose): V3 {
    if (!p.gripT) return p.grip;
    const sp = this.bones.Spine, mq = this.model.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(sp.getWorldQuaternion(new THREE.Quaternion()));
    const turn = mq.multiply(this.rest.Spine.mq.clone().invert());   // thorax rotation from rest, model space
    const mid = this.modelPos('LeftArm').add(this.modelPos('RightArm')).multiplyScalar(0.5).add(new THREE.Vector3(...p.tgrip).applyQuaternion(turn));
    const k = p.gripT; return [p.grip[0] + (mid.x - p.grip[0]) * k, p.grip[1] + (mid.y - p.grip[1]) * k, p.grip[2] + (mid.z - p.grip[2]) * k];
  }
  /** How far (model metres) the hip joint must come down for this leg to reach its model-space ankle target with a soft knee. */
  private legDrop(a: Name, b: Name, c: Name, target: V3): number {
    const inv = this.inv.copy(this.model.matrixWorld).invert(), m = (n: Name) => this.bones[n].getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
    const hip = m(a), kn = m(b), an = m(c), reach = (hip.distanceTo(kn) + kn.distanceTo(an)) * 0.985;   // keep a slight knee bend
    return requiredDrop([hip.x, hip.y, hip.z], target, reach);
  }
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

/** Smooth shading (critic: the face read blocky and faceted): normals averaged across faces meeting at under 60°, so creases such
 *  as the collar stay sharp. Keeps the skin weights (the geometry is de-indexed with every attribute). */
export function smoothShading(model: THREE.Object3D) {
  model.traverse(o => { const m = o as THREE.SkinnedMesh; if (m.isMesh) m.geometry = toCreasedNormals(m.geometry, Math.PI / 3); });
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
    // texture clean-up (critic): light, unsaturated streaks on the trousers become the charcoal fabric; pale pink and orange
    // blotches on the shirt become white. Skin and the gold embroidery are strongly saturated, so they are left alone.
    float sat = (mx - mn) / max(mx, 1e-3);
    float legs = smoothstep(0.07, 0.09, vBindH) * (1.0 - smoothstep(0.54, 0.555, vBindH));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.032, 0.034, 0.039) * (0.8 + 1.5 * mn), legs * smoothstep(0.065, 0.12, mx) * (1.0 - smoothstep(0.4, 0.5, sat)));
    float shirt = smoothstep(0.575, 0.59, vBindH) * (1.0 - smoothstep(0.85, 0.865, vBindH));
    float br = diffuseColor.b / max(diffuseColor.r, 1e-3);   // skin is warm (blue far below red); the pink blotches are not
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(mx), shirt * smoothstep(0.3, 0.4, mx) * smoothstep(0.06, 0.12, sat) * (1.0 - smoothstep(0.42, 0.52, sat)) * smoothstep(0.45, 0.55, br));
    { float gr = diffuseColor.g / max(diffuseColor.r, 1e-3), warm = step(diffuseColor.b, diffuseColor.g) * shirt * smoothstep(0.3, 0.4, sat) * smoothstep(0.3, 0.4, mx) * (1.0 - smoothstep(0.83, 0.845, vBindH));   // bright: not the beard
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.6, 0.42, 0.16) * (0.75 + 0.4 * mx), 0.45 * warm * smoothstep(0.55, 0.65, gr));   // gold: a little clearer, still fine-line
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(max(mx, 0.7)), shirt * smoothstep(0.3, 0.4, sat) * (1.0 - smoothstep(0.45, 0.55, gr)) * smoothstep(0.55, 0.65, mx)); }   // light red/orange specks: white (skin is darker)
    mx = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)); mn = min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b));
    float white = smoothstep(0.30, 0.45, mx) * (1.0 - smoothstep(0.10, 0.2, (mx - mn) / max(mx, 1e-3)));
    float band = smoothstep(0.555, 0.575, vBindH) * (1.0 - smoothstep(0.85, 0.865, vBindH));
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uTint, white * band);
    // eyes: on the head, texels bluer than they are red or green (skin and hair are warm, so nothing else matches)
    float blue = diffuseColor.b - max(diffuseColor.r, diffuseColor.g * 1.05);
    eyeMask = smoothstep(0.905, 0.915, vBindH) * (1.0 - smoothstep(0.94, 0.945, vBindH)) * smoothstep(-0.015, 0.01, blue) * smoothstep(0.12, 0.2, mx);   // bright: not the dark hair
    diffuseColor.rgb = mix(diffuseColor.rgb, uEye, eyeMask); }`)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += uEye * eyeMask * 7.0;');
    };
    m.material = mat;
  });
}
