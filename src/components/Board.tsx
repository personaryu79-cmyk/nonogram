import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  computeClues,
  EMPTY,
  FILLED,
  MARKED,
  type CellState,
} from '../game/nonogram';

export type InputMode = 'fill' | 'mark';

type BoardProps = {
  size: number;
  solution: string[];
  cells: CellState[];
  mode: InputMode;
  disabled?: boolean;
  onStrokeStart: () => void;
  onCells: (next: CellState[]) => void;
  onStrokeEnd: (base: CellState[], current: CellState[]) => void;
};

type Stroke = {
  active: boolean;
  base: CellState[];
  target: CellState;
  erase: boolean;
  last: number;
};

const CLUE_RATIO = 0.62;

export default function Board({
  size,
  solution,
  cells,
  mode,
  disabled,
  onStrokeStart,
  onCells,
  onStrokeEnd,
}: BoardProps) {
  const clues = useMemo(() => computeClues(solution), [solution]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const cellsRef = useRef(cells);

  useEffect(() => {
    cellsRef.current = cells;
  }, [cells]);

  const strokeRef = useRef<Stroke>({
    active: false,
    base: cells,
    target: EMPTY,
    erase: false,
    last: -1,
  });

  const [width, setWidth] = useState(340);

  useLayoutEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    setWidth(element.clientWidth);
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const leftCols = Math.max(1, ...clues.rows.map((row) => row.length));
  const topRows = Math.max(1, ...clues.cols.map((col) => col.length));

  const available = Math.max(180, width);
  const rawCell =
    available / (size + leftCols * CLUE_RATIO + 0.6);
  const cell = Math.max(14, Math.min(46, Math.floor(rawCell)));
  const clue = Math.max(9, Math.round(cell * CLUE_RATIO));
  const clueFont = Math.max(8, Math.floor(clue * 0.62));

  const styleVars = {
    '--cell': `${cell}px`,
    '--clue': `${clue}px`,
    '--clue-font': `${clueFont}px`,
  } as CSSProperties;

  const indexAt = (clientX: number, clientY: number): number => {
    const element = gridRef.current;
    if (!element) return -1;
    const rect = element.getBoundingClientRect();
    const x = Math.floor((clientX - rect.left) / (rect.width / size));
    const y = Math.floor((clientY - rect.top) / (rect.height / size));
    if (x < 0 || y < 0 || x >= size || y >= size) return -1;
    return y * size + x;
  };

  const applyIndex = (index: number) => {
    const stroke = strokeRef.current;
    if (!stroke.active || index < 0 || index === stroke.last) return;
    stroke.last = index;
    const current = cellsRef.current;
    const value = stroke.erase ? EMPTY : stroke.target;
    if (current[index] === value) return;
    const next = current.slice();
    next[index] = value;
    cellsRef.current = next;
    onCells(next);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    const index = indexAt(event.clientX, event.clientY);
    if (index < 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    const current = cellsRef.current;
    const base = current.slice();
    const startValue = current[index];
    const target = mode === 'fill' ? FILLED : MARKED;
    const erase = startValue === target;

    strokeRef.current = {
      active: true,
      base,
      target,
      erase,
      last: -1,
    };
    onStrokeStart();
    applyIndex(index);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!strokeRef.current.active) return;
    event.preventDefault();
    applyIndex(indexAt(event.clientX, event.clientY));
  };

  const finishStroke = () => {
    const stroke = strokeRef.current;
    if (!stroke.active) return;
    stroke.active = false;
    onStrokeEnd(stroke.base, cellsRef.current);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    finishStroke();
  };

  const cellNodes = cells.map((state, index) => {
    const x = index % size;
    const y = Math.floor(index / size);
    const classes = ['cell'];
    if (state === FILLED) classes.push('is-filled');
    if (state === MARKED) classes.push('is-marked');
    if (x % 5 === 4 && x < size - 1) classes.push('major-right');
    if (y % 5 === 4 && y < size - 1) classes.push('major-bottom');
    if (x === size - 1) classes.push('edge-right');
    if (y === size - 1) classes.push('edge-bottom');
    if (size > 5 && (Math.floor(x / 5) + Math.floor(y / 5)) % 2 === 1) {
      classes.push('shade');
    }
    return (
      <div
        key={index}
        className={classes.join(' ')}
        role="presentation"
        data-x={x}
        data-y={y}
      >
        {state === MARKED ? <span className="mark">×</span> : null}
      </div>
    );
  });

  return (
    <div className="board-wrap" ref={wrapRef}>
      <div className="board" style={styleVars}>
        <div
          className="clues-top"
          style={{ width: `${size * cell}px`, height: `${topRows * clue}px` }}
        >
          {clues.cols.map((col, x) => (
            <div
              key={x}
              className="col-clue"
              style={{ width: `${cell}px` }}
            >
              {col.length === 0 ? (
                <span className="num empty">0</span>
              ) : (
                col.map((value, i) => (
                  <span key={i} className="num">
                    {value}
                  </span>
                ))
              )}
            </div>
          ))}
        </div>

        <div
          className="clues-left"
          style={{ width: `${leftCols * clue}px` }}
        >
          {clues.rows.map((row, y) => (
            <div
              key={y}
              className="row-clue"
              style={{ height: `${cell}px` }}
            >
              {row.length === 0 ? (
                <span className="num empty">0</span>
              ) : (
                row.map((value, i) => (
                  <span key={i} className="num">
                    {value}
                  </span>
                ))
              )}
            </div>
          ))}
        </div>

        <div
          className="grid"
          ref={gridRef}
          style={{
            width: `${size * cell}px`,
            height: `${size * cell}px`,
            gridTemplateColumns: `repeat(${size}, ${cell}px)`,
            gridTemplateRows: `repeat(${size}, ${cell}px)`,
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onContextMenu={(event) => event.preventDefault()}
        >
          {cellNodes}
        </div>
      </div>
    </div>
  );
}
