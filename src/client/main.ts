import { SwingFSM, type Action } from './swingfsm';
import { GameAudio } from './audio';
import { isCoastal } from './terrain';
import type { HoleInfo, ServerMsg } from '../shared/protocol';
import type { LobbyView } from '../server/lobby-types';
import { Net } from './net';
import { BAG, PUTTER, UI, YD, errText } from './ui';
import { World } from './scene';

const SPEED = 9, RANGE = 2.5;
const touchOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;

let sessionId = sessionStorage.getItem('ace.sid') ?? crypto.randomUUID();
sessionStorage.setItem('ace.sid', sessionId);
let token = sessionStorage.getItem('ace.tok') ?? undefined;
let name = localStorage.getItem('ace.name') ?? '';
let welcomed = false, lobbies: LobbyView[] = [], lobby: LobbyView | null = null, error = '', count: number | null = null;
let phase: 'name' | 'menu' | 'race' | 'results' | 'down' = 'name';

let hole: HoleInfo | null = null, selfId = '', goAt = 0, endAt = 0;
let pos = { x: 0, z: 0 }, yaw = 0, pitch = 0.55, club = 0; // higher default camera so the golfer and ball both read at address
const keys = new Set<string>();
/** swing exists from the first Space press (stance, aim locked, WASD off) until the shot or putt is sent. */
type Swing = { fsm: SwingFSM; putt: boolean; aim: number; sentAt?: number };
let swing: Swing | null = null;
/** Applies a state-machine action: cancel, or send the shot/putt (the server decides every outcome). */
const audio = new GameAudio();
let holeStartStrokes = 0;
const act = (a: Action | null) => {
  if (!a || !swing) return;
  if (a.type === 'cancel') { swing = null; return; }
  net.send(a.msg); swing.sentAt = performance.now();
  if (a.type === 'send-shot') void audio.play(a.msg.length < 0.4 ? 'sfx-swing-soft' : a.msg.length < 0.85 ? 'sfx-swing-full' : 'sfx-swing-max', 0.7);
};

const world = new World(document.body.appendChild(Object.assign(document.createElement('canvas'), { style: 'position:fixed;inset:0' })));
(window as unknown as { __ace?: unknown }).__ace = { world }; // debug handle for browser checks
const validName = (n: string) => n.trim().length >= 2 && n.trim().length <= 16;

const ui = new UI((a, d, form) => {
  error = '';
  if (a === 'name') {
    const v = form.querySelector<HTMLInputElement>('#nm')!.value.trim();
    if (!validName(v)) return ui.showName(v, 'Name must be 2 to 16 characters.');
    name = v; localStorage.setItem('ace.name', v); net.send({ t: 'hello', sessionId, name, token });
  } else if (a === 'create') net.send({ t: 'createLobby' });
  else if (a === 'join') net.send({ t: 'joinLobby', lobbyId: d.id! });
  else if (a === 'leave') net.send({ t: 'leaveLobby' });
  else if (a === 'ready') net.send({ t: 'ready', ready: !!d.v });
  else if (a === 'start') net.send({ t: 'start' });
  else if (a === 'solo') net.send({ t: 'startSolo' });
  else if (a === 'back') { net.send({ t: 'leaveLobby' }); lobby = null; phase = 'menu'; menu(); }
});
const menu = () => { if (phase === 'menu') ui.showMenu({ self: sessionId, lobbies, lobby, error, count }); };
ui.setClub(0);

