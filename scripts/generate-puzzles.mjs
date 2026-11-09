import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../src/data/puzzles.ts');

const COUNTS = { 5: 6, 10: 6, 15: 6 };
const MAX_ATTEMPTS = 200000;

function cluesOfLine(line) {
  const clues = [];
  let run = 0;
  for (const v of line) {
    if (v) run += 1;
    else if (run) {
      clues.push(run);
      run = 0;
    }
  }
  if (run) clues.push(run);
  return clues;
}

function buildClues(grid, n) {
  const rows = [];
  const cols = [];
  for (let y = 0; y < n; y++) {
    rows.push(cluesOfLine(Array.from(grid.subarray(y * n, y * n + n))));
  }
  for (let x = 0; x < n; x++) {
    const line = [];
    for (let y = 0; y < n; y++) line.push(grid[y * n + x]);
    cols.push(cluesOfLine(line));
  }
  return { rows, cols };
}

function lineOptions(clues, known, n) {
  const options = [];
  const line = new Int8Array(n);

  const rec = (block, pos) => {
    if (block === clues.length) {
      for (let i = pos; i < n; i++) {
        if (known[i] === 1) return;
        line[i] = 0;
      }
      options.push(Int8Array.from(line));
      return;
    }

    let remaining = 0;
    for (let b = block + 1; b < clues.length; b++) remaining += clues[b] + 1;
    const need = clues[block];
    const maxStart = n - remaining - need;

    for (let start = pos; start <= maxStart; start++) {
      let ok = true;
      for (let i = pos; i < start; i++) {
        line[i] = 0;
        if (known[i] === 1) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;

      for (let i = start; i < start + need; i++) {
        line[i] = 1;
        if (known[i] === 0) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;

      let next = start + need;
      if (block < clues.length - 1) {
        if (known[next] === 1) continue;
        line[next] = 0;
        next += 1;
      }
      rec(block + 1, next);
    }
  };

  rec(0, 0);
  return options;
}

function propagate(known, cluesRow, cluesCol, n) {
  let changed = true;
  while (changed) {
    changed = false;

    for (let i = 0; i < n; i++) {
      const rowKnown = known.subarray(i * n, i * n + n);
      const rowOptions = lineOptions(cluesRow[i], rowKnown, n);
      if (rowOptions.length === 0) return { contradiction: true, solved: false };
      if (rowOptions.length > 1) {
        for (let x = 0; x < n; x++) {
          let allOne = true;
          let allZero = true;
          for (const opt of rowOptions) {
            if (opt[x] === 1) allZero = false;
            else allOne = false;
            if (!allOne && !allZero) break;
          }
          const idx = i * n + x;
          if (known[idx] === -1 && allOne) {
            known[idx] = 1;
            changed = true;
          } else if (known[idx] === -1 && allZero) {
            known[idx] = 0;
            changed = true;
          }
        }
      } else {
        const opt = rowOptions[0];
        for (let x = 0; x < n; x++) {
          const idx = i * n + x;
          if (known[idx] === -1) {
            known[idx] = opt[x];
            changed = true;
          }
        }
      }
    }

    for (let x = 0; x < n; x++) {
      const colKnown = new Int8Array(n);
      for (let y = 0; y < n; y++) colKnown[y] = known[y * n + x];
      const colOptions = lineOptions(cluesCol[x], colKnown, n);
      if (colOptions.length === 0) return { contradiction: true, solved: false };
      for (let y = 0; y < n; y++) {
        let allOne = true;
        let allZero = true;
        for (const opt of colOptions) {
          if (opt[y] === 1) allZero = false;
          else allOne = false;
          if (!allOne && !allZero) break;
        }
        if (!allOne && !allZero) continue;
        const idx = y * n + x;
        if (known[idx] === -1) {
          known[idx] = allOne ? 1 : 0;
          changed = true;
        }
      }
    }
  }

  for (let i = 0; i < known.length; i++) {
    if (known[i] === -1) return { contradiction: false, solved: false };
  }
  return { contradiction: false, solved: true };
}

function isLineSolvable(grid, clues, n) {
  const known = new Int8Array(n * n).fill(-1);
  const result = propagate(known, clues.rows, clues.cols, n);
  if (!result.solved) return false;
  for (let i = 0; i < grid.length; i++) {
    if (known[i] !== grid[i]) return false;
  }
  return true;
}

function randomGrid(n) {
  const grid = new Uint8Array(n * n);
  const half = Math.ceil(n / 2);
  const density = 0.42 + Math.random() * 0.28;
  for (let y = 0; y < half; y++) {
    for (let x = 0; x < half; x++) {
      const v = Math.random() < density ? 1 : 0;
      const coords = [
        [y, x],
        [y, n - 1 - x],
        [n - 1 - y, x],
        [n - 1 - y, n - 1 - x],
      ];
      for (const [cy, cx] of coords) grid[cy * n + cx] = v;
    }
  }
  return grid;
}

function toRows(grid, n) {
  const rows = [];
  for (let y = 0; y < n; y++) {
    let row = '';
    for (let x = 0; x < n; x++) row += grid[y * n + x] ? '#' : '.';
    rows.push(row);
  }
  return rows;
}

const puzzles = [];

for (const [sizeStr, count] of Object.entries(COUNTS)) {
  const n = Number(sizeStr);
  let found = 0;
  let attempts = 0;
  const started = Date.now();

  while (found < count && attempts < MAX_ATTEMPTS) {
    attempts += 1;
    const grid = randomGrid(n);
    let filled = 0;
    for (let i = 0; i < grid.length; i++) filled += grid[i];
    if (filled < n * 1.5 || filled > n * n * 0.78) continue;

    const clues = buildClues(grid, n);
    if (!isLineSolvable(grid, clues, n)) continue;

    found += 1;
    puzzles.push({
      id: `${n}-${found}`,
      size: n,
      solution: toRows(grid, n),
    });
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `${n}x${n}: ${found}/${count} in ${attempts} attempts (${elapsed}s)`,
  );
  if (found < count) {
    console.error(`Failed to generate enough ${n}x${n} puzzles`);
    process.exit(1);
  }
}

const header = `// Auto-generated by scripts/generate-puzzles.mjs — do not edit by hand.\n\nexport type Puzzle = {\n  id: string;\n  size: number;\n  solution: string[];\n};\n\nexport const PUZZLES: Puzzle[] = `;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, header + JSON.stringify(puzzles, null, 2) + ';\n');
console.log(`Wrote ${puzzles.length} puzzles to ${OUT}`);
