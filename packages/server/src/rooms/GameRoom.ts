import { Room, Client, ServerError, matchMaker, ErrorCode as ColyseusErrorCode } from 'colyseus';
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  NICKNAME_MAX,
  ROUNDS_PER_MATCH,
  ROOM_CODE_LENGTH,
  generateRoomCode,
  sanitizeNickname,
  scoreAnswer,
  streakBonusFor,
  rankStandings,
  compareStandings,
  NO_FASTEST_ANSWER_MS,
  FIRST_CORRECT_BONUS,
  FINAL_ROUND_MULTIPLIER,
  SetNicknameMessageSchema,
  ReadyMessageSchema,
  MatchStartMessageSchema,
  NetPingMessageSchema,
  RoundAnswerMessageSchema,
  MatchRematchMessageSchema,
  type PublicConfig,
  type RoomWelcomeMessage,
  type RoomNoticeMessage,
  type RoundPuzzleMessage,
  type RoundAnswerAckMessage,
  type RoundResult,
  type MatchResult,
  type ScoreBonus,
  type StandingInput,
  type NetPongMessage,
  type ErrorMessage,
} from 'shared';
import { GameState, PlayerSchema } from './state';
import { MatchController, type MatchPhaseInfo } from './MatchController';
import { computeAnswerMs } from '../util/answerTiming';

// Sunucu net:ping/net:pong üzerinden RTT tahmini tutar (bkz. docs/DECISIONS.md
// ADR-010). Client, bağlantıda 5 ping'i art arda VE her birini bir önceki pong
// yanıtını aldıktan hemen sonra gönderir (bkz. client/src/net/clockSync.ts) —
// bu yüzden "pong gönderildiği an ile bir sonraki ping'in geldiği an arasındaki
// süre" gerçek RTT'ye yakın bir tahmindir.
interface RttState {
  lastPongSentAt: number | null;
  samples: number[]; // son 5 örnek
}

const RTT_SAMPLE_WINDOW = 5;

export interface RoomMetadata {
  roomCode: string;
}

interface JoinOptions {
  nickname?: unknown;
}

const PUBLIC_CONFIG: PublicConfig = { maxPlayers: MAX_PLAYERS, nicknameMax: NICKNAME_MAX };

export class GameRoom extends Room<{ state: GameState; metadata: RoomMetadata }> {
  private nextJoinIndex = 0;
  private matchController!: MatchController;
  private rttStates = new Map<string, RttState>();
  private currentMatchSeed = 0;
  // Maç genelinde en hızlı doğru cevap ve oyuncu başı en uzun seri (bkz. FAZ 6
  // match:result). Hassas veri değil ama turluk/geçici olduğu için state'e değil
  // (ADR-003 ruhu), buraya konur; match:start'ta sıfırlanır.
  private matchFastestCorrect: { playerId: string; answerMs: number; round: number } | null = null;
  private bestStreakBySession = new Map<string, number>();

