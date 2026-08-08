import { Schema, type, MapSchema } from '@colyseus/schema';

export class PlayerSchema extends Schema {
  @type('string') id = '';
  @type('string') nickname = '';
  @type('boolean') connected = true;
  @type('boolean') ready = false;
  @type('number') score = 0;
  @type('number') correctCount = 0;
  @type('number') streak = 0;
  @type('boolean') hasAnswered = false;
  @type('number') joinIndex = 0;
}

export class GameState extends Schema {
  @type('string') phase = 'LOBBY';
  @type('number') phaseEndsAt = 0;
  @type('string') roomCode = '';
  @type('string') hostId = '';
  @type('number') round = 0;
  @type('number') totalRounds = 0;
  @type('number') answeredCount = 0;
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
  // lastRound: RoundResultSchema — Faz 5'te eklenecek (bkz. docs/03-ARCHITECTURE.md §6)
}
