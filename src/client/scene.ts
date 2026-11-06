import * as THREE from 'three';
import { BALL_VISUAL_RADIUS_M, CUP_VISUAL_RADIUS_M } from '../sim/physics';
import type { BallState, CartState, HoleInfo, Mover, PlayerRace, ServerMsg } from '../shared/protocol';
import { cartSpawn, forwardSpeed } from '../shared/cart';
import { makeCart, poseCart, type CartView } from './cartmodel';
import { ground, groundNormal, isCoastal, propSpots, seaField, seaY, setTurf, terrainMesh } from './terrain';
import { GRIDS } from '../shared/course-grid';
import { hole as courseHole } from '../server/course';
const holeInfo = (i: number) => courseHole(i).info;
import { SPEC, type Tier } from './graphics';
import { dropTurf, loadTurf, type Turf } from './turf';
import { Grass } from './grass';
import { loadModel, type PropSpot } from './assets';
import { makeProp } from './props';
import { toMarker, type Marker } from './overlay';
import { fogDensity, makeEnvironment, SUN_DIR } from './environment';
import { makeOcean } from './ocean';
import { makeFescue } from './fescue';
import { buildingTrees, makeBackdrop, makeBuildings, makeCliffs, shorePieces, shoreRockSpots } from './coast';
import { GolferRig, hasRig, smoothShading } from './golferrig';
import { addressPoint, backswingPose, gaitCadence, gaitPose, idlePose, lerpPose, puttPose, releasePose, seatedPose, type Pose } from './golferanim';
import { CLUBS, clubMatrix, loadClub, makeCodeClub } from './clubs';

/** How a golfer is drawn and animated: the rigged model once it passes QA (else the box stand-in), the club in hand, and the swing state. */
interface Look {
  rig?: GolferRig; model?: THREE.Object3D; holder?: THREE.Group; box: THREE.Group;
  club?: THREE.Object3D; clubIdx: number; clubToken: number;
  cur?: Pose; walk: number; last: THREE.Vector3; speed: number;
  /** what the golfer is doing, and a cross-fade from `from` (frozen) when that changes, started at `fade` (ms) */
  mode?: 'gait' | 'stance' | 'rel' | 'seat'; from?: Pose; fade?: number;
  /** the local player's stance/backswing this frame (set by the client) */
  stance?: { depth: number; putt: boolean };
  /** a released swing playing out: started at t0 (ms), from `depth`, standing at the ball spot `at` facing `rotY` */
  rel?: { t0: number; depth: number; putt: boolean; at: THREE.Vector3; rotY: number };
}
const DEFAULT_CLUB = 6;   // 7-iron in other players' hands (their club choice is not sent)
const BOX_GRIP = clubMatrix([-0.36, 0.83, 0.12], [0, -0.62, 0.78], [0, 0, 1]);   // the box stand-in's right hand

