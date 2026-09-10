export interface Segment {
  /** Center x of the segment (in path units, 0 = screen centre). */
  x: number;
  /** Segment index from the start of the run (used for narrowing). */
  index: number;
  width: number;
}

export const SEGMENT_LENGTH = 44;
export const BASE_WIDTH = 220;
export const MIN_WIDTH = 64;

/** Path narrows 6% every 10 segments, from `baseWidth` down to MIN_WIDTH. */
export function widthForSegment(index: number, baseWidth: number = BASE_WIDTH): number {
  return Math.max(MIN_WIDTH, Math.round(baseWidth * Math.pow(0.94, Math.floor(index / 10))));
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
export function nextSegment(prev: Segment, halfPlayWidth: number, rng: () => number, dirState: { dir: 1 | -1; left: number }, baseWidth: number = BASE_WIDTH): Segment {
  if (dirState.left <= 0) {
    dirState.dir = rng() < 0.5 ? -1 : 1;
    dirState.left = 2 + Math.floor(rng() * 4);
  }
  dirState.left--;
  const index = prev.index + 1;
  const width = widthForSegment(index, baseWidth);
  // Early segments drift gently; the zigzag sharpens as the path narrows.
  const step = SEGMENT_LENGTH * (0.45 + 0.35 * (1 - (width - MIN_WIDTH) / Math.max(1, baseWidth - MIN_WIDTH)));
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
