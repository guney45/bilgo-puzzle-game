// Saf faz makinesi + tur/puzzle mantığı. Colyseus IMPORT ETMEZ — birim testi
// Colyseus'suz çalışır (bkz. docs/03-ARCHITECTURE.md §3, §5). GameRoom bu sınıfı
// sarmalayıp state'e/mesajlara yansıtır.
//
// docs/03-ARCHITECTURE.md §3'teki diyagram PuzzleRegistry/ScoreCalculator/RoundState'i
// MatchController'ın alt bileşenleri olarak gösteriyor — bu yüzden turun puzzle
// üretimi, oyuncu başına ClientPuzzle üretimi ve round:answer doğrulaması da burada.

import {
  ALL_ANSWERED_GRACE_MS,
  COUNTDOWN_MS,
  REVEAL_DELAY_MS,
  LOCKED_MS,
  ROUND_RESULT_MS,
  difficultyForRound,
  timeMultiplierForDifficulty,
  deriveSeed,
  mulberry32,
  type ClientPuzzle,
  type ErrorCode,
  type GamePhase,
  type PuzzleType,
  type ServerPuzzle,
} from 'shared';
import { getPuzzleGenerator, pickPuzzleType, registeredPuzzleTypes } from '../puzzles/registry';
import { toClientPuzzle } from '../puzzles/toClientPuzzle';

export interface MatchPhaseInfo {
  phase: GamePhase;
  round: number;
  phaseEndsAt: number | null; // null = süresiz (LOBBY, GAME_RESULT)
}

export interface MatchControllerOptions {
  totalRounds: number;
  onPhaseChange: (info: MatchPhaseInfo) => void;
}

export type AnswerOutcome = { accepted: true } | { accepted: false; code: ErrorCode };

interface RoundAnswer {
  choiceId: string;
  answerMs: number;
}

interface RoundState {
  puzzle: ServerPuzzle;
  roundSeed: number;
  revealAt: number;
  // Map iterasyon sırası varış sırasıdır — "ilk doğru cevap" bonusu bunu kullanır.
  answers: Map<string, RoundAnswer>;
}

export interface RoundResultData {
  puzzleId: string;
  correctChoiceId: string;
  explanation: string | undefined;
  limitMs: number;
  answers: ReadonlyMap<string, RoundAnswer>;
}

const MAX_PUZZLE_ID_RETRIES = 10;

export class MatchController {
  readonly totalRounds: number;
  private readonly onPhaseChange: (info: MatchPhaseInfo) => void;

  phase: GamePhase = 'LOBBY';
  round = 0;
  phaseEndsAt: number | null = null;

  private matchSeed = 0;
  private usedPuzzleIds = new Set<string>();
  private currentRound: RoundState | null = null;
  private activePlayerIds = new Set<string>();
  // Aynı tipin arka arkaya gelmemesi için (bkz. docs/02-GAME_DESIGN.md §2).
  private lastPuzzleType: PuzzleType | null = null;

  constructor(options: MatchControllerOptions) {
    this.totalRounds = options.totalRounds;
    this.onPhaseChange = options.onPhaseChange;
  }

  /** LOBBY→COUNTDOWN. Host/oyuncu sayısı/faz doğrulaması çağıran tarafın (GameRoom) işi.
   * matchSeed üretimi/loglanması da GameRoom'un işi (bkz. docs/03-ARCHITECTURE.md §5.3). */
  start(now: number, matchSeed: number): void {
    if (this.phase !== 'LOBBY') return;
    this.matchSeed = matchSeed;
    this.usedPuzzleIds = new Set();
    this.currentRound = null;
    this.lastPuzzleType = null;
    this.round = 1;
    this.enterPhase('COUNTDOWN', now + COUNTDOWN_MS);
  }

  /** GAME_RESULT→LOBBY. Skor/seri sıfırlama ve oda unlock'u GameRoom'un işi
   * (bkz. docs/05-ROADMAP.md FAZ 6). Yeni matchSeed bir sonraki start()'ta üretilir. */
  rematch(): void {
    if (this.phase !== 'GAME_RESULT') return;
    this.currentRound = null;
    this.round = 0;
    this.enterPhase('LOBBY', null);
  }

