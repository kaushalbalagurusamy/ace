// Converts an Uthana video-to-motion result (motion-only GLB, downloaded from
// https://uthana.com/motion/animation/motion_viewer/<character>/<motion>/glb/motion.glb?fps=30) into the capture format that
// scripts/motion/retarget-swing.ts reads (MediaPipe's 33 landmarks per frame, world and image), so the Uthana swing goes through
// the same phase detection, prior fusion and packing as the MediaPipe one. Uthana recovers full-body 3D motion from the video, so
// depth (the down-the-line camera's weak axis) comes from its model instead of a single-view landmark estimate.
//
// Usage: npx tsx scripts/motion/uthana-capture.ts <motion.glb> <out.json> [--names]
import { readFileSync, writeFileSync } from 'node:fs';
import { AnimationMixer, Bone, Object3D, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { LM, type Capture, type P3 } from './mocap';

const [glbPath, out, flag] = process.argv.slice(2);
if (!glbPath || !out) throw new Error('usage: uthana-capture.ts <motion.glb> <out.json> [--names]');
const buf = readFileSync(glbPath);
const gltf = await new GLTFLoader().parseAsync(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, '');
const bones = new Map<string, Object3D>();
gltf.scene.traverse(o => { if (o instanceof Bone || o.name) bones.set(o.name, o); });
const clip = gltf.animations[0]!;
if (flag === '--names') { console.log([...bones.keys()].join(' '), clip.duration, clip.tracks[0]!.times.length); process.exit(0); }

// UE5 Manny bones (Uthana's default character) standing in for the MediaPipe landmarks retarget-swing.ts uses
const J: Partial<Record<keyof typeof LM, string>> = { lSh: 'upperarm_l', rSh: 'upperarm_r', lEl: 'lowerarm_l', rEl: 'lowerarm_r', lWr: 'hand_l', rWr: 'hand_r',
  lHip: 'thigh_l', rHip: 'thigh_r', lKnee: 'calf_l', rKnee: 'calf_r', lAnk: 'foot_l', rAnk: 'foot_r', lToe: 'ball_l', rToe: 'ball_r' };
const mixer = new AnimationMixer(gltf.scene);
mixer.clipAction(clip).play();
const fps = 30, n = clip.tracks[0]!.times.length;
const pos = (name: string) => { const b = bones.get(name); if (!b) throw new Error(`no bone ${name}`); return b.getWorldPosition(new Vector3()); };
const frames: Capture['frames'] = [];
let X: Vector3 | null = null, Z: Vector3 | null = null, origin: Vector3 | null = null;
const Y = new Vector3(0, 1, 0);
for (let i = 0; i < n; i++) {
  mixer.setTime(i / fps); gltf.scene.updateMatrixWorld(true);
  const hipMid = pos('thigh_l').add(pos('thigh_r')).multiplyScalar(0.5);
  if (!X) {   // model frame from the address: x toward the target (his left), y up, z toward the ball (the way he faces)
    X = pos('thigh_l').sub(pos('thigh_r')).setY(0).normalize(); Z = new Vector3().crossVectors(X, Y);
    origin = pos('foot_l').add(pos('foot_r')).multiplyScalar(0.5);
  }
  const model = (p: Vector3, o: Vector3): P3 => { const d = p.clone().sub(o); return [d.dot(X!), d.dot(Y), d.dot(Z!)]; };
  const head = bones.get('head')!, hq = head.getWorldQuaternion(head.quaternion.clone()), hp = pos('head');
  // ears either side of the head along the head's own lateral axis (its local axis that points to his left at address)
  const side = (s: number) => hp.clone().add(new Vector3(0, 0, 0.075 * s).applyQuaternion(hq));
  const pts: Partial<Record<number, Vector3>> = { [LM.nose]: hp, [LM.lEar]: side(1), [LM.rEar]: side(-1) };
  for (const [k, b] of Object.entries(J)) pts[LM[k as keyof typeof LM]] = pos(b!);
  // heels: behind the ankle on the toe-ankle line, so the heel-toe pitch is the foot's pitch
  for (const [h, a, t] of [[LM.lHeel, LM.lAnk, LM.lToe], [LM.rHeel, LM.rAnk, LM.rToe]] as const) pts[h] = pts[a]!.clone().add(pts[a]!.clone().sub(pts[t]!).multiplyScalar(0.3));
  const world: number[][] = [], image: number[][] = [];
  for (let j = 0; j < 33; j++) {
    const p = pts[j] ?? hipMid, m = model(p, hipMid), a = model(p, origin!);
    world.push([m[2], -m[1], m[0], 1]);                    // inverse of mocap.dtl()
    image.push([0.5 + a[2] / 3, 0.9 - a[1] / 3, 0, 1]);    // a down-the-line camera: image right toward the ball, v down
  }
  frames.push({ n: i, world, image });
}
// the ear axis is a guess at the head bone's local frame: check it points to his left at address
const e0 = frames[0]!.world, earX = e0[LM.lEar]![2]! - e0[LM.rEar]![2]!;
console.log('frames', n, 'ear line toward target at address:', earX.toFixed(3), earX > 0 ? 'ok' : 'FLIPPED');
writeFileSync(out, JSON.stringify({ fps, width: 1280, height: 720, frames } satisfies Capture));
