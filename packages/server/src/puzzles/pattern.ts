// PATTERN puzzle üreticisi. Kaynak: docs/02-GAME_DESIGN.md §3.1.
//
// Her kural ailesi 4 terim gösterir, 5.'yi sorar. Çeldiriciler: doğru cevabın
// ±%10–%40'ı ve "bir önceki kuralı uygulayan" klasik tuzak (linearContinuationTrap).
// Sabit kurallı ailelerde (arithmetic/geometric) bu tuzak doğru cevaba eşit
// çıkacağından kullanılmaz — yalnızca kural adım adım değişen ailelerde (zorluk 2/3)
// gerçek bir tuzak üretir.

import { PUZZLE_TIME_MS, type PuzzleChoice, type Rng, type ServerPuzzle } from 'shared';
import type { PuzzleGenerator } from './PuzzleGenerator';

function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function linearContinuationTrap(terms: readonly number[]): number {
  const last = terms[terms.length - 1]!;
  const prev = terms[terms.length - 2]!;
  return last + (last - prev);
}

function buildDistractors(rng: Rng, correct: number, prevRuleTrap: number | null): number[] {
  const used = new Set<number>([correct]);
  const distractors: number[] = [];

  if (prevRuleTrap !== null && !used.has(prevRuleTrap)) {
    distractors.push(prevRuleTrap);
    used.add(prevRuleTrap);
  }

  let guard = 0;
  while (distractors.length < 3 && guard < 200) {
    guard += 1;
    const pct = 0.1 + rng() * 0.3; // %10-%40
    const sign = rng() < 0.5 ? -1 : 1;
    const base = Math.max(1, Math.abs(correct));
    const candidate = correct + sign * Math.max(1, Math.round(base * pct));
    if (used.has(candidate)) continue;
    used.add(candidate);
    distractors.push(candidate);
  }

  // Aşırı uç durumda (guard tükenirse) benzersizliği artan adımla garanti et.
  let fallback = 1;
  while (distractors.length < 3) {
    const candidate = correct + fallback * (fallback % 2 === 0 ? -1 : 1);
    fallback += 1;
    if (used.has(candidate)) continue;
    used.add(candidate);
    distractors.push(candidate);
  }

  return distractors;
}

function buildServerPuzzle(
  rng: Rng,
  difficulty: 1 | 2 | 3,
  familyKey: string,
  terms: readonly number[],
  answer: number,
  prevRuleTrap: number | null,
  explanation: string,
): ServerPuzzle {
  const distractors = buildDistractors(rng, answer, prevRuleTrap);
  const values = [answer, ...distractors];
  const choices: PuzzleChoice[] = values.map((value, i) => ({ id: `c${i}`, label: String(value) }));

  return {
    id: `PATTERN:${familyKey}:${terms.join('-')}:${answer}`,
    type: 'PATTERN',
    difficulty,
    prompt: `Örüntüyü tamamla: ${terms.join(', ')}, ?`,
    data: { terms: [...terms] },
    choices,
    correctChoiceId: choices[0]!.id,
    explanation,
    limitMs: PUZZLE_TIME_MS.PATTERN,
  };
}

// --- Zorluk 1: sabit kurallı diziler ---------------------------------------

function familyArithmetic(rng: Rng): ServerPuzzle {
  const a = randInt(rng, 1, 30);
  const sign = rng() < 0.5 ? -1 : 1;
  const d = sign * randInt(rng, 1, 12);
  const terms = [0, 1, 2, 3].map((i) => a + i * d);
  const answer = a + 4 * d;
  return buildServerPuzzle(rng, 1, 'arithmetic', terms, answer, null, `Her terime ${d >= 0 ? '+' : ''}${d} eklenir.`);
}

function familyGeometric(rng: Rng): ServerPuzzle {
  const a = randInt(rng, 1, 5);
  const r = randInt(rng, 2, 4);
  const terms = [0, 1, 2, 3].map((i) => a * r ** i);
  const answer = a * r ** 4;
  return buildServerPuzzle(rng, 1, 'geometric', terms, answer, null, `Her terim bir öncekiyle çarpılır (×${r}).`);
}

// --- Zorluk 2: adım adım değişen kurallar -----------------------------------

function familyAlternating(rng: Rng): ServerPuzzle {
  const t0 = randInt(rng, 1, 10);
  const addStep = randInt(rng, 1, 9);
  const mulStep = randInt(rng, 2, 3);
  const ops: Array<'add' | 'mul'> = ['add', 'mul', 'add', 'mul'];

  const seq = [t0];
  let current = t0;
  for (const op of ops) {
    current = op === 'add' ? current + addStep : current * mulStep;
    seq.push(current);
  }

  const shown = seq.slice(0, 4);
  const answer = seq[4]!;
  return buildServerPuzzle(
    rng,
    2,
    'alternating',
    shown,
    answer,
    linearContinuationTrap(shown),
    `Terimler sırayla +${addStep} ve ×${mulStep} kuralıyla değişir.`,
  );
}

