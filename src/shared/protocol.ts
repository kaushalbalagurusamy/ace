// Typed wire contract, JSON over WebSocket at /ws. Shared by client and server; no logic here.
import type { ErrorCode, LobbyView } from '../server/lobby-types';
import type { TrajectoryPoint } from '../sim/types';
import type { CourseId } from './courses';

export type ClientMsg =
  /** token = the secret from the last `welcome`; required to take over an existing session (reload/reconnect). */
  | { t: 'hello'; sessionId: string; name: string; token?: string }
  | { t: 'createLobby' }
  | { t: 'joinLobby'; lobbyId: string }
  | { t: 'leaveLobby' }
  | { t: 'ready'; ready: boolean }
  | { t: 'start' }
  | { t: 'startSolo' }
  /** One-button swing (docs/slices/simple-swing/spec.md): how long Space was held (ms) and the ball position in the stance (fb: forward+/back-, io: away+/closer-,
   *  integers -2..2, default 0). The server derives length (holdMs/750, 0.05..1) and max effort (holdMs >= 1100) itself. Aim = degrees clockwise from +z. */
  | { t: 'shot'; clubKey: string; aimDeg: number; holdMs: number; fb?: number; io?: number; chip?: boolean }
  /** Putter: hold and release Space; same length curve, no max effort. */
  | { t: 'putt'; aimDeg: number; holdMs: number }
  /** About 10 Hz during a race (PRD/07): where my golfer stands (yaw = facing, radians clockwise from +z) and my cart's state.
   *  While driving, the golfer is in the cart. The server clamps speeds, rejects teleports (answering `snap`) and resolves bumps. */
  | { t: 'move'; x: number; z: number; yaw: number; driving: boolean; cart: CartState };

/** A cart's position (m), heading (radians clockwise from +z) and velocity (m/s), in the hole's sim frame. */
export interface CartState { x: number; z: number; yaw: number; vx: number; vz: number }
export interface Mover { id: string; hole: number; x: number; z: number; yaw: number; driving: boolean; cart: CartState }

export interface BallState { x: number; z: number; strokes: number; holedOut: boolean; surface: string }
export interface HoleInfo { course: CourseId; index: number; par: number; pin: { x: number; z: number }; tee: { x: number; z: number }; greenRadius: number; fairwayHalfWidth: number; lengthM: number }
export interface PlayerRace { id: string; name: string; hole: number; ball: BallState; finishedAtS?: number }

export type ServerMsg =
  | { t: 'welcome'; sessionId: string; name: string; /** secret, sent only to this socket, never broadcast */ token: string }
  | { t: 'error'; code: ErrorCode | 'BAD_MESSAGE' | 'NOT_YOUR_TURN' | 'NOT_IN_RACE'; message: string }
  | { t: 'lobbies'; lobbies: LobbyView[] }
  | { t: 'lobby'; lobby: LobbyView | null }
  | { t: 'countdown'; seconds: number }
  | { t: 'raceStart'; hole: HoleInfo; players: PlayerRace[]; goAtMs: number }
  | { t: 'shotResult'; playerId: string; hole: number; samples: TrajectoryPoint[]; carryM: number; totalM: number; offlineM: number; clubSpeedMph: number; ballSpeedMs: number; effort: { fb: number; io: number; maxEffort: boolean; length: number; chip?: boolean }; ball: BallState; penalty?: string }
  | { t: 'holedOut'; playerId: string; hole: number; strokes: number; splitS: number; /** true after hole 18 */ finished: boolean }
  /** Sent to the whole lobby 2 s after a hole-out: that player is now on the tee of `hole`. Strokes in `ball` are cumulative. */
  | { t: 'nextHole'; playerId: string; hole: HoleInfo; ball: BallState }
  /** About 10 Hz to the lobby: every racer's golfer and cart. */
  | { t: 'movers'; players: Mover[] }
  /** To one player: a bump to apply now (add dx, dz to the position; dvx, dvz to the cart's velocity). strength 0..1 for the sound and shake. */
  | { t: 'bump'; target: 'cart' | 'golfer'; dx: number; dz: number; dvx: number; dvz: number; strength: number }
  /** To one player whose `move` was refused (a teleport or entering from too far): the server's last accepted state. */
  | { t: 'snap'; x: number; z: number; driving: boolean; cart: CartState }
  | { t: 'raceEnd';results: { id: string; name: string; place: number; timeS?: number; strokes: number; holes: number }[] };
