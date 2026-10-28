import { describe, it, expect } from 'vitest';
import {
  COUNTDOWN_MS,
  REVEAL_DELAY_MS,
  LOCKED_MS,
  ROUND_RESULT_MS,
  ALL_ANSWERED_GRACE_MS,
  MEMORY_DISPLAY_MS,
  PUZZLE_TIME_MS,
  ROUNDS_PER_MATCH,
  difficultyForRound,
  timeMultiplierForDifficulty,
} from 'shared';
import { MatchController, type MatchPhaseInfo } from './MatchController';

const MATCH_SEED = 42;
// PUZZLE_TIME_MS[type], difficulty çarpanından ÖNCEKİ temel süredir — ama MEMORY
// kendi limitMs'ini gösterim+cevap toplamı olarak üretir (bkz. server/puzzles/memory.ts,
// docs/02-GAME_DESIGN.md §3.3), yani PUZZLE_TIME_MS.MEMORY tek başına yetmez.
// Bu harita "zorluk eğrisi" testinin beklenen süreyi PUZZLE_TIME_MS'ten bağımsızca
// yeniden hesaplayabilmesi için (bkz. docs/DECISIONS.md ADR-018).
const BASE_LIMIT_MS = { ...PUZZLE_TIME_MS, MEMORY: MEMORY_DISPLAY_MS + PUZZLE_TIME_MS.MEMORY };

function makeController(totalRounds = 2) {
  const events: MatchPhaseInfo[] = [];
  const controller = new MatchController({
    totalRounds,
    onPhaseChange: (info) => events.push({ ...info }),
  });
  return { controller, events };
}

describe('MatchController — faz geçişleri', () => {
  it('LOBBY dışında start() hiçbir şey yapmaz', () => {
    const { controller, events } = makeController();
    controller.start(0, MATCH_SEED);
    events.length = 0;
    controller.start(1000, MATCH_SEED);
    expect(events).toHaveLength(0);
    expect(controller.phase).toBe('COUNTDOWN');
  });

  it('start() LOBBY→COUNTDOWN geçişini yapar ve phaseEndsAt ayarlar', () => {
    const { controller, events } = makeController();
    controller.start(1000, MATCH_SEED);
    expect(controller.phase).toBe('COUNTDOWN');
    expect(controller.round).toBe(1);
    expect(controller.phaseEndsAt).toBe(1000 + COUNTDOWN_MS);
    expect(events).toEqual([{ phase: 'COUNTDOWN', round: 1, phaseEndsAt: 1000 + COUNTDOWN_MS }]);
  });

  it('süre dolmadan checkAdvance ilerletmez', () => {
    const { controller } = makeController();
    controller.start(0, MATCH_SEED);
    controller.checkAdvance(COUNTDOWN_MS - 1);
    expect(controller.phase).toBe('COUNTDOWN');
  });

  it('tüm tur içi fazları sırayla ilerletir: COUNTDOWN→REVEAL→PLAYING→LOCKED→ROUND_RESULT', () => {
    const { controller } = makeController();
    let now = 0;
    controller.start(now, MATCH_SEED);
    expect(controller.phase).toBe('COUNTDOWN');

    now = controller.phaseEndsAt!;
    controller.checkAdvance(now);
    expect(controller.phase).toBe('REVEAL');
    expect(controller.phaseEndsAt).toBe(now + REVEAL_DELAY_MS);

    now = controller.phaseEndsAt!;
    controller.checkAdvance(now);
    expect(controller.phase).toBe('PLAYING');
    // O turda fiilen seçilen tipin limitMs'i (birden fazla tip kayıtlı, bkz. ADR-017/018).
    const playingMs = controller.getClientPuzzle('p1')!.limitMs;
    expect(controller.phaseEndsAt).toBe(now + playingMs);

    now = controller.phaseEndsAt!;
    controller.checkAdvance(now);
    expect(controller.phase).toBe('LOCKED');
    expect(controller.phaseEndsAt).toBe(now + LOCKED_MS);

    now = controller.phaseEndsAt!;
    controller.checkAdvance(now);
    expect(controller.phase).toBe('ROUND_RESULT');
    expect(controller.phaseEndsAt).toBe(now + ROUND_RESULT_MS);
    expect(controller.round).toBe(1);
  });

  it('son turdan önce ROUND_RESULT bir sonraki turun REVEAL fazına döner', () => {
    const { controller } = makeController(2);
    let now = 0;
    controller.start(now, MATCH_SEED);
    for (let i = 0; i < 4; i++) {
      now = controller.phaseEndsAt!;
      controller.checkAdvance(now);
    }
    expect(controller.phase).toBe('ROUND_RESULT');
    expect(controller.round).toBe(1);

    now = controller.phaseEndsAt!;
    controller.checkAdvance(now);
    expect(controller.phase).toBe('REVEAL');
    expect(controller.round).toBe(2);
  });

  it('son turun ROUND_RESULT fazı GAME_RESULT ile biter ve süresizdir', () => {
    const { controller, events } = makeController(1);
    let now = 0;
    controller.start(now, MATCH_SEED);
    for (let i = 0; i < 4; i++) {
      now = controller.phaseEndsAt!;
      controller.checkAdvance(now);
    }
    expect(controller.phase).toBe('ROUND_RESULT');

    now = controller.phaseEndsAt!;
    controller.checkAdvance(now);
    expect(controller.phase).toBe('GAME_RESULT');
    expect(controller.phaseEndsAt).toBeNull();
    expect(events.at(-1)).toEqual({ phase: 'GAME_RESULT', round: 1, phaseEndsAt: null });
  });

  it('GAME_RESULT fazında checkAdvance hiçbir şey yapmaz (süresiz faz)', () => {
    const { controller, events } = makeController(1);
    let now = 0;
    controller.start(now, MATCH_SEED);
    for (let i = 0; i < 5; i++) {
      now = controller.phaseEndsAt ?? now;
      controller.checkAdvance(now);
    }
    expect(controller.phase).toBe('GAME_RESULT');

    events.length = 0;
    controller.checkAdvance(now + 999999);
    expect(events).toHaveLength(0);
    expect(controller.phase).toBe('GAME_RESULT');
  });
});

