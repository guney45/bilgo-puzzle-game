import { describe, expect, it } from 'vitest';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, ROUNDS_PER_MATCH, PUZZLE_TIME_MS } from './config';

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
});
