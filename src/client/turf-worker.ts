// Off the main thread: fetch this tier's turf JPEGs, decode, bake (tint + normal/roughness) and pack them into layer arrays.
import { TURF_LAYERS, bakeLayer } from './turf-bake';

self.onmessage = async (e: MessageEvent<{ urls: string[] }>) => {
  try {
    const px = await Promise.all(e.data.urls.map(async u => {
      const r = await fetch(u); if (!r.ok) throw new Error(`${u}: HTTP ${r.status}`);
      const bmp = await createImageBitmap(await r.blob()), c = new OffscreenCanvas(bmp.width, bmp.height), x = c.getContext('2d')!;
      x.drawImage(bmp, 0, 0); return { n: bmp.width, data: x.getImageData(0, 0, bmp.width, bmp.height).data };
    }));
    const n = px[0]!.n, m = n >> 1, L = px.length;
    if (px.some(p => p.n !== n)) throw new Error('turf tiles differ in size');
    const alb = new Uint8Array(L * n * n * 4), nrm = new Uint8Array(L * m * m * 4);
    px.forEach((p, i) => { const b = bakeLayer(p.data, n, TURF_LAYERS[i]!); alb.set(b.albedo, i * n * n * 4); nrm.set(b.normal, i * m * m * 4); });
    (self as unknown as Worker).postMessage({ n, alb, nrm }, [alb.buffer, nrm.buffer]);
  } catch (err) { (self as unknown as Worker).postMessage({ error: String(err) }); }
};
