// Contract for the in-memory lobby manager (PRD/01). Pure logic, no sockets, no timers.
// The ws layer maps messages onto these calls; every rule here is enforced server-side (AC-L1, AC-L2).

export type ErrorCode =
  | 'NAME_INVALID'      // not 2..16 chars after trim
  | 'NAME_TAKEN'        // another connected player has it (case-insensitive)
  | 'NOT_CONNECTED'     // unknown sessionId
  | 'ALREADY_CONNECTED' // sessionId already connected
  | 'ALREADY_IN_LOBBY'
  | 'NOT_IN_LOBBY'
  | 'LOBBY_LIMIT'       // 3 lobbies exist
  | 'LOBBY_NOT_FOUND'
  | 'LOBBY_FULL'        // 4 players
  | 'LOBBY_NOT_OPEN'    // state is not 'open'
  | 'NOT_HOST'
  | 'NEED_PLAYERS'      // start needs >= 2 players
  | 'NOT_READY';        // start needs every player ready

export type Result<T> = { ok: true; value: T } | { ok: false; error: ErrorCode };
export type LobbyState = 'open' | 'starting' | 'in_race' | 'results';

export interface LobbyPlayerView { sessionId: string; name: string; ready: boolean }
export interface LobbyView {
  id: string;
  /** default "<host>'s lobby" */ name: string;
  hostSessionId: string;
  state: LobbyState;
  /** join order, oldest first */ players: LobbyPlayerView[];
}

// contract: export class LobbyManager {
//   constructor(opts?: { maxLobbies?: number /* 3 */; maxPlayers?: number /* 4 */ });
//   connect(sessionId: string, name: string): Result<{ sessionId: string; name: string }>;
//   /** Removes the player from any lobby (promoting a new host = longest-present player; empty lobby closes). */
//   disconnect(sessionId: string): void;
//   createLobby(sessionId: string): Result<LobbyView>;   // creator becomes host and is placed in it
//   joinLobby(sessionId: string, lobbyId: string): Result<LobbyView>;
//   leaveLobby(sessionId: string): Result<null>;
//   setReady(sessionId: string, ready: boolean): Result<LobbyView>;
//   renameLobby(sessionId: string, name: string): Result<LobbyView>; // host only; 1..24 chars else NAME_INVALID
//   /** Host only. Needs >= 2 players, all ready. state -> 'starting'. */
//   start(sessionId: string): Result<LobbyView>;
//   /** Host only, exactly 1 player in the lobby: single-player time trial. state -> 'starting'. */
//   startSolo(sessionId: string): Result<LobbyView>;
//   /** Server-driven transition (countdown -> in_race, race end -> open). 'open' clears every ready flag. False if the lobby is unknown. */
//   setState(lobbyId: string, state: LobbyState): boolean;
//   list(): LobbyView[]; // creation order; returns copies, never live internal state
//   lobbyOf(sessionId: string): LobbyView | undefined;
// }
