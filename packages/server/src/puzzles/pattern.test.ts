import { describe, it, expect } from 'vitest';
import { mulberry32 } from 'shared';
import { patternGenerator } from './pattern';

describe('pattern generator', () => {
  it('1000 üretimde her zaman tek geçerli doğru cevap ve benzersiz şıklar üretir', () => {
    const rng = mulberry32(12345);

    for (let i = 0; i < 1000; i++) {
      const difficulty = ((i % 3) + 1) as 1 | 2 | 3;
      const puzzle = patternGenerator.generate(rng, difficulty);

      expect(puzzle.type).toBe('PATTERN');
      expect(puzzle.difficulty).toBe(difficulty);
      expect(puzzle.limitMs).toBe(15000);

      expect(puzzle.choices).toHaveLength(4);

      const ids = puzzle.choices.map((c) => c.id);
      expect(new Set(ids).size).toBe(4);

      const labels = puzzle.choices.map((c) => c.label);
      expect(new Set(labels).size).toBe(4); // benzersiz değerler → tek geçerli cevap

      const correctChoices = puzzle.choices.filter((c) => c.id === puzzle.correctChoiceId);
      expect(correctChoices).toHaveLength(1);
    }
  });
});
