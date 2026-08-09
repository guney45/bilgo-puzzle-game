import type { Room } from '@colyseus/sdk';
import type { MatchResult } from 'shared';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { tr } from '../i18n/tr';
import type { PlayerView } from '../net/useRoomState';

interface GameResultProps {
  room: Room;
  players: PlayerView[];
  matchResult: MatchResult | null;
}

// GAME_RESULT fazının tek ekranı (bkz. docs/02-GAME_DESIGN.md §7.1). Faz süresizdir;
// tek çıkış yolu TEKRAR OYNA — sunucu match:rematch ile LOBBY'ye döner (herhangi bir
// oyuncu gönderebilir, bkz. docs/DECISIONS.md ADR-014).
export default function GameResult({ room, players, matchResult }: GameResultProps) {
  if (!matchResult) {
    return (
      <div className="app-shell flex flex-col items-center justify-center gap-4 bg-slate-950 text-slate-100">
        <Card className="text-center">
          <p className="text-lg text-slate-300">{tr.gameResult.waitingLabel}</p>
        </Card>
      </div>
    );
  }

  const nicknameFor = (playerId: string) => players.find((p) => p.id === playerId)?.nickname ?? '?';
  const podium = matchResult.standings.slice(0, 3);
  const rest = matchResult.standings.slice(3);
  const { fastestCorrect, mostCorrect, longestStreak } = matchResult.stats;
  const hasStats = Boolean(fastestCorrect || mostCorrect || longestStreak);

  function handleRematch() {
    room.send('match:rematch', {});
  }

  return (
    <div className="app-shell flex flex-col items-center gap-4 bg-slate-950 text-slate-100">
      <h1 className="mt-2 text-2xl font-bold">{tr.gameResult.title}</h1>

      <Card>
        <p className="mb-3 text-sm text-slate-400">{tr.gameResult.standingsTitle}</p>
        <ul className="space-y-2">
          {podium.map((standing) => (
            <li
              key={standing.playerId}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-800 px-4 py-3"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span aria-hidden className="text-xl">
                  {tr.gameResult.podiumMedal[standing.rank] ?? `${standing.rank}.`}
                </span>
                <span className="truncate font-medium">{nicknameFor(standing.playerId)}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{tr.gameResult.totalLabel(standing.total)}</span>
            </li>
          ))}
        </ul>
        {rest.length > 0 && (
          <ul className="mt-2 space-y-1">
            {rest.map((standing) => (
              <li
                key={standing.playerId}
                className="flex items-center justify-between gap-3 rounded-lg px-4 py-2 text-sm text-slate-400"
              >
                <span className="min-w-0 truncate">
                  <span className="text-slate-500">{standing.rank}.</span> {nicknameFor(standing.playerId)}
                </span>
                <span className="shrink-0 tabular-nums">{tr.gameResult.totalLabel(standing.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <p className="mb-3 text-sm text-slate-400">{tr.gameResult.statsTitle}</p>
        {hasStats ? (
          <ul className="space-y-2 text-sm text-slate-200">
            {fastestCorrect && (
              <li>{tr.gameResult.fastestCorrectLabel(nicknameFor(fastestCorrect.playerId), fastestCorrect.answerMs, fastestCorrect.round)}</li>
            )}
            {mostCorrect && <li>{tr.gameResult.mostCorrectLabel(nicknameFor(mostCorrect.playerId), mostCorrect.count)}</li>}
            {longestStreak && <li>{tr.gameResult.longestStreakLabel(nicknameFor(longestStreak.playerId), longestStreak.streak)}</li>}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">{tr.gameResult.noStats}</p>
        )}
      </Card>

      <div className="w-full max-w-sm pb-2">
        <Button onClick={handleRematch}>{tr.gameResult.rematchButton}</Button>
      </div>
    </div>
  );
}
