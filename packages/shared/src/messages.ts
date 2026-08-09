// Client ve server arasındaki tek sözleşme. Kaynak: docs/04-NETWORK_PROTOCOL.md
// Protokol değişirse önce orada, sonra burada güncellenir.

import type { ClientPuzzle } from './puzzle';

export type ClientMessage =
  | { type: 'player:setNickname'; nickname: string }
  | { type: 'player:ready'; ready: boolean }
  | { type: 'match:start' }
  | { type: 'round:answer'; puzzleId: string; choiceId: string; clientAnsweredAtServerMs: number }
  | { type: 'match:rematch' }
  | { type: 'net:ping'; t0: number };

export type ErrorCode =
  | 'E_ROOM_NOT_FOUND' // kod yanlış veya oda kapandı
  | 'E_ROOM_FULL'
  | 'E_MATCH_STARTED' // maç başladı, katılım kapalı
  | 'E_NOT_HOST'
  | 'E_NOT_ENOUGH_PLAYERS'
  | 'E_WRONG_PHASE'
  | 'E_ALREADY_ANSWERED'
  | 'E_STALE_PUZZLE' // eski turun cevabı
  | 'E_TIMING' // süre dışı / imkânsız zaman
  | 'E_INVALID_NICKNAME'
  | 'E_RATE_LIMITED'
  | 'E_INVALID_PAYLOAD';

export type NoticeCode =
  | 'PLAYER_JOINED'
  | 'PLAYER_LEFT'
  | 'PLAYER_DISCONNECTED'
  | 'PLAYER_RECONNECTED'
  | 'HOST_CHANGED'
  | 'MATCH_ABORTED';

export interface PublicConfig {
  maxPlayers: number;
  nicknameMax: number;
}

export interface RoomWelcomeMessage {
  roomCode: string;
  youId: string;
  hostId: string;
  config: PublicConfig;
}

export interface ErrorMessage {
  code: ErrorCode;
  message: string;
}

export interface RoundPuzzleMessage {
  puzzle: ClientPuzzle;
  round: number;
  totalRounds: number;
  revealAt: number;
  endsAt: number;
}

export interface RoundAnswerAckMessage {
  puzzleId: string;
  accepted: boolean;
  code?: ErrorCode;
}

export interface RoomNoticeMessage {
  code: NoticeCode;
  playerId?: string;
  nickname?: string;
}

export interface NetPongMessage {
  t0: number;
  tServer: number;
}

export type ScoreBonus = 'FIRST_CORRECT' | 'STREAK_3' | 'STREAK_5' | 'FINAL_X2';

export interface RoundResult {
  round: number;
  puzzleId: string;
  correctChoiceId: string; // ARTIK güvenli: tur bitti
  explanation?: string;
  entries: Array<{
    playerId: string;
    choiceId: string | null; // null = cevaplamadı
    correct: boolean;
    answerMs: number | null;
    gained: number; // bu turda kazanılan puan
    total: number; // güncel toplam
    bonuses: ScoreBonus[];
  }>;
  standings: Array<{ playerId: string; rank: number; total: number }>;
}

export interface MatchResult {
  standings: Array<{ playerId: string; rank: number; total: number; correctCount: number }>;
  stats: {
    fastestCorrect?: { playerId: string; answerMs: number; round: number };
    mostCorrect?: { playerId: string; count: number };
    longestStreak?: { playerId: string; streak: number };
  };
  matchSeed: number; // hata bildirimi için
}