describe('MatchController — puzzle üretimi ve round:answer', () => {
  function toReveal(controller: MatchController, now: number): number {
    const revealAt = controller.phaseEndsAt!;
    controller.checkAdvance(revealAt);
    return revealAt;
  }

  function toPlaying(controller: MatchController): void {
    const playingStart = controller.phaseEndsAt!;
    controller.checkAdvance(playingStart);
  }

  it('REVEAL girişinde oyuncuya özel ClientPuzzle üretir, correctChoiceId içermez', () => {
    const { controller } = makeController(1);
    controller.addPlayer('p1');
    controller.addPlayer('p2');
    controller.start(0, MATCH_SEED);
    toReveal(controller, 0);

    const puzzleP1 = controller.getClientPuzzle('p1');
    const puzzleP2 = controller.getClientPuzzle('p2');

    expect(puzzleP1).not.toBeNull();
    expect(puzzleP1!.choices).toHaveLength(4);
    expect('correctChoiceId' in puzzleP1!).toBe(false);
    expect('explanation' in puzzleP1!).toBe(false);

    // Aynı puzzle id'si, farklı oyuncularda farklı şık sırası (kopya önleme).
    expect(puzzleP2!.id).toBe(puzzleP1!.id);
    const orderP1 = puzzleP1!.choices.map((c) => c.id);
    const orderP2 = puzzleP2!.choices.map((c) => c.id);
    expect(orderP1.sort()).toEqual(orderP2.sort());
  });

  it('PLAYING dışında submitAnswer E_WRONG_PHASE döner', () => {
    const { controller } = makeController(1);
    controller.addPlayer('p1');
    controller.start(0, MATCH_SEED);
    toReveal(controller, 0);
    const puzzle = controller.getClientPuzzle('p1')!;

    const result = controller.submitAnswer('p1', puzzle.id, puzzle.choices[0]!.id, 0, 0);
    expect(result).toEqual({ accepted: false, code: 'E_WRONG_PHASE' });
  });

  it('eski puzzleId ile cevap E_STALE_PUZZLE döner', () => {
    const { controller } = makeController(1);
    controller.addPlayer('p1');
    controller.start(0, MATCH_SEED);
    toReveal(controller, 0);
    toPlaying(controller);
    const puzzle = controller.getClientPuzzle('p1')!;

    const result = controller.submitAnswer('p1', 'baska-bir-id', puzzle.choices[0]!.id, 0, controller.phaseEndsAt!);
    expect(result).toEqual({ accepted: false, code: 'E_STALE_PUZZLE' });
  });

  it('geçersiz choiceId ile cevap E_INVALID_PAYLOAD döner', () => {
    const { controller } = makeController(1);
    controller.addPlayer('p1');
    controller.start(0, MATCH_SEED);
    toReveal(controller, 0);
    toPlaying(controller);
    const puzzle = controller.getClientPuzzle('p1')!;

    const result = controller.submitAnswer('p1', puzzle.id, 'olmayan-sik', 0, 0);
    expect(result).toEqual({ accepted: false, code: 'E_INVALID_PAYLOAD' });
  });

  it('answerMs limitMs dışındaysa (veya negatifse) E_TIMING döner', () => {
    const { controller } = makeController(1);
    controller.addPlayer('p1');
    controller.start(0, MATCH_SEED);
    toReveal(controller, 0);
    toPlaying(controller);
    const puzzle = controller.getClientPuzzle('p1')!;
    const limitMs = puzzle.limitMs; // O turda fiilen seçilen tipin limitMs'i (bkz. ADR-017/018)

    const tooLate = controller.submitAnswer('p1', puzzle.id, puzzle.choices[0]!.id, limitMs + 1, 0);
    expect(tooLate).toEqual({ accepted: false, code: 'E_TIMING' });

    const negative = controller.submitAnswer('p1', puzzle.id, puzzle.choices[0]!.id, -1, 0);
    expect(negative).toEqual({ accepted: false, code: 'E_TIMING' });
  });

  it('geçerli cevap kabul edilir, ikinci cevap E_ALREADY_ANSWERED döner', () => {
    const { controller } = makeController(1);
    controller.addPlayer('p1');
    controller.start(0, MATCH_SEED);
    toReveal(controller, 0);
    toPlaying(controller);
    const puzzle = controller.getClientPuzzle('p1')!;

    const first = controller.submitAnswer('p1', puzzle.id, puzzle.choices[0]!.id, 0, 0);
    expect(first).toEqual({ accepted: true });

    const second = controller.submitAnswer('p1', puzzle.id, puzzle.choices[1]!.id, 0, 1);
    expect(second).toEqual({ accepted: false, code: 'E_ALREADY_ANSWERED' });
  });

  it('bağlı tüm oyuncular cevaplayınca ALL_ANSWERED_GRACE_MS sonra kilitlenecek şekilde phaseEndsAt kısalır', () => {
    const { controller } = makeController(1);
    controller.addPlayer('p1');
    controller.addPlayer('p2');
    controller.start(0, MATCH_SEED);
    toReveal(controller, 0);
    toPlaying(controller);
    const originalEndsAt = controller.phaseEndsAt!;
    const puzzle = controller.getClientPuzzle('p1')!;

    const now = 1234;
    controller.submitAnswer('p1', puzzle.id, puzzle.choices[0]!.id, 0, now);
    expect(controller.phaseEndsAt).toBe(originalEndsAt); // yalnızca 1/2 oyuncu cevapladı

    controller.submitAnswer('p2', puzzle.id, puzzle.choices[1]!.id, 0, now);
    expect(controller.phaseEndsAt).toBe(now + ALL_ANSWERED_GRACE_MS);
    expect(controller.phaseEndsAt!).toBeLessThan(originalEndsAt);
    expect(controller.phase).toBe('PLAYING'); // faz henüz değişmedi, sadece süre kısaldı
  });

  it('N turluk bir maçta üretilen tüm puzzle.id\'ler benzersizdir (tekrar engeli)', () => {
    const totalRounds = 15;
    const { controller } = makeController(totalRounds);
    controller.addPlayer('p1');
    controller.start(0, MATCH_SEED);

    const seenIds = new Set<string>();
    let now = 0;
    for (let round = 1; round <= totalRounds; round++) {
      now = controller.phaseEndsAt!; // COUNTDOWN veya ROUND_RESULT sonu → REVEAL
      controller.checkAdvance(now);
      expect(controller.phase).toBe('REVEAL');

      const puzzle = controller.getClientPuzzle('p1')!;
      expect(seenIds.has(puzzle.id)).toBe(false);
      seenIds.add(puzzle.id);

      // REVEAL→PLAYING→LOCKED→ROUND_RESULT ilerlet (bir sonraki REVEAL'a hazırlan)
      now = controller.phaseEndsAt!;
      controller.checkAdvance(now);
      now = controller.phaseEndsAt!;
      controller.checkAdvance(now);
      now = controller.phaseEndsAt!;
      controller.checkAdvance(now);
    }

    expect(seenIds.size).toBe(totalRounds);
  });
});

