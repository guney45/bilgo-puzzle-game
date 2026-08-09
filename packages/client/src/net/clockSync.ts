import { useCallback, useEffect, useRef } from 'react';
import type { Room } from '@colyseus/sdk';
import type { NetPongMessage } from 'shared';

// bkz. docs/03-ARCHITECTURE.md §7.1
const INITIAL_SAMPLE_COUNT = 5;
const RESYNC_INTERVAL_MS = 30000;

interface Sample {
  rtt: number;
  offset: number;
}

// Sunucunun RTT tahmini (bkz. docs/DECISIONS.md ADR-010), pong alındıktan hemen
// sonra bir sonraki ping'in atılmasına dayanıyor — bu yüzden ilk 5 örnek burada
// bir zamanlayıcıyla değil, pong yanıtı geldikçe art arda gönderiliyor.
class ClockSync {
  private samples: Sample[] = [];
  private offset = 0;
  private initialSamplesReceived = 0;
  private resyncTimer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;
  private unsubscribe: () => void;

  constructor(private room: Room) {
    this.unsubscribe = room.onMessage('net:pong', (msg: NetPongMessage) => this.handlePong(msg));
    this.sendPing();
  }

  private sendPing(): void {
    if (this.disposed) return;
    this.room.send('net:ping', { t0: Date.now() });
  }

  private handlePong(msg: NetPongMessage): void {
    const now = Date.now();
    const rtt = Math.max(0, now - msg.t0);
    const offset = msg.tServer + rtt / 2 - now;

    this.samples.push({ rtt, offset });
    if (this.samples.length > INITIAL_SAMPLE_COUNT) this.samples.shift();
    this.offset = this.samples.reduce((best, s) => (s.rtt < best.rtt ? s : best)).offset;

    this.initialSamplesReceived += 1;
    if (this.initialSamplesReceived < INITIAL_SAMPLE_COUNT) {
      this.sendPing();
    } else if (!this.resyncTimer) {
      this.resyncTimer = setInterval(() => this.sendPing(), RESYNC_INTERVAL_MS);
    }
  }

  serverNow(): number {
    return Date.now() + this.offset;
  }

  dispose(): void {
    this.disposed = true;
    if (this.resyncTimer) clearInterval(this.resyncTimer);
    this.unsubscribe();
  }
}

/** Odaya bağlıyken sunucu saatiyle senkron `serverNow()` fonksiyonunu döner.
 * Dönen fonksiyon referansı sabittir (Timer gibi bileşenlere prop olarak
 * verilebilir); oda değişirse/bağlantı kesilirse içeride yeni bir ClockSync kurulur. */
export function useServerNow(room: Room | null): () => number {
  const clockRef = useRef<ClockSync | null>(null);

  useEffect(() => {
    if (!room) return;
    const clock = new ClockSync(room);
    clockRef.current = clock;
    return () => {
      clock.dispose();
      clockRef.current = null;
    };
  }, [room]);

  return useCallback(() => clockRef.current?.serverNow() ?? Date.now(), []);
}
