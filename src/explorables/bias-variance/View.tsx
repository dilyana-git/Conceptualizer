/**
 * Rendering only. SPEC §3.3 — fitting and the decomposition live in model.ts.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Plot } from '../../engine/Plot';
import { LiveDescription } from '../../engine/LiveDescription';
import { useInView, usePrefersReducedMotion } from '../../engine/useInView';
import { useMediaQuery } from '../../engine/useMediaQuery';
import type { ParamApi } from '../../engine/useParams';
import { describe, solve, type BiasVarianceInputs } from './model';
import type { Schema } from './params';
import styles from './View.module.css';

const Y_LIMIT = 2.2;
/** §2.4: the draws accumulate once, then settle. */
const INTRO_MS = 1200;

const n3 = (v: number) => v.toFixed(3);

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

  const [introDraws, setIntroDraws] = useState<number | null>(null);
  const introPlayed = useRef(false);
  const arrivedWithState = useRef(params.isDirty);

  useEffect(() => {
    if (params.isDirty && !arrivedWithState.current) {
      introPlayed.current = true;
      setIntroDraws(null);
    }
  }, [params.isDirty]);

  useEffect(() => {
    if (!inView || introPlayed.current) return;
    introPlayed.current = true;
    if (reducedMotion || arrivedWithState.current) return;

    const target = values.resamples;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min((now - start) / INTRO_MS, 1);
      setIntroDraws(Math.max(1, Math.round(target * (1 - (1 - t) * (1 - t)))));
      if (t < 1) raf = requestAnimationFrame(step);
      else setIntroDraws(null);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, reducedMotion, values.resamples]);

  const inputs: BiasVarianceInputs = {
    degree: values.degree,
    noise: values.noise,
    trainSize: values.trainSize,
    resamples: introDraws ?? values.resamples,
    sample: 1,
  };
  const outcome = solve(inputs);

  const total = Math.max(outcome.expectedError, 1e-9);
  const share = (v: number) => `${(100 * v) / total}%`;

  const description = describe(inputs, outcome);

  return (
    <div ref={holderRef}>
      <figure className={styles.figure}>
        <div className={styles.chartCell}>
          <Plot
            className={styles.chart}
            width={narrow ? 390 : 660}
            height={narrow ? 330 : 420}
            margin={narrow ? { top: 16, right: 16, bottom: 40, left: 42 } : undefined}
            xDomain={[0, 1]}
            yDomain={[-Y_LIMIT, Y_LIMIT]}
            xLabel="x"
            yLabel="y"
            yTicks={5}
            ariaLabel="Many polynomial fits to repeated samples, with the target and average fit"
          >
            {({ x, y, innerWidth, innerHeight }) => {
              const path = (ys: readonly number[]) =>
                outcome.grid.map((gx, i) => `${x(gx)},${y(ys[i]!)}`).join(' ');

              return (
                <>
                  <defs>
                    <clipPath id="bv-clip">
                      <rect x={0} y={0} width={innerWidth} height={innerHeight} />
                    </clipPath>
                  </defs>

                  <g clipPath="url(#bv-clip)">
                    {/* One faint curve per draw. Their spread is the variance. */}
                    {outcome.curves.map((curve, i) => (
                      <polyline key={i} className={styles.fit} points={path(curve)} />
                    ))}

                    {values.show_points && outcome.fits[0]
                      ? outcome.fits[0].points.map((p, i) => (
                          <circle
                            key={`p-${i}`}
                            className={styles.trainPoint}
                            cx={x(p.x)}
                            cy={y(p.y)}
                            r={3}
                          />
                        ))
                      : null}

                    <polyline className={styles.truth} points={path(outcome.truth)} />
                    {values.show_average ? (
                      <polyline className={styles.average} points={path(outcome.average)} />
                    ) : null}
                  </g>

                  <text
                    className={`${styles.label} ${styles.labelTruth}`}
                    x={x(0.25)}
                    y={Math.max(12, y(outcome.truth[30]!) - 12)}
                    textAnchor="middle"
                  >
                    truth
                  </text>
                  {values.show_average ? (
                    <text
                      className={`${styles.label} ${styles.labelAverage}`}
                      x={x(0.75)}
                      y={Math.min(
                        innerHeight - 6,
                        Math.max(12, y(outcome.average[90]!) + 18),
                      )}
                      textAnchor="middle"
                    >
                      average fit
                    </text>
                  ) : null}
                </>
              );
            }}
          </Plot>
        </div>

        {controls ? <div className={styles.controlsCell}>{controls}</div> : null}

        <div className={styles.metricsCell}>
          {/* The decomposition, as one bar. This is the payoff: three parts
              that always sum to the expected error, trading against each
              other as the flexibility slider moves. */}
          <div className={styles.barBlock}>
            <div className={styles.barHead}>
              <span>Expected error on new data</span>
              <span className={styles.legendValue}>{n3(outcome.expectedError)}</span>
            </div>
            <div className={styles.bar} role="img" aria-label={description}>
              <div className={styles.segBias} style={{ width: share(outcome.bias2) }} />
              <div className={styles.segVariance} style={{ width: share(outcome.variance) }} />
              <div className={styles.segNoise} style={{ width: share(outcome.irreducible) }} />
            </div>
            <div className={styles.legend}>
              <span className={styles.legendItem}>
                <span className={`${styles.swatch} ${styles.segBias}`} />
                bias² <span data-testid="bias2" className={styles.legendValue}>{n3(outcome.bias2)}</span>
              </span>
              <span className={styles.legendItem}>
                <span className={`${styles.swatch} ${styles.segVariance}`} />
                variance <span data-testid="variance-value" className={styles.legendValue}>{n3(outcome.variance)}</span>
              </span>
              <span className={styles.legendItem}>
                <span className={`${styles.swatch} ${styles.segNoise}`} />
                noise <span data-testid="noise-value" className={styles.legendValue}>{n3(outcome.irreducible)}</span>
              </span>
            </div>
          </div>

          <div className={styles.readouts}>
            <div className={styles.readout}>
              <span className={styles.readoutLabel}>Error on new data</span>
              <span data-testid="expected-error"
                className={`${styles.readoutValue} ${styles.readoutTotal}`}>
                {n3(outcome.expectedError)}
              </span>
            </div>
            <div className={styles.readout}>
              <span className={styles.readoutLabel}>Error on training data</span>
              <span data-testid="train-error"
                className={`${styles.readoutValue} ${styles.readoutInk}`}>
                {n3(outcome.trainError)}
              </span>
            </div>
          </div>

          <figcaption className={styles.caption}>
            Training error only ever falls as flexibility rises. The bar above it does not — and
            the bar is the one that describes data you have not seen.
          </figcaption>
          <LiveDescription text={description} />
        </div>
      </figure>
    </div>
  );
}
