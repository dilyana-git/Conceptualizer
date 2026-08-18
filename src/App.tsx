/**
 * §11: the index page is deliberately last (M5), and no router dependency is
 * added for a single route — §13 says ask before adding a dependency, and at M1
 * `location.pathname` answers the only question there is.
 */
import { ExplorablePage } from './routes/ExplorablePage';
import { findExplorable, registry } from './registry';

export function App() {
  const path = typeof window === 'undefined' ? '/' : window.location.pathname;
  const slug = path.replace(/^\/+|\/+$/g, '');

  const fallback = registry[0];
  const module = findExplorable(slug) ?? fallback;

  if (!module) return <main>No explorables are registered.</main>;

  return (
    <main>
      <ExplorablePage module={module} />
    </main>
  );
}
