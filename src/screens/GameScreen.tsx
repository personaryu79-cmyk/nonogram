import { useCallback, useEffect, useRef, useState } from 'react';
import Board, { type InputMode } from '../components/Board';
import type { Puzzle } from '../data/puzzles';
import {
  applyHint,
  createCells,
  formatTime,
  isSolved,
  sameCells,
  solveCells,
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
  const [hints, setHints] = useState(0);
  const [autoSolved, setAutoSolved] = useState(false);
  const [hintIndex, setHintIndex] = useState<number | null>(null);
  const [confirmSolve, setConfirmSolve] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    saveProgress(puzzle.id, cells, elapsed);
  }, [cells, elapsed, won, puzzle.id]);

  useEffect(() => {
    const flush = () => {
      const state = latest.current;
      if (!state.won) saveProgress(puzzle.id, state.cells, state.elapsed);
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [puzzle.id]);

  useEffect(() => {
    if (!won) return;
    clearProgress(puzzle.id);
    onSolved(puzzle.id);
  }, [won, puzzle.id, onSolved]);

  useEffect(() => {
    return () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
    };
  }, []);

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

  const showHint = () => {
    if (won) return;
    const result = applyHint(cells, puzzle);
    if (!result) return;
    setHistory((stack) => [...stack, cells]);
    setCells(result.cells);
    setStarted(true);
    setHints((value) => value + 1);
    setHintIndex(result.index);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHintIndex(null), 900);
  };

  const solveAll = () => {
    if (won) return;
    setConfirmSolve(false);
    setHistory((stack) => [...stack, cells]);
    setCells(solveCells(puzzle));
    setStarted(true);
    setAutoSolved(true);
    setHintIndex(null);
  };

  const reset = () => {
    setCells(createCells(puzzle.size));
    setHistory([]);
    setElapsed(0);
    setStarted(false);
    setHints(0);
    setAutoSolved(false);
    setHintIndex(null);
    setConfirmSolve(false);
    if (hintTimer.current) clearTimeout(hintTimer.current);
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
          highlightIndex={hintIndex}
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
            <button className="hint-btn" onClick={showHint} disabled={won}>
              힌트
            </button>
            <button onClick={() => setConfirmSolve(true)} disabled={won}>
              자동 풀이
            </button>
            <button onClick={reset}>처음부터</button>
          </div>
        </div>

        <p className="hint">
          드래그로 채우고, 같은 칸을 다시 누르면 지워집니다. 두 손가락으로
          확대·이동하고, 확대 후 '이동'을 켜면 한 손가락으로 옮길 수 있어요.
        </p>
      </main>

      {confirmSolve && !won ? (
        <div
          className="overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="auto-title"
        >
          <div className="win-card">
            <span className="win-badge">자동 풀이</span>
            <h2 id="auto-title">정답을 모두 채울까요?</h2>
            <p className="confirm-text">
              완료한 퍼즐로 저장되고 진행 기록은 사라집니다.
            </p>
            <div className="win-actions">
              <button className="primary" onClick={solveAll}>
                완성하기
              </button>
              <button onClick={() => setConfirmSolve(false)}>취소</button>
            </div>
          </div>
        </div>
      ) : null}

      {won ? (
        <div className="overlay">
          <div className="win-card">
            <span className="win-badge">
              {autoSolved ? '자동 풀이' : '완성'}
            </span>
            <h2>{autoSolved ? '퍼즐 완성' : '퍼즐 완성!'}</h2>
            <p className="win-time">{formatTime(elapsed)}</p>
            {autoSolved ? (
              <p className="win-meta">자동 풀이로 완성했습니다</p>
            ) : hints > 0 ? (
              <p className="win-meta">힌트 {hints}회 사용</p>
            ) : null}
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
