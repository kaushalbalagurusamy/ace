#!/usr/bin/env python3
"""Removes every animation clip from a .glb (Meshy's rigging returns preset walk/run clips; the brief bans pre-made animation).
  python3 scripts/glb_strip_animations.py IN.glb OUT.glb
The orphaned accessors stay in the buffer until `gltf-transform optimize` prunes them, so run that next."""
import json, struct, sys

src, dst = sys.argv[1], sys.argv[2]
d = open(src, 'rb').read()
assert d[:4] == b'glTF', 'not a glb'
jl = struct.unpack('<I', d[12:16])[0]
j = json.loads(d[20:20 + jl]); rest = d[20 + jl:]
n = len(j.pop('animations', []))
js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * (-len(js) % 4)
out = struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(js) + len(rest)) + struct.pack('<I4s', len(js), b'JSON') + js + rest
open(dst, 'wb').write(out); print(f'removed {n} animation(s) -> {dst}')
