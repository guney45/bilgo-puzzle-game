// Tip → React renderer eşlemesi. Kaynak: docs/03-ARCHITECTURE.md §2, §5.
// Yeni bir puzzle tipi eklemek = 3 dosyaya dokunmak; bu dosyaya bir satır kayıt yeter.

import type { ComponentType } from 'react';
import type { ClientPuzzle, PuzzleType } from 'shared';
import MultipleChoice from './MultipleChoice';

export interface PuzzleRendererProps {
  puzzle: ClientPuzzle;
  selectedChoiceId: string | null;
  disabled: boolean;
  onAnswer: (choiceId: string) => void;
}

const REGISTRY: Partial<Record<PuzzleType, ComponentType<PuzzleRendererProps>>> = {
  PATTERN: MultipleChoice,
};

export function getPuzzleRenderer(type: PuzzleType): ComponentType<PuzzleRendererProps> {
  const renderer = REGISTRY[type];
  if (!renderer) throw new Error(`Kayıtlı puzzle renderer yok: ${type}`);
  return renderer;
}
