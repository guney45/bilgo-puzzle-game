import { describe, it, expect } from 'vitest';
import { mulberry32, MEMORY_DISPLAY_MS, PUZZLE_TIME_MS } from 'shared';
import { memoryGenerator, type MemoryPuzzleData } from './memory';

describe('memory generator', () => {
  it('1000 üretimde her zaman 9 hücreli bir ızgara, benzersiz şıklar ve tek doğru cevap üretir', () => {
    const rng = mulberry32(24680);

    for (let i = 0; i < 1000; i++) {
      const difficulty = ((i % 3) + 1) as 1 | 2 | 3;
      const puzzle = memoryGenerator.generate(rng, difficulty);

      expect(puzzle.type).toBe('MEMORY');
      expect(puzzle.difficulty).toBe(difficulty);
      expect(puzzle.limitMs).toBe(MEMORY_DISPLAY_MS + PUZZLE_TIME_MS.MEMORY);
      expect(puzzle.id.startsWith('MEMORY:')).toBe(true);

      const data = puzzle.data as MemoryPuzzleData;
      expect(data.cells).toHaveLength(9);

      const filled = data.cells.filter((c) => c !== null);
      const expectedFilled = { 1: 3, 2: 4, 3: 5 }[difficulty];
      expect(filled).toHaveLength(expectedFilled);

      // renk körü güvenliği: dolu hücrelerin hepsi farklı bir ŞEKİL taşır (sadece
      // renkle ayırt edilen iki hücre yok)
      const shapes = filled.map((c) => c!.shape);
      expect(new Set(shapes).size).toBe(shapes.length);

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
