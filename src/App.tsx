import { useCallback, useMemo, useState } from 'react';
import { PUZZLES } from './data/puzzles';
import { nextPuzzleOf } from './game/nonogram';
import { loadSolved, saveSolved } from './game/storage';
import GameScreen from './screens/GameScreen';
import LevelSelect from './screens/LevelSelect';

export default function App() {
  const [solved, setSolved] = useState<Set<string>>(() => loadSolved());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => PUZZLES.find((puzzle) => puzzle.id === selectedId) ?? null,
    [selectedId],
  );

  const nextPuzzle = useMemo(
    () => (selected ? nextPuzzleOf(PUZZLES, selected) : null),
    [selected],
  );

  const handleSolved = useCallback((id: string) => {
    setSolved((previous) => {
      if (previous.has(id)) return previous;
      const updated = new Set(previous);
      updated.add(id);
      saveSolved(updated);
      return updated;
    });
  }, []);

  if (selected) {
    return (
      <GameScreen
        key={selected.id}
        puzzle={selected}
        nextPuzzle={nextPuzzle}
        onExit={() => setSelectedId(null)}
        onSolved={handleSolved}
        onNext={(puzzle) => setSelectedId(puzzle.id)}
      />
    );
  }

  return (
    <LevelSelect
      puzzles={PUZZLES}
      solved={solved}
      onPlay={(puzzle) => setSelectedId(puzzle.id)}
    />
  );
}
