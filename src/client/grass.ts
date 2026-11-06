// Instanced grass-blade clumps on the rough near the camera (High and Ultra). The clumps sit on a world-anchored jittered lattice,
// so they do not swim when the set is refilled (only after the camera moves 3 m); wind sway is a vertex-shader sine, nothing per frame on the CPU.
import * as THREE from 'three';
import { cellCode, ground } from './terrain';

const ROUGH = 114; // 'r'
const hash = (x: number, z: number, k: number) => { const s = Math.sin(x * 127.1 + z * 311.7 + k * 74.7) * 43758.5453; return s - Math.floor(s); };

function clumpGeometry(): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [], BLADES = 6;
  for (let b = 0; b < BLADES; b++) {
    const a = (b / BLADES) * Math.PI * 2 + b * 0.7, r = 0.015 + 0.03 * ((b * 37) % 5) / 5, h = 0.11 + 0.08 * ((b * 53) % 7) / 7;
    const cx = Math.cos(a) * r, cz = Math.sin(a) * r, tx = Math.cos(a + 1.57) * 0.011, tz = Math.sin(a + 1.57) * 0.011, lean = 0.05;
    pos.push(cx - tx, 0, cz - tz, cx + tx, 0, cz + tz, cx + Math.cos(a) * lean, h, cz + Math.sin(a) * lean);
    col.push(0.45, 0.5, 0.4, 0.45, 0.5, 0.4, 1.05, 1.08, 0.9);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));   // lit like the ground under it
  return g;
}

export class Grass {
  private mesh: THREE.InstancedMesh | null = null;
  private radius = 0; private spacing = 0; private hole = -1; private cx = 1e9; private cz = 1e9;
  private readonly time = { value: 0 };
  private readonly mat: THREE.MeshLambertMaterial;
  private m = new THREE.Matrix4(); private q = new THREE.Quaternion(); private p = new THREE.Vector3(); private s = new THREE.Vector3(); private c = new THREE.Color();
  private static readonly UP = new THREE.Vector3(0, 1, 0);
  constructor(private parent: THREE.Object3D) {
    this.mat = new THREE.MeshLambertMaterial({ color: '#71883f', vertexColors: true, side: THREE.DoubleSide });
    this.mat.onBeforeCompile = sh => {
      sh.uniforms.uTime = this.time;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
float ph = instanceMatrix[3].x * 0.35 + instanceMatrix[3].z * 0.27;
float sw = (sin(uTime * 1.7 + ph) * 0.6 + sin(uTime * 3.1 + ph * 1.9) * 0.25) * position.y * position.y * 3.0;
transformed.x += sw; transformed.z += sw * 0.5;
#endif`);
    };
  }
  /** radius 0 removes the grass. */
  configure(radius: number, spacing: number) {
    if (radius === this.radius && spacing === this.spacing) return;
    this.radius = radius; this.spacing = spacing; this.cx = 1e9;
    if (this.mesh) { this.parent.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.dispose(); this.mesh = null; }
    if (!radius) return;
    const cap = Math.ceil(Math.PI * (radius / spacing + 1.5) ** 2);
    this.mesh = new THREE.InstancedMesh(clumpGeometry(), this.mat, cap);
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.setColorAt(0, this.c.setRGB(1, 1, 1));
    this.parent.add(this.mesh);
  }
  /** x, z in three space (camera position); refills only when the camera moved 3 m or the hole changed. */
  update(hole: number, x: number, z: number, tSec: number) {
    this.time.value = tSec;
    const mesh = this.mesh; if (!mesh || (hole === this.hole && Math.hypot(x - this.cx, z - this.cz) < 3)) return;
    this.hole = hole; this.cx = x; this.cz = z;
    const R = this.radius, S = this.spacing; let n = 0;
    for (let gz = Math.floor((z - R) / S); gz <= Math.ceil((z + R) / S); gz++) for (let gx = Math.floor((x - R) / S); gx <= Math.ceil((x + R) / S); gx++) {
      const wx = (gx + hash(gx, gz, 1)) * S, wz = (gz + hash(gx, gz, 2)) * S, d = Math.hypot(wx - x, wz - z);
      if (d > R || n >= mesh.instanceMatrix.count || cellCode(hole, -wx, wz) !== ROUGH) continue;
      const fade = Math.min(1, (R - d) / (0.25 * R));   // shrink toward the edge so there is no hard ring
      this.s.setScalar((0.75 + 0.6 * hash(gx, gz, 3)) * fade);
      this.m.compose(this.p.set(wx, ground(hole, -wx, wz), wz), this.q.setFromAxisAngle(Grass.UP, hash(gx, gz, 4) * 6.283), this.s);
      mesh.setMatrixAt(n, this.m);
      const v = 0.82 + 0.3 * hash(gx, gz, 5); mesh.setColorAt(n, this.c.setRGB(v, v * (0.97 + 0.06 * hash(gx, gz, 6)), v * 0.95));
      n++;
    }
    mesh.count = n; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
}
