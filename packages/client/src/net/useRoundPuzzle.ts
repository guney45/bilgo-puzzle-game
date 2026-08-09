import { useEffect, useState } from 'react';
import type { Room } from '@colyseus/sdk';
import type { RoundPuzzleMessage } from 'shared';

// Puzzle Colyseus state'inde değil, round:puzzle mesajıyla gelir (bkz.
// docs/03-ARCHITECTURE.md §6: hassas/turluk veri state dışında tutulur) — bu yüzden
// useRoomState'in dışında ayrı bir hook gerekli.
export function useRoundPuzzle(room: Room | null): RoundPuzzleMessage | null {
  const [message, setMessage] = useState<RoundPuzzleMessage | null>(null);

  useEffect(() => {
    if (!room) return;
    setMessage(null);

    const unsub = room.onMessage('round:puzzle', (msg: RoundPuzzleMessage) => {
      setMessage(msg);
    });

    return () => unsub();
  }, [room]);

  return message;
}
