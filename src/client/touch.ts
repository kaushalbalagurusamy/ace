// Touch controls for phones (owner: one-finger pull to walk/turn/drive, pull length = swing power, every HUD action a button).
// Buttons replay the desktop keys as synthetic KeyboardEvents, so main.ts keeps one copy of the game logic.
import { FULL_TURN_MS, MAX_EFFORT_HOLD_MS } from '../sim/length';

/** Pull below this many px is a cancelled swing (stays in the stance). */
export const TAP_PX = 8;
/** A pull of this fraction of the screen height is a full turn (750 ms); further pulls reach the MAX-effort zone. */
export const FULL_PULL = 0.35;
/** Joystick radius in px: an offset this far is full stick. */
export const STICK_PX = 70;

/** Swing pull length (px, downward) to the hold time the swing FSM would have seen; null = too short, no shot.
 *  Full swings run on to 1100 ms (MAX effort); putts and chips stop at the full turn, as their hold does. */
export function pullToHoldMs(pullPx: number, screenH: number, capped: boolean): number | null {
  if (pullPx < TAP_PX) return null;
  const ms = (pullPx / (FULL_PULL * screenH)) * FULL_TURN_MS;
  return Math.round(Math.min(ms, capped ? FULL_TURN_MS : MAX_EFFORT_HOLD_MS));
}

/** The keyboard prompts, reworded for the touch buttons. */
const TEXT: [string | RegExp, string][] = [
  ['Space: take your stance', 'Tap Swing to take your stance'], [/E: get (in|out)/g, 'Cart: get $1'], ['WASD drive', 'Pull to drive'],
  ['Close the rangefinder (M) to swing', 'Close the map to swing'], ['Hold Space, release to putt', 'Pull down, release to putt'],
  ['Hold Space, release to hit · Shift: chip', 'Pull down, release to hit · Chip button'], ['hold Space, release · Shift: full swing', 'pull down, release · Chip: full swing'],
  ['hold on for MAX effort', 'pull further for MAX effort'],
];
export const touchText = (s: string) => TEXT.reduce((t, [a, b]) => t.replace(a, b), s);

export type Ctx = { race: boolean; driving: boolean; stance: boolean; nearCart: boolean; putt: boolean; map: boolean; chip: boolean };
const key = (code: string, down: boolean) => dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
const tap = (code: string) => { key(code, true); key(code, false); };

