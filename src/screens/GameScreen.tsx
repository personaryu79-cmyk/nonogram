import { useCallback, useEffect, useRef, useState } from 'react';
import Board, { type InputMode } from '../components/Board';
import type { Puzzle } from '../data/puzzles';
import {
  createCells,
  formatTime,
  isSolved,
  sameCells,
  type CellState,
} from '../game/nonogram';
import { clearProgress, loadProgress, saveProgress } from '../game/storage';

type GameScreenProps = {
  puzzle: Puzzle;
  nextPuzzle: Puzzle | null;
  onExit: () => void;
  onSolved: (id: string) => void;
  onNext: (puzzle: Puzzle) => void;
};

export default function GameScreen({
  puzzle,
  nextPuzzle,
  onExit,
  onSolved,
  onNext,
}: GameScreenProps) {
  const [initialProgress] = useState(() => loadProgress(puzzle.id));
  const [cells, setCells] = useState<CellState[]>(() => {
    if (
      initialProgress &&
      initialProgress.cells.length === puzzle.size * puzzle.size
    ) {
      return initialProgress.cells;
    }
    return createCells(puzzle.size);
  });
  const [elapsed, setElapsed] = useState(initialProgress?.seconds ?? 0);
  const [started, setStarted] = useState(
    (initialProgress?.seconds ?? 0) > 0,
  );
  const [mode, setMode] = useState<InputMode>('fill');
  const [history, setHistory] = useState<CellState[][]>([]);

  const won = isSolved(cells, puzzle);

  const latest = useRef({ cells, elapsed, won });

  useEffect(() => {
    latest.current = { cells, elapsed, won };
  }, [cells, elapsed, won]);

  useEffect(() => {
    if (!started || won) return;
    const timer = setInterval(() => {
      setElapsed((value) => value + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [started, won]);

  useEffect(() => {
    if (won) return;
    const timer = setTimeout(() => {
      saveProgress(puzzle.id, cells, elapsed);
    }, 400);
    return () => clearTimeout(timer);
  }, [cells, elapsed, won, puzzle.id]);

  useEffect(() => {
    return () => {
      const state = latest.current;
      if (!state.won) {
        saveProgress(puzzle.id, state.cells, state.elapsed);
      }
    };
  }, [puzzle.id]);

  useEffect(() => {
    if (!won) return;
    clearProgress(puzzle.id);
    onSolved(puzzle.id);
  }, [won, puzzle.id, onSolved]);

  const handleStrokeStart = useCallback(() => {
    setStarted(true);
  }, []);

  const handleStrokeEnd = useCallback(
    (base: CellState[], current: CellState[]) => {
      if (!sameCells(base, current)) {
        setHistory((stack) => [...stack, base]);
      }
    },
    [],
  );

  const undo = () => {
    if (history.length === 0) return;
    const base = history[history.length - 1];
    setHistory((stack) => stack.slice(0, -1));
    setCells(base);
  };

  const reset = () => {
    setCells(createCells(puzzle.size));
    setHistory([]);
    setElapsed(0);
    setStarted(false);
    clearProgress(puzzle.id);
  };

  const number = puzzle.id.split('-')[1] ?? '1';

  return (
    <div className="game-screen">
      <header className="game-header">
        <button className="ghost-btn" onClick={onExit}>
          ‹ 목록
        </button>
        <div className="game-title">
          <span>{puzzle.size} × {puzzle.size}</span>
          <span className="puzzle-no">#{number}</span>
        </div>
        <div className="timer">{formatTime(elapsed)}</div>
      </header>

      <main className="game-main">
        <Board
          size={puzzle.size}
          solution={puzzle.solution}
          cells={cells}
          mode={mode}
          disabled={won}
          onStrokeStart={handleStrokeStart}
          onCells={setCells}
          onStrokeEnd={handleStrokeEnd}
        />

        <div className="toolbar">
          <div className="mode-group" role="group" aria-label="입력 모드">
            <button
              className={mode === 'fill' ? 'active' : ''}
              aria-pressed={mode === 'fill'}
              onClick={() => setMode('fill')}
            >
              채우기
            </button>
            <button
              className={mode === 'mark' ? 'active' : ''}
              aria-pressed={mode === 'mark'}
              onClick={() => setMode('mark')}
            >
              표시 ×
            </button>
          </div>

          <div className="action-group">
            <button onClick={undo} disabled={history.length === 0}>
              되돌리기
            </button>
            <button onClick={reset}>처음부터</button>
          </div>
        </div>

        <p className="hint">
          모드를 고른 뒤 칸을 드래그해서 채우세요. 같은 칸을 다시 누르면 지워집니다.
        </p>
      </main>

      {won ? (
        <div className="overlay">
          <div className="win-card">
            <span className="win-badge">완성</span>
            <h2>퍼즐 완성!</h2>
            <p className="win-time">{formatTime(elapsed)}</p>
            <div className="win-actions">
              {nextPuzzle ? (
                <button className="primary" onClick={() => onNext(nextPuzzle)}>
                  다음 퍼즐
                </button>
              ) : null}
              <button onClick={onExit}>목록으로</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
