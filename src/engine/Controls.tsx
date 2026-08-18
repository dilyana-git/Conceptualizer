/**
 * schema → rendered control panel. SPEC §4.
 *
 * Everything here is a native form element with a programmatic label (§9), so
 * keyboard support, screen-reader support and correct touch behaviour come free
 * rather than being reimplemented badly.
 */
import { useId, useState } from 'react';
import { scaleLog } from 'd3-scale';
import {
  formatValue,
  quantise,
  type ContinuousParam,
  type DiscreteParam,
  type ParamSchema,
  type ParamSpec,
  type ToggleParam,
} from './params';
import type { ParamApi } from './useParams';
import styles from './Controls.module.css';

/** Slider positions for log params; the readout always shows the real value. */
const LOG_STEPS = 1000;

function logScaleFor(spec: ContinuousParam) {
  return scaleLog().domain([spec.min, spec.max]).range([0, LOG_STEPS]);
}

function ContinuousField({
  spec,
  value,
  onChange,
}: {
  spec: ContinuousParam;
  value: number;
  onChange: (v: number) => void;
}) {
  const id = useId();
  const isLog = spec.scale === 'log';
  const scale = isLog ? logScaleFor(spec) : null;

  const sliderValue = scale ? scale(value) : value;
  const sliderMin = scale ? 0 : spec.min;
  const sliderMax = scale ? LOG_STEPS : spec.max;
  const sliderStep = scale ? 1 : spec.step;

  const handle = (raw: number) => {
    const real = scale ? scale.invert(raw) : raw;
    onChange(quantise(spec, real));
  };

  const shown = formatValue(spec, value);

  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label className={styles.label} htmlFor={id}>
          {spec.label}
        </label>
        <span className={styles.readout}>
          {shown}
          {spec.unit ? <span className={styles.unit}>{spec.unit}</span> : null}
        </span>
      </div>
      <input
        id={id}
        className={styles.range}
        type="range"
        min={sliderMin}
        max={sliderMax}
        step={sliderStep}
        value={sliderValue}
        onChange={(e) => handle(Number(e.target.value))}
        aria-valuetext={spec.unit ? `${shown} ${spec.unit}` : shown}
      />
      <div className={styles.bounds}>
        <span>{formatValue(spec, spec.min)}</span>
        <span>{formatValue(spec, spec.max)}</span>
      </div>
    </div>
  );
}

function DiscreteField({
  spec,
  value,
  onChange,
}: {
  spec: DiscreteParam;
  value: string;
  onChange: (v: string) => void;
}) {
  const name = useId();
  return (
    <fieldset className={styles.field}>
      <legend className={styles.label}>{spec.label}</legend>
      <div className={styles.options}>
        {spec.options.map((opt) => {
          const checked = opt.value === value;
          return (
            <label
              key={opt.value}
              className={`${styles.option} ${checked ? styles.optionChecked : ''}`}
            >
              <input
                type="radio"
                name={name}
                value={opt.value}
                checked={checked}
                onChange={() => onChange(opt.value)}
              />
              {opt.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function ToggleField({
  spec,
  value,
  onChange,
}: {
  spec: ToggleParam;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className={styles.field}>
      <div className={styles.toggleRow}>
        <input
          id={id}
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          {...(spec.hint ? { 'aria-describedby': hintId } : {})}
        />
        <label className={styles.label} htmlFor={id}>
          {spec.label}
        </label>
      </div>
      {spec.hint ? (
        <p className={styles.hint} id={hintId}>
          {spec.hint}
        </p>
      ) : null}
    </div>
  );
}

export interface ControlsProps<S extends ParamSchema> {
  schema: S;
  params: ParamApi<S>;
  /** Panel heading; defaults to "Parameters". */
  title?: string | undefined;
}

export function Controls<S extends ParamSchema>({ schema, params, title }: ControlsProps<S>) {
  const { values, set, reset, isDirty, shareUrl } = params;
  const [copied, setCopied] = useState(false);
  const bag = values as Record<string, number | string | boolean>;

  // §6: "Copy link to this state" sits with the parameter panel, not in a share tray.
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked by permissions; the URL bar already holds the
      // state, so failing silently costs the reader nothing.
    }
  };

  const render = (spec: ParamSpec) => {
    switch (spec.kind) {
      case 'continuous':
        return (
          <ContinuousField
            key={spec.id}
            spec={spec}
            value={bag[spec.id] as number}
            onChange={(v) => set(spec.id as never, v as never)}
          />
        );
      case 'discrete':
        return (
          <DiscreteField
            key={spec.id}
            spec={spec}
            value={bag[spec.id] as string}
            onChange={(v) => set(spec.id as never, v as never)}
          />
        );
      case 'toggle':
        return (
          <ToggleField
            key={spec.id}
            spec={spec}
            value={bag[spec.id] as boolean}
            onChange={(v) => set(spec.id as never, v as never)}
          />
        );
    }
  };

  return (
    <section className={styles.panel} aria-label={title ?? 'Parameters'}>
      <div className={styles.head}>
        <span className={styles.headTitle}>{title ?? 'Parameters'}</span>
        <div className={styles.actions}>
          {copied ? <span className={styles.copied}>copied</span> : null}
          <button type="button" className={styles.action} onClick={copy}>
            Copy link to this state
          </button>
          {/* §4: a Reset affordance appears only when isDirty. */}
          {isDirty ? (
            <button type="button" className={styles.action} onClick={reset}>
              Reset
            </button>
          ) : null}
        </div>
      </div>
      {schema.map(render)}
    </section>
  );
}
