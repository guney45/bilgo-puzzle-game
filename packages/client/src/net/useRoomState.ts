import { useCallback, useRef, useSyncExternalStore } from 'react';
import { getStateCallbacks, type Room } from '@colyseus/sdk';
import type { GamePhase } from 'shared';

export interface PlayerView {
  id: string;
  nickname: string;
  connected: boolean;
  ready: boolean;
  joinIndex: number;
  score: number;
}

export interface RoomStateView {
  roomCode: string;
  hostId: string;
  players: PlayerView[];
  phase: GamePhase;
  round: number;
  totalRounds: number;
  /** null = süresiz faz (LOBBY, GAME_RESULT) */
  phaseEndsAt: number | null;
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
        phase?: GamePhase;
        round?: number;
        totalRounds?: number;
        phaseEndsAt?: number;
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
      ready: p.ready,
      joinIndex: p.joinIndex,
      score: p.score,
    })),
    phase: state.phase ?? 'LOBBY',
    round: state.round ?? 0,
    totalRounds: state.totalRounds ?? 0,
    // Sunucu "süresiz" fazı 0 ile temsil eder (bkz. GameRoom.handlePhaseChange) —
    // client tarafında bunu null'a çevirip Timer/Countdown'ın anlayacağı hale getiriyoruz.
    phaseEndsAt: state.phaseEndsAt ? state.phaseEndsAt : null,
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
      unsubs.push($(room.state).listen('phase', notify));
      unsubs.push($(room.state).listen('round', notify));
      unsubs.push($(room.state).listen('totalRounds', notify));
      unsubs.push($(room.state).listen('phaseEndsAt', notify));
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
