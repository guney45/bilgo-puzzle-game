import type { Request, Response } from 'express';
import { matchMaker, ServerError } from 'colyseus';
import {
  JoinByCodeRequestSchema,
  normalizeRoomCode,
  isValidRoomCode,
  type ErrorMessage,
} from 'shared';

function sendError(res: Response, status: number, code: ErrorMessage['code']): void {
  const body: ErrorMessage = { code, message: code };
  res.status(status).json(body);
}

// setPrivate() ile gizlenen odalar matchMaker.join()/joinOrCreate() ile
// bulunamıyor (findOneRoomAvailable private:false'u koşulsuz ekliyor —
// bkz. docs/DECISIONS.md ADR-008). Bu yüzden kod→oda eşlemesi burada,
// matchMaker.query() + matchMaker.joinById() ile elle yapılıyor.
export async function joinByCodeHandler(req: Request, res: Response): Promise<void> {
  const parsed = JoinByCodeRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 400, 'E_INVALID_PAYLOAD');
    return;
  }

  const roomCode = normalizeRoomCode(parsed.data.roomCode);
  if (!isValidRoomCode(roomCode)) {
    sendError(res, 404, 'E_ROOM_NOT_FOUND');
    return;
  }

  const rooms = await matchMaker.query({ name: 'game', roomCode });
  const room = rooms[0];
  if (!room) {
    sendError(res, 404, 'E_ROOM_NOT_FOUND');
    return;
  }
  if (room.locked) {
    sendError(res, 409, 'E_MATCH_STARTED');
    return;
  }
  if (room.clients >= room.maxClients) {
    sendError(res, 409, 'E_ROOM_FULL');
    return;
  }

  try {
    const seatReservation = await matchMaker.joinById(room.roomId, { nickname: parsed.data.nickname });
    res.status(200).json(seatReservation);
  } catch (err) {
    if (err instanceof ServerError) {
      // matchMaker.joinById burada ServerError fırlatırsa, kontrol ile bu çağrı
      // arasındaki yarış penceresinde oda kilitlenmiş demektir.
      sendError(res, 409, 'E_MATCH_STARTED');
      return;
    }
    // SeatReservationError (kapasite yarışı) @colyseus/core'un public API'sinden
    // export edilmiyor, instanceof yapılamıyor. Locked/not-found yukarıda
    // elendiği için buraya düşen pratikte kapasite yarışıdır.
    // TODO: @colyseus/core SeatReservationError'ı export ederse instanceof ile değiştir.
    console.error('[join-by-code] beklenmeyen hata', err);
    sendError(res, 409, 'E_ROOM_FULL');
  }
}
