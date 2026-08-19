/**
 * Renders the §7 five-part spine around an explorable's model.
 *
 * Generic over the explorable's schema: this file knows nothing about tax
 * incidence, which is what makes adding explorable #2 a content job rather than
 * a routing job.
 */
import { Suspense, useMemo } from 'react';
import { Controls } from '../engine/Controls';
import { Equation } from '../engine/Equation';
import { useParams } from '../engine/useParams';
import { trackParameterChanged } from '../engine/analytics';
import type { ParamSchema } from '../engine/params';
import type { ExplorableModule } from '../registry';
import styles from './ExplorablePage.module.css';

export interface ExplorablePageProps<S extends ParamSchema> {
  module: ExplorableModule<S>;
}

export function ExplorablePage<S extends ParamSchema>({ module }: ExplorablePageProps<S>) {
  const { meta, schema, View } = module;
  const rawParams = useParams(schema);

  // §10's single custom event. Wrapping `set` here rather than inside
  // useParams keeps the engine ignorant of analytics, and this is the only
  // layer that knows which explorable is on screen.
  const params = useMemo<typeof rawParams>(
    () => ({
      ...rawParams,
      set: (id, value) => {
        trackParameterChanged(meta.slug);
        rawParams.set(id, value);
      },
    }),
    [rawParams, meta.slug],
  );

  // §7.4: "Set it up" puts the model into the state the challenge is about, so
  // checking an answer is one click rather than a hunt across six sliders.
  const applySettings = (settings: Readonly<Record<string, number | string | boolean>>) => {
    for (const [id, value] of Object.entries(settings)) {
      params.set(id as never, value as never);
    }
  };

  return (
    <article className={styles.page}>
      <nav className={styles.breadcrumb}>
        <a href="/">Explorables</a>
        <span aria-hidden="true"> / </span>
        <span className={styles.kicker}>
          {meta.domain} · {meta.minutes} min
        </span>
      </nav>
      <h1 className={styles.title}>{meta.title}</h1>

      {/* 1. Hook */}
      <div className={styles.hook}>
        {meta.hook.map((para) => (
          <p key={para.slice(0, 32)}>{para}</p>
        ))}
      </div>

      {/* 2. Play */}
      <div className={styles.stage}>
        <p className={styles.prompt}>{meta.play}</p>
        {/* The view places the panel: §9 wants it directly under the chart on
            a phone, which only the view knows how to arrange. */}
        {/* §9: the View arrives as its own chunk. The fallback holds the
            stage open at roughly the right height so the prose below does not
            jump when it lands. */}
        <Suspense fallback={<div className={styles.stageFallback} aria-busy="true" />}>
          <View params={params} controls={<Controls schema={schema} params={params} />} />
        </Suspense>
      </div>

      {/* 3. Reveal — the equation appears here, not before (§7.3). */}
      <section className={styles.section}>
        <h2 className={styles.sectionHead}>What is going on</h2>
        {meta.reveal.map((para) => (
          <p key={para.slice(0, 32)}>{para}</p>
        ))}
        <Equation
          latex={meta.equation}
          className={styles.equation}
          ariaLabel="Price paid by the consumer minus price kept by the producer equals the tax"
        />
      </section>

      {/* 4. Edges */}
      <section className={styles.section}>
        <h2 className={styles.sectionHead}>Try to break it</h2>
        <ul className={styles.edges}>
          {meta.edges.map((edge) => (
            <li key={edge.prompt.slice(0, 40)} className={styles.edge}>
              <p className={styles.edgePrompt}>{edge.prompt}</p>
              <div className={styles.edgeActions}>
                {edge.settings ? (
                  <button
                    type="button"
                    className={styles.edgeButton}
                    onClick={() => applySettings(edge.settings ?? {})}
                  >
                    Set it up
                  </button>
                ) : null}
                <details>
                  <summary className={styles.answerSummary}>Show answer</summary>
                  <p className={styles.answer}>{edge.answer}</p>
                </details>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 5. Limits */}
      <section className={styles.section}>
        <h2 className={styles.sectionHead}>What this leaves out</h2>
        <ul className={styles.limits}>
          {meta.limits.map((limit) => (
            <li key={limit.slice(0, 32)}>{limit}</li>
          ))}
        </ul>
      </section>

      <footer className={styles.meta}>
        <p>Updated {meta.updated}</p>
        <p>
          <a href="/">All explorables</a>
        </p>
      </footer>
    </article>
  );
}
