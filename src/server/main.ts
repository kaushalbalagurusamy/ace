// Deploy entry: one process serves the built client (dist/), /healthz and the ws endpoint on PORT.
import http from 'node:http';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import { LobbyManager } from './lobbies';
import { playPutt, playShot, type Played } from './race';
import { parseClientMsg } from './parse';
import { acceptMove, applyPush, atTee, contacts, type MoverState } from './movers';
import { holesOf, teeBall, type Hole } from './course';
import { gridKey, type CourseId } from '../shared/courses';
import { rankPlayers } from '../sim';
import type { BallState, ClientMsg, Mover, PlayerRace, ServerMsg } from '../shared/protocol';
import type { LobbyView } from './lobby-types';

const PORT = Number(process.env.PORT ?? 3000);
const DIST = join(process.cwd(), 'dist');
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.wasm': 'application/wasm' };

async function handle(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('ok'); return; }
  let decoded: string;
  try { decoded = decodeURIComponent(url.pathname); } catch { res.writeHead(400); res.end('bad request'); return; }
  const rel = normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  const file = join(DIST, rel === '/' || rel === '.' ? 'index.html' : rel);
  if (!file.startsWith(DIST)) { res.writeHead(403); res.end(); return; }
  try {
    const body = await readFile(file);
    // assets are static for a deploy: let browsers and the CDN cache them (never held in memory here, read from disk per request)
    const cache = /^\/(assets|draco)\//.test(url.pathname) ? 'public, max-age=3600' : url.pathname.startsWith('/assets/') ? 'no-cache' : 'no-cache';
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': cache });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
}

// Nothing may escape the async handler: an unhandled rejection would crash the process.
const server = http.createServer((req, res) => {
  handle(req, res).catch(() => { if (!res.headersSent) res.writeHead(500); res.end(); });
});

// ---- ws layer ----
const mgr = new LobbyManager();
const socks = new Map<string, WebSocket>(); // sessionId -> socket
const HOLE_CARD_S = 2; // PRD/04: 2 s hole card, then the player is moved to the next tee; the clock keeps running
const COUNTDOWN_S = 5, RACE_LIMIT_MS = 20 * 60_000, AFTER_FIRST_MS = 60_000;

interface RPlayer { name: string; hole: number; holesDone: number; ball: BallState; nextAtMs: number; finishS?: number; /** cart spawn slot */ slot: number; mv: MoverState }
interface Race { lobbyId: string; course: CourseId; holes: readonly Hole[]; goAtMs: number; players: Map<string, RPlayer>; timers: NodeJS.Timeout[]; firstFinish: boolean; /** pair key -> last bump (ms) */ bumpAt: Map<string, number> }
const MOVERS_MS = 100, BUMP_COOLDOWN_MS = 250, MOVES_PER_S = 30;
const races = new Map<string, Race>(); // lobbyId -> race
const countdowns = new Map<string, NodeJS.Timeout>();
const tokens = new Map<string, string>(); // sessionId -> secret resume token (never broadcast)
const touched = new Map<string, number>(); // lobbyId -> last activity (ms), for expiry

// No timer callback may throw out of the event loop: one bad lobby must not take every lobby down.
const safe = <A extends unknown[]>(f: (...a: A) => void) => (...a: A) => { try { f(...a); } catch (e) { console.error('timer error', e); } };
process.on('uncaughtException', e => console.error('uncaughtException', e));
process.on('unhandledRejection', e => console.error('unhandledRejection', e));

// A lobby must never stay stuck and block the 3-lobby cap: stale ones are reset or closed.
const STARTING_MAX_MS = 30_000, OPEN_IDLE_MS = 10 * 60_000, RACE_STUCK_MS = RACE_LIMIT_MS + 60_000;
setInterval(safe(() => {
  const now = Date.now();
  const live = new Set(mgr.list().map(l => l.id));
  for (const id of touched.keys()) if (!live.has(id)) touched.delete(id); // closed lobbies must not leak entries
  for (const l of mgr.list()) {
    const idle = now - (touched.get(l.id) ?? now);
    touched.set(l.id, touched.get(l.id) ?? now);
    if (l.state === 'starting' && !countdowns.has(l.id) && !races.has(l.id) && idle > STARTING_MAX_MS) mgr.setState(l.id, 'open');
    else if (l.state === 'in_race' && !races.has(l.id) && idle > STARTING_MAX_MS) mgr.setState(l.id, 'open');
    else if ((l.state === 'open' && idle > OPEN_IDLE_MS) || idle > RACE_STUCK_MS) { for (const p of l.players) { mgr.leaveLobby(p.sessionId); send(socks.get(p.sessionId), { t: 'lobby', lobby: null }); } touched.delete(l.id); }
    else continue;
    broadcastLobbies();
  }
}), 15_000).unref();

