/**
 * Explorable module contract. SPEC §5 and §7.
 *
 * §7 requires the five-part spine be enforced as typed fields so an incomplete
 * explorable fails the build rather than shipping half-written. Hook, play,
 * reveal, edges and limits are all required — `limits` especially, since that
 * is the section that distinguishes this from a physics demo page.
 */

export type Domain = 'physics' | 'mathematics' | 'economics' | 'statistics';

/** §7.4: a challenge prompt the widget can actually answer. */
export interface EdgeChallenge {
  /** The prompt put to the reader. */
  prompt: string;
  /** The checkable answer, revealed on demand. */
  answer: string;
  /**
   * Optional parameter values that set the model to the state in question, so
   * "show me" is one click rather than a hunt.
   */
  settings?: Readonly<Record<string, number | string | boolean>>;
}

/**
 * At least two Edge challenges (§12). Expressed as a non-empty pair-or-more
 * tuple so the requirement is a type error, not a lint rule.
 */
export type EdgeChallenges = readonly [EdgeChallenge, EdgeChallenge, ...EdgeChallenge[]];

export interface ExplorableMeta {
  slug: string;
  title: string;
  domain: Domain;
  blurb: string;
  minutes: number;
  /** Slugs; may be empty. */
  prerequisites: readonly string[];
  related: readonly string[];
  /** LaTeX source for the governing equation (§2.3). */
  equation: string;
  /** ISO date. */
  updated: string;

  /* --- §7: the five-part spine --- */

  /**
   * 1. Hook — one or two sentences naming a concrete situation where the
   * reader's default intuition is wrong. Never "In this explorable we will…".
   */
  hook: readonly string[];
  /** 2. Play — the single opening prompt shown with the model at defaults. */
  play: string;
  /** 3. Reveal — the mechanism, in prose, after the reader has already felt it. */
  reveal: readonly string[];
  /** 4. Edges — challenge prompts with checkable answers. */
  edges: EdgeChallenges;
  /**
   * 5. Limits — what the model does not capture, stated plainly. Every model on
   * this site is a lie of some useful size; say which lie.
   */
  limits: readonly string[];
}
