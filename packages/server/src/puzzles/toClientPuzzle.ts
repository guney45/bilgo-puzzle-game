// Kaynak: docs/03-ARCHITECTURE.md §5.2. correctChoiceId/explanation çıkarılır,
// şıklar oyuncuya özel karıştırılır.
//
// Basitleştirme: mimari dokümanı permütasyonun ayrıca Map<playerId, string[]>
// olarak saklanmasını öneriyordu. Karışım roundSeed+playerId'den deterministik
// türetildiği için (aynı ikili → aynı sıra) bu ekstra state gereksiz; round:answer
// doğrulaması zaten pozisyona değil choiceId'ye bakıyor.

import { deriveSeed, mulberry32, shuffle, type ClientPuzzle, type ServerPuzzle } from 'shared';

export function toClientPuzzle(puzzle: ServerPuzzle, playerId: string, roundSeed: number): ClientPuzzle {
  const rng = mulberry32(deriveSeed(roundSeed, playerId));
  const choices = shuffle(puzzle.choices, rng);

  return {
    id: puzzle.id,
    type: puzzle.type,
    prompt: puzzle.prompt,
    data: puzzle.data,
    choices,
    limitMs: puzzle.limitMs,
  };
}
