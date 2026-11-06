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
  ['Space: take your stance', 'Swing: stance'], [/E: get (in|out)/g, 'Cart: get $1'], ['WASD drive', 'Pull to drive'],
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
.tb{position:absolute;pointer-events:auto;min-width:44px;height:44px;border-radius:999px;border:1px solid rgba(255,255,255,.22);background:rgba(10,24,19,.6);-webkit-backdrop-filter:blur(16px) saturate(1.4);backdrop-filter:blur(16px) saturate(1.4);box-shadow:inset 0 1px 0 rgba(255,255,255,.16),0 4px 14px rgba(0,0,0,.3);color:#f5f0e4;font:600 12px Inter,system-ui,sans-serif;padding:0 8px;display:none;align-items:center;justify-content:center}
.tb.on{display:flex}.tb.lit{background:#d6b45a;color:#14231b;border-color:#d6b45a}.tb:active{filter:brightness(1.4)}
#tc{position:absolute;right:max(10px,env(safe-area-inset-right));bottom:max(10px,env(safe-area-inset-bottom));display:grid;grid-template-columns:repeat(3,44px);grid-auto-rows:44px;gap:6px;grid-template-areas:"shift map cart" "swing swing swing"}
#tc.st{grid-template-columns:repeat(5,36px);grid-auto-rows:36px;gap:4px;grid-template-areas:". bu . . x" "bl bc br aiml aimr" ". bd . . chip"}#tc .tb{position:static;min-width:0;padding:0 2px;font-size:11px}#tc.st .tb{height:36px}#tbc{border-radius:10px;font-size:10px}
#tc .big{background:rgba(214,180,90,.82);color:#14231b;border-color:#d6b45a;font-size:16px;height:48px}
${['shift','map','cart','swing','bl','bu','br','bc','aiml','bd','aimr','chip','x'].map(a => `#t${a}{grid-area:${a}}`).join('')}
#tmute{display:none!important}body.touch #bpos{display:none!important}
#stick{position:absolute;width:${STICK_PX * 2}px;height:${STICK_PX * 2}px;margin:-${STICK_PX}px 0 0 -${STICK_PX}px;border-radius:50%;border:2px solid rgba(255,255,255,.4);background:rgba(255,255,255,.06);display:none}
#stick i{position:absolute;left:50%;top:50%;width:44px;height:44px;margin:-22px;border-radius:50%;background:rgba(255,255,255,.55)}
body.touch #mini canvas{width:67px;height:94px}body.touch #meter{width:min(170px,50vw);padding:3px 8px;font-size:11px}body.touch #prompt{font-size:11px;padding:3px 10px}body.touch #info{font-size:11px;padding:3px 8px}
body.touch #lb,body.touch #gear{pointer-events:auto;top:max(56px,calc(env(safe-area-inset-top) + 46px))}body.touch #gear{font-size:20px;padding:4px 10px}body.touch #lb .lbh{display:none}body.touch .slot{width:30px;height:30px;font-size:10px}body.touch .slot.on{width:48px;height:48px;font-size:13px}body.touch #meter #mlabel{font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media (orientation:portrait){body.touch #info{bottom:auto;top:max(104px,calc(env(safe-area-inset-top) + 96px))}}
body.touch #lb{left:max(64px,calc(env(safe-area-inset-left) + 54px))}
body.touch #meter{bottom:auto;top:max(116px,26%)}body.touch #prompt{bottom:auto;top:calc(max(116px,26%) + 48px);max-width:80vw;text-align:center}
body.touch #rf{inset:max(10px,env(safe-area-inset-top)) max(10px,env(safe-area-inset-right)) 150px max(10px,env(safe-area-inset-left));touch-action:none}
body.touch #card{min-width:0;font-size:10px;line-height:1.3;padding:4px 8px;bottom:auto;top:max(150px,calc(env(safe-area-inset-top) + 140px))}
@media (orientation:landscape){body.touch #rf{bottom:max(10px,env(safe-area-inset-bottom));right:210px}body.touch #card{top:auto;bottom:max(10px,env(safe-area-inset-bottom));right:calc(max(10px,env(safe-area-inset-right)) + 160px)}}
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
    this.el.innerHTML = `<div id="stick"><i></i></div>${btn('mute', '&#128264;')}<div id="tc">${btn('swing', 'Swing', 'big')}${btn('cart', 'Cart')}${btn('map', 'Map')}${btn('shift', 'Shift')}
      ${btn('x', '&#10005;')}${btn('chip', 'Chip')}${btn('aimr', 'Aim &#9654;')}${btn('aiml', '&#9664; Aim')}${btn('bd', '&#9660;')}${btn('bu', '&#9650;')}${btn('br', '&#9654;')}${btn('bl', '&#9664;')}${btn('bc', '0 0')}</div>`;
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
    show('swing', !c.stance && !c.driving); show('cart', !c.stance && (c.driving || c.nearCart)); show('map', !c.stance); show('shift', !c.stance && !c.driving); show('mute', !c.map);
    for (const id of ['x', 'aiml', 'aimr']) show(id, c.stance);
    for (const id of ['chip', 'bu', 'bd', 'bl', 'br', 'bc']) show(id, c.stance && !c.putt);
    this.b.map!.classList.toggle('lit', c.map); this.b.shift!.classList.toggle('lit', this.shift); this.b.chip!.classList.toggle('lit', c.chip);
    this.el.querySelector('#tc')!.classList.toggle('st', c.stance);
    if (!c.stance) { this.aimHold = 0; if (this.mode !== 'stick') this.pull = null; }
  }
}
