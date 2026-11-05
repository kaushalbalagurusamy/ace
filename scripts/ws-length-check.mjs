// PS-6 wire check against a LOCAL server: node scripts/ws-length-check.mjs [ws-url]
import WebSocket from 'ws';
const url = process.argv[2] ?? 'ws://localhost:3150/ws';
const w = new WebSocket(url), got = [];
w.on('message', d => got.push(JSON.parse(d)));
const send = o => w.send(JSON.stringify(o)), sleep = ms => new Promise(r => setTimeout(r, ms));
await new Promise(r => w.on('open', r));
send({ t: 'hello', sessionId: 'len1', name: 'LenCheck' }); await sleep(200);
send({ t: 'createLobby' }); await sleep(200); send({ t: 'startSolo' });
while (!got.some(m => m.t === 'raceStart')) await sleep(200);
const shoot = async (extra) => { const n = got.length; send({ t: 'shot', clubKey: 'O', aimDeg: 0, zMs: 0, xMs: 36, cMs: 90, ...extra }); await sleep(400); return got.slice(n).find(m => m.t === 'shotResult' || m.t === 'error'); };
const bad = await shoot({ length: 60 });
const badStr = await shoot({ length: '50' });
const ok = await shoot({ length: 25 });
const ok2 = ((await sleep(9000)), await shoot({ length: 100, xMs: 60, cMs: 150 }));
const out = { invalid60: bad?.t + ':' + (bad?.code ?? ''), invalidString: badStr?.t, valid25: ok?.t, carry25yd: ok && +(ok.carryM * 1.0936).toFixed(1), full: ok2?.t + ':' + (ok2?.code ?? ok2?.message ?? '') };
console.log(JSON.stringify(out));
const pass = out.invalid60.startsWith('error') && out.invalidString === 'error' && out.valid25 === 'shotResult' && out.carry25yd > 40 && out.carry25yd < 75;
console.log(pass ? 'PS-6 PASS' : 'PS-6 FAIL'); process.exit(pass ? 0 : 1);
