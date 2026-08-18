/**
 * §9: every explorable carries a figcaption-level text description of what the
 * visualization currently shows, updated on a debounced aria-live="polite"
 * region — so a screen reader user gets the state change, not just the control
 * value.
 *
 * Debounced because an undebounced live region during a slider drag produces a
 * queue of announcements the reader has to sit through.
 */
import { useEffect, useState } from 'react';

export const LIVE_DEBOUNCE_MS = 700;

export interface LiveDescriptionProps {
  text: string;
  /** Render visibly as a caption as well as announcing it. */
  visible?: boolean;
  className?: string | undefined;
}

export function LiveDescription({ text, visible = false, className }: LiveDescriptionProps) {
  const [announced, setAnnounced] = useState(text);

  useEffect(() => {
    const handle = window.setTimeout(() => setAnnounced(text), LIVE_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [text]);

  return (
    <p
      className={visible ? className : `visually-hidden ${className ?? ''}`}
      aria-live="polite"
      aria-atomic="true"
    >
      {announced}
    </p>
  );
}
