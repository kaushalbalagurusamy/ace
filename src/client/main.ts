import type { HoleInfo, ServerMsg } from '../shared/protocol';
import type { LobbyView } from '../server/lobby-types';
import { Net } from './net';
import { BAG, PUTTER, UI, YD, errText } from './ui';
import { World } from './scene';

const SPEED = 9, RANGE = 2.5, TOP_MS = 1350, IMPACT_MS = 300, PUTT_MAX = 1500;
const touchOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;

let sessionId = sessionStorage.getItem('ace.sid') ?? crypto.randomUUID();
sessionStorage.setItem('ace.sid', sessionId);
let token = sessionStorage.getItem('ace.tok') ?? undefined;
let name = localStorage.getItem('ace.name') ?? '';
let welcomed = false, lobbies: LobbyView[] = [], lobby: LobbyView | null = null, error = '', count: number | null = null;
let phase: 'name' | 'menu' | 'race' | 'results' | 'down' = 'name';

let hole: HoleInfo | null = null, selfId = '', goAt = 0, endAt = 0;
let pos = { x: 0, z: 0 }, yaw = 0, pitch = 0.35, club = 0;
const keys = new Set<string>();
type Swing = { putt: boolean; t0: number; top: number; aim: number; club: string; z?: number; x?: number; c?: number; held: Set<string>; sentAt?: number };
let swing: Swing | null = null;

