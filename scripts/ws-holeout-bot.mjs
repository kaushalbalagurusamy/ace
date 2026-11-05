// Plays hole 1 to the cup over the real ws protocol: node scripts/ws-holeout-bot.mjs [ws-url]
// Run against a LOCAL server unless the supervisor says otherwise. Aim is computed from the ball's reported position.
import WebSocket from 'ws';
const url = process.argv[2] ?? 'ws://localhost:3170/ws';
const w = new WebSocket(url), got = [];
w.on('message', d => got.push(JSON.parse(d)));
const send = o => w.send(JSON.stringify(o)), sleep = ms => new Promise(r => setTimeout(r, ms));
await new Promise(r => w.on('open', r));
send({ t: 'hello', sessionId: 'bot-' + Date.now(), name: 'HoleBot' }); await sleep(200);
send({ t: 'createLobby' }); await sleep(200); send({ t: 'startSolo' });
let start; while (!(start = got.find(m => m.t === 'raceStart'))) await sleep(200);
const { pin } = start.hole, YD = 1.0936133;
let ball = { x: start.players[0].ball.x, z: start.players[0].ball.z }, strokes = 0, log = [];
const dist = () => Math.hypot(pin.x - ball.x, pin.z - ball.z);
const aim = () => ((Math.atan2(pin.x - ball.x, pin.z - ball.z) * 180 / Math.PI) + 360) % 360;
const next = async (msg) => {
  const n = got.length; send(msg); let r;
  for (let i = 0; i < 50 && !(r = got.slice(n).find(m => m.t === 'shotResult' || m.t === 'error')); i++) await sleep(100);
  return r;
};
for (let shot = 0; shot < 14 && !got.some(m => m.t === 'holedOut'); shot++) {
  const d = dist(), yd = d * YD, onGreen = d <= start.hole.greenRadius;
  let msg;
  if (onGreen) { const v0 = Math.sqrt(2 * 0.5486 * d + 1.1); msg = { t: 'putt', aimDeg: aim(), drawMs: Math.round(v0 / 15 * 1500) }; }
  else {
    // pick the longest sensible club/length that does not overshoot the pin by much
    const opts = [['1', 100, 336], ['7', 100, 220], ['O', 100, 132], ['O', 75, 110], ['O', 50, 79], ['O', 25, 47]];
    const pick = opts.find(([, , c]) => c <= yd + 5) ?? opts.at(-1);
    const sc = { 25: 0.6, 50: 0.75, 75: 0.9, 100: 1 }[pick[1]];
    msg = { t: 'shot', clubKey: pick[0], aimDeg: aim(), length: pick[1], zMs: 0, xMs: 60 * sc, cMs: 150 * sc };
  }
  const r = await next(msg);
  if (!r || r.t === 'error') { log.push(`shot ${shot + 1}: ${r ? r.t + ':' + (r.message ?? r.code) : 'no response'}`); break; }
  ball = { x: r.ball.x, z: r.ball.z }; strokes = r.ball.strokes;
  log.push(`${msg.t}${msg.clubKey ? ' ' + msg.clubKey + '@' + msg.length : ''} -> ${(Math.hypot(pin.x - ball.x, pin.z - ball.z) * YD).toFixed(1)} yd left, strokes ${strokes}, ${r.ball.surface}${r.penalty ? ', PENALTY' : ''}${r.ball.holedOut ? ', HOLED OUT' : ''}`);
  if (r.ball.holedOut) break;
  const last = r.samples.at(-1).t; await sleep(Math.min(20000, last * 1000 + 300));
}
await sleep(1500);
console.log(log.join('\n'));
const holed = got.find(m => m.t === 'holedOut'), end = got.find(m => m.t === 'raceEnd');
console.log('holedOut:', JSON.stringify(holed), '\nraceEnd:', JSON.stringify(end?.results));
const pass = !!holed && !!end && end.results[0]?.place === 1; console.log(pass ? 'HOLE-OUT PASS' : 'HOLE-OUT FAIL'); process.exit(pass ? 0 : 1);