  async onCreate(): Promise<void> {
    this.maxClients = MAX_PLAYERS;
    this.state = new GameState();
    this.state.totalRounds = ROUNDS_PER_MATCH;

    const roomCode = await this.generateUniqueRoomCode();
    this.state.roomCode = roomCode;
    await this.setMatchmaking({ metadata: { roomCode }, private: true });

    this.matchController = new MatchController({
      totalRounds: ROUNDS_PER_MATCH,
      onPhaseChange: (info) => this.handlePhaseChange(info),
    });
    this.clock.setInterval(() => this.matchController.checkAdvance(Date.now()), 100);

    // 2 parametreli onMessage kasıtlı: 3 parametreli (zod şemalı) overload,
    // doğrulama başarısız olunca client'ı client.leave() ile sertçe atıyor —
    // bu da "reddedilen mesajda error gönderilir, sessizce yutulmaz" kuralını
    // ihlal ediyor. Bkz. docs/DECISIONS.md ADR-008.
    this.onMessage('player:setNickname', (client, raw) => {
      const parsed = SetNicknameMessageSchema.safeParse(raw);
      if (!parsed.success) {
        this.sendError(client, 'E_INVALID_PAYLOAD');
        return;
      }
      const nickname = sanitizeNickname(parsed.data.nickname);
      if (!nickname) {
        this.sendError(client, 'E_INVALID_NICKNAME');
        return;
      }
      const player = this.state.players.get(client.sessionId);
      if (player) player.nickname = nickname;
    });

    this.onMessage('player:ready', (client, raw) => {
      const parsed = ReadyMessageSchema.safeParse(raw);
      if (!parsed.success) {
        this.sendError(client, 'E_INVALID_PAYLOAD');
        return;
      }
      if (this.state.phase !== 'LOBBY') {
        this.sendError(client, 'E_WRONG_PHASE');
        return;
      }
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      player.ready = parsed.data.ready;
    });

    this.onMessage('match:start', (client, raw) => {
      const parsed = MatchStartMessageSchema.safeParse(raw);
      if (!parsed.success) {
        this.sendError(client, 'E_INVALID_PAYLOAD');
        return;
      }
      // Sıra 04-NETWORK_PROTOCOL.md §1'deki doğrulama sırasıyla aynı: host mu,
      // yeterli oyuncu var mı, faz LOBBY mi.
      if (client.sessionId !== this.state.hostId) {
        this.sendError(client, 'E_NOT_HOST');
        return;
      }
      const connectedCount = Array.from(this.state.players.values()).filter((p) => p.connected).length;
      if (connectedCount < MIN_PLAYERS) {
        this.sendError(client, 'E_NOT_ENOUGH_PLAYERS');
        return;
      }
      if (this.state.phase !== 'LOBBY') {
        this.sendError(client, 'E_WRONG_PHASE');
        return;
      }
      // maç başında bir kez üretilir ve loglanır (bkz. docs/03-ARCHITECTURE.md §5.3)
      const matchSeed = Math.floor(Math.random() * 0xffffffff) >>> 0;
      console.log(`[GameRoom] maç başladı: oda=${this.roomId} matchSeed=${matchSeed}`);
      this.currentMatchSeed = matchSeed;
      this.matchFastestCorrect = null;
      this.bestStreakBySession.clear();
      this.matchController.start(Date.now(), matchSeed);
      // Maç başlayınca yeni oyuncu giremez (bkz. docs/03-ARCHITECTURE.md §4.3);
      // match:rematch ile lobiye dönünce unlock edilir.
      this.lock();
    });

    this.onMessage('match:rematch', (client, raw) => {
      const parsed = MatchRematchMessageSchema.safeParse(raw);
      if (!parsed.success) {
        this.sendError(client, 'E_INVALID_PAYLOAD');
        return;
      }
      // 04-NETWORK_PROTOCOL.md §1: match:rematch için tek koşul faz GAME_RESULT
      // olması — host şartı yok (bkz. docs/DECISIONS.md ADR-014). Gerçek maçı
      // başlatmak yine host'un match:start'ına kalır.
      if (this.state.phase !== 'GAME_RESULT') {
        this.sendError(client, 'E_WRONG_PHASE');
        return;
      }
      this.matchController.rematch();
      this.unlock();
      this.matchFastestCorrect = null;
      this.bestStreakBySession.clear();
      for (const player of this.state.players.values()) {
        player.score = 0;
        player.correctCount = 0;
        player.streak = 0;
        player.hasAnswered = false;
        player.totalAnswerMs = 0;
        player.fastestAnswerMs = NO_FASTEST_ANSWER_MS;
        player.ready = false;
      }
    });

    this.onMessage('round:answer', (client, raw) => {
      const parsed = RoundAnswerMessageSchema.safeParse(raw);
      if (!parsed.success) {
        this.sendError(client, 'E_INVALID_PAYLOAD');
        return;
      }
      const { puzzleId, choiceId, clientAnsweredAtServerMs } = parsed.data;
      const receivedAt = Date.now();
      const answerMs = this.computeClampedAnswerMs(client.sessionId, receivedAt, clientAnsweredAtServerMs);
      const result = this.matchController.submitAnswer(client.sessionId, puzzleId, choiceId, answerMs, receivedAt);

      const ack: RoundAnswerAckMessage = result.accepted
        ? { puzzleId, accepted: true }
        : { puzzleId, accepted: false, code: result.code };
      client.send('round:answerAck', ack);

      if (result.accepted) {
        const player = this.state.players.get(client.sessionId);
        if (player) player.hasAnswered = true;
        this.state.answeredCount += 1;
      } else {
        // round:answerAck'in code alanı reddi zaten client'a bildiriyor (bkz.
        // docs/04-NETWORK_PROTOCOL.md); burada yalnızca sunucu tarafı loglanır
        // (CLAUDE.md: "reddedilen mesaj sessizce yutulmaz").
        console.log(`[GameRoom] round:answer reddedildi: ${client.sessionId} kod=${result.code}`);
      }
    });

    this.onMessage('net:ping', (client, raw) => {
      const parsed = NetPingMessageSchema.safeParse(raw);
      if (!parsed.success) {
        this.sendError(client, 'E_INVALID_PAYLOAD');
        return;
      }
      const now = Date.now();
      this.recordRttSample(client.sessionId, now);
      const pong: NetPongMessage = { t0: parsed.data.t0, tServer: now };
      client.send('net:pong', pong);
    });

    console.log(`[GameRoom] oluşturuldu: ${this.roomId} kod=${roomCode}`);
  }

