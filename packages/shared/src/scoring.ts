// Puanlama. Kaynak: docs/02-GAME_DESIGN.md §5. SAF fonksiyonlar, yan etkisiz.

import type { ScoreBonus } from './messages';

export type ScoreModifier = { kind: 'NONE' };

export const BASE_POINTS = 500;
export const SPEED_POINTS = 500;
export const GRACE_MS = 500;

export const FIRST_CORRECT_BONUS = 100;
export const STREAK_3_BONUS = 150;
export const STREAK_5_BONUS = 300;
export const FINAL_ROUND_MULTIPLIER = 2;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export interface ScoreAnswerInput {
  correct: boolean;
  answerMs: number;
  limitMs: number;
  roundMultiplier: number;
  modifier?: ScoreModifier;
}

export function scoreAnswer({
  correct,
  answerMs,
  limitMs,
  roundMultiplier,
  modifier = { kind: 'NONE' },
}: ScoreAnswerInput): number {
  if (!correct) return 0;
  const t = clamp((answerMs - GRACE_MS) / (limitMs - GRACE_MS), 0, 1);
  const speed = Math.round(SPEED_POINTS * (1 - t));
  switch (modifier.kind) {
    case 'NONE':
    default:
      return Math.round((BASE_POINTS + speed) * roundMultiplier);
  }
}

export interface StreakBonusResult {
  bonus: Extract<ScoreBonus, 'STREAK_3' | 'STREAK_5'>;
  points: number;
}

// Kilometre taşı ödülü: streak tam 3'e/5'e ulaştığı turda bir kez verilir; streak
// 4, 6, 7... olduğunda tekrar tetiklenmez (bkz. docs/02-GAME_DESIGN.md §5.2).
export function streakBonusFor(streak: number): StreakBonusResult | null {
  if (streak === 5) return { bonus: 'STREAK_5', points: STREAK_5_BONUS };
  if (streak === 3) return { bonus: 'STREAK_3', points: STREAK_3_BONUS };
  return null;
}

// Colyseus Schema @type('number') alanları null olamaz (bkz. server/src/rooms/state.ts
// PlayerSchema.fastestAnswerMs) — "hiç doğru cevap yok" bu sentinel ile temsil edilir;
// compareStandings'e geçirmeden önce null'a çevrilir.
export const NO_FASTEST_ANSWER_MS = -1;

export interface StandingInput {
  playerId: string;
  total: number;
  correctCount: number;
  totalAnswerMs: number;
  fastestAnswerMs: number | null; // null = hiç doğru cevap yok
  joinIndex: number;
}

// Beraberlik bozma sırası (bkz. docs/02-GAME_DESIGN.md §5.3): toplam puan →
// doğru cevap sayısı → toplam cevap süresi (küçük önde) → en hızlı tek cevap →
// odaya katılma sırası. Negatif dönüş: a, b'den önde.
export function compareStandings(a: StandingInput, b: StandingInput): number {
  if (a.total !== b.total) return b.total - a.total;
  if (a.correctCount !== b.correctCount) return b.correctCount - a.correctCount;
  if (a.totalAnswerMs !== b.totalAnswerMs) return a.totalAnswerMs - b.totalAnswerMs;
  const aFastest = a.fastestAnswerMs ?? Number.POSITIVE_INFINITY;
  const bFastest = b.fastestAnswerMs ?? Number.POSITIVE_INFINITY;
  if (aFastest !== bFastest) return aFastest - bFastest;
  return a.joinIndex - b.joinIndex;
}

export interface Standing {
  playerId: string;
  rank: number;
  total: number;
}

export function rankStandings(inputs: readonly StandingInput[]): Standing[] {
  return inputs
    .slice()
    .sort(compareStandings)
    .map((input, index) => ({ playerId: input.playerId, rank: index + 1, total: input.total }));
}
