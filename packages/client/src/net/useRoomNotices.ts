import { useEffect, useState } from 'react';
import type { Room } from '@colyseus/sdk';
import { NOTICE_DISPLAY_MS, type RoomNoticeMessage } from 'shared';

export interface RoomNoticeToast extends RoomNoticeMessage {
  id: number;
}

let nextId = 0;

// room:notice mesajları (katıldı/ayrıldı/host değişti) kısa süreliğine toast
// olarak gösterilir, sonra kendiliğinden kaybolur.
export function useRoomNotices(room: Room | null): RoomNoticeToast[] {
  const [toasts, setToasts] = useState<RoomNoticeToast[]>([]);

  useEffect(() => {
    if (!room) return;

    const unsub = room.onMessage('room:notice', (msg: RoomNoticeMessage) => {
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
