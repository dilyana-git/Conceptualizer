import type { ExplorableMeta } from '../../engine/meta';

export const meta: ExplorableMeta = {
  slug: 'bias-variance',
  title: 'Why the better fit is the worse model',
  domain: 'statistics',
  blurb:
    'Every model that fits your training data more closely is doing two things at once, and ' +
    'only one of them is learning. The other is memorising noise you will never see again.',
  minutes: 7,
  prerequisites: [],
  related: ['statistical-power'],
  equation:
    '\\mathbb{E}\\big[(y-\\hat{f})^2\\big] = \\text{bias}^2 + \\text{variance} + \\sigma^2',
  updated: '2026-08-18',

  hook: [
    'Two models are offered for the same job. The first misses many of the training points. The ' +
      'second passes through nearly all of them. On the evidence in front of you, the second is ' +
      'plainly better.',
    'It is usually worse, and the training data cannot tell you so — the very number you used to ' +
      'compare them can only fall as the model gets more flexible, whether that flexibility is ' +
      'buying you signal or noise.',
  ],

  play: 'Raise the flexibility. Watch the fits scatter even though each one hugs its data harder.',

  reveal: [
    'The faint blue curves are all the same model fitted to different draws of the same ' +
      'experiment. Nothing about the underlying truth changed between them; only the noise did. ' +
      'How far apart they spread is the variance — how much the answer you get depends on which ' +
      'data you happened to collect.',
    'Their average is the orange curve, and how far *it* sits from the black one is the bias — ' +
      'the part of the target the model could never reach no matter how much data you gave it. A ' +
      'straight line fitted to a wave has enormous bias and almost no variance: every draw is ' +
      'wrong, and they are all wrong in the same way.',
    'Expected error on new data is these two plus the noise itself, and the identity is exact: ' +
      'squared bias plus variance plus sigma squared. Raising flexibility always buys bias down ' +
      'and always sells variance up. Below the right degree you are paying in bias, above it you ' +
      'are paying in variance, and the total traces the U you can watch in the bar as you drag.',
    'The trap is that training error does not trace that U. It falls monotonically, all the way ' +
      'to zero if you let the model interpolate, because it is measured on exactly the points the ' +
      'model was allowed to bend toward. That is the whole reason held-out data exists: not as ' +
      'statistical etiquette, but because the quantity you naturally look at is guaranteed to ' +
      'recommend the most overfitted model you can build.',
  ],

  edges: [
    {
      prompt:
        'Set the noise to zero and raise the degree. Where does the variance go, and what does ' +
        'that tell you about what variance actually measures?',
      answer:
        'It vanishes — every draw is identical, so the curves collapse onto one another however ' +
        'flexible the model is. Variance is not a property of the model alone; it is how much ' +
        'the model amplifies randomness in the data. With no randomness to amplify, even a ' +
        'degree-9 fit is perfectly stable, and the only error left is bias.',
      settings: { noise: 0, degree: 9, trainSize: 20 },
    },
    {
      prompt:
        'With 20 points and the default noise, step the degree from 0 upward and watch the bar. ' +
        'Where is the total lowest, and does the training error agree?',
      answer:
        'Total expected error bottoms out at degree 3 — the U in the bar. Training error does not ' +
        'agree and never will: it keeps falling past degree 3, right through the region where the ' +
        'model is getting measurably worse at its actual job. Choosing a model by training error ' +
        'means always choosing the far right-hand end.',
      settings: { degree: 3, trainSize: 20, noise: 0.2 },
    },
    {
      prompt:
        'Fix the degree at 9 and slide the training points from 6 up to 60. Which of the three ' +
        'components moves, and which does not?',
      answer:
        'Variance falls sharply — more data pins the flexible model down, so the draws stop ' +
        'disagreeing. Bias barely moves, because a degree-9 polynomial could already reach the ' +
        'target. The irreducible term does not move at all. This is why a flexible model is not ' +
        'wrong in itself: it is wrong at the sample size you have.',
      settings: { degree: 9, trainSize: 6, noise: 0.2 },
    },
    {
      prompt:
        'Set the degree to 1 and the noise to zero, then add more data. Why does the error stop ' +
        'falling?',
      answer:
        'Because what is left is pure bias, and data cannot buy it down. A straight line cannot ' +
        'be a sine wave, so the average fit misses the target by the same shape no matter how ' +
        'many points it sees. Bias is the one component that only a different model can fix — ' +
        'more data is the answer to variance, not to being wrong on purpose.',
      settings: { degree: 1, noise: 0, trainSize: 60 },
    },
  ],

  limits: [
    'The training x positions are the same in every draw, so the only thing varying is the noise. ' +
      'With x drawn at random too, high-degree fits occasionally land on badly clustered points ' +
      'and produce curves that fly off the scale — real behaviour, and a lesson about the ' +
      'conditioning of near-interpolation rather than about this trade-off. Fixing the design ' +
      'isolates the effect being shown.',
    'Bias and variance here are computed against a target that is known exactly, and averaged ' +
      'over draws that can be repeated at will. Neither is available in practice. Real work ' +
      'estimates the sum of all three components on held-out data and never sees the split, ' +
      'which is why the decomposition is a way of thinking rather than a diagnostic you can run.',
    'Polynomial degree is a single, unusually clean flexibility knob. Real models are made ' +
      'flexible by depth, width, tree count, feature engineering and training time at once, and ' +
      'those interact. Regularisation complicates the picture further by lowering variance ' +
      'without removing model capacity.',
    'The clean U-shape is a property of this setting, not a law. Modern heavily ' +
      'over-parameterised models can show test error falling again past the interpolation ' +
      'threshold rather than rising without limit, so "more flexible eventually means worse" is ' +
      'the right instinct for the regime drawn here and not a universal one.',
    'Squared error is assumed throughout. The decomposition into exactly these three additive ' +
      'terms is a property of squared loss and does not carry over unchanged to classification ' +
      'error, absolute error, or likelihood-based measures.',
  ],
};
