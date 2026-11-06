// Removes the generated cart's own wheels so the code-built ones (which spin, steer and ride the suspension) take their place.
// Usage: node scripts/cut_cart_wheels.mjs <dir-with-@gltf-transform/core> <in.glb> <out.glb> [cx yc zc r]
// Defaults are measured on the Rodin cart-body raw mesh (scratch profiling of its lowest point per z and x histograms): wheel
// centres at x = ±cx.. (outboard of |x| > cx), y = yc, z = ±zc, radius r, in the raw model's units. A triangle goes when its
// centroid is inside one of those four cylinders (axis along x). Prints the triangle counts.
import { createRequire } from 'node:module'; import { join, resolve } from 'node:path';
const [dir, inp, out, ...nums] = process.argv.slice(2);
const { NodeIO } = createRequire(join(resolve(dir), 'x.js'))('@gltf-transform/core');
const [cx, yc, zc, r] = nums.length ? nums.map(Number) : [0.26, -0.21, 0.70, 0.235];
const io = new NodeIO(), doc = await io.read(inp);
for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
  const pos = prim.getAttribute('POSITION').getArray(), idx = prim.getIndices(), ia = idx.getArray(), keep = [];
  const p = (k, c) => pos[ia[k] * 3 + c];
  for (let t = 0; t < ia.length; t += 3) {
    const x = (p(t, 0) + p(t + 1, 0) + p(t + 2, 0)) / 3, y = (p(t, 1) + p(t + 1, 1) + p(t + 2, 1)) / 3, z = (p(t, 2) + p(t + 1, 2) + p(t + 2, 2)) / 3;
    const wheel = Math.abs(x) > cx && Math.hypot(y - yc, Math.abs(z) - zc) < r;
    if (!wheel) keep.push(ia[t], ia[t + 1], ia[t + 2]);
  }
  console.log(`triangles ${ia.length / 3} -> ${keep.length / 3}`);
  idx.setArray(new Uint32Array(keep));
}
await io.write(out, doc);
