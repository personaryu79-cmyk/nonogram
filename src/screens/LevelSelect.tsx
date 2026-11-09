import { useMemo } from 'react';
import type { Puzzle } from '../data/puzzles';

type LevelSelectProps = {
  puzzles: Puzzle[];
  solved: Set<string>;
  onPlay: (puzzle: Puzzle) => void;
};

export default function LevelSelect({
  puzzles,
  solved,
  onPlay,
}: LevelSelectProps) {
  const groups = useMemo(() => {
    const sizes = [...new Set(puzzles.map((puzzle) => puzzle.size))].sort(
      (a, b) => a - b,
    );
    return sizes.map((size) => ({
      size,
      items: puzzles.filter((puzzle) => puzzle.size === size),
    }));
  }, [puzzles]);

  const total = puzzles.length;
  const solvedCount = puzzles.filter((puzzle) => solved.has(puzzle.id)).length;
  const percent = total === 0 ? 0 : Math.round((solvedCount / total) * 100);

  return (
    <div className="level-screen">
      <header className="level-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <div>
            <h1>네모네모로직</h1>
            <p>숫자 단서만 보고 그림을 완성하세요</p>
          </div>
        </div>

        <div className="progress-summary">
          <div className="progress-bar">
            <span style={{ width: `${percent}%` }} />
          </div>
          <span className="progress-text">
            {solvedCount} / {total} 완료
          </span>
        </div>
      </header>

      <main className="level-main">
        {groups.map((group) => {
          const groupSolved = group.items.filter((puzzle) =>
            solved.has(puzzle.id),
          ).length;
          return (
            <section key={group.size} className="level-section">
              <div className="section-head">
                <h2>
                  {group.size} × {group.size}
                </h2>
                <span>
                  {groupSolved} / {group.items.length}
                </span>
              </div>

              <div className="level-grid">
                {group.items.map((puzzle, index) => {
                  const isSolved = solved.has(puzzle.id);
                  return (
                    <button
                      key={puzzle.id}
                      className={`level-card${isSolved ? ' done' : ''}`}
                      onClick={() => onPlay(puzzle)}
                    >
                      <span className="level-index">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="level-label">
                        {isSolved ? '완료' : '도전'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>

      <footer className="level-footer">
        진행 상황은 이 기기에 자동 저장됩니다.
      </footer>
    </div>
  );
}
