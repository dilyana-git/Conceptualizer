/**
 * Rendering only. SPEC §3.3: no physics here. Every number on screen comes out
 * of `model.ts`; this file's job is to turn those into pixels.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Plot } from '../../engine/Plot';
import { LiveDescription } from '../../engine/LiveDescription';
import { useInView, usePrefersReducedMotion } from '../../engine/useInView';
import { useMediaQuery } from '../../engine/useMediaQuery';
import type { ParamApi } from '../../engine/useParams';
import {
  P0,
  Q0,
  chokePrice,
  describe,
  inverseDemand,
  inverseSupply,
  regions,
  solve,
  type LeviedOn,
  type Point,
  type TaxInputs,
} from './model';
import type { Schema } from './params';
import styles from './View.module.css';

const X_MAX = 125;
const Y_MIN = 26;
/** §2.4: one orchestrated moment — the tax sweeps up to its default, once. */
const INTRO_MS = 1100;

const money = (v: number) => `$${v.toFixed(2)}`;

function polygon(points: Point[], x: (q: number) => number, y: (p: number) => number): string {
  return points.map((pt) => `${x(pt.q)},${y(pt.p)}`).join(' ');
}

export interface ViewProps {
  params: ParamApi<Schema>;
  /**
   * The control panel, placed by the view rather than stacked after it, so the
   * §9 mobile requirement (chart and controls on screen together) is met by
   * source order instead of by hoping the readouts stay short.
   */
  controls?: ReactNode;
}

