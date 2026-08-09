import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { boot, type ColyseusTestServer } from '@colyseus/testing';
import { defineServer, defineRoom } from 'colyseus';
import express from 'express';
import { MAX_PLAYERS, REVEAL_DELAY_MS, ROUNDS_PER_MATCH } from 'shared';
import { GameRoom } from './GameRoom';
import { joinByCodeHandler } from '../http/joinByCode';

let colyseus: ColyseusTestServer;

beforeAll(async () => {
  colyseus = await boot(
    defineServer({
      rooms: { game: defineRoom(GameRoom).filterBy(['roomCode']) },
      express: (app) => {
        app.use(express.json());
        app.post('/rooms/join-by-code', joinByCodeHandler);
      },
    }),
  );
});

afterEach(async () => {
  await colyseus.cleanup();
});

afterAll(async () => {
  await colyseus.shutdown();
});

describe('oda kodu ile katılma', () => {
  it('iki client aynı odaya kodla girer', async () => {
    const roomA = await colyseus.createRoom('game', { nickname: 'Furkan' });
    await colyseus.connectTo(roomA, { nickname: 'Furkan' });

    const roomCode = roomA.state.roomCode;
    expect(roomCode).toHaveLength(5);

    const res = await colyseus.http.post('/rooms/join-by-code', {
      body: { roomCode, nickname: 'Mehmet' },
    });
    await colyseus.sdk.consumeSeatReservation(res.data);

    const nicknames = Array.from(roomA.state.players.values()).map((p) => p.nickname);
    expect(nicknames.sort()).toEqual(['Furkan', 'Mehmet']);
  });

  it('yanlış kod E_ROOM_NOT_FOUND döner', async () => {
    await expect(
      colyseus.http.post('/rooms/join-by-code', { body: { roomCode: 'ZZZZZ', nickname: 'Test' } }),
    ).rejects.toMatchObject({ statusCode: 404, data: { code: 'E_ROOM_NOT_FOUND' } });
  });

  it('oda MAX_PLAYERS oyuncuya ulaşınca yeni katılım reddedilir', async () => {
    const roomA = await colyseus.createRoom('game', { nickname: 'P0' });
    for (let i = 0; i < MAX_PLAYERS; i++) {
      await colyseus.connectTo(roomA, { nickname: `P${i}` });
    }

    await expect(colyseus.connectTo(roomA, { nickname: 'Fazla' })).rejects.toThrow();
    expect(roomA.state.players.size).toBe(MAX_PLAYERS);
  });
});

describe('lobi: hazır durumu, host devri, bildirimler', () => {
  it('player:ready oyuncunun hazır durumunu günceller', async () => {
    const roomA = await colyseus.createRoom('game', { nickname: 'Furkan' });
    const clientA = await colyseus.connectTo(roomA, { nickname: 'Furkan' });

    const waiting = roomA.waitForMessage('player:ready');
    clientA.send('player:ready', { ready: true });
    await waiting;

    expect(roomA.state.players.get(clientA.sessionId)?.ready).toBe(true);
  });

  it('yeni oyuncu katılınca odadakilere room:notice PLAYER_JOINED gider', async () => {
    const roomA = await colyseus.createRoom('game', { nickname: 'Furkan' });
    const clientA = await colyseus.connectTo(roomA, { nickname: 'Furkan' });

    const noticeP = clientA.waitForMessage('room:notice');
    await colyseus.connectTo(roomA, { nickname: 'Mehmet' });
    const notice = await noticeP;

    expect(notice).toMatchObject({ code: 'PLAYER_JOINED', nickname: 'Mehmet' });
  });

  it('host ayrılınca en düşük joinIndex\'li bağlı oyuncuya devrolur', async () => {
    const roomA = await colyseus.createRoom('game', { nickname: 'Ayşe' });
    const clientA = await colyseus.connectTo(roomA, { nickname: 'Ayşe' });
    const clientB = await colyseus.connectTo(roomA, { nickname: 'Bora' });

    expect(roomA.state.hostId).toBe(clientA.sessionId);

    const noticeP = clientB.waitForMessage('room:notice');
    await clientA.leave();
    const notice = await noticeP;

    expect(notice).toMatchObject({ code: 'PLAYER_LEFT', playerId: clientA.sessionId });
    expect(roomA.state.players.has(clientA.sessionId)).toBe(false);
    expect(roomA.state.hostId).toBe(clientB.sessionId);
  });
});

