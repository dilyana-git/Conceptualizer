import { useEffect, useState } from 'react';

/**
 * Narrow-viewport detection for cases CSS cannot reach — chiefly picking an SVG
 * viewBox (§9). A 660-wide viewBox scaled into a 375px column renders its 11px
 * ticks at ~6px; the fix is a different coordinate system, not a different
 * stylesheet.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
