import { useState } from 'react';
import type { Room } from '@colyseus/sdk';
import { MAX_PLAYERS, MIN_PLAYERS } from 'shared';
import { useRoomState } from '../net/useRoomState';
import { useRoomNotices } from '../net/useRoomNotices';
import { useRoomError } from '../net/useRoomError';
import { tr, noticeMessage, errorMessage } from '../i18n/tr';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { PlayerRow } from '../components/PlayerRow';
import { QrCode } from '../components/QrCode';

interface LobbyProps {
  room: Room;
}

export default function Lobby({ room }: LobbyProps) {
  const state = useRoomState(room);
  const notices = useRoomNotices(room);
  const errors = useRoomError(room);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  if (!state) {
    return (
      <div className="app-shell flex items-center justify-center bg-slate-950 text-slate-100">
        <p className="text-slate-400">Bağlanılıyor…</p>
      </div>
    );
  }

  const you = state.players.find((p) => p.id === room.sessionId);
  const isHost = state.hostId === room.sessionId;
  const hostNickname = state.players.find((p) => p.id === state.hostId)?.nickname ?? '';
  const inviteUrl = `${window.location.origin}/?r=${state.roomCode}`;
  const canShare = typeof navigator.share === 'function';
  const connectedCount = state.players.filter((p) => p.connected).length;
  const canStart = isHost && connectedCount >= MIN_PLAYERS;

  async function handleInvite() {
    if (canShare) {
      try {
        await navigator.share({ title: tr.home.title, url: inviteUrl });
      } catch {
        // Kullanıcı paylaşım sayfasını iptal etti — sessizce yok say.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyFeedback(tr.lobby.copiedFeedback);
    } catch {
      setCopyFeedback(tr.lobby.copyFailed);
    } finally {
      setTimeout(() => setCopyFeedback(null), 2000);
    }
  }

  function handleToggleReady() {
    room.send('player:ready', { ready: !you?.ready });
  }

  function handleStart() {
    room.send('match:start', {});
  }

  return (
    <div className="app-shell flex flex-col items-center gap-3 bg-slate-950 text-slate-100">
      <div className="pointer-events-none flex w-full max-w-sm flex-col items-center gap-2">
        {notices.map((notice) => (
          <div
            key={notice.id}
            className="w-full rounded-lg border border-slate-700 bg-slate-800/90 px-4 py-2 text-center text-sm text-slate-200 shadow"
          >
            {noticeMessage(notice.code, notice.nickname)}
          </div>
        ))}
        {errors.map((error) => (
          <div
            key={error.id}
            className="w-full rounded-lg border border-red-800 bg-red-950/90 px-4 py-2 text-center text-sm text-red-200 shadow"
          >
            {errorMessage(error.code)}
          </div>
        ))}
      </div>

      <div className="flex w-full flex-1 items-center justify-center">
        <Card>
          <p className="mb-1 text-center text-sm text-slate-400">{tr.lobby.codeLabel}</p>
          <p className="mb-4 text-center text-4xl font-bold tracking-[0.3em]">{state.roomCode}</p>

          <div className="mb-6 flex flex-col items-center gap-3">
            <QrCode value={inviteUrl} />
            <Button variant="ghost" onClick={handleInvite}>
              {canShare ? tr.lobby.shareButton : tr.lobby.copyButton}
            </Button>
            {copyFeedback && <p className="text-xs text-slate-400">{copyFeedback}</p>}
          </div>

          <p className="mb-2 text-sm text-slate-400">
            {tr.lobby.playersTitle} ({state.players.length}/{MAX_PLAYERS})
          </p>
          <ul className="mb-6 space-y-2">
            {state.players
              .slice()
              .sort((a, b) => a.joinIndex - b.joinIndex)
              .map((player) => (
                <PlayerRow
                  key={player.id}
                  nickname={player.nickname}
                  isHost={player.id === state.hostId}
                  isYou={player.id === room.sessionId}
                  ready={player.ready}
                  connected={player.connected}
                />
              ))}
          </ul>

          <Button variant={you?.ready ? 'secondary' : 'primary'} onClick={handleToggleReady} className="mb-3">
            {you?.ready ? tr.lobby.unreadyButton : tr.lobby.readyButton}
          </Button>

          {isHost ? (
            <>
              <Button
                onClick={handleStart}
                disabled={!canStart}
                title={canStart ? undefined : tr.lobby.notEnoughPlayersHint}
              >
                {tr.lobby.startButton}
              </Button>
              {!canStart && <p className="mt-2 text-center text-xs text-slate-500">{tr.lobby.notEnoughPlayersHint}</p>}
            </>
          ) : (
            <p className="text-center text-sm text-slate-500">{tr.lobby.waitingForHost(hostNickname)}</p>
          )}
        </Card>
      </div>
    </div>
  );
}