describe('MatchController — getRoundRevealAt / getRoundResultData', () => {
  it('REVEAL öncesi (LOBBY/COUNTDOWN) ikisi de null döner', () => {
    const { controller } = makeController(1);
    controller.addPlayer('p1');
    expect(controller.getRoundRevealAt()).toBeNull();
    expect(controller.getRoundResultData()).toBeNull();

    controller.start(0, MATCH_SEED);
    expect(controller.getRoundRevealAt()).toBeNull();
    expect(controller.getRoundResultData()).toBeNull();
  });

  it('REVEAL girişinde revealAt = REVEAL fazının phaseEndsAt\'ıdır ve LOCKED/ROUND_RESULT boyunca aynı kalır', () => {
    const { controller } = makeController(1);
    controller.addPlayer('p1');
    controller.start(0, MATCH_SEED);

    const countdownEnd = controller.phaseEndsAt!; // COUNTDOWN sonu = REVEAL girişi anı
    controller.checkAdvance(countdownEnd);
    expect(controller.phase).toBe('REVEAL');
    // revealAt = REVEAL fazının kendi phaseEndsAt'ı (= REVEAL'ın bittiği, PLAYING'in
    // başladığı an), yani countdownEnd + REVEAL_DELAY_MS — countdownEnd'in kendisi değil.
    const revealAt = controller.phaseEndsAt!;
    expect(controller.getRoundRevealAt()).toBe(revealAt);

    controller.checkAdvance(controller.phaseEndsAt!); // → PLAYING
    controller.checkAdvance(controller.phaseEndsAt!); // → LOCKED
    expect(controller.getRoundRevealAt()).toBe(revealAt);

    controller.checkAdvance(controller.phaseEndsAt!); // → ROUND_RESULT
    expect(controller.phase).toBe('ROUND_RESULT');
    expect(controller.getRoundRevealAt()).toBe(revealAt);
  });

  it('getRoundResultData kabul edilen cevapları varış sırasıyla içerir, correctChoiceId açığa çıkar', () => {
    const { controller } = makeController(1);
    controller.addPlayer('p1');
    controller.addPlayer('p2');
    controller.start(0, MATCH_SEED);
    controller.checkAdvance(controller.phaseEndsAt!); // → REVEAL
    controller.checkAdvance(controller.phaseEndsAt!); // → PLAYING
    const puzzle = controller.getClientPuzzle('p1')!;

    controller.submitAnswer('p2', puzzle.id, puzzle.choices[0]!.id, 100, 0);
    controller.submitAnswer('p1', puzzle.id, puzzle.choices[1]!.id, 200, 1);

    const data = controller.getRoundResultData()!;
    expect(data.puzzleId).toBe(puzzle.id);
    expect(typeof data.correctChoiceId).toBe('string');
    expect(data.limitMs).toBe(puzzle.limitMs); // O turda fiilen seçilen tipin limitMs'i (bkz. ADR-017/018)
    // Map iterasyon sırası varış sırasıdır: p2 önce cevapladı.
    expect(Array.from(data.answers.keys())).toEqual(['p2', 'p1']);
    expect(data.answers.get('p2')).toEqual({ choiceId: puzzle.choices[0]!.id, answerMs: 100 });
  });
});

