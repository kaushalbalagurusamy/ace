// Home-screen backdrop: generated aerial views of Pebble Beach holes that crossfade every 8 s with a slow Ken Burns move.
// Images live in assets/backdrops/ (manifest rows bg-*); each has a 640 px placeholder painted under the full image.

export const SLIDES = [
  { id: 'bg-hole-07', cap: 'Hole 7 · Par 3 · 106 yd' },
  { id: 'bg-hole-18', cap: 'Hole 18 · Par 5 · 543 yd' },
  { id: 'bg-hole-08', cap: 'Hole 8 · Par 4 · 418 yd' },
  { id: 'bg-coast', cap: 'Carmel Bay · Pebble Beach Golf Links' },
  { id: 'bg-hole-17', cap: 'Hole 17 · Par 3 · 208 yd' },
  { id: 'bg-hole-06', cap: 'Hole 6 · Par 5 · 524 yd' },
  { id: 'bg-hole-04', cap: 'Hole 4 · Par 4 · 331 yd' },
] as const;
export const HOLD_MS = 8000;
const url = (id: string, sm = false) => `/assets/backdrops/${id}${sm ? '-sm' : ''}.webp`;

/** The next slide after `cur` whose full image has loaded; `cur` itself when none has (never fade to a blank). */
export function nextSlide(cur: number, ready: readonly boolean[]): number {
  for (let k = 1; k <= ready.length; k++) { const j = (cur + k) % ready.length; if (ready[j]) return j; }
  return cur;
}

export class Backdrop {
  readonly el = Object.assign(document.createElement('div'), { className: 'bd' });
  private layers: HTMLElement[];
  private cap: HTMLElement;
  private ready = SLIDES.map(() => false);
  private asked = SLIDES.map(() => false);
  private cur = 0; private front = 0;
  constructor() {
    this.el.setAttribute('aria-hidden', 'true');
    this.el.innerHTML = `<div class="bd-l"></div><div class="bd-l"></div><div class="bd-scrim"></div><div class="bd-cap"></div>`;
    this.layers = [...this.el.querySelectorAll<HTMLElement>('.bd-l')];
    this.cap = this.el.querySelector('.bd-cap')!;
    this.show(0);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;   // a still image, no cycling
    setInterval(() => {
      if (document.hidden || !this.el.offsetParent) return;                 // paused while the race (or another tab) is showing
      const n = nextSlide(this.cur, this.ready); if (n !== this.cur) this.show(n);
    }, HOLD_MS);
  }
  private preload(i: number) {
    if (this.asked[i]) return; this.asked[i] = true;
    const img = new Image(); img.onload = () => { this.ready[i] = true; }; img.src = url(SLIDES[i]!.id);
  }
  private show(i: number) {
    const s = SLIDES[i]!, prev = this.layers[this.front]!; this.front ^= 1;
    const l = this.layers[this.front]!;
    l.style.backgroundImage = `url(${url(s.id)}), url(${url(s.id, true)})`;   // the placeholder shows until the full image paints over it
    l.style.setProperty('--kx', `${i % 2 ? -2 : 2}%`); l.style.setProperty('--ky', `${i % 3 === 0 ? -1.5 : 1.5}%`);
    l.classList.remove('kb'); void l.offsetWidth; l.classList.add('kb', 'on');   // restart the Ken Burns move; the old layer keeps drifting while it fades
    prev.classList.remove('on');
    this.cap.textContent = s.cap; this.cur = i;
    this.preload(i); this.preload((i + 1) % SLIDES.length);
  }
}