const world = new World(document.body.appendChild(Object.assign(document.createElement('canvas'), { style: 'position:fixed;inset:0' })));
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
      if (m.code === 'NOT_IN_LOBBY') break;
      if (!welcomed && (m.code === 'NAME_INVALID' || m.code === 'NAME_TAKEN' || m.code === 'ALREADY_CONNECTED')) { phase = 'name'; ui.showName(name, errText(m)); break; }
      if (phase === 'race') ui.toast(errText(m)); else { error = errText(m); menu(); }
      break;
    case 'lobbies': lobbies = m.lobbies; menu(); break;
    case 'lobby': lobby = m.lobby; if (!lobby) count = null; menu(); break;
    case 'countdown': count = m.seconds; menu(); break;
    case 'raceStart': {
      count = null; hole = m.hole; goAt = m.goAtMs; endAt = 0; swing = null; world.load(m.hole, m.players);
      selfId = (m.players.find(p => p.id === sessionId) ?? m.players.find(p => p.name === name))?.id ?? '';
      const me = world.ents.get(selfId);
      pos = me ? { x: me.ball.x + 1, z: me.ball.z - 0.5 } : { ...m.hole.tee };
      yaw = Math.atan2(m.hole.pin.x - pos.x, m.hole.pin.z - pos.z);
      phase = 'race'; ui.screen(null); board(); break;
    }
    case 'shotResult': {
      world.shot(m); if (m.playerId === selfId) { ui.card(m); swing = null; }
      if (m.penalty) ui.toast(`${world.ents.get(m.playerId)?.name ?? ''}: ${m.penalty}`);
      board(); break;
    }
    case 'holedOut': {
      const e = world.ents.get(m.playerId); if (e) { e.done = true; e.ball = { ...e.ball, strokes: m.strokes }; }
      ui.toast(`${e?.name ?? 'Player'} holed out in ${m.strokes} (${ui.clock(m.splitS)})`); board(); break;
    }
    case 'raceEnd':
      endAt = performance.now(); swing = null; phase = 'results'; document.exitPointerLock();
      ui.showResults([...m.results].sort((a, b) => a.place - b.place)); break;
  }
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
  const ci = BAG.findIndex(b => b.code === e.code);
  if (ci >= 0 && !swing) { club = ci; ui.setClub(ci); return; } // locked once swing mode starts
  if (e.code === 'Escape' && swing && !swing.putt && e.timeStamp < swing.top && swing.sentAt === undefined) { swing = null; return; }
  if (e.code === 'Escape' && swing?.putt && swing.sentAt === undefined) { swing = null; return; }
  if (e.code === 'Space' && !swing && started()) {
    const me = own();
    if (!me || me.ball.holedOut || me.anim || ownDist() > RANGE) return;
    const putt = club === PUTTER;
    swing = { putt, t0: e.timeStamp, top: e.timeStamp + TOP_MS, aim: aimDeg(yaw), club: BAG[club]!.key, held: new Set() };
    return;
  }
  if (swing && swing.sentAt === undefined) {
    const k = ({ KeyZ: 'z', KeyX: 'x', KeyC: 'c' } as Record<string, 'z' | 'x' | 'c' | undefined>)[e.code];
    if (!k) return;
    if (swing.putt) { if (k === 'z' && swing.z === undefined) { swing.z = e.timeStamp; } return; }
    if (swing[k] === undefined) { swing[k] = e.timeStamp - swing.top; swing.held.add(k); }
  }
});
addEventListener('keyup', e => {
  keys.delete(e.code);
  if (!swing || swing.sentAt !== undefined) return;
  const k = ({ KeyZ: 'z', KeyX: 'x', KeyC: 'c' } as Record<string, 'z' | 'x' | 'c' | undefined>)[e.code];
  if (!k) return;
  if (swing.putt) {
    if (k === 'z' && swing.z !== undefined) { net.send({ t: 'putt', aimDeg: swing.aim, drawMs: Math.round(Math.min(PUTT_MAX, e.timeStamp - swing.z)) }); swing.sentAt = performance.now(); }
  } else if (swing.held.has(k)) { swing.held.delete(k); delete swing[k]; } // released before impact: omit
});
addEventListener('blur', () => keys.clear());

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
    else if (swing.putt) {
      ui.meterShow(swing.z === undefined ? 0 : Math.min(1, (now - swing.z) / PUTT_MAX), 'Hold Z to draw back, release to strike');
      if (swing.z !== undefined && now - swing.z > PUTT_MAX + 3000) swing = null;
    } else {
      const el = now - swing.t0;
      ui.meterShow(Math.min(1, el / TOP_MS), now < swing.top ? (el < 600 ? 'Address' : 'Backswing') : 'Z, X, C now');
      if (now >= swing.top + IMPACT_MS) {
        const s = swing; net.send({ t: 'shot', clubKey: s.club, aimDeg: s.aim, ...(s.z !== undefined && { zMs: Math.round(s.z) }), ...(s.x !== undefined && { xMs: Math.round(s.x) }), ...(s.c !== undefined && { cMs: Math.round(s.c) }) });
        s.sentAt = now;
      }
    }
  } else { stuckSince = 0; ui.meterShow(null); }
  if (!swing) ui.meterShow(null);
  ui.prompt(!swing && go && me && !me.ball.holedOut && !me.anim && ownDist() <= RANGE ? 'Space: address ball' : '');
  const cd = goAt - Date.now();
  ui.countdown(cd > 0 ? String(Math.ceil(cd / 1000)) : cd > -800 ? 'GO' : '');
  if (me) {
    const dest = me.anim?.final ?? me.ball; // show the outcome distance as soon as the shot is resolved
    const d = Math.hypot(hole.pin.x - dest.x, hole.pin.z - dest.z) * YD;
    ui.info(hole, d, me.ball.surface, ui.clock(go ? (Date.now() - goAt) / 1000 : 0), me.ball.strokes);
    world.placeGolfer(me, pos.x, pos.z, swing ? swing.aim * Math.PI / 180 : yaw);
  }
  world.tick(now);
  ui.drawMini(hole, [...world.ents.values()].flatMap(e => [
    { x: e.ballMesh.position.x * -1, z: e.ballMesh.position.z, shade: e.shade, ball: true },
    { x: e.id === selfId ? pos.x : e.ball.x + 1, z: e.id === selfId ? pos.z : e.ball.z - 0.5, shade: e.shade },
  ]));
  const cam = me?.anim ? me.ballMesh.position : null; // camera follows the ball while it flies
  world.render(cam ? -cam.x : pos.x, cam ? cam.z : pos.z, swing ? swing.aim * Math.PI / 180 : yaw, pitch, cam ? Math.max(1.5, cam.y * 0.7) : 1.5);
}
requestAnimationFrame(frame);