  onJoin(client: Client, options: JoinOptions): void {
    // matchMaker.joinById() (bkz. http/joinByCode.ts, ADR-008) kapasiteyi önden
    // kontrol ediyor ama yarış penceresine karşı sunucu burada da otoriter olarak
    // doğrular (CLAUDE.md: "sunucu otoritedir").
    if (this.state.players.size >= MAX_PLAYERS) {
      throw new ServerError(ColyseusErrorCode.APPLICATION_ERROR, 'E_ROOM_FULL');
    }

    const rawNickname = typeof options?.nickname === 'string' ? options.nickname : '';
    const nickname = sanitizeNickname(rawNickname);
    if (!nickname) {
      throw new ServerError(ColyseusErrorCode.APPLICATION_ERROR, 'E_INVALID_NICKNAME');
    }

    const player = new PlayerSchema();
    player.id = client.sessionId;
    player.nickname = nickname;
    player.connected = true;
    player.joinIndex = this.nextJoinIndex++;

    const isFirstPlayer = !this.state.hostId;
    if (isFirstPlayer) this.state.hostId = client.sessionId;
    this.state.players.set(client.sessionId, player);
    this.matchController.addPlayer(client.sessionId);

    const welcome: RoomWelcomeMessage = {
      roomCode: this.state.roomCode,
      youId: client.sessionId,
      hostId: this.state.hostId,
      config: PUBLIC_CONFIG,
    };
    client.send('room:welcome', welcome);

    if (!isFirstPlayer) {
      this.broadcastNotice({ code: 'PLAYER_JOINED', playerId: client.sessionId, nickname }, client);
    }

    console.log(`[GameRoom] katıldı: ${client.sessionId} (${nickname}) oda=${this.roomId}`);
  }

  onLeave(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    const nickname = player?.nickname ?? '';
    const wasHost = this.state.hostId === client.sessionId;

    this.state.players.delete(client.sessionId);
    this.rttStates.delete(client.sessionId);
    this.matchController.removePlayer(client.sessionId);
    this.broadcastNotice({ code: 'PLAYER_LEFT', playerId: client.sessionId, nickname });

    if (wasHost) {
      const next = this.pickNextHost();
      this.state.hostId = next?.id ?? '';
      if (next) {
        this.broadcastNotice({ code: 'HOST_CHANGED', playerId: next.id, nickname: next.nickname });
      }
    }

    console.log(`[GameRoom] ayrıldı: ${client.sessionId} oda=${this.roomId}`);
  }

  // MatchController'ın faz geçişlerini state'e yansıtır. REVEAL'a girildiğinde
  // turun cevap durumu sıfırlanır ve herkese kişiye özel round:puzzle gönderilir.
  private handlePhaseChange(info: MatchPhaseInfo): void {
    this.state.phase = info.phase;
    this.state.round = info.round;
    this.state.phaseEndsAt = info.phaseEndsAt ?? 0;

    if (info.phase === 'REVEAL') {
      this.state.answeredCount = 0;
      for (const player of this.state.players.values()) player.hasAnswered = false;
      this.sendRoundPuzzles(info.round, info.phaseEndsAt!);
    }

    if (info.phase === 'ROUND_RESULT') {
      this.sendRoundResult(info.round);
    }

    if (info.phase === 'GAME_RESULT') {
      this.sendMatchResult();
    }
  }

  // round:puzzle her oyuncuya AYRI gönderilir (bkz. docs/04-NETWORK_PROTOCOL.md §5.1) —
  // şık sırası oyuncuya özel karışık olduğu için broadcast kullanılmaz.
  private sendRoundPuzzles(round: number, revealAt: number): void {
    for (const client of this.clients) {
      const puzzle = this.matchController.getClientPuzzle(client.sessionId);
      if (!puzzle) continue; // savunma amaçlı; REVEAL'da her zaman dolu olmalı
      const message: RoundPuzzleMessage = {
        puzzle,
        round,
        totalRounds: this.state.totalRounds,
        revealAt,
        endsAt: revealAt + puzzle.limitMs,
      };
      client.send('round:puzzle', message);
    }
  }

