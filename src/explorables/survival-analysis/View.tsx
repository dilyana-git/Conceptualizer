/**
 * Rendering only. SPEC §3.3 — every number here comes out of model.ts.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Plot } from '../../engine/Plot';
import { LiveDescription } from '../../engine/LiveDescription';
import { useInView, usePrefersReducedMotion } from '../../engine/useInView';
import { useMediaQuery } from '../../engine/useMediaQuery';
import type { ParamApi } from '../../engine/useParams';
import {
  describe,
  polylinePoints,
  solve,
  survivalAt,
  trueSurvival,
  type Comparator,
  type StepPoint,
  type SurvivalInputs,
} from './model';
import type { Schema } from './params';
import styles from './View.module.css';

/** §2.4: the curve draws itself once, left to right, then hands over. */
const INTRO_MS = 1200;

const monthsOrDash = (v: number | null) => (v === null ? '—' : v.toFixed(1));

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

  // Fraction of the time axis revealed so far; null once the intro is over.
  const [reveal, setReveal] = useState<number | null>(null);
  const introPlayed = useRef(false);
  const arrivedWithState = useRef(params.isDirty);

  useEffect(() => {
    if (params.isDirty && !arrivedWithState.current) {
      introPlayed.current = true;
      setReveal(null);
    }
  }, [params.isDirty]);

  useEffect(() => {
    if (!inView || introPlayed.current) return;
    introPlayed.current = true;
    if (reducedMotion || arrivedWithState.current) return;

    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min((now - start) / INTRO_MS, 1);
      setReveal(1 - (1 - t) * (1 - t));
      if (t < 1) raf = requestAnimationFrame(step);
      else setReveal(null);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, reducedMotion]);

  const inputs: SurvivalInputs = {
    n: values.n,
    median: values.median,
    censoring: values.censoring,
    sample: values.sample,
    comparator: values.comparator as Comparator,
  };
  const outcome = solve(inputs);
  const horizon = outcome.horizon;
  const cutoff = reveal === null ? horizon : horizon * reveal;

  const showCi = values.show_ci;
  const hasComparator = inputs.comparator !== 'none';

  // Clip the drawn curves at the reveal front during the intro run.
  const visible = (steps: readonly StepPoint[]) => steps.filter((s) => s.time <= cutoff);

  const description = describe(inputs, outcome);

  return (
    <div ref={holderRef}>
      <figure className={styles.figure}>
        <div className={styles.chartCell}>
          <Plot
            className={styles.chart}
            width={narrow ? 390 : 660}
            height={narrow ? 330 : 440}
            margin={narrow ? { top: 16, right: 16, bottom: 40, left: 42 } : undefined}
            xDomain={[0, horizon]}
            yDomain={[0, 1]}
            xLabel="Months"
            yLabel="Surviving"
            yTicks={5}
            ariaLabel="Kaplan-Meier survival curve with censoring"
          >
            {({ x, y, innerWidth, innerHeight }) => {
              const px = (t: number) => x(t);
              const py = (s: number) => y(s);

              const kmPoints = polylinePoints(visible(outcome.km), cutoff);
              const line = (pts: { t: number; s: number }[]) =>
                pts.map((p) => `${px(p.t)},${py(p.s)}`).join(' ');

              // The true curve is smooth, so it is sampled rather than stepped.
              const truthPoints: string[] = [];
              const samples = 80;
              for (let i = 0; i <= samples; i++) {
                const t = (cutoff * i) / samples;
                truthPoints.push(`${px(t)},${py(trueSurvival(t, inputs.median))}`);
              }

              // Greenwood band as a closed polygon: upper limits forward along
              // the steps, lower limits back again.
              const bandPolygon = (() => {
                const steps = visible(outcome.km);
                if (steps.length === 0) return '';
                const upper: string[] = [`${px(0)},${py(1)}`];
                const lower: string[] = [];
                let prevUpper = 1;
                let prevLower = 1;
                for (const s of steps) {
                  upper.push(`${px(s.time)},${py(prevUpper)}`, `${px(s.time)},${py(s.upper)}`);
                  lower.push(`${px(s.time)},${py(prevLower)}`, `${px(s.time)},${py(s.lower)}`);
                  prevUpper = s.upper;
                  prevLower = s.lower;
                }
                upper.push(`${px(cutoff)},${py(prevUpper)}`);
                lower.push(`${px(cutoff)},${py(prevLower)}`);
                return [...upper, ...lower.reverse()].join(' ');
              })();

              const censorMarks = outcome.censoredTimes
                .filter((t) => t <= cutoff)
                .map((t) => ({ t, s: survivalAt(outcome.km, t) }));

              return (
                <>
                  <defs>
                    <clipPath id="sa-clip">
                      <rect x={0} y={0} width={innerWidth} height={innerHeight} />
                    </clipPath>
                  </defs>

                  {/* Half-survival reference, so the median is readable off the chart. */}
                  <line
                    className={styles.halfLine}
                    x1={0}
                    x2={innerWidth}
                    y1={py(0.5)}
                    y2={py(0.5)}
                  />

                  <g clipPath="url(#sa-clip)">
                    {showCi && bandPolygon ? (
                      <polygon className={styles.band} points={bandPolygon} />
                    ) : null}

                    <polyline className={`${styles.curve} ${styles.truth}`} points={truthPoints.join(' ')} />

                    {hasComparator ? (
                      <polyline
                        className={`${styles.curve} ${styles.comparator}`}
                        points={line(polylinePoints(visible(outcome.comparator), cutoff))}
                      />
                    ) : null}

                    <polyline className={`${styles.curve} ${styles.km}`} points={line(kmPoints)} />

                    {censorMarks.map((m, i) => (
                      <line
                        key={`c-${i}`}
                        className={styles.censorTick}
                        x1={px(m.t)}
                        x2={px(m.t)}
                        y1={py(m.s) - 4}
                        y2={py(m.s) + 4}
                      />
                    ))}
                  </g>

                  {/* Curves are labelled in place rather than in a legend, but
                      all three converge at the right-hand edge, so each label
                      is staggered to its own share of the x axis. The text is
                      kept short for the same reason: at 375px there is not room
                      for three long labels however they are arranged. */}
                  {(() => {
                    const marks: Array<{ at: number; value: number; text: string; cls: string }> = [];
                    if (hasComparator) {
                      marks.push({
                        at: 0.42,
                        value: survivalAt(outcome.comparator, cutoff * 0.42),
                        text: 'naive',
                        cls: styles.comparatorLabel!,
                      });
                    }
                    marks.push({
                      at: 0.68,
                      value: survivalAt(outcome.km, cutoff * 0.68),
                      text: 'Kaplan-Meier',
                      cls: styles.kmLabel!,
                    });
                    marks.push({
                      at: 0.9,
                      value: trueSurvival(cutoff * 0.9, inputs.median),
                      text: 'truth',
                      cls: styles.truthLabel!,
                    });

                    return marks.map((m) => (
                      <text
                        key={m.text}
                        className={`${styles.curveLabel} ${m.cls}`}
                        x={px(cutoff * m.at)}
                        y={Math.max(12, Math.min(innerHeight - 6, py(m.value) - 9))}
                        textAnchor="middle"
                      >
                        {m.text}
                      </text>
                    ));
                  })()}
                </>
              );
            }}
          </Plot>
        </div>

        {controls ? <div className={styles.controlsCell}>{controls}</div> : null}

        <div className={styles.metricsCell}>
          <div className={styles.readouts}>
            <div className={styles.readout}>
              <span className={styles.readoutLabel}>KM median</span>
              <span data-testid="km-median"
                className={`${styles.readoutValue} ${styles.readoutKm}`}>
                {monthsOrDash(outcome.medianEstimate)}
              </span>
            </div>
            <div className={styles.readout}>
              <span className={styles.readoutLabel}>True median</span>
              <span data-testid="true-median"
                className={`${styles.readoutValue} ${styles.readoutInk}`}>
                {outcome.trueMedian.toFixed(1)}
              </span>
            </div>
            <div className={styles.readout}>
              <span className={styles.readoutLabel}>
                {hasComparator ? 'Naive median' : 'Events'}
              </span>
              <span
                data-testid="naive-median"
                className={`${styles.readoutValue} ${
                  hasComparator ? styles.readoutComparator : styles.readoutInk
                }`}
              >
                {hasComparator ? monthsOrDash(outcome.comparatorMedian) : outcome.eventCount}
              </span>
            </div>
            <div className={styles.readout}>
              <span className={styles.readoutLabel}>Censored</span>
              <span data-testid="censored-count"
                className={`${styles.readoutValue} ${styles.readoutInk}`}>
                {outcome.censoredCount}
              </span>
            </div>
          </div>

          <figcaption className={styles.caption}>
            Each tick on the blue curve is one subject leaving the study without the event. The
            curve does not drop there — it only shrinks the group that later drops are measured
            against.
          </figcaption>
          <LiveDescription text={description} />
        </div>
      </figure>
    </div>
  );
}
