import { Schema, type, MapSchema } from '@colyseus/schema';
import { NO_FASTEST_ANSWER_MS } from 'shared';

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
  // Beraberlik bozma karşılaştırıcısı için (bkz. docs/02-GAME_DESIGN.md §5.3,
  // shared/src/scoring.ts compareStandings). Yalnızca DOĞRU cevaplar sayılır.
  @type('number') totalAnswerMs = 0;
  @type('number') fastestAnswerMs = NO_FASTEST_ANSWER_MS;
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
