/**
 * Rendering only (§3.3). The trajectory and the field both come from `model.ts`.
 *
 * The loss surface is a genuine per-pixel field, which §3.1 puts firmly on the
 * Canvas side of the line. It is computed once per surface into an offscreen
 * buffer at fixed resolution and then scaled up, so dragging the learning rate
 * repaints the path without recomputing the ground underneath it.
 */
import { useMemo, useRef, type ReactNode } from 'react';
import { Canvas } from '../../engine/Canvas';
import { LiveDescription } from '../../engine/LiveDescription';
import { readPalette } from '../../engine/tokens';
import type { ParamApi } from '../../engine/useParams';
import {
  DOMAIN,
  SURFACES,
  describe,
  lossField,
  solve,
  type DescentInputs,
  type SurfaceKey,
} from './model';
import type { Schema } from './params';
import styles from './View.module.css';

/**
 * Offscreen field resolution. 400x400 is 160,000 evaluations, a few milliseconds,
 * and it is computed once per surface rather than per frame. At 200 the band
 * edges were visibly stair-stepped once scaled up to the displayed size.
 */
const FIELD_RESOLUTION = 400;

/**
 * A converged loss is often far below 1e-4, and "0.0000" tells the reader
 * nothing about how far it got — which is precisely the comparison this
 * explorable asks them to make between plain descent and momentum.
 */
