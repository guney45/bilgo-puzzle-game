import { useEffect, useState } from 'react';
import type { Room } from '@colyseus/sdk';
import { NOTICE_DISPLAY_MS, type ErrorMessage } from 'shared';

export interface RoomErrorToast extends ErrorMessage {
  id: number;
}

let nextId = 0;

// Sunucunun reddettiği işlemler (match:start vb.) `error` mesajıyla gelir
// (bkz. docs/04-NETWORK_PROTOCOL.md §2) ve kısa süreliğine toast olarak gösterilir.
export function useRoomError(room: Room | null): RoomErrorToast[] {
  const [toasts, setToasts] = useState<RoomErrorToast[]>([]);

  useEffect(() => {
    if (!room) return;

    const unsub = room.onMessage('error', (msg: ErrorMessage) => {
      const id = nextId++;
      setToasts((prev) => [...prev, { ...msg, id }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, NOTICE_DISPLAY_MS);
    });

    return () => unsub();
  }, [room]);

  return toasts;
}
