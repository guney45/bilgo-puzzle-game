import { describe, expect, it } from 'vitest';
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  ROUNDS_PER_MATCH,
  PUZZLE_TIME_MS,
  difficultyForRound,
  timeMultiplierForDifficulty,
} from './config';

describe('config', () => {
  it('oda kodu alfabesi karışıklık yaratan harfleri (I, O, 0, 1) içermez', () => {
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[IO01]/);
  });

  it('oda kodu uzunluğu 5 karakterdir', () => {
    expect(ROOM_CODE_LENGTH).toBe(5);
  });

  it('MVP maçı 5 turdan oluşur', () => {
    expect(ROUNDS_PER_MATCH).toBe(5);
  });

  it('her puzzle tipi için bir süre sınırı tanımlıdır', () => {
    for (const type of Object.keys(PUZZLE_TIME_MS)) {
      expect(PUZZLE_TIME_MS[type as keyof typeof PUZZLE_TIME_MS]).toBeGreaterThan(0);
    }
  });

  it('difficultyForRound 5 turluk maçta GDD §2 tablosuyla birebir tutar', () => {
    expect(difficultyForRound(1, 5)).toBe(1);
    expect(difficultyForRound(2, 5)).toBe(1);
    expect(difficultyForRound(3, 5)).toBe(2);
    expect(difficultyForRound(4, 5)).toBe(2);
    expect(difficultyForRound(5, 5)).toBe(3);
  });

  it('difficultyForRound tek turluk maçta ilk turu her zaman zorluk 1 üretir', () => {
    expect(difficultyForRound(1, 1)).toBe(1);
  });

  it('difficultyForRound her totalRounds için monoton artar (azalmaz)', () => {
    for (const totalRounds of [1, 2, 3, 5, 7, 10, 15]) {
      let prev = 0;
      for (let round = 1; round <= totalRounds; round++) {
        const difficulty = difficultyForRound(round, totalRounds);
        expect(difficulty).toBeGreaterThanOrEqual(prev);
        expect(difficulty).toBeGreaterThanOrEqual(1);
        expect(difficulty).toBeLessThanOrEqual(3);
        prev = difficulty;
      }
    }
  });

  it('timeMultiplierForDifficulty GDD §2 "süre çarpanı" sütununu döner', () => {
    expect(timeMultiplierForDifficulty(1)).toBe(1.0);
    expect(timeMultiplierForDifficulty(2)).toBe(1.1);
    expect(timeMultiplierForDifficulty(3)).toBe(1.25);
  });
});
