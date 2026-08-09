import { Button } from '../components/Button';
import type { PuzzleRendererProps } from './registry';

// GDD §4/§7.1: 4 büyük şık, tam genişlik, min 56px yükseklik, dokununca kilitlenir,
// diğerleri soluklaşır, doğru/yanlış gösterilmez (tur sonuna kadar).
export default function MultipleChoice({ puzzle, selectedChoiceId, disabled, onAnswer }: PuzzleRendererProps) {
  const locked = disabled || selectedChoiceId !== null;

  return (
    <div className="grid w-full max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
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
  );
}
