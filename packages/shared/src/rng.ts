// Tohumlu rastgelelik. Kaynak: docs/03-ARCHITECTURE.md §5.3 (aynı matchSeed → aynı sorular).

export type Rng = () => number;

// Standart mulberry32 PRNG: hızlı, iyi dağılımlı, tek 32-bit tam sayı tohumdan
// deterministik [0,1) akışı üretir.
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function rng(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fisher-Yates, kopya döner (girdi dizisini değiştirmez).
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = result[i]!;
    result[i] = result[j]!;
    result[j] = temp;
  }
  return result;
}

// Bir temel tohumdan (matchSeed, roundSeed...) bir "salt" (roundIndex, playerId...)
// ile yeni bir 32-bit tohum türetir (FNV-1a benzeri karıştırma). roundSeed =
// deriveSeed(matchSeed, roundIndex); oyuncuya özel şık karışımı = deriveSeed(roundSeed, playerId).
export function deriveSeed(seed: number, salt: string | number): number {
  const str = `${seed}:${salt}`;
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