const CSS = `
#touch{display:none}body.touch #touch{display:block}body.touch #keys{display:none}
#touch,#touch *{touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
.tb{position:absolute;pointer-events:auto;min-width:52px;height:52px;border-radius:26px;border:1px solid rgba(255,255,255,.35);background:rgba(20,28,24,.72);color:#fff;font:600 13px system-ui;padding:0 10px;display:none;align-items:center;justify-content:center}
.tb.on{display:flex}.tb.lit{background:#d6b45a;color:#14231b;border-color:#d6b45a}.tb:active{filter:brightness(1.4)}
#tc{position:absolute;right:max(10px,env(safe-area-inset-right));bottom:max(10px,env(safe-area-inset-bottom));display:grid;grid-template-columns:repeat(3,56px);grid-auto-rows:52px;gap:8px;grid-template-areas:"shift map cart" "swing swing swing"}
#tc.st{grid-template-areas:"bl bu br" "aiml bd aimr" "chip . x"}#tc .tb{position:static;min-width:0;padding:0 4px;font-size:12px}
#tc .big{background:rgba(214,180,90,.9);color:#14231b;font-size:17px;height:60px}
${['shift','map','cart','swing','bl','bu','br','aiml','bd','aimr','chip','x'].map(a => `#t${a}{grid-area:${a}}`).join('')}
#tmute{left:max(10px,env(safe-area-inset-left));top:max(104px,calc(env(safe-area-inset-top) + 94px))}
#stick{position:absolute;width:${STICK_PX * 2}px;height:${STICK_PX * 2}px;margin:-${STICK_PX}px 0 0 -${STICK_PX}px;border-radius:50%;border:2px solid rgba(255,255,255,.4);background:rgba(255,255,255,.06);display:none}
#stick i{position:absolute;left:50%;top:50%;width:44px;height:44px;margin:-22px;border-radius:50%;background:rgba(255,255,255,.55)}
body.touch #bag{pointer-events:auto;touch-action:pan-x;overflow-x:auto;max-width:calc(100vw - 280px);top:max(6px,env(safe-area-inset-top))}
body.touch .slot{flex:none;width:46px;padding:6px 0}
body.touch #mini{right:max(10px,env(safe-area-inset-right));top:max(10px,env(safe-area-inset-top))}body.touch #mini canvas{width:112px;height:157px;display:block}
body.touch #lb,body.touch #gear{pointer-events:auto;top:max(56px,calc(env(safe-area-inset-top) + 46px))}body.touch #gear{font-size:26px;padding:6px 12px}
body.touch #lb{left:max(64px,calc(env(safe-area-inset-left) + 54px))}
body.touch #info{left:max(10px,env(safe-area-inset-left));bottom:max(10px,env(safe-area-inset-bottom))}
body.touch #meter{bottom:auto;top:max(116px,26%);width:min(300px,72vw)}body.touch #prompt{bottom:auto;top:calc(max(116px,26%) + 48px);max-width:80vw;text-align:center}
body.touch #rf{inset:max(10px,env(safe-area-inset-top)) max(10px,env(safe-area-inset-right)) 150px max(10px,env(safe-area-inset-left));touch-action:none}
@media (orientation:portrait){body.touch #bag{left:max(10px,env(safe-area-inset-left));transform:none;max-width:calc(100vw - 150px)}
  body.touch #card{bottom:250px;right:10px;font-size:12px;min-width:0}}
@media (orientation:landscape){body.touch #card{right:210px;font-size:12px;min-width:0}body.touch #lie{left:220px;bottom:10px}body.touch #rf{bottom:max(10px,env(safe-area-inset-bottom));right:210px}}
`;

/** Floating joystick on the view (walk, turn, drive) and, in the stance, the pull-down swing; buttons for everything else. */
export class TouchControls {
  on = false;
  /** Stick offset in -1..1 (x right, y down), or null with no finger down. */
  stick: { x: number; y: number } | null = null;
  /** Live swing pull in px (down), or null. */
  pull: number | null = null;
  /** Aim change in px waiting to be applied (horizontal drag in the stance) and the held ◀ ▶ aim buttons (-1, 0, 1). */
  aimPx = 0; aimHold = 0;
  shift = false;
  private id = -1; private x0 = 0; private y0 = 0; private lx = 0; private mode: 'stick' | 'decide' | 'aim' | 'swing' = 'stick';
  private el = document.createElement('div'); private knob!: HTMLElement;
  private b: Record<string, HTMLElement> = {};

  constructor(hud: HTMLElement, canvas: HTMLCanvasElement, private ctx: () => Ctx, private swing: (pullPx: number) => void) {
    document.head.insertAdjacentHTML('beforeend', `<style>${CSS}</style>`);
    canvas.style.touchAction = 'none';
    this.el.id = 'touch';
    const btn = (id: string, label: string, cls = '') => `<button class="tb ${cls}" id="t${id}">${label}</button>`;
    this.el.innerHTML = `<div id="stick"><i></i></div>${btn('mute', '&#128264;', 'on')}<div id="tc">${btn('swing', 'Swing', 'big')}${btn('cart', 'Cart')}${btn('map', 'Map')}${btn('shift', 'Shift')}
      ${btn('x', '&#10005;')}${btn('chip', 'Chip')}${btn('aimr', 'Aim &#9654;')}${btn('aiml', '&#9664; Aim')}${btn('bd', 'Ball &#9660;')}${btn('bu', 'Ball &#9650;')}${btn('br', 'Ball &#9654;')}${btn('bl', '&#9664; Ball')}</div>`;
    hud.append(this.el);
    this.knob = this.el.querySelector('#stick i')!;
    for (const e of this.el.querySelectorAll<HTMLElement>('.tb')) this.b[e.id.slice(1)] = e;
    const press = (id: string, f: () => void) => this.b[id]!.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); f(); });
    press('swing', () => tap('Space')); press('cart', () => tap('KeyE')); press('map', () => tap('KeyM')); press('mute', () => tap('KeyN'));
    press('x', () => tap('Escape')); press('chip', () => tap('ShiftRight'));   // ShiftRight so the held Shift toggle (ShiftLeft) survives a chip toggle
    press('bu', () => tap('ArrowUp')); press('bd', () => tap('ArrowDown')); press('bl', () => tap('ArrowLeft')); press('br', () => tap('ArrowRight'));
    press('shift', () => { this.shift = !this.shift; key('ShiftLeft', this.shift); });
    for (const [id, d] of [['aiml', -1], ['aimr', 1]] as const) {
      press(id, () => { this.aimHold = d; });
      for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) this.b[id]!.addEventListener(ev, () => { this.aimHold = 0; });
    }
    if (matchMedia('(pointer: coarse)').matches) this.enable();
    addEventListener('touchstart', () => this.enable(), { once: true, capture: true });
    // no page scroll, pinch zoom or pull-to-refresh while playing
    for (const t of [canvas, this.el]) for (const ev of ['touchstart', 'touchmove'] as const) t.addEventListener(ev, e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    document.addEventListener('gesturestart', e => e.preventDefault());
    canvas.addEventListener('pointerdown', e => this.down(e));
    addEventListener('pointermove', e => this.move(e));
    addEventListener('pointerup', e => this.up(e, true)); addEventListener('pointercancel', e => this.up(e, false));
  }
  private enable() { if (this.on) return; this.on = true; document.body.classList.add('touch'); }

  private down(e: PointerEvent) {
    if (e.pointerType !== 'touch' || this.id >= 0 || !this.ctx().race) return;
    this.id = e.pointerId; this.x0 = this.lx = e.clientX; this.y0 = e.clientY;
    this.mode = this.ctx().stance ? 'decide' : 'stick';
    if (this.mode === 'stick') { this.stick = { x: 0, y: 0 }; const s = this.el.querySelector<HTMLElement>('#stick')!; s.style.left = `${e.clientX}px`; s.style.top = `${e.clientY}px`; s.style.display = 'block'; this.knob.style.transform = ''; }
  }
  private move(e: PointerEvent) {
    if (e.pointerId !== this.id) return;
    const dx = e.clientX - this.x0, dy = e.clientY - this.y0;
    if (this.mode === 'decide' && Math.hypot(dx, dy) > 12) this.mode = Math.abs(dx) > Math.abs(dy) ? 'aim' : 'swing';   // the first 12 px pick aim (sideways) or swing (down); the axis then stays locked
    if (this.mode === 'stick') {
      const len = Math.hypot(dx, dy), k = len > STICK_PX ? STICK_PX / len : 1;
      this.stick = { x: (dx * k) / STICK_PX, y: (dy * k) / STICK_PX }; this.knob.style.transform = `translate(${dx * k}px,${dy * k}px)`;
    } else if (this.mode === 'aim') { this.aimPx += e.clientX - this.lx; }
    else if (this.mode === 'swing') this.pull = Math.max(0, dy);
    this.lx = e.clientX;
  }
  private up(e: PointerEvent, ok: boolean) {
    if (e.pointerId !== this.id) return;
    if (this.mode === 'swing' && ok && this.pull !== null && this.ctx().stance) this.swing(this.pull);
    this.id = -1; this.stick = null; this.pull = null; this.el.querySelector<HTMLElement>('#stick')!.style.display = 'none';
  }
  /** Shows the buttons that apply right now (called every frame). */
  update(c: Ctx) {
    if (!this.on) return;
    const show = (id: string, v: boolean) => this.b[id]!.classList.toggle('on', v && c.race);
    show('swing', !c.stance && !c.driving); show('cart', !c.stance && (c.driving || c.nearCart)); show('map', !c.stance); show('shift', !c.stance && !c.driving);
    for (const id of ['x', 'aiml', 'aimr']) show(id, c.stance);
    for (const id of ['chip', 'bu', 'bd', 'bl', 'br']) show(id, c.stance && !c.putt);
    this.b.map!.classList.toggle('lit', c.map); this.b.shift!.classList.toggle('lit', this.shift); this.b.chip!.classList.toggle('lit', c.chip);
    this.el.querySelector('#tc')!.classList.toggle('st', c.stance);
    if (!c.stance) { this.aimHold = 0; if (this.mode !== 'stick') this.pull = null; }
  }
}
