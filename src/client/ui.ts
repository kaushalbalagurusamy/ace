import { GRIDS } from '../shared/course-grid';
import { gridCanvas, rfView } from './terrain';
import { edgePoint, mapArrowRotation, type Marker } from './overlay';
import { SLIDER_STEP, MIN_MULT, MAX_MULT, DEFAULT_MULT } from './sensitivity';
import type { BallState, HoleInfo, ServerMsg } from '../shared/protocol';
import type { LobbyView } from '../server/lobby-types';

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
  NOT_HOST: 'Only the host can do that.', NEED_PLAYERS: 'Starting needs at least 2 players.', NOT_READY: 'Everyone must be ready first.',
  BAD_MESSAGE: 'The server rejected that request.', NOT_YOUR_TURN: 'Not your turn.', NOT_IN_RACE: 'You are not in a race.',
};
export const errText = (m: Extract<ServerMsg, { t: 'error' }>) => ERR[m.code] ?? m.message;

const HELP = `<details class="help" open><summary>How to play</summary><ul>
<li><b>Move</b> with the arrow keys (hold <b>Shift</b> to walk slowly and aim finely). <b>Look</b> with the mouse. There is no aim line: line up by eye, and use <b>M</b> for the rangefinder</li>
<li><b>Clubs</b> 1 to 0, - , = , O ; <b>P</b> is the putter. You can change club right up until you start the backswing</li>
<li><b>Swing</b> walk to your ball and press <b>Space</b> to take your stance: the mouse still turns your aim. <b>W S A D</b> set the ball position (forward = higher, back = lower, away from you = a draw, closer = a fade). Then <b>press and hold Space</b>: the meter fills, <b>release</b> to hit. A short hold is a short shot. Hold past full into the red zone for a MAX effort shot: 20% further, 70% accurate. <b>Esc</b> cancels before you release</li>
<li><b>Putt</b> P, Space for the stance, hold Space to draw back, release to strike: the longer the hold, the harder the putt</li>
<li><b>Shot card</b> after every shot: carry, total, offline, ball position and effort</li>
<li>The red flag shows where the pin is; the yellow beacon shows your ball. White lines mark out of bounds</li>
<li>First to hole out wins; fewer strokes only decides finishes within 1 second</li></ul></details>`;
const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
export interface Row { id: string; name: string; hole: number; strokes: number; done: boolean }

const CSS = `
#ui{position:fixed;inset:0;z-index:1;pointer-events:none;font:14px system-ui;color:#eee}
.scr{position:absolute;inset:0;background:#1c1c1c;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;pointer-events:auto}
.help{max-width:560px;font-size:13px;opacity:.9}.help ul{margin:4px 0 0;padding-left:18px;text-align:left}.help summary{cursor:pointer}
.scr h1{font-size:56px;margin:0;letter-spacing:6px}
.scr button,.scr input{font:inherit;padding:8px 14px;background:#444;color:#eee;border:1px solid #777;border-radius:3px}
.scr button:disabled{opacity:.4}.scr button:not(:disabled){cursor:pointer}
.box{background:#2a2a2a;padding:10px 14px;min-width:360px;border:1px solid #555}.row{display:flex;justify-content:space-between;gap:12px;align-items:center;margin:4px 0}
.err{color:#e88;min-height:1.2em}
.hud{position:absolute;background:rgba(20,20,20,.7);padding:6px 10px;border-radius:3px}
#bag{top:6px;left:50%;transform:translateX(-50%);display:flex;gap:3px;padding:4px}
.slot{width:54px;text-align:center;padding:3px 0;background:#333;border:1px solid #555;font-size:12px}.slot b{display:block;color:#aaa}.slot.on{background:#ddd;color:#111}.slot.on b{color:#333}
#info{left:10px;bottom:10px;line-height:1.5}#lb{left:10px;top:10px}#mini{right:10px;top:10px;padding:0}
#card{right:10px;bottom:10px;min-width:210px;display:none}#prompt{left:50%;bottom:90px;transform:translateX(-50%);display:none}
#meter{left:50%;bottom:50px;transform:translateX(-50%);width:300px;display:none}#fill{height:12px;background:#ddd;width:0}
#cd{left:50%;top:35%;transform:translate(-50%);font-size:96px;background:none;display:none}
#toast{left:50%;top:70px;transform:translateX(-50%);display:none}
#bpos{left:10px;bottom:84px;display:none;text-align:center;font-size:11px;padding:6px 8px}#bpos canvas{display:block;margin:0 auto 2px}
#meter .track{position:relative;background:#444;height:12px}#meter .max{position:absolute;right:0;top:0;bottom:0;width:31.8%;background:rgba(210,40,40,.6)}#meter #fill{position:relative;z-index:1;opacity:.9}
#pin{position:absolute;display:none;pointer-events:none;background:none;padding:0;text-align:center;color:#fff;font-weight:700;text-shadow:0 0 4px #000;width:110px}#pin svg{display:block;margin:0 auto}
#gear{left:10px;top:84px;cursor:pointer;font-size:18px;padding:2px 8px;pointer-events:auto;user-select:none}
#settings{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:none;pointer-events:auto;min-width:340px;padding:16px 20px;background:rgba(18,24,22,.96);border:1px solid #567}#settings h3{margin:0 0 10px}#settings input[type=range]{width:100%}#settings button{margin-top:8px}
#banner{left:50%;top:22%;transform:translateX(-50%);font-size:26px;padding:12px 22px;background:rgba(150,30,30,.88);display:none;text-align:center;max-width:70%}
#arrow{position:absolute;display:none;background:none;padding:0;pointer-events:none;color:#ffe14d;font-weight:700;text-shadow:0 0 4px #000;text-align:center;width:90px}#arrow i{display:block;width:0;height:0;margin:0 auto;border-left:12px solid transparent;border-right:12px solid transparent;border-bottom:22px solid #ffe14d}
#keys{left:50%;bottom:8px;transform:translateX(-50%);font-size:11px;opacity:.75;background:none;padding:0}
#rf{position:absolute;inset:6% 12%;display:none;background:rgba(12,20,16,.94);border:2px solid #678;pointer-events:auto;padding:0}#rf canvas{width:100%;height:100%;display:block;cursor:crosshair}
#rftip{position:absolute;pointer-events:none;background:rgba(0,0,0,.85);padding:6px 10px;border-radius:3px;display:none;white-space:pre;line-height:1.4}
table{border-collapse:collapse;min-width:360px}td,th{padding:3px 10px;text-align:left}
`;

