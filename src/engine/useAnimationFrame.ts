/**
 * §9: rAF loops use delta-time and never assume a frame interval.
 *
 * The callback receives seconds elapsed since the previous frame, clamped so a
 * backgrounded tab does not resume with one enormous step that blows up an
 * integrator.
 */
import { useEffect, useRef } from 'react';

const MAX_DT_SECONDS = 1 / 20;

export function useAnimationFrame(
  callback: (dtSeconds: number, elapsedSeconds: number) => void,
  active: boolean,
): void {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    let elapsed = 0;

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, MAX_DT_SECONDS);
      last = now;
      elapsed += dt;
      cbRef.current(dt, elapsed);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
}