export function View({ params, controls }: ViewProps) {
  const { values } = params;
  const holderRef = useRef<HTMLDivElement>(null);
  const inView = useInView(holderRef, '-10% 0px');
  // A narrower coordinate system on phones, so axis ticks stay legible instead
  // of being scaled down with the rest of the drawing.
  const narrow = useMediaQuery('(max-width: 560px)');
  const reducedMotion = usePrefersReducedMotion();

  // The intro run is display-only: it never writes to the param store, so it
  // cannot leak into the URL or fight a reader who grabs a slider mid-run.
  const [introTax, setIntroTax] = useState<number | null>(null);
  const introPlayed = useRef(false);

  // §6: a shared link must reproduce exactly what the sharer was looking at.
  // If the reader arrived carrying state, they came for that state — sweeping
  // away from it and back is noise, so the intro is forfeited.
  const arrivedWithState = useRef(params.isDirty);

  // The observer can fire well after paint, so a reader (or a test) may already
  // be interacting by the time the intro would start. Once anything has been
  // touched, the invitation has been accepted and the run is cancelled.
  useEffect(() => {
    if (params.isDirty && !arrivedWithState.current) {
      introPlayed.current = true;
      setIntroTax(null);
    }
  }, [params.isDirty]);

  useEffect(() => {
    if (!inView || introPlayed.current) return;
    introPlayed.current = true;
    // §2.4: reduced motion skips the run and renders at the settled state.
    if (reducedMotion || arrivedWithState.current || values.tax === 0) return;

    const target = values.tax;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min((now - start) / INTRO_MS, 1);
      // ease-out, so it arrives rather than stops
      const eased = 1 - (1 - t) * (1 - t);
      setIntroTax(target * eased);
      if (t < 1) raf = requestAnimationFrame(step);
      else setIntroTax(null);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, reducedMotion, values.tax]);

  const effectiveTax = introTax ?? values.tax;

  const inputs: TaxInputs = {
    elasticityD: values.elasticity_d,
    elasticityS: values.elasticity_s,
    tax: effectiveTax,
    leviedOn: values.levied_on as LeviedOn,
  };
  const outcome = solve(inputs);
  const area = regions(inputs, outcome);

  const showSurplus = values.show_surplus;
  const showDwl = values.show_dwl;

  // Only grow the frame when surplus shading is on and would otherwise be cut
  // off. Rounded to a step of 4 so dragging an elasticity does not make the
  // axis twitch on every frame.
  const choke = chokePrice(inputs.elasticityD);
  const yMax = showSurplus ? Math.ceil(Math.max(Y_MIN, choke * 1.06) / 4) * 4 : Y_MIN;

  const description = describe(inputs, outcome);

  return (
    <div ref={holderRef}>
      <figure className={styles.figure}>
        <div className={styles.chartCell}>
          <Plot
            className={styles.chart}
            width={narrow ? 390 : 660}
            height={narrow ? 330 : 460}
            margin={narrow ? { top: 14, right: 14, bottom: 40, left: 40 } : undefined}
            xDomain={[0, X_MAX]}
            yDomain={[0, yMax]}
            xLabel="Quantity"
            yLabel="Price"
            ariaLabel="Supply and demand with a per-unit tax"
          >
            {({ x, y, innerWidth, innerHeight }) => {
              const px = (q: number) => x(q);
              const py = (p: number) => y(p);
              const q1 = outcome.quantity;

              const demandLine = `${px(0)},${py(inverseDemand(0, inputs.elasticityD))} ${px(
                X_MAX,
              )},${py(inverseDemand(X_MAX, inputs.elasticityD))}`;
              const supplyLine = `${px(0)},${py(inverseSupply(0, inputs.elasticityS))} ${px(
                X_MAX,
              )},${py(inverseSupply(X_MAX, inputs.elasticityS))}`;

              // Curve labels are placed by scanning for a point that is both
              // inside the frame and clear of the wedge, which sits around q1.
              // A fixed anchor collides with the tax bracket as soon as an
              // elasticity gets steep enough to move the curve across it.
              const anchorOn = (
                curve: (q: number) => number,
                targetP: number,
                qFrom: number,
                qTo: number,
              ) => {
                let bestQ = qFrom;
                let bestErr = Infinity;
                for (let q = qFrom; q <= qTo; q += 2) {
                  const p = curve(q);
                  if (p < yMax * 0.06 || p > yMax * 0.94) continue;
                  const err = Math.abs(p - targetP);
                  if (err < bestErr) {
                    bestErr = err;
                    bestQ = q;
                  }
                }
                return { q: bestQ, p: curve(bestQ) };
              };

              // Demand is labelled to the left of the wedge, supply to the right.
              const dAnchor = anchorOn(
                (q) => inverseDemand(q, inputs.elasticityD),
                yMax * 0.72,
                6,
                X_MAX * 0.5,
              );
              const sAnchor = anchorOn(
                (q) => inverseSupply(q, inputs.elasticityS),
                yMax * 0.62,
                X_MAX * 0.66,
                X_MAX,
              );

              return (
                <>
                  <defs>
                    <clipPath id="ti-clip">
                      <rect x={0} y={0} width={innerWidth} height={innerHeight} />
                    </clipPath>
                    {/* Engraved-plate idiom: the loss triangle is hatched ink,
                        not a third hue (§2.1). */}
                    <pattern
                      id="hatch-dwl"
                      width={6}
                      height={6}
                      patternUnits="userSpaceOnUse"
                      patternTransform="rotate(45)"
                    >
                      <line
                        x1={0}
                        y1={0}
                        x2={0}
                        y2={6}
                        stroke="var(--graphite)"
                        strokeWidth={1.1}
                        opacity={0.5}
                      />
                    </pattern>
                  </defs>

                  <g clipPath="url(#ti-clip)">
                    {showSurplus ? (
                      <>
                        <polygon className={styles.csFill} points={polygon(area.consumerSurplus, px, py)} />
                        <polygon className={styles.psFill} points={polygon(area.producerSurplus, px, py)} />
                        {effectiveTax > 0 ? (
                          <polygon className={styles.revenueFill} points={polygon(area.revenue, px, py)} />
                        ) : null}
                      </>
                    ) : null}

                    {showDwl && effectiveTax > 0 ? (
                      <polygon className={styles.dwlFill} points={polygon(area.deadweightLoss, px, py)} />
                    ) : null}

                    <polyline className={`${styles.curve} ${styles.demand}`} points={demandLine} />
                    <polyline className={`${styles.curve} ${styles.supply}`} points={supplyLine} />

                    {/* Untaxed equilibrium — fixed by the model, therefore ink. */}
                    <g className={styles.equilibrium} aria-hidden="true">
                      <line x1={px(Q0) - 4} y1={py(P0) - 4} x2={px(Q0) + 4} y2={py(P0) + 4} />
                      <line x1={px(Q0) - 4} y1={py(P0) + 4} x2={px(Q0) + 4} y2={py(P0) - 4} />
                    </g>

                    {effectiveTax > 0 ? (
                      <>
                        <line
                          className={`${styles.guide} ${styles.guideConsumer}`}
                          x1={0}
                          x2={px(q1)}
                          y1={py(outcome.priceConsumer)}
                          y2={py(outcome.priceConsumer)}
                        />
                        <line
                          className={`${styles.guide} ${styles.guideProducer}`}
                          x1={0}
                          x2={px(q1)}
                          y1={py(outcome.priceProducer)}
                          y2={py(outcome.priceProducer)}
                        />
                        <line
                          className={styles.guide}
                          x1={px(q1)}
                          x2={px(q1)}
                          y1={py(0)}
                          y2={py(outcome.priceConsumer)}
                        />
                        {/* The wedge: its height is exactly the tax. */}
                        <line
                          className={styles.wedge}
                          x1={px(q1)}
                          x2={px(q1)}
                          y1={py(outcome.priceProducer)}
                          y2={py(outcome.priceConsumer)}
                        />
                        <line
                          className={styles.wedge}
                          x1={px(q1) - 5}
                          x2={px(q1) + 5}
                          y1={py(outcome.priceConsumer)}
                          y2={py(outcome.priceConsumer)}
                        />
                        <line
                          className={styles.wedge}
                          x1={px(q1) - 5}
                          x2={px(q1) + 5}
                          y1={py(outcome.priceProducer)}
                          y2={py(outcome.priceProducer)}
                        />
                      </>
                    ) : null}
                  </g>

                  {/* Labels sit outside the clip so they are never half-cut. */}
                  <text
                    className={`${styles.curveLabel} ${styles.demandLabel}`}
                    x={px(dAnchor.q)}
                    y={Math.max(12, Math.min(innerHeight - 6, py(dAnchor.p) - 9))}
                    textAnchor="middle"
                  >
                    Demand
                  </text>
                  <text
                    className={`${styles.curveLabel} ${styles.supplyLabel}`}
                    x={px(sAnchor.q)}
                    y={Math.max(12, Math.min(innerHeight - 6, py(sAnchor.p) - 9))}
                    textAnchor="middle"
                  >
                    Supply
                  </text>

                  {/* The wedge reading sits left of the bracket, the loss label
                      right of the triangle, so the two never meet. */}
                  {effectiveTax > 0 ? (
                    <text
                      className={styles.wedgeLabel}
                      x={px(q1) - 10}
                      y={py((outcome.priceConsumer + outcome.priceProducer) / 2) + 4}
                      textAnchor="end"
                    >
                      {`t = ${money(effectiveTax)}`}
                    </text>
                  ) : null}

                  {showDwl && effectiveTax > 0 && outcome.deadweightLoss > 0.5 ? (
                    <text className={styles.regionLabel} x={px(Q0) + 9} y={py(P0) + 16}>
                      lost
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
              <span className={styles.readoutLabel}>Consumers pay</span>
              <span className={`${styles.readoutValue} ${styles.readoutConsumer}`}>
                {money(outcome.priceConsumer)}
              </span>
            </div>
            <div className={styles.readout}>
              <span className={styles.readoutLabel}>Producers keep</span>
              <span className={`${styles.readoutValue} ${styles.readoutProducer}`}>
                {money(outcome.priceProducer)}
              </span>
            </div>
            <div className={styles.readout}>
              <span className={styles.readoutLabel}>Consumer share</span>
              <span className={`${styles.readoutValue} ${styles.readoutConsumer}`}>
                {`${Math.round(outcome.consumerShare * 100)}%`}
              </span>
            </div>
            <div className={styles.readout}>
              <span className={styles.readoutLabel}>Producer share</span>
              <span className={`${styles.readoutValue} ${styles.readoutProducer}`}>
                {`${Math.round(outcome.producerShare * 100)}%`}
              </span>
            </div>
            <div className={styles.readout}>
              <span className={styles.readoutLabel}>Quantity</span>
              <span className={`${styles.readoutValue} ${styles.readoutInk}`}>
                {outcome.quantity.toFixed(1)}
              </span>
            </div>
            <div className={styles.readout}>
              <span className={styles.readoutLabel}>Revenue</span>
              <span className={`${styles.readoutValue} ${styles.readoutInk}`}>
                {money(outcome.government)}
              </span>
            </div>
            <div className={styles.readout}>
              <span className={styles.readoutLabel}>Deadweight loss</span>
              <span className={`${styles.readoutValue} ${styles.readoutInk}`}>
                {money(outcome.deadweightLoss)}
              </span>
            </div>
            <div className={styles.readout}>
              <span className={styles.readoutLabel}>Collected from</span>
              <span className={`${styles.readoutValue} ${styles.readoutInk}`}>
                {values.levied_on === 'sellers' ? 'Sellers' : 'Buyers'}
              </span>
            </div>
          </div>

          <figcaption className={styles.caption}>
            The vertical bar is the tax. Its height never changes with the elasticities — only
            how much of it sits above the old price rather than below it.
          </figcaption>
          <LiveDescription text={description} />
        </div>
      </figure>
    </div>
  );
}
