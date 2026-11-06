import { COURSES, COURSE_IDS, gridOf, keyOf, totals, type CourseId } from '../shared/courses';
import { gridCanvas, rfView } from './terrain';
import { edgePoint, mapArrowRotation, type Marker } from './overlay';
import { SLIDER_STEP, MIN_MULT, MAX_MULT, DEFAULT_MULT } from './sensitivity';
import { TIERS, TIER_LABEL, type Pref, type Tier } from './graphics';
import type { BallState, HoleInfo, PlayerRace, ServerMsg } from '../shared/protocol';
import { parText, toPar } from '../shared/scorecard';
import { BALL_STEPS, shotShape } from '../sim/delivery';
import type { LobbyView } from '../server/lobby-types';
import { Backdrop } from './backdrop';

export const BAG = [
  { code: 'Digit1', key: '1', label: 'Driver' }, { code: 'Digit2', key: '2', label: '3W' }, { code: 'Digit3', key: '3', label: '18° UT' },
  { code: 'Digit4', key: '4', label: '4i' }, { code: 'Digit5', key: '5', label: '5i' }, { code: 'Digit6', key: '6', label: '6i' },
  { code: 'Digit7', key: '7', label: '7i' }, { code: 'Digit8', key: '8', label: '8i' }, { code: 'Digit9', key: '9', label: '9i' },
  { code: 'Digit0', key: '0', label: 'PW' }, { code: 'Minus', key: '-', label: '50°' }, { code: 'Equal', key: '=', label: '54°' },
  { code: 'KeyO', key: 'O', label: '62°' }, { code: 'KeyP', key: 'P', label: 'Putter' },
];
export const PUTTER = 13;
export const YD = 1.09361;

const ERR: Record<string, string> = {
  NAME_INVALID: 'Name must be 2 to 16 characters.', NAME_TAKEN: 'That name is already in use. Pick another.',
  NOT_CONNECTED: 'Not connected to the server yet. Try again.', ALREADY_CONNECTED: 'This session is already connected in another tab.',
  ALREADY_IN_LOBBY: 'You are already in a lobby.', NOT_IN_LOBBY: 'You are not in a lobby.', LOBBY_LIMIT: 'All 3 lobbies are in use.',
  LOBBY_NOT_FOUND: 'That lobby no longer exists.', LOBBY_FULL: 'That lobby is full.', LOBBY_NOT_OPEN: 'That lobby has already started.',
  NOT_HOST: 'Only the host can do that.', NEED_PLAYERS: 'Starting needs at least 2 players.', NOT_READY: 'Everyone must be ready first.', COURSE_INVALID: 'That course is not available.',
  BAD_MESSAGE: 'The server rejected that request.', NOT_YOUR_TURN: 'Not your turn.', NOT_IN_RACE: 'You are not in a race.',
};
export const errText = (m: Extract<ServerMsg, { t: 'error' }>) => ERR[m.code] ?? m.message;

/** How to play, grouped; keep in step with the in-race key hints (#keys) and the prompts in main.ts. */
const k = (...keys: string[]) => keys.map(x => `<kbd>${x}</kbd>`).join('');
const HELP_GROUPS: [string, [string, string][]][] = [
  ['Move', [[k('W', 'A', 'S', 'D'), 'Walk'], [k('Shift'), 'Walk at 5 m/s and halve the look speed for fine aim'], [k('Mouse'), 'Look and aim. Click the course to lock the mouse']]],
  ['Swing', [[k('Space'), 'Take your stance at the ball; the mouse still aims'], [`Hold ${k('Space')}`, 'Backswing fills the meter. Release to hit; a short hold is a short shot'],
    [`${k('Shift')} in stance`, '<b>Chip</b>: feet together, shoulders only; the whole meter is 0-25% power for fine touch'],
    ['Hold into red', '<b>MAX effort</b>: +10% club speed, 25% less accurate'], [`${k('1')}–${k('0')} ${k('-', '=', 'O')}`, 'Pick a club, up until the backswing; or scroll on the club bubble'], [k('Esc'), 'Cancel before you release']]],
  ['Ball position (7x7)', [[k('↑', '↓'), 'Forward for a higher flight, back for a lower one; 3 back is a stinger'], [k('→', '←'), 'Away from you for a draw, closer for a fade; 3 steps is a hook or slice']]],
  ['Putting', [[k('P'), 'The putter'], [`${k('Space')} hold, release`, 'Stance, draw back, strike: the longer the hold, the harder the putt']]],
  ['Cart', [[k('E'), 'Get in or out of the Genesis cart (within 3 m)'], [k('W', 'A', 'S', 'D'), 'Drive. The mouse swings the chase camera']]],
  ['Rangefinder', [[k('M'), 'Open or close the hole map'], ['Hover', 'Distance from your ball, to the pin and a club suggestion'], ['Click', 'Set a target and auto-pick the club']]],
  ['Race', [[k('Tab'), 'Scorecard: every racer\'s strokes on every hole'], ['Top left', 'Live standings: hole, strokes and score to par']]],
  ['Lie', [[`${k('I')} or ${k('ⓘ')}`, 'Show or hide the lie and stance panel']]],
  ['Settings', [[`${k('Esc')} or ${k('⚙')}`, 'Camera sensitivity and graphics'], [k(',', '.'), 'Look speed down or up'], [k('N'), 'Mute'], [k('F3'), 'Frame rate']]],
];
/** The same, for touch screens (touch.ts). */
const b = (x: string) => `<kbd>${x}</kbd>`;
const TOUCH_HELP: [string, [string, string][]][] = [
  ['Move', [['Pull', 'Touch the course and pull: up and down walk, sideways turns'], [b('Shift'), 'Toggle the 5 m/s walk and fine aim']]],
  ['Swing', [[b('Swing'), 'Take your stance at the ball'], ['Pull down', 'The backswing: the longer the pull, the harder the shot. Release to hit; a tiny pull cancels'],
    ['Pull far', '<b>MAX effort</b> past the full meter'], ['Drag sideways', `Aim (or hold ${b('◀ Aim')} ${b('Aim ▶')})`], [b('Chip'), 'Shoulders-only chip, 0-25% power'],
    [b('Ball ▲▼◀▶'), 'Ball position: height and curve'], [b('✕'), 'Cancel the stance'], ['Tap the bag', 'Pick a club; the putter putts with the same pull']]],
  ['Cart', [[b('Cart'), 'Get in or out (within 3 m)'], ['Pull', 'Up to drive, down to brake and reverse, sideways to steer']]],
  ['Race', [[b('Map'), 'Hole map; tap it to set a target and pick the club'], ['Tap standings', 'Scorecard'], [b('⚙'), 'Settings: mute and look speed'], [b('ⓘ'), 'Lie and stance panel'], ['Swipe the club', 'Change club; tap a side bubble for the next one']]],
];
const grid = (g: typeof HELP_GROUPS, cls: string) => `<div class="htp-grid ${cls}">${g.map(([t, rows]) => `<section><h3>${t}</h3>${rows.map(([a, b]) => `<div class="kv"><span>${a}</span><span>${b}</span></div>`).join('')}</section>`).join('')}</div>`;
const HELP = `<dialog id="htp" aria-labelledby="htp-t"><form method="dialog" class="htp-head"><h2 id="htp-t">How to play</h2><button class="x" aria-label="Close">&times;</button></form>
  <p class="lede">Race your friends around Pebble Beach, Bethpage Black or Aronimink. First to hole out wins; strokes only decide finishes within 1 second.</p>
  ${grid(HELP_GROUPS, 'kb-help')}${grid(TOUCH_HELP, 'touch-help')}
  <p class="foot">The red flag marks the pin, the yellow beacon your ball; white lines are out of bounds. After every shot a card shows carry, total, offline, ball position and effort.</p></dialog>`;
