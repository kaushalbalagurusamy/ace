import type { ErrorCode, LobbyState, LobbyView, Result } from './lobby-types';

interface Lobby { id: string; name: string; host: string; state: LobbyState; members: string[] }
interface Player { name: string; ready: boolean; lobbyId?: string }

const fail = (error: ErrorCode) => ({ ok: false, error }) as const;

export class LobbyManager {
  private readonly maxLobbies: number;
  private readonly maxPlayers: number;
  private players = new Map<string, Player>();
  private lobbies = new Map<string, Lobby>(); // Map keeps creation order
  private nextId = 1;

  constructor(opts: { maxLobbies?: number; maxPlayers?: number } = {}) {
    this.maxLobbies = opts.maxLobbies ?? 3;
    this.maxPlayers = opts.maxPlayers ?? 4;
  }

  connect(sessionId: string, name: string): Result<{ sessionId: string; name: string }> {
    if (this.players.has(sessionId)) return fail('ALREADY_CONNECTED');
    const n = name.trim();
    if (n.length < 2 || n.length > 16) return fail('NAME_INVALID');
    const key = n.toLowerCase();
    for (const p of this.players.values()) if (p.name.toLowerCase() === key) return fail('NAME_TAKEN');
    this.players.set(sessionId, { name: n, ready: false });
    return { ok: true, value: { sessionId, name: n } };
  }

  disconnect(sessionId: string): void {
    if (!this.players.has(sessionId)) return;
    this.remove(sessionId);
    this.players.delete(sessionId);
  }

  createLobby(sessionId: string): Result<LobbyView> {
    const p = this.players.get(sessionId);
    if (!p) return fail('NOT_CONNECTED');
    if (p.lobbyId) return fail('ALREADY_IN_LOBBY');
    if (this.lobbies.size >= this.maxLobbies) return fail('LOBBY_LIMIT');
    const id = `L${this.nextId++}`;
    const lobby: Lobby = { id, name: `${p.name}'s lobby`, host: sessionId, state: 'open', members: [sessionId] };
    this.lobbies.set(id, lobby);
    p.lobbyId = id;
    p.ready = false;
    return { ok: true, value: this.view(lobby) };
  }

  joinLobby(sessionId: string, lobbyId: string): Result<LobbyView> {
    const p = this.players.get(sessionId);
    if (!p) return fail('NOT_CONNECTED');
    if (p.lobbyId) return fail('ALREADY_IN_LOBBY');
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return fail('LOBBY_NOT_FOUND');
    if (lobby.state !== 'open') return fail('LOBBY_NOT_OPEN');
    if (lobby.members.length >= this.maxPlayers) return fail('LOBBY_FULL');
    lobby.members.push(sessionId);
    p.lobbyId = lobbyId;
    p.ready = false;
    return { ok: true, value: this.view(lobby) };
  }

  leaveLobby(sessionId: string): Result<null> {
    const p = this.players.get(sessionId);
    if (!p) return fail('NOT_CONNECTED');
    if (!p.lobbyId) return fail('NOT_IN_LOBBY');
    this.remove(sessionId);
    return { ok: true, value: null };
  }

  setReady(sessionId: string, ready: boolean): Result<LobbyView> {
    const c = this.ctx(sessionId);
    if (!c.ok) return c;
    if (c.lobby.state !== 'open') return fail('LOBBY_NOT_OPEN');
    c.player.ready = ready;
    return { ok: true, value: this.view(c.lobby) };
  }

  renameLobby(sessionId: string, name: string): Result<LobbyView> {
    const c = this.ctx(sessionId);
    if (!c.ok) return c;
    if (c.lobby.host !== sessionId) return fail('NOT_HOST');
    const n = name.trim();
    if (n.length < 1 || n.length > 24) return fail('NAME_INVALID');
    c.lobby.name = n;
    return { ok: true, value: this.view(c.lobby) };
  }

  start(sessionId: string): Result<LobbyView> {
    const c = this.ctx(sessionId);
    if (!c.ok) return c;
    if (c.lobby.host !== sessionId) return fail('NOT_HOST');
    if (c.lobby.state !== 'open') return fail('LOBBY_NOT_OPEN');
    if (c.lobby.members.length < 2) return fail('NEED_PLAYERS');
    if (!c.lobby.members.every((m) => this.players.get(m)!.ready)) return fail('NOT_READY');
    c.lobby.state = 'starting';
    return { ok: true, value: this.view(c.lobby) };
  }

  startSolo(sessionId: string): Result<LobbyView> {
    const c = this.ctx(sessionId);
    if (!c.ok) return c;
    if (c.lobby.host !== sessionId) return fail('NOT_HOST');
    if (c.lobby.state !== 'open') return fail('LOBBY_NOT_OPEN');
    // ambiguity: no dedicated code for "more than 1 player"; reuse NEED_PLAYERS
    if (c.lobby.members.length !== 1) return fail('NEED_PLAYERS');
    c.lobby.state = 'starting';
    return { ok: true, value: this.view(c.lobby) };
  }

  list(): LobbyView[] {
    return [...this.lobbies.values()].map((l) => this.view(l));
  }

  lobbyOf(sessionId: string): LobbyView | undefined {
    const id = this.players.get(sessionId)?.lobbyId;
    return id ? this.view(this.lobbies.get(id)!) : undefined;
  }

  private ctx(sessionId: string): { ok: false; error: ErrorCode } | { ok: true; player: Player; lobby: Lobby } {
    const player = this.players.get(sessionId);
    if (!player) return fail('NOT_CONNECTED');
    if (!player.lobbyId) return fail('NOT_IN_LOBBY');
    return { ok: true, player, lobby: this.lobbies.get(player.lobbyId)! };
  }

  /** Removes player from their lobby; promotes oldest member as host, closes empty lobby. */
  private remove(sessionId: string): void {
    const p = this.players.get(sessionId)!;
    const lobby = p.lobbyId ? this.lobbies.get(p.lobbyId) : undefined;
    p.lobbyId = undefined;
    p.ready = false;
    if (!lobby) return;
    lobby.members = lobby.members.filter((m) => m !== sessionId);
    if (lobby.members.length === 0) this.lobbies.delete(lobby.id);
    else if (lobby.host === sessionId) lobby.host = lobby.members[0]!;
  }

  private view(l: Lobby): LobbyView {
    return {
      id: l.id,
      name: l.name,
      hostSessionId: l.host,
      state: l.state,
      players: l.members.map((m) => {
        const p = this.players.get(m)!;
        return { sessionId: m, name: p.name, ready: p.ready };
      }),
    };
  }
}
