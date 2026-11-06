import { describe, expect, it } from 'vitest';
import { nextSlide, SLIDES } from '../src/client/backdrop';

describe('backdrop slide scheduler', () => {
  it('advances to the next loaded slide and wraps around', () => {
    expect(nextSlide(0, [true, true, true])).toBe(1);
    expect(nextSlide(2, [true, true, true])).toBe(0);
  });
  it('skips slides whose image has not loaded yet', () => {
    expect(nextSlide(0, [true, false, true])).toBe(2);
    expect(nextSlide(2, [false, false, true, true])).toBe(3);
  });
  it('stays put rather than fading to a blank when nothing else is ready', () => {
    expect(nextSlide(1, [false, true, false])).toBe(1);
    expect(nextSlide(0, [false, false])).toBe(0);
  });
  it('captions every slide without baking text into the images', () => {
    expect(SLIDES.length).toBeGreaterThanOrEqual(6);
    for (const s of SLIDES) expect(s.cap).toMatch(/\S/);
    expect(new Set(SLIDES.map(s => s.id)).size).toBe(SLIDES.length);
  });
});
