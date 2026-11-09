import type { CellState } from './nonogram';

const SOLVED_KEY = 'nonogram.solved.v1';
const PROGRESS_PREFIX = 'nonogram.progress.v1.';

export type Progress = {
  cells: CellState[];
  seconds: number;
};

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadSolved(): Set<string> {
  const ids = safeParse<string[]>(localStorage.getItem(SOLVED_KEY));
  return new Set(Array.isArray(ids) ? ids : []);
}

export function saveSolved(solved: Set<string>): void {
  localStorage.setItem(SOLVED_KEY, JSON.stringify([...solved]));
}

export function loadProgress(puzzleId: string): Progress | null {
  const data = safeParse<Progress>(
    localStorage.getItem(PROGRESS_PREFIX + puzzleId),
  );
  if (!data) return null;
  if (!Array.isArray(data.cells)) return null;
  return {
    cells: data.cells as CellState[],
    seconds: Number.isFinite(data.seconds) ? data.seconds : 0,
  };
}

export function saveProgress(
  puzzleId: string,
  cells: CellState[],
  seconds: number,
): void {
  localStorage.setItem(
    PROGRESS_PREFIX + puzzleId,
    JSON.stringify({ cells, seconds }),
  );
}

export function clearProgress(puzzleId: string): void {
  localStorage.removeItem(PROGRESS_PREFIX + puzzleId);
}
