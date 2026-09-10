import { HAND_DESIGNED_LEVELS, generateProceduralLevel, getLevel, parseLevel } from '../constants/brickLevels';
import {
  GRID,
  applyGravity,
  createGrid,
  findMatches,
  hasMove,
  resolveCascades,
  swap,
  type Grid,
} from '../lib/gemmatch';
import { canTurn, hitsSelf, hitsWall, intervalForFoods, placeFood, swipeDir } from '../lib/snake';
import { computeOverlap, speedForDrops } from '../lib/tapstack';
import { nextSegment, speedForScore, widthForSegment } from '../lib/zigzag';

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

describe('gemmatch', () => {
  test('createGrid produces a 7x7 board with no matches and at least one move', () => {
    for (let s = 1; s <= 25; s++) {
      const g = createGrid(seeded(s));
      expect(g).toHaveLength(GRID);
      g.forEach((row) => expect(row).toHaveLength(GRID));
      expect(findMatches(g).size).toBe(0);
      expect(hasMove(g)).toBe(true);
    }
  });

  test('findMatches detects horizontal and vertical runs', () => {
    const g: Grid = Array.from({ length: GRID }, (_, r) => Array.from({ length: GRID }, (_, c) => (2 * r + c) % 4));
    g[0][0] = g[0][1] = g[0][2] = 1;
    g[3][5] = g[4][5] = g[5][5] = g[6][5] = 3;
    const m = findMatches(g);
    expect(m.has('0,0') && m.has('0,1') && m.has('0,2')).toBe(true);
    expect(m.has('3,5') && m.has('6,5')).toBe(true);
    expect(m.size).toBe(7);
  });

  test('gravity drops cells and refills from the top with valid shapes', () => {
    const g = createGrid(seeded(3));
    g[6][0] = -1;
    g[5][0] = -1;
    const dropped = applyGravity(g, seeded(9));
    dropped.forEach((row) => row.forEach((v) => expect(v).toBeGreaterThanOrEqual(0)));
    expect(dropped[6][0]).toBe(g[4][0]);
    expect(dropped[1][1]).toBe(g[1][1]);
  });

  test('a matching swap resolves cascades with growing combo', () => {
    const g = createGrid(seeded(7));
    let found: [[number, number], [number, number]] | null = null;
    outer: for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID - 1; c++) {
        if (findMatches(swap(g, [r, c], [r, c + 1])).size > 0) {
          found = [[r, c], [r, c + 1]];
          break outer;
        }
      }
    }
    if (!found) {
      outer2: for (let r = 0; r < GRID - 1; r++) {
        for (let c = 0; c < GRID; c++) {
          if (findMatches(swap(g, [r, c], [r + 1, c])).size > 0) {
            found = [[r, c], [r + 1, c]];
            break outer2;
          }
        }
      }
    }
    expect(found).not.toBeNull();
    const steps = resolveCascades(swap(g, found![0], found![1]), seeded(11));
    expect(steps.length).toBeGreaterThan(0);
    steps.forEach((s, i) => {
      expect(s.combo).toBe(i + 1);
      expect(s.points).toBe(s.cleared.size * 10 * (i + 1));
    });
    expect(findMatches(steps[steps.length - 1].grid).size).toBe(0);
  });
});

describe('brickLevels', () => {
  test('16 hand-designed levels, all 7 wide and non-empty', () => {
    expect(HAND_DESIGNED_LEVELS).toHaveLength(16);
    HAND_DESIGNED_LEVELS.forEach((rows) => {
      rows.forEach((row) => expect(row).toHaveLength(7));
      expect(parseLevel(rows).length).toBeGreaterThan(0);
    });
  });
  test('procedural levels are deterministic and get denser', () => {
    expect(generateProceduralLevel(20)).toEqual(generateProceduralLevel(20));
    expect(generateProceduralLevel(40).length).toBeGreaterThanOrEqual(40);
    expect(getLevel(0)).toEqual(parseLevel(HAND_DESIGNED_LEVELS[0]));
    expect(getLevel(16)).toEqual(generateProceduralLevel(16));
  });
});

describe('snake', () => {
  test('speeds up every 5 foods with an 80ms floor', () => {
    expect(intervalForFoods(0)).toBe(160);
    expect(intervalForFoods(4)).toBe(160);
    expect(intervalForFoods(5)).toBe(148);
    expect(intervalForFoods(500)).toBe(80);
  });
  test('cannot reverse into itself', () => {
    expect(canTurn('right', 'left')).toBe(false);
    expect(canTurn('right', 'up')).toBe(true);
    expect(canTurn('right', 'right')).toBe(false);
  });
  test('collision rules', () => {
    expect(hitsWall({ x: -1, y: 0 }, 10, 10)).toBe(true);
    expect(hitsWall({ x: 9, y: 9 }, 10, 10)).toBe(false);
    const body = [{ x: 2, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }];
    expect(hitsSelf({ x: 0, y: 0 }, body, false)).toBe(false); // tail moves away
    expect(hitsSelf({ x: 0, y: 0 }, body, true)).toBe(true); // tail stays when growing
  });
  test('food never lands on the snake', () => {
    const body = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }];
    for (let i = 0; i < 50; i++) {
      const f = placeFood(body, 3, 2, seeded(i));
      expect(f.y).toBe(1);
    }
  });
  test('swipe detection', () => {
    expect(swipeDir(40, 5)).toBe('right');
    expect(swipeDir(-40, 5)).toBe('left');
    expect(swipeDir(3, 50)).toBe('down');
    expect(swipeDir(3, -50)).toBe('up');
    expect(swipeDir(5, 5)).toBeNull();
  });
});

describe('tapstack', () => {
  test('overlap trims the block', () => {
    expect(computeOverlap(100, 100, 130, 100)).toEqual({ x: 130, width: 70, perfect: false });
    expect(computeOverlap(100, 100, 60, 100)).toEqual({ x: 100, width: 60, perfect: false });
    expect(computeOverlap(100, 100, 250, 100).x).toBeNull();
    expect(computeOverlap(100, 100, 102, 100)).toEqual({ x: 100, width: 100, perfect: true });
  });
  test('speed +5% every 5 drops', () => {
    expect(speedForDrops(2, 4)).toBe(2);
    expect(speedForDrops(2, 5)).toBeCloseTo(2.1);
    expect(speedForDrops(2, 10)).toBeCloseTo(2.205);
  });
});

describe('zigzag', () => {
  test('path narrows gradually every 10 segments down to a floor', () => {
    expect(widthForSegment(0, 220)).toBe(220);
    expect(widthForSegment(9, 220)).toBe(220);
    expect(widthForSegment(10, 220)).toBe(207);
    expect(widthForSegment(999, 220)).toBe(64);
  });
  test('speed +5% every 15 points', () => {
    expect(speedForScore(3, 14)).toBe(3);
    expect(speedForScore(3, 15)).toBeCloseTo(3.15);
  });
  test('segments never leave the play area', () => {
    const rng = seeded(5);
    const state = { dir: 1 as 1 | -1, left: 0 };
    let seg = { x: 0, index: 0, width: 220 };
    for (let i = 0; i < 500; i++) {
      seg = nextSegment(seg, 160, rng, state, 220);
      expect(Math.abs(seg.x) + seg.width / 2).toBeLessThanOrEqual(160 + 1e-9);
    }
  });
});
