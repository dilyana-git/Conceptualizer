import type { ExplorableMeta } from '../../engine/meta';

export const meta: ExplorableMeta = {
  slug: 'statistical-power',
  title: 'What an underpowered study actually does',
  domain: 'statistics',
  blurb:
    'A small study is usually described as a weak version of a large one. It is worse than ' +
    'that: when a small study does find something, the finding is wrong by construction.',
  minutes: 7,
  prerequisites: [],
  related: ['survival-analysis'],
  equation: '\\text{power} = \\Phi\\!\\left(d\\sqrt{n/2} - z_{1-\\alpha/2}\\right)',
  updated: '2026-08-18',

  hook: [
    'The usual defence of a small study is that it is underpowered, so it will probably miss a ' +
      'real effect — a shame, but an honest kind of failure. The cost is assumed to fall on the ' +
      'findings that never appear.',
    'It does not. Power below about a third has a second consequence that is rarely mentioned: ' +
      'the only results that can clear the significance threshold are the ones that overshot. A ' +
      'small study is not a blurry photograph of the truth. It is a filter that passes ' +
      'exaggerations and blocks everything else.',
  ],

  play: 'Shrink the sample. Watch the significance threshold slide out past the true effect.',

  reveal: [
    'Two distributions are drawn here, and only one of them is real. The grey one is what your ' +
      'estimate would look like if there were no effect at all; the blue one is what it looks ' +
      'like given the effect you set. Both narrow as the sample grows, because a bigger sample ' +
      'estimates the same quantity more precisely.',
    'The test draws its line where the grey distribution becomes implausible — far enough into ' +
      'its tail that only alpha of null studies land beyond it. Power is simply how much of the ' +
      'blue distribution sits past that same line. Nothing more mysterious than that: it is one ' +
      'area, and everything that raises it does so by moving the two distributions apart or ' +
      'making them thinner.',
    'Now look at where the line falls when the sample is small. The threshold sits far to the ' +
      'right of the true effect, which means an estimate can only be called significant if it ' +
      'came in well above the truth. That is the exaggeration ratio: among studies that reach ' +
      'significance, the average reported effect is inflated, and at low power it is inflated by ' +
      'a factor of two, three, or more. The inflation is not bias in the study design. It is a ' +
      'property of what gets through the filter.',
    'Push the power low enough and a third failure appears. Some of the significant results land ' +
      'in the opposite tail entirely — reported with confidence, and with the wrong sign. This ' +
      'is why "we found a significant effect in a small sample" is not weak evidence for the ' +
      'effect being real. It is barely evidence at all about its size, and at the extreme, not ' +
      'even about its direction.',
  ],

  edges: [
    {
      prompt:
        'Set the true effect to zero. What is power, and why is that number not a coincidence?',
      answer:
        'Power equals alpha exactly. With no effect the two distributions are the same ' +
        'distribution, so "the fraction of the alternative beyond the threshold" is the same ' +
        'quantity as "the fraction of the null beyond the threshold" — and that is what alpha ' +
        'was defined to be. Every rejection at this setting is a false positive.',
      settings: { effect: 0, n: 30, alpha: 0.05 },
    },
    {
      prompt:
        'Set d = 0.5 and find the sample size that gives 80% power. Then halve it. What happens ' +
        'to power, and what happens to the size of a significant result?',
      answer:
        '63 per group gives 80% power. Halving to 30 drops power to 49%, which sounds ' +
        'survivable — but the exaggeration ratio climbs to about 1.4, so significant studies now ' +
        'report an effect around 40% larger than the truth on average. The lost power and the ' +
        'inflated estimate are the same phenomenon seen from two sides.',
      settings: { effect: 0.5, n: 30, alpha: 0.05, show_typem: true },
    },
    {
      prompt:
        'Now try a genuinely small study chasing a small effect: d = 0.1 with 10 per group. ' +
        'What fraction of its significant results point the wrong way?',
      answer:
        'About a quarter of them — 26%. Power is 5.6%, barely above alpha, so the significant ' +
        'results are drawn almost equally from both tails of a distribution that is nearly ' +
        'centred on zero. The exaggeration ratio is over ten: a significant finding from this ' +
        'design reports an effect roughly an order of magnitude too large, and one time in four ' +
        'it points the wrong way.',
      settings: { effect: 0.1, n: 10, alpha: 0.05, show_typem: true },
    },
    {
      prompt:
        'Keep the design fixed and loosen alpha from 0.05 to 0.2. Power goes up. Is the study ' +
        'better?',
      answer:
        'No — you have moved the threshold, not gathered evidence. Power rises because the line ' +
        'moved left, but so does the false positive rate, by exactly the same mechanism: one ' +
        'study in five with no effect at all now clears the bar. Alpha and power trade against ' +
        'each other at fixed sample size; only n and the effect itself move both in your favour.',
      settings: { effect: 0.3, n: 30, alpha: 0.2 },
    },
  ],

  limits: [
    'This is the normal approximation, not the t distribution: it assumes the standard deviation ' +
      'is known rather than estimated from the data. For small samples the real test has ' +
      'slightly less power than shown here, which is why the classic answer for d = 0.5 at 80% ' +
      'power is 64 per group while this model says 63. The gap is negligible there but grows as ' +
      'n shrinks, which is exactly where the lesson is sharpest — treat the very small samples ' +
      'here as slightly optimistic.',
    'The effect size is treated as known, which is the one thing a real researcher never has. ' +
      'Power calculated from a guessed effect is only as good as the guess, and power calculated ' +
      'retrospectively from the effect you observed is circular — it is a function of your ' +
      'p-value and tells you nothing new.',
    'Two equal groups, independent observations, equal variances, one pre-specified comparison. ' +
      'Clustering, repeated measures, unequal groups and covariates all change the arithmetic, ' +
      'usually by changing the effective sample size rather than the shape of the argument.',
    'Nothing here models the decisions that surround the test: choosing an outcome after seeing ' +
      'the data, running several comparisons and reporting one, or stopping when the result ' +
      'turns significant. Each of those inflates the real false positive rate well above the ' +
      'alpha on the slider, and no power calculation can detect it afterwards.',
    'The exaggeration and sign-error figures describe the population of studies that reach ' +
      'significance, not any particular one. They tell you how much to discount a class of ' +
      'result; they cannot tell you whether the specific study in front of you was one of the ' +
      'lucky ones.',
  ],
};
