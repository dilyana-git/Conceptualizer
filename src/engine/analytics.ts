/**
 * Analytics. SPEC §10.
 *
 * "Plausible or Umami — cookieless, so no consent banner. Track only page views
 * and a single custom event: parameter_changed (fired once per session per
 * explorable), which measures whether people actually interact."
 *
 * Nothing is loaded unless the deployment configures it, so a build with no
 * analytics origin ships no third-party request and no dead script tag. Both
 * Plausible and Umami are drop-in here: they take the same two attributes and
 * expose a global function for custom events.
 *
 *   VITE_ANALYTICS_SRC     script URL, e.g. https://plausible.io/js/script.js
 *   VITE_ANALYTICS_DOMAIN  the site domain registered with the provider
 *
 * No cookies are set by either provider in this configuration, which is the
 * whole reason for choosing them: §10 wants no consent banner, and the way to
 * not need one is to not store anything on the reader's machine.
 */

interface AnalyticsGlobals {
  plausible?: (event: string, options?: { props?: Record<string, string> }) => void;
  umami?: { track: (event: string, data?: Record<string, string>) => void };
}

const SRC = import.meta.env.VITE_ANALYTICS_SRC as string | undefined;
const DOMAIN = import.meta.env.VITE_ANALYTICS_DOMAIN as string | undefined;

export function isEnabled(): boolean {
  return Boolean(SRC && DOMAIN);
}

/** Injects the provider's script. Page views are counted by the script itself. */
export function initAnalytics(): void {
  if (!isEnabled() || typeof document === 'undefined') return;
  if (document.querySelector('script[data-analytics]')) return;

  const script = document.createElement('script');
  script.defer = true;
  script.src = SRC!;
  script.setAttribute('data-domain', DOMAIN!);
  script.setAttribute('data-analytics', '');
  document.head.appendChild(script);
}

/**
 * The one custom event, fired at most once per explorable per session.
 *
 * The session guard is the point: counting every slider nudge would measure
 * fidgeting, and what §10 asks is the far cruder question of whether a reader
 * touched the model at all.
 */
export function trackParameterChanged(slug: string): void {
  if (!isEnabled() || typeof window === 'undefined') return;

  const key = `explorables:interacted:${slug}`;
  try {
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, '1');
  } catch {
    // Storage can be unavailable in private modes; sending a duplicate event is
    // a better failure than sending none.
  }

  const globals = window as unknown as AnalyticsGlobals;
  globals.plausible?.('parameter_changed', { props: { explorable: slug } });
  globals.umami?.track('parameter_changed', { explorable: slug });
}
