import { SwingFSM, type Action } from './swingfsm';
import { GameAudio } from './audio';
import { isCoastal } from './terrain';
import { SKY_PRESETS, type SkyPreset } from './environment';
import type { HoleInfo, PlayerRace, ServerMsg } from '../shared/protocol';
import type { LobbyView } from '../server/lobby-types';
import { Net } from './net';
import { BAG, PUTTER, UI, YD, errText, scorecard } from './ui';
import { World } from './scene';
import { backswingDepth } from './golferanim';

import { canAddress, golferSpot, lookScale, moveAxis, walkSpeed } from './rules';
import { pinOpacity } from './overlay';
import { label as lookLabel, loadMult, lookDelta, requestLock, resetMult, saveMult, sliderValue, stepMult } from './sensitivity';
import { rfView } from './terrain';
import { TouchControls, pullToHoldMs, touchText } from './touch';
import { BAG as SIM_BAG, suggestClub } from '../sim';
import { asLie, lieInfo } from './lieinfo';
import { stanceSlope } from '../shared/height';
import { groundNormal } from './terrain';
import { COURSES, DEFAULT_COURSE, isCourseId, keyOf, type CourseId } from '../shared/courses';
import { CART, canEnter, cartGround, cartSpawn, exitSpot, forwardSpeed, stepCart } from '../shared/cart';
import type { CartState } from '../shared/protocol';
/** The Box Buggy (PRD/07): my cart's state, whether I am in it, and the chase camera (mouse orbit offset, smoothed yaw, bump shake). */
let cart: CartState = cartSpawn(0, 0), driving = false, mySlot = 0, orbit = 0, lastLook = 0, camYaw = 0, shake = 0, lastSend = 0;
import { Adaptive, TIER_LABEL, loadPref, pickTier, probeHardware, savePref, type Pref } from './graphics';
let lookMult = loadMult();
let rfOpen = false, rfTarget: { x: number; z: number } | null = null, rfHover: { x: number; z: number } | null = null;

let sessionId = sessionStorage.getItem('ace.sid') ?? crypto.randomUUID();
sessionStorage.setItem('ace.sid', sessionId);
let token = sessionStorage.getItem('ace.tok') ?? undefined;
let name = localStorage.getItem('ace.name') ?? '';
let welcomed = false, lobbies: LobbyView[] = [], lobby: LobbyView | null = null, error = '', count: number | null = null;
let phase: 'name' | 'menu' | 'race' | 'results' | 'down' = 'name';
/** The course for the next lobby I create (remembered); inside a lobby the host changes the lobby's course instead. */
let pick: CourseId = (() => { try { const v = localStorage.getItem('ace.course'); return isCourseId(v) ? v : DEFAULT_COURSE; } catch { return DEFAULT_COURSE; } })();

let hole: HoleInfo | null = null, selfId = '', goAt = 0, endAt = 0;
/** The live scorecard from the server (raceStart, then progress). */
let racers: PlayerRace[] = [];
let pos = { x: 0, z: 0 }, yaw = 0, pitch = 0.55, club = 0; // higher default camera so the golfer and ball both read at address
const keys = new Set<string>();
/** swing exists from the first Space press (stance, aim locked, WASD off) until the shot or putt is sent. */
type Swing = { fsm: SwingFSM; sentAt?: number };
let swing: Swing | null = null;
/** Applies a state-machine action: cancel, or send the shot/putt (the server decides every outcome). */
const audio = new GameAudio();
let holeStartStrokes = 0;
const act = (a: Action | null) => {
  if (!a || !swing) return;
  if (a.type === 'cancel') { swing = null; return; }
  net.send(a.msg); swing.sentAt = performance.now();
  world.release(selfId, backswingDepth(a.msg.holdMs), a.type === 'send-putt');   // the golfer plays the downswing and finish from this depth
  if (a.type === 'send-shot') { const L = a.msg.holdMs / 750; void audio.play(L < 0.4 ? 'sfx-swing-soft' : L < 0.85 ? 'sfx-swing-full' : 'sfx-swing-max', 0.7); }
};

