// Oda kodu üretimi, doğrulama ve normalizasyon.
// Kaynak: docs/02-GAME_DESIGN.md §6, docs/03-ARCHITECTURE.md §4.1

import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from './config';

export function generateRoomCode(length: number = ROOM_CODE_LENGTH): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

export function normalizeRoomCode(raw: string): string {
  return raw.trim().toUpperCase();
}

// Çakışma durumunda sunucu 6 haneye çıkabildiği için (bkz. GameRoom.onCreate),
// hem 5 hem 6 karakterlik kodlar geçerli kabul edilir.
export function isValidRoomCode(code: string): boolean {
  if (code.length !== ROOM_CODE_LENGTH && code.length !== ROOM_CODE_LENGTH + 1) {
    return false;
  }
  return [...code].every((ch) => ROOM_CODE_ALPHABET.includes(ch));
}
