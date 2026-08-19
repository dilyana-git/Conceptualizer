/**
 * The library index. SPEC §11 — built last, on purpose.
 *
 * Reads the registry, so adding an explorable adds a row here with no further
 * work (§5). Plain anchors rather than a router: every route is a real
 * pre-rendered document (§10), and a client-side link would throw that away.
 */
import { registry } from '../registry';
import type { Domain } from '../engine/meta';
import styles from './IndexPage.module.css';

const DOMAIN_ORDER: Domain[] = ['physics', 'mathematics', 'economics', 'statistics'];

const DOMAIN_LABEL: Record<Domain, string> = {
  physics: 'Physics',
  mathematics: 'Mathematics',
  economics: 'Economics',
  statistics: 'Statistics and data',
};

export function IndexPage() {
  const byDomain = DOMAIN_ORDER.map((domain) => ({
    domain,
    entries: registry.filter((e) => e.meta.domain === domain),
  })).filter((group) => group.entries.length > 0);

  return (
    <article className={styles.page}>
      <header className={styles.masthead}>
        <h1 className={styles.wordmark}>Explorables</h1>
        <p className={styles.standfirst}>
          A small library of interactive explanations. Each one is a working model you take apart
          by hand — not a video, and not a diagram that holds still.
        </p>
      </header>

      {byDomain.map(({ domain, entries }) => (
        <section className={styles.domain} key={domain}>
          <h2 className={styles.domainName}>{DOMAIN_LABEL[domain]}</h2>
          <ul className={styles.list}>
            {entries.map(({ meta }) => (
              <li className={styles.item} key={meta.slug}>
                <a className={styles.link} href={`/${meta.slug}`}>
                  <div>
                    <h3 className={styles.title}>{meta.title}</h3>
                    <p className={styles.blurb}>{meta.blurb}</p>
                  </div>
                  <span className={styles.minutes}>{meta.minutes} min</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className={styles.colophon}>
        Every model here runs entirely in your browser, computes its own numbers, and is tested
        against results that can be worked out on paper. Nothing is generated, and nothing is
        fetched while you read.
      </p>
    </article>
  );
}
