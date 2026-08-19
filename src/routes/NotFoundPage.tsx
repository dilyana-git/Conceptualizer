import { registry } from '../registry';
import styles from './NotFoundPage.module.css';

export function NotFoundPage({ slug }: { slug: string }) {
  return (
    <article className={styles.page}>
      <p className={styles.code}>Not found</p>
      <h1>There is nothing at /{slug}</h1>
      <p>
        Either it has not been built yet, or the address is mistyped. Everything that does exist is
        on <a href="/">the index</a>.
      </p>
      <ul className={styles.list}>
        {registry.map(({ meta }) => (
          <li key={meta.slug}>
            <a href={`/${meta.slug}`}>{meta.title}</a>
          </li>
        ))}
      </ul>
    </article>
  );
}
