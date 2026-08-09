import { useEffect, useState } from 'react';
import type { Room } from '@colyseus/sdk';
import { NICKNAME_MAX, sanitizeNickname, normalizeRoomCode } from 'shared';
import { createRoom, joinRoomByCode, AppError } from '../net/colyseus';
import { tr, errorMessage } from '../i18n/tr';
import { Button } from '../components/Button';
import { Card } from '../components/Card';

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
    <div className="app-shell flex items-center justify-center bg-slate-950 text-slate-100">
      <Card>
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

        <Button onClick={handleCreate} disabled={!canSubmit} className="mb-4">
          {busy === 'create' ? '…' : tr.home.createButton}
        </Button>

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

        <Button variant="secondary" onClick={handleJoin} disabled={!canSubmit || roomCode.length < 5}>
          {busy === 'join' ? '…' : tr.home.joinButton}
        </Button>

        {error && <p className="mt-4 text-center text-sm text-red-400">{error}</p>}
      </Card>
    </div>
  );
}
