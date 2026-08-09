// Puzzle sistemi tipleri. Kaynak: docs/03-ARCHITECTURE.md §5.1.
// Yeni bir puzzle tipi eklemek = 3 dosyaya dokunmak (bkz. §5); bu tipler değişmez.

export type PuzzleType =
  | 'PATTERN'
  | 'LOGIC'
  | 'MEMORY'
  | 'SPATIAL'
  | 'ODD_ONE_OUT'
  | 'REACTION'
  | 'WORD';

export interface PuzzleChoice {
  id: string;
  label: string;
}

// Tarayıcıya giden — doğru cevap YOK.
export interface ClientPuzzle {
  id: string;
  type: PuzzleType;
  prompt: string;
  data: unknown;
  choices: PuzzleChoice[]; // sıra oyuncuya göre karışık
  limitMs: number;
}

// Sunucuda tutulur, correctChoiceId/explanation ASLA client'a açık gitmez.
export interface ServerPuzzle {
  id: string;
  type: PuzzleType;
  difficulty: 1 | 2 | 3;
  prompt: string;
  data: unknown;
  choices: PuzzleChoice[];
  correctChoiceId: string;
  explanation?: string;
  limitMs: number;
}
