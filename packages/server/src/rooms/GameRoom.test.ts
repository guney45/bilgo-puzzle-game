import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { boot, type ColyseusTestServer } from '@colyseus/testing';
import { defineServer, defineRoom } from 'colyseus';
import express from 'express';
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
});
