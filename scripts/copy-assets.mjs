// Copies the shipped assets into public/ so Vite serves them: models (not raw/), textures, audio, the manifest, and the Draco decoder.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
const out = 'public';
rmSync(out, { recursive: true, force: true });
const copyDir = (from, to, keep = () => true) => { if (!existsSync(from)) return; mkdirSync(to, { recursive: true }); for (const f of readdirSync(from, { withFileTypes: true })) if (f.isFile() && keep(f.name)) cpSync(join(from, f.name), join(to, f.name)); };
copyDir('assets/models', join(out, 'assets/models'), n => n.endsWith('.glb'));
if (existsSync('assets/textures')) cpSync('assets/textures', join(out, 'assets/textures'), { recursive: true });   // includes turf/<512|1024|2048>/
copyDir('assets/audio', join(out, 'assets/audio'));
copyDir('assets/backdrops', join(out, 'assets/backdrops'), n => n.endsWith('.webp'));
if (existsSync('assets/manifest.json')) { mkdirSync(join(out, 'assets'), { recursive: true }); cpSync('assets/manifest.json', join(out, 'assets/manifest.json')); }
copyDir('node_modules/three/examples/jsm/libs/draco/gltf', join(out, 'draco'));
console.log('assets copied to public/');
