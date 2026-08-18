/**
 * Rendering only. SPEC §3.3 — the arithmetic lives in model.ts.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Plot } from '../../engine/Plot';
import { LiveDescription } from '../../engine/LiveDescription';
import { useInView, usePrefersReducedMotion } from '../../engine/useInView';
import { useMediaQuery } from '../../engine/useMediaQuery';
import type { ParamApi } from '../../engine/useParams';
import {
  altDensity,
  describe,
  nullDensity,
  sampleCurve,
  solve,
  type PowerInputs,
  type Tails,
} from './model';
import type { Schema } from './params';
import styles from './View.module.css';

const X_MIN = -1.05;
const X_MAX = 1.75;
/** §2.4: the sample grows once, on entry, then settles. */
const INTRO_MS = 1100;

const pct = (v: number) => `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`;

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

  const [introN, setIntroN] = useState<number | null>(null);
  const introPlayed = useRef(false);
  const arrivedWithState = useRef(params.isDirty);

  useEffect(() => {
    if (params.isDirty && !arrivedWithState.current) {
      introPlayed.current = true;
      setIntroN(null);
    }
  }, [params.isDirty]);

  useEffect(() => {
    if (!inView || introPlayed.current) return;
    introPlayed.current = true;
    if (reducedMotion || arrivedWithState.current) return;

    const target = values.n;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min((now - start) / INTRO_MS, 1);
      const eased = 1 - (1 - t) * (1 - t);
      // Grow the sample geometrically, which is how it reads on a log slider.
      setIntroN(Math.max(5, Math.round(5 * Math.pow(target / 5, eased))));
      if (t < 1) raf = requestAnimationFrame(step);
      else setIntroN(null);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, reducedMotion, values.n]);

  const inputs: PowerInputs = {
    effect: values.effect,
    n: introN ?? values.n,
    alpha: values.alpha,
    tails: values.tails as Tails,
  };
  const outcome = solve(inputs);
  const twoTailed = inputs.tails === 'two';
  const showTypeM = values.show_typem;

  // The densities get taller as n grows, so the vertical axis has to follow.
  // Rounded to a coarse step so dragging n does not make it twitch.
  const peak = nullDensity(0, outcome.se);
  const yMax = Math.ceil((peak * 1.12) / 0.5) * 0.5;

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
            xDomain={[X_MIN, X_MAX]}
            yDomain={[0, yMax]}
            xLabel="Effect you would measure"
            yLabel="Density"
            yTicks={4}
            ariaLabel="Null and alternative sampling distributions with the rejection region"
          >
            {({ x, y, innerWidth, innerHeight }) => {
              const px = (v: number) => x(v);
              const py = (v: number) => y(v);
              const crit = outcome.criticalEffect;

              const toPath = (pts: { x: number; y: number }[]) =>
                pts.map((p) => `${px(p.x)},${py(p.y)}`).join(' ');

              const nullPts = sampleCurve((v) => nullDensity(v, outcome.se), X_MIN, X_MAX);
              const altPts = sampleCurve(
                (v) => altDensity(v, inputs.effect, outcome.se),
                X_MIN,
                X_MAX,
              );

              /** Area under a density between two bounds, as a closed polygon. */
              const area = (
                density: (v: number) => number,
                from: number,
                to: number,
              ): string => {
                if (to <= from) return '';
                const pts = sampleCurve(density, from, to, 90);
                return [
                  `${px(from)},${py(0)}`,
                  ...pts.map((p) => `${px(p.x)},${py(p.y)}`),
                  `${px(to)},${py(0)}`,
                ].join(' ');
              };

              const nullD = (v: number) => nullDensity(v, outcome.se);
              const altD = (v: number) => altDensity(v, inputs.effect, outcome.se);

              return (
                <>
                  <defs>
                    <clipPath id="sp-clip">
                      <rect x={0} y={0} width={innerWidth} height={innerHeight} />
                    </clipPath>
                  </defs>

                  <g clipPath="url(#sp-clip)">
                    {/* Power: the part of the alternative that clears the line. */}
                    <polygon className={styles.powerFill} points={area(altD, crit, X_MAX)} />
                    {twoTailed ? (
                      <polygon className={styles.powerFill} points={area(altD, X_MIN, -crit)} />
                    ) : null}

                    {/* Alpha: the same region measured under the null. */}
                    <polygon className={styles.alphaFill} points={area(nullD, crit, X_MAX)} />
                    {twoTailed ? (
                      <polygon className={styles.alphaFill} points={area(nullD, X_MIN, -crit)} />
                    ) : null}

                    <polyline className={`${styles.curve} ${styles.nullCurve}`} points={toPath(nullPts)} />
                    <polyline className={`${styles.curve} ${styles.altCurve}`} points={toPath(altPts)} />

                    <line
                      className={styles.zeroLine}
                      x1={px(0)}
                      x2={px(0)}
                      y1={py(0)}
                      y2={py(nullD(0))}
                    />
                    <line
                      className={styles.truthLine}
                      x1={px(inputs.effect)}
                      x2={px(inputs.effect)}
                      y1={py(0)}
                      y2={py(altD(inputs.effect))}
                    />
                    <line
                      className={styles.critLine}
                      x1={px(crit)}
                      x2={px(crit)}
                      y1={py(0)}
                      y2={py(yMax)}
                    />
                    {twoTailed ? (
                      <line
                        className={styles.critLine}
                        x1={px(-crit)}
                        x2={px(-crit)}
                        y1={py(0)}
                        y2={py(yMax)}
                      />
                    ) : null}

                    {/* What a significant study would report, on average. */}
                    {showTypeM && inputs.effect > 0 ? (
                      <line
                        className={styles.reportedLine}
                        x1={px(inputs.effect * outcome.typeM)}
                        x2={px(inputs.effect * outcome.typeM)}
                        y1={py(0)}
                        y2={py(yMax * 0.55)}
                      />
                    ) : null}
                  </g>

                  <text className={`${styles.label} ${styles.labelNull}`} x={px(0)} y={12} textAnchor="middle">
                    no effect
                  </text>
                  {inputs.effect > 0.08 ? (
                    <text
                      className={`${styles.label} ${styles.labelAlt}`}
                      x={px(inputs.effect)}
                      y={12}
                      textAnchor="middle"
                    >
                      truth
                    </text>
                  ) : null}
                  {/* Anchored just right of its own line rather than centred on
                      it: the threshold often lands within a hair of the true
                      effect, and a centred label then sits on top of both. */}
                  <text
                    className={`${styles.label} ${styles.labelCrit}`}
                    x={Math.min(px(crit) + 7, innerWidth - 4)}
                    y={innerHeight - 10}
                    textAnchor={px(crit) > innerWidth - 90 ? 'end' : 'start'}
                  >
                    significant →
                  </text>
                  {showTypeM && inputs.effect > 0 ? (
                    <text
                      className={`${styles.label} ${styles.labelAlt}`}
                      x={px(inputs.effect * outcome.typeM)}
                      y={py(yMax * 0.55) - 8}
                      textAnchor="middle"
                    >
                      reported
                    </text>
                  ) : null}
                </>
              );
            }}
          </Plot>
        </div>

        {controls ? <div className={styles.controlsCell}>{controls}</div> : null}

        <div className={styles.metricsCell}>
          <div className={styles.readouts}>
            <div className={styles.readout}>
              <span className={styles.readoutLabel}>Power</span>
              <span
                data-testid="power"
                className={`${styles.readoutValue} ${
                  outcome.power >= 0.8 ? styles.readoutAlt : styles.readoutWarn
                }`}
              >
                {pct(outcome.power)}
              </span>
            </div>
            <div className={styles.readout}>
              <span className={styles.readoutLabel}>Exaggeration</span>
              <span data-testid="exaggeration"
                className={`${styles.readoutValue} ${styles.readoutInk}`}>
                {inputs.effect > 0 ? `${outcome.typeM.toFixed(1)}×` : '—'}
              </span>
            </div>
            <div className={styles.readout}>
              <span className={styles.readoutLabel}>Wrong sign</span>
              <span data-testid="wrong-sign"
                className={`${styles.readoutValue} ${styles.readoutInk}`}>
                {inputs.effect > 0 ? pct(outcome.typeS) : '—'}
              </span>
            </div>
            <div className={styles.readout}>
              <span className={styles.readoutLabel}>n for 80%</span>
              <span data-testid="n-for-80"
                className={`${styles.readoutValue} ${styles.readoutInk}`}>
                {Number.isFinite(outcome.nFor80) ? outcome.nFor80 : '—'}
              </span>
            </div>
          </div>

          <figcaption className={styles.caption}>
            The orange line is where significance begins. Power is the blue area beyond it;
            everything blue on the near side is a real effect the study will fail to find.
          </figcaption>
          <LiveDescription text={description} />
        </div>
      </figure>
    </div>
  );
}