  // Puanlama (bkz. docs/02-GAME_DESIGN.md §5) — sunucu otoritedir, tur kilitlenip
  // correctChoiceId açığa çıkana kadar hiçbir yerde doğruluk bilgisi yoktu.
  // Skor/streak/correctCount PlayerSchema'da (state) kalıcı tutulur; RoundState
  // (MatchController) yalnızca bu turun ham cevaplarını taşır.
  private sendRoundResult(round: number): void {
    const data = this.matchController.getRoundResultData();
    if (!data) return; // savunma amaçlı; ROUND_RESULT'ta her zaman dolu olmalı

    const isFinalRound = round === this.state.totalRounds;
    const roundMultiplier = isFinalRound ? FINAL_ROUND_MULTIPLIER : 1;

    // "İlk doğru cevap" bonusu: answers Map'i varış sırasıyla dolduruluyor
    // (bkz. MatchController.submitAnswer) — ilk doğru olan kazanır.
    let firstCorrectPlayerId: string | null = null;
    for (const [playerId, answer] of data.answers) {
      if (answer.choiceId === data.correctChoiceId) {
        firstCorrectPlayerId = playerId;
        break;
      }
    }

    const entries: RoundResult['entries'] = [];
    const players = Array.from(this.state.players.values()).sort((a, b) => a.joinIndex - b.joinIndex);

    for (const player of players) {
      const answer = data.answers.get(player.id) ?? null;
      const correct = answer !== null && answer.choiceId === data.correctChoiceId;
      const answerMs = answer?.answerMs ?? null;
      const bonuses: ScoreBonus[] = [];
      let gained = 0;

      if (correct && answerMs !== null) {
        gained = scoreAnswer({
          correct: true,
          answerMs,
          limitMs: data.limitMs,
          roundMultiplier,
          modifier: { kind: 'NONE' },
        });

        if (player.id === firstCorrectPlayerId) {
          bonuses.push('FIRST_CORRECT');
          gained += FIRST_CORRECT_BONUS;
        }

        player.streak += 1;
        const streak = streakBonusFor(player.streak);
        if (streak) {
          bonuses.push(streak.bonus);
          gained += streak.points;
        }
        if (isFinalRound) bonuses.push('FINAL_X2');

        player.correctCount += 1;
        player.totalAnswerMs += answerMs;
        if (player.fastestAnswerMs === NO_FASTEST_ANSWER_MS || answerMs < player.fastestAnswerMs) {
          player.fastestAnswerMs = answerMs;
        }

        // Maç geneli istatistikler (bkz. match:result → stats). Bu izleyiciler
        // state dışında (private alan), yalnızca GAME_RESULT'ta okunur.
        if (this.matchFastestCorrect === null || answerMs < this.matchFastestCorrect.answerMs) {
          this.matchFastestCorrect = { playerId: player.id, answerMs, round };
        }
        const bestStreak = this.bestStreakBySession.get(player.id) ?? 0;
        if (player.streak > bestStreak) {
          this.bestStreakBySession.set(player.id, player.streak);
        }
      } else {
        player.streak = 0;
      }

      player.score += gained;
      entries.push({
        playerId: player.id,
        choiceId: answer?.choiceId ?? null,
        correct,
        answerMs,
        gained,
        total: player.score,
        bonuses,
      });
    }

    const standings = rankStandings(this.buildStandingInputs(players));

    const result: RoundResult = {
      round,
      puzzleId: data.puzzleId,
      correctChoiceId: data.correctChoiceId,
      explanation: data.explanation,
      entries,
      standings,
    };
    this.broadcast('round:result', result);
  }

  // round:result ve match:result aynı beraberlik bozma sırasını (bkz.
  // docs/02-GAME_DESIGN.md §5.3) kullanır — girdi tek yerden üretilir.
  private buildStandingInputs(players: readonly PlayerSchema[]): StandingInput[] {
    return players.map((p) => ({
      playerId: p.id,
      total: p.score,
      correctCount: p.correctCount,
      totalAnswerMs: p.totalAnswerMs,
      fastestAnswerMs: p.fastestAnswerMs === NO_FASTEST_ANSWER_MS ? null : p.fastestAnswerMs,
      joinIndex: p.joinIndex,
    }));
  }

