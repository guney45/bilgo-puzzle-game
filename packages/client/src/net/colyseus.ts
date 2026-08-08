import { Client, Room, ServerError, MatchMakeError, type SeatReservation } from '@colyseus/sdk';
import type { ErrorCode, RoomWelcomeMessage } from 'shared';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:2567';

export const client = new Client(SERVER_URL);

export class AppError extends Error {
  constructor(public code: ErrorCode | 'E_UNKNOWN') {
    super(code);
  }
}

const KNOWN_ERROR_CODES: readonly string[] = [
  'E_ROOM_NOT_FOUND',
  'E_ROOM_FULL',
  'E_MATCH_STARTED',
  'E_NOT_HOST',
  'E_NOT_ENOUGH_PLAYERS',
  'E_WRONG_PHASE',
  'E_ALREADY_ANSWERED',
  'E_STALE_PUZZLE',
  'E_TIMING',
  'E_INVALID_NICKNAME',
  'E_RATE_LIMITED',
  'E_INVALID_PAYLOAD',
];

function toAppError(err: unknown): AppError {
  if (err instanceof ServerError || err instanceof MatchMakeError) {
    if (KNOWN_ERROR_CODES.includes(err.message)) {
      return new AppError(err.message as ErrorCode);
    }
  }
  return new AppError('E_UNKNOWN');
}

// roomCode/hostId/players zaten Colyseus state senkronuyla geliyor; room:welcome
// yalnızca youId (=room.sessionId ile aynı) ve config taşıyor — şimdilik sadece
// mesajı protokole uygun şekilde dinleyip logluyoruz ki @colyseus/sdk'nin
// "onMessage() not registered" uyarısı çıkmasın.
function attachWelcomeHandler(room: Room): Room {
  room.onMessage('room:welcome', (msg: RoomWelcomeMessage) => {
    console.log('[colyseus] room:welcome', msg);
  });
  return room;
}

export async function createRoom(nickname: string): Promise<Room> {
  try {
    return attachWelcomeHandler(await client.create('game', { nickname }));
  } catch (err) {
    throw toAppError(err);
  }
}

export async function joinRoomByCode(roomCode: string, nickname: string): Promise<Room> {
  const base = SERVER_URL.replace(/\/$/, '');
  const res = await fetch(`${base}/rooms/join-by-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomCode, nickname }),
  });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const code = KNOWN_ERROR_CODES.includes(body?.code) ? body.code : 'E_UNKNOWN';
    throw new AppError(code);
  }

  try {
    return attachWelcomeHandler(await client.consumeSeatReservation(body as SeatReservation));
  } catch (err) {
    throw toAppError(err);
  }
}
