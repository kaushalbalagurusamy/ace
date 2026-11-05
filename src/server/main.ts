// Deploy entry: one process serves the built client (dist/), /healthz and the ws endpoint on PORT.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { WebSocketServer } from 'ws';

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

const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', ws => ws.send('hello from server'));

server.listen(PORT, () => console.log(`listening on ${PORT}`));