describe('MatchController — zorluk eğrisi (bkz. docs/02-GAME_DESIGN.md §2)', () => {
  it('ROUNDS_PER_MATCH turluk bir maçta her turun PLAYING süresi difficultyForRound()/timeMultiplierForDifficulty() ile ölçeklenir', () => {
    const { controller } = makeController(ROUNDS_PER_MATCH);
    controller.addPlayer('p1');
    let now = 0;
    controller.start(now, 7);

    for (let round = 1; round <= ROUNDS_PER_MATCH; round++) {
      now = controller.phaseEndsAt!; // COUNTDOWN veya ROUND_RESULT sonu → REVEAL
      controller.checkAdvance(now);
      expect(controller.phase).toBe('REVEAL');
      const revealAt = controller.phaseEndsAt!;

      now = revealAt;
      controller.checkAdvance(now); // REVEAL → PLAYING
      expect(controller.phase).toBe('PLAYING');

      const expectedDifficulty = difficultyForRound(round, ROUNDS_PER_MATCH);
      // Birden fazla puzzle tipi kayıtlı olduğundan (bkz. puzzles/registry.ts)
      // turun temel süresi tipe göre değişir; o turda gerçekten seçilen tipi
      // controller'dan okuyup PUZZLE_TIME_MS'ten buna göre bakıyoruz.
      const actualType = controller.getClientPuzzle('p1')!.type;
      const expectedLimitMs = Math.round(BASE_LIMIT_MS[actualType] * timeMultiplierForDifficulty(expectedDifficulty));
      expect(controller.phaseEndsAt! - revealAt).toBe(expectedLimitMs);

      // PLAYING → LOCKED → ROUND_RESULT (bir sonraki REVEAL'a hazırlan)
      now = controller.phaseEndsAt!;
      controller.checkAdvance(now);
      now = controller.phaseEndsAt!;
      controller.checkAdvance(now);
    }
  });
});

