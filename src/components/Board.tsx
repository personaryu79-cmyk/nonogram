import {
  useCallback,
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
  highlightIndex?: number | null;
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

type View = {
  scale: number;
  tx: number;
  ty: number;
};

type Pinch = {
  ids: [number, number];
  startDist: number;
  startScale: number;
  origin: { x: number; y: number };
  point: { x: number; y: number };
};

type PanGesture = {
  id: number;
  startX: number;
  startY: number;
  startTx: number;
  startTy: number;
};

const CLUE_RATIO = 0.62;
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const ZOOM_STEP = 0.5;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export default function Board({
  size,
  solution,
  cells,
  mode,
  disabled,
  highlightIndex,
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
  const rawCell = available / (size + leftCols * CLUE_RATIO + 0.6);
  const cell = Math.max(10, Math.min(46, Math.floor(rawCell)));
  const clue = Math.max(9, Math.round(cell * CLUE_RATIO));
  const clueFont = Math.max(8, Math.floor(clue * 0.62));

  const boardWidth = leftCols * clue + size * cell;
  const boardHeight = topRows * clue + size * cell;

  const naturalRef = useRef({ w: boardWidth, h: boardHeight });
  useLayoutEffect(() => {
    naturalRef.current = { w: boardWidth, h: boardHeight };
  }, [boardWidth, boardHeight]);

  const [view, setView] = useState<View>({ scale: 1, tx: 0, ty: 0 });
  const viewRef = useRef(view);
  const [panMode, setPanMode] = useState(false);
  const panModeRef = useRef(panMode);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<Pinch | null>(null);
  const panRef = useRef<PanGesture | null>(null);
  const capturedRef = useRef(new Set<number>());

  useEffect(() => {
    panModeRef.current = panMode;
  }, [panMode]);

  const clampView = useCallback((raw: View): View => {
    const scale = clamp(raw.scale, MIN_SCALE, MAX_SCALE);
    if (scale <= MIN_SCALE) return { scale: 1, tx: 0, ty: 0 };
    const wrap = wrapRef.current;
    const natural = naturalRef.current;
    const viewportW = wrap?.clientWidth ?? natural.w;
    const viewportH = wrap?.clientHeight ?? natural.h;
    const maxX = Math.max(0, (natural.w * scale - viewportW) / 2);
    const maxY = Math.max(0, (natural.h * scale - viewportH) / 2);
    return {
      scale,
      tx: clamp(raw.tx, -maxX, maxX),
      ty: clamp(raw.ty, -maxY, maxY),
    };
  }, []);

  const applyView = useCallback((next: View) => {
    viewRef.current = next;
    setView(next);
    if (next.scale <= MIN_SCALE && panModeRef.current) {
      panModeRef.current = false;
      setPanMode(false);
    }
  }, []);

  const resetZoom = () => applyView({ scale: 1, tx: 0, ty: 0 });

  const zoomBy = (delta: number) => {
    const current = viewRef.current;
    const scale = clamp(current.scale + delta, MIN_SCALE, MAX_SCALE);
    if (scale === current.scale) return;
    const ratio = scale / current.scale;
    applyView(
      clampView({
        scale,
        tx: current.tx * ratio,
        ty: current.ty * ratio,
      }),
    );
  };

  const togglePanMode = () => {
    const next = !panModeRef.current;
    panModeRef.current = next;
    setPanMode(next);
  };

  const cancelStroke = () => {
    const stroke = strokeRef.current;
    if (!stroke.active) return;
    stroke.active = false;
    stroke.last = -1;
    cellsRef.current = stroke.base;
    onCells(stroke.base);
  };

  const startPinch = () => {
    const wrap = wrapRef.current;
    const ids = [...pointersRef.current.keys()].slice(0, 2);
    if (!wrap || ids.length < 2) return;
    const p1 = pointersRef.current.get(ids[0]);
    const p2 = pointersRef.current.get(ids[1]);
    if (!p1 || !p2) return;
    const rect = wrap.getBoundingClientRect();
    const origin = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    const startDist = Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1;
    const current = viewRef.current;
    pinchRef.current = {
      ids: [ids[0], ids[1]],
      startDist,
      startScale: current.scale,
      origin,
      point: {
        x: (mid.x - origin.x - current.tx) / current.scale,
        y: (mid.y - origin.y - current.ty) / current.scale,
      },
    };
    for (const id of ids) {
      try {
        wrap.setPointerCapture(id);
        capturedRef.current.add(id);
      } catch {
        // Synthetic pointers can't be captured; gestures still work.
      }
    }
  };

  const movePinch = () => {
    const pinch = pinchRef.current;
    if (!pinch) return;
    const p1 = pointersRef.current.get(pinch.ids[0]);
    const p2 = pointersRef.current.get(pinch.ids[1]);
    if (!p1 || !p2) return;
    const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1;
    const scale = clamp(
      pinch.startScale * (dist / pinch.startDist),
      MIN_SCALE,
      MAX_SCALE,
    );
    applyView(
      clampView({
        scale,
        tx: mid.x - pinch.origin.x - scale * pinch.point.x,
        ty: mid.y - pinch.origin.y - scale * pinch.point.y,
      }),
    );
  };

  const handlePointerDownCapture = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (pointersRef.current.size >= 2) {
      if (!pinchRef.current) {
        panRef.current = null;
        cancelStroke();
        startPinch();
      }
      event.preventDefault();
      return;
    }

    if (panModeRef.current && viewRef.current.scale > MIN_SCALE) {
      cancelStroke();
      panRef.current = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startTx: viewRef.current.tx,
        startTy: viewRef.current.ty,
      };
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
        capturedRef.current.add(event.pointerId);
      } catch {
        // Ignore capture failures.
      }
      event.preventDefault();
    }
  };

  const handlePointerMoveCapture = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (pinchRef.current) {
      movePinch();
      event.preventDefault();
      return;
    }

    const pan = panRef.current;
    if (pan && pan.id === event.pointerId) {
      const current = viewRef.current;
      applyView(
        clampView({
          scale: current.scale,
          tx: pan.startTx + (event.clientX - pan.startX),
          ty: pan.startTy + (event.clientY - pan.startY),
        }),
      );
      event.preventDefault();
    }
  };

  const releaseCaptured = (
    target: HTMLDivElement,
    pointerId: number | null,
  ) => {
    const ids =
      pointerId === null
        ? [...capturedRef.current]
        : [pointerId];
    for (const id of ids) {
      if (!capturedRef.current.has(id)) continue;
      try {
        if (target.hasPointerCapture(id)) target.releasePointerCapture(id);
      } catch {
        // Ignore release failures.
      }
      capturedRef.current.delete(id);
    }
  };

  const handlePointerUpCapture = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    pointersRef.current.delete(event.pointerId);
    releaseCaptured(event.currentTarget, event.pointerId);

    if (pinchRef.current) {
      if (pointersRef.current.size < 2) {
        releaseCaptured(event.currentTarget, null);
        pinchRef.current = null;
      }
    }
    if (panRef.current?.id === event.pointerId) panRef.current = null;
  };

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const handleWheel = (event: WheelEvent) => {
      if (disabled) return;
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const origin = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      const current = viewRef.current;
      const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
      const scale = clamp(current.scale * factor, MIN_SCALE, MAX_SCALE);
      if (scale === current.scale) return;
      const point = {
        x: (event.clientX - origin.x - current.tx) / current.scale,
        y: (event.clientY - origin.y - current.ty) / current.scale,
      };
      applyView(
        clampView({
          scale,
          tx: event.clientX - origin.x - scale * point.x,
          ty: event.clientY - origin.y - scale * point.y,
        }),
      );
    };
    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleWheel);
  }, [applyView, clampView, disabled]);

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
    if (
      disabled ||
      panModeRef.current ||
      pinchRef.current ||
      pointersRef.current.size > 1
    ) {
      return;
    }
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
    if (panModeRef.current || pinchRef.current) return;
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
    if (highlightIndex === index) classes.push('hint');
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
    <div className="board-area">
      <div
        className="board-wrap"
        ref={wrapRef}
        onPointerDownCapture={handlePointerDownCapture}
        onPointerMoveCapture={handlePointerMoveCapture}
        onPointerUpCapture={handlePointerUpCapture}
        onPointerCancelCapture={handlePointerUpCapture}
      >
        <div
          className="board"
          style={{
            ...styleVars,
            transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
          }}
        >
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

      {size >= 10 ? (
        <div className="zoom-bar" role="group" aria-label="확대 및 이동">
          <button
            type="button"
            onClick={() => zoomBy(-ZOOM_STEP)}
            disabled={view.scale <= MIN_SCALE}
            aria-label="축소"
          >
            −
          </button>
          <button
            type="button"
            className="zoom-value"
            onClick={resetZoom}
            aria-label="확대 초기화"
          >
            {Math.round(view.scale * 100)}%
          </button>
          <button
            type="button"
            onClick={() => zoomBy(ZOOM_STEP)}
            disabled={view.scale >= MAX_SCALE}
            aria-label="확대"
          >
            ＋
          </button>
          <button
            type="button"
            className={panMode ? 'active' : ''}
            aria-pressed={panMode}
            aria-label="이동 모드"
            disabled={view.scale <= MIN_SCALE}
            onClick={togglePanMode}
          >
            이동
          </button>
        </div>
      ) : null}
    </div>
  );
}
