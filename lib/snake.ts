export type Dir = 'up' | 'down' | 'left' | 'right';
export interface Point {
  x: number;
  y: number;
}

export const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };
export const DELTA: Record<Dir, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const BASE_INTERVAL_MS = 160;
export const MIN_INTERVAL_MS = 80;

/** Speeds up every 5 foods, never below 80 ms. */
export function intervalForFoods(foods: number): number {
  return Math.max(MIN_INTERVAL_MS, BASE_INTERVAL_MS - Math.floor(foods / 5) * 12);
}

export function canTurn(current: Dir, next: Dir): boolean {
  return next !== current && OPPOSITE[current] !== next;
}

export function nextHead(head: Point, dir: Dir): Point {
  return { x: head.x + DELTA[dir].x, y: head.y + DELTA[dir].y };
}

export function hitsWall(p: Point, cols: number, rows: number): boolean {
  return p.x < 0 || p.y < 0 || p.x >= cols || p.y >= rows;
}

export function hitsSelf(p: Point, body: Point[], willGrow: boolean): boolean {
  // The tail cell frees up unless the snake grows this tick.
  const check = willGrow ? body : body.slice(0, -1);
  return check.some((s) => s.x === p.x && s.y === p.y);
}

export function placeFood(body: Point[], cols: number, rows: number, rng: () => number): Point {
  const taken = new Set(body.map((s) => `${s.x},${s.y}`));
  const free: Point[] = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (!taken.has(`${x},${y}`)) free.push({ x, y });
  if (free.length === 0) return { x: -1, y: -1 };
  return free[Math.floor(rng() * free.length)];
}

/** Swipe direction from a drag vector; null if the drag is too small. */
export function swipeDir(dx: number, dy: number, threshold = 20): Dir | null {
  if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}