describe('faz makinesi: match:start ve net:ping/pong', () => {
  it('host olmayan match:start gönderirse E_NOT_HOST alır ve faz LOBBY kalır', async () => {
    const roomA = await colyseus.createRoom('game', { nickname: 'Furkan' });
    const clientA = await colyseus.connectTo(roomA, { nickname: 'Furkan' });
    const clientB = await colyseus.connectTo(roomA, { nickname: 'Mehmet' });

    const errorP = clientB.waitForMessage('error');
    clientB.send('match:start', {});
    const error = await errorP;

    expect(error).toMatchObject({ code: 'E_NOT_HOST' });
    expect(roomA.state.phase).toBe('LOBBY');
    void clientA;
  });

  it('yeterli oyuncu yoksa host match:start gönderince E_NOT_ENOUGH_PLAYERS alır', async () => {
    const roomA = await colyseus.createRoom('game', { nickname: 'Furkan' });
    const clientA = await colyseus.connectTo(roomA, { nickname: 'Furkan' });

    const errorP = clientA.waitForMessage('error');
    clientA.send('match:start', {});
    const error = await errorP;

    expect(error).toMatchObject({ code: 'E_NOT_ENOUGH_PLAYERS' });
    expect(roomA.state.phase).toBe('LOBBY');
  });

  it('host + yeterli oyuncu ile match:start faz COUNTDOWN\'a geçirir', async () => {
    const roomA = await colyseus.createRoom('game', { nickname: 'Furkan' });
    const clientA = await colyseus.connectTo(roomA, { nickname: 'Furkan' });
    await colyseus.connectTo(roomA, { nickname: 'Mehmet' });

    clientA.send('match:start', {});
    await roomA.waitForNextPatch();

    expect(roomA.state.phase).toBe('COUNTDOWN');
    expect(roomA.state.phaseEndsAt).toBeGreaterThan(0);
  });

  it('faz LOBBY değilken tekrar match:start gönderilirse E_WRONG_PHASE alır', async () => {
    const roomA = await colyseus.createRoom('game', { nickname: 'Furkan' });
    const clientA = await colyseus.connectTo(roomA, { nickname: 'Furkan' });
    await colyseus.connectTo(roomA, { nickname: 'Mehmet' });

    clientA.send('match:start', {});
    await roomA.waitForNextPatch();
    expect(roomA.state.phase).toBe('COUNTDOWN');

    const errorP = clientA.waitForMessage('error');
    clientA.send('match:start', {});
    const error = await errorP;

    expect(error).toMatchObject({ code: 'E_WRONG_PHASE' });
  });

  it('net:ping gönderilince aynı t0 ve bir tServer ile net:pong döner', async () => {
    const roomA = await colyseus.createRoom('game', { nickname: 'Furkan' });
    const clientA = await colyseus.connectTo(roomA, { nickname: 'Furkan' });

    const pongP = clientA.waitForMessage('net:pong');
    clientA.send('net:ping', { t0: 12345 });
    const pong = await pongP;

    expect(pong).toMatchObject({ t0: 12345 });
    expect(typeof (pong as { tServer: number }).tServer).toBe('number');
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface RoundPuzzlePayload {
  puzzle: { id: string; choices: Array<{ id: string; label: string }> };
}

// Bu describe bloğu COUNTDOWN_MS (3000ms) ve REVEAL_DELAY_MS (600ms) boyunca gerçek
// zaman bekliyor (Colyseus'un `clock`'u gerçek wall-clock tabanlı, testte hızlandırılamıyor)
// — bu yüzden testlere geniş timeout veriliyor.
describe('FAZ 4: PATTERN puzzle uçtan uca', () => {
  it(
    'match başlayınca her oyuncuya AYRI round:puzzle gelir, correctChoiceId/explanation client\'a gitmez',
    async () => {
      const roomA = await colyseus.createRoom('game', { nickname: 'Furkan' });
      const clientA = await colyseus.connectTo(roomA, { nickname: 'Furkan' });
      const clientB = await colyseus.connectTo(roomA, { nickname: 'Mehmet' });

      const puzzleAP = clientA.waitForMessage('round:puzzle', 8000);
      const puzzleBP = clientB.waitForMessage('round:puzzle', 8000);
      clientA.send('match:start', {});

      const puzzleA = (await puzzleAP) as RoundPuzzlePayload;
      const puzzleB = (await puzzleBP) as RoundPuzzlePayload;

      expect(puzzleA.puzzle.id).toBe(puzzleB.puzzle.id);
      expect(puzzleA.puzzle.choices).toHaveLength(4);
      expect('correctChoiceId' in puzzleA.puzzle).toBe(false);
      expect('explanation' in puzzleA.puzzle).toBe(false);

      // Aynı şık kümesi, oyuncuya özel karışık sırayla (kopya önleme).
      const idsA = puzzleA.puzzle.choices.map((c) => c.id).sort();
      const idsB = puzzleB.puzzle.choices.map((c) => c.id).sort();
      expect(idsA).toEqual(idsB);
    },
    10000,
  );

  it(
    'PLAYING fazında geçerli cevap round:answerAck {accepted:true} döner',
    async () => {
      const roomA = await colyseus.createRoom('game', { nickname: 'Furkan' });
      const clientA = await colyseus.connectTo(roomA, { nickname: 'Furkan' });
      await colyseus.connectTo(roomA, { nickname: 'Mehmet' });

      const puzzleP = clientA.waitForMessage('round:puzzle', 8000);
      clientA.send('match:start', {});
      const { puzzle } = (await puzzleP) as RoundPuzzlePayload;
      await sleep(REVEAL_DELAY_MS + 200); // REVEAL → PLAYING

      const ackP = clientA.waitForMessage('round:answerAck');
      clientA.send('round:answer', {
        puzzleId: puzzle.id,
        choiceId: puzzle.choices[0]!.id,
        clientAnsweredAtServerMs: Date.now(),
      });
      const ack = await ackP;

      expect(ack).toEqual({ puzzleId: puzzle.id, accepted: true });
    },
    10000,
  );

  it(
    'yanlış puzzleId ile cevap E_STALE_PUZZLE, aynı oyuncunun ikinci cevabı E_ALREADY_ANSWERED alır',
    async () => {
      const roomA = await colyseus.createRoom('game', { nickname: 'Furkan' });
      const clientA = await colyseus.connectTo(roomA, { nickname: 'Furkan' });
      await colyseus.connectTo(roomA, { nickname: 'Mehmet' });

      const puzzleP = clientA.waitForMessage('round:puzzle', 8000);
      clientA.send('match:start', {});
      const { puzzle } = (await puzzleP) as RoundPuzzlePayload;
      await sleep(REVEAL_DELAY_MS + 200); // REVEAL → PLAYING

      const staleAckP = clientA.waitForMessage('round:answerAck');
      clientA.send('round:answer', {
        puzzleId: 'gecersiz-puzzle-id',
        choiceId: puzzle.choices[0]!.id,
        clientAnsweredAtServerMs: Date.now(),
      });
      const staleAck = await staleAckP;
      expect(staleAck).toMatchObject({ accepted: false, code: 'E_STALE_PUZZLE' });

      const firstAckP = clientA.waitForMessage('round:answerAck');
      clientA.send('round:answer', {
        puzzleId: puzzle.id,
        choiceId: puzzle.choices[0]!.id,
        clientAnsweredAtServerMs: Date.now(),
      });
      await firstAckP;

      const secondAckP = clientA.waitForMessage('round:answerAck');
      clientA.send('round:answer', {
        puzzleId: puzzle.id,
        choiceId: puzzle.choices[1]!.id,
        clientAnsweredAtServerMs: Date.now(),
      });
      const secondAck = await secondAckP;
      expect(secondAck).toMatchObject({ accepted: false, code: 'E_ALREADY_ANSWERED' });
    },
    10000,
  );
});

interface RoundResultPayload {
  round: number;
  puzzleId: string;
  correctChoiceId: string;
  entries: Array<{
    playerId: string;
    choiceId: string | null;
    correct: boolean;
    answerMs: number | null;
    gained: number;
    total: number;
    bonuses: string[];
  }>;
  standings: Array<{ playerId: string; rank: number; total: number }>;
}

// LOCKED_MS (600ms) de gerçek zaman bekliyor (bkz. yukarıdaki not) — geniş timeout.
// correctChoiceId önceden bilinmiyor (client'a hiç gitmiyor, bkz. CLAUDE.md); bu
// yüzden PATTERN'in her zaman ürettiği 4 şıktan her birine BİR oyuncu cevap verilir
// (4 client) — böylece tam olarak bir oyuncunun doğru çıkacağı garanti edilir ve
// kimin doğru olduğu round:result'tan (correct: true olan giriş) sonradan okunur.
describe('FAZ 5: puanlama + round:result', () => {
  it(
    'doğru cevap veren oyuncu puan+FIRST_CORRECT bonusu kazanır, diğerleri 0 alır, standings\'te önde çıkar',
    async () => {
      const roomA = await colyseus.createRoom('game', { nickname: 'P0' });
      const clients = [
        await colyseus.connectTo(roomA, { nickname: 'P0' }),
        await colyseus.connectTo(roomA, { nickname: 'P1' }),
        await colyseus.connectTo(roomA, { nickname: 'P2' }),
        await colyseus.connectTo(roomA, { nickname: 'P3' }),
      ];

      const puzzlePs = clients.map((client) => client.waitForMessage('round:puzzle', 8000));
      clients[0]!.send('match:start', {});
      const puzzles = (await Promise.all(puzzlePs)) as RoundPuzzlePayload[];
      await sleep(REVEAL_DELAY_MS + 200); // REVEAL → PLAYING

      // Şık id'leri tüm oyuncularda AYNI kümedir, yalnızca sırası oyuncuya özel
      // karışıktır (bkz. docs/03-ARCHITECTURE.md §5.2) — bu yüzden "kanonik" sırayı
      // herhangi bir oyuncunun puzzle'ından alıp her oyuncuya farklı bir id atarsak
      // (kendi yerel sırasından bağımsız olarak), 4 client × 4 farklı id ile tam
      // olarak bir doğru cevabın gönderildiği garanti edilir.
      const canonicalChoiceIds = puzzles[0]!.puzzle.choices.map((c) => c.id);

      const resultP = clients[0]!.waitForMessage('round:result', 15000);
      clients.forEach((client, i) => {
        const { puzzle } = puzzles[i]!;
        client.send('round:answer', {
          puzzleId: puzzle.id,
          choiceId: canonicalChoiceIds[i]!,
          clientAnsweredAtServerMs: Date.now(),
        });
      });
      const result = (await resultP) as RoundResultPayload;

      expect(result.round).toBe(1);

      const correctEntry = result.entries.find((e) => e.correct);
      expect(correctEntry).toBeDefined();
      expect(correctEntry!.gained).toBeGreaterThan(0);
      expect(correctEntry!.answerMs).not.toBeNull();
      expect(correctEntry!.bonuses).toContain('FIRST_CORRECT');
      expect(correctEntry!.total).toBe(correctEntry!.gained);

      const wrongEntries = result.entries.filter((e) => !e.correct);
      expect(wrongEntries).toHaveLength(3);
      for (const entry of wrongEntries) {
        expect(entry.gained).toBe(0);
        expect(entry.total).toBe(0);
      }

      expect(result.standings[0]).toMatchObject({ playerId: correctEntry!.playerId, rank: 1 });
      expect(roomA.state.players.get(correctEntry!.playerId)?.score).toBe(correctEntry!.gained);
      expect(roomA.state.players.get(correctEntry!.playerId)?.correctCount).toBe(1);
      expect(roomA.state.players.get(correctEntry!.playerId)?.streak).toBe(1);
    },
    20000,
  );
});

interface MatchResultPayload {
  standings: Array<{ playerId: string; rank: number; total: number; correctCount: number }>;
  stats: {
    fastestCorrect?: { playerId: string; answerMs: number; round: number };
    mostCorrect?: { playerId: string; count: number };
    longestStreak?: { playerId: string; streak: number };
  };
  matchSeed: number;
}

// Her faz içi geçiş (REVEAL/LOCKED/ROUND_RESULT) gerçek zaman bekliyor; 5 tur ×
// (REVEAL_DELAY_MS + ALL_ANSWERED_GRACE_MS ile erken kilitlenme + LOCKED_MS +
// ROUND_RESULT_MS) ≈ 5 × ~5.8 sn + COUNTDOWN_MS — bu yüzden geniş timeout.
describe('FAZ 6: tam maç döngüsü, match:result, match:rematch', () => {
  it(
    `3 client tam ${ROUNDS_PER_MATCH} turluk maç oynar: match:start odayı kilitler, match:result standings/stats oyuncuların gerçek son durumuyla tutarlıdır, match:rematch skorları sıfırlar ve odayı unlock eder`,
    async () => {
      const roomA = await colyseus.createRoom('game', { nickname: 'P0' });
      const clients = [
        await colyseus.connectTo(roomA, { nickname: 'P0' }),
        await colyseus.connectTo(roomA, { nickname: 'P1' }),
        await colyseus.connectTo(roomA, { nickname: 'P2' }),
      ];

      const matchResultP = clients[0]!.waitForMessage('match:result', 60000);

      for (let round = 1; round <= ROUNDS_PER_MATCH; round++) {
        const puzzlePs = clients.map((client) => client.waitForMessage('round:puzzle', 10000));
        if (round === 1) {
          clients[0]!.send('match:start', {});
          await roomA.waitForNextPatch();
          expect(roomA.locked).toBe(true); // bkz. docs/03-ARCHITECTURE.md §4.3
        }
        const puzzles = (await Promise.all(puzzlePs)) as RoundPuzzlePayload[];
        await sleep(REVEAL_DELAY_MS + 150);

        // "Kanonik" şık id sırası (bkz. FAZ 5 testindeki aynı gerekçe): 3 client'a
        // 4 şıktan 3'ü dağıtılır, tam olarak bir doğru cevabın gönderilme ihtimali
        // yüksek tutulur (kalan 1 şık boşta kalır).
        const canonicalChoiceIds = puzzles[0]!.puzzle.choices.map((c) => c.id);
        clients.forEach((client, i) => {
          const { puzzle } = puzzles[i]!;
          client.send('round:answer', {
            puzzleId: puzzle.id,
            choiceId: canonicalChoiceIds[i]!,
            clientAnsweredAtServerMs: Date.now(),
          });
        });
      }

      const matchResult = (await matchResultP) as MatchResultPayload;
      await roomA.waitForNextPatch();
      expect(roomA.state.phase).toBe('GAME_RESULT');
      expect(roomA.state.phaseEndsAt).toBe(0);
      expect(typeof matchResult.matchSeed).toBe('number');

      const finalPlayers = Array.from(roomA.state.players.values());
      expect(matchResult.standings).toHaveLength(3);

      // standings puana göre azalan sırada olmalı ve her satır oyuncunun state'teki
      // son skoruyla birebir tutmalı (rastgele hangi cevapların doğru çıktığına
      // bağlı sabit değerler varsaymak yerine, gerçek son state'ten doğrulanıyor).
      for (let i = 0; i < matchResult.standings.length; i++) {
        const entry = matchResult.standings[i]!;
        expect(entry.rank).toBe(i + 1);
        const player = roomA.state.players.get(entry.playerId);
        expect(player).toBeDefined();
        expect(entry.total).toBe(player!.score);
        expect(entry.correctCount).toBe(player!.correctCount);
        if (i > 0) expect(matchResult.standings[i - 1]!.total).toBeGreaterThanOrEqual(entry.total);
      }

      if (matchResult.stats.mostCorrect) {
        const { playerId, count } = matchResult.stats.mostCorrect;
        expect(roomA.state.players.get(playerId)?.correctCount).toBe(count);
        for (const player of finalPlayers) expect(player.correctCount).toBeLessThanOrEqual(count);
      }
      if (matchResult.stats.fastestCorrect) {
        const { playerId, answerMs, round } = matchResult.stats.fastestCorrect;
        expect(roomA.state.players.get(playerId)?.fastestAnswerMs).toBe(answerMs);
        expect(round).toBeGreaterThanOrEqual(1);
        expect(round).toBeLessThanOrEqual(ROUNDS_PER_MATCH);
      }
      if (matchResult.stats.longestStreak) {
        expect(roomA.state.players.has(matchResult.stats.longestStreak.playerId)).toBe(true);
        expect(matchResult.stats.longestStreak.streak).toBeGreaterThan(0);
      }

      // match:rematch — herhangi bir oyuncu gönderebilir (bkz. docs/DECISIONS.md ADR-014)
      clients[1]!.send('match:rematch', {});
      await roomA.waitForNextPatch();

      expect(roomA.state.phase).toBe('LOBBY');
      expect(roomA.state.round).toBe(0);
      expect(roomA.locked).toBe(false);
      for (const player of roomA.state.players.values()) {
        expect(player.score).toBe(0);
        expect(player.correctCount).toBe(0);
        expect(player.streak).toBe(0);
        expect(player.ready).toBe(false);
      }
    },
    70000,
  );

  it('faz GAME_RESULT değilken match:rematch gönderilirse E_WRONG_PHASE alır', async () => {
    const roomA = await colyseus.createRoom('game', { nickname: 'Furkan' });
    const clientA = await colyseus.connectTo(roomA, { nickname: 'Furkan' });
    await colyseus.connectTo(roomA, { nickname: 'Mehmet' });

    const errorP = clientA.waitForMessage('error');
    clientA.send('match:rematch', {});
    const error = await errorP;

    expect(error).toMatchObject({ code: 'E_WRONG_PHASE' });
    expect(roomA.state.phase).toBe('LOBBY');
  });
});
