export const GRID = 7;
export const SHAPES = 4; // circle, square, triangle, diamond
export type Cell = number; // 0..SHAPES-1, or -1 for empty
export type Grid = Cell[][];

export type Rng = () => number;

export function randomShape(rng: Rng): Cell {
  return Math.floor(rng() * SHAPES);
}

/** Builds a board with no pre-existing matches. */
export function createGrid(rng: Rng = Math.random): Grid {
  const g: Grid = Array.from({ length: GRID }, () => Array<Cell>(GRID).fill(-1));
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      let shape = randomShape(rng);
      let guard = 0;
      while (
        guard++ < 20 &&
        ((c >= 2 && g[r][c - 1] === shape && g[r][c - 2] === shape) ||
          (r >= 2 && g[r - 1][c] === shape && g[r - 2][c] === shape))
      ) {
        shape = (shape + 1) % SHAPES;
      }
      g[r][c] = shape;
    }
  }
  return hasMove(g) ? g : createGrid(rng);
}

export function cloneGrid(g: Grid): Grid {
  return g.map((row) => row.slice());
}

/** Returns the set of "r,c" keys that are part of a run of 3+. */
export function findMatches(g: Grid): Set<string> {
  const matched = new Set<string>();
  for (let r = 0; r < GRID; r++) {
    let run = 1;
    for (let c = 1; c <= GRID; c++) {
      if (c < GRID && g[r][c] !== -1 && g[r][c] === g[r][c - 1]) {
        run++;
      } else {
        if (run >= 3) for (let k = c - run; k < c; k++) matched.add(`${r},${k}`);
        run = 1;
      }
    }
  }
  for (let c = 0; c < GRID; c++) {
    let run = 1;
    for (let r = 1; r <= GRID; r++) {
      if (r < GRID && g[r][c] !== -1 && g[r][c] === g[r - 1][c]) {
        run++;
      } else {
        if (run >= 3) for (let k = r - run; k < r; k++) matched.add(`${k},${c}`);
        run = 1;
      }
    }
  }
  return matched;
}

export function areAdjacent(a: [number, number], b: [number, number]): boolean {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
}

export function swap(g: Grid, a: [number, number], b: [number, number]): Grid {
  const n = cloneGrid(g);
  const t = n[a[0]][a[1]];
  n[a[0]][a[1]] = n[b[0]][b[1]];
  n[b[0]][b[1]] = t;
  return n;
}

/** True if any adjacent swap produces a match. */
export function hasMove(g: Grid): boolean {
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (c + 1 < GRID && findMatches(swap(g, [r, c], [r, c + 1])).size > 0) return true;
      if (r + 1 < GRID && findMatches(swap(g, [r, c], [r + 1, c])).size > 0) return true;
    }
  }
  return false;
}

export function clearMatches(g: Grid, matched: Set<string>): Grid {
  const n = cloneGrid(g);
  matched.forEach((key) => {
    const [r, c] = key.split(',').map(Number);
    n[r][c] = -1;
  });
  return n;
}

/** Cascade gravity: cells fall down, new shapes fill from the top. */
export function applyGravity(g: Grid, rng: Rng = Math.random): Grid {
  const n = cloneGrid(g);
  for (let c = 0; c < GRID; c++) {
    let write = GRID - 1;
    for (let r = GRID - 1; r >= 0; r--) {
      if (n[r][c] !== -1) {
        n[write][c] = n[r][c];
        if (write !== r) n[r][c] = -1;
        write--;
      }
    }
    for (let r = write; r >= 0; r--) n[r][c] = randomShape(rng);
  }
  return n;
}

export function scoreFor(matchedCount: number, combo: number): number {
  return matchedCount * 10 * combo;
}

export interface ResolveStep {
  grid: Grid;
  cleared: Set<string>;
  combo: number;
  points: number;
}

/**
 * Fully resolves a board after a swap: returns each cascade step so the UI can
 * animate them in sequence. Combo multiplier grows by one per cascade.
 */
export function resolveCascades(g: Grid, rng: Rng = Math.random): ResolveStep[] {
  const steps: ResolveStep[] = [];
  let grid = g;
  let combo = 1;
  let guard = 0;
  while (guard++ < 50) {
    const matched = findMatches(grid);
    if (matched.size === 0) break;
    const points = scoreFor(matched.size, combo);
    const cleared = clearMatches(grid, matched);
    grid = applyGravity(cleared, rng);
    steps.push({ grid, cleared: matched, combo, points });
    combo++;
  }
  return steps;
}
