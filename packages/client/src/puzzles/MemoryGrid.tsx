import { useEffect, useState } from 'react';
import { MEMORY_DISPLAY_MS } from 'shared';
import { Button } from '../components/Button';
import { tr } from '../i18n/tr';
import type { PuzzleRendererProps } from './registry';

// server/src/puzzles/memory.ts'in MemoryPuzzleData/MemoryItem tiplerinin client
// tarafı kopyası. ClientPuzzle.data kasıtlı olarak `unknown` (bkz.
// shared/src/puzzle.ts) — puzzle sistemi tipe özel veri sözleşmesini paylaşılan
// pakete koymuyor, her renderer kendi yerel tipini tanımlayıp cast ediyor.
type MemoryShape = 'circle' | 'square' | 'triangle' | 'star' | 'diamond' | 'cross';

interface MemoryItem {
  shape: MemoryShape;
  colorName: string;
  hex: string;
  label: string;
}

interface MemoryPuzzleData {
  cells: (MemoryItem | null)[];
}

function ShapeIcon({ shape, hex }: { shape: MemoryShape; hex: string }) {
  const common = { fill: hex, stroke: '#0f172a', strokeWidth: 1 };
  if (shape === 'circle') return <circle cx="12" cy="12" r="9" {...common} />;
  if (shape === 'square') return <rect x="4" y="4" width="16" height="16" rx="2" {...common} />;
  if (shape === 'triangle') return <polygon points="12,3 21,20 3,20" {...common} />;
  if (shape === 'star')
    return (
      <polygon points="12,2 14.9,9.1 22.5,9.5 16.5,14.3 18.6,21.5 12,17.3 5.4,21.5 7.5,14.3 1.5,9.5 9.1,9.1" {...common} />
    );
  if (shape === 'diamond') return <polygon points="12,2 22,12 12,22 2,12" {...common} />;
  return <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3z" {...common} />; // cross
}

// GDD §3.3: gösterim süresi sunucu zamanlı olmalı. Bu bileşen yalnızca tur
// "revealed" olduktan sonra mount edilir (bkz. screens/Puzzle.tsx: Renderer,
// serverNow() >= revealAt oluncaya kadar hiç render edilmiyor), yani mount anı
// ≈ gerçek revealAt. Burada ölçülen şey bir MUTLAK zaman değil bir SÜRE
// (mount'tan bu yana geçen ms) olduğu için client-server saat farkı matematiksel
// olarak iptal olur; PuzzleRendererProps'a serverNow eklemeden (bu da 3-dosya
// kuralının dışına, screens/Puzzle.tsx'e taşardı) aynı "setInterval yok,
// zaman damgasından yeniden hesapla" ilkesine uyulmuş olur. Ayrıntı: docs/DECISIONS.md ADR-018.
function useMemorizing(): boolean {
  const [memorizing, setMemorizing] = useState(true);

  useEffect(() => {
    const mountedAt = Date.now();
    let frame: number;
    const tick = () => {
      if (Date.now() - mountedAt >= MEMORY_DISPLAY_MS) {
        setMemorizing(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return memorizing;
}

export default function MemoryGrid({ puzzle, selectedChoiceId, disabled, onAnswer }: PuzzleRendererProps) {
  const memorizing = useMemorizing();
  const data = puzzle.data as MemoryPuzzleData;
  const locked = disabled || selectedChoiceId !== null;

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-4">
      <div className="grid grid-cols-3 gap-2" style={{ width: 'min(72vw, 288px)' }}>
        {data.cells.map((cell, i) => (
          <div
            key={i}
            className="flex aspect-square items-center justify-center rounded-lg border border-slate-700 bg-slate-800"
          >
            {memorizing && cell && (
              <svg viewBox="0 0 24 24" className="h-3/5 w-3/5">
                <ShapeIcon shape={cell.shape} hex={cell.hex} />
              </svg>
            )}
          </div>
        ))}
      </div>

      <p className="text-sm text-slate-400" aria-live="polite">
        {memorizing ? tr.puzzle.memorizeHint : tr.puzzle.memorizeDone}
      </p>

      {!memorizing && (
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
          {puzzle.choices.map((choice) => {
            const isSelected = choice.id === selectedChoiceId;
            return (
              <Button
                key={choice.id}
                type="button"
                variant={isSelected ? 'primary' : 'secondary'}
                disabled={locked}
                onClick={() => onAnswer(choice.id)}
                className={`min-h-14 text-lg transition-opacity ${locked && !isSelected ? 'opacity-40' : ''}`}
              >
                {choice.label}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
