// Hold-time wire check against a LOCAL server: node scripts/ws-length-check.mjs [ws-url]
// holdMs must be a finite number 0..5000 (rejected otherwise); fb/io integers -2..2; the server derives length and max effort from the hold.
import WebSocket from 'ws';
const url = process.argv[2] ?? 'ws://localhost:3150/ws';
const w = new WebSocket(url), got = [];
w.on('message', d => got.push(JSON.parse(d)));
const send = o => w.send(JSON.stringify(o)), sleep = ms => new Promise(r => setTimeout(r, ms));
await new Promise(r => w.on('open', r));
send({ t: 'hello', sessionId: 'hold1', name: 'HoldCheck' }); await sleep(200);
send({ t: 'createLobby' }); await sleep(200); send({ t: 'startSolo' });
while (!got.some(m => m.t === 'raceStart')) await sleep(200);
const shoot = async (extra, wait = 400) => { const n = got.length; send({ t: 'shot', clubKey: 'O', aimDeg: 0, holdMs: 750, ...extra }); await sleep(wait); return got.slice(n).find(m => m.t === 'shotResult' || m.t === 'error'); };
const nullHold = await shoot({ holdMs: null }), strHold = await shoot({ holdMs: '500' }), badFb = await shoot({ fb: 3 }), badIo = await shoot({ io: 0.5 });
const ok25 = await shoot({ holdMs: 187.5 }, 9000);        // 25%: a 62 degree wedge should carry 40 to 75 yd
const maxe = await shoot({ holdMs: 5000 }, 14000);        // past 1.10 s: a max-effort full shot
const out = { nullHold: nullHold?.t, strHold: strHold?.t, badFb: badFb?.t, badIo: badIo?.t, valid25: ok25?.t, carry25yd: ok25 && +(ok25.carryM * 1.0936).toFixed(1), effort25: ok25?.effort, maxEffort: maxe?.effort, carryMaxYd: maxe?.carryM && +(maxe.carryM * 1.0936).toFixed(1) };
console.log(JSON.stringify(out));
const pass = [out.nullHold, out.strHold, out.badFb, out.badIo].every(t => t === 'error') && out.valid25 === 'shotResult' && out.carry25yd > 40 && out.carry25yd < 75 && out.effort25.maxEffort === false && out.maxEffort?.maxEffort === true && out.carryMaxYd > 120;
console.log(pass ? 'HOLD-WIRE PASS' : 'HOLD-WIRE FAIL'); process.exit(pass ? 0 : 1);
