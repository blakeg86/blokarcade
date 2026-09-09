import { useEffect, useRef } from 'react';

/**
 * requestAnimationFrame loop. `tick` receives the frame delta as a multiple of a
 * 60 fps frame (1.0 == 16.67 ms), clamped so a stalled tab can't teleport things.
 */
export function useGameLoop(tick: (dt: number) => void, running: boolean) {
  const tickRef = useRef(tick);
  tickRef.current = tick;

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let last = 0;
    const loop = (now: number) => {
      const dt = last === 0 ? 1 : Math.min((now - last) / (1000 / 60), 3);
      last = now;
      tickRef.current(dt);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [running]);
}
