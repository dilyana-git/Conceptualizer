import type { ExplorableMeta } from '../../engine/meta';

export const meta: ExplorableMeta = {
  slug: 'central-limit',
  title: 'Why everything ends up looking like a bell',
  domain: 'statistics',
  blurb:
    'Averages of almost anything are normally distributed, even when the thing being averaged ' +
    'looks nothing like a bell. The useful part is knowing how fast that happens, and when it ' +
    'has not happened yet.',
  minutes: 6,
  prerequisites: [],
  related: ['statistical-power'],
  equation: '\\bar{X}_n \;\\approx\; \\mathcal{N}\\!\\left(\\mu,\; \\frac{\\sigma^2}{n}\\right)',
  updated: '2026-08-18',

  hook: [
    'Pick the two-hump parent below and set the sample size to one. The distribution has a ' +
      'perfectly good mean of 0.5, and essentially no chance of ever producing a value near ' +
      '0.5. It is either about zero or about one.',
    'Now average thirty of them. The result piles up almost entirely around 0.5 — the one value ' +
      'the original could not produce — in a shape you would happily call a bell.',
  ],

  play: 'Raise the observations per mean. Watch the shape forget where it came from.',

  reveal: [
    'Averaging does two separable things, and it helps to keep them apart. It shrinks the ' +
      'spread, and it changes the shape. The shrinking is the easy part: the standard deviation ' +
      'of a mean of n observations is the parent standard deviation divided by the square root ' +
      'of n. Square root, not n — which is why quadrupling your sample size only halves your ' +
      'uncertainty, and why the last increment of precision is always so expensive.',
    'The change in shape is the theorem proper. Whatever lumps, gaps and long tails the parent ' +
      'has, summing many draws smears them out, because there are far more ways to reach a ' +
      'middling total than an extreme one. The parent\'s specific quirks stop mattering and only ' +
      'its mean and variance survive into the answer.',
    'The question worth asking is not whether this happens but how fast. Skewness gives the ' +
      'answer: the skewness of a sample mean is the parent skewness divided by the square root ' +
      'of n. So the convergence speed is set by how lopsided you started. The exponential parent ' +
      'has skewness 2 and settles quickly. The lognormal has skewness above 6, needing roughly ' +
      'nine times the sample size to reach the same symmetry — and at n = 30, a number often ' +
      'quoted as sufficient, it is still visibly leaning.',
    'That is the practical content. "n = 30 is enough" is not a rule, it is a rule of thumb ' +
      'calibrated on mildly skewed data. For heavy-tailed data — incomes, insurance claims, ' +
      'file sizes, time-to-response — it can be badly optimistic, and any procedure that assumes ' +
      'the sample mean is normal inherits that error silently.',
  ],

  edges: [
    {
      prompt:
        'Set the sample size to 1 with any parent. What are you looking at, and why must it ' +
        'look like that?',
      answer:
        'The parent distribution itself. A "mean" of one observation is just the observation, so ' +
        'the histogram is a picture of what you are sampling from. It is worth doing once for ' +
        'each parent, because it is the baseline every other setting is departing from.',
      settings: { sampleSize: 1, parent: 'lognormal' },
    },
    {
      prompt:
        'With the exponential parent, compare the spread at n = 9 and n = 36. Predict the ratio ' +
        'before you look.',
      answer:
        'Exactly two. The spread goes as one over the square root of n, and the square root of ' +
        '36 over the square root of 9 is 6/3 = 2. Quadrupling the sample halves the ' +
        'uncertainty — the whole economics of sample size is in that exponent.',
      settings: { parent: 'exponential', sampleSize: 36 },
    },
    {
      prompt:
        'Set the lognormal parent at n = 30, then the exponential at n = 30. Both are "n over ' +
        '30". Are they equally normal?',
      answer:
        'No, and it is not close. The exponential\'s means have skewness 2/sqrt(30), about 0.37. ' +
        'The lognormal\'s have 6.18/sqrt(30), about 1.13 — still obviously lopsided, with a tail ' +
        'stretching right. To get the lognormal down to the exponential\'s skewness you would ' +
        'need roughly nine times as many observations per mean.',
      settings: { parent: 'lognormal', sampleSize: 30 },
    },
    {
      prompt:
        'Raise "how many means to draw" to its maximum while leaving the sample size small. Does ' +
        'the histogram become more normal?',
      answer:
        'It becomes smoother, not more normal. Drawing more means gives you a cleaner picture of ' +
        'the same lopsided distribution — the leaning does not go away, it just gets easier to ' +
        'see. Only the sample size fixes shape. This is the difference between resolving a ' +
        'distribution and changing it, and confusing the two is a common way to talk yourself ' +
        'into believing an assumption is met.',
      settings: { draws: 5000, sampleSize: 2, parent: 'lognormal' },
    },
  ],

  limits: [
    'Every parent here has a finite mean and variance, which is precisely the condition the ' +
      'theorem needs. Distributions without them exist and are not exotic — Cauchy is the ' +
      'standard example, and the average of a thousand Cauchy draws is distributed exactly like ' +
      'a single one, so averaging achieves nothing at all. Some real quantities, particularly in ' +
      'finance and network traffic, are heavy enough that the sample variance never settles.',
    'Observations are drawn independently. Real data is routinely correlated — repeated measures ' +
      'on the same subject, consecutive days, users in the same household — and correlation ' +
      'inflates the true spread of the mean above sigma over root n, sometimes by a lot. The ' +
      'formula does not warn you when this happens; it just quietly reports too much precision.',
    'The normal overlay is drawn with the true parent mean and variance, which in real work you ' +
      'do not have. Substituting estimates is what makes a t-distribution rather than a normal ' +
      'the right reference at small n, and that correction is not shown here.',
    'Convergence is judged here by skewness alone. Skewness is only the third moment; a ' +
      'distribution can be nearly symmetric and still have tails far heavier than a normal\'s, ' +
      'which matters enormously for anything driven by rare large values. A histogram that looks ' +
      'like a bell in the middle can still be badly non-normal where it counts.',
  ],
};
