/**
 * Reads design tokens out of the cascade at draw time.
 *
 * Canvas cannot resolve `var(--signal)` the way CSS can, so a canvas-based
 * explorable would otherwise have to hard-code hexes that silently drift from
 * `tokens.css`. This keeps §2.1 enforceable in one place: the stylesheet stays
 * the single definition of the palette, and canvas drawing asks it for values.
 */
export function readToken(name: string, fallback: string): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export interface Palette {
  paper: string;
  paperSunk: string;
  graphite: string;
  rule: string;
  muted: string;
  signal: string;
  signalWarm: string;
}

export function readPalette(): Palette {
  return {
    paper: readToken('--paper', '#F7F6F2'),
    paperSunk: readToken('--paper-sunk', '#EFEDE6'),
    graphite: readToken('--graphite', '#1A1D21'),
    rule: readToken('--rule', '#C9C6BC'),
    muted: readToken('--muted', '#6B6F76'),
    signal: readToken('--signal', '#0F5EF7'),
    signalWarm: readToken('--signal-warm', '#E8590C'),
  };
}