const net = new Net(onMsg, () => {
  if (touchOnly) return;
  if (validName(name)) net.send({ t: 'hello', sessionId, name, token }); else { phase = 'name'; ui.showName(name); }
}, () => {
  welcomed = false; lobby = null; hole = null; swing = null; phase = 'down'; ui.showDown('Server restarted or disconnected.');
});
if (touchOnly) ui.showTouch();

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
      count = null; hole = m.hole; goAt = m.goAtMs; endAt = 0; swing = null; world.load(m.hole, m.players);
      selfId = (m.players.find(p => p.id === sessionId) ?? m.players.find(p => p.name === name))?.id ?? '';
      const me = world.ents.get(selfId);
      pos = me ? { x: me.ball.x + 1, z: me.ball.z - 0.5 } : { ...m.hole.tee };
      yaw = Math.atan2(m.hole.pin.x - pos.x, m.hole.pin.z - pos.z);
      holeStartStrokes = 0; startAmbience(m.hole.index);
      phase = 'race'; ui.screen(null); board(); break;
    }
    case 'shotResult': {
      world.shot(m); if (m.playerId === selfId) { ui.card(m); swing = null; }
      shotSounds(m);
      if (m.penalty) ui.toast(`${world.ents.get(m.playerId)?.name ?? ''}: ${m.penalty}`);
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
        holeStartStrokes = m.ball.strokes; startAmbience(m.hole.index);
        ui.toast(`Hole ${m.hole.index + 1}: par ${m.hole.par}, ${Math.round(m.hole.lengthM * YD)} yd`);
      } else world.moveTo(m.playerId, m.ball, m.hole.index);
      board(); break;
    }
    case 'raceEnd':
      endAt = performance.now(); swing = null; phase = 'results'; document.exitPointerLock(); audio.stopLoops();
      ui.showResults([...m.results].sort((a, b) => a.place - b.place)); break;
  }
}
/** Quiet ambience under the effects: surf and gulls on the ocean holes, wind in the cypress elsewhere. */
function startAmbience(holeIndex: number) {
  audio.stopLoops();
  if (isCoastal(holeIndex)) { void audio.loop('amb-surf', 0.22); void audio.loop('amb-gulls-sealions', 0.12); } else void audio.loop('amb-wind-cypress', 0.18);
}
/** Impact on strike, landing sound when the ball comes down (from the replay samples), on the right surface. */
function shotSounds(m: Extract<ServerMsg, { t: 'shotResult' }>) {
  const mine = m.playerId === selfId, same = m.hole === hole?.index; if (!same) return;
  const vol = mine ? 0.8 : 0.35, putt = m.clubSpeedMph === 0, bad = (m.grade.z + m.grade.x + m.grade.c) / 3 > 0.65;
  const impact = putt ? 'sfx-impact-putter' : bad ? 'sfx-impact-mishit' : m.ballSpeedMs > 62 ? 'sfx-impact-driver' : m.ballSpeedMs > 46 ? 'sfx-impact-fairway' : m.ballSpeedMs > 32 ? 'sfx-impact-iron' : 'sfx-impact-wedge';
  void audio.play(impact, vol);
  if (putt) return;
  const land = m.samples.find(s => s.t > 0.4 && s.p.y <= 0.06)?.t ?? m.samples.at(-1)?.t ?? 0;
  const surface = m.penalty ? (m.penalty.startsWith('Water') ? 'water' : 'rough') : ({ green: 'green', fairway: 'fairway', firstCut: 'fairway', rough: 'rough', bunker: 'sand', fringe: 'green' } as Record<string, string>)[m.ball.surface] ?? 'fairway';
  setTimeout(() => void audio.play(`sfx-land-${surface}`, vol * 0.8), land * 1000);
}
const board = () => ui.board([...world.ents.values()].map(e => ({ id: e.id, name: e.name, hole: e.hole, strokes: e.ball.strokes, done: e.done })), selfId);

// ---- input ----
const canvas = world.renderer.domElement;
canvas.addEventListener('click', () => { if (phase === 'race') canvas.requestPointerLock?.(); });
addEventListener('mousemove', e => {
  if (phase !== 'race' || swing || (document.pointerLockElement !== canvas && !(e.buttons & 1))) return;
  yaw += e.movementX * 0.003; pitch = Math.min(1.2, Math.max(0.05, pitch + e.movementY * 0.003));
});
const own = () => world.ents.get(selfId);
const started = () => Date.now() >= goAt && !endAt;
const ownDist = () => { const b = own()?.ball; return b ? Math.hypot(b.x - pos.x, b.z - pos.z) : Infinity; };
const aimDeg = (y: number) => ((y * 180 / Math.PI) % 360 + 360) % 360;

