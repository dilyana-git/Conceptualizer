/**
 * Rendering only (§3.3). The field comes from `model.ts`.
 *
 * This is the §8 per-pixel case and the §9 performance case in one. The field
 * is filled into a reused Float32Array, written into a reused ImageData, and
 * blitted through an offscreen canvas — no allocation happens per frame. §9
 * allows this explorable 30fps rather than 60 and requires the computation grid
 * to be downscaled on narrow viewports, which `RESOLUTION` does.
 */
import { useMemo, useRef, type ReactNode } from 'react';
import { Canvas } from '../../engine/Canvas';
import { LiveDescription } from '../../engine/LiveDescription';
import { readPalette } from '../../engine/tokens';
import { useMediaQuery } from '../../engine/useMediaQuery';
import { usePrefersReducedMotion } from '../../engine/useInView';
import type { ParamApi } from '../../engine/useParams';
import {
  EXTENT,
  describe,
  fillField,
  solve,
  type FieldMode,
  type WaveInputs,
} from './model';
import type { Schema } from './params';
import styles from './View.module.css';

/** §9: the computation grid is downscaled on narrow viewports. */
const RESOLUTION_WIDE = 260;
const RESOLUTION_NARROW = 130;

/** Cycles per second in the live view. Slow enough to follow a single crest. */
const CYCLES_PER_SECOND = 0.6;

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
  const narrow = useMediaQuery('(max-width: 560px)');
  const reducedMotion = usePrefersReducedMotion();

  const resolution = narrow ? RESOLUTION_NARROW : RESOLUTION_WIDE;

  const inputs: WaveInputs = {
    separation: values.separation,
    wavelength: values.wavelength,
    phase: values.phase,
    mode: values.mode as FieldMode,
  };

  const outcome = solve(inputs);

  // §2.4: the live view is the simulation itself, which is content rather than
  // decoration — but a reader who asked for reduced motion gets it frozen.
  const animating = inputs.mode === 'amplitude' && !reducedMotion;

  // Buffers are allocated once per resolution and reused every frame.
  const buffers = useMemo(
    () => ({ field: new Float32Array(resolution * resolution), canvas: null as HTMLCanvasElement | null }),
    [resolution],
  );
  const bufferRef = useRef(buffers);
  bufferRef.current = buffers;

  const draw = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    elapsed: number,
  ) => {
    const palette = readPalette();
    const store = bufferRef.current;

    if (!store.canvas) store.canvas = document.createElement('canvas');
    const buffer = store.canvas;
    if (buffer.width !== resolution) {
      buffer.width = resolution;
      buffer.height = resolution;
    }
    const bufferCtx = buffer.getContext('2d');
    if (!bufferCtx) return;

    const t = animating ? elapsed * CYCLES_PER_SECOND : 0;
    fillField(store.field, resolution, inputs, t);

    const image = bufferCtx.createImageData(resolution, resolution);
    const data = image.data;
    const [pr, pg, pb] = hexToRgb(palette.paper);
    const [sr, sg, sb] = hexToRgb(palette.signal);
    const [wr, wg, wb] = hexToRgb(palette.signalWarm);
    const showingAmplitude = inputs.mode === 'amplitude';

    for (let i = 0; i < store.field.length; i++) {
      const v = store.field[i]!;
      let r: number;
      let g: number;
      let b: number;

      if (showingAmplitude) {
        // Diverging: crest to signal, trough to signal-warm, paper at zero.
        const magnitude = Math.min(1, Math.abs(v) / 2);
        const [tr, tg, tb] = v >= 0 ? [sr, sg, sb] : [wr, wg, wb];
        r = pr + (tr - pr) * magnitude;
        g = pg + (tg - pg) * magnitude;
        b = pb + (tb - pb) * magnitude;
      } else {
        // Sequential: intensity runs 0..4, paper to signal.
        const magnitude = Math.min(1, v / 4);
        r = pr + (sr - pr) * magnitude;
        g = pg + (sg - pg) * magnitude;
        b = pb + (sb - pb) * magnitude;
      }

      const o = i * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 255;
    }

    bufferCtx.putImageData(image, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(buffer, 0, 0, width, height);

    // Geometry on top, in ink.
    const px = (x: number) => ((x + EXTENT) / (2 * EXTENT)) * width;
    const py = (y: number) => height - ((y + EXTENT) / (2 * EXTENT)) * height;

    if (values.show_rays) {
      ctx.strokeStyle = palette.graphite;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      for (const theta of outcome.nodalAngles) {
        // d sin(theta) = dr measures theta from the x axis, and the pattern is
        // symmetric, so each angle gives a ray on both sides.
        for (const direction of [1, -1]) {
          ctx.beginPath();
          ctx.moveTo(px(0), py(0));
          ctx.lineTo(
            px(direction * 3 * Math.cos(theta)),
            py(direction * 3 * Math.sin(theta)),
          );
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = palette.graphite;
    for (const source of [outcome.sources.a, outcome.sources.b]) {
      ctx.beginPath();
      ctx.arc(px(source.x), py(source.y), 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = palette.paper;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  };

  return (
    <figure className={styles.figure}>
      <div className={styles.fieldCell}>
        <div className={styles.canvasHolder}>
          <Canvas
            draw={draw}
            animate={animating}
            ariaLabel={
              inputs.mode === 'amplitude'
                ? 'Live wave field from two sources, showing crests, troughs and the pale lines between them'
                : 'Time-averaged interference pattern from two sources'
            }
          />
        </div>
        <p className={styles.status}>
          {inputs.mode === 'amplitude'
            ? reducedMotion
              ? 'Live wave, held still because you asked for reduced motion.'
              : 'Live wave. Blue is a crest, orange a trough.'
            : 'Time-averaged strength. The pale lines are total cancellation.'}
        </p>
      </div>

      {controls ? <div className={styles.controlsCell}>{controls}</div> : null}

      <div className={styles.metricsCell}>
        <div className={styles.readouts}>
          <div className={styles.readout}>
            <span className={styles.readoutLabel}>Cancel bands</span>
            <span className={styles.readoutValue} data-testid="nodal-count">
              {outcome.nodalCount}
            </span>
          </div>
          <div className={styles.readout}>
            <span className={styles.readoutLabel}>d / &lambda;</span>
            <span className={styles.readoutValue} data-testid="ratio">
              {outcome.ratio.toFixed(2)}
            </span>
          </div>
          <div className={styles.readout}>
            <span className={styles.readoutLabel}>Straight ahead</span>
            <span className={`${styles.readoutValue} ${styles.readoutInk}`} data-testid="axis">
              {outcome.axisIntensity.toFixed(2)}
            </span>
          </div>
          <div className={styles.readout}>
            <span className={styles.readoutLabel}>Fringe spacing</span>
            <span className={`${styles.readoutValue} ${styles.readoutInk}`}>
              {outcome.fringeSpacingDegrees === null
                ? '—'
                : `${outcome.fringeSpacingDegrees.toFixed(1)}°`}
            </span>
          </div>
        </div>

        <figcaption className={styles.caption}>
          Straight ahead runs 0 to 4: four times one source at full reinforcement, zero at total
          cancellation. Two sources, and the brightest place is brighter than twice as bright.
        </figcaption>
        <LiveDescription text={describe(outcome)} />
      </div>
    </figure>
  );
}
