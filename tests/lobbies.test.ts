import { describe, it, expect } from 'vitest';
import { LobbyManager } from '../src/server';

function setup(n: number) {
  const m = new LobbyManager();
  const ids = Array.from({ length: n }, (_, i) => `s${i}`);
  ids.forEach((id, i) => expect(m.connect(id, `player${i}`).ok).toBe(true));
  return { m, ids };
}
const err = (r: { ok: boolean }) => (r as { ok: false; error: string }).error;
const val = <T,>(r: { ok: boolean }) => (r as { ok: true; value: T }).value;

describe('names', () => {
  it('rejects too short, too long and duplicate names (case-insensitive); trims', () => {
    const m = new LobbyManager();
    expect(err(m.connect('a', 'x'))).toBe('NAME_INVALID');
    expect(err(m.connect('a', 'x'.repeat(17)))).toBe('NAME_INVALID');
    expect(err(m.connect('a', '   a  '))).toBe('NAME_INVALID');
    expect(m.connect('a', 'Bob').ok).toBe(true);
    expect(err(m.connect('b', 'bob'))).toBe('NAME_TAKEN');
    expect(m.connect('c', 'x'.repeat(16)).ok).toBe(true);
    expect(m.connect('d', 'xy').ok).toBe(true);
  });
  it('a disconnected name is free again; reusing a sessionId is rejected', () => {
    const m = new LobbyManager();
    m.connect('a', 'Bob');
    expect(err(m.connect('a', 'Other'))).toBe('ALREADY_CONNECTED');
    m.disconnect('a');
    expect(m.connect('b', 'Bob').ok).toBe(true);
  });
  it('unknown sessions get NOT_CONNECTED', () => {
    const m = new LobbyManager();
    expect(err(m.createLobby('ghost'))).toBe('NOT_CONNECTED');
    expect(err(m.joinLobby('ghost', 'x'))).toBe('NOT_CONNECTED');
  });
});

describe('name hygiene', () => {
  it('rejects control, zero-width, bidi characters and non-strings; NFKC makes fullwidth equal to ASCII', () => {
    const m = new LobbyManager();
    expect(err(m.connect('a', 'bo\u200Bb'))).toBe('NAME_INVALID');
    expect(err(m.connect('a', 'bo\u202Eb'))).toBe('NAME_INVALID');
    expect(err(m.connect('a', 'bo\nb'))).toBe('NAME_INVALID');
    expect(err(m.connect('a', 42 as unknown as string))).toBe('NAME_INVALID');
    expect(m.connect('a', 'Bob').ok).toBe(true);
    expect(err(m.connect('b', '\uFF22\uFF4F\uFF42'))).toBe('NAME_TAKEN'); // fullwidth "Bob"
  });
  it('lobby rename rejects zero-width characters', () => {
    const { m, ids } = setup(1);
    m.createLobby(ids[0]!);
    expect(err(m.renameLobby(ids[0]!, 'a\u200Bb'))).toBe('NAME_INVALID');
    expect(m.renameLobby(ids[0]!, "Ann's lobby").ok).toBe(true);
  });
});

describe('AC-L1 lobby limit', () => {
  it('a 4th lobby is rejected by the server', () => {
    const { m, ids } = setup(4);
    for (const id of ids.slice(0, 3)) expect(m.createLobby(id).ok).toBe(true);
    expect(m.list()).toHaveLength(3);
    expect(err(m.createLobby(ids[3]!))).toBe('LOBBY_LIMIT');
    expect(m.list()).toHaveLength(3);
  });
  it('closing a lobby frees a slot', () => {
    const { m, ids } = setup(4);
    for (const id of ids.slice(0, 3)) m.createLobby(id);
    m.leaveLobby(ids[0]!);
    expect(m.list()).toHaveLength(2);
    expect(m.createLobby(ids[3]!).ok).toBe(true);
  });
  it('a player already in a lobby cannot create another', () => {
    const { m, ids } = setup(1);
    m.createLobby(ids[0]!);
    expect(err(m.createLobby(ids[0]!))).toBe('ALREADY_IN_LOBBY');
  });
});

describe('AC-L2 capacity', () => {
  it('5th player is rejected, 4 stay', () => {
    const { m, ids } = setup(5);
    const lobby = val<{ id: string }>(m.createLobby(ids[0]!));
    for (const id of ids.slice(1, 4)) expect(m.joinLobby(id, lobby.id).ok).toBe(true);
    expect(err(m.joinLobby(ids[4]!, lobby.id))).toBe('LOBBY_FULL');
    expect(m.lobbyOf(ids[0]!)!.players).toHaveLength(4);
    expect(m.lobbyOf(ids[4]!)).toBeUndefined();
  });
  it('two joins into a 3-player lobby: exactly one gets in', () => {
    const { m, ids } = setup(6);
    const lobby = val<{ id: string }>(m.createLobby(ids[0]!));
    m.joinLobby(ids[1]!, lobby.id); m.joinLobby(ids[2]!, lobby.id);
    const results = [m.joinLobby(ids[3]!, lobby.id), m.joinLobby(ids[4]!, lobby.id)];
    expect(results.filter(r => r.ok)).toHaveLength(1);
    expect(m.list()[0]!.players).toHaveLength(4);
  });
  it('unknown lobby id', () => {
    const { m, ids } = setup(1);
    expect(err(m.joinLobby(ids[0]!, 'nope'))).toBe('LOBBY_NOT_FOUND');
  });
});

