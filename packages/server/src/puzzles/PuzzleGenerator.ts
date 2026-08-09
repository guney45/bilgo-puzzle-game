// Kaynak: docs/03-ARCHITECTURE.md §5.1. Yeni bir puzzle tipi eklemek = 3 dosyaya
// dokunmak: bu arayüzü uygulayan bir generator, registry.ts'e bir satır kayıt,
// client/src/puzzles/registry.tsx'e bir satır renderer kaydı.

import type { PuzzleType, ServerPuzzle, Rng } from 'shared';

export interface PuzzleGenerator {
  type: PuzzleType;
  generate(rng: Rng, difficulty: 1 | 2 | 3): ServerPuzzle;
}
