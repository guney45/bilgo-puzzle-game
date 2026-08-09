import { describe, it, expect } from 'vitest';
import { scoreAnswer, streakBonusFor, compareStandings, rankStandings, type StandingInput } from './scoring';
import { PUZZLE_TIME_MS } from './config';

describe('scoreAnswer — GDD §5.1 örnek tablo', () => {
  const limitMs = PUZZLE_TIME_MS.PATTERN; // 15000, örnek "limit 15 sn, çarpan 1"

  const table: Array<[answerMs: number, expected: number]> = [
    [500, 1000],
    [2000, 948],
    [5000, 845],
    [10000, 672],
    // GDD §5.1 tablosunda "14.9 sn → 502" yazıyor; dokümanın kendi verdiği formülle
    // (t=(14400/14500), speed=round(500*(1-t))=3, total=round(500+3)) matematiksel
    // olarak 503 çıkıyor — bkz. docs/DECISIONS.md, formül olduğu gibi uygulandı.
    [14900, 503],
  ];

  for (const [answerMs, expected] of table) {
    it(`${answerMs}ms cevap → ${expected} puan`, () => {
      expect(scoreAnswer({ correct: true, answerMs, limitMs, roundMultiplier: 1 })).toBe(expected);
    });
  }

  it('yanlış cevap 0 puan', () => {
    expect(scoreAnswer({ correct: false, answerMs: 500, limitMs, roundMultiplier: 1 })).toBe(0);
  });

  it('tam limitMs\'te doğru cevap yalnızca BASE_POINTS getirir (hız bonusu sıfırlanır)', () => {
    expect(scoreAnswer({ correct: true, answerMs: limitMs, limitMs, roundMultiplier: 1 })).toBe(500);
  });

  it('final tur çarpanı puanı ikiye katlar', () => {
    expect(scoreAnswer({ correct: true, answerMs: 500, limitMs, roundMultiplier: 2 })).toBe(2000);
  });
});

describe('streakBonusFor', () => {
  it('3. ardışık doğruda STREAK_3 rozeti verir', () => {
    expect(streakBonusFor(3)).toEqual({ bonus: 'STREAK_3', points: 150 });
  });
  it('5. ardışık doğruda STREAK_5 rozeti verir', () => {
    expect(streakBonusFor(5)).toEqual({ bonus: 'STREAK_5', points: 300 });
  });
  it('4. ardışık doğruda rozet yok (3\'te bir kez tetiklenir)', () => {
    expect(streakBonusFor(4)).toBeNull();
  });
  it('6. ardışık doğruda rozet yok (5 sonrası tekrar tetiklenmez)', () => {
    expect(streakBonusFor(6)).toBeNull();
  });
  it('1-2 ardışıkta rozet yok', () => {
    expect(streakBonusFor(1)).toBeNull();
    expect(streakBonusFor(2)).toBeNull();
  });
});

describe('compareStandings / rankStandings — GDD §5.3 beraberlik bozma', () => {
  function player(overrides: Partial<StandingInput> & { playerId: string }): StandingInput {
    return { total: 0, correctCount: 0, totalAnswerMs: 0, fastestAnswerMs: null, joinIndex: 0, ...overrides };
  }

  it('yüksek toplam puan önde', () => {
    const a = player({ playerId: 'a', total: 1000 });
    const b = player({ playerId: 'b', total: 500 });
    expect(compareStandings(a, b)).toBeLessThan(0);
  });

  it('puan eşitse daha çok doğru cevap önde', () => {
    const a = player({ playerId: 'a', total: 500, correctCount: 3 });
    const b = player({ playerId: 'b', total: 500, correctCount: 2 });
    expect(compareStandings(a, b)).toBeLessThan(0);
  });

  it('puan ve doğru sayısı eşitse daha az toplam cevap süresi önde', () => {
    const a = player({ playerId: 'a', total: 500, correctCount: 2, totalAnswerMs: 3000 });
    const b = player({ playerId: 'b', total: 500, correctCount: 2, totalAnswerMs: 5000 });
    expect(compareStandings(a, b)).toBeLessThan(0);
  });

  it('önceki alanlar eşitse en hızlı tek cevap önde', () => {
    const a = player({ playerId: 'a', total: 500, correctCount: 2, totalAnswerMs: 3000, fastestAnswerMs: 400 });
    const b = player({ playerId: 'b', total: 500, correctCount: 2, totalAnswerMs: 3000, fastestAnswerMs: 800 });
    expect(compareStandings(a, b)).toBeLessThan(0);
  });

  it('hiç doğru cevabı olmayan oyuncu (fastestAnswerMs=null) en hızlıya karşı geride kalır', () => {
    const a = player({ playerId: 'a', total: 500, correctCount: 2, totalAnswerMs: 3000, fastestAnswerMs: 400 });
    const b = player({ playerId: 'b', total: 500, correctCount: 2, totalAnswerMs: 3000, fastestAnswerMs: null });
    expect(compareStandings(a, b)).toBeLessThan(0);
  });

  it('her şey eşitse odaya katılma sırası (küçük joinIndex önde)', () => {
    const a = player({ playerId: 'a', joinIndex: 0 });
    const b = player({ playerId: 'b', joinIndex: 1 });
    expect(compareStandings(a, b)).toBeLessThan(0);
  });

  it('rankStandings sıralı rank atar', () => {
    const inputs = [
      player({ playerId: 'a', total: 300 }),
      player({ playerId: 'b', total: 900 }),
      player({ playerId: 'c', total: 600 }),
    ];
    expect(rankStandings(inputs)).toEqual([
      { playerId: 'b', rank: 1, total: 900 },
      { playerId: 'c', rank: 2, total: 600 },
      { playerId: 'a', rank: 3, total: 300 },
    ]);
  });
});
