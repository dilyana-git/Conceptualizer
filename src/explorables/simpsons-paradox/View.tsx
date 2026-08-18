/**
 * Rendering only. SPEC §3.3 — the fits and the decomposition live in model.ts.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Plot } from '../../engine/Plot';
import { LiveDescription } from '../../engine/LiveDescription';
import { useInView, usePrefersReducedMotion } from '../../engine/useInView';
import { useMediaQuery } from '../../engine/useMediaQuery';
import type { ParamApi } from '../../engine/useParams';
import { GROUP_WIDTH, describe, solve, type SimpsonInputs } from './model';
import type { Schema } from './params';
import styles from './View.module.css';

/** §2.4: the groups slide apart once, then hand over. */
const INTRO_MS = 1300;

export interface ViewProps {
  params: ParamApi<Schema>;
  controls?: ReactNode;
}

export function View({ params, controls }: ViewProps) {
  const { values } = params;
  const holderRef = useRef<HTMLDivElement>(null);
  const inView = useInView(holderRef, '-10% 0px');
  const reducedMotion = usePrefersReducedMotion();
  const narrow = useMediaQuery('(max-width: 560px)');

  const [introSep, setIntroSep] = useState<number | null>(null);
  const introPlayed = useRef(false);
  const arrivedWithState = useRef(params.isDirty);

  useEffect(() => {
    if (params.isDirty && !arrivedWithState.current) {
      introPlayed.current = true;
      setIntroSep(null);
    }
  }, [params.isDirty]);

  useEffect(() => {
    if (!inView || introPlayed.current) return;
    introPlayed.current = true;
    if (reducedMotion || arrivedWithState.current) return;

    const target = values.separation;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min((now - start) / INTRO_MS, 1);
      const eased = 1 - (1 - t) * (1 - t);
      setIntroSep(target * eased);
      if (t < 1) raf = requestAnimationFrame(step);
      else setIntroSep(null);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, reducedMotion, values.separation]);

  const inputs: SimpsonInputs = {
    groups: values.groups,
    separation: introSep ?? values.separation,
    shift: values.shift,
    within: values.within,
    noise: values.noise,
    // Fixed draw. Seed 36 is chosen because its fitted within-group slope lands
    // on the value the slider names; an unlucky seed makes the readout disagree
    // with the control by 20% and reads as a bug rather than as sampling noise.
    sample: 36,
  };
  const outcome = solve(inputs);
  const showPooled = values.show_pooled;

  const description = describe(inputs, outcome);
  const fmt = (v: number) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2));

  return (
    <div ref={holderRef}>
      <figure className={styles.figure}>
        <div className={styles.chartCell}>
          <Plot
            className={styles.chart}
            width={narrow ? 390 : 660}
            height={narrow ? 330 : 440}
            margin={narrow ? { top: 16, right: 16, bottom: 40, left: 42 } : undefined}
            xDomain={outcome.xDomain}
            yDomain={outcome.yDomain}
            xLabel="Predictor"
            yLabel="Outcome"
            ariaLabel="Grouped scatter with within-group and pooled regression lines"
          >
            {({ x, y, innerWidth, innerHeight }) => {
              const px = (v: number) => x(v);
              const py = (v: number) => y(v);

              const segment = (
                slope: number,
                intercept: number,
                from: number,
                to: number,
              ) => `${px(from)},${py(slope * from + intercept)} ${px(to)},${py(slope * to + intercept)}`;

              const [xLo, xHi] = outcome.xDomain;

              return (
                <>
                  <defs>
                    <clipPath id="sx-clip">
                      <rect x={0} y={0} width={innerWidth} height={innerHeight} />
                    </clipPath>
                  </defs>

                  <g clipPath="url(#sx-clip)">
                    {outcome.points.map((p, i) => (
                      <circle key={i} className={styles.point} cx={px(p.x)} cy={py(p.y)} r={3.2} />
                    ))}

                    {/* Each group's fit is drawn only across that group's own
                        span — extending it would assert a claim the group's
                        data does not make. */}
                    {outcome.withinLines.map((line, g) => {
                      const centre = g * inputs.separation;
                      return (
                        <polyline
                          key={`w-${g}`}
                          className={styles.withinLine}
                          points={segment(
                            line.slope,
                            line.intercept,
                            centre - GROUP_WIDTH / 2,
                            centre + GROUP_WIDTH / 2,
                          )}
                        />
                      );
                    })}

                    {showPooled ? (
                      <polyline
                        className={styles.pooledLine}
                        points={segment(outcome.pooled.slope, outcome.pooled.intercept, xLo, xHi)}
                      />
                    ) : null}
                  </g>

                  {/* One within-group label, on the first group, plus the
                      pooled label parked at the left edge of its own line. */}
                  <text
                    className={`${styles.label} ${styles.labelWithin}`}
                    x={px(-GROUP_WIDTH / 2)}
                    y={Math.max(
                      12,
                      py(outcome.withinLines[0]!.slope * (-GROUP_WIDTH / 2) +
                        outcome.withinLines[0]!.intercept) - 12,
                    )}
                    textAnchor="start"
                  >
                    each group
                  </text>
                  {showPooled ? (
                    <text
                      className={`${styles.label} ${styles.labelPooled}`}
                      x={px(xHi)}
                      y={Math.max(
                        12,
                        Math.min(
                          innerHeight - 6,
                          py(outcome.pooled.slope * xHi + outcome.pooled.intercept) - 10,
                        ),
                      )}
                      textAnchor="end"
                    >
                      all together
                    </text>
                  ) : null}
                </>
              );
            }}
          </Plot>
        </div>

        {controls ? <div className={styles.controlsCell}>{controls}</div> : null}

        <div className={styles.metricsCell}>
          <div
            data-testid="verdict"
            className={`${styles.verdict} ${
              outcome.reversed ? styles.verdictReversed : styles.verdictAgree
            }`}
          >
            {outcome.reversed ? 'Reversed' : 'Both point the same way'}
          </div>

          <div className={styles.readouts}>
            <div className={styles.readout}>
              <span className={styles.readoutLabel}>Within each group</span>
              <span data-testid="within-slope"
                className={`${styles.readoutValue} ${styles.readoutWithin}`}>
                {fmt(outcome.meanWithinSlope)}
              </span>
            </div>
            <div className={styles.readout}>
              <span className={styles.readoutLabel}>All pooled</span>
              <span data-testid="pooled-slope"
                className={`${styles.readoutValue} ${styles.readoutPooled}`}>
                {fmt(outcome.pooled.slope)}
              </span>
            </div>
            <div className={styles.readout}>
              <span className={styles.readoutLabel}>Predicted pooled</span>
              <span data-testid="predicted-slope"
                className={styles.readoutValue}>{fmt(outcome.predictedPooledSlope)}</span>
            </div>
          </div>

          <figcaption className={styles.caption}>
            The short blue lines are fitted to one group each. The orange line is fitted to every
            point at once, and is not an average of them.
          </figcaption>
          <LiveDescription text={description} />
        </div>
      </figure>
    </div>
  );
}
