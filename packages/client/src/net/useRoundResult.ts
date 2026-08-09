import { useEffect, useState } from 'react';
import type { Room } from '@colyseus/sdk';
import type { RoundResult } from 'shared';

// round:puzzle gibi Colyseus state'inde değil, ayrı bir mesajla gelir (bkz.
// net/useRoundPuzzle.ts'teki gerekçe — hassas/turluk veri state dışında tutulur).
export function useRoundResult(room: Room | null): RoundResult | null {
  const [message, setMessage] = useState<RoundResult | null>(null);

  useEffect(() => {
    if (!room) return;
    setMessage(null);

    const unsub = room.onMessage('round:result', (msg: RoundResult) => {
      setMessage(msg);
    });

    return () => unsub();
  }, [room]);

  return message;
}
