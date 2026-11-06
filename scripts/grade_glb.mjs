// Colour-grades a generated GLB's base-colour textures toward photo swatches (docs/research/pebble-look.md), keeping the generated detail.
// Pixels are split by hue into foliage (green) and the rest (bark, rock); each group's mean colour is moved to its target by a per-channel gain,
// so the texture's own variation (cracks, lichen, tufts) survives. Also scales roughness up (Rodin/Meshy rock reads too glossy).
// Usage: node scripts/grade_glb.mjs IN.glb OUT.glb [--green #2E4630] [--rest #B3AC9C] [--sat 0.8] [--rough 1] [--blur 0.8] [--squash 0.6]
// Libraries come from the gltf-transform npx cache (same one the gen scripts call); set GT_MODULES to override.
import { createRequire } from 'node:module';
const req = createRequire((process.env.GT_MODULES ?? '/Users/kaushal/.npm/_npx/a6797f7ff67bb1f2/node_modules') + '/x.js');
const { NodeIO } = req('@gltf-transform/core'); const { ALL_EXTENSIONS } = req('@gltf-transform/extensions'); const sharp = req('sharp');
const draco3d = req('draco3dgltf');

const [inp, out, ...rest] = process.argv.slice(2);
const opt = {}; for (let i = 0; i < rest.length; i += 2) opt[rest[i].slice(2)] = rest[i + 1];
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const targets = { green: opt.green && hex(opt.green), rest: opt.rest && hex(opt.rest) }; const sat = +(opt.sat ?? 1);
// shortcut: hue test is a fixed G-dominance rule, fine for green foliage vs grey/brown bark and rock; upgrade to a k-means split if a model mixes green lichen into rock.
const isGreen = (r, g, b) => g > r * 1.04 && g > b * 1.02;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule(), 'draco3d.encoder': await draco3d.createEncoderModule() });
const doc = await io.read(inp);
for (const mat of doc.getRoot().listMaterials()) {
  const tex = mat.getBaseColorTexture();
  if (tex) {
    const { data, info } = await sharp(Buffer.from(tex.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const sum = { green: [0, 0, 0, 0], rest: [0, 0, 0, 0] }, cls = new Uint8Array(info.width * info.height);
    for (let p = 0, k = 0; p < data.length; p += 4, k++) { const g = isGreen(data[p], data[p + 1], data[p + 2]) ? 'green' : 'rest'; cls[k] = g === 'green'; const s = sum[g]; s[0] += data[p]; s[1] += data[p + 1]; s[2] += data[p + 2]; s[3]++; }
    const gain = {}; for (const g of ['green', 'rest']) gain[g] = targets[g] && sum[g][3] ? targets[g].map((t, c) => t / Math.max(1, sum[g][c] / sum[g][3])) : [1, 1, 1];
    for (let p = 0, k = 0; p < data.length; p += 4, k++) {
      const gg = gain[cls[k] ? 'green' : 'rest']; let [r, g, b] = [data[p] * gg[0], data[p + 1] * gg[1], data[p + 2] * gg[2]];
      const l = 0.299 * r + 0.587 * g + 0.114 * b; [r, g, b] = [r, g, b].map(v => l + (v - l) * sat);
      data[p] = Math.min(255, r); data[p + 1] = Math.min(255, g); data[p + 2] = Math.min(255, b);
    }
    console.log(mat.getName() || 'material', 'means before', Object.fromEntries(Object.entries(sum).map(([g, s]) => [g, s[3] ? s.slice(0, 3).map(v => Math.round(v / s[3])) : null])), 'share green', (sum.green[3] / cls.length).toFixed(2));
    let img = sharp(data, { raw: info }); if (opt.blur) img = img.blur(+opt.blur);   // --blur softens over-sharpened generator noise
    tex.setImage(new Uint8Array(await img.png().toBuffer())).setMimeType('image/png');
    mat.setBaseColorFactor([1, 1, 1, mat.getBaseColorFactor()[3]]);
  }
  if (opt.rough) mat.setRoughnessFactor(+opt.rough).setMetallicFactor(0);
}
// --squash Y: scale the model vertically (e.g. 0.6 turns a block into a low shelf); applied to the scene's top-level nodes
if (opt.squash) for (const n of doc.getRoot().listScenes()[0].listChildren()) { const s = n.getScale(); n.setScale([s[0], s[1] * +opt.squash, s[2]]); }
await io.write(out, doc);
