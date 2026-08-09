import { useState } from 'react';
import type { Room } from '@colyseus/sdk';
import Home from './screens/Home';
import Lobby from './screens/Lobby';
import Countdown from './screens/Countdown';
import Puzzle from './screens/Puzzle';
import RoundResult from './screens/RoundResult';
import GameResult from './screens/GameResult';
import { useRoomState } from './net/useRoomState';
import { useServerNow } from './net/clockSync';
import { useRoundPuzzle } from './net/useRoundPuzzle';
import { useRoundResult } from './net/useRoundResult';
import { useMatchResult } from './net/useMatchResult';

function GameScreens({ room }: { room: Room }) {
  const state = useRoomState(room);
  const serverNow = useServerNow(room);
  const roundPuzzle = useRoundPuzzle(room);
  const roundResult = useRoundResult(room);
  const matchResult = useMatchResult(room);

  if (!state) {
    return (
      <div className="app-shell flex items-center justify-center bg-slate-950 text-slate-100">
        <p className="text-slate-400">Bağlanılıyor…</p>
      </div>
    );
  }

  if (state.phase === 'LOBBY') return <Lobby room={room} />;
  if (state.phase === 'COUNTDOWN') return <Countdown phaseEndsAt={state.phaseEndsAt!} serverNow={serverNow} />;

  if (state.phase === 'REVEAL' || state.phase === 'PLAYING' || state.phase === 'LOCKED') {
    return (
      <Puzzle
        room={room}
        phase={state.phase}
        round={state.round}
        totalRounds={state.totalRounds}
        phaseEndsAt={state.phaseEndsAt}
        serverNow={serverNow}
        roundPuzzle={roundPuzzle}
        players={state.players}
      />
    );
  }

  if (state.phase === 'ROUND_RESULT') {
    return (
      <RoundResult
        round={state.round}
        totalRounds={state.totalRounds}
        phaseEndsAt={state.phaseEndsAt}
        serverNow={serverNow}
        players={state.players}
        roundResult={roundResult}
        previousPuzzle={roundPuzzle}
      />
    );
  }

  return <GameResult room={room} players={state.players} matchResult={matchResult} />;
}

export default function App() {
  const [room, setRoom] = useState<Room | null>(null);

  if (room) return <GameScreens room={room} />;
  return <Home onRoomReady={setRoom} />;
}
