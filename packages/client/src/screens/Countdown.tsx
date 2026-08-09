import { useRemainingMs } from '../components/Timer';

interface CountdownProps {
  phaseEndsAt: number;
  serverNow: () => number;
}

// COUNTDOWN fazı: tüm client'lar aynı sunucu zamanına göre 3-2-1 gösterir
// (bkz. docs/02-GAME_DESIGN.md §1).
export default function Countdown({ phaseEndsAt, serverNow }: CountdownProps) {
  const remainingMs = useRemainingMs(phaseEndsAt, serverNow);
  const seconds = Math.max(1, Math.ceil(remainingMs / 1000));

  return (
    <div className="app-shell flex items-center justify-center bg-slate-950 text-slate-100">
      <span className="text-9xl font-bold tabular-nums">{seconds}</span>
    </div>
  );
}