const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
/** Standings order: finished racers by time, then the furthest along, then the fewest strokes. */
const standings = (ps: PlayerRace[]) => [...ps].sort((a, b) => (a.finishedAtS ?? Infinity) - (b.finishedAtS ?? Infinity) || b.hole - a.hole || +b.ball.holedOut - +a.ball.holedOut || a.ball.strokes - b.ball.strokes);
const clock = (s: number) => { s = Math.max(0, s); return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`; };
const total = (a: readonly (number | undefined)[], from = 0, n = 18) => a.slice(from, from + n).reduce<number>((t, v) => t + (v ?? 0), 0);
/** The full card: players by 18 holes with the par row, out, in, total and score to par. */
export function scorecard(ps: PlayerRace[], pars: readonly number[], self: string): string {
  const nine = (f: (i: number) => string) => Array.from({ length: 9 }, (_, i) => f(i)).join('');
  const cell = (p: PlayerRace, i: number) => {
    const v = p.byHole[i];
    if (v === undefined) return '<td></td>';
    const d = v - pars[i]!, live = i === p.hole && !p.ball.holedOut;
    return `<td class="${live ? 'live' : d < 0 ? 'un' : d > 0 ? 'ov' : ''}">${v}</td>`;
  };
  const row = (p: PlayerRace) => `<tr class="${p.id === self ? 'me' : ''}"><td>${esc(p.name)}</td>${nine(i => cell(p, i))}<th>${total(p.byHole, 0, 9) || ''}</th>${nine(i => cell(p, i + 9))}<th>${total(p.byHole, 9, 9) || ''}</th><th>${p.ball.strokes}</th><th>${parText(toPar(p.byHole, pars, p.hole, p.ball.holedOut))}</th></tr>`;
  return `<div class="sctw"><table class="sct"><tr><th>Hole</th>${nine(i => `<th>${i + 1}</th>`)}<th>Out</th>${nine(i => `<th>${i + 10}</th>`)}<th>In</th><th>Tot</th><th>&plusmn;</th></tr>
    <tr class="par"><td>Par</td>${nine(i => `<td>${pars[i]}</td>`)}<th>${total(pars, 0, 9)}</th>${nine(i => `<td>${pars[i + 9]}</td>`)}<th>${total(pars, 9, 9)}</th><th>${total(pars)}</th><th></th></tr>
    ${standings(ps).map(row).join('')}</table></div>`;
}

const CSS = `
#ui{position:fixed;inset:0;z-index:1;pointer-events:none;font:14px system-ui;color:#eee}
#home{--ink:#f5f0e4;--mute:rgba(245,240,228,.72);--gold:#d6b45a;--green:#1f6b47;--glass:rgba(10,24,19,.58);--line:rgba(255,255,255,.16);
  position:absolute;inset:0;pointer-events:auto;overflow:hidden;background:#0b1a14;color:var(--ink);font:400 15px/1.5 Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
.bd,.bd-l,.bd-scrim{position:absolute;inset:0}
.bd-l{background:#0b1a14 center/cover no-repeat;opacity:0;transition:opacity 1.8s ease;will-change:opacity,transform}.bd-l.on{opacity:1}
.bd-l.kb{animation:kb 10s linear forwards}@keyframes kb{from{transform:scale(1.04)}to{transform:scale(1.14) translate(var(--kx,2%),var(--ky,1%))}}
.bd-scrim{background:radial-gradient(ellipse at 50% 45%,rgba(6,16,12,.15),rgba(6,16,12,.55) 75%),linear-gradient(180deg,rgba(6,16,12,.55),rgba(6,16,12,.1) 30%,rgba(6,16,12,.25) 65%,rgba(6,16,12,.8))}
.bd-cap{position:absolute;left:max(16px,env(safe-area-inset-left));bottom:14px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--mute);text-shadow:0 1px 3px #000}
@media (prefers-reduced-motion:reduce){.bd-l{transition:none}.bd-l.kb{animation:none;transform:scale(1.04)}}
.htp-btn{position:absolute;top:max(16px,env(safe-area-inset-top));right:max(16px,env(safe-area-inset-right));z-index:2;display:flex;align-items:center;gap:8px}
.htp-btn i{font-style:normal;display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;border:1.5px solid currentColor;font-size:12px;font-weight:700}
.scr{position:absolute;inset:0;overflow-y:auto;display:flex;flex-direction:column;align-items:center;gap:18px;padding:72px 16px 48px;box-sizing:border-box}.scr>:first-child{margin-top:auto}.scr>:last-child{margin-bottom:auto}
.wm{font:600 clamp(64px,13vw,128px)/.9 "Playfair Display",Georgia,serif;margin:0;letter-spacing:.02em;text-shadow:0 4px 30px rgba(0,0,0,.45)}
.wm span{color:var(--gold)}.wm.sm{font-size:clamp(40px,7vw,56px)}
.tag{margin:-6px 0 6px;font-size:12px;letter-spacing:.28em;text-transform:uppercase;color:var(--mute);text-align:center}
.glass{background:var(--glass);-webkit-backdrop-filter:blur(18px) saturate(140%);backdrop-filter:blur(18px) saturate(140%);border:1px solid var(--line);border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.35);
  padding:24px;width:min(520px,100%);box-sizing:border-box}
.glass h2{font:600 24px/1.2 "Playfair Display",Georgia,serif;margin:0 0 4px}.glass .sub{margin:0 0 18px;color:var(--mute);font-size:14px}
#home button{font:600 15px/1 Inter,system-ui,sans-serif;padding:12px 20px;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,.08);color:var(--ink);cursor:pointer;transition:background .15s,transform .15s,box-shadow .15s}
#home button:hover:not(:disabled){background:rgba(255,255,255,.16)}#home button:active:not(:disabled){transform:translateY(1px)}
#home button:focus-visible,#home input:focus-visible{outline:2px solid var(--gold);outline-offset:3px}
#home button:disabled{opacity:.45;cursor:not-allowed}
#home button.pri{background:var(--gold);border-color:var(--gold);color:#14231b}#home button.pri:hover:not(:disabled){background:#e6c76d;box-shadow:0 6px 24px rgba(214,180,90,.35)}
#home button.ghost{background:none;border-color:transparent;color:var(--mute)}#home button.ghost:hover{color:var(--ink);background:rgba(255,255,255,.06)}
#home button.wide{width:100%}
.scr label{display:block;font-size:12px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--mute);margin-bottom:8px}
.scr input{width:100%;box-sizing:border-box;font:500 18px Inter,system-ui,sans-serif;padding:13px 16px;border-radius:12px;border:1px solid var(--line);background:rgba(0,0,0,.3);color:var(--ink)}
.scr input:focus{border-color:var(--gold)}
.err{color:#ffb4a8;min-height:1.4em;font-size:14px;margin:8px 0}.err:empty{margin:0;min-height:0}
.cards{display:flex;flex-direction:column;gap:10px;margin-bottom:18px}
.card{display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid var(--line)}
.card .meta{flex:1;min-width:0}.card b{display:block;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.card small{color:var(--mute);font-size:13px}
.chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.chip{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:3px 9px;border-radius:999px;background:rgba(255,255,255,.1);color:var(--ink)}
.chip.ok{background:rgba(80,190,120,.22);color:#a9f0c2}.chip.warn{background:rgba(232,194,58,.2);color:#f3dc8a}.chip.live{background:rgba(214,69,69,.25);color:#ffb3b3}.chip.gold{background:rgba(214,180,90,.22);color:#f0d690}
.empty{padding:22px;text-align:center;color:var(--mute);border:1px dashed var(--line);border-radius:14px}
.av{flex:none;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;font-weight:700;background:var(--green);color:#fff}
.acts{display:flex;flex-wrap:wrap;gap:10px;align-items:center}.acts .grow{flex:1}
.count{font:600 64px/1 "Playfair Display",Georgia,serif;color:var(--gold);text-align:center;margin:0 0 12px}
.hint{color:var(--mute);font-size:13px;margin:12px 0 0}
.spons{position:absolute;right:max(16px,env(safe-area-inset-right));bottom:14px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--mute)}
#htp{width:min(1120px,calc(100% - 32px));max-height:calc(100% - 32px);box-sizing:border-box;padding:22px 26px;border-radius:20px;border:1px solid var(--line);background:rgba(10,22,17,.94);color:var(--ink);box-shadow:0 30px 90px rgba(0,0,0,.6)}
#htp::backdrop{background:rgba(3,10,7,.55);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.htp-head{display:flex;justify-content:space-between;align-items:center;margin:0}.htp-head h2{font:600 30px/1.1 "Playfair Display",Georgia,serif;margin:0}
#home .x{width:40px;height:40px;padding:0;font-size:24px;font-weight:400}
#htp .lede{color:var(--mute);margin:4px 0 14px}
.htp-grid{columns:3 290px;column-gap:14px}.touch-help,body.touch .kb-help{display:none}body.touch .touch-help{display:block}
.htp-grid section{break-inside:avoid;margin-bottom:14px;background:rgba(255,255,255,.05);border:1px solid var(--line);border-radius:14px;padding:14px 16px}
.htp-grid h3{margin:0 0 10px;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold)}
.kv{display:grid;grid-template-columns:124px 1fr;gap:10px;align-items:baseline;padding:4px 0;font-size:13.5px;line-height:1.4}.kv span:first-child{color:var(--mute);font-size:13px}
kbd{display:inline-block;min-width:16px;padding:2px 5px;margin:0 2px 2px 0;border-radius:6px;border:1px solid rgba(255,255,255,.25);border-bottom-width:2px;background:rgba(255,255,255,.08);font:600 12px/1.4 ui-monospace,Menlo,monospace;text-align:center;color:var(--ink)}
#htp .foot{color:var(--mute);font-size:13px;margin:4px 0 0}
.crs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:0 0 18px}#home .crs button,.crs .one{border-radius:14px;padding:12px;text-align:left;line-height:1.3;display:flex;flex-direction:column;gap:3px;font-weight:400}
#home .crs button[aria-checked=true],.crs .one{border:1px solid var(--gold);background:rgba(214,180,90,.16)}.crs b{font-size:14px;font-weight:600}.crs small{font-size:12px;color:var(--mute)}.crs.solo{grid-template-columns:1fr}
@media (max-width:520px){.crs{grid-template-columns:1fr}}
.scr table{border-collapse:collapse;width:100%}.scr td,.scr th{padding:8px 10px;text-align:left;border-bottom:1px solid var(--line)}.scr th{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--mute)}
@media (max-width:520px){.tag{letter-spacing:.14em}.glass{padding:18px}#htp{padding:20px}.kv{grid-template-columns:1fr;gap:2px}.spons{display:none}}
.hud{position:absolute;padding:5px 10px;border-radius:14px;font:500 13px/1.4 Inter,system-ui,-apple-system,sans-serif;font-variant-numeric:tabular-nums;color:#f5f0e4;
  background:rgba(10,24,19,.62);-webkit-backdrop-filter:blur(18px) saturate(1.4);backdrop-filter:blur(18px) saturate(1.4);border:1px solid rgba(255,255,255,.16);box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 6px 20px rgba(0,0,0,.28)}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){.hud,.slot,.gb,.tb{background:rgba(10,24,19,.88)!important}}