// Graphics: Auto starts from the hardware and adapts to the frame rate; a manual pick overrides it (PRD/06 "Graphics presets").
const hw = probeHardware(), adapt = new Adaptive(pickTier(hw));
let gfxPref: Pref = loadPref();
const world = new World(document.body.appendChild(Object.assign(document.createElement('canvas'), { style: 'position:fixed;inset:0' })), gfxPref === 'auto' ? adapt.tier : gfxPref);
console.info('graphics:', hw.renderer ?? 'renderer masked', `max texture ${hw.maxTexture}`, `Auto picked ${adapt.tier}`);
(window as unknown as { __ace?: unknown }).__ace = { world }; // debug handle for browser checks
// QA camera for the realism side-by-sides (scripts/qa/realism-shots.mjs): ?view=hole,cx,cy,cz,tx,ty,tz[,fov] with the hole 1-based and
// positions in sim metres (x right, z from the tee toward the pin) draws that hole from there, with no race and no UI.
const qaView = new URLSearchParams(location.search).get('view')?.split(',').map(Number) ?? null;
if (qaView) { world.qaView(qaView); setTimeout(() => { for (const el of document.body.children) if (el.tagName !== 'CANVAS') (el as HTMLElement).style.display = 'none'; }, 50); }
const validName = (n: string) => n.trim().length >= 2 && n.trim().length <= 16;

const ui = new UI((a, d, form) => {
  error = '';
  if (a === 'name') {
    const v = form.querySelector<HTMLInputElement>('#nm')!.value.trim();
    if (!validName(v)) return ui.showName(v, 'Name must be 2 to 16 characters.');
    name = v; localStorage.setItem('ace.name', v); net.send({ t: 'hello', sessionId, name, token });
  } else if (a === 'create') net.send({ t: 'createLobby', course: pick });
  else if (a === 'course' && isCourseId(d.v)) {
    if (lobby) net.send({ t: 'setCourse', course: d.v });
    else { pick = d.v; try { localStorage.setItem('ace.course', pick); } catch { /* private mode: not remembered */ } menu(); }
  }
  else if (a === 'join') net.send({ t: 'joinLobby', lobbyId: d.id! });
  else if (a === 'leave') net.send({ t: 'leaveLobby' });
  else if (a === 'ready') net.send({ t: 'ready', ready: !!d.v });
  else if (a === 'start') net.send({ t: 'start' });
  else if (a === 'solo') net.send({ t: 'startSolo' });
  else if (a === 'back') { net.send({ t: 'leaveLobby' }); lobby = null; phase = 'menu'; menu(); }
});
const menu = () => { if (phase === 'menu') ui.showMenu({ self: sessionId, lobbies, lobby, error, count, pick }); };
ui.setClub(0);

const net = new Net(onMsg, () => {
  if (validName(name)) net.send({ t: 'hello', sessionId, name, token }); else { phase = 'name'; ui.showName(name); }
}, () => {
  welcomed = false; lobby = null; hole = null; swing = null; phase = 'down'; ui.showDown('Server restarted or disconnected.');
});

