/**
 * §9: canvases re-size through ResizeObserver, not window resize — a window
 * listener misses layout changes that do not come from the viewport.
 */
import { useEffect, useState, type RefObject } from 'react';

export interface Size {
  width: number;
  height: number;
}

export function useResizeObserver<T extends Element>(ref: RefObject<T | null>): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof ResizeObserver === 'undefined') {
      const rect = el.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
      return;
    }
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const box = entry.contentRect;
      setSize((prev) =>
        prev.width === box.width && prev.height === box.height
          ? prev
          : { width: box.width, height: box.height },
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return size;
}
