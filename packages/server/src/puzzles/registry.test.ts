import { describe, it, expect } from 'vitest';
import { mulberry32, type PuzzleType } from 'shared';
import { pickPuzzleType, registeredPuzzleTypes, getPuzzleGenerator } from './registry';

describe('pickPuzzleType', () => {
  it('birden çok tip kayıtlıyken arka arkaya aynı tipi asla seçmez', () => {
    const rng = mulberry32(1);
    const available: PuzzleType[] = ['PATTERN', 'LOGIC', 'ODD_ONE_OUT'];
    let previous: PuzzleType | null = null;

    for (let i = 0; i < 500; i++) {
      const chosen = pickPuzzleType(rng, available, previous);
      if (previous !== null) expect(chosen).not.toBe(previous);
      previous = chosen;
    }
  });

  it('tek tip kayıtlıyken (bugünkü durum) her zaman o tipi döner', () => {
    const rng = mulberry32(2);
    const available: PuzzleType[] = ['PATTERN'];
    let previous: PuzzleType | null = null;

    for (let i = 0; i < 10; i++) {
      const chosen = pickPuzzleType(rng, available, previous);
      expect(chosen).toBe('PATTERN');
      previous = chosen;
    }
  });

  it('kayıtlı tip yoksa hata fırlatır', () => {
    const rng = mulberry32(3);
    expect(() => pickPuzzleType(rng, [], null)).toThrow();
  });
});

describe('registeredPuzzleTypes / getPuzzleGenerator', () => {
  it('bugün yalnızca PATTERN kayıtlıdır ve generator döner', () => {
    expect(registeredPuzzleTypes()).toEqual(['PATTERN']);
    expect(getPuzzleGenerator('PATTERN').type).toBe('PATTERN');
  });

  it('kayıtlı olmayan bir tip istenirse hata fırlatır', () => {
    expect(() => getPuzzleGenerator('LOGIC')).toThrow();
  });
});
