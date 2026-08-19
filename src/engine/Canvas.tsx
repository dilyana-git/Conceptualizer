/**
 * DPR-aware canvas wrapper. SPEC §3.2, §9.
 *
 * Sizes the backing store to devicePixelRatio and hands the draw callback a
 * context already scaled to CSS pixels, so drawing code never thinks about DPR.
 * Re-sizes through ResizeObserver (§9), and pauses when out of view.
 */
import { useEffect, useRef } from 'react';
import { useResizeObserver } from './useResizeObserver';
import { useInView } from './useInView';

export interface CanvasProps {
  /**
   * Called with a context scaled to CSS pixels; (width, height) are CSS px.
   *
   * `elapsed` is seconds since the animation started, and is always 0 when
   * `animate` is false. Added for wave-interference (SPEC §8 #2), the first
   * explorable whose field is a function of time: without it an animated draw
   * has to reach for `performance.now()` itself, which puts the clock in the
   * view instead of in the engine and makes the frame unreproducible.
   */
  draw: (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    elapsed: number,
  ) => void;
  /** Re-run `draw` on every animation frame rather than only on change. */
  animate?: boolean;
  className?: string | undefined;
  ariaLabel?: string | undefined;
}

export function Canvas({ draw, animate = false, className, ariaLabel }: CanvasProps) {
  const holderRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  const { width, height } = useResizeObserver(holderRef);
  const inView = useInView(holderRef);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0 || height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const paint = (elapsed: number) => {
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      drawRef.current(ctx, width, height, elapsed);
      ctx.restore();
    };

    if (!animate || !inView) {
      paint(0);
      return;
    }

    let raf = 0;
    const started = performance.now();
    const loop = (now: number) => {
      paint((now - started) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [width, height, animate, inView]);

  return (
    <div ref={holderRef} className={className} style={{ width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} role="img" aria-label={ariaLabel} />
    </div>
  );
}
