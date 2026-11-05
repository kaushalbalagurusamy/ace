// Typed wire contract, JSON over WebSocket at /ws. Shared by client and server; no logic here.
import type { ErrorCode, LobbyView } from '../server/lobby-types';
import type { TrajectoryPoint } from '../sim/types';

export type ClientMsg =
  /** token = the secret from the last `welcome`; required to take over an existing session (reload/reconnect). */
  | { t: 'hello'; sessionId: string; name: string; token?: string }
  | { t: 'createLobby' }
  | { t: 'joinLobby'; lobbyId: string }
  | { t: 'leaveLobby' }
  | { t: 'ready'; ready: boolean }
  | { t: 'start' }
  | { t: 'startSolo' }
  /** Raw timings, ms relative to the top of the backswing. Server re-scores. Aim = degrees clockwise from +z (hole direction). */
  | { t: 'shot'; clubKey: string; aimDeg: number; /** backswing length step 25|50|75|100, default 100; the server rejects anything else */ length?: number; zMs?: number; xMs?: number; cMs?: number }
  /** Putter: drawMs = how long Z was held (0..1500). */
  | { t: 'putt'; aimDeg: number; drawMs: number };

export interface BallState { x: number; z: number; strokes: number; holedOut: boolean; surface: string }
export interface HoleInfo { index: number; par: number; pin: { x: number; z: number }; tee: { x: number; z: number }; greenRadius: number; fairwayHalfWidth: number; lengthM: number }
export interface PlayerRace { id: string; name: string; hole: number; ball: BallState; finishedAtS?: number }

export type ServerMsg =
  | { t: 'welcome'; sessionId: string; name: string; /** secret, sent only to this socket, never broadcast */ token: string }
  | { t: 'error'; code: ErrorCode | 'BAD_MESSAGE' | 'NOT_YOUR_TURN' | 'NOT_IN_RACE'; message: string }
  | { t: 'lobbies'; lobbies: LobbyView[] }
  | { t: 'lobby'; lobby: LobbyView | null }
  | { t: 'countdown'; seconds: number }
  | { t: 'raceStart'; hole: HoleInfo; players: PlayerRace[]; goAtMs: number }
  | { t: 'shotResult'; playerId: string; samples: TrajectoryPoint[]; carryM: number; totalM: number; offlineM: number; clubSpeedMph: number; ballSpeedMs: number; grade: { z: number; x: number; c: number }; ball: BallState; penalty?: string }
  | { t: 'holedOut'; playerId: string; strokes: number; splitS: number }
  | { t: 'raceEnd'; results: { id: string; name: string; place: number; timeS?: number; strokes: number; holes: number }[] };