function onMsg(m: ServerMsg) {
  switch (m.t) {
    case 'welcome': welcomed = true; sessionId = m.sessionId; token = m.token; sessionStorage.setItem('ace.tok', m.token); sessionStorage.setItem('ace.sid', sessionId); if (phase !== 'race' && phase !== 'results') { phase = 'menu'; menu(); } break;
    case 'error':
      if (swing && swing.sentAt !== undefined) swing = null; // the server refused the shot: free the input
      if (m.code === 'NOT_IN_LOBBY') break;
      if (!welcomed && (m.code === 'NAME_INVALID' || m.code === 'NAME_TAKEN' || m.code === 'ALREADY_CONNECTED')) { phase = 'name'; ui.showName(name, errText(m)); break; }
      if (phase === 'race') ui.toast(errText(m)); else { error = errText(m); menu(); }
      break;
    case 'lobbies': lobbies = m.lobbies; menu(); break;
    case 'lobby': lobby = m.lobby; if (!lobby) count = null; menu(); break;
    case 'countdown': count = m.seconds; if (m.seconds === 4) void audio.play('vo-countdown', 0.9); menu(); break;
    case 'raceStart': {
      count = null; hole = m.hole; racers = m.players; ui.toggleScorecard(false); goAt = m.goAtMs; endAt = 0; swing = null; world.load(m.hole, m.players);
      selfId = (m.players.find(p => p.id === sessionId) ?? m.players.find(p => p.name === name))?.id ?? '';
      const me = world.ents.get(selfId);
      pos = me ? { x: me.ball.x + 1, z: me.ball.z - 0.5 } : { ...m.hole.tee };
      yaw = Math.atan2(m.hole.pin.x - pos.x, m.hole.pin.z - pos.z);
      holeStartStrokes = 0; startAmbience(keyOf(m.hole)); world.selfId = selfId;
      mySlot = Math.max(0, m.players.findIndex(p => p.id === selfId)); cart = cartSpawn(keyOf(m.hole), mySlot); driving = false; camYaw = yaw;
      phase = 'race'; ui.screen(null); board(); break;
    }
    case 'shotResult': {
      world.shot(m); if (m.playerId === selfId) { ui.card(m); swing = null; }
      // touch: the bag scrolls off a portrait phone's screen, so a ball at rest on the green picks the putter (any club cell still overrides)
      if (m.playerId === selfId && document.body.classList.contains('touch') && m.ball.surface === 'green' && !m.ball.holedOut && club !== PUTTER) { club = PUTTER; ui.setClub(PUTTER); }
      shotSounds(m);
      if (m.penalty && m.playerId === selfId) {
        ui.banner(m.penalty);                                                  // the ball is NOT where the tracer ends: say so loudly
        setTimeout(() => { pos = golferSpot(m.ball); }, (m.samples.at(-1)?.t ?? 0) * 1000 + 300);   // PRD/04: the golfer is moved to the drop
      } else if (m.penalty) ui.toast(`${world.ents.get(m.playerId)?.name ?? ''}: ${m.penalty}`);
      board(); break;
    }
    case 'holedOut': {
      const e = world.ents.get(m.playerId); if (e) { e.done = true; e.ball = { ...e.ball, strokes: m.strokes }; }
      const me = m.playerId === selfId;
      if (m.hole === hole?.index) void audio.play('sfx-cup-drop', me ? 0.9 : 0.5);
      if (me && m.strokes - holeStartStrokes === 1) setTimeout(() => void audio.play('vo-hole-in-one', 0.9), 600);
      else if (me && m.finished) setTimeout(() => void audio.play('vo-finish', 0.9), 900);
      ui.toast(me ? (m.finished ? `Finished! ${m.strokes} strokes, ${ui.clock(m.splitS)}` : `Hole ${m.hole + 1} done: ${m.strokes} strokes so far, ${ui.clock(m.splitS)}`)
        : m.hole === hole?.index ? `${e?.name ?? 'Player'} holed out (${m.strokes} strokes)` : '');
      board(); break;
    }
    case 'nextHole': {
      if (m.playerId === selfId) {
        hole = m.hole; world.myHole = m.hole.index; world.buildCourse(m.hole); world.moveTo(m.playerId, m.ball, m.hole.index);
        pos = { x: m.ball.x + 1, z: m.ball.z - 0.5 }; yaw = Math.atan2(m.hole.pin.x - pos.x, m.hole.pin.z - pos.z); swing = null;
        holeStartStrokes = m.ball.strokes; startAmbience(keyOf(m.hole));
        cart = cartSpawn(keyOf(m.hole), mySlot); driving = false; camYaw = yaw;          // the cart came along to the new tee
        ui.toast(`Hole ${m.hole.index + 1}: par ${m.hole.par}, ${Math.round(m.hole.lengthM * YD)} yd`);
      } else world.moveTo(m.playerId, m.ball, m.hole.index);
      board(); break;
    }
    case 'progress': racers = m.players; board(); break;
    case 'movers': for (const p of m.players) world.remote(p); break;
    case 'bump':
      if (m.target === 'cart') { cart = { ...cart, x: cart.x + m.dx, z: cart.z + m.dz, vx: cart.vx + m.dvx, vz: cart.vz + m.dvz }; if (driving) pos = { x: cart.x, z: cart.z }; }
      else if (!driving) pos = { x: pos.x + m.dx, z: pos.z + m.dz };
      audio.bump(m.strength); shake = Math.max(shake, 0.4 + 0.6 * m.strength); break;
    case 'snap': pos = { x: m.x, z: m.z }; driving = m.driving; cart = { ...m.cart }; break;
    case 'raceEnd':
      endAt = performance.now(); swing = null; phase = 'results'; document.exitPointerLock(); audio.stopLoops(); audio.whir(0);
      ui.showResults([...m.results].sort((a, b) => a.place - b.place), COURSES[m.course]?.name ?? '', racers.length ? scorecard(racers, pars(), selfId) : ''); break;
  }
}
/** Quiet ambience under the effects: surf and gulls on the ocean holes, wind in the cypress elsewhere. */
function startAmbience(key: number) {
  audio.stopLoops();
  if (isCoastal(key)) { void audio.loop('amb-surf', 0.22); void audio.loop('amb-gulls-sealions', 0.12); } else void audio.loop('amb-wind-cypress', 0.18);
}
/** Impact on strike, landing sound when the ball comes down (from the replay samples), on the right surface. */
function shotSounds(m: Extract<ServerMsg, { t: 'shotResult' }>) {
  const mine = m.playerId === selfId, same = m.hole === hole?.index; if (!same) return;
  const vol = mine ? 0.8 : 0.35, putt = m.clubSpeedMph === 0;
  const impact = putt ? 'sfx-impact-putter' : m.ballSpeedMs > 62 ? 'sfx-impact-driver' : m.ballSpeedMs > 46 ? 'sfx-impact-fairway' : m.ballSpeedMs > 32 ? 'sfx-impact-iron' : 'sfx-impact-wedge';
  void audio.play(impact, vol);
  if (putt) return;
  const land = m.samples.find(s => s.t > 0.4 && s.p.y - world.groundAt(s.p.x, s.p.z, m.hole) <= 0.06)?.t ?? m.samples.at(-1)?.t ?? 0;
  const surface = m.penalty ? (m.penalty.startsWith('Water') ? 'water' : 'rough') : ({ green: 'green', fairway: 'fairway', firstCut: 'fairway', rough: 'rough', bunker: 'sand', fringe: 'green' } as Record<string, string>)[m.ball.surface] ?? 'fairway';
  setTimeout(() => void audio.play(`sfx-land-${surface}`, vol * 0.8), land * 1000);
}
const pars = () => COURSES[hole?.course ?? DEFAULT_COURSE].card.map(c => c.par);
const board = () => ui.board(racers, pars(), selfId);

