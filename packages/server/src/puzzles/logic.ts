// LOGIC puzzle üreticisi. Kaynak: docs/02-GAME_DESIGN.md §3.2. İçerik prosedürel
// değil, JSON havuzdan (content/logic.tr.json, açılışta doğrulanır) rastgele
// seçilir. Maç içi tekrarsızlık MatchController'ın jenerik puzzle.id dedup
// mekanizmasından gelir (bkz. docs/03-ARCHITECTURE.md §5.3), burada özel bir
// şey yapmaya gerek yok.

import { PUZZLE_TIME_MS, type ServerPuzzle } from 'shared';
import type { PuzzleGenerator } from './PuzzleGenerator';
import { LOGIC_QUESTIONS_BY_DIFFICULTY } from './content/logicContent';

export const logicGenerator: PuzzleGenerator = {
  type: 'LOGIC',
  generate(rng, difficulty) {
    const pool = LOGIC_QUESTIONS_BY_DIFFICULTY[difficulty];
    const question = pool[Math.floor(rng() * pool.length)]!;

    const puzzle: ServerPuzzle = {
      id: `LOGIC:${question.id}`,
      type: 'LOGIC',
      difficulty,
      prompt: question.prompt,
      data: null,
      choices: question.choices,
      correctChoiceId: question.correctChoiceId,
      explanation: question.explanation,
      limitMs: PUZZLE_TIME_MS.LOGIC,
    };
    return puzzle;
  },
};