addEventListener('keydown', e => {
  if (phase !== 'race' || (e.target as HTMLElement).tagName === 'INPUT') return;
  if (['Space', 'Escape'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'KeyN') { audio.toggleMute(); return; }
  const ci = BAG.findIndex(b => b.code === e.code);
  if (ci >= 0 && !swing) { club = ci; ui.setClub(ci); return; } // locked once the stance starts
  if (swing) { if (swing.sentAt === undefined) act(swing.fsm.key(e.code, true, e.timeStamp)); return; }
  if (e.code === 'Space' && started()) {
    const me = own();
    if (!me || me.ball.holedOut || me.anim || ownDist() > RANGE) return;
    const putt = club === PUTTER, aim = aimDeg(yaw); // first press: take the stance and lock the aim
    swing = { fsm: new SwingFSM({ putt, aimDeg: aim, clubKey: BAG[club]!.key }), putt, aim };
    act(swing.fsm.key(e.code, true, e.timeStamp)); // the machine models the first press too
  }
});
addEventListener('keyup', e => {
  keys.delete(e.code);
  if (swing && swing.sentAt === undefined) act(swing.fsm.key(e.code, false, e.timeStamp));
});
/** A stance or backswing must never survive a lost key-up: blur, tab switch, or leaving pointer lock cancels it. */
const abortSwing = () => { if (swing && swing.sentAt === undefined) act(swing.fsm.abort()); };
addEventListener('blur', () => { keys.clear(); abortSwing(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) abortSwing(); });
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement) abortSwing(); });

// ---- frame loop ----
let last = performance.now(), stuckSince = 0;
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (phase !== 'race' || !hole) { if (phase === 'results' || phase === 'race') world.render(pos.x, pos.z, yaw, pitch); return; }
  const me = own(), go = started();
  if (!swing && go) {
    const f = Number(keys.has('KeyW')) - Number(keys.has('KeyS')), r = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
    const n = Math.hypot(f, r) || 1;
    pos.x += ((Math.sin(yaw) * f + Math.cos(yaw) * r) / n) * SPEED * dt; pos.z += ((Math.cos(yaw) * f - Math.sin(yaw) * r) / n) * SPEED * dt;
  }
  if (swing) {
    if (swing.sentAt !== undefined) { if (!stuckSince) stuckSince = now; if (now - stuckSince > 3000) { swing = null; stuckSince = 0; } }
    else {
      act(swing.fsm.tick(now));
      const f = swing?.fsm;
      if (f && swing) {
        const ph = f.phase;
        ui.meterShow(f.meter(now), ph === 'stance' ? (swing.putt ? 'Hold Space, release to strike' : 'Hold Space to swing back, release at the top')
          : ph === 'backswing' ? (swing.putt ? 'Release Space to strike' : 'Release Space at the top, then Z X C') : 'Z, X, C now');
      }
    }
  } else { stuckSince = 0; ui.meterShow(null); }
  if (!swing) ui.meterShow(null);
  ui.prompt(!swing && go && me && !me.ball.holedOut && !me.anim && ownDist() <= RANGE ? 'Space: take your stance' : '');
  const cd = goAt - Date.now();
  ui.countdown(cd > 0 ? String(Math.ceil(cd / 1000)) : cd > -800 ? 'GO' : '');
  if (me) {
    const dest = me.anim?.final ?? me.ball; // show the outcome distance as soon as the shot is resolved
    const d = Math.hypot(hole.pin.x - dest.x, hole.pin.z - dest.z) * YD;
    ui.info(hole, d, me.ball.surface, ui.clock(go ? (Date.now() - goAt) / 1000 : 0), me.ball.strokes);
    world.placeGolfer(me, pos.x, pos.z, swing ? swing.aim * Math.PI / 180 : yaw);
  }
  world.tick(now);
  ui.drawMini(hole, [...world.ents.values()].filter(e => e.hole === hole!.index).flatMap(e => [
    { x: e.ballMesh.position.x * -1, z: e.ballMesh.position.z, shade: e.shade, ball: true },
    { x: e.id === selfId ? pos.x : e.ball.x + 1, z: e.id === selfId ? pos.z : e.ball.z - 0.5, shade: e.shade },
  ]));
  const cam = me?.anim ? me.ballMesh.position : null; // camera follows the ball while it flies
  world.render(cam ? -cam.x : pos.x, cam ? cam.z : pos.z, swing ? swing.aim * Math.PI / 180 : yaw, pitch, cam ? Math.max(1.5, cam.y * 0.7) : 1.5);
}
requestAnimationFrame(frame);
