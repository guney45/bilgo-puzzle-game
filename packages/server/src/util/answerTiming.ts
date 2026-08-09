// Cevap süresi gecikme telafisi. Kaynak: docs/03-ARCHITECTURE.md §7.3. Colyseus'suz
// saf fonksiyon — RTT/zaman girdileri GameRoom'da hesaplanır, clamp burada yapılır.

import { TIMING_TOLERANCE_MS } from 'shared';

export interface ComputeAnswerMsInput {
  /** client'ın kendi ölçtüğü süre: clientAnsweredAtServerMs - revealAt */
  clientClaimedMs: number;
  /** sunucunun ölçtüğü süre: receivedAt - revealAt */
  serverMeasuredMs: number;
  /** client için tahmini RTT/2 (örnek yoksa 0) */
  halfRttMs: number;
}

export function computeAnswerMs({ clientClaimedMs, serverMeasuredMs, halfRttMs }: ComputeAnswerMsInput): number {
  const lowerBound = serverMeasuredMs - halfRttMs - TIMING_TOLERANCE_MS;
  return Math.min(Math.max(clientClaimedMs, lowerBound), serverMeasuredMs);
}