const send = (ws: WebSocket | undefined, m: ServerMsg) => { if (ws?.readyState === 1) ws.send(JSON.stringify(m)); };
const err = (ws: WebSocket, code: Extract<ServerMsg, { t: 'error' }>['code'], message: string = code) => send(ws, { t: 'error', code, message });
const toLobby = (l: LobbyView | undefined, m: ServerMsg) => l?.players.forEach(p => send(socks.get(p.sessionId), m));
const broadcastLobbies = () => { const m: ServerMsg = { t: 'lobbies', lobbies: mgr.list() }; socks.forEach(w => send(w, m)); };
const lobbyChanged = (l: LobbyView | undefined, activity = true) => { if (l && activity) touched.set(l.id, Date.now()); broadcastLobbies(); toLobby(l, { t: 'lobby', lobby: l ?? null }); };


function startCountdown(lobbyId: string) {
  let left = COUNTDOWN_S;
  const tick = () => {
    const l = mgr.list().find(x => x.id === lobbyId);
    if (!l || l.players.length === 0) { clearInterval(iv); countdowns.delete(lobbyId); return; }
    if (left > 0) { toLobby(l, { t: 'countdown', seconds: left-- }); return; }
    clearInterval(iv); countdowns.delete(lobbyId);
    beginRace(l);
  };
  const iv = setInterval(safe(tick), 1000);
  countdowns.set(lobbyId, iv);
  tick();
}

function beginRace(l: LobbyView) {
  const holes = holesOf(l.course), h = holes[0]!, goAtMs = Date.now();
  const players = new Map<string, RPlayer>();
  l.players.forEach((p, slot) => {
    players.set(p.sessionId, { name: p.name, hole: 0, holesDone: 0, nextAtMs: goAtMs, ball: teeBall(h, 0), slot, mv: atTee(gridKey(l.course, 0), slot, goAtMs) });
  });
  const race: Race = { lobbyId: l.id, course: l.course, holes, goAtMs, players, timers: [], firstFinish: false, bumpAt: new Map() };
  race.timers.push(setTimeout(safe(() => endRace(race)), RACE_LIMIT_MS));
  race.timers.push(setInterval(safe(() => broadcastMovers(race)), MOVERS_MS));   // clearTimeout also clears an interval in Node
  races.set(l.id, race);
  mgr.setState(l.id, 'in_race');
  touched.set(l.id, Date.now());
  broadcastLobbies();
  const list: PlayerRace[] = [...players].map(([id, p]) => ({ id, name: p.name, hole: p.hole, ball: { ...p.ball } }));
  toLobby(l, { t: 'raceStart', hole: h.info, players: list, goAtMs });
}

const present = (r: Race, sid: string) => mgr.lobbyOf(sid)?.id === r.lobbyId;
const allDone = (r: Race) => [...r.players].every(([id, p]) => p.finishS !== undefined || !present(r, id));

function endRace(r: Race) {
  if (races.get(r.lobbyId) !== r) return;
  races.delete(r.lobbyId);
  r.timers.forEach(clearTimeout);
  const arr = [...r.players].map(([id, p]) => ({ id, p }));
  const places = rankPlayers(arr.map(({ id, p }) => {
    const pin = r.holes[p.hole]!.info.pin;
    return { id, finishTime: p.finishS, strokes: p.ball.strokes, holesCompleted: p.holesDone,
      distanceToHole: p.finishS === undefined ? Math.hypot(p.ball.x - pin.x, p.ball.z - pin.z) : undefined };
  }));
  const results = places.map(pl => { const p = r.players.get(pl.id)!; return { id: pl.id, name: p.name, place: pl.place, timeS: p.finishS, strokes: p.ball.strokes, holes: p.holesDone }; });
  const m: ServerMsg = { t: 'raceEnd', course: r.course, results };
  r.players.forEach((_, sid) => { if (present(r, sid)) send(socks.get(sid), m); });
  // Back to open (ready flags cleared) so the same players can play again and the slot is never stuck.
  if (mgr.setState(r.lobbyId, 'open')) { touched.set(r.lobbyId, Date.now()); lobbyChanged(mgr.list().find(x => x.id === r.lobbyId)); }
}

function raceOf(sid: string) { const l = mgr.lobbyOf(sid); return l && races.get(l.id); }

