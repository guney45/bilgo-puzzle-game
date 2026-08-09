import { useEffect, useState } from 'react';

// setInterval ile eksiltme YOK (bkz. docs/03-ARCHITECTURE.md §7.4): kalan süre
// her requestAnimationFrame'de phaseEndsAt - serverNow() olarak yeniden hesaplanır.
// Arka plana atılan sekmede rAF durur, geri dönülünce doğru değere oturur.
export function useRemainingMs(endsAt: number | null, serverNow: () => number): number {
  const [remainingMs, setRemainingMs] = useState(() => (endsAt !== null ? Math.max(0, endsAt - serverNow()) : 0));

  useEffect(() => {
    if (endsAt === null) return;

    let frame: number;
    const tick = () => {
      setRemainingMs(Math.max(0, endsAt - serverNow()));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [endsAt, serverNow]);

  return endsAt !== null ? remainingMs : 0;
}

interface TimerProps {
  /** Fazın bittiği sunucu zamanı (epoch ms). null ise süresiz faz, gösterilmez. */
  endsAt: number | null;
  serverNow: () => number;
  className?: string;
}

export function Timer({ endsAt, serverNow, className }: TimerProps) {
  const remainingMs = useRemainingMs(endsAt, serverNow);
  if (endsAt === null) return null;

  const seconds = Math.ceil(remainingMs / 1000);
  return (
    <span className={className} aria-live="off">
      {seconds}
    </span>
  );
}
