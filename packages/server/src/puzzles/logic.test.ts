import { describe, it, expect } from 'vitest';
import { mulberry32 } from 'shared';
import { logicGenerator } from './logic';

describe('logic generator', () => {
  it('1000 üretimde her zaman havuzdan geçerli, tek doğru cevaplı bir soru döner', () => {
    const rng = mulberry32(54321);

    for (let i = 0; i < 1000; i++) {
      const difficulty = ((i % 3) + 1) as 1 | 2 | 3;
      const puzzle = logicGenerator.generate(rng, difficulty);

      expect(puzzle.type).toBe('LOGIC');
      expect(puzzle.difficulty).toBe(difficulty);
      expect(puzzle.limitMs).toBe(20000);
      expect(puzzle.id.startsWith('LOGIC:')).toBe(true);

      expect(puzzle.choices).toHaveLength(4);

      const ids = puzzle.choices.map((c) => c.id);
      expect(new Set(ids).size).toBe(4);

      const labels = puzzle.choices.map((c) => c.label);
      expect(new Set(labels).size).toBe(4);

      const correctChoices = puzzle.choices.filter((c) => c.id === puzzle.correctChoiceId);
      expect(correctChoices).toHaveLength(1);

      expect(typeof puzzle.explanation).toBe('string');
      expect(puzzle.explanation!.length).toBeGreaterThan(0);
    }
  });
});
