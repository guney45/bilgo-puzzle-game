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
export const NOTICE_DISPLAY_MS = 3000; // room:notice toast'ının lobide görünme süresi
// Server'ın varsayılan dinleme portu (server: process.env.PORT yoksa; client: VITE_SERVER_URL
// yoksa sayfanın yüklendiği host'a bu portla bağlanır — bkz. net/colyseus.ts).
export const DEFAULT_SERVER_PORT = 2567;
export const TIMING_TOLERANCE_MS = 80; // cevap süresi gecikme telafisi clamp toleransı (bkz. docs/03-ARCHITECTURE.md §7.3)

export const PUZZLE_TIME_MS = {
  PATTERN: 15000,
  LOGIC: 20000,
  MEMORY: 10000,
  SPATIAL: 20000,
  ODD_ONE_OUT: 12000,
  REACTION: 10000,
  WORD: 20000,
} as const;

// Zorluk eğrisi (bkz. docs/02-GAME_DESIGN.md §2). GDD'nin 5 turluk örnek tablosuyla
// (1,2→1 / 3,4→2 / 5→3) birebir tutan eşikler: t1/t2 turun toplam tur sayısına
// oranına göre yukarı yuvarlanır. GDD'deki 10 turluk tablo (1-3→1, 4-7→2, 8-10→3)
// tek bir sürekli formülle birebir tutmuyor (elle ayarlanmış görünüyor) — bu sabit
// `ROUNDS_PER_MATCH=5` için tam isabetli, 10 turluk moda geçilirse (bkz. ADR-013)
// gözden geçirilmeli.
export function difficultyForRound(round: number, totalRounds: number): 1 | 2 | 3 {
  const t1 = Math.ceil(totalRounds * 0.4);
  const t2 = Math.ceil(totalRounds * 0.8);
  if (round <= t1) return 1;
  if (round <= t2) return 2;
  return 3;
}

// Süre çarpanı (bkz. docs/02-GAME_DESIGN.md §2 "Süre çarpanı" sütunu).
export const DIFFICULTY_TIME_MULTIPLIER: Record<1 | 2 | 3, number> = {
  1: 1.0,
  2: 1.1,
  3: 1.25,
};

export function timeMultiplierForDifficulty(difficulty: 1 | 2 | 3): number {
  return DIFFICULTY_TIME_MULTIPLIER[difficulty];
}