function familyPower(rng: Rng): ServerPuzzle {
  const power = rng() < 0.5 ? 2 : 3;
  const n0 = randInt(rng, 1, power === 2 ? 8 : 5);
  const terms = [0, 1, 2, 3].map((i) => (n0 + i) ** power);
  const answer = (n0 + 4) ** power;
  const label = power === 2 ? 'kare' : 'küp';
  return buildServerPuzzle(
    rng,
    2,
    `power${power}`,
    terms,
    answer,
    linearContinuationTrap(terms),
    `Terimler ardışık sayıların ${label}sidir.`,
  );
}

function familyFibonacci(rng: Rng): ServerPuzzle {
  const t0 = randInt(rng, 1, 8);
  const t1 = randInt(rng, 1, 8);
  const seq = [t0, t1];
  for (let i = 2; i < 5; i++) seq.push(seq[i - 1]! + seq[i - 2]!);

  const shown = seq.slice(0, 4);
  const answer = seq[4]!;
  return buildServerPuzzle(
    rng,
    2,
    'fibonacci',
    shown,
    answer,
    linearContinuationTrap(shown),
    'Her terim kendinden önceki iki terimin toplamıdır.',
  );
}

// --- Zorluk 3: bileşik kurallar ---------------------------------------------

function familyQuadratic(rng: Rng): ServerPuzzle {
  const a1 = randInt(rng, 1, 10);
  const d1 = randInt(rng, 1, 6);
  const sign = rng() < 0.5 ? -1 : 1;
  const d2 = sign * randInt(rng, 1, 5);

  const terms = [a1];
  let diff = d1;
  for (let i = 0; i < 4; i++) {
    terms.push(terms[i]! + diff);
    diff += d2;
  }

  const shown = terms.slice(0, 4);
  const answer = terms[4]!;
  return buildServerPuzzle(
    rng,
    3,
    'quadratic',
    shown,
    answer,
    linearContinuationTrap(shown),
    `Ardışık farklar sabit miktarda (${d2 >= 0 ? '+' : ''}${d2}) değişir.`,
  );
}

function familyInterleaved(rng: Rng): ServerPuzzle {
  const aA = randInt(rng, 1, 10);
  const dA = randInt(rng, 1, 6);
  const aB = randInt(rng, 1, 10);
  const dB = randInt(rng, 1, 6);

  const seqA = [0, 1, 2].map((i) => aA + i * dA); // p1, p3, p5
  const seqB = [0, 1].map((i) => aB + i * dB); // p2, p4

  const terms = [seqA[0]!, seqB[0]!, seqA[1]!, seqB[1]!];
  const answer = seqA[2]!;
  return buildServerPuzzle(
    rng,
    3,
    'interleaved',
    terms,
    answer,
    linearContinuationTrap(terms),
    'Tek ve çift sıradaki terimler ayrı iki örüntü izler.',
  );
}

const COMPOUND_FORMULAS: Array<{ key: string; label: string; fn: (n: number) => number }> = [
  { key: 'n2+n', label: 'n² + n', fn: (n) => n * n + n },
  { key: 'n2-n', label: 'n² - n', fn: (n) => n * n - n },
  { key: 'n2+2n', label: 'n² + 2n', fn: (n) => n * n + 2 * n },
];

function familyCompound(rng: Rng): ServerPuzzle {
  const formula = COMPOUND_FORMULAS[Math.floor(rng() * COMPOUND_FORMULAS.length)]!;
  const n0 = randInt(rng, 1, 6);
  const terms = [0, 1, 2, 3].map((i) => formula.fn(n0 + i));
  const answer = formula.fn(n0 + 4);
  return buildServerPuzzle(
    rng,
    3,
    `compound-${formula.key}`,
    terms,
    answer,
    linearContinuationTrap(terms),
    `Terimler ${formula.label} kuralıyla üretilir.`,
  );
}

const FAMILIES_BY_DIFFICULTY: Record<1 | 2 | 3, Array<(rng: Rng) => ServerPuzzle>> = {
  1: [familyArithmetic, familyGeometric],
  2: [familyAlternating, familyPower, familyFibonacci],
  3: [familyQuadratic, familyInterleaved, familyCompound],
};

export const patternGenerator: PuzzleGenerator = {
  type: 'PATTERN',
  generate(rng, difficulty) {
    const families = FAMILIES_BY_DIFFICULTY[difficulty];
    const family = families[Math.floor(rng() * families.length)]!;
    return family(rng);
  },
};
