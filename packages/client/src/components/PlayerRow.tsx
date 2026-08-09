import { tr } from '../i18n/tr';

interface PlayerRowProps {
  nickname: string;
  isHost: boolean;
  isYou: boolean;
  ready: boolean;
  connected: boolean;
}

// Renk körü güvenliği: durumlar her zaman ikon + metinle birlikte gösterilir,
// yalnızca renkle ayırt edilmez (bkz. docs/02-GAME_DESIGN.md §7.3).
export function PlayerRow({ nickname, isHost, isYou, ready, connected }: PlayerRowProps) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-800 px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${connected ? 'bg-emerald-400' : 'bg-slate-600'}`}
        />
        <span className="truncate">
          {nickname}
          {isYou && <span className="text-slate-500"> {tr.lobby.youSuffix}</span>}
        </span>
        {isHost && (
          <span className="shrink-0 rounded bg-amber-400/20 px-1.5 py-0.5 text-xs font-semibold text-amber-300">
            {tr.lobby.hostBadge}
          </span>
        )}
      </div>
      <span
        className={`shrink-0 text-xs font-semibold ${ready ? 'text-emerald-400' : 'text-slate-500'}`}
      >
        {ready ? `✓ ${tr.lobby.readyBadge}` : tr.lobby.notReadyBadge}
      </span>
    </li>
  );
}
