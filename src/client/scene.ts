import * as THREE from 'three';
import type { BallState, CartState, HoleInfo, Mover, PlayerRace, ServerMsg } from '../shared/protocol';
import { cartSpawn, forwardSpeed } from '../shared/cart';
import { makeCart, poseCart, type CartView } from './cartmodel';
import { isCoastal, propSpots, setTurf, terrainMesh } from './terrain';
import { SPEC, type Tier } from './graphics';
import { dropTurf, loadTurf, type Turf } from './turf';
import { Grass } from './grass';
import { loadModel, type PropSpot } from './assets';
import { makeProp } from './props';
import { toMarker, type Marker } from './overlay';

const SHADES = ['#D64545', '#3F6FD6', '#E8C23A', '#EDEDED']; // player colourways (assets/STYLE.md)
export interface Ent {
  id: string; name: string; shade: string; ball: BallState; hole: number; done: boolean;
  golfer: THREE.Group; ballMesh: THREE.Mesh; tracer?: THREE.Line; hid?: boolean;
  anim?: { pts: THREE.Vector3[]; ts: number[]; t0: number; final: BallState };
  /** the cart (PRD/07): its view, the drawn state, the spawn slot; `driving` hides the golfer; `remote` is the last server report for others */
  cart: CartView; cs: CartState; slot: number; driving: boolean; remote?: Mover;
}
// Sim space is left-handed (x right, z forward); three is right-handed, so mirror x.
const V = (x: number, y: number, z: number) => new THREE.Vector3(-x, y, z);
/** Golfer-to-ball distance (m) under which your ball's beacon is hidden. */
const BEACON_HIDE_M = 15;