// ---- input ----
const canvas = world.renderer.domElement;
canvas.addEventListener('click', () => { if (phase === 'race' && !touch.on) void requestLock(canvas); });
/** Touch: a pull-down swing replays the second Space press and its release, with the pull length standing in for the hold time. */
Object.assign((window as unknown as { __ace: object }).__ace, { state: () => ({ pos, yaw, driving, club, rfOpen, swing: swing?.fsm.phase ?? null, aim: swing?.fsm.aim(), ballPos: swing?.fsm.ballPos(), chip: swing?.fsm.isChip(), cart }) });   // debug handle for the touch checks
const touch = new TouchControls(ui.hud, canvas, () => touchCtx, px => {
  const f = swing?.fsm; if (!f || swing!.sentAt !== undefined || f.phase !== 'stance') return;
  const ms = pullToHoldMs(px, innerHeight, f.club().putt || f.isChip()); if (ms === null) return;   // a tiny pull stays in the stance
  const t0 = performance.now(); act(f.key('Space', true, t0)); act(swing?.fsm.key('Space', false, t0 + ms) ?? null);
});
let touchCtx = { race: false, driving: false, stance: false, nearCart: false, putt: false, map: false, chip: false };
addEventListener('mousemove', e => {
  if (phase !== 'race' || ui.settingsOpen() || (swing && swing.fsm.phase !== 'stance' && swing.fsm.phase !== 'idle') || (document.pointerLockElement !== canvas && !(e.buttons & 1))) return;
  const m = lookMult * lookScale(keys);                                    // Shift halves the look for fine aim and putting lines
  if (driving) { orbit += lookDelta(e.movementX, m); lastLook = performance.now(); } else yaw += lookDelta(e.movementX, m);   // in the cart the mouse orbits the chase camera
  pitch = Math.min(1.2, Math.max(0.05, pitch + lookDelta(e.movementY, m)));
  if (swing && swing.sentAt === undefined) swing.fsm.setAim(aimDeg(yaw));  // the mouse stays live in the stance: the golfer pivots, the ball does not move
});
const own = () => world.ents.get(selfId);
const started = () => Date.now() >= goAt && !endAt;
const ownDist = () => { const b = own()?.ball; return b ? Math.hypot(b.x - pos.x, b.z - pos.z) : Infinity; };
const aimDeg = (y: number) => ((y * 180 / Math.PI) % 360 + 360) % 360;