describe('hosting and leaving', () => {
  it('creator is host; default name uses host name; rename is host-only and 1..24 chars', () => {
    const { m, ids } = setup(2);
    const lobby = val<{ id: string; name: string; hostSessionId: string }>(m.createLobby(ids[0]!));
    expect(lobby.hostSessionId).toBe(ids[0]);
    expect(lobby.name).toBe("player0's lobby");
    m.joinLobby(ids[1]!, lobby.id);
    expect(err(m.renameLobby(ids[1]!, 'Mine'))).toBe('NOT_HOST');
    expect(err(m.renameLobby(ids[0]!, ''))).toBe('NAME_INVALID');
    expect(err(m.renameLobby(ids[0]!, 'x'.repeat(25)))).toBe('NAME_INVALID');
    expect(val<{ name: string }>(m.renameLobby(ids[0]!, 'x'.repeat(24))).name).toHaveLength(24);
  });
  it('AC-L4 host leaving or disconnecting promotes the longest-present player', () => {
    const { m, ids } = setup(3);
    const lobby = val<{ id: string }>(m.createLobby(ids[0]!));
    m.joinLobby(ids[1]!, lobby.id); m.joinLobby(ids[2]!, lobby.id);
    m.disconnect(ids[0]!);
    expect(m.list()[0]!.hostSessionId).toBe(ids[1]);
    m.leaveLobby(ids[1]!);
    expect(m.list()[0]!.hostSessionId).toBe(ids[2]);
  });
  it('last player leaving closes the lobby', () => {
    const { m, ids } = setup(1);
    m.createLobby(ids[0]!);
    expect(m.leaveLobby(ids[0]!).ok).toBe(true);
    expect(m.list()).toEqual([]);
    expect(err(m.leaveLobby(ids[0]!))).toBe('NOT_IN_LOBBY');
  });
  it('list() returns copies, not live state', () => {
    const { m, ids } = setup(1);
    m.createLobby(ids[0]!);
    m.list()[0]!.players.length = 0;
    expect(m.list()[0]!.players).toHaveLength(1);
  });
});

describe('start rules', () => {
  it('needs >=2 players, all ready, host only; then lobby is starting and unjoinable', () => {
    const { m, ids } = setup(3);
    const lobby = val<{ id: string }>(m.createLobby(ids[0]!));
    expect(err(m.start(ids[0]!))).toBe('NEED_PLAYERS');
    m.joinLobby(ids[1]!, lobby.id);
    expect(err(m.start(ids[0]!))).toBe('NOT_READY');
    m.setReady(ids[0]!, true); m.setReady(ids[1]!, true);
    expect(err(m.start(ids[1]!))).toBe('NOT_HOST');
    expect(val<{ state: string }>(m.start(ids[0]!)).state).toBe('starting');
    expect(err(m.joinLobby(ids[2]!, lobby.id))).toBe('LOBBY_NOT_OPEN');
    expect(err(m.start(ids[0]!))).toBe('LOBBY_NOT_OPEN');
  });
  it('unreadying blocks start again', () => {
    const { m, ids } = setup(2);
    const lobby = val<{ id: string }>(m.createLobby(ids[0]!));
    m.joinLobby(ids[1]!, lobby.id);
    m.setReady(ids[0]!, true); m.setReady(ids[1]!, true); m.setReady(ids[1]!, false);
    expect(err(m.start(ids[0]!))).toBe('NOT_READY');
  });
  it('solo time trial: host alone only', () => {
    const { m, ids } = setup(2);
    const lobby = val<{ id: string }>(m.createLobby(ids[0]!));
    expect(val<{ state: string }>(m.startSolo(ids[0]!)).state).toBe('starting');
    const m2 = setup(2);
    const l2 = val<{ id: string }>(m2.m.createLobby(m2.ids[0]!));
    m2.m.joinLobby(m2.ids[1]!, l2.id);
    expect(err(m2.m.startSolo(m2.ids[0]!))).toBe('NEED_PLAYERS'); // not alone
    expect(lobby.id).toBeTruthy();
  });
  it('disconnect during starting still removes the player and closes an emptied lobby', () => {
    const { m, ids } = setup(1);
    m.createLobby(ids[0]!); m.startSolo(ids[0]!);
    m.disconnect(ids[0]!);
    expect(m.list()).toEqual([]);
  });
});

describe('state transitions (stuck-lobby fix)', () => {
  it('setState moves a lobby through in_race back to open and clears ready flags', () => {
    const { m, ids } = setup(2);
    const lobby = val<{ id: string }>(m.createLobby(ids[0]!));
    m.joinLobby(ids[1]!, lobby.id);
    m.setReady(ids[0]!, true); m.setReady(ids[1]!, true); m.start(ids[0]!);
    expect(m.setState(lobby.id, 'in_race')).toBe(true);
    expect(m.list()[0]!.state).toBe('in_race');
    expect(m.setState(lobby.id, 'open')).toBe(true);
    expect(m.list()[0]!.state).toBe('open');
    expect(m.list()[0]!.players.every(p => !p.ready)).toBe(true);
    // play again is possible: ready up and start again
    m.setReady(ids[0]!, true); m.setReady(ids[1]!, true);
    expect(m.start(ids[0]!).ok).toBe(true);
  });
  it('setState on an unknown lobby is false', () => {
    expect(new LobbyManager().setState('nope', 'open')).toBe(false);
  });
});