function applyPlay(ws: WebSocket, sid: string, r: Race, me: RPlayer, out: Played | { error: string }, nowMs: number) {
  if ('error' in out) { err(ws, 'BAD_MESSAGE', out.error); return; }
  me.ball = out.ball;
  me.nextAtMs = nowMs + (out.flightS + out.dropWaitS) * 1000;
  const { flightS, dropWaitS, ...wire } = out;
  const lobby = mgr.lobbyOf(sid);
  toLobby(lobby, { t: 'shotResult', playerId: sid, hole: me.hole, ...wire });
  if (!out.ball.holedOut) return;
  const splitS = (nowMs - r.goAtMs) / 1000 + flightS, last = me.hole === r.holes.length - 1;
  me.holesDone++;
  toLobby(lobby, { t: 'holedOut', playerId: sid, hole: me.hole, strokes: out.ball.strokes, splitS, finished: last });
  if (!last) {
    me.nextAtMs = nowMs + (flightS + HOLE_CARD_S) * 1000;
    r.timers.push(setTimeout(safe(() => advance(r, sid, me)), (flightS + HOLE_CARD_S) * 1000));
    return;
  }
  me.finishS = splitS;
  if (allDone(r)) endRace(r);
  else if (!r.firstFinish) { r.firstFinish = true; r.timers.push(setTimeout(safe(() => endRace(r)), AFTER_FIRST_MS)); }
}

/** Moves a player who holed out to the next tee (the race clock never stopped). */
function advance(r: Race, sid: string, me: RPlayer) {
  if (races.get(r.lobbyId) !== r || !present(r, sid) || me.hole >= r.holes.length - 1) return;
  me.hole++;
  me.ball = teeBall(r.holes[me.hole]!, me.ball.strokes);
  me.nextAtMs = Date.now();
  me.mv = atTee(gridKey(r.course, me.hole), me.slot, me.nextAtMs);            // the cart comes along to the new tee
  toLobby(mgr.lobbyOf(sid), { t: 'nextHole', playerId: sid, hole: r.holes[me.hole]!.info, ball: { ...me.ball } });
}

function broadcastMovers(r: Race) {
  const players: Mover[] = [...r.players].filter(([id]) => present(r, id)).map(([id, p]) => ({ id, hole: p.hole, x: p.mv.x, z: p.mv.z, yaw: p.mv.yaw, driving: p.mv.driving, cart: p.mv.cart }));
  r.players.forEach((_, id) => { if (present(r, id)) send(socks.get(id), { t: 'movers', players }); });
}

/** A player's reported golfer and cart: refused teleports are answered with the server's state; accepted ones are checked for bumps. */
function onMove(ws: WebSocket, sid: string, r: Race, me: RPlayer, m: Extract<ClientMsg, { t: 'move' }>) {
  const now = Date.now(), next = acceptMove(me.mv, m, now, me.ball);
  if (!next) { const { x, z, driving, cart } = me.mv; send(ws, { t: 'snap', x, z, driving, cart }); me.mv.atMs = now; return; }
  me.mv = next;
  for (const [oid, o] of r.players) {
    if (oid === sid || o.hole !== me.hole || !present(r, oid)) continue;
    const key = sid < oid ? `${sid}|${oid}` : `${oid}|${sid}`;
    if (now - (r.bumpAt.get(key) ?? 0) < BUMP_COOLDOWN_MS) continue;
    const c = contacts(me.mv, o.mv);
    if (!c.a.length && !c.b.length) continue;
    r.bumpAt.set(key, now);
    for (const [who, pushes] of [[sid, c.a], [oid, c.b]] as const) for (const p of pushes) {
      applyPush(r.players.get(who)!.mv, p);
      send(socks.get(who), { t: 'bump', ...p });
    }
  }
}

