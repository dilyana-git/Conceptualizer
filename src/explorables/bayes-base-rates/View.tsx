/**
 * Rendering only (§3.3). Every count comes from `model.ts`.
 *
 * The icon array is Canvas rather than SVG: ten thousand DOM nodes would be a
 * slideshow, and §3.1 puts the cutover at roughly 400 moving elements. Drawing
 * is batched by category so a repaint is four fillStyle changes, not 10,000.
 */
import { useMemo } from 'react';
import { Canvas } from '../../engine/Canvas';
import { LiveDescription } from '../../engine/LiveDescription';
import { readPalette } from '../../engine/tokens';
import type { ParamApi } from '../../engine/useParams';
import { POPULATION, describe, iconCategories, solve, type BayesInputs } from './model';
import type { Schema } from './params';
import styles from './View.module.css';

const pct = (v: number) => `${(v * 100).toFixed(v < 0.1 ? 1 : 1)}%`;
const int = (v: number) => v.toLocaleString('en-US');

export interface ViewProps {
  params: ParamApi<Schema>;
  controls?: React.ReactNode;
}

export function View({ params, controls }: ViewProps) {
  const { values } = params;

  const inputs: BayesInputs = {
    prevalence: values.prevalence,
    sensitivity: values.sensitivity,
    specificity: values.specificity,
    tests: Number(values.tests),
  };

  const outcome = solve(inputs);
  const onlyPositives = values.only_positives;

  const icons = useMemo(() => iconCategories(inputs), [
    inputs.prevalence,
    inputs.sensitivity,
    inputs.specificity,
  ]);

  // When the reader asks to see only positives, the array becomes the group a
  // positive result actually puts them in.
  const shown = useMemo(() => {
    if (!onlyPositives) return icons;
    const out = new Uint8Array(outcome.positives);
    let i = 0;
    for (const code of icons) {
      if (code === 1 || code === 3) out[i++] = code;
      if (i >= out.length) break;
    }
    return out;
  }, [icons, onlyPositives, outcome.positives]);

  const draw = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const palette = readPalette();
    const total = shown.length;
    if (total === 0) return;

    const cols = Math.max(1, Math.ceil(Math.sqrt(total)));
    const rows = Math.ceil(total / cols);
    const cell = Math.min(width / cols, height / rows);
    const dot = Math.max(1, cell - Math.max(0.5, cell * 0.22));
    const offsetX = (width - cols * cell) / 2;
    const offsetY = (height - rows * cell) / 2;

    const colours: Record<number, string> = {
      0: palette.rule,
      1: palette.signal,
      2: palette.graphite,
      3: palette.signalWarm,
    };

    // One pass per category: four state changes rather than one per icon.
    for (const code of [0, 2, 3, 1]) {
      ctx.fillStyle = colours[code]!;
      for (let i = 0; i < total; i++) {
        if (shown[i] !== code) continue;
        const x = offsetX + (i % cols) * cell;
        const y = offsetY + Math.floor(i / cols) * cell;
        ctx.fillRect(x, y, dot, dot);
      }
    }
  };

  const description = describe(inputs, outcome);
  const truePart = outcome.positives === 0 ? 0 : outcome.truePositive / outcome.positives;

  return (
    <figure className={styles.figure}>
      <div className={styles.arrayCell}>
        <div className={styles.canvasHolder}>
          <Canvas
            draw={draw}
            ariaLabel={
              onlyPositives
                ? 'Grid of everyone who tested positive, split into real cases and false alarms'
                : `Grid of ${int(POPULATION)} people, coloured by condition and test result`
            }
          />
        </div>

        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={`${styles.swatch} ${styles.swatchTp}`} />
            has it, tested positive · {int(outcome.truePositive)}
          </span>
          <span className={styles.legendItem}>
            <span className={`${styles.swatch} ${styles.swatchFp}`} />
            does not, tested positive · {int(outcome.falsePositive)}
          </span>
          {!onlyPositives ? (
            <>
              <span className={styles.legendItem}>
                <span className={`${styles.swatch} ${styles.swatchFn}`} />
                has it, missed · {int(outcome.falseNegative)}
              </span>
              <span className={styles.legendItem}>
                <span className={`${styles.swatch} ${styles.swatchTn}`} />
                cleared · {int(outcome.trueNegative)}
              </span>
            </>
          ) : null}
        </div>
      </div>

      {controls ? <div className={styles.controlsCell}>{controls}</div> : null}

      <div className={styles.metricsCell}>
        <div className={styles.verdict}>
          <p className={styles.verdictLabel}>
            Of everyone who tested positive{inputs.tests > 1 ? ` ${inputs.tests} times` : ''}
          </p>
          <div className={styles.bar} role="img" aria-label={`${pct(outcome.ppv)} really have it`}>
            <div className={styles.barTrue} style={{ width: `${truePart * 100}%` }} />
            <div className={styles.barFalse} style={{ width: `${(1 - truePart) * 100}%` }} />
          </div>
          <div className={styles.barCaption}>
            <span className={styles.barTrueText}>{pct(truePart)} really have it</span>
            <span className={styles.barFalseText}>{pct(1 - truePart)} false alarm</span>
          </div>
        </div>

        <div className={styles.readouts}>
          <div className={styles.readout}>
            <span className={styles.readoutLabel}>Chance you have it</span>
            <span className={`${styles.readoutValue} ${styles.readoutTrue}`} data-testid="ppv">
              {pct(outcome.ppv)}
            </span>
          </div>
          <div className={styles.readout}>
            <span className={styles.readoutLabel}>After one test</span>
            <span className={`${styles.readoutValue} ${styles.readoutInk}`}>
              {pct(outcome.ppvSingle)}
            </span>
          </div>
          <div className={styles.readout}>
            <span className={styles.readoutLabel}>Likelihood ratio</span>
            <span
              className={`${styles.readoutValue} ${styles.readoutInk}`}
              data-testid="likelihood-ratio"
            >
              {Number.isFinite(outcome.likelihoodRatioPositive)
                ? `${outcome.likelihoodRatioPositive.toFixed(1)}x`
                : 'conclusive'}
            </span>
          </div>
          <div className={styles.readout}>
            <span className={styles.readoutLabel}>A negative clears you</span>
            <span className={`${styles.readoutValue} ${styles.readoutInk}`}>
              {pct(outcome.npv)}
            </span>
          </div>
        </div>

        <figcaption className={styles.caption}>
          The blue block is the real cases the test found. The orange block is everyone else it
          flagged. A positive result tells you that you are somewhere in the two of them together
          — nothing more precise than that.
        </figcaption>
        <LiveDescription text={description} />
      </div>
    </figure>
  );
}
