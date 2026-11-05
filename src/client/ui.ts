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
<li><b>Move</b> WASD, <b>look and aim</b> mouse (no aim line: line up by eye; the mini map and its rangefinder help you pick a club)</li>
<li><b>Clubs</b> 1 to 0, - , = , O ; <b>P</b> is the putter</li>
<li><b>Swing</b> stand by your ball and press Space to take your stance (aim locks). Then <b>press and hold Space</b>: the club swings back and the meter fills. <b>Release Space at the length you want</b> (a short hold is a short shot). Then press Z, X, C in order (hips, shoulders, release) right after the release. Good timing = straight and long. Esc cancels before the release</li>
<li><b>Putt</b> P, Space to take your stance, hold Space to draw back, release to strike: the longer the hold, the harder the putt</li>
<li><b>Shot card</b> after every shot: carry, total, offline and how well you timed each key</li>
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
      <div class="hud" id="meter"><div id="mlabel"></div><div style="background:#444"><div id="fill"></div></div></div>
      <div class="hud" id="cd"></div><div class="hud" id="toast"></div>`;
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
  prompt(t: string) { const e = this.$('prompt'); e.style.display = t ? 'block' : 'none'; e.textContent = t; }
  meterShow(frac: number | null, label = '') {
    const e = this.$('meter'); e.style.display = frac === null ? 'none' : 'block';
    if (frac !== null) { this.$('mlabel').textContent = label; this.$('fill').style.width = `${Math.min(1, Math.max(0, frac)) * 100}%`; }
  }
  countdown(t: string) { const e = this.$('cd'); e.style.display = t ? 'block' : 'none'; e.textContent = t; }
  toast(t: string) { const e = this.$('toast'); e.style.display = 'block'; e.textContent = t; clearTimeout(this.toastT); this.toastT = window.setTimeout(() => (e.style.display = 'none'), 3000); }
  card(m: Extract<ServerMsg, { t: 'shotResult' }>) {
    const e = this.$('card'), y = (v: number) => (v * YD).toFixed(1), g = (v: number) => ((1 - v) * 100).toFixed(0) + '%'; // server sends normalised error n; show accuracy
    const off = m.offlineM * YD;
    e.innerHTML = `<b>Shot</b><br>Carry ${y(m.carryM)} yd<br>Total ${y(m.totalM)} yd<br>Offline ${Math.abs(off).toFixed(1)} yd ${off < 0 ? 'L' : 'R'}<br>
      Club ${m.clubSpeedMph.toFixed(0)} mph &middot; Ball ${(m.ballSpeedMs * 2.23694).toFixed(0)} mph<br>Timing Z ${g(m.grade.z)} X ${g(m.grade.x)} C ${g(m.grade.c)}${m.penalty ? `<br>Penalty: ${esc(m.penalty)}` : ''}`;
    e.style.display = 'block'; clearTimeout(this.cardT); this.cardT = window.setTimeout(() => (e.style.display = 'none'), 10000); // 10 s so a physics tester can read it; PRD said 4 s
  }
  /** Mini map oriented tee (bottom) to pin (top). */
  drawMini(h: HoleInfo, dots: { x: number; z: number; shade: string; ball?: boolean }[]) {
    const c = this.mini.getContext('2d')!, W = this.mini.width, H = this.mini.height;
    const dx = h.pin.x - h.tee.x, dz = h.pin.z - h.tee.z, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
    const s = (H - 30) / (L + 20);
    const P = (x: number, z: number): [number, number] => {
      const a = (x - h.tee.x) * ux + (z - h.tee.z) * uz, r = (x - h.tee.x) * uz - (z - h.tee.z) * ux;
      return [W / 2 + r * s, H - 10 - a * s];
    };
    c.fillStyle = '#555'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#7a7a7a'; c.fillRect(W / 2 - (h.fairwayHalfWidth + 3) * s, H - 10 - L * s, 2 * (h.fairwayHalfWidth + 3) * s, L * s);
    c.fillStyle = '#9a9a9a'; c.fillRect(W / 2 - h.fairwayHalfWidth * s, H - 10 - L * s, 2 * h.fairwayHalfWidth * s, L * s);
    const [px, pz] = P(h.pin.x, h.pin.z); c.fillStyle = '#ddd'; c.beginPath(); c.arc(px, pz, h.greenRadius * s, 0, 7); c.fill();
    c.fillStyle = '#111'; c.fillRect(px - 1, pz - 1, 3, 3);
    const [tx, tz] = P(h.tee.x, h.tee.z); c.fillStyle = '#222'; c.fillRect(tx - 4, tz - 2, 8, 4);
    for (const d of dots) { const [x, y] = P(d.x, d.z); c.fillStyle = d.shade; c.beginPath(); c.arc(x, y, d.ball ? 2.5 : 4, 0, 7); c.fill(); if (!d.ball) { c.strokeStyle = '#000'; c.stroke(); } }
  }
}
export type { BallState };
