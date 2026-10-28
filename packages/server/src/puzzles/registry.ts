// Tip → generator eşlemesi. Kaynak: docs/03-ARCHITECTURE.md §5.

import type { PuzzleType, Rng } from 'shared';
import type { PuzzleGenerator } from './PuzzleGenerator';
import { patternGenerator } from './pattern';
import { logicGenerator } from './logic';
import { memoryGenerator } from './memory';

const REGISTRY: Partial<Record<PuzzleType, PuzzleGenerator>> = {
  PATTERN: patternGenerator,
  LOGIC: logicGenerator,
  MEMORY: memoryGenerator,
};

export function getPuzzleGenerator(type: PuzzleType): PuzzleGenerator {
  const generator = REGISTRY[type];
  if (!generator) throw new Error(`Kayıtlı puzzle üretici yok: ${type}`);
  return generator;
}

export function registeredPuzzleTypes(): PuzzleType[] {
  return Object.keys(REGISTRY) as PuzzleType[];
}

// Bir sonraki turun puzzle tipini seçer: aynı tip arka arkaya gelmez (bkz.
// docs/02-GAME_DESIGN.md §2). Tek tip kayıtlıyken bu kural anlamsızca ihlal
// edilmez — o tek tip döner. Yeni bir tip eklendiğinde (bkz. FAZ 10)
// burası değişmeden doğru çalışmaya devam eder.
export function pickPuzzleType(rng: Rng, available: readonly PuzzleType[], previous: PuzzleType | null): PuzzleType {
  if (available.length === 0) throw new Error('Kayıtlı puzzle tipi yok');
  const candidates = previous !== null && available.length > 1 ? available.filter((t) => t !== previous) : available;
  const pool = candidates.length > 0 ? candidates : available;
  return pool[Math.floor(rng() * pool.length)]!;
}