function formatLoss(v: number): string {
  if (v === 0) return '0';
  return v < 1e-4 ? v.toExponential(1) : v.toFixed(4);
}
const BANDS = 9;

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const value = Number.parseInt(full, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export interface ViewProps {
  params: ParamApi<Schema>;
  controls?: ReactNode;
}

export function View({ params, controls }: ViewProps) {
  const { values } = params;
  const offscreen = useRef<HTMLCanvasElement | null>(null);

  const inputs: DescentInputs = {
    surface: values.surface as SurfaceKey,
    learningRate: values.learningRate,
    momentum: values.momentum,
    startAngle: values.startAngle,
    steps: values.steps,
  };

  const outcome = solve(inputs);
  const showField = values.show_field;

  // The field depends only on which surface is selected.
  const field = useMemo(() => lossField(SURFACES[inputs.surface], FIELD_RESOLUTION), [
    inputs.surface,
  ]);
  const fieldMax = useMemo(() => {
    let max = 0;
    for (let i = 0; i < field.length; i++) if (field[i]! > max) max = field[i]!;
    return max || 1;
  }, [field]);

  const draw = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const palette = readPalette();
    const [lo, hi] = DOMAIN;
    const span = hi - lo;
    const px = (x: number) => ((x - lo) / span) * width;
    const py = (y: number) => height - ((y - lo) / span) * height;

    ctx.fillStyle = palette.paper;
    ctx.fillRect(0, 0, width, height);

    if (showField) {
      if (!offscreen.current) offscreen.current = document.createElement('canvas');
      const buffer = offscreen.current;
      buffer.width = FIELD_RESOLUTION;
      buffer.height = FIELD_RESOLUTION;
      const bufferCtx = buffer.getContext('2d');

      if (bufferCtx) {
        const image = bufferCtx.createImageData(FIELD_RESOLUTION, FIELD_RESOLUTION);
        const data = image.data;
        const [pr, pg, pb] = hexToRgb(palette.paper);
        const [gr, gg, gb] = hexToRgb(palette.graphite);

        for (let i = 0; i < field.length; i++) {
          // Square root compresses the quadratic growth so the bands near the
          // minimum are not swallowed by the corners; quantising into bands is
          // what turns a smooth ramp into readable contours.
          const normalised = Math.sqrt(field[i]! / fieldMax);
          const band = Math.min(BANDS - 1, Math.floor(normalised * BANDS)) / (BANDS - 1);
          const weight = band * 0.44;

          const o = i * 4;
          data[o] = Math.round(pr + (gr - pr) * weight);
          data[o + 1] = Math.round(pg + (gg - pg) * weight);
          data[o + 2] = Math.round(pb + (gb - pb) * weight);
          data[o + 3] = 255;
        }
        bufferCtx.putImageData(image, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(buffer, 0, 0, width, height);
      }
    }

    // Minima, as ink crosses: fixed by the surface, so not signal.
    ctx.strokeStyle = palette.graphite;
    ctx.lineWidth = 1.5;
    for (const m of outcome.surface.minima) {
      const cx = px(m.x);
      const cy = py(m.y);
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy - 6);
      ctx.lineTo(cx + 6, cy + 6);
      ctx.moveTo(cx - 6, cy + 6);
      ctx.lineTo(cx + 6, cy - 6);
      ctx.stroke();
    }

    // The path.
    const path = outcome.path;
    ctx.strokeStyle = palette.signal;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let started = false;
    for (const point of path) {
      const cx = px(point.x);
      const cy = py(point.y);
      // Points can leave the frame when it diverges; keep drawing so the exit
      // direction stays visible rather than the line simply stopping.
      if (!Number.isFinite(cx) || !Number.isFinite(cy)) break;
      if (!started) {
        ctx.moveTo(cx, cy);
        started = true;
      } else {
        ctx.lineTo(cx, cy);
      }
    }
    ctx.stroke();

    ctx.fillStyle = palette.signal;
    for (const point of path) {
      const cx = px(point.x);
      const cy = py(point.y);
      if (cx < -20 || cy < -20 || cx > width + 20 || cy > height + 20) continue;
      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Start marker, drawn last so it is never buried.
    const start = path[0]!;
    ctx.fillStyle = palette.paper;
    ctx.strokeStyle = palette.signal;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px(start.x), py(start.y), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };

  const threshold = outcome.stabilityThreshold;

  return (
    <figure className={styles.figure}>
      <div className={styles.fieldCell}>
        <div className={styles.canvasHolder}>
          <Canvas
            draw={draw}
            ariaLabel={`Loss surface for the ${outcome.surface.label.toLowerCase()}, with the descent path drawn on it`}
          />
        </div>
        <p className={`${styles.status} ${outcome.diverged ? styles.diverged : ''}`}>
          {outcome.diverged
            ? `Diverged after ${outcome.stepsTaken} steps.`
            : `${outcome.stepsTaken} steps drawn. Open circle is the start.`}
        </p>
      </div>

      {controls ? <div className={styles.controlsCell}>{controls}</div> : null}

      <div className={styles.metricsCell}>
        <div className={styles.readouts}>
          <div className={styles.readout}>
            <span className={styles.readoutLabel}>Loss now</span>
            <span
              className={`${styles.readoutValue} ${outcome.diverged ? styles.readoutWarn : styles.readoutPath}`}
              data-testid="final-loss"
            >
              {outcome.diverged ? 'diverged' : formatLoss(outcome.finalLoss)}
            </span>
          </div>
          <div className={styles.readout}>
            <span className={styles.readoutLabel}>Loss at start</span>
            <span className={styles.readoutValue}>{formatLoss(outcome.startLoss)}</span>
          </div>
          <div className={styles.readout}>
            <span className={styles.readoutLabel}>Stable below</span>
            <span className={styles.readoutValue} data-testid="threshold">
              {threshold === null ? 'varies' : threshold.toFixed(2)}
            </span>
          </div>
          <div className={styles.readout}>
            <span className={styles.readoutLabel}>Condition number</span>
            <span className={styles.readoutValue} data-testid="condition-number">
              {outcome.conditionNumber === null ? '—' : outcome.conditionNumber.toFixed(0)}
            </span>
          </div>
        </div>

        <figcaption className={styles.caption}>
          Darker bands are higher loss. The crosses mark the true minima, which the algorithm
          cannot see — it only ever knows the slope directly under its feet.
        </figcaption>
        <LiveDescription text={describe(inputs, outcome)} />
      </div>
    </figure>
  );
}
