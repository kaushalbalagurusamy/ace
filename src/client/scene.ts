import * as THREE from 'three';
import type { BallState, HoleInfo, PlayerRace, ServerMsg } from '../shared/protocol';

const SHADES = ['#f0f0f0', '#b8b8b8', '#808080', '#505050'];
export interface Ent {
  id: string; name: string; shade: string; ball: BallState; hole: number; done: boolean;
  golfer: THREE.Group; ballMesh: THREE.Mesh; tracer?: THREE.Line; hid?: boolean;
  anim?: { pts: THREE.Vector3[]; ts: number[]; t0: number; final: BallState };
}
// Sim space is left-handed (x right, z forward); three is right-handed, so mirror x.
const V = (x: number, y: number, z: number) => new THREE.Vector3(-x, y, z);

export class World {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(60, 1, 0.1, 2000);
  ents = new Map<string, Ent>();
  /** hole (0-based) the local player is on: other players' balls, golfers and tracers on other holes are hidden */
  myHole = 0;
  private course = new THREE.Group();
  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.scene.background = new THREE.Color('#9a9a9a'); this.scene.fog = new THREE.Fog('#9a9a9a', 150, 700);
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#555555', 1.6), this.course);
    const sun = new THREE.DirectionalLight('#ffffff', 1.5); sun.position.set(50, 100, 30); this.scene.add(sun);
    const resize = () => { this.renderer.setSize(innerWidth, innerHeight); this.cam.aspect = innerWidth / innerHeight; this.cam.updateProjectionMatrix(); };
    addEventListener('resize', resize); resize();
  }
  private mat = (c: string) => new THREE.MeshLambertMaterial({ color: c });
  private band(w: number, l: number, cx: number, cz: number, rotY: number, y: number, c: string) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l).rotateX(-Math.PI / 2), this.mat(c));
    m.position.set(cx, y, cz); m.rotation.y = rotY; this.course.add(m); return m;
  }
  load(h: HoleInfo, players: PlayerRace[]) {
    for (const e of this.ents.values()) this.scene.remove(e.golfer, e.ballMesh, ...(e.tracer ? [e.tracer] : [])); this.ents.clear();
    this.buildCourse(h); this.myHole = h.index;
    const rot = Math.atan2(-(h.pin.x - h.tee.x), h.pin.z - h.tee.z);
    players.forEach((p, i) => {
      const shade = SHADES[i % 4]!;
      const e: Ent = { id: p.id, name: p.name, shade, ball: p.ball, hole: p.hole, done: p.ball.holedOut, golfer: this.makeGolfer(shade, p.name), ballMesh: new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), this.mat('#ffffff')) };
      this.scene.add(e.golfer, e.ballMesh); this.ents.set(p.id, e); this.setBall(e, p.ball);
      e.golfer.position.copy(V(p.ball.x + 1, 0, p.ball.z - 0.5)); e.golfer.rotation.y = rot;
    });
  }
  /** Puts a player on the tee of a hole (after their hole-out): ball reset, tracer and replay cleared. */
  moveTo(id: string, ball: BallState, hole: number) {
    const e = this.ents.get(id); if (!e) return;
    e.hole = hole; e.done = false; e.anim = undefined;
    if (e.tracer) { this.scene.remove(e.tracer); e.tracer = undefined; }
    this.setBall(e, ball);
    e.golfer.position.copy(V(ball.x + 1, 0, ball.z - 0.5));
  }
  /** Rebuilds the terrain for a hole without touching the players. */
  buildCourse(h: HoleInfo) {
    this.course.clear();
    const dx = h.pin.x - h.tee.x, dz = h.pin.z - h.tee.z, L = Math.hypot(dx, dz) || 1, rot = Math.atan2(-dx, dz);
    const mid = V((h.pin.x + h.tee.x) / 2, 0, (h.pin.z + h.tee.z) / 2), len = L + 30;
    this.band(4000, 4000, mid.x, mid.z, 0, -0.02, '#5c5c5c');
    this.band(2 * (h.fairwayHalfWidth + 4), len, mid.x, mid.z, rot, 0, '#6e6e6e');
    this.band(2 * h.fairwayHalfWidth, len, mid.x, mid.z, rot, 0.01, '#8a8a8a');
    const pin = V(h.pin.x, 0, h.pin.z);
    for (const [r, c, y] of [[h.greenRadius + 2.5, '#9a9a9a', 0.02], [h.greenRadius, '#c8c8c8', 0.03]] as const) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(r, 40).rotateX(-Math.PI / 2), this.mat(c)); m.position.set(pin.x, y, pin.z); this.course.add(m);
    }
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6), this.mat('#eee')); pole.position.set(pin.x, 1.2, pin.z);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), new THREE.MeshLambertMaterial({ color: '#222', side: THREE.DoubleSide })); flag.position.set(pin.x + 0.45, 2.1, pin.z);
    this.course.add(pole, flag);
  }
  private makeGolfer(shade: string, name: string) {
    const g = new THREE.Group(), box = (w: number, h: number, d: number, x: number, y: number, c = shade) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.mat(c)); m.position.set(x, y, 0); g.add(m);
    };
    box(0.22, 0.85, 0.25, -0.13, 0.43, '#333'); box(0.22, 0.85, 0.25, 0.13, 0.43, '#333'); box(0.55, 0.7, 0.3, 0, 1.2); box(0.15, 0.65, 0.2, -0.36, 1.15); box(0.15, 0.65, 0.2, 0.36, 1.15); box(0.28, 0.28, 0.28, 0, 1.75, '#ddd');
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d')!;
    x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(0, 0, 256, 64); x.fillStyle = '#fff'; x.font = '36px system-ui'; x.textAlign = 'center'; x.fillText(name, 128, 44);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false })); s.scale.set(2, 0.5, 1); s.position.y = 2.4; g.add(s);
    return g;
  }
  setBall(e: Ent, b: BallState) { e.ball = b; e.ballMesh.position.copy(V(b.x, 0.22, b.z)); e.ballMesh.visible = !b.holedOut; }
  placeGolfer(e: Ent, x: number, z: number, yawRad: number) { e.golfer.position.copy(V(x, 0, z)); e.golfer.rotation.y = -yawRad; }

  shot(m: Extract<ServerMsg, { t: 'shotResult' }>) {
    const e = this.ents.get(m.playerId); if (!e || m.samples.length < 2) return;
    e.hole = m.hole;
    const prev = e.ball, first = m.samples[0]!.p, last = m.samples[m.samples.length - 1]!.p;
    let pts = m.samples.map(s => ({ x: s.p.x, y: s.p.y, z: s.p.z }));
    // Samples are documented as local-frame (origin, heading +z). If so, rotate+translate onto the world.
    if (Math.hypot(first.x, first.z) < 0.01 && Math.hypot(prev.x, prev.z) > 1) {
      const a = Math.atan2(m.ball.x - prev.x, m.ball.z - prev.z) - Math.atan2(last.x, last.z), c = Math.cos(a), s = Math.sin(a);
      pts = pts.map(p => ({ x: prev.x + p.x * c + p.z * s, y: p.y, z: prev.z - p.x * s + p.z * c }));
    }
    const vs = pts.map(p => V(p.x, p.y + 0.22, p.z));
    if (e.tracer) this.scene.remove(e.tracer);
    e.tracer = new THREE.Line(new THREE.BufferGeometry().setFromPoints(vs), new THREE.LineBasicMaterial({ color: e.shade }));
    e.tracer.geometry.setDrawRange(0, 1); e.tracer.frustumCulled = false; this.scene.add(e.tracer);
    e.anim = { pts: vs, ts: m.samples.map(s => s.t), t0: performance.now(), final: m.ball };
    e.ball = { ...e.ball, strokes: m.ball.strokes };
  }
  tick(now: number) {
    for (const e of this.ents.values()) {
      const a = e.anim; if (!a) continue;
      const t = (now - a.t0) / 1000;
      let i = a.ts.findIndex(x => x > t);
      if (i < 0) { e.anim = undefined; this.setBall(e, a.final); e.tracer?.geometry.setDrawRange(0, a.pts.length); continue; }
      i = Math.max(1, i);
      const k = Math.min(1, Math.max(0, (t - a.ts[i - 1]!) / ((a.ts[i]! - a.ts[i - 1]!) || 1)));
      e.ballMesh.position.lerpVectors(a.pts[i - 1]!, a.pts[i]!, k); e.ballMesh.visible = true;
      e.tracer!.geometry.setDrawRange(0, i + 1);
    }
    for (const e of this.ents.values()) { // only players on my hole are drawn
      if (e.hole !== this.myHole) { e.hid = true; e.golfer.visible = false; e.ballMesh.visible = false; if (e.tracer) e.tracer.visible = false; }
      else if (e.hid) { e.hid = false; e.golfer.visible = true; e.ballMesh.visible = !e.ball.holedOut || !!e.anim; if (e.tracer) e.tracer.visible = true; }
    }
  }
  render(x: number, z: number, yaw: number, pitch: number, y = 1.5) {
    const dist = y > 1.5 ? 25 : 6.5, f = [Math.sin(yaw), Math.cos(yaw)] as const;
    const target = V(x, y, z);
    this.cam.position.copy(V(x - f[0] * dist * Math.cos(pitch), y + dist * Math.sin(pitch), z - f[1] * dist * Math.cos(pitch)));
    this.cam.lookAt(target); this.renderer.render(this.scene, this.cam);
  }
}