addEventListener('keydown', e => {
  if (phase !== 'race' || ['INPUT', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;
  if (['Tab', 'Space', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'KeyN') { audio.toggleMute(); return; }
  if (e.code === 'Tab') { ui.toggleScorecard(); board(); return; }
  if (e.code === 'Comma' || e.code === 'Period') { setLook(stepMult(lookMult, e.code === 'Period' ? 1 : -1)); ui.toast(lookLabel(lookMult)); return; }
  if (e.code === 'Escape' && !swing) { ui.toggleSettings(); return; }          // Esc opens the settings menu; in a stance it cancels the stance instead
  if (ui.settingsOpen()) return;
  if (e.code === 'KeyM' && !swing) { rfOpen = !rfOpen; rfHover = null; ui.rf().style.display = rfOpen ? 'block' : 'none'; ui.rfTip(null); if (rfOpen) document.exitPointerLock(); return; }
  const ci = BAG.findIndex(b => b.code === e.code);
  if (ci >= 0 && (!swing || (swing.sentAt === undefined && swing.fsm.setClub(BAG[ci]!.key, ci === PUTTER)))) { club = ci; ui.setClub(ci); return; }   // club changes stay allowed in the stance until the backswing starts
  if (swing) { if (swing.sentAt === undefined) act(swing.fsm.key(e.code, true, e.timeStamp)); return; }
  if (e.code === 'KeyE' && started()) {                                       // E: get in within 3 m, or get out beside the cart
    if (driving) { driving = false; pos = exitSpot(cart); cart = { ...cart, vx: 0, vz: 0 }; yaw = camYaw; }
    else if (canEnter(pos, cart)) { driving = true; orbit = 0; camYaw = yaw; }
    return;
  }
  if (e.code === 'Space' && driving) { ui.toast(touch.on ? 'Cart: get out to play' : 'E: get out to play'); return; }
  if (e.code === 'Space' && started()) {
    const me = own();
    if (rfOpen || !me || !canAddress(pos, me.ball, { atRest: !me.anim, holedOut: me.ball.holedOut, inCart: driving })) return;
    swing = { fsm: new SwingFSM({ putt: club === PUTTER, aimDeg: aimDeg(yaw), clubKey: BAG[club]!.key }) };   // first press: take the stance (movement off; aim, club and ball position stay adjustable)
    act(swing.fsm.key(e.code, true, e.timeStamp)); // the machine models the first press too
  }
});
addEventListener('keyup', e => {
  keys.delete(e.code);
  if (swing && swing.sentAt === undefined) act(swing.fsm.key(e.code, false, e.timeStamp));
});
/** A stance or backswing must never survive a lost key-up: blur, tab switch, or leaving pointer lock cancels it. */
const abortSwing = () => { if (swing && swing.sentAt === undefined) act(swing.fsm.abort()); };
addEventListener('blur', () => { keys.clear(); abortSwing(); });   // no stuck Shift or arrow key on focus loss
document.addEventListener('visibilitychange', () => { if (document.hidden) abortSwing(); });
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement) abortSwing(); });

/** One saved setting for the slider and the , . keys. */
function setLook(v: number, byPlayer = true) { lookMult = v; saveMult(v, undefined, byPlayer); ui.syncSettings(); }
ui.bindSettings(() => lookMult, v => setLook(sliderValue(v)), () => { lookMult = resetMult(); ui.syncSettings(); });
// Sky preset: saved per browser; ?sky=marine overrides it for the QA shots
const isSky = (v: string | null): v is SkyPreset => SKY_PRESETS.includes(v as SkyPreset);
let sky: SkyPreset = 'sunny';
try { const v = localStorage.getItem('ace.sky'); if (isSky(v)) sky = v; } catch { /* private mode: default */ }
const skyQ = new URLSearchParams(location.search).get('sky'); if (isSky(skyQ)) sky = skyQ;
if (sky !== 'sunny') world.setSky(sky);
ui.bindSky(() => sky, v => { if (!isSky(v)) return; sky = v; try { localStorage.setItem('ace.sky', v); } catch { /* not remembered */ } world.setSky(v); });
ui.bindGraphics(() => ({ pref: gfxPref, auto: adapt.tier }), p => {
  gfxPref = p; savePref(p); adapt.reset(performance.now());
  world.applyTier(p === 'auto' ? adapt.tier : p);
});
addEventListener('keydown', e => { if (e.code === 'F3') { e.preventDefault(); ui.toggleFps(); } });

/** Touch: stick dead zone, the turn rate at full sideways pull (px of mouse movement per second), and the reworded prompts. */
const dz = (v: number) => Math.abs(v) < 0.15 ? 0 : v;
const TURN_PX = 500;
const prompt = (t: string) => ui.prompt(touch.on ? touchText(t) : t);
const meter = (fr: number, label: string, maxZone: boolean) => ui.meterShow(fr, touch.on ? touchText(label) : label, maxZone);