  // Son turdan sonra bir kez gönderilir (bkz. docs/04-NETWORK_PROTOCOL.md §2
  // MatchResult). Standings aynı beraberlik bozma sırasını kullanır, correctCount
  // eklenir. Stats, sendRoundResult() boyunca biriktirilen private izleyicilerden okunur.
  private sendMatchResult(): void {
    const players = Array.from(this.state.players.values()).sort((a, b) => a.joinIndex - b.joinIndex);
    const standingInputs = this.buildStandingInputs(players);

    const standings = standingInputs
      .slice()
      .sort(compareStandings)
      .map((s, index) => ({ playerId: s.playerId, rank: index + 1, total: s.total, correctCount: s.correctCount }));

    let mostCorrect: MatchResult['stats']['mostCorrect'];
    for (const player of players) {
      if (player.correctCount > 0 && (!mostCorrect || player.correctCount > mostCorrect.count)) {
        mostCorrect = { playerId: player.id, count: player.correctCount };
      }
    }

    let longestStreak: MatchResult['stats']['longestStreak'];
    for (const [playerId, streak] of this.bestStreakBySession) {
      if (streak > 0 && (!longestStreak || streak > longestStreak.streak)) {
        longestStreak = { playerId, streak };
      }
    }

    const result: MatchResult = {
      standings,
      stats: {
        fastestCorrect: this.matchFastestCorrect ?? undefined,
        mostCorrect,
        longestStreak,
      },
      matchSeed: this.currentMatchSeed,
    };
    this.broadcast('match:result', result);
  }

  // Gecikme telafisi (bkz. docs/03-ARCHITECTURE.md §7.3): sunucunun ölçtüğü süre
  // ile client'ın iddia ettiği süre arasında, RTT/2 + TOLERANCE kadar tolerans
  // tanınarak clamp yapılır. revealAt yoksa (aktif tur yok) submitAnswer zaten
  // E_WRONG_PHASE/E_STALE_PUZZLE ile reddedecek; 0 dönmek zararsız.
  private computeClampedAnswerMs(sessionId: string, receivedAt: number, clientAnsweredAtServerMs: number): number {
    const revealAt = this.matchController.getRoundRevealAt();
    if (revealAt === null) return 0;
    return computeAnswerMs({
      clientClaimedMs: clientAnsweredAtServerMs - revealAt,
      serverMeasuredMs: receivedAt - revealAt,
      halfRttMs: this.getHalfRttEstimate(sessionId),
    });
  }

  private getHalfRttEstimate(sessionId: string): number {
    const state = this.rttStates.get(sessionId);
    if (!state || state.samples.length === 0) return 0;
    return Math.min(...state.samples) / 2;
  }

  private recordRttSample(sessionId: string, now: number): void {
    const state = this.rttStates.get(sessionId) ?? { lastPongSentAt: null, samples: [] };
    if (state.lastPongSentAt !== null) {
      state.samples.push(now - state.lastPongSentAt);
      if (state.samples.length > RTT_SAMPLE_WINDOW) state.samples.shift();
    }
    state.lastPongSentAt = now;
    this.rttStates.set(sessionId, state);
  }

  // En düşük joinIndex'li bağlı oyuncu host olur (bkz. docs/03-ARCHITECTURE.md §8).
  // FAZ 7'ye kadar tüm oyuncular connected=true'dur (onDrop/reconnect yok).
  private pickNextHost(): PlayerSchema | undefined {
    let next: PlayerSchema | undefined;
    for (const candidate of this.state.players.values()) {
      if (!candidate.connected) continue;
      if (!next || candidate.joinIndex < next.joinIndex) next = candidate;
    }
    return next;
  }

  private broadcastNotice(notice: RoomNoticeMessage, except?: Client): void {
    this.broadcast('room:notice', notice, except ? { except } : undefined);
  }

  private sendError(client: Client, code: ErrorMessage['code']): void {
    const message: ErrorMessage = { code, message: code };
    client.send('error', message);
  }

  private async generateUniqueRoomCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateRoomCode(ROOM_CODE_LENGTH);
      const existing = await matchMaker.query({ name: 'game', roomCode: candidate });
      if (existing.length === 0) return candidate;
    }

    const candidate6 = generateRoomCode(ROOM_CODE_LENGTH + 1);
    const existing6 = await matchMaker.query({ name: 'game', roomCode: candidate6 });
    if (existing6.length === 0) return candidate6;

    throw new ServerError(ColyseusErrorCode.APPLICATION_ERROR, 'oda kodu üretilemedi');
  }
}