export class World {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(60, 1, 0.1, 2000);
  ents = new Map<string, Ent>();
  /** hole (0-based) the local player is on: other players' balls, golfers and tracers on other holes are hidden */
  myHole = 0;
  private course = new THREE.Group();
  private props = new THREE.Group();
  /** id of the local player: their ball gets a yellow beacon and a screen marker */
  selfId = '';
  private beacon = (() => {
    const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: '#ffe14d', transparent: true, opacity: 0.75, depthTest: false });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 14, 8).translate(0, 7, 0), m), tip = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.4, 10).rotateX(Math.PI).translate(0, 15, 0), m);
    beam.renderOrder = tip.renderOrder = 20; g.add(beam, tip); g.visible = false; return g;
  })();
  private propToken = 0;
  private pinTop = new THREE.Vector3();
  private fog = new THREE.Fog('#cfe6f4', 220, 900);
  private sun = new THREE.DirectionalLight('#ffffff', 1.5);
  private grass = new Grass(this.scene);
  private terrain: THREE.Mesh | null = null;
  private spots: PropSpot[] = [];
  /** current graphics tier (graphics.ts SPEC); the turf promise is for this tier's texture size */
  tier: Tier;
  private turf: Promise<Turf | null>;
  private tmpA = new THREE.Vector3(); private tmpB = new THREE.Vector3();
  constructor(canvas: HTMLCanvasElement, tier: Tier) {
    this.tier = tier; this.turf = loadTurf(tier);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: SPEC[tier].antialias });   // MSAA is fixed per WebGL context: applies from the next load
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene.background = new THREE.Color('#cfe6f4'); this.scene.fog = this.fog;
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#6b7b6b', 1.9), this.course, this.props, this.beacon);
    // the sun's shadow box (90 m) follows the player; sun.position/target are moved in render()
    const sc = this.sun.shadow.camera; sc.left = sc.bottom = -45; sc.right = sc.top = 45; sc.near = 1; sc.far = 320;
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);
    const resize = () => { this.renderer.setSize(innerWidth, innerHeight); this.cam.aspect = innerWidth / innerHeight; this.cam.updateProjectionMatrix(); };
    addEventListener('resize', resize); resize();
    this.applyTier(tier, true);
  }
  /** Applies a graphics tier live: pixel ratio, shadows, fog and draw distance, grass, foliage density and the turf texture size. */
  applyTier(t: Tier, first = false) {
    const s = SPEC[t], prev = SPEC[this.tier]; this.tier = t;
    this.renderer.setPixelRatio(s.pixelRatio(devicePixelRatio));
    this.sun.castShadow = s.shadow > 0;
    if (s.shadow && this.sun.shadow.mapSize.x !== s.shadow) { this.sun.shadow.mapSize.set(s.shadow, s.shadow); this.sun.shadow.map?.dispose(); this.sun.shadow.map = null; }
    this.sun.shadow.radius = t === 'ultra' ? 3 : 1;
    this.fog.near = s.fogNear; this.fog.far = s.fogFar; this.cam.far = s.far; this.cam.updateProjectionMatrix();
    this.grass.configure(s.grassM, s.grassSpacing);
    if (first) return;
    if (s.tex !== prev.tex) {
      const p = loadTurf(t), old = prev.tex; this.turf = p;
      void p.then(tf => { if (!tf || this.turf !== p) return; if (this.terrain) setTurf(this.terrain, tf, s.detail); dropTurf(old); });
    } else if (s.detail !== prev.detail && this.terrain) void this.turf.then(tf => { if (tf && this.terrain) setTurf(this.terrain, tf, s.detail); });
    if (s.foliage !== prev.foliage) void this.setProps(this.spots);
  }
  private mat = (c: string) => new THREE.MeshLambertMaterial({ color: c });
  private band(w: number, l: number, cx: number, cz: number, rotY: number, y: number, c: string) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l).rotateX(-Math.PI / 2), this.mat(c));
    m.position.set(cx, y, cz); m.rotation.y = rotY; this.course.add(m); return m;
  }
  load(h: HoleInfo, players: PlayerRace[]) {
    for (const e of this.ents.values()) this.scene.remove(e.golfer, e.ballMesh, e.cart.root, ...(e.tracer ? [e.tracer] : [])); this.ents.clear();
    this.buildCourse(h); this.myHole = h.index;
    const rot = Math.atan2(-(h.pin.x - h.tee.x), h.pin.z - h.tee.z);
    players.forEach((p, i) => {
      const shade = SHADES[i % 4]!;
      const e: Ent = { id: p.id, name: p.name, shade, ball: p.ball, hole: p.hole, done: p.ball.holedOut, golfer: this.makeGolfer(shade, p.name), ballMesh: new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), this.mat('#ffffff')),
        cart: makeCart(shade), cs: cartSpawn(p.hole, i), slot: i, driving: false };
      e.ballMesh.castShadow = true;
      this.scene.add(e.golfer, e.ballMesh, e.cart.root); this.ents.set(p.id, e); this.setBall(e, p.ball); this.placeCart(e, e.cs, 0, 0);
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
    e.driving = false; e.remote = undefined; this.placeCart(e, cartSpawn(hole, e.slot), 0, 0);   // the cart comes to the new tee too
  }
  /** Draws a cart state: position, heading, wheel spin and front-wheel lock. */
  placeCart(e: Ent, s: CartState, steer: number, dt: number) {
    e.cs = s; e.cart.root.position.copy(V(s.x, 0, s.z)); e.cart.root.rotation.y = -s.yaw;
    poseCart(e.cart, forwardSpeed(s), steer, dt);
  }
  /** Another player's latest report; tick() eases their golfer and cart toward it. */
  remote(m: Mover) { const e = this.ents.get(m.id); if (e && m.id !== this.selfId && m.hole === e.hole) { e.remote = m; e.driving = m.driving; } }
  /** Rebuilds the terrain for a hole without touching the players. */
  buildCourse(h: HoleInfo) {
    this.course.clear();
    const base = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), this.mat(isCoastal(h.index) ? '#3f86bd' : '#265c34'));
    base.position.y = -1; // well below the terrain: shallow depth buffers (software GL) z-fight at a few centimetres
    this.terrain = terrainMesh(h, this.turf, SPEC[this.tier].detail);
    this.course.add(base, this.terrain);
    const pin = V(h.pin.x, 0, h.pin.z); this.pinTop.set(pin.x, 2.6, pin.z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6), this.mat('#eee')); pole.position.set(pin.x, 1.2, pin.z);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), new THREE.MeshLambertMaterial({ color: '#e8c23a', side: THREE.DoubleSide })); flag.position.set(pin.x + 0.45, 2.1, pin.z);
    pole.castShadow = flag.castShadow = true;
    this.course.add(pole, flag);
    this.spots = propSpots(h.index);
    void this.setProps(this.spots);
  }

  /** Places generated trees and rocks (cheap clones of cached models); kinds that fail to load are skipped. */
  async setProps(spots: PropSpot[]) {
    const token = ++this.propToken, f = SPEC[this.tier].foliage;
    spots = spots.filter((_, i) => (i * 0.618034) % 1 < f);   // golden-ratio thinning: an even spread at any density
    this.props.clear();
    const ids = { cypress: ['tree-cypress-a', 'tree-cypress-b'], pine: ['tree-pine-a'], rock: ['rock-a', 'rock-b', 'rock-c'] } as const;
    let i = 0;
    for (const s of spots.slice(0, 180)) {
      const list = ids[s.kind], m = (await loadModel(list[i % list.length]!)) ?? makeProp(s.kind, i); // a generated model if it passed QA, else the code-built prop
      i++;
      if (token !== this.propToken) return;                      // a newer hole replaced this request
      m.position.copy(V(s.x, 0, s.z)); m.scale.setScalar(s.scale); m.rotation.y = s.rotY; m.traverse(o => { o.castShadow = true; }); this.props.add(m);
    }
  }
  private makeGolfer(shade: string, name: string) {
    const g = new THREE.Group(), box = (w: number, h: number, d: number, x: number, y: number, c = shade) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.mat(c)); m.position.set(x, y, 0); g.add(m);
    };
    box(0.22, 0.85, 0.25, -0.13, 0.43, '#333'); box(0.22, 0.85, 0.25, 0.13, 0.43, '#333'); box(0.55, 0.7, 0.3, 0, 1.2); box(0.15, 0.65, 0.2, -0.36, 1.15); box(0.15, 0.65, 0.2, 0.36, 1.15); box(0.28, 0.28, 0.28, 0, 1.75, '#ddd');
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d')!;
    x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(0, 0, 256, 64); x.fillStyle = '#fff'; x.font = '36px system-ui'; x.textAlign = 'center'; x.fillText(name, 128, 44);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false })); s.scale.set(2, 0.5, 1); s.position.y = 2.4; g.add(s);
    // swap the box stand-in for the generated golfer when it loads (the stand-in is the fallback); a disc in the player's colour sits under the feet
    void loadModel('golfer').then(model => {
      if (!model) return;
      for (const ch of [...g.children]) if (ch !== s) g.remove(ch);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.7, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: shade })); disc.position.y = 0.03;
      model.traverse(o => { o.castShadow = true; });
      g.add(model, disc);
    });
    g.traverse(o => { if (o instanceof THREE.Mesh) o.castShadow = true; });
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
  /** Screen position (px) of the local ball for the edge arrow: onScreen is false when it is off screen or behind the camera. */
  ballScreen(): { x: number; y: number; onScreen: boolean; dir: number } | null {
    const e = this.ents.get(this.selfId); if (!e || e.ball.holedOut && !e.anim) return null;
    const v = e.ballMesh.position.clone().setY(2).project(this.cam), behind = v.z > 1;
    const x = (v.x * 0.5 + 0.5) * innerWidth, y = (-v.y * 0.5 + 0.5) * innerHeight, onScreen = !behind && x > 20 && x < innerWidth - 20 && y > 20 && y < innerHeight - 20;
    return { x, y, onScreen, dir: Math.atan2((behind ? -1 : 1) * (y - innerHeight / 2), (behind ? -1 : 1) * (x - innerWidth / 2)) };
  }
  /** Screen marker for the pin (flag top), for the pin indicator. */
  pinScreen(): Marker { const v = this.pinTop.clone().project(this.cam); return toMarker(v.x, v.y, v.z > 1, innerWidth, innerHeight); }
  private lastTick = 0;
  /** Set by the client each frame: how far the local golfer stands from their own ball, metres. */
  ownBallDistM = Infinity;
  tick(now: number) {
    const dt = this.lastTick ? Math.min(0.1, (now - this.lastTick) / 1000) : 0; this.lastTick = now;
    const k = 1 - Math.exp(-10 * dt);                                     // frame-rate independent easing toward the 10 Hz reports
    for (const e of this.ents.values()) {
      const r = e.remote; if (!r) continue;
      const c = e.cs, dyaw = Math.atan2(Math.sin(r.cart.yaw - c.yaw), Math.cos(r.cart.yaw - c.yaw));
      this.placeCart(e, { x: c.x + (r.cart.x - c.x) * k, z: c.z + (r.cart.z - c.z) * k, yaw: c.yaw + dyaw * k, vx: r.cart.vx, vz: r.cart.vz }, Math.max(-1, Math.min(1, dyaw * 4)), dt);
      const g = e.golfer.position; g.x += (-r.x - g.x) * k; g.z += (r.z - g.z) * k; e.golfer.rotation.y = -r.yaw;
    }
    const own = this.ents.get(this.selfId);
    // Hidden once you're at your ball: up close the tall beacon read as an aim line, which the owner ruled out.
    const near = !!own && !own.anim && this.ownBallDistM < BEACON_HIDE_M;
    this.beacon.visible = !!own && (!own.ball.holedOut || !!own.anim) && own.hole === this.myHole && !near;
    if (own) this.beacon.position.set(own.ballMesh.position.x, 0, own.ballMesh.position.z);
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
      e.cart.root.visible = !e.hid; if (!e.hid) e.golfer.visible = !e.driving;   // shortcut: the driver is hidden in the cart rather than seated; add a seated pose if it matters
    }
  }
  render(x: number, z: number, yaw: number, pitch: number, y = 1.5, dist = y > 1.5 ? 25 : 8) {
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const target = this.tmpA.set(-x, y, z);
    this.cam.position.set(-(x - fx * dist * Math.cos(pitch)), y + dist * Math.sin(pitch), z - fz * dist * Math.cos(pitch));
    this.cam.lookAt(target);
    if (this.sun.castShadow) {   // shadow box centred on the player, snapped to whole texels so edges do not shimmer
      const snap = 90 / this.sun.shadow.mapSize.x, c = this.tmpB.set(Math.round(target.x / snap) * snap, 0, Math.round(target.z / snap) * snap);
      this.sun.target.position.copy(c); this.sun.position.set(c.x + 50, 100, c.z + 30); this.sun.target.updateMatrixWorld();
    }
    this.grass.update(this.myHole, this.cam.position.x, this.cam.position.z, performance.now() / 1000);
    this.renderer.render(this.scene, this.cam);
  }
}
