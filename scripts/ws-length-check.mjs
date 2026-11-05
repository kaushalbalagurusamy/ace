// SH-7 wire check against a LOCAL server: node scripts/ws-length-check.mjs [ws-url]
// Non-finite or non-numeric lengths are rejected; any finite fraction is accepted and clamped to 0.05..1.
import WebSocket from 'ws';
const url = process.argv[2] ?? 'ws://localhost:3150/ws';
const w = new WebSocket(url), got = [];
w.on('message', d => got.push(JSON.parse(d)));
const send = o => w.send(JSON.stringify(o)), sleep = ms => new Promise(r => setTimeout(r, ms));
await new Promise(r => w.on('open', r));
send({ t: 'hello', sessionId: 'len1', name: 'LenCheck' }); await sleep(200);
send({ t: 'createLobby' }); await sleep(200); send({ t: 'startSolo' });
while (!got.some(m => m.t === 'raceStart')) await sleep(200);
const shoot = async (extra, wait = 400) => { const n = got.length; send({ t: 'shot', clubKey: 'O', aimDeg: 0, zMs: 0, xMs: 36, cMs: 90, ...extra }); await sleep(wait); return got.slice(n).find(m => m.t === 'shotResult' || m.t === 'error'); };
const nullLen = await shoot({ length: null });       // JSON has no NaN: null stands for a bad number
const strLen = await shoot({ length: '0.5' });
const ok25 = await shoot({ length: 0.25 }, 9000);    // flight and roll lock the next shot for a few seconds
const clampHi = await shoot({ length: 7 }, 12000);   // clamped to 1: a full 62 degree wedge
const out = { null: nullLen?.t, string: strLen?.t, valid25: ok25?.t, carry25yd: ok25 && +(ok25.carryM * 1.0936).toFixed(1), clampedHigh: clampHi?.t + ':' + (clampHi?.message ?? ''), carryHighYd: clampHi?.carryM && +(clampHi.carryM * 1.0936).toFixed(1) };
console.log(JSON.stringify(out));
const pass = out.null === 'error' && out.string === 'error' && out.valid25 === 'shotResult' && out.carry25yd > 40 && out.carry25yd < 75 && out.clampedHigh.startsWith('shotResult') && out.carryHighYd > 100;
console.log(pass ? 'SH-7 PASS' : 'SH-7 FAIL'); process.exit(pass ? 0 : 1);
