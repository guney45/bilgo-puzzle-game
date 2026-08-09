// Ortak tipler. Kaynak: docs/03-ARCHITECTURE.md §2, §6.

export type GamePhase =
  | 'LOBBY'
  | 'COUNTDOWN'
  | 'REVEAL'
  | 'PLAYING'
  | 'LOCKED'
  | 'ROUND_RESULT'
  | 'GAME_RESULT';
