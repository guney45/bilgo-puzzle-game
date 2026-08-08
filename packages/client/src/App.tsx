import { useEffect, useState } from 'react';
import { connectToGameRoom } from './net/colyseus';

type ConnectionStatus = 'connecting' | 'connected' | 'error';

export default function App() {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');

  useEffect(() => {
    let cancelled = false;

    connectToGameRoom()
      .then((room) => {
        if (cancelled) return;
        setStatus('connected');
        console.log('[colyseus] bağlandı, oda id:', room.roomId);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus('error');
        console.error('[colyseus] bağlantı hatası:', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const statusText: Record<ConnectionStatus, string> = {
    connecting: 'Sunucuya bağlanılıyor…',
    connected: 'Sunucuya bağlandı ✅',
    error: 'Bağlantı hatası ❌',
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-950 p-4 text-slate-100">
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-xl">
        <h1 className="mb-2 text-2xl font-semibold">Puzzle Race</h1>
        <p data-testid="connection-status" className="text-slate-300">
          {statusText[status]}
        </p>
      </div>
    </div>
  );
}