// ---- frame loop ----
let last = performance.now(), stuckSince = 0, fpsFrames = 0, fpsSince = last;
function frame(now: number) {
  requestAnimationFrame(frame);
  const rawMs = now - last, dt = Math.min(0.1, rawMs / 1000); last = now;
  fpsFrames++;
  if (now - fpsSince >= 500) {
    const ms = (now - fpsSince) / fpsFrames, r = world.renderer.info.render;
    ui.fps(`${Math.round(1000 / ms)} fps  ${ms.toFixed(1)} ms\n${TIER_LABEL[world.tier]}${gfxPref === 'auto' ? ' (Auto)' : ''}  ${r.calls} draws  ${Math.round(r.triangles / 1000)}k tris`);
    fpsFrames = 0; fpsSince = now;
  }
  if (gfxPref === 'auto' && phase === 'race') {   // never mid-swing or while the own ball flies: the decision waits for rest
    const me = world.ents.get(selfId), t = adapt.sample(rawMs, now, !!swing || !!me?.anim);
    if (t) { world.applyTier(t); ui.syncGraphics(); }
  }
  if (qaView) { world.qaRender(); return; }
  if (phase !== 'race' || !hole) { if (phase === 'results' || phase === 'race') world.render(pos.x, pos.z, yaw, pitch); return; }
  const me = own(), go = started();
  if (!swing && go && !ui.settingsOpen() && !driving) {                      // arrow keys move; WASD is for the ball position in the stance
    const st = touch.stick, k = moveAxis(keys), { f, r } = st && !k.f && !k.r ? { f: dz(-st.y), r: 0 } : k, n = Math.max(1, Math.hypot(f, r)), speed = walkSpeed(keys);
    if (st) yaw += lookDelta(dz(st.x) * TURN_PX * dt, lookMult * lookScale(keys));   // sideways pull turns at a rate set by the offset
    pos.x += ((Math.sin(yaw) * f + Math.cos(yaw) * r) / n) * speed * dt; pos.z += ((Math.cos(yaw) * f - Math.sin(yaw) * r) / n) * speed * dt;
  }
  // the cart always steps (a bumped, parked cart still rolls to a stop); arrows drive it only from the seat
  const drive = driving && go && !ui.settingsOpen() ? (touch.stick ? { f: dz(-touch.stick.y), r: dz(touch.stick.x) } : moveAxis(keys)) : { f: 0, r: 0 }, ground = (x: number, z: number) => cartGround(keyOf(hole!), x, z);
  for (let i = 0, n = Math.ceil(dt * 120); i < n; i++) {                     // small fixed sub-steps so a fast cart cannot skip a thin bunker lip
    const st = stepCart(cart, { throttle: drive.f, steer: drive.r }, dt / n, ground); cart = st.s;
    if (st.bumped > 1.5 && driving) { audio.bump(Math.min(1, st.bumped / CART.TOP) * 0.6); shake = Math.max(shake, 0.25); }
  }
  if (driving) {
    pos = { x: cart.x, z: cart.z };
    if (Math.abs(forwardSpeed(cart)) > 2 && now - lastLook > 1500) orbit *= Math.exp(-1.5 * dt);   // the chase camera swings back behind the cart
    const want = cart.yaw + orbit; camYaw += Math.atan2(Math.sin(want - camYaw), Math.cos(want - camYaw)) * (1 - Math.exp(-6 * dt)); yaw = camYaw;
  }
  audio.whir(driving ? Math.min(1, Math.abs(forwardSpeed(cart)) / CART.TOP) : 0);
  if (me) world.placeCart(me, cart, driving ? drive.r : 0, dt);
  if (me) me.driving = driving;
  if (go && now - lastSend > 100) { lastSend = now; net.send({ t: 'move', x: pos.x, z: pos.z, yaw, driving, cart }); }
  if (swing && swing.sentAt === undefined && (touch.aimHold || touch.aimPx)) {   // touch aim in the stance: ◀ ▶ held, or a sideways drag
    yaw += lookDelta(touch.aimHold * TURN_PX * 0.35 * dt + touch.aimPx, lookMult * 0.5); touch.aimPx = 0; swing.fsm.setAim(aimDeg(yaw));
  }
  if (swing) {
    if (swing.sentAt !== undefined) { if (!stuckSince) stuckSince = now; if (now - stuckSince > 3000) { swing = null; stuckSince = 0; } }
    else {
      act(swing.fsm.tick(now));                                                // auto-release at 1.10 s: a max-effort shot
      const f = swing?.fsm;
      if (f && swing) {
        const pull = touch.pull !== null && f.phase === 'stance' ? (pullToHoldMs(touch.pull, innerHeight, f.club().putt || f.isChip()) ?? 0) / 750 : null;
        const ph = pull !== null ? 'backswing' : f.phase, fr = pull ?? f.meter(now), putt = f.club().putt;
        const chip = f.isChip(); meter(fr, ph === 'stance' ? (putt ? 'Hold Space, release to putt' : chip ? 'CHIP (0-25% power) · hold Space, release · Shift: full swing' : 'Hold Space, release to hit · Shift: chip') : putt ? 'Release to putt' : chip ? `Chip · ${Math.round(Math.min(1, fr) * 25)}% power` : fr >= 1 ? 'MAX ZONE: release for a full shot, hold on for MAX effort' : 'Release to hit', !putt && !chip);
        ui.ballPosGrid(putt ? null : f.ballPos());
      }
    }
  } else { stuckSince = 0; ui.meterShow(null); ui.ballPosGrid(null); }
  if (!swing) { ui.meterShow(null); ui.ballPosGrid(null); }
  const canStance = !!me && canAddress(pos, me.ball, { atRest: !me.anim, holedOut: me.ball.holedOut, inCart: driving });
  if (me && (canStance || (swing && swing.sentAt === undefined))) {         // the lie panel at the ball: penalties and stance angles for this aim and club
    const n = groundNormal(keyOf(hole), me.ball.x, me.ball.z), aim = swing ? swing.fsm.aim() : aimDeg(yaw), slope = stanceSlope(n, aim);
    const onTee = Math.hypot(me.ball.x - hole.tee.x, me.ball.z - hole.tee.z) <= 3;                     // the server's tee rule (race.ts TEE_RADIUS_M)
    ui.liePanel(lieInfo(onTee ? 'tee' : me.ball.surface, SIM_BAG.find(c => c.key === BAG[club]!.key)!, slope, n), slope);
  } else ui.liePanel(null);
  const base = swing || !go || !me || me.ball.holedOut || me.anim ? '' : rfOpen ? 'Close the rangefinder (M) to swing' : canStance ? 'Space: take your stance' : `Walk to your ball (yellow beacon): ${Math.round(ownDist() * YD)} yd`;
  const nearCart = go && !swing && !driving && canEnter(pos, cart);
  touchCtx = { race: go, driving, stance: !!swing && swing.sentAt === undefined, nearCart, putt: !!swing?.fsm.club().putt, map: rfOpen, chip: !!swing?.fsm.isChip() };
  touch.update(touchCtx);
  prompt(driving && go ? `WASD drive · ${Math.round(Math.abs(forwardSpeed(cart)) * 2.237)} mph · E: get out to play` : nearCart ? (base ? `${base} · E: get in the cart` : 'E: get in the cart') : base);
  { // pin indicator: on foot and in the stance, hidden while the ball flies and within about 30 yd of the pin
    const pinYd = me ? Math.hypot(hole.pin.x - me.ball.x, hole.pin.z - me.ball.z) * YD : 0, camYd = Math.hypot(hole.pin.x - pos.x, hole.pin.z - pos.z) * YD;
    ui.pinMarker(me && !me.anim && !rfOpen && !me.ball.holedOut ? world.pinScreen() : null, pinYd, pinOpacity(camYd));
  }
  ui.ballMarker(me && !me.ball.holedOut ? world.ballScreen() : null, me ? Math.hypot(me.ball.x - pos.x, me.ball.z - pos.z) * YD : 0);
  const headingRad = driving ? cart.yaw : (swing ? swing.fsm.aim() : aimDeg(yaw)) * Math.PI / 180;   // in the stance the arrow shows the aim (the shot's aimDeg), otherwise the camera facing
  if (rfOpen && me && hole) ui.drawRangefinder(hole, me.ball, pos, rfTarget, rfHover, headingRad);
  const cd = goAt - Date.now();
  ui.countdown(cd > 0 ? String(Math.ceil(cd / 1000)) : cd > -800 ? 'GO' : '');
  if (me) {
    const dest = me.anim?.final ?? me.ball; // show the outcome distance as soon as the shot is resolved
    const d = Math.hypot(hole.pin.x - dest.x, hole.pin.z - dest.z) * YD;
    ui.info(hole, d, me.ball.surface, ui.clock(go ? (Date.now() - goAt) / 1000 : 0), me.ball.strokes);
    world.placeGolfer(me, pos.x, pos.z, swing ? swing.fsm.aim() * Math.PI / 180 : yaw);
    world.setClub(selfId, club);
    const f = swing && swing.sentAt === undefined ? swing.fsm : null;   // stance and backswing pose the golfer at the ball; depth follows the hold
    const pullD = f && touch.pull !== null ? (pullToHoldMs(touch.pull, innerHeight, true) ?? 0) / 750 : 0;   // a touch pull winds the backswing up live
    world.setStance(selfId, f ? { depth: f.phase === 'backswing' ? Math.min(1, f.meter(now)) : pullD, putt: f.club().putt || f.isChip() } : null);   // a chip uses the shoulder-only pendulum
  }
  world.ownBallDistM = ownDist();
  world.tick(now);
  ui.drawMini(hole, [...world.ents.values()].filter(e => e.hole === hole!.index).flatMap(e => {
    const mine = e.id === selfId, onFoot = mine ? !driving : !e.driving;
    return [
      { x: e.ballMesh.position.x * -1, z: e.ballMesh.position.z, shade: e.shade, ball: true, own: mine },
      ...(mine && driving ? [] : [{ x: e.cs.x, z: e.cs.z, shade: e.shade, cart: true, heading: e.cs.yaw }]),   // my cart is the heading arrow while I drive
      ...(onFoot || mine ? [{ x: mine ? pos.x : e.remote?.x ?? e.ball.x + 1, z: mine ? pos.z : e.remote?.z ?? e.ball.z - 0.5, shade: e.shade, own: mine, heading: mine ? headingRad : undefined }] : []),
    ];
  }));
  const cam = me?.anim ? me.ballMesh.position : null; // camera follows the ball while it flies
  shake = Math.max(0, shake - dt * 2.5); const jx = shake * shake * 0.5 * (Math.random() - 0.5), jz = shake * shake * 0.5 * (Math.random() - 0.5);   // bump shake (trauma²)
  world.render((cam ? -cam.x : pos.x) + jx, (cam ? cam.z : pos.z) + jz, swing ? swing.fsm.aim() * Math.PI / 180 : yaw, pitch, cam ? Math.max(1.5, (cam.y - world.groundAt(-cam.x, cam.z)) * 0.7) : driving ? 1.8 : 1.5, cam ? 25 : driving ? 11 : 8);
}
requestAnimationFrame(frame);

