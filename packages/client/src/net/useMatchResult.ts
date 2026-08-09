import { useEffect, useState } from 'react';
import type { Room } from '@colyseus/sdk';
import type { MatchResult } from 'shared';

// round:result gibi state'te değil, ayrı bir mesajla gelir (bkz. net/useRoundResult.ts).
export function useMatchResult(room: Room | null): MatchResult | null {
  const [message, setMessage] = useState<MatchResult | null>(null);

  useEffect(() => {
    if (!room) return;
    setMessage(null);

    const unsub = room.onMessage('match:result', (msg: MatchResult) => {
      setMessage(msg);
    });

    return () => unsub();
  }, [room]);

  return message;
}