export class UI {
  root = document.getElementById('app')!;
  private scr = Object.assign(document.createElement('div'), { className: 'scr' });
  private hud = document.createElement('div');
  private mini!: HTMLCanvasElement;
  private $ = (id: string) => this.hud.querySelector<HTMLElement>('#' + id)!;
  private toastT = 0; private cardT = 0;
  constructor(public act: (a: string, d: DOMStringMap, form: HTMLElement) => void) {
    document.head.insertAdjacentHTML('beforeend', `<style>${CSS}</style>`);
    this.root.id = 'ui'; this.hud.style.display = 'none';
    this.hud.innerHTML = `<div class="hud" id="bag">${BAG.map(b => `<div class="slot"><b>${b.key}</b>${b.label}</div>`).join('')}</div>
      <div class="hud" id="lb"></div><div class="hud" id="mini"><canvas width="150" height="210"></canvas></div>
      <div class="hud" id="info"></div><div class="hud" id="card"></div><div class="hud" id="prompt"></div>
      <div class="hud" id="meter"><div id="mlabel"></div><div class="track"><div id="fill"></div><div class="max"></div></div></div><div class="hud" id="bpos"><canvas width="100" height="100"></canvas><span></span></div>
      <div class="hud" id="cd"></div><div class="hud" id="toast"></div><div class="hud" id="banner"></div><div class="hud" id="arrow"><i></i><span></span></div>
      <div class="hud" id="keys">Arrows move · Shift walk / fine aim · Space swing · W S A D ball position · M rangefinder · N mute · , . look speed</div>
      <div class="hud" id="pin"><svg width="26" height="30" viewBox="0 0 26 30"><line x1="5" y1="2" x2="5" y2="29" stroke="#fff" stroke-width="2.5"/><path d="M5 3 L24 9 L5 15 Z" fill="#e53935" stroke="#fff" stroke-width="1.5"/></svg><span></span></div>
      <div class="hud" id="gear" title="Settings">&#9881;</div>
      <div class="hud" id="settings"><h3>Settings</h3><label>Camera sensitivity <b id="sensval"></b></label><input id="sens" type="range" min="${MIN_MULT}" max="${MAX_MULT}" step="${SLIDER_STEP}"><button id="sensreset">Reset to default (${DEFAULT_MULT}×)</button><div style="margin-top:10px;font-size:12px;opacity:.8">, and . also change it. Esc closes this menu.</div></div><div id="rf"><canvas></canvas><div id="rftip"></div></div>`;
    this.root.append(this.scr, this.hud);
    this.mini = this.hud.querySelector('canvas')!;
    this.scr.addEventListener('click', e => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
      if (el && !(el as HTMLButtonElement).disabled) this.act(el.dataset.act!, el.dataset, this.scr);
    });
    this.scr.addEventListener('submit', e => e.preventDefault());
  }
  screen(html: string | null) { this.scr.style.display = html ? '' : 'none'; if (html) this.scr.innerHTML = html; this.hud.style.display = html ? 'none' : ''; }
  /** HUD stays visible (race underneath) when html is null. */
  showTouch() { this.screen(`<h1>Ace</h1><p>Keyboard required. Open this on a desktop or laptop.</p>`); }
  showDown(msg: string) { this.screen(`<h1>Ace</h1><p>${esc(msg)}</p><p>Reconnecting...</p>`); }
  showName(name: string, err = '') {
    this.screen(`<h1>Ace</h1><form class="box"><div class="row"><label>Your name</label><input id="nm" value="${esc(name)}" maxlength="16" minlength="2" autofocus></div>
      <div class="err">${esc(err)}</div><button data-act="name">Enter waiting room</button></form>`);
    this.scr.querySelector('input')!.addEventListener('keydown', e => { if (e.key === 'Enter') this.act('name', {}, this.scr); });
  }
  showMenu(m: { self: string; lobbies: LobbyView[]; lobby: LobbyView | null; error: string; count: number | null }) {
    const err = `<div class="err">${esc(m.error)}</div>`;
    if (m.lobby) {
      const l = m.lobby, host = l.hostSessionId === m.self, me = l.players.find(p => p.sessionId === m.self);
      const allReady = l.players.length >= 2 && l.players.every(p => p.ready);
      this.screen(`<h1>Ace</h1><div class="box"><b>${esc(l.name)}</b>${l.players.map(p => `<div class="row"><span>${esc(p.name)}${p.sessionId === l.hostSessionId ? ' (host)' : ''}</span><span>${p.ready ? 'Ready' : 'Not ready'}</span></div>`).join('')}</div>
        ${m.count !== null ? `<h2>Starting in ${m.count}</h2>` : ''}${err}
        <div><button data-act="ready" data-v="${me?.ready ? '' : '1'}">${me?.ready ? 'Not ready' : 'Ready'}</button>
        ${host ? `<button data-act="start" ${allReady ? '' : 'disabled'}>Start</button>` : ''}
        ${host && l.players.length === 1 ? `<button data-act="solo">Solo time trial</button>` : ''}
        <button data-act="leave">Leave lobby</button></div>${HELP}`);
      return;
    }
    const full = m.lobbies.length >= 3;
    this.screen(`<h1>Ace</h1><h3>Waiting room</h3><div class="box">${m.lobbies.map(l => {
      const can = l.state === 'open' && l.players.length < 4;
      return `<div class="row"><span>${esc(l.name)} (${l.players.length}/4, ${l.state})</span><button data-act="join" data-id="${esc(l.id)}" ${can ? '' : 'disabled'}>Join</button></div>`;
    }).join('') || 'No lobbies yet.'}</div>${err}
      <button data-act="create" ${full ? 'disabled' : ''}>${full ? 'All 3 lobbies in use' : 'Create lobby'}</button>${HELP}`);
  }
  showResults(rows: { place: number; name: string; timeS?: number; strokes: number }[]) {
    this.screen(`<h1>Results</h1><table><tr><th>Place</th><th>Name</th><th>Time</th><th>Strokes</th></tr>${rows.map(r =>
      `<tr><td>${r.place}</td><td>${esc(r.name)}</td><td>${r.timeS === undefined ? 'DNF' : this.clock(r.timeS)}</td><td>${r.strokes}</td></tr>`).join('')}</table>
      <button data-act="back">Back to waiting room</button>`);
  }
  clock(s: number) { s = Math.max(0, s); return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`; }

  // --- HUD ---
  setClub(i: number) { this.hud.querySelectorAll('.slot').forEach((e, j) => e.classList.toggle('on', i === j)); }
  info(hole: HoleInfo, yards: number, lie: string, clock: string, strokes: number) {
    this.$('info').innerHTML = `Hole ${hole.index + 1} &middot; Par ${hole.par} &middot; Strokes ${strokes}<br>Pin ${Math.round(yards)} yd &middot; Lie: ${esc(lie)}<br>Clock ${clock}`;
  }
  board(rows: Row[], self: string) {
    this.$('lb').innerHTML = rows.map(r => `<div style="${r.id === self ? 'font-weight:bold' : ''}">${esc(r.name)} &nbsp; H${r.hole + 1} &nbsp; ${r.strokes}${r.done ? ' &check;' : ''}</div>`).join('');
  }
  /** Small grid showing where the ball sits against the feet in the stance (fb: up = forward, io: right = away from the body). */
  ballPosGrid(p: { fb: number; io: number } | null) {
    const e = this.$('bpos'); e.style.display = p ? 'block' : 'none'; if (!p) return;
    const c = e.querySelector('canvas')!, x = c.getContext('2d')!; x.clearRect(0, 0, 100, 100); x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(0, 0, 100, 100); x.strokeStyle = '#777';
    for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(10 + i * 20, 10); x.lineTo(10 + i * 20, 90); x.moveTo(10, 10 + i * 20); x.lineTo(90, 10 + i * 20); x.stroke(); }
    x.fillStyle = '#9ad'; x.fillRect(46, 90 - 28, 8, 28 + 4 - 4);                           // the feet / body line below the grid centre
    x.fillStyle = '#fff'; x.beginPath(); x.arc(10 + (p.io + 2) * 20, 10 + (2 - p.fb) * 20, 6, 0, 7); x.fill();
    x.fillStyle = '#ffe14d'; x.beginPath(); x.arc(50, 50, 2, 0, 7); x.fill();                // the centre (optimal)
    e.querySelector('span')!.textContent = `Fwd ${p.fb >= 0 ? '+' : ''}${p.fb} · Away ${p.io >= 0 ? '+' : ''}${p.io}`;
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
  toggleSettings(open?: boolean) { const p = this.$('settings'); const show = open ?? p.style.display !== 'block'; p.style.display = show ? 'block' : 'none'; if (show) { document.exitPointerLock(); this.syncSettings(); } return show; }
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
    const ctx = c.getContext('2d')!, v = rfView(h.index, c.width, c.height); ctx.fillStyle = '#10181a'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(gridCanvas(h.index, 2, false, true), v.x0, v.y0, v.w, v.h);
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
  meterShow(frac: number | null, label = '') {
    const e = this.$('meter'); e.style.display = frac === null ? 'none' : 'block';
    // the bar spans 0 to 1100 ms of hold (1.4667 of the full turn); the red band is the max-effort zone beyond the full 750 ms
    if (frac !== null) { this.$('mlabel').textContent = label; this.$('fill').style.width = `${Math.min(1, Math.max(0, frac / (1100 / 750))) * 100}%`; }
  }
  countdown(t: string) { const e = this.$('cd'); e.style.display = t ? 'block' : 'none'; e.textContent = t; }
  toast(t: string) { const e = this.$('toast'); e.style.display = 'block'; e.textContent = t; clearTimeout(this.toastT); this.toastT = window.setTimeout(() => (e.style.display = 'none'), 3000); }
  card(m: Extract<ServerMsg, { t: 'shotResult' }>) {
    const e = this.$('card'), y = (v: number) => (v * YD).toFixed(1), fx = (n: number) => (n === 0 ? '0' : n > 0 ? `+${n}` : `${n}`);
    const off = m.offlineM * YD;
    e.innerHTML = `<b>Shot</b><br>Carry ${y(m.carryM)} yd<br>Total ${y(m.totalM)} yd<br>Offline ${Math.abs(off).toFixed(1)} yd ${off < 0 ? 'L' : 'R'}<br>
      Club ${m.clubSpeedMph.toFixed(0)} mph &middot; Ball ${(m.ballSpeedMs * 2.23694).toFixed(0)} mph<br>Ball: Fwd ${fx(m.effort.fb)} / Away ${fx(m.effort.io)}<br>Effort: ${m.effort.maxEffort ? 'MAX' : 'Normal'} &middot; ${Math.round(m.effort.length * 100)}%${m.penalty ? `<br>Penalty: ${esc(m.penalty)}` : ''}`;
    e.style.display = 'block'; clearTimeout(this.cardT); this.cardT = window.setTimeout(() => (e.style.display = 'none'), 10000); // 10 s so a physics tester can read it; PRD said 4 s
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
    const g = GRIDS[h.index]!, img = gridCanvas(h.index, 1, false, true);
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
