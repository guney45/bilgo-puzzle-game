import { useEffect, useState } from 'react';
import type { Room } from '@colyseus/sdk';
import type { GamePhase, RoundPuzzleMessage } from 'shared';
import { Card } from '../components/Card';
import { Timer, useRemainingMs } from '../components/Timer';
import { getPuzzleRenderer } from '../puzzles/registry';
import { tr } from '../i18n/tr';
import type { PlayerView } from '../net/useRoomState';

interface PuzzleProps {
  room: Room;
  phase: GamePhase;
  round: number;
  totalRounds: number;
  phaseEndsAt: number | null;
  serverNow: () => number;
  roundPuzzle: RoundPuzzleMessage | null;
  players: PlayerView[];
}

// REVEAL/PLAYING/LOCKED fazlarının tek ekranı. Kaynak: docs/02-GAME_DESIGN.md §7.1,
// docs/03-ARCHITECTURE.md §7.2 (revealAt'a kadar gizle, serverNow() ile aç).
export default function Puzzle({ room, phase, round, totalRounds, phaseEndsAt, serverNow, roundPuzzle, players }: PuzzleProps) {
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);

  // Yeni tur gelince (puzzle id değişince) yerel seçim sıfırlanır.
  useEffect(() => {
    setSelectedChoiceId(null);
  }, [roundPuzzle?.puzzle.id]);

  const revealAt = roundPuzzle?.revealAt ?? null;
  const remainingUntilReveal = useRemainingMs(revealAt, serverNow);
  const revealed = roundPuzzle !== null && remainingUntilReveal <= 0;

  const you = players.find((p) => p.id === room.sessionId);

  function handleAnswer(choiceId: string) {
    if (!roundPuzzle || selectedChoiceId !== null) return;
    setSelectedChoiceId(choiceId);
    room.send('round:answer', {
      puzzleId: roundPuzzle.puzzle.id,
      choiceId,
      clientAnsweredAtServerMs: serverNow(),
    });
  }

  if (!roundPuzzle || !revealed) {
    return (
      <div className="app-shell flex flex-col items-center justify-center gap-4 bg-slate-950 text-slate-100">
        <p className="text-sm text-slate-400">{tr.match.roundLabel(round, totalRounds)}</p>
        <Card className="text-center">
          <p className="text-lg text-slate-300">{tr.puzzle.waitingLabel}</p>
        </Card>
      </div>
    );
  }

  const Renderer = getPuzzleRenderer(roundPuzzle.puzzle.type);

  return (
    <div className="app-shell flex flex-col items-center gap-6 bg-slate-950 text-slate-100">
      <div className="flex w-full max-w-md items-center justify-between text-sm text-slate-400">
        <span>{tr.match.roundLabel(round, totalRounds)}</span>
        <span className="text-2xl font-bold tabular-nums text-slate-100">
          <Timer endsAt={phaseEndsAt} serverNow={serverNow} />
        </span>
        <span>{tr.puzzle.miniScore(you?.score ?? 0)}</span>
      </div>

      <p className="max-w-md text-center text-xl font-medium text-balance">{roundPuzzle.puzzle.prompt}</p>

      <Renderer
        puzzle={roundPuzzle.puzzle}
        selectedChoiceId={selectedChoiceId}
        disabled={phase === 'LOCKED'}
        onAnswer={handleAnswer}
      />

      {phase === 'LOCKED' && <p className="text-sm text-slate-500">{tr.puzzle.lockedLabel}</p>}
    </div>
  );
}
