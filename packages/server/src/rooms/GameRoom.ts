import { Room, Client } from 'colyseus';

export class GameRoom extends Room {
  onCreate(): void {
    console.log(`[GameRoom] oluşturuldu: ${this.roomId}`);
  }

  onJoin(client: Client): void {
    console.log(`[GameRoom] katıldı: ${client.sessionId}`);
  }

  onLeave(client: Client): void {
    console.log(`[GameRoom] ayrıldı: ${client.sessionId}`);
  }
}
