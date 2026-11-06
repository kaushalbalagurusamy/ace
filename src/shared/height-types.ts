/** One hole's height field and anchors, as scripts/build-course.mjs writes them (src/shared/courses/<id>-height.ts). */
export interface HoleHeight {
  /** OSM hole ref, par and yardage (OSM tags, else the game card or the straight tee-to-green distance) */ ref: number; par: number | null; yards: number;
  /** OSM tee (first node of the hole way) and green, [lat, lon] */ tee: [number, number]; green: [number, number];
  x0: number; z0: number; cell: number; nx: number; nz: number;
  /** real tee elevation above sea level, m */ teeElevM: number;
  /** real metres per game metre */ scale: number;
  /** centimetres above the tee, int16 little-endian, base64; row j (z = z0 + j*cell) of nx nodes from x0 */ data: string;
}
