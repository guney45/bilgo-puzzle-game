import express from 'express';
import { defineServer, defineRoom } from 'colyseus';
import { DEFAULT_SERVER_PORT } from 'shared';
import { GameRoom } from './rooms/GameRoom';
import { joinByCodeHandler } from './http/joinByCode';

const PORT = Number(process.env.PORT) || DEFAULT_SERVER_PORT;

const server = defineServer({
  rooms: {
    game: defineRoom(GameRoom).filterBy(['roomCode']),
  },
  express: (app) => {
    app.get('/health', (_req, res) => {
      res.json({ status: 'ok' });
    });

    // Colyseus, ham HTTP sunucusu seviyesinde tüm route'lara (bu route dahil)
    // izin verici, origin'i yansıtan CORS başlıkları ekliyor (bkz. router/index.ts
    // "handle cors headers for all requests by default") — kendi CORS kodumuza
    // gerek yok. Gerçek origin kısıtlaması (WS origin beyaz listesi) Faz 8 kapsamı,
    // bkz. docs/05-ROADMAP.md.
    app.use('/rooms', express.json());
    app.post('/rooms/join-by-code', joinByCodeHandler);
  },
});

server.listen(PORT);
console.log(`[server] dinleniyor: http://localhost:${PORT}`);