const SHADES = ['#D64545', '#3F6FD6', '#E8C23A', '#EDEDED']; // player colourways (assets/STYLE.md)
export interface Ent {
  id: string; name: string; shade: string; ball: BallState; hole: number; done: boolean;
  golfer: THREE.Group; look: Look; ballMesh: THREE.Mesh; tracer?: THREE.Line; hid?: boolean;
  anim?: { pts: THREE.Vector3[]; ts: number[]; t0: number; final: BallState };
  /** the cart (PRD/07): its view, the drawn state, the spawn slot; `driving` hides the golfer; `remote` is the last server report for others */
  cart: CartView; cs: CartState; slot: number; driving: boolean; remote?: Mover;
  /** the steering input last drawn on the cart (-1 left .. 1 right), for the seated driver's hands */
  steer?: number;
}
// Sim space is left-handed (x right, z forward); three is right-handed, so mirror x.
const V = (x: number, y: number, z: number) => new THREE.Vector3(-x, y, z);
const UP = new THREE.Vector3(0, 1, 0);
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
  private propToken = 0; private propHole = 0;
  private pinTop = new THREE.Vector3();
  private fog: THREE.FogExp2;
  private sun: THREE.DirectionalLight;
  private grass = new Grass(this.scene);
  private terrain: THREE.Mesh | null = null;
  private spots: PropSpot[] = [];
  /** current graphics tier (graphics.ts SPEC); the turf promise is for this tier's texture size */
  tier: Tier;
  private turf: Promise<Turf | null>;
  private tmpA = new THREE.Vector3(); private tmpB = new THREE.Vector3(); private tmpQ = new THREE.Quaternion(); private tmpQ2 = new THREE.Quaternion();
  /** Ground height at sim (x, z) on a hole (default: the one I am on). */
  groundAt(x: number, z: number, hole = this.myHole) { return ground(hole, x, z); }
  /** A three-space point standing on the ground of `hole` at sim (x, z), lifted by `dy`. */
  private onGround(hole: number, x: number, z: number, dy = 0) { return V(x, ground(hole, x, z) + dy, z); }
  constructor(canvas: HTMLCanvasElement, tier: Tier) {
    this.tier = tier; this.turf = loadTurf(tier);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: SPEC[tier].antialias });   // MSAA is fixed per WebGL context: applies from the next load
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    const env = makeEnvironment(this.renderer, this.scene); this.sun = env.sun; this.fog = env.fog;   // sky, sun, haze, ACES (environment.ts)
    this.scene.add(this.course, this.props, this.beacon);
    // the sun's shadow box (90 m) follows the player; sun.position/target are moved in render()
    const sc = this.sun.shadow.camera; sc.left = sc.bottom = -45; sc.right = sc.top = 45; sc.near = 1; sc.far = 320;
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.04;
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
    this.fog.density = fogDensity(s.fogFar); this.cam.far = s.far; this.cam.updateProjectionMatrix();
    this.grass.configure(s.grassM, s.grassSpacing);
    if (first) return;
    if (s.tex !== prev.tex) {
      const p = loadTurf(t), old = prev.tex; this.turf = p;
      void p.then(tf => { if (!tf || this.turf !== p) return; if (this.terrain) setTurf(this.terrain, tf, s.detail); dropTurf(old); });
    } else if (s.detail !== prev.detail && this.terrain) void this.turf.then(tf => { if (tf && this.terrain) setTurf(this.terrain, tf, s.detail); });
    if (s.foliage !== prev.foliage) void this.setProps(this.spots);
  }
  private mat = (c: string) => new THREE.MeshLambertMaterial({ color: c });
  /** Ground beyond the traced map: dark rough-and-pine green, cut away over the sea (same field as the terrain) so the ocean shows. */
  private landBeyond(hole: number) {
    const m = new THREE.MeshLambertMaterial({ color: '#33422a' }), f = seaField(hole); if (!isCoastal(hole) || !f.any) return m;
    const g = GRIDS[hole]!;
    m.onBeforeCompile = sh => {
      sh.uniforms.uSea = { value: f.tex }; sh.uniforms.uGrid = { value: new THREE.Vector4(g.x0, g.z0, 1 / (g.nx * g.cell), 1 / (g.nz * g.cell)) };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vWxz;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWxz = (modelMatrix * vec4(position, 1.0)).xz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vWxz; uniform sampler2D uSea; uniform vec4 uGrid;')
        .replace('#include <map_fragment>', '#include <map_fragment>\nif (textureLod(uSea, (vec2(-vWxz.x, vWxz.y) - uGrid.xy) * uGrid.zw, 0.0).r > 0.5) discard;');
    };
    return m;
  }
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
      const look = this.makeGolfer(shade, p.name);
      const e: Ent = { id: p.id, name: p.name, shade, ball: p.ball, hole: p.hole, done: p.ball.holedOut, golfer: look.g, look: look.look, ballMesh: new THREE.Mesh(new THREE.SphereGeometry(BALL_VISUAL_RADIUS_M, 12, 8), this.mat('#ffffff')),
        cart: makeCart(shade), cs: cartSpawn(p.hole, i), slot: i, driving: false };
      e.ballMesh.castShadow = true;
      this.scene.add(e.golfer, e.ballMesh, e.cart.root); this.ents.set(p.id, e); this.setBall(e, p.ball); this.placeCart(e, e.cs, 0, 0);
      e.golfer.position.copy(this.onGround(p.hole, p.ball.x + 1, p.ball.z - 0.5)); e.golfer.rotation.y = rot;
    });
  }
  /** Puts a player on the tee of a hole (after their hole-out): ball reset, tracer and replay cleared. */
  moveTo(id: string, ball: BallState, hole: number) {
    const e = this.ents.get(id); if (!e) return;
    e.hole = hole; e.done = false; e.anim = undefined;
    if (e.tracer) { this.scene.remove(e.tracer); e.tracer = undefined; }
    this.setBall(e, ball);
    e.golfer.position.copy(this.onGround(hole, ball.x + 1, ball.z - 0.5));
    e.driving = false; e.remote = undefined; this.placeCart(e, cartSpawn(hole, e.slot), 0, 0);   // the cart comes to the new tee too
  }
  /** Draws a cart state: position, heading, wheel spin and front-wheel lock. */
  placeCart(e: Ent, s: CartState, steer: number, dt: number) {
    e.cs = s; e.steer = steer; e.cart.root.position.copy(this.onGround(e.hole, s.x, s.z));
    const n = groundNormal(e.hole, s.x, s.z), q = this.tmpQ.setFromUnitVectors(UP, this.tmpA.set(-n.x, n.y, n.z));   // the cart follows the ground's tilt
    e.cart.root.quaternion.copy(q).multiply(this.tmpQ2.setFromAxisAngle(UP, -s.yaw));
    poseCart(e.cart, forwardSpeed(s), steer, dt);
  }
  /** Another player's latest report; tick() eases their golfer and cart toward it. */
  remote(m: Mover) { const e = this.ents.get(m.id); if (e && m.id !== this.selfId && m.hole === e.hole) { e.remote = m; e.driving = m.driving; } }
  /** Rebuilds the terrain for a hole without touching the players. */
  private courseToken = 0;
  buildCourse(h: HoleInfo) {
    this.course.clear(); this.courseToken++;
    const base = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), this.landBeyond(h.index));
    base.position.y = seaY(h.index) - 0.6; // just under sea level (the ocean covers it on coastal holes): shallow depth buffers z-fight at a few centimetres
    this.terrain = terrainMesh(h, this.turf, SPEC[this.tier].detail);
    this.course.add(base, this.terrain);
    // the coast (ocean.ts, coast.ts): water at the real sea level, cliffs or the 18th sea wall from the turf edge down to it, the far shore and the buildings behind 18
    for (const o of [makeOcean(h.index), makeCliffs(h.index), makeBackdrop(h.index, SPEC[this.tier].far), makeBuildings(h.index, h.pin.z), makeFescue(h.index, this.tier === 'low' ? 0 : this.tier === 'medium' ? 3 : 6)]) if (o) this.course.add(o);
    const pin = this.onGround(h.index, h.pin.x, h.pin.z); this.pinTop.set(pin.x, pin.y + 2.6, pin.z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6), this.mat('#eee')); pole.position.set(pin.x, pin.y + 1.2, pin.z);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), new THREE.MeshLambertMaterial({ color: '#e8c23a', side: THREE.DoubleSide })); flag.position.set(pin.x + 0.45, pin.y + 2.1, pin.z);
    pole.castShadow = flag.castShadow = true;
    // the cup, drawn at the same scale as the ball (CUP_VISUAL_RADIUS_M): its rim is exactly the server's capture hitbox
    const cup = new THREE.Mesh(new THREE.CircleGeometry(CUP_VISUAL_RADIUS_M, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#0d0f0c', polygonOffset: true, polygonOffsetFactor: -2 }));
    const rim = new THREE.Mesh(new THREE.RingGeometry(CUP_VISUAL_RADIUS_M, CUP_VISUAL_RADIUS_M * 1.06, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#f2f2ee', polygonOffset: true, polygonOffsetFactor: -2 }));
    cup.position.set(pin.x, pin.y + 0.012, pin.z); rim.position.set(pin.x, pin.y + 0.013, pin.z);
    this.course.add(pole, flag, cup, rim);
    void this.placeShorePieces(h.index);
    this.spots = [...propSpots(h.index), ...buildingTrees(h.index, h.pin.z), ...(isCoastal(h.index) ? shoreRockSpots(h.index).map(r => ({ kind: 'rock' as const, ...r, y: seaY(h.index) - 0.6 })) : [])];
    this.propHole = h.index;
    void this.setProps(this.spots);
  }

  /** Places the trees and rocks as one InstancedMesh per model part (a generated model if its row passed QA, else the code-built prop),
   *  plus boulders along the shore at sea level. Kinds that fail to load fall back to the code props. */
  async setProps(spots: PropSpot[]) {
    const token = ++this.propToken, f = SPEC[this.tier].foliage;
    spots = spots.filter((_, i) => (i * 0.618034) % 1 < f);   // golden-ratio thinning: an even spread at any density
    const ids = { cypress: ['tree-cypress-r1', 'tree-cypress-r2', 'tree-cypress-r3'], pine: ['tree-pine-r1'], rock: ['rock-r1', 'rock-r2', 'rock-r3', 'rock-r4'] } as const;
    // one batch per model and 80 m tile, so the camera and the 90 m shadow box cull the far batches (an M1 Air keeps 60 fps on Medium)
    const groups = new Map<string, { id: string; kind: PropSpot['kind']; v: number; list: PropSpot[] }>();
    spots.slice(0, 220).forEach((s, i) => { const l = ids[s.kind], v = i % l.length, id = l[v]!, k = `${id}:${Math.floor(s.x / 80)}:${Math.floor(s.z / 80)}`; (groups.get(k) ?? groups.set(k, { id, kind: s.kind, v, list: [] }).get(k)!).list.push(s); });
    const built: THREE.Object3D[] = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (const gr of groups.values()) {
      const id = gr.id, model = await loadModel(id), tpl = model ?? makeProp(gr.kind, gr.v);
      if (token !== this.propToken) return;                      // a newer hole replaced this request
      tpl.updateMatrixWorld(true);
      // grade generated textures (not the code-built props' palette colours) toward the photo swatches (pebble-look.md): near-black cypress greens, grey granite, not the brighter Rodin bake
      if (model) tpl.traverse(o => { const mt = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (mt?.color) { mt.color.set(id.startsWith('tree') ? '#c9d2bb' : '#b8b5ad'); mt.roughness = 0.95; mt.metalness = 0; mt.side = THREE.DoubleSide; } });
      tpl.traverse(o => {
        const mesh = o as THREE.Mesh; if (!mesh.isMesh) return;
        const im = new THREE.InstancedMesh(mesh.geometry, mesh.material, gr.list.length);
        // on the real ground, sunk a little so trunks on a slope do not float; shore boulders carry their own y (sea level)
        gr.list.forEach((s, j) => im.setMatrixAt(j, m.compose(p.copy(V(s.x, s.y ?? ground(this.propHole, s.x, s.z) - 0.15, s.z)), q.setFromAxisAngle(up, s.rotY), sc.setScalar(s.scale)).multiply(mesh.matrixWorld)));
        im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); built.push(im);
      });
    }
    this.props.clear(); this.props.add(...built);
  }
  /** Generated coast pieces (shown once their rows pass QA): sea-wall sections along 18, cliff blocks at the foot of the tall cliffs. */
  private async placeShorePieces(hole: number) {
    const wall = hole === 17, y = seaY(hole); if (!isCoastal(hole)) return;
    const token = this.courseToken, course = this.course, id = wall ? 'seawall-r1' : 'cliff-r1', model = await loadModel(id);
    if (!model || token !== this.courseToken) return;   // a newer hole was built meanwhile
    // cliff blocks only where the real cliff is over 8 m
    const spots = wall ? shorePieces(hole, 7, 0.6) : shorePieces(hole, 26, 2.5).filter(s => s.top - y > 8), m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    if (!spots.length) return;
    model.updateMatrixWorld(true);
    model.traverse(o => {
      const mesh = o as THREE.Mesh; if (!mesh.isMesh) return;
      const im = new THREE.InstancedMesh(mesh.geometry, mesh.material, spots.length);
      // the wall section's top sits at the turf beside it; cliff blocks stand in the water, scaled to the local cliff height, tops just below the turf
      spots.forEach((s, j) => { const sc = wall ? 1 : (s.top - y + 2) / 12; im.setMatrixAt(j, m.compose(V(s.x, wall ? s.top - 3 : y - 2, s.z), q.setFromAxisAngle(up, -s.yaw + (wall ? 0 : j * 1.3)), new THREE.Vector3(sc * (wall ? 1.1 : 1), sc, sc)).multiply(mesh.matrixWorld)); });
      im.receiveShadow = true; im.computeBoundingSphere(); course.add(im);
    });
  }
  private makeGolfer(shade: string, name: string) {
    const g = new THREE.Group(), box = new THREE.Group(), part = (w: number, h: number, d: number, x: number, y: number, c = shade) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.mat(c)); m.position.set(x, y, 0); box.add(m);
    };
    part(0.22, 0.85, 0.25, -0.13, 0.43, '#333'); part(0.22, 0.85, 0.25, 0.13, 0.43, '#333'); part(0.55, 0.7, 0.3, 0, 1.2); part(0.15, 0.65, 0.2, -0.36, 1.15); part(0.15, 0.65, 0.2, 0.36, 1.15); part(0.28, 0.28, 0.28, 0, 1.75, '#ddd');
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d')!;
    x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(0, 0, 256, 64); x.fillStyle = '#fff'; x.font = '36px system-ui'; x.textAlign = 'center'; x.fillText(name, 128, 44);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false })); s.scale.set(2, 0.5, 1); s.position.y = 2.4;
    g.add(box, s);
    const look: Look = { box, clubIdx: -1, clubToken: 0, walk: 0, last: new THREE.Vector3(NaN, 0, 0), speed: 0 };
    this.setClubOn(look, DEFAULT_CLUB);
    // swap the box stand-in for the rigged golfer once its manifest row is PASS (the stand-in is the fallback), polo in the player's colour
    void loadModel('golfer').then(model => {
      if (!model || !hasRig(model)) return;
      smoothShading(model);   // polo stays the reference's white and gold (owner: fidelity to the character); players are told apart by name tag and map colour
      model.traverse(o => { o.castShadow = true; o.frustumCulled = false; });   // skinned: the bind-pose box does not follow the swing
      const holder = new THREE.Group(); holder.add(model);
      look.rig = new GolferRig(model); look.model = model; look.holder = holder;
      g.remove(box); g.add(holder);
      const idx = look.clubIdx; look.clubIdx = -1; this.setClubOn(look, idx);   // re-seat the club in the new hands
    });
    box.traverse(o => { if (o instanceof THREE.Mesh) o.castShadow = true; });
    return { g, look };
  }
  /** The club in a player's hands (BAG index): the code club at once, the generated one if it passes QA. */
  setClub(id: string, idx: number) { const e = this.ents.get(id); if (e) this.setClubOn(e.look, idx); }
  private setClubOn(look: Look, idx: number) {
    if (look.clubIdx === idx || !CLUBS[idx]) return;
    look.clubIdx = idx; const token = ++look.clubToken, spec = CLUBS[idx]!;
    const seat = (club: THREE.Object3D) => {
      look.club?.removeFromParent(); look.club = club; club.matrixAutoUpdate = false;
      if (look.model) look.model.add(club); else { club.matrix.copy(BOX_GRIP); look.box.add(club); }
    };
    seat(makeCodeClub(spec));
    void loadClub(spec).then(m => { if (m && token === look.clubToken) seat(m); });
  }
  /** The local player's stance this frame: backswing depth 0..1 (0 = address), or null when not in a stance. */
  setStance(id: string, s: { depth: number; putt: boolean } | null) { const e = this.ents.get(id); if (e) e.look.stance = s ?? undefined; }
  /** The swing was released: play the downswing, impact and finish from this depth at the ball. */
  release(id: string, depth: number, putt: boolean) {
    const e = this.ents.get(id); if (!e) return;
    e.look.rel = { t0: performance.now(), depth, putt, at: this.onGround(e.hole, e.ball.x, e.ball.z), rotY: e.golfer.rotation.y };
  }
  /** Poses one golfer for this frame: release > stance > walk/idle; in a stance or swing it stands at the ball. */
  private animate(e: Ent, now: number, dt: number) {
    const L = e.look, pos = e.golfer.position;
    if (e.driving && L.rig && L.model && L.holder) { this.seat(e, now); return; }
    if (L.mode === 'seat') { e.golfer.rotation.x = e.golfer.rotation.z = 0; L.last.set(NaN, 0, 0); L.speed = 0; if (L.club) L.club.visible = true; }
    if (Number.isFinite(L.last.x) && dt > 0) L.speed += (Math.hypot(pos.x - L.last.x, pos.z - L.last.z) / dt - L.speed) * (1 - Math.exp(-8 * dt));
    L.last.copy(pos);
    if (!L.rig || !L.model || !L.holder) return;
    const spec = CLUBS[L.clubIdx] ?? CLUBS[DEFAULT_CLUB]!;
    let target: Pose, at: THREE.Vector3 | null = null, putt = false, mode: Look['mode'];
    if (L.rel) {
      const r = releasePose(L.rel.depth, now - L.rel.t0, spec.length, L.rel.putt); target = r.pose; putt = L.rel.putt; mode = 'rel';
      if (r.done) L.rel = undefined; else { at = L.rel.at; e.golfer.rotation.y = L.rel.rotY; }
    } else if (L.stance) {
      putt = L.stance.putt; target = putt ? puttPose(-L.stance.depth, spec.length) : backswingPose(L.stance.depth, spec.length); at = this.onGround(e.hole, e.ball.x, e.ball.z); mode = 'stance';
    } else {
      // captured walk/jog/sprint, foot-locked to the speed; under 0.3 m/s the authored idle (breathing, weight shifts)
      L.walk += gaitCadence(L.speed) * dt; target = gaitPose(L.walk, L.speed, now / 1000); mode = 'gait';
    }
    L.cur = this.fade(L, mode, target, now);
    if (at) {   // address: target on the golfer's left, the club head at the ball
      pos.copy(at); const h = addressPoint(spec.length, putt);
      L.holder.rotation.y = -Math.PI / 2; L.holder.position.set(h[2], 0, -h[0]);   // Ry(-90°) takes the head point (x, z) to (-z, x); this cancels it
    } else { L.holder.rotation.y = 0; L.holder.position.set(0, 0, 0); }
    if (L.club) L.rig.apply(L.cur, L.club.matrix); else L.rig.apply(L.cur);
  }
  /** Cross-fades over 250 ms whenever the golfer's activity changes (run to stop, stop to address, out of the cart); within an
   *  activity the pose is exact, so planted feet do not slide and the captured swing plays as captured. */
  private fade(L: Look, mode: Look['mode'], target: Pose, now: number): Pose {
    if (L.mode !== mode) { if (L.cur) { L.from = L.cur; L.fade = now; } L.mode = mode; }
    if (!L.from || L.fade === undefined) return target;
    const k = (now - L.fade) / 250; if (k >= 1) { L.from = undefined; return target; }
    return lerpPose(L.from, target, k * k * (3 - 2 * k));
  }
  /** The driver sits in his cart: on the seat seam (it rides the sprung body's pitch and roll), hands on the wheel, club stowed. */
  private seat(e: Ent, now: number) {
    const L = e.look, s = e.cart.seat; s.updateWorldMatrix(true, false);
    s.getWorldPosition(e.golfer.position); s.getWorldQuaternion(e.golfer.quaternion);
    L.holder!.rotation.y = 0; L.holder!.position.set(0, -1.011, 0.028);   // the rig's rest hip point (golferrig rest Hips) onto the seat
    if (L.club) L.club.visible = false;
    L.cur = this.fade(L, 'seat', seatedPose(e.steer ?? 0), now);
    L.rig!.apply(L.cur);
  }
  setBall(e: Ent, b: BallState) { e.ball = b; e.ballMesh.position.copy(this.onGround(e.hole, b.x, b.z, 0.22)); e.ballMesh.visible = !b.holedOut; }
  placeGolfer(e: Ent, x: number, z: number, yawRad: number) { e.golfer.position.copy(this.onGround(e.hole, x, z)); e.golfer.rotation.y = -yawRad; }

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
      const g = e.golfer.position; g.x += (-r.x - g.x) * k; g.z += (r.z - g.z) * k; g.y = ground(e.hole, -g.x, g.z); e.golfer.rotation.y = -r.yaw;
    }
    const own = this.ents.get(this.selfId);
    // Hidden once you're at your ball: up close the tall beacon read as an aim line, which the owner ruled out.
    const near = !!own && !own.anim && this.ownBallDistM < BEACON_HIDE_M;
    this.beacon.visible = !!own && (!own.ball.holedOut || !!own.anim) && own.hole === this.myHole && !near;
    if (own) this.beacon.position.set(own.ballMesh.position.x, own.ballMesh.position.y - 0.22, own.ballMesh.position.z);
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
      e.cart.root.visible = !e.hid; if (!e.hid) e.golfer.visible = !e.driving || !!e.look.rig;   // the box stand-in cannot sit
      if (e.golfer.visible) this.animate(e, now, dt);
    }
  }
  /** QA camera (main.ts ?view=): builds hole `v[0]` (1-based) and looks from sim (v1, v2, v3) at (v4, v5, v6) with field of view v7; heights are above the ground there. */
  qaView(v: number[]) {
    const i = Math.max(0, Math.min(17, (v[0] ?? 1) - 1)), hl = holeInfo(i);
    this.buildCourse(hl); this.myHole = i;
    const ex = v[1] ?? 0, ez = v[3] ?? 0, tx = v[4] ?? 0, tz = v[6] ?? 100;
    this.cam.position.copy(V(ex, ground(i, ex, ez) + (v[2] ?? 1.6), ez)); this.cam.lookAt(V(tx, ground(i, tx, tz) + (v[5] ?? 1), tz));
    if (v[7]) { this.cam.fov = v[7]; this.cam.updateProjectionMatrix(); }
    this.qaTarget = this.tmpA.clone().copy(this.onGround(i, tx, tz));
  }
  private qaTarget = new THREE.Vector3();
  qaRender() {
    const c = this.qaTarget, mid = this.tmpB.copy(this.cam.position).lerp(c, 0.4); mid.y = c.y;
    if (this.sun.castShadow) { this.sun.target.position.copy(mid); this.sun.position.copy(mid).addScaledVector(SUN_DIR, 150); this.sun.target.updateMatrixWorld(); }
    this.grass.update(this.myHole, this.cam.position.x, this.cam.position.z, performance.now() / 1000);
    this.renderer.render(this.scene, this.cam);
  }
  /** Camera looking at sim (x, z) from `dist` behind along `yaw`; `y` is the eye height above the ground there. */
  render(x: number, z: number, yaw: number, pitch: number, y = 1.5, dist = y > 1.5 ? 25 : 8) {
    const fx = Math.sin(yaw), fz = Math.cos(yaw), gy = ground(this.myHole, x, z);
    const target = this.tmpA.set(-x, gy + y, z);
    const cx = x - fx * dist * Math.cos(pitch), cz = z - fz * dist * Math.cos(pitch);
    this.cam.position.set(-cx, Math.max(gy + y + dist * Math.sin(pitch), ground(this.myHole, cx, cz) + 1), cz);   // never inside a hill behind the player
    this.cam.lookAt(target);
    if (this.sun.castShadow) {   // shadow box centred on the player, snapped to whole texels so edges do not shimmer
      const snap = 90 / this.sun.shadow.mapSize.x, c = this.tmpB.set(Math.round(target.x / snap) * snap, Math.round(gy), Math.round(target.z / snap) * snap);
      this.sun.target.position.copy(c); this.sun.position.copy(c).addScaledVector(SUN_DIR, 150); this.sun.target.updateMatrixWorld();
    }
    this.grass.update(this.myHole, this.cam.position.x, this.cam.position.z, performance.now() / 1000);
    this.renderer.render(this.scene, this.cam);
  }
}