  /** Odaya katılan/ayrılan oyuncular — "herkes cevapladı" kontrolü için gerekli. */
  addPlayer(id: string): void {
    this.activePlayerIds.add(id);
  }

  removePlayer(id: string, now: number = Date.now()): void {
    this.activePlayerIds.delete(id);
    this.maybeScheduleEarlyLock(now);
  }

  /** Periyodik olarak çağrılır (bkz. GameRoom: this.clock.setInterval). Süresi
   * dolan fazı bir sonrakine ilerletir. Süresi olmayan fazlarda (LOBBY/GAME_RESULT)
   * hiçbir şey yapmaz. */
  checkAdvance(now: number): void {
    if (this.phaseEndsAt === null) return;
    if (now < this.phaseEndsAt) return;
    this.advance(now);
  }

  /** Bu turun ClientPuzzle'ını (doğru cevap YOK, oyuncuya özel karışık şıklar) döner. */
  getClientPuzzle(playerId: string): ClientPuzzle | null {
    if (!this.currentRound) return null;
    return toClientPuzzle(this.currentRound.puzzle, playerId, this.currentRound.roundSeed);
  }

  /** Bu turun REVEAL'a girdiği (= PLAYING'in başladığı) sunucu zamanı — GameRoom'un
   * gecikme telafisi hesabı (serverMeasuredMs = receivedAt - revealAt) için gerekli. */
  getRoundRevealAt(): number | null {
    return this.currentRound?.revealAt ?? null;
  }

  /** ROUND_RESULT'a girildiğinde GameRoom'un puanlama/round:result için okuduğu
   * salt-okunur tur verisi. LOCKED/ROUND_RESULT boyunca currentRound hâlâ bu turu
   * temsil eder (bir sonraki REVEAL'a kadar üzerine yazılmaz). */
  getRoundResultData(): RoundResultData | null {
    if (!this.currentRound) return null;
    const { puzzle, answers } = this.currentRound;
    return {
      puzzleId: puzzle.id,
      correctChoiceId: puzzle.correctChoiceId,
      explanation: puzzle.explanation,
      limitMs: puzzle.limitMs,
      answers,
    };
  }

  /** round:answer işleme — faz/puzzleId/tekrar cevap/geçerli şık/zamanlama
   * doğrulaması. `answerMs` GameRoom'da RTT'ye dayalı gecikme telafisiyle
   * (bkz. server/src/util/answerTiming.ts) önceden hesaplanmış olarak gelir. */
  submitAnswer(playerId: string, puzzleId: string, choiceId: string, answerMs: number, now: number): AnswerOutcome {
    if (this.phase !== 'PLAYING' || !this.currentRound) {
      return { accepted: false, code: 'E_WRONG_PHASE' };
    }
    if (puzzleId !== this.currentRound.puzzle.id) {
      return { accepted: false, code: 'E_STALE_PUZZLE' };
    }
    if (this.currentRound.answers.has(playerId)) {
      return { accepted: false, code: 'E_ALREADY_ANSWERED' };
    }
    const validChoice = this.currentRound.puzzle.choices.some((c) => c.id === choiceId);
    if (!validChoice) {
      return { accepted: false, code: 'E_INVALID_PAYLOAD' };
    }
    if (!Number.isFinite(answerMs) || answerMs < 0 || answerMs > this.currentRound.puzzle.limitMs) {
      return { accepted: false, code: 'E_TIMING' };
    }

    this.currentRound.answers.set(playerId, { choiceId, answerMs });
    this.maybeScheduleEarlyLock(now);
    return { accepted: true };
  }

  private advance(now: number): void {
    switch (this.phase) {
      case 'COUNTDOWN':
        this.enterPhase('REVEAL', now + REVEAL_DELAY_MS);
        return;
      case 'REVEAL':
        this.enterPhase('PLAYING', now + this.currentRound!.puzzle.limitMs);
        return;
      case 'PLAYING':
        this.enterPhase('LOCKED', now + LOCKED_MS);
        return;
      case 'LOCKED':
        this.enterPhase('ROUND_RESULT', now + ROUND_RESULT_MS);
        return;
      case 'ROUND_RESULT':
        if (this.round < this.totalRounds) {
          this.round += 1;
          this.enterPhase('REVEAL', now + REVEAL_DELAY_MS);
        } else {
          this.enterPhase('GAME_RESULT', null);
        }
        return;
      case 'LOBBY':
      case 'GAME_RESULT':
        return; // terminal / yalnızca start() ile çıkılır
    }
  }

