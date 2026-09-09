/**
 * BrikBreak level layouts. 7 columns wide. Each string is one row;
 * '.' = empty, '1' = one-hit brick, '2' = two-hit brick.
 */
export const COLS = 7;

export const HAND_DESIGNED_LEVELS: string[][] = [
  // 1 – Warm-up
  ['1111111', '1111111', '1111111'],
  // 2 – Checker
  ['1.1.1.1', '.1.1.1.', '1.1.1.1', '.1.1.1.'],
  // 3 – Core
  ['1111111', '1122211', '1122211', '1111111'],
  // 4 – Pyramid
  ['...1...', '..111..', '.11111.', '1111111'],
  // 5 – Columns
  ['2.1.1.2', '2.1.1.2', '2.1.1.2', '2.1.1.2', '2.1.1.2'],
  // 6 – Diamond
  ['...1...', '..121..', '.12221.', '..121..', '...1...'],
  // 7 – Bars
  ['2222222', '.......', '1111111', '.......', '2222222'],
  // 8 – Cross
  ['..212..', '..212..', '2222222', '..212..', '..212..'],
  // 9 – Frame
  ['2222222', '2.....2', '2.111.2', '2.....2', '2222222'],
  // 10 – Zigzag
  ['11.....', '.11....', '..11...', '...11..', '....11.', '.....11'],
  // 11 – Inverted pyramid
  ['2222222', '.22222.', '..222..', '...2...'],
  // 12 – Twin towers
  ['22...22', '22...22', '22...22', '22.1.22', '2211122'],
  // 13 – Hourglass
  ['2222222', '.11111.', '..111..', '...1...', '..111..', '.11111.', '2222222'],
  // 14 – Stripes
  ['1212121', '2121212', '1212121', '2121212', '1212121'],
  // 15 – Fortress
  ['2.2.2.2', '2222222', '2211122', '2211122', '2222222'],
  // 16 – The Wall
  ['2222222', '2222222', '2222222', '2222222', '2222222', '2222222'],
];

export interface BrickSpec {
  row: number;
  col: number;
  hits: 1 | 2;
}

export function parseLevel(rows: string[]): BrickSpec[] {
  const bricks: BrickSpec[] = [];
  rows.forEach((row, r) => {
    for (let c = 0; c < COLS; c++) {
      const ch = row[c] ?? '.';
      if (ch === '1') bricks.push({ row: r, col: c, hits: 1 });
      else if (ch === '2') bricks.push({ row: r, col: c, hits: 2 });
    }
  });
  return bricks;
}

/** Deterministic pseudo-random generator for reproducible procedural levels. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Beyond the hand-designed set, levels get denser and tougher with index. */
export function generateProceduralLevel(levelIndex: number): BrickSpec[] {
  const rng = mulberry32(levelIndex * 7919 + 17);
  const rows = Math.min(4 + Math.floor(levelIndex / 3), 8);
  const density = Math.min(0.55 + levelIndex * 0.02, 0.9);
  const twoHitChance = Math.min(0.25 + levelIndex * 0.03, 0.75);
  const bricks: BrickSpec[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < COLS; c++) {
      if (rng() < density) {
        bricks.push({ row: r, col: c, hits: rng() < twoHitChance ? 2 : 1 });
      }
    }
  }
  return bricks.length > 0 ? bricks : [{ row: 0, col: 3, hits: 1 }];
}

export function getLevel(levelIndex: number): BrickSpec[] {
  const hand = HAND_DESIGNED_LEVELS[levelIndex];
  return hand ? parseLevel(hand) : generateProceduralLevel(levelIndex);
}
