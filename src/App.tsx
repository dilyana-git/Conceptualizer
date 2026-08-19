/**
 * Routing. §13 says to ask before adding a dependency, and a router is not
 * needed here: every route is a real pre-rendered document served by the host
 * (§10), so `location.pathname` decides what to mount and plain anchors move
 * between pages.
 */
import { ExplorablePage } from './routes/ExplorablePage';
import { IndexPage } from './routes/IndexPage';
import { NotFoundPage } from './routes/NotFoundPage';
import { findExplorable } from './registry';

export function currentSlug(pathname: string): string {
  return pathname.replace(/^\/+|\/+$/g, '');
}

export function App() {
  const path = typeof window === 'undefined' ? '/' : window.location.pathname;
  const slug = currentSlug(path);

  if (slug === '') {
    return (
      <main>
        <IndexPage />
      </main>
    );
  }

  const module = findExplorable(slug);
  if (!module) {
    return (
      <main>
        <NotFoundPage slug={slug} />
      </main>
    );
  }

  return (
    <main>
      <ExplorablePage module={module} />
    </main>
  );
}
