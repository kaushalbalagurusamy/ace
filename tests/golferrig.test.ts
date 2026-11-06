import { describe, expect, it } from 'vitest';
import { requiredDrop } from '../src/client/golferrig';

describe('feet stay on the ground', () => {
  it('drops the hip only when a straight leg cannot reach its ground target', () => {
    expect(requiredDrop([0, 0.9, 0], [0, 0.08, 0], 0.9)).toBe(0);              // already reaches
    expect(requiredDrop([0, 1.0, 0], [0, 0.08, 0], 0.8)).toBeCloseTo(0.12, 9);   // straight down: 0.92 needed, 0.8 long
    const d = requiredDrop([0.3, 1.0, 0], [0, 0.08, 0], 0.8);                   // a splayed leg reaches exactly after the drop
    expect(Math.hypot(0.3, 1.0 - d - 0.08)).toBeCloseTo(0.8, 9);
  });
});
