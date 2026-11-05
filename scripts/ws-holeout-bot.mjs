// Plays the whole card to the cup over the real ws protocol: node scripts/ws-holeout-bot.mjs [ws-url] [holes]
// Default 18 holes (C18-5). Run against a LOCAL server unless the supervisor says otherwise.
// Aim is computed from the ball's reported position, shots use perfect scaled timings.
import WebSocket from 'ws';
const url = process.argv[2] ?? 'ws://localhost:3170/ws', HOLES = Number(process.argv[3] ?? 18);
const w = new WebSocket(url), got = [];
w.on('message', d => got.push(JSON.parse(d)));
const send = o => w.send(JSON.stringify(o)), sleep = ms => new Promise(r => setTimeout(r, ms));
await new Promise(r => w.on('open', r));
send({ t: 'hello', sessionId: 'bot-' + Date.now(), name: 'HoleBot' }); await sleep(200);
send({ t: 'createLobby' }); await sleep(200); send({ t: 'startSolo' });
let start; while (!(start = got.find(m => m.t === 'raceStart'))) await sleep(200);
const YD = 1.0936133;
let hole = start.hole, ball = { x: start.players[0].ball.x, z: start.players[0].ball.z }, shots = 0, holesDone = 0, seen = 0;
const log = [];
const dist = () => Math.hypot(hole.pin.x - ball.x, hole.pin.z - ball.z);
const aim = () => ((Math.atan2(hole.pin.x - ball.x, hole.pin.z - ball.z) * 180 / Math.PI) + 360) % 360;
const OPTS = [['1', 100, 336], ['5', 100, 246], ['7', 100, 220], ['0', 100, 178], ['=', 100, 152], ['O', 100, 132], ['O', 75, 110], ['O', 50, 79], ['O', 25, 47]];
const next = async (msg) => { const n = got.length; send(msg); let r;
  for (let i = 0; i < 60 && !(r = got.slice(n).find(m => m.t === 'shotResult' || m.t === 'error')); i++) await sleep(100); return r; };
const finished = () => got.some(m => m.t === 'raceEnd');
while (!finished() && shots < 14 * HOLES) {
  const d = dist(), yd = d * YD, onGreen = d <= hole.greenRadius; let msg;
  if (onGreen) { const v0 = Math.sqrt(2 * 0.5486 * d + 1.1); msg = { t: 'putt', aimDeg: aim(), drawMs: Math.round(v0 / 15 * 1500) }; }
  else { const pick = OPTS.find(([, , c]) => c <= yd + 5) ?? OPTS.at(-1), sc = { 25: 0.6, 50: 0.75, 75: 0.9, 100: 1 }[pick[1]];
    msg = { t: 'shot', clubKey: pick[0], aimDeg: aim(), length: pick[1], zMs: 0, xMs: 60 * sc, cMs: 150 * sc }; }
  const r = await next(msg); shots++;
  if (!r || r.t === 'error') { if (process.env.VERBOSE) log.push(`  error: ${r?.message}`); if (r?.message?.includes('still moving')) { await sleep(1500); continue; } log.push(`hole ${hole.index + 1} shot ${shots}: ${r ? r.t + ':' + (r.message ?? r.code) : 'no response'}`); break; }
  ball = { x: r.ball.x, z: r.ball.z };
  if (process.env.VERBOSE) log.push(`  ${msg.t} ${msg.clubKey ?? ''}${msg.length ? '@' + msg.length : ''} aim ${msg.aimDeg.toFixed(1)} -> ${(dist() * YD).toFixed(1)} yd left, ${r.ball.surface}${r.penalty ? ', PENALTY' : ''}`);
  if (r.ball.holedOut) {
    holesDone++; log.push(`hole ${hole.index + 1} par ${hole.par}: holed out, total strokes ${r.ball.strokes}`);
    if (hole.index === HOLES - 1 || hole.index === 17) { await sleep(1500); break; }
    const t0 = Date.now(); let nh; while (!(nh = got.find((m, i) => m.t === 'nextHole' && i >= seen)) && Date.now() - t0 < 30000) await sleep(100);
    if (!nh) { log.push('no nextHole after hole-out'); break; }
    seen = got.indexOf(nh) + 1; log.push(`  nextHole after ${((Date.now() - t0) / 1000).toFixed(1)} s wait: hole ${nh.hole.index + 1}, strokes carried ${nh.ball.strokes}`);
    hole = nh.hole; ball = { x: nh.ball.x, z: nh.ball.z }; continue;
  }
  await sleep(Math.min(20000, r.samples.at(-1).t * 1000 + 300));
}
await sleep(1500);
console.log(log.join('\n'));
const end = got.find(m => m.t === 'raceEnd'), me = end?.results?.[0];
console.log('raceEnd:', JSON.stringify(me));
const pass = HOLES === 18 ? (!!me && me.holes === 18 && me.place === 1 && me.timeS > 0) : holesDone >= HOLES;
console.log(pass ? 'HOLE-OUT PASS' : 'HOLE-OUT FAIL', `(${holesDone} holes, ${shots} shots)`); process.exit(pass ? 0 : 1);
