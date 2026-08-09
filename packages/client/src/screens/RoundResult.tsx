import type { RoundPuzzleMessage, RoundResult as RoundResultMessage } from 'shared';
import { Card } from '../components/Card';
import { Timer } from '../components/Timer';
import { tr } from '../i18n/tr';
import type { PlayerView } from '../net/useRoomState';

interface RoundResultProps {
  round: number;
  totalRounds: number;
  phaseEndsAt: number | null;
  serverNow: () => number;
  players: PlayerView[];
  roundResult: RoundResultMessage | null;
  previousPuzzle: RoundPuzzleMessage | null;
}

// ROUND_RESULT fazının tek ekranı (bkz. docs/02-GAME_DESIGN.md §7.1). Geçiş
// otomatiktir: sunucu ROUND_RESULT_MS sonra fazı ilerletir, App.tsx state.phase'e
// göre bir sonraki ekrana yönlendirir — burada manuel bir "devam" aksiyonu yok.
export default function RoundResult({
  round,
  totalRounds,
  phaseEndsAt,
  serverNow,
  players,
  roundResult,
  previousPuzzle,
}: RoundResultProps) {
  if (!roundResult) {
    return (
      <div className="app-shell flex flex-col items-center justify-center gap-4 bg-slate-950 text-slate-100">
        <p className="text-sm text-slate-400">{tr.match.roundLabel(round, totalRounds)}</p>
        <Card className="text-center">
          <p className="text-lg text-slate-300">{tr.roundResult.waitingLabel}</p>
        </Card>
      </div>
    );
  }

  const nicknameFor = (playerId: string) => players.find((p) => p.id === playerId)?.nickname ?? '?';
  const correctChoice = previousPuzzle?.puzzle.choices.find((c) => c.id === roundResult.correctChoiceId);
  const entryByPlayerId = new Map(roundResult.entries.map((e) => [e.playerId, e]));

  return (
    <div className="app-shell flex flex-col items-center gap-4 bg-slate-950 text-slate-100">
      <div className="flex w-full max-w-md items-center justify-between text-sm text-slate-400">
        <span>{tr.match.roundLabel(round, totalRounds)}</span>
        <span className="text-2xl font-bold tabular-nums text-slate-100">
          <Timer endsAt={phaseEndsAt} serverNow={serverNow} />
        </span>
      </div>

      <Card>
        <p className="mb-1 text-sm text-slate-400">{tr.roundResult.correctAnswerLabel}</p>
        <p className="text-xl font-semibold text-emerald-400">{correctChoice?.label ?? roundResult.correctChoiceId}</p>
        {roundResult.explanation && <p className="mt-2 text-sm text-slate-400">{roundResult.explanation}</p>}
      </Card>

      <Card>
        <p className="mb-3 text-sm text-slate-400">{tr.roundResult.standingsTitle}</p>
        <ul className="space-y-2">
          {roundResult.standings.map((standing) => {
            const entry = entryByPlayerId.get(standing.playerId);
            return (
              <li
                key={standing.playerId}
                className="flex flex-col gap-1 rounded-lg border border-slate-800 bg-slate-800 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-medium">
                    <span className="text-slate-500">{standing.rank}.</span> {nicknameFor(standing.playerId)}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{tr.roundResult.totalLabel(standing.total)}</span>
                </div>
                {entry && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                    <span className={entry.correct ? 'text-emerald-400' : 'text-red-400'}>
                      {entry.correct ? `✓ ${tr.roundResult.correctBadge}` : `✗ ${tr.roundResult.wrongBadge}`}
                    </span>
                    <span>{entry.answerMs !== null ? tr.roundResult.answerTimeLabel(entry.answerMs) : tr.roundResult.noAnswer}</span>
                    <span className="font-semibold text-slate-300">{tr.roundResult.gainedLabel(entry.gained)}</span>
                    {entry.bonuses.map((bonus) => (
                      <span key={bonus} className="rounded bg-amber-400/20 px-1.5 py-0.5 font-semibold text-amber-300">
                        {tr.roundResult.bonusLabels[bonus]}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
