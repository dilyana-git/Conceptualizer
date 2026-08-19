import type { ExplorableMeta } from '../../engine/meta';

export const meta: ExplorableMeta = {
  slug: 'bayes-base-rates',
  title: 'The test is 99% accurate and you are probably fine',
  domain: 'statistics',
  blurb:
    'A very good test for a very rare thing produces mostly false alarms. This is not a flaw ' +
    'in the test. It is arithmetic, and it does not go away by making the test better.',
  minutes: 6,
  prerequisites: [],
  related: ['statistical-power'],
  equation:
    'P(D \\mid +) = \\frac{P(+ \\mid D)\\,P(D)}{P(+ \\mid D)\\,P(D) + P(+ \\mid \\neg D)\\,P(\\neg D)}',
  updated: '2026-08-18',

  hook: [
    'A screening test catches 99% of the people who have a condition and correctly clears 95% ' +
      'of the people who do not. One in a hundred people has it. Your result comes back ' +
      'positive.',
    'Almost everyone — including, in repeated studies, most clinicians asked the question cold ' +
      '— puts the chance you have it somewhere above 90%. It is about 17%. The grid below is ' +
      'ten thousand people, and the reason is visible in it.',
  ],

  play: 'Drag how common the condition is. Watch the two coloured groups trade places.',

  reveal: [
    'A positive result does not put you in the population. It puts you in the group of people ' +
      'who tested positive, and that group has two kinds of people in it: those who have the ' +
      'condition and were correctly flagged, and those who do not and were flagged anyway. Your ' +
      'chance of being in the first kind is just the size of that group divided by the size of ' +
      'both together.',
    'The trap is that these two groups are drawn from wildly different-sized pools. The true ' +
      'positives come out of the small group who have the condition. The false positives come ' +
      'out of everyone else — and when the condition is rare, "everyone else" is essentially ' +
      'the whole population. A 5% error rate applied to 9,900 healthy people produces 495 false ' +
      'alarms, which comfortably outnumbers the 99 real cases.',
    'This is why sensitivity and specificity, which are the numbers a test is advertised with, ' +
      'cannot answer the question on their own. They describe the test. The answer you want ' +
      'also depends on who is being tested, and that is not a property of the test at all.',
    'The cleanest way to hold it in your head is the odds form. A test contributes exactly one ' +
      'number — its likelihood ratio, sensitivity divided by the false positive rate — and you ' +
      'multiply your prior odds by it. The test in the hook has a likelihood ratio of about 20. ' +
      'Multiplying odds of 1-to-99 by 20 gives 20-to-99, which is roughly one in six. Twenty is ' +
      'a strong test. It is just not strong enough to overcome ninety-nine to one.',
  ],

  edges: [
    {
      prompt:
        'Make the test perfect at catching the condition — sensitivity to 100% — while leaving ' +
        'specificity alone. Why does the answer barely move?',
      answer:
        'It goes from about 17% to about 17%. Sensitivity only governs what happens to the ' +
        'people who have the condition, and there are very few of them. It cannot remove a ' +
        'single false positive, and false positives are what the answer is made of. Raising ' +
        'specificity from 95% to 99.9% instead takes the same case above 90%.',
      settings: { sensitivity: 1, specificity: 0.95, prevalence: 0.01 },
    },
    {
      prompt:
        'Find the prevalence at which a positive result is a coin flip, with the original test. ' +
        'What is special about that point?',
      answer:
        'Around 5%, roughly 1 in 20. That is where the prior odds — about 1 to 19 — are exactly ' +
        'cancelled by the test\'s likelihood ratio of about 20. When the likelihood ratio equals ' +
        'the prior odds against, the posterior lands on even. It is a useful sanity check: a ' +
        'test can only be trusted on its own when the thing it looks for is about as likely as ' +
        'its likelihood ratio is large.',
      settings: { prevalence: 0.05, sensitivity: 0.99, specificity: 0.95 },
    },
    {
      prompt:
        'Go back to 1% prevalence and take a second, independent positive. Why does the answer ' +
        'jump so much more than the first test moved it?',
      answer:
        'The odds get multiplied by 20 again, so 1-to-99 becomes 400-to-99, or about 80%. Each ' +
        'test contributes the same factor, but factors compound while the prior is only paid ' +
        'once. This is exactly why screening protocols confirm rather than trusting a single ' +
        'result — and the arithmetic quietly assumes the second test fails independently of the ' +
        'first, which is often untrue.',
      settings: { prevalence: 0.01, tests: '2' },
    },
    {
      prompt:
        'Turn on "show only the people who tested positive" at 1 in 1,000 prevalence. What is ' +
        'the picture actually showing you?',
      answer:
        'The group you are actually in, once you hold a positive result. Almost all of it is ' +
        'orange. The blue is there — the test did find the real cases — but it is a thin seam in ' +
        'a much larger block of people who were told the same thing and are fine.',
      settings: { prevalence: 0.001, only_positives: true },
    },
  ],

  limits: [
    'Sensitivity and specificity are treated as fixed, known constants. In practice both are ' +
      'estimated from finite validation studies, carry their own confidence intervals, and ' +
      'often differ between the population the test was validated on and the one it is used on. ' +
      'A specificity quoted as 95% may not be 95% for you.',
    'Repeat tests are multiplied as though they were independent given disease status. They ' +
      'usually are not: if a positive was caused by something about your body that the test ' +
      'cross-reacts with, the same thing is still there for the second test. Genuine ' +
      'independence generally needs a test with a different mechanism, and treating correlated ' +
      'repeats as independent overstates the resulting certainty, sometimes dramatically.',
    'There are only two states here, condition and no condition, and one binary result. Real ' +
      'tests produce a continuous measurement that someone chose a threshold for, and moving ' +
      'that threshold trades sensitivity against specificity along a curve rather than setting ' +
      'them independently as two sliders do here.',
    'The prevalence that matters is the prevalence in the group actually being tested, which is ' +
      'rarely the population figure. Someone tested because they have symptoms has a much higher ' +
      'prior than someone screened at random, and the whole point of this model is that the ' +
      'prior is what dominates. Using a population base rate for a symptomatic patient will ' +
      'understate their risk badly.',
    'Nothing here weighs the consequences. A false alarm that leads to a cheap follow-up is not ' +
      'comparable to one that leads to invasive surgery, and a missed case may be far worse ' +
      'than either. Whether a screening programme is worth running is a question about costs ' +
      'and harms that these probabilities inform but do not answer.',
  ],
};
