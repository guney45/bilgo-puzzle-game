import { Room, Client, ServerError, matchMaker, ErrorCode as ColyseusErrorCode } from 'colyseus';
import {
  MAX_PLAYERS,
  NICKNAME_MAX,
  ROUNDS_PER_MATCH,
  ROOM_CODE_LENGTH,
  generateRoomCode,
  sanitizeNickname,
  SetNicknameMessageSchema,
  type PublicConfig,
  type RoomWelcomeMessage,
  type ErrorMessage,
} from 'shared';
import { GameState, PlayerSchema } from './state';

export interface RoomMetadata {
  roomCode: string;
}

interface JoinOptions {
  nickname?: unknown;
}

const PUBLIC_CONFIG: PublicConfig = { maxPlayers: MAX_PLAYERS, nicknameMax: NICKNAME_MAX };

export class GameRoom extends Room<{ state: GameState; metadata: RoomMetadata }> {
  private nextJoinIndex = 0;

  async onCreate(): Promise<void> {
    this.maxClients = MAX_PLAYERS;
    this.state = new GameState();
    this.state.totalRounds = ROUNDS_PER_MATCH;

    const roomCode = await this.generateUniqueRoomCode();
    this.state.roomCode = roomCode;
    await this.setMatchmaking({ metadata: { roomCode }, private: true });

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

    console.log(`[GameRoom] oluşturuldu: ${this.roomId} kod=${roomCode}`);
  }

  onJoin(client: Client, options: JoinOptions): void {
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

    if (!this.state.hostId) this.state.hostId = client.sessionId;
    this.state.players.set(client.sessionId, player);

    const welcome: RoomWelcomeMessage = {
      roomCode: this.state.roomCode,
      youId: client.sessionId,
      hostId: this.state.hostId,
      config: PUBLIC_CONFIG,
    };
    client.send('room:welcome', welcome);

    console.log(`[GameRoom] katıldı: ${client.sessionId} (${nickname}) oda=${this.roomId}`);
  }

  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
    console.log(`[GameRoom] ayrıldı: ${client.sessionId} oda=${this.roomId}`);
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
