/** Rendering only (§3.3). Every number comes from `model.ts`. */
import type { ReactNode } from 'react';
import { Plot } from '../../engine/Plot';
import { LiveDescription } from '../../engine/LiveDescription';
import { useMediaQuery } from '../../engine/useMediaQuery';
import { normalPdf } from '../../lib/stats';
import type { ParamApi } from '../../engine/useParams';
import { describe, solve, type CltInputs, type ParentKey } from './model';
import type { Schema } from './params';
import styles from './View.module.css';

const CURVE_SAMPLES = 160;

export interface ViewProps {
  params: ParamApi<Schema>;
  controls?: ReactNode;
}

export function View({ params, controls }: ViewProps) {
  const { values } = params;
  const narrow = useMediaQuery('(max-width: 560px)');

  const inputs: CltInputs = {
    parent: values.parent as ParentKey,
    sampleSize: values.sampleSize,
    draws: values.draws,
    bins: values.bins,
    sample: values.sample,
  };

  const outcome = solve(inputs);
  const parent = outcome.parent;

  // Parent density, drawn over its own natural range.
  const parentPeak = Math.max(
    ...Array.from({ length: CURVE_SAMPLES }, (_, i) =>
      parent.pdf(parent.domain[0] + ((parent.domain[1] - parent.domain[0]) * i) / (CURVE_SAMPLES - 1)),
    ),
  );

  const yMax = outcome.peakDensity * 1.12;

  return (
    <figure className={styles.figure}>
      <div className={styles.chartCell}>
        <p className={styles.panelLabel}>What you are sampling from</p>
        <Plot
          className={styles.parentChart}
          width={narrow ? 390 : 660}
          height={narrow ? 120 : 150}
          margin={narrow ? { top: 10, right: 14, bottom: 30, left: 40 } : { top: 10, right: 20, bottom: 32, left: 52 }}
          xDomain={parent.domain}
          yDomain={[0, parentPeak * 1.15]}
          yTicks={3}
          ariaLabel={`Density of the ${parent.label} parent distribution`}
        >
          {({ x, y, innerHeight }) => {
            const pts: string[] = [`${x(parent.domain[0])},${y(0)}`];
            for (let i = 0; i < CURVE_SAMPLES; i++) {
              const v =
                parent.domain[0] + ((parent.domain[1] - parent.domain[0]) * i) / (CURVE_SAMPLES - 1);
              pts.push(`${x(v)},${y(parent.pdf(v))}`);
            }
            pts.push(`${x(parent.domain[1])},${y(0)}`);
            return (
              <>
                <polygon className={styles.parentCurve} points={pts.join(' ')} />
                <line
                  className={styles.meanMark}
                  x1={x(parent.mean)}
                  x2={x(parent.mean)}
                  y1={0}
                  y2={innerHeight}
                />
              </>
            );
          }}
        </Plot>

        <p className={`${styles.panelLabel} ${styles.gap}`}>
          Means of {inputs.sampleSize} {inputs.sampleSize === 1 ? 'observation' : 'observations'}
        </p>
        <Plot
          className={styles.meansChart}
          width={narrow ? 390 : 660}
          height={narrow ? 250 : 330}
          margin={narrow ? { top: 12, right: 14, bottom: 40, left: 40 } : undefined}
          xDomain={outcome.domain}
          yDomain={[0, yMax]}
          yLabel="Density"
          ariaLabel="Histogram of sample means, with the normal predicted by the central limit theorem"
        >
          {({ x, y, innerHeight }) => (
            <>
              <defs>
                {/* Hatched, so a folded end bar cannot be mistaken for a mode. */}
                <pattern
                  id="clt-overflow"
                  width={5}
                  height={5}
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <rect width={5} height={5} fill="var(--signal-dim)" />
                  <line x1={0} y1={0} x2={0} y2={5} stroke="var(--signal)" strokeWidth={1.2} />
                </pattern>
              </defs>
              {outcome.bins.map((bin) => {
                const left = x(bin.from);
                const width = Math.max(0, x(bin.to) - left - 1);
                const top = y(bin.density);
                return (
                  <rect
                    key={bin.from}
                    className={`${styles.bar} ${bin.folded > 0 ? styles.barFolded : ''}`}
                    x={left}
                    y={top}
                    width={width}
                    height={Math.max(0, innerHeight - top)}
                  />
                );
              })}

              <line
                className={styles.meanMark}
                x1={x(outcome.predictedMean)}
                x2={x(outcome.predictedMean)}
                y1={0}
                y2={innerHeight}
              />

              {values.show_normal ? (
                <polyline
                  className={styles.normalCurve}
                  points={Array.from({ length: CURVE_SAMPLES }, (_, i) => {
                    const v =
                      outcome.domain[0] +
                      ((outcome.domain[1] - outcome.domain[0]) * i) / (CURVE_SAMPLES - 1);
                    return `${x(v)},${y(normalPdf(v, outcome.predictedMean, outcome.predictedSd))}`;
                  }).join(' ')}
                />
              ) : null}
            </>
          )}
        </Plot>
      </div>

      {controls ? <div className={styles.controlsCell}>{controls}</div> : null}

      <div className={styles.metricsCell}>
        <div className={styles.readouts}>
          <div className={styles.readout}>
            <span className={styles.readoutLabel}>Mean of the means</span>
            <span className={styles.readoutValue}>{outcome.observedMean.toFixed(3)}</span>
            <span className={styles.predicted}>predicted {outcome.predictedMean.toFixed(3)}</span>
          </div>
          <div className={styles.readout}>
            <span className={styles.readoutLabel}>Spread</span>
            <span className={styles.readoutValue} data-testid="observed-sd">
              {outcome.observedSd.toFixed(3)}
            </span>
            <span className={styles.predicted} data-testid="predicted-sd">
              &sigma;/&radic;n = {outcome.predictedSd.toFixed(3)}
            </span>
          </div>
          <div className={styles.readout}>
            <span className={styles.readoutLabel}>Skewness</span>
            <span className={styles.readoutValue} data-testid="observed-skew">
              {outcome.observedSkew.toFixed(2)}
            </span>
            <span className={styles.predicted}>
              predicted {outcome.predictedSkew.toFixed(2)}
            </span>
          </div>
        </div>

        {outcome.outsideWindow > 0 ? (
          <p className={styles.overflowNote}>
            {outcome.outsideWindow} of {inputs.draws} means fall beyond the plotted window and are
            stacked into the hatched end bars — a tail this model has, not a second peak.
          </p>
        ) : null}

        <figcaption className={styles.caption}>
          The dashed curve is not fitted to the bars. It is drawn from the parent&rsquo;s mean and
          variance alone, which is the whole claim: those two numbers are all that survives the
          averaging.
        </figcaption>
        <LiveDescription text={describe(inputs, outcome)} />
      </div>
    </figure>
  );
}