/** 32-bit seed (FNV-1a) for a shot's random errors, keyed by a per-process secret so clients cannot predict dispersion. */
const SEED_SECRET = crypto.randomBytes(16).toString('hex');
function shotSeed(s: string): number {
  s = SEED_SECRET + '|' + s;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

function onMessage(ws: WebSocket, sid: string, m: ClientMsg) {
  const before = mgr.lobbyOf(sid);
  const fail = (res: { ok: boolean; error?: string }) => { if (!res.ok) { err(ws, res.error as never); return true; } return false; };
  switch (m.t) {
    case 'createLobby': case 'joinLobby': case 'ready': case 'start': case 'startSolo': case 'setCourse': {
      const res = m.t === 'createLobby' ? mgr.createLobby(sid, m.course) : m.t === 'setCourse' ? mgr.setCourse(sid, m.course) : m.t === 'joinLobby' ? mgr.joinLobby(sid, m.lobbyId) : m.t === 'ready' ? mgr.setReady(sid, m.ready) : m.t === 'start' ? mgr.start(sid) : mgr.startSolo(sid);
      if (fail(res)) return;
      lobbyChanged(mgr.lobbyOf(sid), m.t !== 'ready'); // toggling ready is not activity: it must not keep an idle lobby alive
      if (m.t === 'start' || m.t === 'startSolo') startCountdown(mgr.lobbyOf(sid)!.id);
      return;
    }
    case 'leaveLobby': {
      if (fail(mgr.leaveLobby(sid))) return;
      send(ws, { t: 'lobby', lobby: null });
      lobbyChanged(before && mgr.list().find(l => l.id === before.id));
      const r = before && races.get(before.id);
      if (r && allDone(r)) endRace(r);
      return;
    }
    case 'shot': case 'putt': {
      const r = raceOf(sid), me = r?.players.get(sid);
      if (!r || !me) return err(ws, 'NOT_IN_RACE', 'not in a race');
      const now = Date.now();
      if (me.ball.holedOut) return err(ws, 'NOT_YOUR_TURN', 'already holed out');
      if (me.mv.driving) return err(ws, 'NOT_YOUR_TURN', 'get out of the cart to play (E)');
      if (now < me.nextAtMs) return err(ws, 'NOT_YOUR_TURN', `ball still moving, wait ${((me.nextAtMs - now) / 1000).toFixed(1)}s`);
      const seed = shotSeed(`${sid}|${me.hole}|${me.ball.strokes}|${r.goAtMs}`);
      applyPlay(ws, sid, r, me, m.t === 'shot' ? playShot(r.holes[me.hole]!, me.ball, { clubKey: m.clubKey, aimDeg: m.aimDeg, holdMs: m.holdMs, fb: m.fb, io: m.io, chip: m.chip, seed }) : playPutt(r.holes[me.hole]!, me.ball, m.aimDeg, m.holdMs), now);
      return;
    }
    case 'move': {
      const r = raceOf(sid), me = r?.players.get(sid);
      if (r && me) onMove(ws, sid, r, me, m);                  // outside a race a stray move is dropped silently (sent while the race ended)
      return;
    }
    default: return err(ws, 'BAD_MESSAGE', 'unexpected hello');
  }
}

function sameToken(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function drop(sid: string) {
  const before = mgr.lobbyOf(sid);
  socks.delete(sid); tokens.delete(sid);
  mgr.disconnect(sid);
  if (before) {
    const after = mgr.list().find(l => l.id === before.id);
    lobbyChanged(after);
    const r = races.get(before.id);
    if (r && (!after || allDone(r))) endRace(r);
  } else broadcastLobbies();
}

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });
wss.on('connection', ws => {
  let sid: string | undefined, myName = '';
  ws.on('error', () => {});
  // A socket that never says hello would otherwise hold a connection (and a waiting-room slot) forever.
  const helloTimer = setTimeout(() => { if (!sid) ws.terminate(); }, 10_000);
  ws.on('close', () => clearTimeout(helloTimer));
  let windowStart = Date.now(), inWindow = 0, movesInWindow = 0; // per-socket rate limit: 40 messages per second, of which at most 30 moves
  ws.on('message', (data, isBinary) => {
    if (Date.now() - windowStart > 1000) { windowStart = Date.now(); inWindow = 0; movesInWindow = 0; }
    if (++inWindow > 40) { ws.terminate(); return; }
    try {
      if (isBinary) return err(ws, 'BAD_MESSAGE', 'text only');
      const m = parseClientMsg(data.toString());
      if (!m) return err(ws, 'BAD_MESSAGE', 'malformed message');
      if (!sid) {
        if (m.t !== 'hello') return; // ignore until hello
        // The same session reconnecting (reload, retry before the old socket's close arrived) takes over.
        const old = socks.get(m.sessionId);
        // Only the holder of the secret token may take a session over; the sessionId alone is public.
        if (old && old !== ws) {
          if (!sameToken(m.token, tokens.get(m.sessionId))) return err(ws, 'ALREADY_CONNECTED');
          drop(m.sessionId); old.terminate();
        }
        const res = mgr.connect(m.sessionId, m.name);
        if (!res.ok) return err(ws, res.error);
        sid = res.value.sessionId; myName = res.value.name;
        socks.set(sid, ws);
        tokens.set(sid, crypto.randomUUID());
        send(ws, { t: 'welcome', sessionId: sid, name: res.value.name, token: tokens.get(sid)! });
        send(ws, { t: 'lobbies', lobbies: mgr.list() });
        return;
      }
      // A repeated hello on the same socket (double submit) is harmless: re-confirm instead of erroring.
      if (m.t === 'hello') { send(ws, { t: 'welcome', sessionId: sid, name: myName, token: tokens.get(sid)! }); return; }
      if (m.t === 'move' && ++movesInWindow > MOVES_PER_S) return;   // extra position reports are dropped, not answered
      onMessage(ws, sid, m);
    } catch (e) { console.error(e); err(ws, 'BAD_MESSAGE', 'internal error'); }
  });
  ws.on('close', () => { if (sid && socks.get(sid) === ws) drop(sid); });
});

server.listen(PORT, () => console.log(`listening on ${PORT}`));
