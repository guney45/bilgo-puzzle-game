// Tüm oyun sabitleri burada. UI, oda veya puzzle kodunda çıplak sayı olmaz.
// Kaynak: docs/02-GAME_DESIGN.md §6

export const COUNTDOWN_MS = 3000;
export const REVEAL_DELAY_MS = 600;
export const ALL_ANSWERED_GRACE_MS = 600;
export const ROUND_RESULT_MS = 4000;
export const LOCKED_MS = 600;
export const ROUNDS_PER_MATCH = 5;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const NICKNAME_MAX = 14;
export const ROOM_CODE_LENGTH = 5;
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const RECONNECT_WINDOW_S = 45;
export const EMPTY_ROOM_DISPOSE_S = 120;

export const PUZZLE_TIME_MS = {
  PATTERN: 15000,
  LOGIC: 20000,
  MEMORY: 10000,
  SPATIAL: 20000,
  ODD_ONE_OUT: 12000,
  REACTION: 10000,
  WORD: 20000,
} as const;
