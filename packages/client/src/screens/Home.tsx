import { useEffect, useState } from 'react';
import type { Room } from '@colyseus/sdk';
import { NICKNAME_MAX, sanitizeNickname, normalizeRoomCode } from 'shared';
import { createRoom, joinRoomByCode, AppError } from '../net/colyseus';
import { tr, errorMessage } from '../i18n/tr';

interface HomeProps {
  onRoomReady: (room: Room) => void;
}

export default function Home({ onRoomReady }: HomeProps) {
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('r');
    if (fromUrl) setRoomCode(normalizeRoomCode(fromUrl));
  }, []);

  const canSubmit = sanitizeNickname(nickname) !== null && busy === null;

  async function handleCreate() {
    setError(null);
    setBusy('create');
    try {
      const room = await createRoom(nickname);
      onRoomReady(room);
    } catch (err) {
      setError(errorMessage(err instanceof AppError ? err.code : 'E_UNKNOWN'));
    } finally {
      setBusy(null);
    }
  }

  async function handleJoin() {
    setError(null);
    setBusy('join');
    try {
      const room = await joinRoomByCode(roomCode, nickname);
      onRoomReady(room);
    } catch (err) {
      setError(errorMessage(err instanceof AppError ? err.code : 'E_UNKNOWN'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-950 p-4 text-slate-100">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
        <h1 className="mb-6 text-center text-2xl font-semibold">{tr.home.title}</h1>

        <label className="mb-1 block text-sm text-slate-400" htmlFor="nickname">
          {tr.home.nicknameLabel}
        </label>
        <input
          id="nickname"
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={NICKNAME_MAX}
          placeholder={tr.home.nicknamePlaceholder}
          className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-base text-slate-100 outline-none focus:border-slate-500"
          style={{ touchAction: 'manipulation' }}
        />

        <button
          type="button"
          onClick={handleCreate}
          disabled={!canSubmit}
          className="mb-4 min-h-12 w-full rounded-lg bg-emerald-500 px-4 py-3 font-semibold text-slate-950 disabled:opacity-40"
          style={{ touchAction: 'manipulation' }}
        >
          {busy === 'create' ? '…' : tr.home.createButton}
        </button>

        <div className="mb-4 flex items-center gap-3 text-slate-600">
          <div className="h-px flex-1 bg-slate-800" />
          <span className="text-xs">veya</span>
          <div className="h-px flex-1 bg-slate-800" />
        </div>

        <label className="mb-1 block text-sm text-slate-400" htmlFor="roomCode">
          {tr.home.joinCodeLabel}
        </label>
        <input
          id="roomCode"
          type="text"
          value={roomCode}
          onChange={(e) => setRoomCode(normalizeRoomCode(e.target.value))}
          maxLength={6}
          placeholder={tr.home.joinCodePlaceholder}
          className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-base tracking-widest text-slate-100 uppercase outline-none focus:border-slate-500"
          style={{ touchAction: 'manipulation' }}
        />

        <button
          type="button"
          onClick={handleJoin}
          disabled={!canSubmit || roomCode.length < 5}
          className="min-h-12 w-full rounded-lg bg-slate-700 px-4 py-3 font-semibold text-slate-100 disabled:opacity-40"
          style={{ touchAction: 'manipulation' }}
        >
          {busy === 'join' ? '…' : tr.home.joinButton}
        </button>

        {error && <p className="mt-4 text-center text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
