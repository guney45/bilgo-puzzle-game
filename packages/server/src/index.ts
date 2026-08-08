import { defineServer, defineRoom } from 'colyseus';
import { GameRoom } from './rooms/GameRoom';

const PORT = Number(process.env.PORT) || 2567;

const server = defineServer({
  rooms: {
    game: defineRoom(GameRoom),
  },
  express: (app) => {
    app.get('/health', (_req, res) => {
      res.json({ status: 'ok' });
    });
  },
});

server.listen(PORT);
console.log(`[server] dinleniyor: http://localhost:${PORT}`);
