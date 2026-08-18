/**
 * Static KaTeX typesetting. SPEC §3.1.
 *
 * KaTeX and its stylesheet are loaded on demand rather than in the initial
 * bundle: it is ~77KB gzipped, it is roughly half of the §9 budget on its own,
 * and no equation is visible until the reader reaches the Reveal section (§7.3).
 * Until it arrives the raw LaTeX shows in the utility face, which is also the
 * permanent fallback if the chunk fails to load.
 *
 * §2.3's live equation — symbols for controlled parameters rendered in --signal
 * and made drag targets — is milestone M3 and deliberately NOT built here. This
 * is the plain rendering it gets layered onto, and it doubles as the degradation
 * path §2.3 requires when symbol matching fails.
 */
import { useEffect, useState } from 'react';

export interface EquationProps {
  latex: string;
  display?: boolean;
  className?: string | undefined;
  /** Spoken form for assistive tech; KaTeX's own MathML is used when absent. */
  ariaLabel?: string | undefined;
}

export function Equation({ latex, display = true, className, ariaLabel }: EquationProps) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const [{ default: katex }] = await Promise.all([
          import('katex'),
          import('katex/dist/katex.min.css'),
        ]);
        if (!live) return;
        setHtml(
          katex.renderToString(latex, {
            displayMode: display,
            throwOnError: false,
            output: 'htmlAndMathml',
          }),
        );
      } catch {
        // Leave the LaTeX fallback in place.
      }
    })();
    return () => {
      live = false;
    };
  }, [latex, display]);

  if (html === null) {
    return (
      <div className={className}>
        <code className="numeric">{latex}</code>
      </div>
    );
  }

  return (
    <div
      className={className}
      {...(ariaLabel ? { role: 'math', 'aria-label': ariaLabel } : {})}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