#pin,#arrow,#cd,#keys,#bag,#lie{-webkit-backdrop-filter:none;backdrop-filter:none;box-shadow:none;border:0}
#bag{top:max(8px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:6px;padding:0;background:none;pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none}#lb,.slot{cursor:pointer}#lb{pointer-events:auto}
.slot,.gb{display:grid;place-items:center;border-radius:50%;box-sizing:border-box;background:rgba(10,24,19,.62);-webkit-backdrop-filter:blur(18px) saturate(1.4);backdrop-filter:blur(18px) saturate(1.4);border:1px solid rgba(255,255,255,.2);box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 4px 14px rgba(0,0,0,.3);color:#f5f0e4}
.slot{width:36px;height:36px;font:600 11px Inter,system-ui,sans-serif;opacity:.65;transition:transform .2s}.slot:empty{visibility:hidden}
.slot.on{width:56px;height:56px;font-size:15px;opacity:1;border-color:#d6b45a;color:#f0d690}.slot.pop{transform:scale(1.15)}
#info{left:max(10px,env(safe-area-inset-left));bottom:max(10px,env(safe-area-inset-bottom));white-space:nowrap;font-size:12px}
#lb{left:max(52px,calc(env(safe-area-inset-left) + 46px));top:max(56px,calc(env(safe-area-inset-top) + 48px));font-size:11px;line-height:1.35;display:grid;grid-template-columns:minmax(0,64px) auto auto auto;column-gap:6px;max-width:160px;box-sizing:border-box;padding:4px 8px}
#lb>div{display:contents}#lb span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right}#lb span:first-child{text-align:left}
#lb .me span{color:#f0d690;font-weight:700}#lb>div:nth-child(n+6){display:none}#lb .lbh{grid-column:1/-1;display:block;font-size:9px;letter-spacing:.08em;text-transform:uppercase;opacity:.65}
#sc{left:50%;top:50%;transform:translate(-50%,-50%);display:none;max-width:calc(100% - 20px);box-sizing:border-box;background:rgba(14,22,18,.94);padding:10px 12px}#sc h3{margin:0 0 6px;font-size:14px}#mini{right:max(10px,env(safe-area-inset-right));top:max(10px,env(safe-area-inset-top));padding:0;overflow:hidden}#mini canvas{display:block;width:112px;height:157px}
#card{right:max(10px,env(safe-area-inset-right));bottom:max(10px,env(safe-area-inset-bottom));min-width:190px;display:none;font-size:12px;pointer-events:auto;cursor:pointer}#card.mini{min-width:0;border-radius:999px}#card.mini .more{display:none}#prompt{left:50%;bottom:90px;transform:translateX(-50%);display:none;font-size:12px;border-radius:999px;padding:4px 12px}
#meter{left:50%;bottom:44px;transform:translateX(-50%);width:260px;display:none;font-size:12px}#fill{height:12px;background:#ddd;width:0}
#cd{left:50%;top:35%;transform:translate(-50%);font-size:96px;background:none;display:none}
#toast{left:50%;top:max(72px,calc(env(safe-area-inset-top) + 70px));transform:translateX(-50%);display:none;font-size:12px;border-radius:999px;padding:4px 12px;max-width:80vw;text-align:center}
#lie{left:max(10px,env(safe-area-inset-left));bottom:max(44px,calc(env(safe-area-inset-bottom) + 36px));display:none;padding:0;background:none;font-size:12px;line-height:1.45;pointer-events:auto}
#liei{display:flex;align-items:center;gap:6px;background:none;border:0;padding:0;color:#f5f0e4;font:600 12px Inter,system-ui,sans-serif;cursor:pointer;text-shadow:0 1px 3px #000}#liei .gb{width:36px;height:36px;font-size:18px}
#lie.pulse .gb{animation:pulse .5s 3}@keyframes pulse{50%{transform:scale(1.25);border-color:#d6b45a}}
#lie .lp{display:none}#lie.open .lp{display:block;position:absolute;bottom:42px;left:0;width:280px;background:rgba(10,24,19,.82);padding:8px 10px;border-radius:14px;border:1px solid rgba(255,255,255,.16)}#lie canvas{float:left;margin:2px 8px 0 0}
#bpos{left:max(10px,env(safe-area-inset-left));bottom:100px;display:none;text-align:center;font-size:11px;padding:6px 8px;max-width:150px}#bpos canvas{display:block;margin:0 auto 2px}
#meter .track{position:relative;background:#444;height:12px}#meter .max{position:absolute;right:0;top:0;bottom:0;width:31.8%;background:rgba(210,40,40,.6)}#meter #fill{position:relative;z-index:1;opacity:.9}
#pin{position:absolute;display:none;pointer-events:none;background:none;padding:0;text-align:center;color:#fff;font-weight:700;text-shadow:0 0 4px #000;width:110px}#pin svg{display:block;margin:0 auto}
#gear{left:max(10px,env(safe-area-inset-left));top:max(56px,calc(env(safe-area-inset-top) + 48px));cursor:pointer;font-size:16px;padding:2px 8px;border-radius:999px;pointer-events:auto;user-select:none}
#settings{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:none;pointer-events:auto;min-width:340px;padding:16px 20px;background:rgba(10,22,17,.92);border-radius:18px}#settings h3{margin:0 0 10px}#settings input[type=range]{width:100%}#settings button{margin-top:8px}#settings select{margin-left:8px;font:inherit}
#fps{right:10px;top:236px;display:none;font:12px/1.4 ui-monospace,monospace;white-space:pre}
#banner{left:50%;top:22%;transform:translateX(-50%);font-size:26px;padding:12px 22px;background:rgba(150,30,30,.88);display:none;text-align:center;max-width:70%}
#arrow{position:absolute;display:none;background:none;padding:0;pointer-events:none;color:#ffe14d;font-weight:700;text-shadow:0 0 4px #000;text-align:center;width:90px}#arrow i{display:block;width:0;height:0;margin:0 auto;border-left:12px solid transparent;border-right:12px solid transparent;border-bottom:22px solid #ffe14d}
#keys{left:50%;bottom:4px;transform:translateX(-50%);font-size:10px;opacity:.6;background:none;padding:0;white-space:nowrap;text-shadow:0 1px 2px #000}
#rf{position:absolute;inset:6% 12%;display:none;background:rgba(12,20,16,.94);border:2px solid #678;pointer-events:auto;padding:0}#rf canvas{width:100%;height:100%;display:block;cursor:crosshair}
.sctw{overflow-x:auto;max-width:100%}.sct{border-collapse:collapse;font:12px/1.3 system-ui;white-space:nowrap;width:auto}
.sct td,.sct th,.scr .sct td,.scr .sct th{padding:3px 6px;text-align:center;border-bottom:1px solid rgba(255,255,255,.12);font-size:12px;letter-spacing:0;text-transform:none;color:inherit}
.sct td:first-child{text-align:left;max-width:110px;overflow:hidden;text-overflow:ellipsis}.sct th{font-weight:700}.sct .par td,.sct .par th{opacity:.6}
.sct .me td,.sct .me th{background:rgba(255,225,77,.16);color:#ffe14d}.sct .un{color:#7fd0ff;font-weight:700}.sct .ov{color:#ffb4a8}.sct .live{font-style:italic;opacity:.7}
#rftip{position:absolute;pointer-events:none;background:rgba(0,0,0,.85);padding:6px 10px;border-radius:3px;display:none;white-space:pre;line-height:1.4}
`;

export class UI {
  root = document.getElementById('app')!;
  private home = document.createElement('div');
  private scr = Object.assign(document.createElement('div'), { className: 'scr' });
  hud = document.createElement('div');
  private mini!: HTMLCanvasElement;
  private $ = (id: string) => this.hud.querySelector<HTMLElement>('#' + id)!;
  private toastT = 0; private cardT = 0;
  constructor(public act: (a: string, d: DOMStringMap, form: HTMLElement) => void) {
    document.head.insertAdjacentHTML('beforeend', `<style>${CSS}</style>`);
    this.root.id = 'ui'; this.hud.style.display = 'none';
    this.hud.innerHTML = `<div class="hud" id="bag" title="Club: swipe, scroll or tap a neighbour; number keys"><div class="slot" data-d="-1"></div><div class="slot on" data-d="0"></div><div class="slot" data-d="1"></div></div>
      <div class="hud" id="lb"></div><div class="hud" id="mini"><canvas width="150" height="210"></canvas></div>
      <div class="hud" id="info"></div><div class="hud" id="card"></div><div class="hud" id="prompt"></div>
      <div class="hud" id="meter"><div id="mlabel"></div><div class="track"><div id="fill"></div><div class="max"></div></div></div><div class="hud" id="bpos"><canvas width="100" height="100"></canvas><span></span></div><div class="hud" id="lie"><div class="lp"><canvas width="54" height="54"></canvas><div></div></div><button id="liei" title="Lie and stance (I)"><span class="gb">&#9432;</span><span></span></button></div>
      <div class="hud" id="cd"></div><div class="hud" id="toast"></div><div class="hud" id="banner"></div><div class="hud" id="arrow"><i></i><span></span></div>
      <div class="hud" id="keys">WASD move / drive · E cart · Shift walk / fine aim · Space swing · Arrows ball position · M rangefinder · Tab scorecard · I lie · N mute · , . look speed · F3 FPS</div>
      <div class="hud" id="pin"><svg width="26" height="30" viewBox="0 0 26 30"><line x1="5" y1="2" x2="5" y2="29" stroke="#fff" stroke-width="2.5"/><path d="M5 3 L24 9 L5 15 Z" fill="#e53935" stroke="#fff" stroke-width="1.5"/></svg><span></span></div>
      <div class="hud" id="gear" title="Settings">&#9881;</div>
      <div class="hud" id="settings"><h3>Settings</h3><label>Camera sensitivity <b id="sensval"></b></label><input id="sens" type="range" min="${MIN_MULT}" max="${MAX_MULT}" step="${SLIDER_STEP}"><button id="smute">Mute / unmute (N)</button> <button id="sensreset">Reset to default (${DEFAULT_MULT}×)</button><div style="margin-top:10px;font-size:12px;opacity:.8">, and . also change it. Esc closes this menu.</div><label style="display:block;margin-top:16px">Graphics<select id="gfx">${['auto', ...TIERS].map(t => `<option value="${t}">${t === 'auto' ? 'Auto' : TIER_LABEL[t as Tier]}</option>`).join('')}</select></label><div style="margin-top:6px;font-size:12px;opacity:.8">Auto picks a level for your hardware and steps it down or up with the frame rate. Antialiasing changes apply on the next load. F3 shows FPS.</div><label style="display:block;margin-top:16px">Sky<select id="sky"><option value="sunny">Sunny</option><option value="marine">Marine layer</option></select></label></div><div class="hud" id="fps"></div><div class="hud" id="sc"></div><div id="rf"><canvas></canvas><div id="rftip"></div></div>`;
    this.home.id = 'home';
    this.home.append(new Backdrop().el, this.scr);
    this.home.insertAdjacentHTML('beforeend', `<button class="htp-btn" aria-haspopup="dialog"><i>?</i><span>How to play</span></button><div class="spons">Callaway · Genesis</div>${HELP}`);
    const dlg = this.home.querySelector('dialog')!;
    this.home.querySelector<HTMLElement>('.htp-btn')!.onclick = () => dlg.showModal();
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });   // a click on the dimmed area outside closes it; Esc closes natively
    this.root.append(this.home, this.hud);
    this.mini = this.hud.querySelector('canvas')!;
    // the bag and the standings are buttons too (touch and mouse): they replay the club key and Tab
    const key = (code: string) => { for (const t of ['keydown', 'keyup']) dispatchEvent(new KeyboardEvent(t, { code })); };
    // club bubble: tap a neighbour, swipe (about 28 px a club, left = next) or scroll; every change replays the number key so the stance rules apply; clamps at the ends
    const bag = this.$('bag'), step = (n: number) => { const j = Math.max(0, Math.min(BAG.length - 1, this.club + n)); if (j !== this.club) key(BAG[j]!.code); };
    let sx: number | null = null, swiped = false;
    bag.addEventListener('pointerdown', e => { sx = e.clientX; swiped = false; e.stopPropagation(); });
    addEventListener('pointerup', e => { if (sx === null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 14) { swiped = true; step(-Math.round(dx / 28) || -Math.sign(dx)); } });
    bag.addEventListener('click', e => { const d = Number((e.target as HTMLElement).closest<HTMLElement>('.slot')?.dataset.d ?? 0); if (!swiped && d) step(d); });
    bag.addEventListener('wheel', e => { e.preventDefault(); step(Math.sign(e.deltaY)); }, { passive: false });
    this.$('liei').addEventListener('click', () => this.toggleLie());
    addEventListener('pointerdown', e => { if (this.lieOpen && !this.$('lie').contains(e.target as Node)) this.toggleLie(false); });
    this.$('card').addEventListener('click', () => this.$('card').classList.toggle('mini'));
    this.$('smute').addEventListener('click', () => key('KeyN'));
    this.$('lb').addEventListener('click', () => key('Tab'));
    this.scr.addEventListener('click', e => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
      if (el && !(el as HTMLButtonElement).disabled) this.act(el.dataset.act!, el.dataset, this.scr);
    });
    this.scr.addEventListener('submit', e => e.preventDefault());
  }
  /** HUD stays visible (race underneath) when html is null. */
  screen(html: string | null) {
    this.home.style.display = html ? '' : 'none'; if (html) this.scr.innerHTML = html; this.hud.style.display = html ? 'none' : '';
    if (!html) this.home.querySelector('dialog')!.close();   // a modal left open in a hidden screen would make the race inert
  }
  private wm = (sm = true) => `<h1 class="wm${sm ? ' sm' : ''}">Ace<span>.</span></h1>`;
  showDown(msg: string) { this.screen(`${this.wm()}<div class="glass"><h2>Reconnecting…</h2><p class="sub">${esc(msg)}</p></div>`); }
  showName(name: string, err = '') {
    this.screen(`${this.wm(false)}<p class="tag">A race around championship golf</p><form class="glass"><label for="nm">Your name</label>
      <input id="nm" value="${esc(name)}" maxlength="16" minlength="2" autocomplete="nickname" placeholder="2 to 16 characters" autofocus>
      <div class="err" role="alert">${esc(err)}</div><button class="pri wide" data-act="name" style="margin-top:16px">Enter the waiting room</button></form>`);
    const input = this.scr.querySelector('input')!;
    input.addEventListener('keydown', e => { if (e.key === 'Enter') this.act('name', {}, this.scr); }); input.focus();
  }
  /** Course cards: a radio group the host picks from, or (for everyone else) the lobby's course on its own. */
  private courses(cur: CourseId, pick: boolean) {
    const card = (id: CourseId) => { const c = COURSES[id], t = totals(id); return `<b>${esc(pick ? c.short : c.name)}</b><small>${esc(c.place)}</small><small>Par ${t.par} · ${t.yards.toLocaleString('en-US')} yd</small>${pick ? '' : `<small>${esc(c.look)}</small>`}`; };
    return pick ? `<label id="crs-l">Course</label><div class="crs" role="radiogroup" aria-labelledby="crs-l">${COURSE_IDS.map(id => `<button role="radio" aria-checked="${id === cur}" data-act="course" data-v="${id}">${card(id)}</button>`).join('')}</div>`
      : `<label>Course</label><div class="crs solo"><div class="one">${card(cur)}</div></div>`;
  }
  showMenu(m: { self: string; lobbies: LobbyView[]; lobby: LobbyView | null; error: string; count: number | null; pick: CourseId }) {
    const err = `<div class="err" role="alert">${esc(m.error)}</div>`;
    const hostName = (l: LobbyView) => l.players.find(p => p.sessionId === l.hostSessionId)?.name ?? '—';
    if (m.lobby) {
      const l = m.lobby, host = l.hostSessionId === m.self, me = l.players.find(p => p.sessionId === m.self);
      const allReady = l.players.length >= 2 && l.players.every(p => p.ready);
      this.screen(`${this.wm()}<div class="glass">${m.count !== null ? `<p class="count" aria-live="polite">${m.count}</p><p class="tag">Starting</p>` : ''}
        <h2>${esc(l.name)}</h2><p class="sub">${l.players.length}/4 players · hosted by ${esc(hostName(l))}</p>${this.courses(l.course, host && l.state === 'open' && m.count === null)}
        <div class="cards">${l.players.map(p => `<div class="card"><div class="av">${esc(p.name.slice(0, 1).toUpperCase())}</div><div class="meta"><b>${esc(p.name)}</b>
          <div class="chips">${p.sessionId === l.hostSessionId ? '<span class="chip gold">Host</span>' : ''}${p.sessionId === m.self ? '<span class="chip">You</span>' : ''}</div></div>
          <span class="chip ${p.ready ? 'ok' : ''}">${p.ready ? 'Ready' : 'Not ready'}</span></div>`).join('')}</div>${err}
        <div class="acts"><button class="${me?.ready ? '' : 'pri'}" data-act="ready" data-v="${me?.ready ? '' : '1'}">${me?.ready ? 'Not ready' : 'Ready'}</button>
        ${host ? `<button class="${me?.ready ? 'pri' : ''}" data-act="start" ${allReady ? '' : 'disabled'}>Start race</button>` : ''}
        ${host && l.players.length === 1 ? `<button data-act="solo">Solo time trial</button>` : ''}<span class="grow"></span>
        <button class="ghost" data-act="leave">Leave lobby</button></div>
        ${host && !allReady ? `<p class="hint">${l.players.length < 2 ? 'Waiting for players. A race needs 2 to 4; or play a solo time trial.' : 'Start unlocks when everyone is ready.'}</p>` : !host ? '<p class="hint">The host starts the race once everyone is ready.</p>' : ''}</div>`);
      return;
    }
    const full = m.lobbies.length >= 3;
    const status = (l: LobbyView) => l.state === 'open' ? (l.players.length >= 4 ? ['warn', 'Full'] : ['ok', 'Open']) : l.state === 'starting' ? ['warn', 'Starting'] : l.state === 'in_race' ? ['live', 'Racing'] : ['', 'Results'];
    this.screen(`${this.wm()}<div class="glass"><h2>Waiting room</h2><p class="sub">Join a lobby or start your own. Up to 4 players race in each.</p><div class="cards">${m.lobbies.map(l => {
      const can = l.state === 'open' && l.players.length < 4, [cls, txt] = status(l);
      return `<div class="card"><div class="meta"><b>${esc(l.name)}</b><small>Host ${esc(hostName(l))}</small>
        <div class="chips"><span class="chip gold">${esc(COURSES[l.course]?.short ?? l.course)}</span><span class="chip">${l.players.length}/4 players</span><span class="chip ${cls}">${txt}</span></div></div>
        <button data-act="join" data-id="${esc(l.id)}" ${can ? '' : 'disabled'} aria-label="Join ${esc(l.name)}">Join</button></div>`;
    }).join('') || '<div class="empty">No lobbies yet. Create one and invite your friends.</div>'}</div>${err}
      ${full ? '' : this.courses(m.pick, true)}<button class="pri wide" data-act="create" ${full ? 'disabled' : ''}>${full ? 'All 3 lobbies in use' : 'Create lobby'}</button></div>`);
  }
  showResults(rows: { place: number; name: string; timeS?: number; strokes: number }[], course: string, card = '') {
    this.screen(`${this.wm()}<div class="glass"><h2>Results</h2><p class="sub">${esc(course)}</p><table><tr><th>Place</th><th>Name</th><th>Time</th><th>Strokes</th></tr>${rows.map(r =>
      `<tr><td>${r.place}</td><td>${esc(r.name)}</td><td>${r.timeS === undefined ? 'DNF' : this.clock(r.timeS)}</td><td>${r.strokes}</td></tr>`).join('')}</table>
      ${card ? `<h2 style="margin-top:18px">Scorecard</h2>${card}` : ''}
      <button class="pri wide" data-act="back" style="margin-top:18px">Back to waiting room</button></div>`);
  }
  clock(s: number) { return clock(s); }

  // --- HUD ---
  club = 0;
  setClub(i: number) {
    const was = this.club; this.club = i;
    this.hud.querySelectorAll<HTMLElement>('#bag .slot').forEach(e => { e.textContent = BAG[i + Number(e.dataset.d)]?.label ?? ''; });
    if (was !== i) { const c = this.$('bag').children[1]!; c.classList.add('pop'); setTimeout(() => c.classList.remove('pop'), 200); }
  }
  info(hole: HoleInfo, yards: number, _lie: string, clock: string, strokes: number) {
    this.$('info').textContent = `H${hole.index + 1} · Par ${hole.par} · ${strokes} stroke${strokes === 1 ? '' : 's'} · ${Math.round(yards)} yd · ${clock.replace(/\.\d$/, '')}`;
  }
  /** Lie panel open state, remembered per device. */
  lieOpen = (() => { try { return localStorage.getItem('ace.lieOpen') === '1'; } catch { return false; } })();
  private lieName = '';
  toggleLie(open = !this.lieOpen) { this.lieOpen = open; this.$('lie').classList.toggle('open', open); try { localStorage.setItem('ace.lieOpen', open ? '1' : '0'); } catch { /* storage blocked */ } }
  /** Live standings strip (name, hole or finish time, strokes, to par) and, while open, the Tab scorecard. */
  board(ps: PlayerRace[], pars: readonly number[], self: string) {
    this.$('lb').innerHTML = `<div class="lbh">Standings · Tab card</div>${standings(ps).map(p => `<div class="${p.id === self ? 'me' : ''}"><span>${esc(p.name)}</span><span>${p.finishedAtS !== undefined ? `&check; ${clock(p.finishedAtS)}` : `H${p.hole + 1}${p.ball.holedOut ? '&check;' : ''}`}</span><span>${p.ball.strokes}</span><span>${parText(toPar(p.byHole, pars, p.hole, p.ball.holedOut))}</span></div>`).join('')}`;
    if (this.scOpen()) this.$('sc').innerHTML = `<h3>Scorecard</h3>${scorecard(ps, pars, self)}`;
  }
  scOpen = () => this.$('sc').style.display === 'block';
  toggleScorecard(open = !this.scOpen()) { this.$('sc').style.display = open ? 'block' : 'none'; }
  /** Small grid showing where the ball sits against the feet in the stance (fb: up = forward, io: right = away from the body). */
  ballPosGrid(p: { fb: number; io: number } | null) {
    const e = this.$('bpos'); e.style.display = p ? 'block' : 'none'; if (!p) return;
    const dc = document.getElementById('tbc'); if (dc) dc.textContent = `${p.fb >= 0 ? '+' : ''}${p.fb} ${p.io >= 0 ? '+' : ''}${p.io}`;   // the touch d-pad centre shows the position
    const n = BALL_STEPS, cell = 80 / (2 * n), at = (k: number) => 10 + (k + n) * cell;          // 7x7 grid: -3..+3 on each axis
    const c = e.querySelector('canvas')!, x = c.getContext('2d')!; x.clearRect(0, 0, 100, 100); x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(0, 0, 100, 100);
    x.strokeStyle = 'rgba(255,255,255,.18)'; for (let i = 0; i <= 2 * n; i++) { x.beginPath(); x.moveTo(10 + i * cell, 10); x.lineTo(10 + i * cell, 90); x.moveTo(10, 10 + i * cell); x.lineTo(90, 10 + i * cell); x.stroke(); }
    x.strokeStyle = 'rgba(255,225,77,.55)'; x.strokeRect(at(-n) , at(-n), 80, 80); x.strokeRect(at(-1), at(-1), 2 * cell, 2 * cell);   // the outer ring = extreme shapes
    x.fillStyle = '#ffe14d'; x.beginPath(); x.arc(50, 50, 2, 0, 7); x.fill();                                                          // the centre (stock)
    x.fillStyle = '#fff'; x.beginPath(); x.arc(at(p.io), at(-p.fb), 5, 0, 7); x.fill();
    e.querySelector('span')!.textContent = `${shotShape(p.fb, p.io)} · Fwd ${p.fb >= 0 ? '+' : ''}${p.fb} · Away ${p.io >= 0 ? '+' : ''}${p.io}`;
  }
  /** Lie panel at the ball: the lie's penalties and the stance angles (lieinfo.ts), with an icon of the fall line relative to the aim (up = target).
   *  No curve number on purpose: the player reads the angles and judges the curve (owner). */
  liePanel(info: { lines: string[] } | null, slope?: { alongDeg: number; sideDeg: number }) {
    const e = this.$('lie'); e.style.display = info ? 'block' : 'none'; if (!info || !slope) return;
    e.classList.toggle('open', this.lieOpen);
    const nm = info.lines[0]!.split(':')[0]!;   // collapsed: the lie word by the icon; it pulses when the lie changes
    if (nm !== this.lieName) { this.lieName = nm; e.querySelector('#liei span:last-child')!.textContent = nm; e.classList.remove('pulse'); void e.offsetWidth; e.classList.add('pulse'); }
    e.querySelector('.lp div')!.innerHTML = info.lines.map((l, i) => (i ? esc(l) : `<b>${esc(l)}</b>`)).join('<br>');
    const c = e.querySelector('canvas')!, x = c.getContext('2d')!, m = 27; x.clearRect(0, 0, 54, 54);
    x.strokeStyle = 'rgba(255,255,255,.5)'; x.beginPath(); x.arc(m, m, 24, 0, 7); x.stroke();
    x.fillStyle = '#ffe14d'; x.beginPath(); x.moveTo(m, 4); x.lineTo(m - 4, 11); x.lineTo(m + 4, 11); x.fill();          // the target is up
    const dx = -slope.sideDeg, dy = slope.alongDeg, len = Math.hypot(dx, dy);                                          // downhill: screen right = right of the line
    if (len < 0.2) { x.fillStyle = '#fff'; x.beginPath(); x.arc(m, m, 3, 0, 7); x.fill(); return; }
    const k = Math.min(20, 4 + len * 2.5) / len, ex = m + dx * k, ey = m + dy * k, a = Math.atan2(ey - m, ex - m);
    x.strokeStyle = x.fillStyle = '#7fd0ff'; x.lineWidth = 3; x.beginPath(); x.moveTo(m, m); x.lineTo(ex, ey); x.stroke(); x.lineWidth = 1;
    x.beginPath(); x.moveTo(ex + Math.cos(a) * 4, ey + Math.sin(a) * 4); x.lineTo(ex + Math.cos(a + 2.4) * 7, ey + Math.sin(a + 2.4) * 7); x.lineTo(ex + Math.cos(a - 2.4) * 7, ey + Math.sin(a - 2.4) * 7); x.fill();
  }
  /** Pin indicator: a flag drawn over the pin at constant pixel size with the yardage from your ball when it is on screen, an edge arrow toward it when not. */
  pinMarker(m: Marker | null, yards: number, opacity: number) {
    const e = this.$('pin'); if (!m || opacity <= 0) { e.style.display = 'none'; return; }
    e.style.display = 'block'; e.style.opacity = String(opacity);
    const p = m.onScreen ? { x: m.x, y: m.y - 22 } : edgePoint(m.dir, innerWidth, innerHeight, 90);
    e.style.left = `${p.x - 55}px`; e.style.top = `${p.y - 15}px`;
    (e.querySelector('svg') as SVGElement).style.transform = m.onScreen ? '' : `rotate(${m.dir + Math.PI / 2}rad)`;
    e.querySelector('span')!.textContent = `Pin ${Math.round(yards)} yd`;
  }
  /** Settings panel (camera sensitivity slider); callbacks keep the slider, the keys and the saved setting in one place. */
  bindSettings(get: () => number, set: (v: number) => void, reset: () => void) {
    const gear = this.$('gear'), panel = this.$('settings'), sl = panel.querySelector<HTMLInputElement>('#sens')!, val = panel.querySelector<HTMLElement>('#sensval')!;
    const sync = () => { sl.value = String(get()); val.textContent = `${get().toFixed(2)}×`; };
    gear.onclick = () => this.toggleSettings(); sl.oninput = () => { set(Number(sl.value)); sync(); };
    panel.querySelector<HTMLElement>('#sensreset')!.onclick = () => { reset(); sync(); }; this.syncSettings = sync; sync();
  }
  syncSettings: () => void = () => {};
  /** Graphics select: "Auto (High)" names the tier Auto is running; the other options override it. */
  bindGraphics(get: () => { pref: Pref; auto: Tier }, set: (p: Pref) => void) {
    const sel = this.$('gfx') as HTMLSelectElement;
    const sync = () => { const g = get(); sel.options[0]!.text = `Auto (${TIER_LABEL[g.auto]})`; sel.value = g.pref; };
    sel.onchange = () => { set(sel.value as Pref); sync(); sel.blur(); };
    this.syncGraphics = sync; sync();
  }
  syncGraphics: () => void = () => {};
  /** Sky select: sunny (default) or the overcast marine layer. */
  bindSky(get: () => string, set: (v: string) => void) {
    const sel = this.$('sky') as HTMLSelectElement; sel.value = get();
    sel.onchange = () => { set(sel.value); sel.blur(); };
  }
  /** F3 readout; `toggleFps` flips it, `fps` writes it (only while shown). */
  fpsOn = false;
  toggleFps() { this.fpsOn = !this.fpsOn; this.$('fps').style.display = this.fpsOn ? 'block' : 'none'; }
  fps(text: string) { if (this.fpsOn) this.$('fps').textContent = text; }
  toggleSettings(open?: boolean) { const p = this.$('settings'); const show = open ?? p.style.display !== 'block'; p.style.display = show ? 'block' : 'none'; if (show) { document.exitPointerLock?.(); this.syncSettings(); this.syncGraphics(); } return show; }
  settingsOpen = () => this.$('settings').style.display === 'block';
  private bannerT = 0;
  /** A big, long-lasting message for events the player must not miss (penalties). */
  banner(t: string, ms = 5000) { const e = this.$('banner'); e.style.display = 'block'; e.textContent = t; clearTimeout(this.bannerT); this.bannerT = window.setTimeout(() => (e.style.display = 'none'), ms); }
  /** Edge arrow toward the local ball with its distance when the ball is off screen; hidden when the beacon is in view. */
  ballMarker(m: { x: number; y: number; onScreen: boolean; dir: number } | null, yards: number) {
    const e = this.$('arrow'); if (!m || m.onScreen) { e.style.display = 'none'; return; }
    const cx = innerWidth / 2, cy = innerHeight / 2, r = Math.min(cx, cy) - 70, x = cx + Math.cos(m.dir) * r * (innerWidth / innerHeight > 1 ? 1.5 : 1), y = cy + Math.sin(m.dir) * r;
    e.style.display = 'block'; e.style.left = `${Math.min(innerWidth - 100, Math.max(10, x - 45))}px`; e.style.top = `${Math.min(innerHeight - 70, Math.max(10, y - 20))}px`;
    (e.firstElementChild as HTMLElement).style.transform = `rotate(${m.dir + Math.PI / 2}rad)`; (e.lastElementChild as HTMLElement).textContent = `ball ${Math.round(yards)} yd`;
  }
  /** Expanded mini map: terrain, markers, the target and the line from the ball to the hovered point (PRD/02 section 7). */
  drawRangefinder(h: HoleInfo, ball: { x: number; z: number }, golfer: { x: number; z: number }, target: { x: number; z: number } | null, hover: { x: number; z: number } | null, heading = 0) {
    const c = this.rfCanvas(); if (c.width !== c.clientWidth || c.height !== c.clientHeight) { c.width = c.clientWidth; c.height = c.clientHeight; }
    const ctx = c.getContext('2d')!, v = rfView(keyOf(h), c.width, c.height); ctx.fillStyle = '#10181a'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(gridCanvas(keyOf(h), 2, false, true), v.x0, v.y0, v.w, v.h);
    const dot = (p: { x: number; z: number }, col: string, r: number) => { const [x, y] = v.toScreen(p.x, p.z); ctx.fillStyle = col; ctx.strokeStyle = '#000'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke(); return [x, y] as const; };
    dot(h.tee, '#222', 5); dot(h.pin, '#ffe14d', 6); { const [gx, gy] = v.toScreen(golfer.x, golfer.z); this.heading(ctx, gx, gy, heading, 1.6); }
    const [bx, by] = dot(ball, '#fff', 6); ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by, 10, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
    if (target) { const [x, y] = v.toScreen(target.x, target.z); ctx.strokeStyle = '#ff8a3d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 8, y - 8); ctx.lineTo(x + 8, y + 8); ctx.moveTo(x + 8, y - 8); ctx.lineTo(x - 8, y + 8); ctx.stroke(); ctx.lineWidth = 1; }
    if (hover) { const [x, y] = v.toScreen(hover.x, hover.z); ctx.strokeStyle = '#fff'; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]); }
  }
  rf = () => this.hud.querySelector<HTMLElement>('#rf')!;
  rfCanvas = () => this.hud.querySelector<HTMLCanvasElement>('#rf canvas')!;
  rfTip = (t: string | null, x = 0, y = 0) => { const e = this.hud.querySelector<HTMLElement>('#rftip')!; e.style.display = t ? 'block' : 'none'; if (t) { e.textContent = t; e.style.left = `${x + 14}px`; e.style.top = `${y + 14}px`; } };
  prompt(t: string) { const e = this.$('prompt'); e.style.display = t ? 'block' : 'none'; e.textContent = t; }
  meterShow(frac: number | null, label = '', maxZone = true) {
    const e = this.$('meter'); e.style.display = frac === null ? 'none' : 'block';
    // full swing: the bar spans 0..1100 ms (1.4667 turns) and the red band is the max-effort zone; putt and chip: the bar is the full 750 ms, no red band
    if (frac !== null) {
      this.$('mlabel').textContent = label; (e.querySelector('.max') as HTMLElement).style.display = maxZone ? 'block' : 'none';
      this.$('fill').style.width = `${Math.min(1, Math.max(0, frac / (maxZone ? 1100 / 750 : 1))) * 100}%`;
    }
  }
  countdown(t: string) { const e = this.$('cd'); e.style.display = t ? 'block' : 'none'; e.textContent = t; }
  toast(t: string) { const e = this.$('toast'); e.style.display = 'block'; e.textContent = t; clearTimeout(this.toastT); this.toastT = window.setTimeout(() => (e.style.display = 'none'), 3000); }
  card(m: Extract<ServerMsg, { t: 'shotResult' }>) {
    const e = this.$('card'), y = (v: number) => (v * YD).toFixed(1), fx = (n: number) => (n === 0 ? '0' : n > 0 ? `+${n}` : `${n}`);
    const off = m.offlineM * YD;
    e.innerHTML = `<b>Shot</b> ${y(m.totalM)} yd<span class="more"><br>Carry ${y(m.carryM)} yd<br>Total ${y(m.totalM)} yd<br>Offline ${Math.abs(off).toFixed(1)} yd ${off < 0 ? 'L' : 'R'}<br>
      Club ${m.clubSpeedMph.toFixed(0)} mph &middot; Ball ${(m.ballSpeedMs * 2.23694).toFixed(0)} mph<br>Ball: Fwd ${fx(m.effort.fb)} / Away ${fx(m.effort.io)} &middot; ${esc(shotShape(m.effort.fb, m.effort.io))}<br>Effort: ${m.effort.chip ? 'Chip' : m.effort.maxEffort ? 'MAX' : 'Normal'} &middot; ${Math.round(m.effort.length * 100)}%${m.penalty ? `<br>Penalty: ${esc(m.penalty)}` : ''}</span>`;
    // full card for 4 s, then a small "Shot 212 yd" pill that opens it again on tap or click
    e.style.display = 'block'; e.classList.remove('mini'); clearTimeout(this.cardT); this.cardT = window.setTimeout(() => e.classList.add('mini'), 4000);
  }
  /** Mini map oriented tee (bottom) to pin (top). */
  drawMini(h: HoleInfo, dots: { x: number; z: number; shade: string; ball?: boolean; own?: boolean; heading?: number; cart?: boolean }[]) {
    const c = this.mini.getContext('2d')!, W = this.mini.width, H = this.mini.height;
    const dx = h.pin.x - h.tee.x, dz = h.pin.z - h.tee.z, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
    const s = (H - 30) / (L + 20);
    const P = (x: number, z: number): [number, number] => {
      const a = (x - h.tee.x) * ux + (z - h.tee.z) * uz, r = (x - h.tee.x) * uz - (z - h.tee.z) * ux;
      return [W / 2 + r * s, H - 10 - a * s];
    };
    c.fillStyle = '#233'; c.fillRect(0, 0, W, H);
    const g = gridOf(keyOf(h)), img = gridCanvas(keyOf(h), 1, false, true);
    const [x0, zTop] = P(g.x0, g.z0 + g.nz * g.cell);                                // top-left of the grid image on the map
    c.imageSmoothingEnabled = false; c.drawImage(img, x0, zTop, g.nx * g.cell * s, g.nz * g.cell * s);
    const [px, pz] = P(h.pin.x, h.pin.z); c.fillStyle = '#111'; c.fillRect(px - 1, pz - 1, 3, 3);
    const [tx, tz] = P(h.tee.x, h.tee.z); c.fillStyle = '#222'; c.fillRect(tx - 4, tz - 2, 8, 4);
    for (const d of dots) { const [x, y] = P(d.x, d.z); if (d.cart) { c.save(); c.translate(x, y); c.rotate(mapArrowRotation(d.heading ?? 0)); c.fillStyle = d.shade; c.strokeStyle = '#000'; c.fillRect(-3, -5, 6, 10); c.strokeRect(-3, -5, 6, 10); c.fillStyle = '#9cc4ff'; c.fillRect(-2, -4, 4, 3); c.restore(); continue; } if (d.own && d.ball) { c.strokeStyle = '#ffe14d'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 6, 0, 7); c.stroke(); c.lineWidth = 1; } if (d.own && !d.ball && d.heading !== undefined) { this.heading(c, x, y, d.heading, 1); continue; } c.fillStyle = d.shade; c.beginPath(); c.arc(x, y, d.ball ? 2.5 : 4, 0, 7); c.fill(); if (!d.ball) { c.strokeStyle = '#000'; c.stroke(); } }
  }
  /** Google-Maps-style heading marker: a soft view cone behind a chevron pointing where the camera (or, in the stance, the aim) faces. The map stays hole-up; the arrow rotates. */
  private heading(c: CanvasRenderingContext2D, x: number, y: number, yaw: number, k: number) {
    c.save(); c.translate(x, y); c.rotate(mapArrowRotation(yaw));
    const g = c.createRadialGradient(0, 0, 2, 0, 0, 34 * k); g.addColorStop(0, 'rgba(80,160,255,.55)'); g.addColorStop(1, 'rgba(80,160,255,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 34 * k, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5); c.closePath(); c.fill();
    c.fillStyle = '#2f7dff'; c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, -7 * k); c.lineTo(5 * k, 6 * k); c.lineTo(0, 3 * k); c.lineTo(-5 * k, 6 * k); c.closePath(); c.fill(); c.stroke(); c.restore();
  }
}
export type { BallState };