// ---- rangefinder (PRD/02 section 7): M toggles; hover shows distances and a club suggestion; click sets a target shown on the maps only ----
const rfCanvas = ui.rfCanvas();
const rfWorld = (e: MouseEvent) => { const r = rfCanvas.getBoundingClientRect(); return { p: rfView(keyOf(hole!), rfCanvas.width, rfCanvas.height).toWorld(((e.clientX - r.left) / r.width) * rfCanvas.width, ((e.clientY - r.top) / r.height) * rfCanvas.height), cx: e.clientX - r.left, cy: e.clientY - r.top }; };
rfCanvas.addEventListener('mousemove', e => {
  const me = own(); if (!rfOpen || !hole || !me) return;
  const { p, cx, cy } = rfWorld(e); rfHover = p;
  const fromBall = Math.hypot(p.x - me.ball.x, p.z - me.ball.z) * YD, toPin = Math.hypot(p.x - hole.pin.x, p.z - hole.pin.z) * YD, rise = riseM(me.ball, p), ft = Math.round(rise * 3.2808);
  ui.rfTip(`From your ball: ${Math.round(fromBall)} yd\nTo the pin: ${Math.round(toPin)} yd\nElevation: ${ft === 0 ? 'level' : `${ft > 0 ? '+' : '−'}${Math.abs(ft)} ft`}\nPlays like: ${playsLikeFrom(fromBall, me.ball.surface, rise * YD)}`, cx, cy);
});
/** Real rise (m) from the ball to a point: the plays-like distance adds it, yard for yard. */
const riseM = (a: { x: number; z: number }, b: { x: number; z: number }) => world.groundAt(b.x, b.z) - world.groundAt(a.x, a.z);
function playsLikeFrom(yd: number, surface: string, riseYd: number): string {
  const s = suggestClub(yd, asLie(surface), { riseYd });
  return s.holdPct ? `${s.label} at about ${s.holdPct}%` : s.label;
}
// Clicking a target auto-selects the club from the ball's actual lie (PRD/02 section 7); no auto-aim, and number keys still override.
rfCanvas.addEventListener('click', e => {
  const me = own(); if (!rfOpen || !hole || !me) return;
  const p = rfWorld(e).p; rfTarget = p;
  const s = suggestClub(Math.hypot(p.x - me.ball.x, p.z - me.ball.z) * YD, asLie(me.ball.surface), { riseYd: riseM(me.ball, p) * YD });
  const ci = BAG.findIndex(b => b.key === s.club);
  if (ci >= 0 && (!swing || (swing.sentAt === undefined && swing.fsm.setClub(BAG[ci]!.key, ci === PUTTER)))) { club = ci; ui.setClub(ci); }
  ui.toast(s.text);
});
