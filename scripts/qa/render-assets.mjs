// Renders each shipped .glb headlessly under identical neutral lighting from fixed angles, for the fidelity check.
// Usage (playwright installed outside the repo): node scripts/qa/render-assets.mjs <playwright-module-dir> <out-dir> [asset ids...]
// Output: <out-dir>/<id>/<view>.jpg (640 px, neutral grey background). Decoder and three come from node_modules; no network.
import http from 'node:http'; import { readFile, mkdir } from 'node:fs/promises'; import { extname, join, resolve } from 'node:path'; import { createRequire } from 'node:module';
const [pwDir, outDir, ...ids] = process.argv.slice(2);
const { chromium } = createRequire(join(resolve(pwDir), 'x.js'))('playwright');
const ROOT = resolve(import.meta.dirname, '../..');
const VIEWS = { front: [0, 0, 1], side: [1, 0, 0], back: [0, 0, -1], top: [0, 1, 0.001], sole: [0, -1, 0.001], threequarter: [0.7, 0.45, 0.9] };
const SETS = { golfer: ['front', 'side', 'back'], tree: ['threequarter', 'front', 'top'], rock: ['threequarter', 'front', 'top'], club: ['front', 'side', 'sole', 'threequarter'] };
const kind = id => (id === 'golfer' ? 'golfer' : id.startsWith('tree') ? 'tree' : /^(rock|cliff|seawall)/.test(id) ? 'rock' : 'club');
const HTML = `<!doctype html><meta charset=utf-8><body style="margin:0"><script type=importmap>{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script>
<script type=module>
import * as THREE from 'three'; import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'; import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setSize(640, 640); document.body.append(r.domElement);
const loader = new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath('/node_modules/three/examples/jsm/libs/draco/gltf/')).setMeshoptDecoder(MeshoptDecoder);
window.show = async (id, dir) => {
  const g = await loader.loadAsync('/assets/models/' + id + '.glb'), scene = new THREE.Scene(); scene.background = new THREE.Color('#8a8a8a'); scene.add(g.scene);
  scene.add(new THREE.HemisphereLight('#ffffff', '#707070', 1.6)); const key = new THREE.DirectionalLight('#ffffff', 2.2); key.position.set(3, 5, 4); const fill = new THREE.DirectionalLight('#ffffff', 0.8); fill.position.set(-4, 2, -3); scene.add(key, fill);
  const box = new THREE.Box3().setFromObject(g.scene), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3()), d = Math.max(s.x, s.y, s.z) * 2.5;
  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 1000), v = new THREE.Vector3(...dir).normalize(); cam.position.copy(c).addScaledVector(v, d); cam.lookAt(c);
  r.render(scene, cam); let tris = 0; g.scene.traverse(o => { if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  return { size: s.toArray().map(n => +n.toFixed(3)), tris };
};
</script>`;
const T = { '.js': 'text/javascript', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.html': 'text/html' };
const srv = http.createServer(async (q, res) => { try { const p = new URL(q.url, 'http://x').pathname; if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(HTML); }
  if (!/^\/(node_modules\/three|assets\/models)\//.test(p)) { res.writeHead(404); return res.end(); } const b = await readFile(join(ROOT, p)); res.writeHead(200, { 'content-type': T[extname(p)] ?? 'application/octet-stream' }); res.end(b); } catch { res.writeHead(404); res.end(); } }).listen(0, '127.0.0.1');
await new Promise(r => srv.on('listening', r)); const port = srv.address().port;
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } : { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 640 } }); page.on('pageerror', e => console.log('PAGEERR', e.message));
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
const out = {};
for (const id of ids) {
  await mkdir(join(outDir, id), { recursive: true }); let info;
  for (const view of SETS[kind(id)]) { info = await page.evaluate(([i, d]) => window.show(i, d), [id, VIEWS[view]]); await page.screenshot({ path: join(outDir, id, `${view}.jpg`), type: 'jpeg', quality: 82 }); }
  out[id] = { ...info, views: SETS[kind(id)] };
}
console.log(JSON.stringify(out)); await browser.close(); srv.close();
