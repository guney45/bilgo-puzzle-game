import { useCallback, useRef, useSyncExternalStore } from 'react';
import { getStateCallbacks, type Room } from '@colyseus/sdk';

export interface PlayerView {
  id: string;
  nickname: string;
  connected: boolean;
  joinIndex: number;
}

export interface RoomStateView {
  roomCode: string;
  hostId: string;
  players: PlayerView[];
}

// consumeSeatReservation()/create() promise'i onJoin'de çözülüyor, ama ilk state
// patch'i (roomCode, players...) ağdan biraz sonra geliyor — o ana kadar
// room.state'in alanları undefined kalıyor. Bu yüzden snapshot burada null
// dönebilir; ekran state gelene kadar boş kalır, onAdd/listen tetiklenince
// otomatik yeniden render olur.
function computeSnapshot(room: Room): RoomStateView | null {
  const state = room.state as
    | {
        roomCode?: string;
        hostId?: string;
        players?: Map<string, PlayerView>;
      }
    | undefined;

  if (!state?.players) return null;

  return {
    roomCode: state.roomCode ?? '',
    hostId: state.hostId ?? '',
    players: Array.from(state.players.values()).map((p) => ({
      id: p.id,
      nickname: p.nickname,
      connected: p.connected,
      joinIndex: p.joinIndex,
    })),
  };
}

export function useRoomState(room: Room | null): RoomStateView | null {
  // useSyncExternalStore'un sözleşmesi: getSnapshot, gerçek bir değişiklik
  // olmadıkça her çağrıda AYNI referansı dönmeli. Her seferinde yeni bir
  // {..., players: [...]} nesnesi üretmek, listen()/onAdd()'ın immediate=true
  // davranışıyla birleşince sonsuz render döngüsüne yol açıyordu — bu yüzden
  // hesaplanan snapshot burada cache'leniyor, yalnızca gerçek değişiklikte
  // (notify çağrıldığında) yeniden hesaplanıyor.
  const cacheRef = useRef<{ room: Room | null; snapshot: RoomStateView | null }>({
    room: null,
    snapshot: null,
  });

  const getSnapshot = useCallback((): RoomStateView | null => {
    if (!room) return null;
    if (cacheRef.current.room !== room) {
      cacheRef.current = { room, snapshot: computeSnapshot(room) };
    }
    return cacheRef.current.snapshot;
  }, [room]);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!room) return () => {};

      const notify = () => {
        cacheRef.current = { room, snapshot: computeSnapshot(room) };
        onStoreChange();
      };

      const $ = getStateCallbacks(room);
      const unsubs: Array<() => void> = [];
      unsubs.push($(room.state).listen('roomCode', notify));
      unsubs.push($(room.state).listen('hostId', notify));
      const players = $(room.state).players!;
      unsubs.push(
        players.onAdd((player: unknown) => {
          notify();
          unsubs.push($(player as object).onChange(notify));
        }),
      );
      unsubs.push(players.onRemove(notify));

      return () => unsubs.forEach((unsub) => unsub());
    },
    [room],
  );

  return useSyncExternalStore(subscribe, getSnapshot);
}
