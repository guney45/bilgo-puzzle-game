// MEMORY puzzle üreticisi. Kaynak: docs/02-GAME_DESIGN.md §3.3.
//
// 3x3 ızgarada birkaç hücre bir renk+ŞEKİL ile doldurulur (renk körü güvenliği
// zorunlu: her renge farklı bir şekil eşlik eder, sadece renkle ayırt edilen
// hücre yok). Soru, dolu hücrelerden biri için "X hücresinde ne vardı?" şeklinde
// sorulur; tuzak şıklar öncelikle IZGARADAKİ diğer hücrelerin şekil/rengidir
// (klasik "doğru şekli hatırladım, yanlış hücreye koydum" hatası).
//
// Gösterim süresi (MEMORY_DISPLAY_MS) + cevap süresi (PUZZLE_TIME_MS.MEMORY)
// toplamı limitMs olarak gönderilir; MatchController bunu difficulty çarpanıyla
// çarpar (bkz. server/rooms/MatchController.ts, dokunulmadı). Client tarafında
// gösterim/cevap ayrımı MemoryGrid.tsx'te yerel bir zaman damgasıyla yapılır
// (bkz. docs/DECISIONS.md ADR-018) — bu dosya o ayrımdan habersizdir, tek bir
// toplam süre üretir.

import { MEMORY_DISPLAY_MS, PUZZLE_TIME_MS, shuffle, type PuzzleChoice, type Rng, type ServerPuzzle } from 'shared';
import type { PuzzleGenerator } from './PuzzleGenerator';

export interface MemoryItem {
  shape: 'circle' | 'square' | 'triangle' | 'star' | 'diamond' | 'cross';
  colorName: string;
  hex: string;
  label: string;
}

export interface MemoryPuzzleData {
  cells: (MemoryItem | null)[]; // uzunluk 9, satır-major (0..8)
}

const PALETTE: readonly MemoryItem[] = [
  { shape: 'circle', colorName: 'Kırmızı', hex: '#f87171', label: 'Kırmızı Daire' },
  { shape: 'square', colorName: 'Mavi', hex: '#60a5fa', label: 'Mavi Kare' },
  { shape: 'triangle', colorName: 'Yeşil', hex: '#4ade80', label: 'Yeşil Üçgen' },
  { shape: 'star', colorName: 'Sarı', hex: '#facc15', label: 'Sarı Yıldız' },
  { shape: 'diamond', colorName: 'Mor', hex: '#c084fc', label: 'Mor Elmas' },
  { shape: 'cross', colorName: 'Turuncu', hex: '#fb923c', label: 'Turuncu Artı' },
];

const POSITION_NAMES = [
  'Sol üst',
  'Üst orta',
  'Sağ üst',
  'Sol orta',
  'Orta',
  'Sağ orta',
  'Sol alt',
  'Alt orta',
  'Sağ alt',
] as const;

const FILLED_COUNT_BY_DIFFICULTY: Record<1 | 2 | 3, number> = { 1: 3, 2: 4, 3: 5 };

export const memoryGenerator: PuzzleGenerator = {
  type: 'MEMORY',
  generate(rng: Rng, difficulty: 1 | 2 | 3): ServerPuzzle {
    const filledCount = FILLED_COUNT_BY_DIFFICULTY[difficulty];
    const positions = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8], rng).slice(0, filledCount);
    const items = shuffle(PALETTE, rng).slice(0, filledCount);

    const cells: (MemoryItem | null)[] = Array<MemoryItem | null>(9).fill(null);
    positions.forEach((pos, i) => {
      cells[pos] = items[i]!;
    });

    const queryPosition = positions[Math.floor(rng() * positions.length)]!;
    const correctItem = cells[queryPosition]!;

    const otherFilled = items.filter((item) => item !== correctItem);
    const unused = PALETTE.filter((item) => !items.includes(item));
    const distractorPool = shuffle([...otherFilled, ...unused], rng).slice(0, 3);

    const optionItems = shuffle([correctItem, ...distractorPool], rng);
    const choices: PuzzleChoice[] = optionItems.map((item, i) => ({ id: `c${i}`, label: item.label }));
    const correctChoiceId = choices[optionItems.indexOf(correctItem)]!.id;
    // (optionItems referans eşitliğiyle karşılaştırılıyor; PALETTE öğeleri tekil
    // sabit nesneler olduğu için ve correctItem her zaman bu diziden geldiği
    // için indexOf güvenli — label bazlı bir karşılaştırmaya gerek yok.)

    const data: MemoryPuzzleData = { cells };

    const puzzle: ServerPuzzle = {
      id: `MEMORY:${cells.map((c) => c?.shape ?? 'x').join('-')}:${queryPosition}`,
      type: 'MEMORY',
      difficulty,
      prompt: `${POSITION_NAMES[queryPosition]} hücrede ne vardı?`,
      data,
      choices,
      correctChoiceId,
      explanation: `Doğru cevap: ${correctItem.label} (${POSITION_NAMES[queryPosition].toLowerCase()} hücre).`,
      limitMs: MEMORY_DISPLAY_MS + PUZZLE_TIME_MS.MEMORY,
    };
    return puzzle;
  },
};
