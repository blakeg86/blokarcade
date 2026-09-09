export interface Overlap {
  /** New block's left edge after trimming, or null if there is no overlap. */
  x: number | null;
  width: number;
  perfect: boolean;
}

/** Trims a dropped block to the part overlapping the block below. */
export function computeOverlap(prevX: number, prevW: number, x: number, w: number, perfectTolerance = 4): Overlap {
  const left = Math.max(prevX, x);
  const right = Math.min(prevX + prevW, x + w);
  const width = right - left;
  if (width <= 0) return { x: null, width: 0, perfect: false };
  const perfect = Math.abs(x - prevX) <= perfectTolerance && Math.abs(w - prevW) <= perfectTolerance;
  return perfect ? { x: prevX, width: prevW, perfect: true } : { x: left, width, perfect: false };
}

/** Sweep speed rises 5% every 5 drops. */
export function speedForDrops(base: number, drops: number): number {
  return base * Math.pow(1.05, Math.floor(drops / 5));
}
