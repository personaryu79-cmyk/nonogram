import type { Puzzle } from '../data/puzzles';

export type CellState = 0 | 1 | 2;

export const EMPTY: CellState = 0;
export const FILLED: CellState = 1;
export const MARKED: CellState = 2;

export type Clues = {
  rows: number[][];
  cols: number[][];
};

function lineClues(filled: boolean[]): number[] {
  const clues: number[] = [];
  let run = 0;
  for (const value of filled) {
    if (value) {
      run += 1;
    } else if (run > 0) {
      clues.push(run);
      run = 0;
    }
  }
  if (run > 0) clues.push(run);
  return clues;
}

export function computeClues(solution: string[]): Clues {
  const size = solution.length;
  const rows: number[][] = [];
  const cols: number[][] = [];

  for (let y = 0; y < size; y++) {
    rows.push(
      lineClues(
        Array.from(solution[y], (char) => char === '#'),
      ),
    );
  }

  for (let x = 0; x < size; x++) {
    const filled: boolean[] = [];
    for (let y = 0; y < size; y++) filled.push(solution[y][x] === '#');
    cols.push(lineClues(filled));
  }

  return { rows, cols };
}

export function createCells(size: number): CellState[] {
  return new Array<CellState>(size * size).fill(EMPTY);
}

export function isSolved(cells: CellState[], puzzle: Puzzle): boolean {
  const { size, solution } = puzzle;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const shouldFill = solution[y][x] === '#';
      const filled = cells[y * size + x] === FILLED;
      if (shouldFill !== filled) return false;
    }
  }
  return true;
}

export function sameCells(a: CellState[], b: CellState[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function countFilled(cells: CellState[]): number {
  let count = 0;
  for (const cell of cells) if (cell === FILLED) count += 1;
  return count;
}

export function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function nextPuzzleOf(puzzles: Puzzle[], current: Puzzle): Puzzle | null {
  const index = puzzles.findIndex((puzzle) => puzzle.id === current.id);
  if (index === -1) return null;
  const next = puzzles[index + 1];
  return next ?? null;
}
