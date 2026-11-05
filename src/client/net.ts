import type { ClientMsg, ServerMsg } from '../shared/protocol';

/** WebSocket with auto-retry; onUp fires on every (re)connect, onDown on every loss. */
export class Net {
  private ws?: WebSocket;
  constructor(private onMsg: (m: ServerMsg) => void, private onUp: () => void, private onDown: () => void) { this.open(); }
  private open() {
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
    this.ws = ws;
    ws.onopen = () => this.onUp();
    ws.onmessage = e => { try { this.onMsg(JSON.parse(String(e.data)) as ServerMsg); } catch { /* ignore garbage */ } };
    ws.onclose = () => { if (this.ws === ws) { this.onDown(); setTimeout(() => this.open(), 2000); } };
  }
  send(m: ClientMsg) { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m)); }
}
