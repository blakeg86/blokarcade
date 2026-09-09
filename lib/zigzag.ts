export interface Segment {
  /** Center x of the segment (in path units, 0 = screen centre). */
  x: number;
  /** Segment index from the start of the run (used for narrowing). */
  index: number;
  width: number;
}

export const SEGMENT_LENGTH = 44;
export const BASE_WIDTH = 120;
export const MIN_WIDTH = 56;

/** Path narrows every 10 segments. */
export function widthForSegment(index: number): number {
  return Math.max(MIN_WIDTH, BASE_WIDTH - Math.floor(index / 10) * 8);
}

/** Speed rises 5% every 15 points. */
export function speedForScore(base: number, score: number): number {
  return base * Math.pow(1.05, Math.floor(score / 15));
}

/**
 * Generates the next path segment. The path drifts left/right in runs so the
 * player has to keep flipping direction to stay on it; it is clamped to the
 * playable width so it never runs off-screen.
 */
export function nextSegment(prev: Segment, halfPlayWidth: number, rng: () => number, dirState: { dir: 1 | -1; left: number }): Segment {
  if (dirState.left <= 0) {
    dirState.dir = rng() < 0.5 ? -1 : 1;
    dirState.left = 2 + Math.floor(rng() * 4);
  }
  dirState.left--;
  const index = prev.index + 1;
  const width = widthForSegment(index);
  const step = SEGMENT_LENGTH * 0.75;
  let x = prev.x + dirState.dir * step;
  const limit = halfPlayWidth - width / 2;
  if (x > limit) {
    x = limit;
    dirState.dir = -1;
  } else if (x < -limit) {
    x = -limit;
    dirState.dir = 1;
  }
  return { x, index, width };
}