describe('MatchController — rematch()', () => {
  it('yalnızca GAME_RESULT fazında LOBBY\'ye döner', () => {
    const { controller, events } = makeController(1);
    controller.addPlayer('p1');
    controller.start(0, MATCH_SEED);
    expect(controller.phase).toBe('COUNTDOWN');

    events.length = 0;
    controller.rematch();
    expect(controller.phase).toBe('COUNTDOWN'); // GAME_RESULT dışında hiçbir şey yapmaz
    expect(events).toHaveLength(0);

    // 1 turluk maçta GAME_RESULT'a 5 geçişte varılır: COUNTDOWN→REVEAL→PLAYING→
    // LOCKED→ROUND_RESULT→GAME_RESULT (bkz. yukarıdaki "son turun ROUND_RESULT
    // fazı GAME_RESULT ile biter" testi).
    for (let i = 0; i < 5; i++) {
      controller.checkAdvance(controller.phaseEndsAt!);
    }
    expect(controller.phase).toBe('GAME_RESULT');

    controller.rematch();
    expect(controller.phase).toBe('LOBBY');
    expect(controller.round).toBe(0);
    expect(controller.phaseEndsAt).toBeNull();
  });

  it('rematch sonrası yeni bir start() maçı sıfırdan başlatabilir (usedPuzzleIds/lastPuzzleType sıfırlanır)', () => {
    const { controller } = makeController(1);
    controller.addPlayer('p1');
    controller.start(0, MATCH_SEED);
    for (let i = 0; i < 5; i++) controller.checkAdvance(controller.phaseEndsAt!);
    expect(controller.phase).toBe('GAME_RESULT');

    controller.rematch();
    controller.start(1000, MATCH_SEED + 1);
    expect(controller.phase).toBe('COUNTDOWN');
    expect(controller.round).toBe(1);
  });
});
