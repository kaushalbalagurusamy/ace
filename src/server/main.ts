// Deploy entry: one process serves the built client (dist/), /healthz and the ws endpoint on PORT.
import http from 'node:http';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import { LobbyManager } from './lobbies';
import { hole, playPutt, playShot, type Hole, type Played } from './race';
import { rankPlayers } from '../sim';
import type { BallState, ClientMsg, PlayerRace, ServerMsg } from '../shared/protocol';
import type { LobbyView } from './lobby-types';

const PORT = Number(process.env.PORT ?? 3000);
const DIST = join(process.cwd(), 'dist');
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.glb': 'model/gltf-binary' };

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
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
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
const COUNTDOWN_S = 5, RACE_LIMIT_MS = 20 * 60_000, AFTER_FIRST_MS = 60_000;

interface RPlayer { name: string; ball: BallState; nextAtMs: number; finishS?: number }
interface Race { lobbyId: string; hole: Hole; goAtMs: number; players: Map<string, RPlayer>; timers: NodeJS.Timeout[]; firstFinish: boolean }
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

const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const optNum = (v: unknown) => v === undefined || num(v);
function parse(raw: string): ClientMsg | null {
  let m: any;
  try { m = JSON.parse(raw); } catch { return null; }
  if (!m || typeof m !== 'object' || typeof m.t !== 'string') return null;
  switch (m.t) {
    case 'hello': return (m.token === undefined || typeof m.token === 'string') && typeof m.sessionId === 'string' && m.sessionId.length >= 1 && m.sessionId.length <= 64 && typeof m.name === 'string' && m.name.length <= 64 ? m : null;
    case 'createLobby': case 'leaveLobby': case 'start': case 'startSolo': return m;
    case 'joinLobby': return typeof m.lobbyId === 'string' ? m : null;
    case 'ready': return typeof m.ready === 'boolean' ? m : null;
    case 'shot': return typeof m.clubKey === 'string' && num(m.aimDeg) && optNum(m.zMs) && optNum(m.xMs) && optNum(m.cMs) && optNum(m.length) ? m : null;
    case 'putt': return num(m.aimDeg) && num(m.drawMs) ? m : null;
    default: return null;
  }
}

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
  const h = hole(0), goAtMs = Date.now();
  const players = new Map<string, RPlayer>();
  for (const p of l.players) {
    players.set(p.sessionId, { name: p.name, nextAtMs: goAtMs, ball: { x: h.info.tee.x, z: h.info.tee.z, strokes: 0, holedOut: false, surface: h.surfaceAt(h.info.tee.x, h.info.tee.z) } });
  }
  const race: Race = { lobbyId: l.id, hole: h, goAtMs, players, timers: [], firstFinish: false };
  race.timers.push(setTimeout(safe(() => endRace(race)), RACE_LIMIT_MS));
  races.set(l.id, race);
  mgr.setState(l.id, 'in_race');
  touched.set(l.id, Date.now());
  broadcastLobbies();
  const list: PlayerRace[] = [...players].map(([id, p]) => ({ id, name: p.name, hole: 0, ball: { ...p.ball } }));
  toLobby(l, { t: 'raceStart', hole: h.info, players: list, goAtMs });
}

const present = (r: Race, sid: string) => mgr.lobbyOf(sid)?.id === r.lobbyId;

function endRace(r: Race) {
  if (races.get(r.lobbyId) !== r) return;
  races.delete(r.lobbyId);
  r.timers.forEach(clearTimeout);
  const pin = r.hole.info.pin;
  const arr = [...r.players].map(([id, p]) => ({ id, p }));
  const places = rankPlayers(arr.map(({ id, p }) => ({
    id, finishTime: p.finishS, strokes: p.ball.strokes, holesCompleted: p.ball.holedOut ? 1 : 0,
    distanceToHole: p.ball.holedOut ? undefined : Math.hypot(p.ball.x - pin.x, p.ball.z - pin.z),
  })));
  const results = places.map(pl => { const p = r.players.get(pl.id)!; return { id: pl.id, name: p.name, place: pl.place, timeS: p.finishS, strokes: p.ball.strokes, holes: p.ball.holedOut ? 1 : 0 }; });
  const m: ServerMsg = { t: 'raceEnd', results };
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
  toLobby(lobby, { t: 'shotResult', playerId: sid, ...wire });
  if (!out.ball.holedOut) return;
  me.finishS = (nowMs - r.goAtMs) / 1000 + flightS;
  toLobby(lobby, { t: 'holedOut', playerId: sid, strokes: out.ball.strokes, splitS: me.finishS });
  if ([...r.players].every(([id, p]) => p.ball.holedOut || !present(r, id))) endRace(r);
  else if (!r.firstFinish) { r.firstFinish = true; r.timers.push(setTimeout(safe(() => endRace(r)), AFTER_FIRST_MS)); }
}

function onMessage(ws: WebSocket, sid: string, m: ClientMsg) {
  const before = mgr.lobbyOf(sid);
  const fail = (res: { ok: boolean; error?: string }) => { if (!res.ok) { err(ws, res.error as never); return true; } return false; };
  switch (m.t) {
    case 'createLobby': case 'joinLobby': case 'ready': case 'start': case 'startSolo': {
      const res = m.t === 'createLobby' ? mgr.createLobby(sid) : m.t === 'joinLobby' ? mgr.joinLobby(sid, m.lobbyId) : m.t === 'ready' ? mgr.setReady(sid, m.ready) : m.t === 'start' ? mgr.start(sid) : mgr.startSolo(sid);
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
      if (r && [...r.players].every(([id, p]) => p.ball.holedOut || !present(r, id))) endRace(r);
      return;
    }
    case 'shot': case 'putt': {
      const r = raceOf(sid), me = r?.players.get(sid);
      if (!r || !me) return err(ws, 'NOT_IN_RACE', 'not in a race');
      const now = Date.now();
      if (me.ball.holedOut) return err(ws, 'NOT_YOUR_TURN', 'already holed out');
      if (now < me.nextAtMs) return err(ws, 'NOT_YOUR_TURN', `ball still moving, wait ${((me.nextAtMs - now) / 1000).toFixed(1)}s`);
      applyPlay(ws, sid, r, me, m.t === 'shot' ? playShot(r.hole, me.ball, m) : playPutt(r.hole, me.ball, m.aimDeg, m.drawMs), now);
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
    if (r && (!after || [...r.players].every(([id, p]) => p.ball.holedOut || !present(r, id)))) endRace(r);
  } else broadcastLobbies();
}

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });
wss.on('connection', ws => {
  let sid: string | undefined, myName = '';
  ws.on('error', () => {});
  // A socket that never says hello would otherwise hold a connection (and a waiting-room slot) forever.
  const helloTimer = setTimeout(() => { if (!sid) ws.terminate(); }, 10_000);
  ws.on('close', () => clearTimeout(helloTimer));
  let windowStart = Date.now(), inWindow = 0; // per-socket rate limit: 40 messages per second
  ws.on('message', (data, isBinary) => {
    if (Date.now() - windowStart > 1000) { windowStart = Date.now(); inWindow = 0; }
    if (++inWindow > 40) { ws.terminate(); return; }
    try {
      if (isBinary) return err(ws, 'BAD_MESSAGE', 'text only');
      const m = parse(data.toString());
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
      onMessage(ws, sid, m);
    } catch (e) { console.error(e); err(ws, 'BAD_MESSAGE', 'internal error'); }
  });
  ws.on('close', () => { if (sid && socks.get(sid) === ws) drop(sid); });
});

server.listen(PORT, () => console.log(`listening on ${PORT}`));
