import type { Room } from '@colyseus/sdk';
import { useRoomState } from '../net/useRoomState';
import { tr } from '../i18n/tr';

interface RoomViewProps {
  room: Room;
}

// Kasıtlı olarak minimal: hazır durumu, host yetkileri, davet linki, QR — Faz 2 kapsamı.
// Bu ekran yalnızca Faz 1'in kabul kriterini (oda kodu görünür, oyuncular birbirini görür)
// karşılıyor; Faz 2'de üzerine inşa edilecek.
export default function RoomView({ room }: RoomViewProps) {
  const state = useRoomState(room);

  // İlk state patch'i ağdan gelene kadar kısa bir an null kalır (bkz. useRoomState.ts).
  if (!state) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-950 p-4 text-slate-100">
        <p className="text-slate-400">Bağlanılıyor…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-950 p-4 text-slate-100">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
        <p className="mb-1 text-center text-sm text-slate-400">{tr.room.codeLabel}</p>
        <p className="mb-6 text-center text-4xl font-bold tracking-[0.3em]">{state.roomCode}</p>

        <p className="mb-2 text-sm text-slate-400">{tr.room.playersTitle}</p>
        <ul className="space-y-2">
          {state.players
            .slice()
            .sort((a, b) => a.joinIndex - b.joinIndex)
            .map((player) => (
              <li
                key={player.id}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800 px-4 py-3"
              >
                <span>{player.nickname}</span>
                {player.id === state.hostId && (
                  <span className="text-xs text-emerald-400">host</span>
                )}
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}
