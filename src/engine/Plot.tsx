/**
 * Shared SVG axes/grid primitive. SPEC §3.2.
 *
 * §3.1: React owns the DOM; D3 is a maths and layout library only. We use
 * `d3-scale` for the mapping and emit JSX ourselves — no `d3.select`, no
 * enter/update/exit, nothing that would fight React over the same nodes.
 *
 * Renders into a fixed viewBox coordinate system and lets CSS size the element,
 * so the plot stays crisp at any width without re-measuring.
 */
import type { ReactNode } from 'react';
import { scaleLinear, type ScaleLinear } from 'd3-scale';
import styles from './Plot.module.css';

export interface PlotMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PlotFrame {
  x: ScaleLinear<number, number>;
  y: ScaleLinear<number, number>;
  innerWidth: number;
  innerHeight: number;
}

export interface PlotProps {
  width?: number;
  height?: number;
  margin?: Partial<PlotMargin> | undefined;
  xDomain: readonly [number, number];
  yDomain: readonly [number, number];
  xLabel?: string | undefined;
  yLabel?: string | undefined;
  xTicks?: number;
  yTicks?: number;
  /** Draw grid lines behind the content. */
  grid?: boolean;
  /** Accessible name for the figure (§9). */
  ariaLabel?: string | undefined;
  className?: string | undefined;
  children: (frame: PlotFrame) => ReactNode;
}

const DEFAULT_MARGIN: PlotMargin = { top: 16, right: 20, bottom: 44, left: 52 };

export function Plot({
  width = 640,
  height = 440,
  margin,
  xDomain,
  yDomain,
  xLabel,
  yLabel,
  xTicks = 6,
  yTicks = 6,
  grid = true,
  ariaLabel,
  className,
  children,
}: PlotProps) {
  const m: PlotMargin = { ...DEFAULT_MARGIN, ...margin };
  const innerWidth = width - m.left - m.right;
  const innerHeight = height - m.top - m.bottom;

  const x = scaleLinear().domain([...xDomain]).range([0, innerWidth]);
  const y = scaleLinear().domain([...yDomain]).range([innerHeight, 0]);

  const xTickValues = x.ticks(xTicks);
  const yTickValues = y.ticks(yTicks);

  return (
    <svg
      className={`${styles.plot} ${className ?? ''}`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={ariaLabel}
    >
      <g transform={`translate(${m.left},${m.top})`}>
        {grid ? (
          <g className={styles.grid} aria-hidden="true">
            {xTickValues.map((t) => (
              <line key={`gx-${t}`} x1={x(t)} x2={x(t)} y1={0} y2={innerHeight} />
            ))}
            {yTickValues.map((t) => (
              <line key={`gy-${t}`} x1={0} x2={innerWidth} y1={y(t)} y2={y(t)} />
            ))}
          </g>
        ) : null}

        {children({ x, y, innerWidth, innerHeight })}

        <g className={styles.axis} aria-hidden="true">
          <line x1={0} x2={innerWidth} y1={innerHeight} y2={innerHeight} />
          <line x1={0} x2={0} y1={0} y2={innerHeight} />
          {xTickValues.map((t) => (
            <g key={`tx-${t}`} transform={`translate(${x(t)},${innerHeight})`}>
              <line y1={0} y2={5} />
              <text className={styles.tick} y={18} textAnchor="middle">
                {t}
              </text>
            </g>
          ))}
          {yTickValues.map((t) => (
            <g key={`ty-${t}`} transform={`translate(0,${y(t)})`}>
              <line x1={-5} x2={0} />
              <text className={styles.tick} x={-9} dy="0.32em" textAnchor="end">
                {t}
              </text>
            </g>
          ))}
        </g>

        {xLabel ? (
          <text
            className={styles.axisLabel}
            x={innerWidth}
            y={innerHeight + 38}
            textAnchor="end"
            aria-hidden="true"
          >
            {xLabel}
          </text>
        ) : null}
        {yLabel ? (
          <text
            className={styles.axisLabel}
            transform={`translate(${-m.left + 12},0) rotate(-90)`}
            textAnchor="end"
            aria-hidden="true"
          >
            {yLabel}
          </text>
        ) : null}
      </g>
    </svg>
  );
}
