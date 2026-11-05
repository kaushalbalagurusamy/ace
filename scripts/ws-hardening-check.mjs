// Server hardening checks against a LOCAL server: node scripts/ws-hardening-check.mjs [ws-url]
import WebSocket from 'ws';
const url = process.argv[2] ?? 'ws://localhost:3160/ws';
const open = () => new Promise(r => { const w = new WebSocket(url); w.on('open', () => r(w)); w.on('error', () => {}); });
const closed = (w, ms) => new Promise(r => { if (w.readyState === 3) return r(true); w.on('close', () => r(true)); setTimeout(() => r(false), ms); });
const a = await open();                                   // never says hello
const b = await open(); b.send(JSON.stringify({ t: 'hello', sessionId: 'rl1', name: 'RateLim' }));
await new Promise(r => setTimeout(r, 300));
for (let i = 0; i < 80; i++) b.send(JSON.stringify({ t: 'ready', ready: i % 2 === 0 }));   // flood
const c = await open(); c.send(JSON.stringify({ t: 'hello', sessionId: 'ok1', name: 'Calm' }));
const [rateLimited, helloTimedOut] = await Promise.all([closed(b, 3000), closed(a, 13000)]);
const calmStillUp = c.readyState === 1;
console.log(JSON.stringify({ rateLimited, helloTimedOut, calmStillUp }));
const pass = rateLimited && helloTimedOut && calmStillUp; console.log(pass ? 'HARDENING PASS' : 'HARDENING FAIL'); process.exit(pass ? 0 : 1);