  private enterPhase(phase: GamePhase, phaseEndsAt: number | null): void {
    this.phase = phase;
    this.phaseEndsAt = phaseEndsAt;
    if (phase === 'REVEAL') {
      this.generateRoundPuzzle();
    }
    this.onPhaseChange({ phase, round: this.round, phaseEndsAt });
  }

  // Bağlı ve aktif tüm oyuncular cevapladıysa PLAYING derhal bitmez, ama
  // ALL_ANSWERED_GRACE_MS sonra kilitlenecek şekilde phaseEndsAt kısaltılır
  // (bkz. docs/02-GAME_DESIGN.md §1). Faz değişmiyor, yalnızca süre güncelleniyor —
  // client sayacının doğru kalması için onPhaseChange yine çağrılır.
  private maybeScheduleEarlyLock(now: number): void {
    if (this.phase !== 'PLAYING' || !this.currentRound) return;
    if (this.activePlayerIds.size === 0) return;
    if (this.currentRound.answers.size < this.activePlayerIds.size) return;

    const earlyEnd = now + ALL_ANSWERED_GRACE_MS;
    if (this.phaseEndsAt === null || earlyEnd < this.phaseEndsAt) {
      this.phaseEndsAt = earlyEnd;
      this.onPhaseChange({ phase: this.phase, round: this.round, phaseEndsAt: this.phaseEndsAt });
    }
  }

  // Tohumlu üretim (bkz. docs/03-ARCHITECTURE.md §5.3): roundSeed = hash(matchSeed, round).
  // Aynı maçta tekrar eden puzzle.id'ye karşı max 10 deneme. Zorluk difficultyForRound()'dan,
  // tip pickPuzzleType()'tan (arka arkaya aynı tip yasak, bkz. docs/02-GAME_DESIGN.md §2) gelir.
  private generateRoundPuzzle(): void {
    const difficulty = difficultyForRound(this.round, this.totalRounds);
    const type = this.selectPuzzleType();
    const generator = getPuzzleGenerator(type);
    const roundSeed = deriveSeed(this.matchSeed, this.round);

    let puzzle: ServerPuzzle;
    let attempt = 0;
    do {
      const rng = mulberry32(deriveSeed(roundSeed, attempt));
      puzzle = generator.generate(rng, difficulty);
      attempt += 1;
    } while (this.usedPuzzleIds.has(puzzle.id) && attempt < MAX_PUZZLE_ID_RETRIES);

    this.usedPuzzleIds.add(puzzle.id);
    // Zorluk eğrisinin süre çarpanı burada, tek yerden uygulanır (bkz.
    // docs/02-GAME_DESIGN.md §2 "süre çarpanı") — generator'lar bundan habersiz kalır.
    puzzle = { ...puzzle, limitMs: Math.round(puzzle.limitMs * timeMultiplierForDifficulty(difficulty)) };
    // enterPhase() this.phaseEndsAt'ı generateRoundPuzzle() çağrılmadan ÖNCE ayarlıyor
    // (bkz. enterPhase), yani burada revealAt = REVEAL'ın bittiği (PLAYING'in başladığı) an.
    this.currentRound = { puzzle, roundSeed, revealAt: this.phaseEndsAt!, answers: new Map() };
  }

  // Tip seçimi için puzzle içeriği rng'siyle (roundSeed) çakışmasın diye ayrı bir salt kullanılır.
  private selectPuzzleType(): PuzzleType {
    const rng = mulberry32(deriveSeed(this.matchSeed, `type:${this.round}`));
    const type = pickPuzzleType(rng, registeredPuzzleTypes(), this.lastPuzzleType);
    this.lastPuzzleType = type;
    return type;
  }
}
