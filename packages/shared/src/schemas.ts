// Client'tan gelen her mesaj zod ile doğrulanır. Kaynak: docs/04-NETWORK_PROTOCOL.md §5.1

import { z } from 'zod';

export const ErrorCodeSchema = z.enum([
  'E_ROOM_NOT_FOUND',
  'E_ROOM_FULL',
  'E_MATCH_STARTED',
  'E_NOT_HOST',
  'E_NOT_ENOUGH_PLAYERS',
  'E_WRONG_PHASE',
  'E_ALREADY_ANSWERED',
  'E_STALE_PUZZLE',
  'E_TIMING',
  'E_INVALID_NICKNAME',
  'E_RATE_LIMITED',
  'E_INVALID_PAYLOAD',
]);

export const NoticeCodeSchema = z.enum([
  'PLAYER_JOINED',
  'PLAYER_LEFT',
  'PLAYER_DISCONNECTED',
  'PLAYER_RECONNECTED',
  'HOST_CHANGED',
  'MATCH_ABORTED',
]);

// Şekil-only kontrol: anlamsal geçerlilik (trim/kırpma/boş-sonrası-trim) sanitizeNickname()'ın işi.
export const SetNicknameMessageSchema = z.object({ nickname: z.string().min(1).max(200) });
export const ReadyMessageSchema = z.object({ ready: z.boolean() });
export const MatchStartMessageSchema = z.object({});
export const RoundAnswerMessageSchema = z.object({
  puzzleId: z.string().min(1),
  choiceId: z.string().min(1),
  clientAnsweredAtServerMs: z.number(),
});
export const MatchRematchMessageSchema = z.object({});
export const NetPingMessageSchema = z.object({ t0: z.number() });

export const ClientMessageSchema = z.discriminatedUnion('type', [
  SetNicknameMessageSchema.extend({ type: z.literal('player:setNickname') }),
  ReadyMessageSchema.extend({ type: z.literal('player:ready') }),
  MatchStartMessageSchema.extend({ type: z.literal('match:start') }),
  RoundAnswerMessageSchema.extend({ type: z.literal('round:answer') }),
  MatchRematchMessageSchema.extend({ type: z.literal('match:rematch') }),
  NetPingMessageSchema.extend({ type: z.literal('net:ping') }),
]);

// WS ClientMessage değil, POST /rooms/join-by-code için istek gövdesi.
export const JoinByCodeRequestSchema = z.object({
  roomCode: z.string().min(1).max(10),
  nickname: z.string().min(1).max(200),
});
